"""
IntegLayer — Sincronização com CRMs, ERPs e webhooks externos.
Todos os eventos internos do ProspectFlow são publicados aqui.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import httpx

from config import settings

logger = logging.getLogger(__name__)


class PFEvent(str, Enum):
    LEAD_CREATED = "lead.created"
    LEAD_CONTACTED = "lead.contacted"
    LEAD_RESPONDED = "lead.responded"
    DEAL_CLOSED = "deal.closed"
    SITE_DELIVERED = "site.delivered"
    LEAD_LOST = "lead.lost"
    OPT_OUT = "lead.opt_out"


class IntegLayer:
    """
    Publica eventos do ProspectFlow para CRMs/ERPs externos.
    Suporta: HubSpot, RD Station, Pipedrive, webhook genérico.
    """

    def __init__(self):
        self._http: httpx.AsyncClient | None = None

    async def __aenter__(self):
        self._http = httpx.AsyncClient(timeout=15.0)
        return self

    async def __aexit__(self, *_):
        if self._http:
            await self._http.aclose()

    # ── Publicador central ────────────────────────────────────────────────

    async def publish(self, event: PFEvent, payload: dict) -> None:
        """
        Publica um evento para todos os destinos configurados.
        Erros em um destino não afetam os demais.
        """
        envelope = {
            "event": event.value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "prospectflow",
            "data": payload,
        }

        tasks = []

        if settings.hubspot_access_token:
            tasks.append(self._publish_hubspot(event, payload))

        if settings.rdstation_client_id:
            tasks.append(self._publish_rdstation(event, payload))

        if settings.pipedrive_api_token:
            tasks.append(self._publish_pipedrive(event, payload))

        if settings.webhook_url:
            tasks.append(self._publish_webhook(envelope))

        import asyncio
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error("Falha na integração [%d]: %s", i, result)

    # ── HubSpot ───────────────────────────────────────────────────────────

    async def _publish_hubspot(self, event: PFEvent, data: dict) -> None:
        base = "https://api.hubapi.com"
        token = settings.hubspot_access_token.get_secret_value()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        if event == PFEvent.LEAD_CREATED:
            payload = {
                "properties": {
                    "company": data.get("name", ""),
                    "phone": data.get("phone", ""),
                    "city": data.get("city", ""),
                    "hs_lead_status": "NEW",
                    "description": f"Lead ProspectFlow | Nicho: {data.get('niche')} | Score: {data.get('score')}",
                }
            }
            resp = await self._http.post(f"{base}/crm/v3/objects/contacts", json=payload, headers=headers)
            resp.raise_for_status()
            logger.info("HubSpot: contato criado para %s", data.get("name"))

        elif event == PFEvent.DEAL_CLOSED:
            # Cria deal no HubSpot
            payload = {
                "properties": {
                    "dealname": f"Site {data.get('name')}",
                    "amount": str(data.get("price", 0)),
                    "dealstage": "closedwon",
                    "pipeline": "default",
                }
            }
            resp = await self._http.post(f"{base}/crm/v3/objects/deals", json=payload, headers=headers)
            resp.raise_for_status()
            logger.info("HubSpot: deal fechado para %s", data.get("name"))

    # ── RD Station ────────────────────────────────────────────────────────

    async def _publish_rdstation(self, event: PFEvent, data: dict) -> None:
        # RD Station usa webhooks de entrada via API de conversões
        base = "https://api.rd.services"

        # Autentica (precisa ter access_token válido salvo)
        # Aqui simplificamos — em produção implementar OAuth flow completo
        access_token = settings.rdstation_client_id  # placeholder

        if event in (PFEvent.LEAD_CREATED, PFEvent.LEAD_CONTACTED):
            payload = {
                "event_type": "CONVERSION",
                "event_family": "CDP",
                "payload": {
                    "conversion_identifier": "ProspectFlow Lead",
                    "name": data.get("name", ""),
                    "mobile_phone": data.get("phone", ""),
                    "city": data.get("city", ""),
                    "tags": [f"prospectflow", data.get("niche", ""), data.get("city", "")],
                },
            }
            resp = await self._http.post(
                f"{base}/platform/events",
                json=payload,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            logger.info("RD Station: evento enviado para %s", data.get("name"))

    # ── Pipedrive ─────────────────────────────────────────────────────────

    async def _publish_pipedrive(self, event: PFEvent, data: dict) -> None:
        token = settings.pipedrive_api_token.get_secret_value()
        base = f"https://api.pipedrive.com/v1"
        params = {"api_token": token}

        if event == PFEvent.LEAD_CREATED:
            # Cria organização + pessoa + lead no Pipedrive
            org_resp = await self._http.post(
                f"{base}/organizations",
                json={"name": data.get("name"), "address": data.get("city")},
                params=params,
            )
            org_resp.raise_for_status()
            org_id = org_resp.json()["data"]["id"]

            person_payload = {
                "name": f"Responsável - {data.get('name')}",
                "phone": [{"value": data.get("phone", ""), "primary": True}],
                "org_id": org_id,
            }
            await self._http.post(f"{base}/persons", json=person_payload, params=params)
            logger.info("Pipedrive: organização criada para %s", data.get("name"))

        elif event == PFEvent.DEAL_CLOSED:
            deal_payload = {
                "title": f"Site {data.get('name')}",
                "value": data.get("price", 0),
                "currency": "BRL",
                "status": "won",
            }
            resp = await self._http.post(f"{base}/deals", json=deal_payload, params=params)
            resp.raise_for_status()
            logger.info("Pipedrive: deal criado para %s", data.get("name"))

    # ── Webhook genérico (HMAC-assinado) ──────────────────────────────────

    async def _publish_webhook(self, envelope: dict, max_retries: int = 3) -> None:
        if not settings.webhook_url:
            return

        body = json.dumps(envelope, ensure_ascii=False, default=str)

        # Assina com HMAC-SHA256
        signature = ""
        if settings.webhook_secret:
            signature = hmac.new(
                settings.webhook_secret.get_secret_value().encode(),
                body.encode(),
                hashlib.sha256,
            ).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "X-ProspectFlow-Signature": f"sha256={signature}",
            "X-ProspectFlow-Event": envelope["event"],
        }

        for attempt in range(max_retries):
            try:
                resp = await self._http.post(
                    settings.webhook_url,
                    content=body,
                    headers=headers,
                )
                resp.raise_for_status()
                logger.info("Webhook enviado: event=%s status=%d", envelope["event"], resp.status_code)
                return
            except Exception as e:
                if attempt < max_retries - 1:
                    import asyncio
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise


# ─── Helpers para construir payloads de eventos ───────────────────────────────

def lead_payload(lead_data: dict) -> dict:
    return {
        "lead_id": str(lead_data.get("id", "")),
        "name": lead_data.get("name", ""),
        "phone": lead_data.get("phone", ""),
        "city": lead_data.get("city", ""),
        "niche": lead_data.get("niche", ""),
        "score": lead_data.get("score", 0),
        "maps_url": lead_data.get("maps_url", ""),
    }


def deal_payload(lead_data: dict, price: int, payment_confirmed_at: datetime | None) -> dict:
    return {
        **lead_payload(lead_data),
        "price": price,
        "currency": "BRL",
        "payment_confirmed_at": payment_confirmed_at.isoformat() if payment_confirmed_at else None,
    }


def site_payload(lead_data: dict, site_url: str, domain: str | None) -> dict:
    return {
        **lead_payload(lead_data),
        "site_url": site_url,
        "domain": domain,
        "delivered_at": datetime.now(timezone.utc).isoformat(),
    }
