from __future__ import annotations

import json

import httpx
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from src.config import config


class WebSearchInput(BaseModel):
    query: str = Field(..., description="A query de busca ou nome do estabelecimento/nicho e cidade.")
    city: str = Field(None, description="Cidade onde buscar (opcional se já estiver na query).")


class WebSearchTool(BaseTool):
    name: str = "web_search"
    description: str = (
        "Busca estabelecimentos e leads qualificados na web (Google Places). Excelente para prospecção B2B."
    )
    args_schema: type[BaseModel] = WebSearchInput

    def _run(self, query: str, city: str = None) -> str:
        # 1. SSRF Protection: Block local IPs and hostnames
        ssrf_blacklist = [
            "localhost",
            "127.0.0.1",
            "10.",
            "192.168.",
            "172.16.",
            "169.254.",
            "0.0.0.0",  # noqa: S104
            "metadata.google.internal",
        ]
        full_query = f"{query} em {city}" if city else query

        if any(bad in full_query.lower() for bad in ssrf_blacklist):
            return "Search failed: Blocked due to security policy (SSRF attempt detected)."

        # 2. SearXNG: use if configured (avoids Google rate limits)
        if config.searxng_url:
            return self._run_searxng(full_query)

        api_key = __import__("os").getenv("GOOGLE_MAPS_API_KEY")
        if not api_key:
            # Fallback mock if no API key
            return f"Mock search results for: {full_query}\n1. https://example.com - Example Domain\n2. https://test.com - Test Domain"

        base_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(
                    base_url,
                    params={
                        "query": full_query,
                        "key": api_key,
                        "language": "pt-BR",
                        "region": "br",
                    },
                )
                resp.raise_for_status()
                data = resp.json()

                if data.get("status") not in ("OK", "ZERO_RESULTS"):
                    return f"Places API error: {data.get('status')}"

                results = data.get("results", [])

                # Fetch details for top 5 results to enrich lead info
                detailed_results = []
                details_url = "https://maps.googleapis.com/maps/api/place/details/json"

                for place in results[:5]:
                    place_id = place.get("place_id")
                    if not place_id:
                        continue

                    detail_resp = client.get(
                        details_url,
                        params={
                            "place_id": place_id,
                            "fields": "name,formatted_phone_number,website,rating,user_ratings_total,formatted_address",
                            "key": api_key,
                            "language": "pt-BR",
                        },
                    )
                    if detail_resp.status_code == 200:
                        detail_data = detail_resp.json().get("result", {})
                        # Qualifica levemente (score básico)
                        score = 3 if not detail_data.get("website") else 0
                        if detail_data.get("rating", 0) >= 4.0:
                            score += 2
                        if detail_data.get("user_ratings_total", 0) >= 20:
                            score += 2
                        if detail_data.get("formatted_phone_number"):
                            score += 1

                        detailed_results.append(
                            {
                                "name": detail_data.get("name", place.get("name")),
                                "address": detail_data.get("formatted_address"),
                                "phone": detail_data.get("formatted_phone_number"),
                                "rating": detail_data.get("rating"),
                                "total_ratings": detail_data.get("user_ratings_total"),
                                "has_website": bool(detail_data.get("website")),
                                "score": score,
                                "place_id": place_id,
                            }
                        )

                # Ordena por score descendente
                detailed_results.sort(key=lambda x: x["score"], reverse=True)
                return json.dumps(detailed_results, ensure_ascii=False, indent=2)

        except Exception as e:
            return f"Error executing Web Search: {str(e)}"

    def _run_searxng(self, query: str) -> str:
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(
                    f"{config.searxng_url}/search",
                    params={"q": query, "format": "json", "language": "pt-BR"},
                )
                resp.raise_for_status()
                data = resp.json()
                results = [
                    {"title": r.get("title"), "url": r.get("url"), "snippet": r.get("content")}
                    for r in data.get("results", [])[:10]
                ]
                return json.dumps(results, ensure_ascii=False, indent=2)
        except Exception as e:
            return f"SearXNG search error: {str(e)}"
