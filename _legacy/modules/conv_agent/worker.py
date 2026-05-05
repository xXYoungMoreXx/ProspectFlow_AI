"""
Worker do ConvAgent.
Consome jobs de contato inicial e follow-ups da fila.
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
from db.models import Channel, Conversation, FunnelStage, Lead, LeadStatus, Message, MessageDirection
from modules.conv_agent.agent import ConvAgent
from modules.conv_agent.security import SecurityGuard
from modules.conv_agent.whatsapp import WhatsAppClient
from modules.integ_layer.webhooks import IntegLayer, PFEvent, lead_payload
from queue.redis_streams import ack, consume

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

engine = create_async_engine(settings.database_url)
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def process_opening(data: dict, db, redis: aioredis.Redis) -> None:
    """Envia a mensagem de abertura para um novo lead."""
    lead_id = uuid.UUID(data["lead_id"])

    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()

    if not lead or not lead.phone:
        logger.warning("Lead inválido ou sem telefone: %s", lead_id)
        return

    if lead.status == LeadStatus.BLOCKED:
        logger.info("Lead bloqueado (opt-out): %s", lead.name)
        return

    guard = SecurityGuard()
    agent = ConvAgent(guard)

    opening_msg = await agent.generate_opening(lead)

    async with WhatsAppClient(redis) as wa:
        sent = await wa.send_text(lead.phone, opening_msg, is_new_lead=True)

    if not sent:
        logger.warning("Falha ao enviar abertura para %s", lead.phone)
        return

    # Cria conversa e registra a mensagem enviada
    conv = Conversation(
        lead_id=lead.id,
        channel=Channel.WHATSAPP,
        stage=FunnelStage.OPENING,
        history=[{"role": "assistant", "content": opening_msg}],
    )
    db.add(conv)

    msg = Message(
        lead_id=lead.id,
        conversation_id=conv.id,
        channel=Channel.WHATSAPP,
        direction=MessageDirection.OUTBOUND,
        content=opening_msg,
    )
    db.add(msg)

    lead.status = LeadStatus.CONTACTED
    lead.contacted_first_at = datetime.now(timezone.utc)
    lead.last_interaction_at = datetime.now(timezone.utc)
    await db.commit()

    async with IntegLayer() as integ:
        await integ.publish(PFEvent.LEAD_CONTACTED, {
            **lead_payload(lead.__dict__),
            "channel": "whatsapp",
            "message_preview": opening_msg[:100],
        })

    logger.info("Abertura enviada: %s (%s)", lead.name, lead.phone)


async def main():
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    logger.info("ConvAgent worker iniciado")

    async with async_session() as db:
        async for msg_id, data in consume(
            redis, "conv_agent", "conv_agent_group", "worker_1"
        ):
            try:
                action = data.get("action", "send_opening")
                if action == "send_opening":
                    await process_opening(data, db, redis)
                await ack(redis, "conv_agent", "conv_agent_group", msg_id)
            except Exception as e:
                logger.error("Erro no ConvAgent worker: %s", e)


if __name__ == "__main__":
    asyncio.run(main())
