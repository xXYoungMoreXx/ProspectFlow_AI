"""
ProspectFlow AI — API Principal (FastAPI)

Endpoints:
  POST /webhooks/whatsapp   — Recebe mensagens do Evolution API
  POST /jobs/prospect       — Dispara novo job de prospecção
  GET  /leads               — Lista leads com filtros
  GET  /leads/{id}          — Detalhe de um lead
  GET  /health              — Health check
  GET  /metrics             — Métricas básicas
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated, Any

import redis.asyncio as aioredis
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config import settings
from db.models import (
    Channel, Conversation, FunnelStage, Lead, LeadStatus,
    Message, MessageDirection, SecurityEvent, SecurityEventType,
)
from modules.conv_agent.agent import ConvAgent
from modules.conv_agent.security import SecurityGuard
from modules.conv_agent.whatsapp import WhatsAppClient
from modules.integ_layer.webhooks import IntegLayer, PFEvent, lead_payload

logger = logging.getLogger(__name__)

# ─── Setup ────────────────────────────────────────────────────────────────────

engine = create_async_engine(settings.database_url, echo=settings.is_development)
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


async def get_redis() -> aioredis.Redis:
    return aioredis.from_url(settings.redis_url, decode_responses=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ProspectFlow AI iniciando...")
    yield
    logger.info("ProspectFlow AI encerrando...")


app = FastAPI(
    title="ProspectFlow AI",
    version="1.0.0",
    docs_url="/docs" if settings.is_development else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.is_development else [],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ─── Schemas de request ───────────────────────────────────────────────────────

class ProspectJobRequest(BaseModel):
    category: str
    city: str
    min_score: int = 5


class LeadQueryParams(BaseModel):
    status: LeadStatus | None = None
    niche: str | None = None
    city: str | None = None
    limit: int = 50
    offset: int = 0


# ─── Webhook WhatsApp ─────────────────────────────────────────────────────────

@app.post("/webhooks/whatsapp", status_code=200)
async def whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    """
    Recebe mensagens do Evolution API e processa de forma assíncrona.
    Responde em < 200ms para evitar timeout do Evolution.
    """
    payload = await request.json()

    # Processa em background para não bloquear o webhook
    background_tasks.add_task(_process_whatsapp_message, payload, db, redis)

    return {"status": "accepted"}


async def _process_whatsapp_message(
    payload: dict,
    db: AsyncSession,
    redis: aioredis.Redis,
) -> None:
    """Processamento real da mensagem em background."""
    from modules.conv_agent.whatsapp import WhatsAppClient

    # Parseia a mensagem
    parsed = WhatsAppClient.parse_incoming_webhook(payload)
    if not parsed or not parsed.get("message"):
        return

    phone = parsed["phone"]
    message_text = parsed["message"]

    # Busca o lead pelo telefone
    from sqlalchemy import select
    result = await db.execute(
        select(Lead).where(Lead.phone.contains(phone[-8:]))  # Busca pelos últimos 8 dígitos
    )
    lead = result.scalar_one_or_none()

    if not lead:
        logger.warning("Mensagem de número não identificado: %s", phone)
        return

    # Configura o guard de segurança com callbacks persistentes
    async def on_injection(lead_id: str, pattern: str, msg: str):
        event = SecurityEvent(
            lead_id=uuid.UUID(lead_id),
            event_type=SecurityEventType.INJECTION_ATTEMPT,
            channel=Channel.WHATSAPP,
            raw_message=msg[:500],
            matched_pattern=pattern,
        )
        db.add(event)
        await db.commit()

    async def on_opt_out(lead_id: str):
        result = await db.execute(select(Lead).where(Lead.id == uuid.UUID(lead_id)))
        l = result.scalar_one_or_none()
        if l:
            l.status = LeadStatus.BLOCKED
            await db.commit()

    guard = SecurityGuard(on_injection=on_injection, on_opt_out=on_opt_out)

    # ── Camada 1: Filtro de entrada ──
    check = guard.check_input(message_text, str(lead.id))

    async with WhatsAppClient(redis) as wa:
        if check.is_opt_out:
            lead.status = LeadStatus.BLOCKED
            await db.commit()
            await wa.send_text(phone, guard.opt_out_response())
            return

        if not check.passed:
            # Registra tentativa de injection
            conv_result = await db.execute(
                select(Conversation)
                .where(Conversation.lead_id == lead.id)
                .order_by(Conversation.started_at.desc())
                .limit(1)
            )
            conv = conv_result.scalar_one_or_none()

            if conv:
                conv.injection_attempts += 1
                from config import settings as s
                if conv.injection_attempts >= s.max_injection_attempts_before_block:
                    lead.status = LeadStatus.BLOCKED
                    await db.commit()
                    await wa.send_text(phone, guard.blocked_response())
                    return

            await db.commit()
            await wa.send_text(phone, guard.injection_response())
            return

        # ── Busca/cria conversa ──
        conv_result = await db.execute(
            select(Conversation)
            .where(
                Conversation.lead_id == lead.id,
                Conversation.channel == Channel.WHATSAPP,
            )
            .order_by(Conversation.started_at.desc())
            .limit(1)
        )
        conv = conv_result.scalar_one_or_none()

        if not conv:
            conv = Conversation(
                lead_id=lead.id,
                channel=Channel.WHATSAPP,
                stage=FunnelStage.OPENING,
                history=[],
            )
            db.add(conv)

        # Persiste a mensagem do cliente
        inbound = Message(
            lead_id=lead.id,
            conversation_id=conv.id,
            channel=Channel.WHATSAPP,
            direction=MessageDirection.INBOUND,
            content=message_text,
            raw_payload=payload,
            was_injection_attempt=check.is_injection,
        )
        db.add(inbound)

        # ── Gera resposta com o agente ──
        agent = ConvAgent(guard)
        response_text, new_stage, analysis = await agent.respond(
            lead=lead,
            user_message=message_text,
            conversation_history=conv.history,
            current_stage=conv.stage,
        )

        # ── Atualiza estado da conversa ──
        conv.stage = new_stage
        conv.sentiment = analysis.get("sentiment")
        conv.objection_type = analysis.get("objection_type")
        conv.history.append({"role": "user", "content": message_text})
        conv.history.append({"role": "assistant", "content": response_text})

        # ── Atualiza lead ──
        lead.status = LeadStatus.ENGAGED
        lead.last_interaction_at = datetime.now(timezone.utc)

        if new_stage == FunnelStage.DONE:
            intent = analysis.get("intent")
            if intent == "closing":
                lead.status = LeadStatus.CLOSED_WON
            else:
                lead.status = LeadStatus.CLOSED_LOST

        # Persiste a resposta do agente
        outbound = Message(
            lead_id=lead.id,
            conversation_id=conv.id,
            channel=Channel.WHATSAPP,
            direction=MessageDirection.OUTBOUND,
            content=response_text,
        )
        db.add(outbound)
        await db.commit()

        # ── Envia a resposta ──
        await wa.send_text(phone, response_text)

        # ── Publica evento no IntegLayer ──
        if new_stage == FunnelStage.DONE and lead.status == LeadStatus.CLOSED_WON:
            async with IntegLayer() as integ:
                await integ.publish(
                    PFEvent.DEAL_CLOSED,
                    {**lead_payload(lead.__dict__), "price": lead.agreed_price},
                )

        # ── Se fechou, inicia SiteBuilder ──
        if lead.status == LeadStatus.CLOSED_WON and lead.payment_confirmed_at:
            from queue.redis_streams import enqueue
            await enqueue(redis, "site_builder", {"lead_id": str(lead.id)})


# ─── Jobs de prospecção ────────────────────────────────────────────────────────

@app.post("/jobs/prospect", status_code=202)
async def start_prospect_job(
    body: ProspectJobRequest,
    background_tasks: BackgroundTasks,
    x_api_key: Annotated[str | None, Header()] = None,
    redis: aioredis.Redis = Depends(get_redis),
):
    """Dispara job de prospecção para categoria+cidade."""
    if x_api_key != settings.secret_key.get_secret_value():
        raise HTTPException(status_code=401, detail="Unauthorized")

    from queue.redis_streams import enqueue
    await enqueue(redis, "lead_hunter", {
        "category": body.category,
        "city": body.city,
        "min_score": body.min_score,
    })

    return {"status": "queued", "category": body.category, "city": body.city}


# ─── Admin endpoints ─────────────────────────────────────────────────────────

@app.get("/leads")
async def list_leads(
    status: str | None = None,
    niche: str | None = None,
    city: str | None = None,
    limit: int = 50,
    offset: int = 0,
    x_api_key: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
):
    if x_api_key != settings.secret_key.get_secret_value():
        raise HTTPException(status_code=401, detail="Unauthorized")

    from sqlalchemy import select
    q = select(Lead)
    if status:
        q = q.where(Lead.status == LeadStatus(status))
    if niche:
        q = q.where(Lead.niche == niche)
    if city:
        q = q.where(Lead.city.ilike(f"%{city}%"))

    q = q.order_by(Lead.score.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    leads = result.scalars().all()

    return {
        "total": len(leads),
        "leads": [
            {
                "id": str(l.id),
                "name": l.name,
                "phone": l.phone,
                "city": l.city,
                "niche": l.niche,
                "score": l.score,
                "status": l.status.value,
                "rating": l.rating,
                "created_at": l.created_at.isoformat(),
            }
            for l in leads
        ],
    }


# ─── Health e métricas ────────────────────────────────────────────────────────

@app.get("/health")
async def health(redis: aioredis.Redis = Depends(get_redis)):
    try:
        await redis.ping()
        redis_ok = True
    except Exception:
        redis_ok = False

    return {
        "status": "healthy" if redis_ok else "degraded",
        "redis": "ok" if redis_ok else "error",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/metrics")
async def metrics(
    x_api_key: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
):
    if x_api_key != settings.secret_key.get_secret_value():
        raise HTTPException(status_code=401, detail="Unauthorized")

    from sqlalchemy import func, select
    counts = await db.execute(
        select(Lead.status, func.count(Lead.id))
        .group_by(Lead.status)
    )
    by_status = {row[0].value: row[1] for row in counts}

    return {
        "leads_by_status": by_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
