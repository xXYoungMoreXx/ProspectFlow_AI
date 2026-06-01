"""
SPEC-07: Lighthouse integration via Google PageSpeed Insights API v5.

THRESHOLDS INVIOLÁVEIS:
  a11y = 100        (zero-tolerance)
  perf >= 85
  best-practices >= 90
  SEO >= 90
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

THRESHOLDS = {
    "performance": 85,
    "accessibility": 100,
    "best-practices": 90,
    "seo": 90,
}


@dataclass
class LighthouseResult:
    url: str
    performance: int
    accessibility: int
    best_practices: int
    seo: int
    passed: bool
    failures: list[str]
    raw: dict


async def run_lighthouse(url: str, api_key: str | None = None) -> LighthouseResult:
    """
    Calls Google PageSpeed Insights API v5 for mobile strategy.
    Returns parsed scores and threshold evaluation.
    """
    params = {
        "url": url,
        "strategy": "mobile",
        "category": ["performance", "accessibility", "best-practices", "seo"],
    }
    if api_key:
        params["key"] = api_key

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(
                "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        raise RuntimeError(f"PageSpeed Insights API error: {e}") from e

    cats = data.get("lighthouseResult", {}).get("categories", {})

    def score(cat: str) -> int:
        raw = cats.get(cat, {}).get("score")
        if raw is None:
            return 0
        return round(raw * 100)

    perf = score("performance")
    a11y = score("accessibility")
    bp = score("best-practices")
    seo = score("seo")

    failures = []
    # SPEC-07: a11y HARD block — zero tolerance
    if a11y < THRESHOLDS["accessibility"]:
        failures.append(f"HARD BLOCK: accessibility={a11y} (required=100)")
    if perf < THRESHOLDS["performance"]:
        failures.append(f"performance={perf} < {THRESHOLDS['performance']}")
    if bp < THRESHOLDS["best-practices"]:
        failures.append(f"best-practices={bp} < {THRESHOLDS['best-practices']}")
    if seo < THRESHOLDS["seo"]:
        failures.append(f"seo={seo} < {THRESHOLDS['seo']}")

    return LighthouseResult(
        url=url,
        performance=perf,
        accessibility=a11y,
        best_practices=bp,
        seo=seo,
        passed=len(failures) == 0,
        failures=failures,
        raw=cats,
    )
