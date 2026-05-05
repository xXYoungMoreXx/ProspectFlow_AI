"""
Fila de mensagens via Redis Streams.
Comunicação assíncrona entre os módulos do ProspectFlow.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncIterator

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

STREAMS = {
    "lead_hunter":  "pf:stream:lead_hunter",
    "conv_agent":   "pf:stream:conv_agent",
    "mail_agent":   "pf:stream:mail_agent",
    "site_builder": "pf:stream:site_builder",
    "integ_layer":  "pf:stream:integ_layer",
}


async def enqueue(redis: aioredis.Redis, stream: str, data: dict) -> str:
    """
    Publica uma mensagem em um stream.
    Retorna o ID da mensagem no stream.
    """
    stream_key = STREAMS.get(stream, f"pf:stream:{stream}")
    message_id = await redis.xadd(
        stream_key,
        {
            "payload": json.dumps(data, ensure_ascii=False, default=str),
            "enqueued_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    logger.debug("Enqueued %s -> %s: %s", stream, message_id, data)
    return message_id


async def consume(
    redis: aioredis.Redis,
    stream: str,
    consumer_group: str,
    consumer_name: str,
    batch_size: int = 10,
    block_ms: int = 5000,
) -> AsyncIterator[tuple[str, dict]]:
    """
    Consome mensagens de um stream como parte de um consumer group.
    Garante entrega at-least-once com ACK explícito.

    Uso:
        async for msg_id, data in consume(redis, "lead_hunter", "workers", "w1"):
            await process(data)
            await ack(redis, "lead_hunter", consumer_group, msg_id)
    """
    stream_key = STREAMS.get(stream, f"pf:stream:{stream}")

    # Cria consumer group se não existir
    try:
        await redis.xgroup_create(stream_key, consumer_group, id="0", mkstream=True)
    except Exception:
        pass  # Grupo já existe

    while True:
        try:
            messages = await redis.xreadgroup(
                groupname=consumer_group,
                consumername=consumer_name,
                streams={stream_key: ">"},
                count=batch_size,
                block=block_ms,
            )

            if not messages:
                continue

            for _, entries in messages:
                for msg_id, fields in entries:
                    try:
                        payload = json.loads(fields.get("payload", "{}"))
                        yield msg_id, payload
                    except json.JSONDecodeError as e:
                        logger.error("Erro ao deserializar mensagem %s: %s", msg_id, e)
                        await ack(redis, stream, consumer_group, msg_id)

        except Exception as e:
            logger.error("Erro no consumer %s/%s: %s", stream, consumer_name, e)
            import asyncio
            await asyncio.sleep(1)


async def ack(
    redis: aioredis.Redis,
    stream: str,
    consumer_group: str,
    msg_id: str,
) -> None:
    """Confirma processamento de uma mensagem."""
    stream_key = STREAMS.get(stream, f"pf:stream:{stream}")
    await redis.xack(stream_key, consumer_group, msg_id)
    logger.debug("ACK %s/%s: %s", stream, consumer_group, msg_id)
