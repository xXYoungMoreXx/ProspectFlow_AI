"""
SPEC-08: DeliveryAgent — PDF de entrega + HeyGen tutorial em paralelo.

Fluxo:
  1. Gerar PDF via tasks.py:build_delivery_report()  (thread pool)
  2. Gerar tutorial via Node.js POST /api/v1/internal/heygen/generate
  (1 e 2 com asyncio.gather, return_exceptions=True para degradação graceful)
  3. Retornar resultado combinado para o AgentExecutionService
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

import httpx
from pydantic import BaseModel, Field, field_validator

from src.agents.delivery.tasks import DeliveryReportData, build_delivery_report, generate_temp_password

logger = logging.getLogger(__name__)


class DeliveryInput(BaseModel):
    project_id: str = Field(..., min_length=1)
    site_url: str = Field(..., min_length=1)
    admin_url: str = Field(..., min_length=1)
    business_name: str = Field(..., min_length=1, max_length=200)
    lighthouse_scores: dict[str, Any] = Field(default_factory=dict)
    owasp_status: str = Field(default="unknown")
    correlation_id: str = Field(..., min_length=1)

    @field_validator("project_id")
    @classmethod
    def project_id_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("project_id must not be blank")
        return v


class DeliveryAgent:
    """
    Orchestrates final site delivery: PDF report + HeyGen tutorial video.
    Both are generated in parallel via asyncio.gather(return_exceptions=True).
    HeyGen failure is non-fatal — PDF is delivered alone.
    """

    def __init__(self, agent_id: str, correlation_id: str, payload: dict[str, Any]) -> None:
        self.agent_id = agent_id
        self.correlation_id = correlation_id
        self.input = DeliveryInput(**payload)
        self._node_api_url = os.environ.get("NODE_API_URL", "http://localhost:3001")
        self._internal_token = os.environ.get("INTERNAL_API_TOKEN", "")

    async def deliver(self) -> dict[str, Any]:
        """
        Run PDF generation and HeyGen tutorial in parallel.
        Returns a result dict consumed by main.py dispatcher.
        """
        pdf_task = asyncio.to_thread(self._generate_pdf)
        heygen_task = self._call_heygen()

        pdf_result, video_result = await asyncio.gather(
            pdf_task,
            heygen_task,
            return_exceptions=True,
        )

        # PDF failure is fatal — nothing to deliver
        if isinstance(pdf_result, BaseException):
            logger.error("PDF generation failed: %s", pdf_result, exc_info=True)
            return {
                "status": "failed",
                "error": str(pdf_result),
                "project_id": self.input.project_id,
            }

        # HeyGen failure is non-fatal — deliver PDF only
        video_url: str | None = None
        if isinstance(video_result, BaseException):
            logger.warning("HeyGen failed (non-fatal): %s", video_result)
        else:
            video_url = video_result

        return {
            "status": "completed",
            "project_id": self.input.project_id,
            "pdf_bytes_size": len(pdf_result),  # type: ignore[arg-type]
            "video_url": video_url,
            "site_url": self.input.site_url,
        }

    def _generate_pdf(self) -> bytes:
        scores = self.input.lighthouse_scores
        data = DeliveryReportData(
            business_name=self.input.business_name,
            site_url=self.input.site_url,
            admin_url=self.input.admin_url,
            temp_password=generate_temp_password(),
            lighthouse_performance=int(scores.get("performance", 0)),
            lighthouse_a11y=int(scores.get("a11y", 0)),
            lighthouse_seo=int(scores.get("seo", 0)),
            lighthouse_bp=int(scores.get("best_practices", 0)),
            owasp_status=self.input.owasp_status,
            project_id=self.input.project_id,
        )
        return build_delivery_report(data)

    async def _call_heygen(self) -> str | None:
        """
        Call internal Node.js HeyGen endpoint. Returns videoUrl or None on failure.
        All exceptions are caught — caller uses return_exceptions=True.
        """
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self._node_api_url}/api/v1/internal/heygen/generate",
                json={
                    "projectId": self.input.project_id,
                    "siteUrl": self.input.site_url,
                    "businessName": self.input.business_name,
                },
                headers={"X-Internal-Token": self._internal_token},
            )
            response.raise_for_status()
            data = response.json()
            return data.get("videoUrl")
