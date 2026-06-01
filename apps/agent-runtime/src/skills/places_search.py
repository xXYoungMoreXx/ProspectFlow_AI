from __future__ import annotations

import json
import os

import httpx
from crewai.tools import BaseTool
from pydantic import BaseModel, Field


class PlacesSearchInput(BaseModel):
    category: str = Field(
        ..., description="The category or type of business to search for (e.g. 'restaurante', 'clinica médica')"
    )
    city: str = Field(..., description="The city where the search should take place")


class GooglePlacesTool(BaseTool):
    name: str = "google_places_search"
    description: str = "Searches for businesses in a given city using Google Places API and returns a list of establishments with details like name, phone, rating, and if they have a website."
    args_schema: type[BaseModel] = PlacesSearchInput

    def _run(self, category: str, city: str) -> str:
        api_key = os.getenv("GOOGLE_MAPS_API_KEY")
        if not api_key:
            return "Error: GOOGLE_MAPS_API_KEY environment variable is not set."

        base_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"

        # We do synchronous HTTP request for the tool (CrewAI tools are typically sync, although async is supported via _arun)
        try:
            with httpx.Client() as client:
                query = f"{category} em {city}"
                resp = client.get(
                    base_url,
                    params={
                        "query": query,
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

                # Fetch details for top 10 results to get website info (avoiding rate limits / slowness)
                detailed_results = []
                details_url = "https://maps.googleapis.com/maps/api/place/details/json"

                for place in results[:10]:
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
                        detailed_results.append(
                            {
                                "name": detail_data.get("name", place.get("name")),
                                "address": detail_data.get("formatted_address"),
                                "phone": detail_data.get("formatted_phone_number"),
                                "rating": detail_data.get("rating"),
                                "total_ratings": detail_data.get("user_ratings_total"),
                                "has_website": bool(detail_data.get("website")),
                                "place_id": place_id,
                            }
                        )

                return json.dumps(detailed_results, ensure_ascii=False, indent=2)

        except Exception as e:
            return f"Error executing Google Places Search: {str(e)}"
