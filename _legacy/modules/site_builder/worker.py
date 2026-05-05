"""
Worker do SiteBuilder.
Consome jobs da fila, gera e publica o site do cliente.
"""
from __future__ import annotations

import asyncio
import logging
import uuid

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from config import settings
from db.models import Lead, LeadStatus, Site
from modules.integ_layer.webhooks import IntegLayer, PFEvent, site_payload
from modules.site_builder.builder import DesignExtractor, SiteBuilder
from queue.redis_streams import ack, consume

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

engine = create_async_engine(settings.database_url)
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def process_site_job(data: dict, db, redis: aioredis.Redis) -> None:
    lead_id = uuid.UUID(data["lead_id"])

    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()

    if not lead:
        logger.error("Lead não encontrado: %s", lead_id)
        return

    # Cria registro do site
    site = Site(lead_id=lead.id, status="generating")
    db.add(site)
    await db.commit()

    try:
        # ── 1. Extrai design system da referência ──
        from modules.lead_hunter.hunter import NICHE_MAP
        niche_info = NICHE_MAP.get(lead.niche or "", {})
        reference_url = (
            lead.reference_url
            or (niche_info.get("references", [""])[0])
            or ""
        )

        async with DesignExtractor() as extractor:
            design_system = await extractor.extract(reference_url) if reference_url else {}

        site.design_system = design_system
        site.reference_url = reference_url
        await db.commit()

        # ── 2. Gera o HTML ──
        async with SiteBuilder() as builder:
            html = await builder.generate(lead, design_system)
            slug = SiteBuilder.make_slug(lead.name, lead.city)

            # ── 3. Publica online ──
            site_url = await builder.publish_to_vercel(html, slug)

        site.generated_html = html
        site.deployment_url = site_url
        site.status = "published"

        from datetime import datetime, timezone
        site.generated_at = datetime.now(timezone.utc)
        site.published_at = datetime.now(timezone.utc)

        lead.status = LeadStatus.CLOSED_WON
        await db.commit()

        logger.info("Site publicado: %s -> %s", lead.name, site_url)

        # ── 4. Notifica o cliente ──
        from modules.conv_agent.whatsapp import WhatsAppClient
        async with WhatsAppClient(redis) as wa:
            msg = (
                f"🎉 Boa notícia, {lead.name}!\n\n"
                f"O site de vocês ficou pronto! Confiram aqui:\n"
                f"{site_url}\n\n"
                f"Qualquer ajuste nos primeiros {settings.warranty_days} dias "
                f"é por nossa conta. O que acharam? 😊"
            )
            await wa.send_text(lead.phone, msg)

        # ── 5. Publica evento no IntegLayer ──
        async with IntegLayer() as integ:
            await integ.publish(
                PFEvent.SITE_DELIVERED,
                site_payload(lead.__dict__, site_url, site.domain),
            )

    except Exception as e:
        logger.error("Erro ao gerar site para %s: %s", lead.name, e)
        site.status = "failed"
        site.error = str(e)
        await db.commit()
        raise


async def main():
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    logger.info("SiteBuilder worker iniciado")

    async with async_session() as db:
        async for msg_id, data in consume(
            redis, "site_builder", "site_builder_group", "worker_1"
        ):
            try:
                await process_site_job(data, db, redis)
                await ack(redis, "site_builder", "site_builder_group", msg_id)
            except Exception as e:
                logger.error("Erro no SiteBuilder: %s", e)


if __name__ == "__main__":
    asyncio.run(main())
