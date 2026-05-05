"""
WhatsApp — Integração com Evolution API.
Gerencia envio de mensagens com throttling, warm-up e rate limiting.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)


class WhatsAppClient:
    """
    Cliente para Evolution API com:
    - Rate limiting por número
    - Warm-up progressivo
    - Janela de sessão de 24h
    - Retry com backoff exponencial
    """

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.base_url = settings.evolution_url.rstrip("/")
        self.instance = settings.evolution_instance
        self.headers = {
            "apikey": settings.evolution_api_key.get_secret_value(),
            "Content-Type": "application/json",
        }
        self._http: httpx.AsyncClient | None = None

    async def __aenter__(self):
        self._http = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, *_):
        if self._http:
            await self._http.aclose()

    # ── Rate limiting ─────────────────────────────────────────────────────

    def _daily_count_key(self, phone: str) -> str:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return f"pf:wa:daily:{today}:{phone}"

    def _global_daily_key(self) -> str:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return f"pf:wa:daily:total:{today}"

    def _last_sent_key(self, phone: str) -> str:
        return f"pf:wa:last_sent:{phone}"

    async def _check_rate_limit(self, phone: str, is_new_lead: bool) -> bool:
        """
        Verifica se pode enviar mensagem.
        Retorna True se pode, False se deve aguardar.
        """
        # Limite global de novos leads por dia (warm-up)
        if is_new_lead:
            global_count = await self.redis.get(self._global_daily_key())
            if global_count and int(global_count) >= settings.daily_new_leads_limit:
                logger.warning("Limite diário de novos leads atingido (%d)", settings.daily_new_leads_limit)
                return False

        # Limite por número: max 1 mensagem proativa/dia
        per_number = await self.redis.get(self._daily_count_key(phone))
        if per_number and int(per_number) >= settings.wa_max_messages_per_lead_day:
            logger.debug("Rate limit por número: %s", phone)
            return False

        # Delay mínimo entre mensagens para o mesmo número
        last_sent = await self.redis.get(self._last_sent_key(phone))
        if last_sent:
            elapsed = time.time() - float(last_sent)
            if elapsed < settings.wa_min_delay_seconds:
                wait = settings.wa_min_delay_seconds - elapsed
                logger.debug("Aguardando %.1fs antes de enviar para %s", wait, phone)
                await asyncio.sleep(wait)

        return True

    async def _increment_counters(self, phone: str, is_new_lead: bool) -> None:
        pipe = self.redis.pipeline()
        day_key = self._daily_count_key(phone)
        pipe.incr(day_key)
        pipe.expire(day_key, 86400)  # expira em 24h

        if is_new_lead:
            global_key = self._global_daily_key()
            pipe.incr(global_key)
            pipe.expire(global_key, 86400)

        pipe.set(self._last_sent_key(phone), str(time.time()), ex=86400)
        await pipe.execute()

    # ── Envio de mensagens ────────────────────────────────────────────────

    async def send_text(
        self,
        phone: str,
        message: str,
        is_new_lead: bool = False,
        delay_ms: int = 1500,
    ) -> dict | None:
        """
        Envia mensagem de texto com rate limiting.
        phone: formato 5571999999999 (código país + DDD + número)
        """
        if not await self._check_rate_limit(phone, is_new_lead):
            return None

        payload = {
            "number": phone,
            "text": message,
            "delay": delay_ms,  # simula digitação (ms)
        }

        result = await self._send_with_retry(
            f"/message/sendText/{self.instance}", payload
        )

        if result:
            await self._increment_counters(phone, is_new_lead)
            logger.info("Mensagem enviada: phone=%s preview='%s'", phone, message[:50])

        return result

    async def send_link_preview(
        self,
        phone: str,
        url: str,
        caption: str,
    ) -> dict | None:
        """Envia link com preview (para apresentar site de referência)."""
        payload = {
            "number": phone,
            "link": url,
            "caption": caption,
            "delay": 2000,
        }
        return await self._send_with_retry(
            f"/message/sendLink/{self.instance}", payload
        )

    # ── Webhook: receber mensagens ────────────────────────────────────────

    @staticmethod
    def parse_incoming_webhook(payload: dict) -> dict | None:
        """
        Extrai dados relevantes do webhook do Evolution API.
        Retorna None se não for uma mensagem de cliente.
        """
        event = payload.get("event")
        if event not in ("messages.upsert", "MESSAGES_UPSERT"):
            return None

        data = payload.get("data", {})
        message = data.get("message", {})
        key = data.get("key", {})

        # Ignora mensagens enviadas por nós mesmos
        if key.get("fromMe"):
            return None

        # Ignora mensagens de grupo
        remote_jid = key.get("remoteJid", "")
        if "@g.us" in remote_jid:
            return None

        # Extrai o texto
        text = (
            message.get("conversation")
            or message.get("extendedTextMessage", {}).get("text")
            or message.get("imageMessage", {}).get("caption")
            or ""
        )

        phone = remote_jid.replace("@s.whatsapp.net", "")

        return {
            "phone": phone,
            "message": text.strip(),
            "timestamp": data.get("messageTimestamp"),
            "raw": payload,
        }

    # ── HTTP com retry ────────────────────────────────────────────────────

    async def _send_with_retry(
        self,
        endpoint: str,
        payload: dict,
        max_retries: int = 3,
    ) -> dict | None:
        url = f"{self.base_url}{endpoint}"
        for attempt in range(max_retries):
            try:
                resp = await self._http.post(url, json=payload, headers=self.headers)
                if resp.status_code == 429:
                    wait = 2 ** attempt * 5
                    logger.warning("Rate limit da API WhatsApp. Aguardando %ds", wait)
                    await asyncio.sleep(wait)
                    continue
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                logger.error("Erro HTTP ao enviar WA: %s", e)
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(2 ** attempt)
            except Exception as e:
                logger.error("Erro ao enviar WA (tentativa %d/%d): %s", attempt + 1, max_retries, e)
                if attempt == max_retries - 1:
                    return None
                await asyncio.sleep(2 ** attempt)
        return None
