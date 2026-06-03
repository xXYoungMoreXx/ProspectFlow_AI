"""Tests for delivery/agent.py — DeliveryAgent."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from src.agents.delivery.agent import DeliveryAgent, DeliveryInput


@pytest.fixture
def valid_payload() -> dict:
    return {
        "project_id": "proj-1",
        "site_url": "https://example.com",
        "admin_url": "https://example.com/admin",
        "business_name": "Loja Teste",
        "lighthouse_scores": {
            "performance": 92,
            "a11y": 88,
            "seo": 95,
            "best_practices": 90,
        },
        "owasp_status": "passed",
        "correlation_id": "corr-1",
    }


def test_delivery_input_validates_required_fields():
    with pytest.raises(ValueError):
        DeliveryInput(
            project_id="",
            site_url="https://example.com",
            admin_url="https://example.com/admin",
            business_name="Loja",
            lighthouse_scores={},
            owasp_status="passed",
            correlation_id="c1",
        )


def test_delivery_input_valid(valid_payload):
    inp = DeliveryInput(**valid_payload)
    assert inp.project_id == "proj-1"
    assert inp.business_name == "Loja Teste"


@pytest.mark.asyncio
async def test_deliver_returns_pdf_and_video_url(valid_payload):
    """Happy path: PDF gerado + HeyGen retorna URL."""
    agent = DeliveryAgent("agent-1", "corr-1", valid_payload)

    with (
        patch(
            "src.agents.delivery.agent.build_delivery_report",
            return_value=b"%PDF-fake",
        ),
        patch.object(
            DeliveryAgent,
            "_call_heygen",
            new=AsyncMock(return_value="https://cdn.heygen.com/video/abc.mp4"),
        ),
    ):
        result = await agent.deliver()

    assert result["status"] == "completed"
    assert result["pdf_bytes_size"] > 0
    assert result["video_url"] == "https://cdn.heygen.com/video/abc.mp4"


@pytest.mark.asyncio
async def test_deliver_returns_pdf_only_when_heygen_fails(valid_payload):
    """Graceful degradation: HeyGen falha → entrega só PDF sem erro fatal."""
    agent = DeliveryAgent("agent-1", "corr-1", valid_payload)

    with (
        patch(
            "src.agents.delivery.agent.build_delivery_report",
            return_value=b"%PDF-fake",
        ),
        patch.object(
            DeliveryAgent,
            "_call_heygen",
            new=AsyncMock(side_effect=Exception("HeyGen timeout")),
        ),
    ):
        result = await agent.deliver()

    assert result["status"] == "completed"
    assert result["pdf_bytes_size"] > 0
    assert result["video_url"] is None


@pytest.mark.asyncio
async def test_deliver_fails_when_pdf_generation_fails(valid_payload):
    """PDF falha → status='failed'."""
    agent = DeliveryAgent("agent-1", "corr-1", valid_payload)

    with (
        patch(
            "src.agents.delivery.agent.build_delivery_report",
            side_effect=Exception("reportlab not installed"),
        ),
        patch.object(
            DeliveryAgent,
            "_call_heygen",
            new=AsyncMock(return_value=None),
        ),
    ):
        result = await agent.deliver()

    assert result["status"] == "failed"
    assert "error" in result
