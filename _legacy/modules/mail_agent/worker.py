"""
Worker do MailAgent.
Consome jobs de e-mail da fila e executa a sequência de outreach.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from config import settings
from db.models import Lead, LeadStatus
from modules.mail_agent.agent import MailAgent
from modules.integ_layer.webhooks import IntegLayer, PFEvent, lead_payload
from queue.redis_streams import ack, consume, enqueue

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

engine = create_async_engine(settings.database_url)
async_session = async_sessionmaker(engine, expire_on_commit=False)

# Dias entre e-mails da sequência
SEQUENCE_DELAYS_DAYS = {1: 0, 2: 3, 3: 7}


async def process_mail_job(data: dict, db, redis: aioredis.Redis) -> None:
    lead_id = uuid.UUID(data["lead_id"])
    sequence = data.get("sequence", 1)

    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()

    if not lead or not lead.email:
        return

    if lead.status in (LeadStatus.BLOCKED, LeadStatus.CLOSED_WON, LeadStatus.CLOSED_LOST):
        logger.info("Pulando e-mail para %s (status: %s)", lead.name, lead.status)
        return

    async with MailAgent() as mail:
        sent = await mail.send_prospect_email(lead, sequence_number=sequence)

    if sent:
        lead.last_interaction_at = datetime.now(timezone.utc)
        await db.commit()

        # Agenda próximo e-mail da sequência se ainda não respondeu
        next_seq = sequence + 1
        if next_seq <= 3:
            delay_days = SEQUENCE_DELAYS_DAYS.get(next_seq, 7)
            # Em produção: usar scheduler (APScheduler ou Celery beat)
            # Aqui simplificado: enfileira com metadata de delay
            await enqueue(redis, "mail_agent", {
                "lead_id": str(lead_id),
                "sequence": next_seq,
                "send_after_days": delay_days,
            })
            logger.info(
                "Próximo e-mail agendado: %s seq=%d em %dd",
                lead.name, next_seq, delay_days
            )

        async with IntegLayer() as integ:
            await integ.publish(PFEvent.LEAD_CONTACTED, {
                **lead_payload(lead.__dict__),
                "channel": "email",
                "sequence": sequence,
            })

        logger.info("E-mail enviado: %s seq=%d", lead.name, sequence)


async def main():
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    logger.info("MailAgent worker iniciado")

    async with async_session() as db:
        async for msg_id, data in consume(
            redis, "mail_agent", "mail_agent_group", "worker_1"
        ):
            try:
                await process_mail_job(data, db, redis)
                await ack(redis, "mail_agent", "mail_agent_group", msg_id)
            except Exception as e:
                logger.error("Erro no MailAgent worker: %s", e)


if __name__ == "__main__":
    asyncio.run(main())
