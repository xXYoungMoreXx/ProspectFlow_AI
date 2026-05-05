"""
LeadHunter — Coleta e qualificação de leads via Google Places API.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from dataclasses import dataclass, field
from typing import Any

import httpx
import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)

# ─── Nichos e referências ─────────────────────────────────────────────────────

NICHE_MAP: dict[str, dict] = {
    "eletronicos": {
        "keywords": ["loja de eletrônicos", "celulares", "informática", "games"],
        "references": ["apple.com", "samsung.com/br"],
        "price": 1500,
        "score_bonus": 1,
    },
    "clinica": {
        "keywords": ["clínica médica", "dentista", "odontologia", "estética"],
        "references": ["einstein.br", "hcor.com.br"],
        "price": 2000,
        "score_bonus": 2,
    },
    "salao": {
        "keywords": ["salão de beleza", "barbearia", "spa", "cabeleireiro"],
        "references": ["studiof.com.br"],
        "price": 1200,
        "score_bonus": 1,
    },
    "academia": {
        "keywords": ["academia", "pilates", "crossfit", "personal trainer"],
        "references": ["smartfit.com.br", "bluefit.com.br"],
        "price": 1400,
        "score_bonus": 1,
    },
    "restaurante": {
        "keywords": ["restaurante", "lanchonete", "pizzaria", "cafeteria", "bar"],
        "references": ["outback.com.br", "giraffas.com.br"],
        "price": 1000,
        "score_bonus": 0,
    },
    "pet": {
        "keywords": ["pet shop", "clínica veterinária", "veterinário"],
        "references": ["petlove.com.br"],
        "price": 1200,
        "score_bonus": 1,
    },
    "advocacia": {
        "keywords": ["advogado", "escritório de advocacia", "contabilidade"],
        "references": ["tozzinifreire.com.br"],
        "price": 1800,
        "score_bonus": 2,
    },
}


@dataclass
class RawLead:
    place_id: str
    name: str
    phone: str | None
    address: str | None
    city: str
    category: str
    niche: str | None
    rating: float | None
    total_ratings: int | None
    has_photo: bool
    maps_url: str | None
    score: int = 0
    reference_urls: list[str] = field(default_factory=list)
    suggested_price: int = 1200

    def to_dict(self) -> dict:
        return {
            "place_id": self.place_id,
            "name": self.name,
            "phone": self.phone,
            "address": self.address,
            "city": self.city,
            "category": self.category,
            "niche": self.niche,
            "rating": self.rating,
            "total_ratings": self.total_ratings,
            "has_photo": self.has_photo,
            "maps_url": self.maps_url,
            "score": self.score,
            "reference_urls": self.reference_urls,
            "suggested_price": self.suggested_price,
        }


class LeadHunter:
    """
    Busca estabelecimentos sem site no Google Maps,
    enriquece os dados e atribui score de qualificação.
    """

    BASE_URL = "https://maps.googleapis.com/maps/api"

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.api_key = settings.google_maps_api_key.get_secret_value()
        self._http: httpx.AsyncClient | None = None

    async def __aenter__(self):
        self._http = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, *_):
        if self._http:
            await self._http.aclose()

    # ── Cache ──────────────────────────────────────────────────────────────

    def _cache_key(self, place_id: str) -> str:
        return f"pf:maps:place:{place_id}"

    def _search_cache_key(self, query: str, city: str) -> str:
        h = hashlib.md5(f"{query}:{city}".encode()).hexdigest()
        return f"pf:maps:search:{h}"

    async def _get_cached(self, key: str) -> dict | None:
        raw = await self.redis.get(key)
        return json.loads(raw) if raw else None

    async def _set_cached(self, key: str, data: dict, ttl: int | None = None) -> None:
        ttl = ttl or settings.maps_cache_ttl_seconds
        await self.redis.setex(key, ttl, json.dumps(data))

    # ── Google Places API ─────────────────────────────────────────────────

    async def _places_search(self, query: str, city: str) -> list[dict]:
        """Busca lugares por texto. Usa cache para economizar cota."""
        cache_key = self._search_cache_key(query, city)
        if cached := await self._get_cached(cache_key):
            logger.debug("Cache hit: %s %s", query, city)
            return cached

        results = []
        next_page_token = None

        for page in range(3):  # máx 3 páginas = 60 resultados
            params: dict[str, Any] = {
                "query": f"{query} em {city}",
                "key": self.api_key,
                "language": "pt-BR",
                "region": "br",
            }
            if next_page_token:
                params["pagetoken"] = next_page_token
                await asyncio.sleep(2)  # obrigatório antes de usar next_page_token

            resp = await self._http.get(
                f"{self.BASE_URL}/place/textsearch/json", params=params
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get("status") not in ("OK", "ZERO_RESULTS"):
                logger.error("Places API error: %s", data.get("status"))
                break

            results.extend(data.get("results", []))
            next_page_token = data.get("next_page_token")

            if not next_page_token:
                break

        await self._set_cached(cache_key, results)
        return results

    async def _place_details(self, place_id: str) -> dict:
        """Busca detalhes de um lugar. Cache de 30 dias."""
        cache_key = self._cache_key(place_id)
        if cached := await self._get_cached(cache_key):
            return cached

        resp = await self._http.get(
            f"{self.BASE_URL}/place/details/json",
            params={
                "place_id": place_id,
                "fields": "name,formatted_phone_number,website,rating,"
                          "user_ratings_total,photos,url,formatted_address",
                "key": self.api_key,
                "language": "pt-BR",
            },
        )
        resp.raise_for_status()
        data = resp.json().get("result", {})
        await self._set_cached(cache_key, data)
        return data

    # ── Qualificação ───────────────────────────────────────────────────────

    def _detect_niche(self, category: str, name: str) -> str | None:
        combined = f"{category} {name}".lower()
        for niche, info in NICHE_MAP.items():
            if any(kw in combined for kw in info["keywords"]):
                return niche
        return None

    def _score_lead(self, detail: dict, niche: str | None) -> int:
        score = 0

        # +3 por não ter site (critério obrigatório — já filtrado antes)
        score += 3

        rating = detail.get("rating", 0) or 0
        if rating >= 4.0:
            score += 2

        total = detail.get("user_ratings_total", 0) or 0
        if total >= 20:
            score += 2

        if detail.get("formatted_phone_number"):
            score += 1

        if detail.get("photos"):
            score += 1

        if niche and NICHE_MAP.get(niche, {}).get("score_bonus", 0):
            score += NICHE_MAP[niche]["score_bonus"]

        return score

    # ── Ponto de entrada ──────────────────────────────────────────────────

    async def hunt(
        self,
        category: str,
        city: str,
        min_score: int = 5,
    ) -> list[RawLead]:
        """
        Busca leads sem site para uma categoria+cidade.
        Retorna apenas os que passam no score mínimo.
        """
        logger.info("Hunting leads: %s em %s", category, city)
        raw_results = await self._places_search(category, city)

        qualified: list[RawLead] = []
        semaphore = asyncio.Semaphore(5)  # máx 5 req simultâneas à API

        async def process(place: dict) -> None:
            async with semaphore:
                place_id = place.get("place_id")
                if not place_id:
                    return

                detail = await self._place_details(place_id)

                # Filtra quem já tem site
                if detail.get("website"):
                    return

                niche = self._detect_niche(category, detail.get("name", ""))
                score = self._score_lead(detail, niche)

                if score < min_score:
                    return

                address = detail.get("formatted_address", "")
                # Extrai estado do endereço (ex: "Salvador, BA")
                state = None
                if ", " in address:
                    parts = address.split(", ")
                    for part in parts:
                        if len(part) == 2 and part.isupper():
                            state = part
                            break

                lead = RawLead(
                    place_id=place_id,
                    name=detail.get("name", ""),
                    phone=detail.get("formatted_phone_number"),
                    address=address,
                    city=city,
                    category=category,
                    niche=niche,
                    rating=detail.get("rating"),
                    total_ratings=detail.get("user_ratings_total"),
                    has_photo=bool(detail.get("photos")),
                    maps_url=detail.get("url"),
                    score=score,
                    reference_urls=NICHE_MAP.get(niche, {}).get("references", []),
                    suggested_price=NICHE_MAP.get(niche, {}).get(
                        "price", settings.default_site_price
                    ),
                )
                qualified.append(lead)
                logger.info(
                    "Lead qualificado: %s (score=%d, niche=%s)",
                    lead.name, score, niche
                )

        await asyncio.gather(*[process(p) for p in raw_results])

        # Ordena por score desc
        qualified.sort(key=lambda l: l.score, reverse=True)
        logger.info(
            "Hunt concluído: %d encontrados, %d qualificados",
            len(raw_results), len(qualified)
        )
        return qualified
