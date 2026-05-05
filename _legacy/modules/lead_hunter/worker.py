"""
Worker do LeadHunter.
Consome jobs da fila, executa a busca e publica os leads qualificados.
"""
from __future__ import annotations

import asyncio
import logging
import uuid

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config import settings
from db.models import Lead, LeadStatus, ProspectJob
from modules.lead_hunter.hunter import LeadHunter
from modules.integ_layer.webhooks import IntegLayer, PFEvent, lead_payload
from queue.redis_streams import ack, consume, enqueue

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

engine = create_async_engine(settings.database_url)
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def process_job(data: dict, db: AsyncSession, redis: aioredis.Redis) -> None:
    category = data["category"]
    city = data["city"]
    min_score = data.get("min_score", 5)

    job = ProspectJob(
        category=category,
        city=city,
        status="running",
    )
    db.add(job)
    await db.commit()

    try:
        async with LeadHunter(redis) as hunter:
            raw_leads = await hunter.hunt(category, city, min_score)

        job.leads_found = len(raw_leads)
        new_count = 0

        for raw in raw_leads:
            # Verifica se o lead já existe pelo place_id
            from sqlalchemy import select
            existing = await db.execute(
                select(Lead).where(Lead.place_id == raw.place_id)
            )
            if existing.scalar_one_or_none():
                continue

            lead = Lead(
                place_id=raw.place_id,
                name=raw.name,
                phone=raw.phone,
                address=raw.address,
                city=raw.city,
                category=raw.category,
                niche=raw.niche,
                rating=raw.rating,
                total_ratings=raw.total_ratings,
                has_photo=raw.has_photo,
                maps_url=raw.maps_url,
                score=raw.score,
                status=LeadStatus.NEW,
            )
            db.add(lead)
            await db.flush()

            # Publica no CRM
            async with IntegLayer() as integ:
                await integ.publish(PFEvent.LEAD_CREATED, lead_payload(lead.__dict__))

            # Enfileira para contato
            await enqueue(redis, "conv_agent", {
                "lead_id": str(lead.id),
                "action": "send_opening",
            })

            # Enfileira e-mail também
            if lead.email:
                await enqueue(redis, "mail_agent", {
                    "lead_id": str(lead.id),
                    "sequence": 1,
                })

            new_count += 1

        job.leads_qualified = new_count
        job.status = "done"
        await db.commit()

        logger.info(
            "Job concluído: %s em %s — %d novos leads",
            category, city, new_count
        )

    except Exception as e:
        logger.error("Job falhou: %s", e)
        job.status = "failed"
        await db.commit()
        raise


async def main():
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    logger.info("LeadHunter worker iniciado")

    async with async_session() as db:
        async for msg_id, data in consume(redis, "lead_hunter", "lead_hunter_group", "worker_1"):
            try:
                await process_job(data, db, redis)
                await ack(redis, "lead_hunter", "lead_hunter_group", msg_id)
            except Exception as e:
                logger.error("Erro ao processar job: %s", e)


if __name__ == "__main__":
    asyncio.run(main())
