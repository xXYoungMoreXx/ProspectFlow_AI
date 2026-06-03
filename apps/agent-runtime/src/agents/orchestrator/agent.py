"""Orchestrator agent — deterministic pipeline state machine (zero LLM cost)."""

from __future__ import annotations

import logging
import os
from enum import StrEnum
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import redis as _redis_types

try:
    import redis

    _REDIS_AVAILABLE = True
except ImportError:  # pragma: no cover
    redis = None  # type: ignore[assignment]
    _REDIS_AVAILABLE = False

_REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")

logger = logging.getLogger(__name__)

_PREFIX = "agentepro:orchestrator:"
_TTL = 86400  # 24 h — matches AgentSessionManager TTL in state.py


class PipelineState(StrEnum):
    """Estados do pipeline — PRD AgentePro v2 §8 Agente 0."""

    IDLE = "IDLE"
    PROSPECTING = "PROSPECTING"
    OUTREACH = "OUTREACH"
    NEGOTIATING = "NEGOTIATING"
    BRIEFING = "BRIEFING"
    DESIGNING = "DESIGNING"
    MOCKUP_REVIEW = "MOCKUP_REVIEW"
    BUILDING = "BUILDING"
    QA = "QA"
    DELIVERING = "DELIVERING"
    DONE = "DONE"


_TRANSITIONS: list[tuple[PipelineState, str, PipelineState, str | None]] = [
    (PipelineState.IDLE, "ScheduleTrigger", PipelineState.PROSPECTING, "HUNTER"),
    (PipelineState.PROSPECTING, "LeadsQualified", PipelineState.OUTREACH, "CLOSER"),
    (PipelineState.OUTREACH, "LeadResponded", PipelineState.NEGOTIATING, "CLOSER"),
    (PipelineState.NEGOTIATING, "SaleClosed", PipelineState.BRIEFING, "BRIEFING"),
    (PipelineState.NEGOTIATING, "FollowUpDue", PipelineState.NEGOTIATING, "CLOSER"),
    (PipelineState.BRIEFING, "BriefingCompleted", PipelineState.DESIGNING, "BUILDER"),
    (PipelineState.DESIGNING, "MockupGenerated", PipelineState.MOCKUP_REVIEW, None),
    (PipelineState.MOCKUP_REVIEW, "MockupApproved", PipelineState.BUILDING, "BUILDER"),
    (PipelineState.MOCKUP_REVIEW, "MockupRejected", PipelineState.DESIGNING, "BUILDER"),
    (PipelineState.BUILDING, "SiteBuilt", PipelineState.QA, "QA"),
    (PipelineState.QA, "QAApproved", PipelineState.DELIVERING, "DELIVERY"),
    (PipelineState.QA, "QAFailed", PipelineState.BUILDING, "BUILDER"),
    (PipelineState.DELIVERING, "SiteDelivered", PipelineState.DONE, None),
]

_RETRY_LIMITS: dict[str, int] = {"BUILDING": 3, "DESIGNING": 2, "QA": 3}


class OrchestratorAgent:
    """
    Orquestrador determinístico sem LLM (custo $0). PRD v2 §8 Agente 0.

    Retry counts persistidos em Redis (TTL 24 h) para sobreviver restarts.
    Fallback automático para in-memory quando Redis está indisponível.
    """

    # Shared connection reused across instances (lazy init, same pattern as AgentSessionManager)
    _client: _redis_types.Redis | None = None

    def __init__(self, agent_id: str, operator_id: str, payload: dict[str, Any]):
        """Initialise orchestrator for a given agent/project."""
        self.agent_id = agent_id
        self.operator_id = operator_id
        self.payload = payload
        # In-memory fallback (used when Redis unavailable or not installed)
        self._local: dict[str, int] = {}
        project_id = payload.get("project_id", agent_id)
        self._key = f"{_PREFIX}{project_id}"

    # ── Redis connection ──────────────────────────────────────────────────────

    @classmethod
    def _get_client(cls) -> Any | None:
        """Return shared Redis client, connecting lazily. None if unavailable."""
        if not _REDIS_AVAILABLE:
            return None
        if cls._client is None:
            try:
                cls._client = redis.from_url(  # type: ignore[union-attr]
                    _REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                    retry_on_timeout=True,
                )
                cls._client.ping()
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Orchestrator Redis unavailable, using in-memory fallback: %s",
                    exc,
                )
                cls._client = None
        return cls._client

    # ── Retry persistence ─────────────────────────────────────────────────────

    def _get_count(self, state_name: str) -> int:
        """Return current retry count for a pipeline state."""
        client = self._get_client()
        if client is not None:
            try:
                raw = client.hget(self._key, state_name)
                return int(raw) if raw else 0
            except Exception as exc:  # noqa: BLE001
                logger.debug("Orchestrator Redis read failed, using local: %s", exc)
        return self._local.get(state_name, 0)

    def _increment(self, state_name: str) -> None:
        """Increment retry count, persisting to Redis when available."""
        client = self._get_client()
        if client is not None:
            try:
                client.hincrby(self._key, state_name, 1)
                client.expire(self._key, _TTL)
                return
            except Exception as exc:  # noqa: BLE001
                logger.debug("Orchestrator Redis write failed, using local: %s", exc)
        self._local[state_name] = self._local.get(state_name, 0) + 1

    # ── Public API ────────────────────────────────────────────────────────────

    def transition(
        self,
        current_state: PipelineState,
        event: str,
    ) -> tuple[PipelineState, str | None]:
        """Return (next_state, responsible_agent) for the given event."""
        for from_s, evt, to_s, agent in _TRANSITIONS:
            if from_s == current_state and evt == event:
                return to_s, agent
        raise ValueError(f"No transition from '{current_state}' on event '{event}'")

    def can_retry(self, state_name: str) -> bool:
        """True if retry count is still below the defined limit."""
        return self._get_count(state_name) < _RETRY_LIMITS.get(state_name, 999)

    def record_retry(self, state_name: str) -> None:
        """Record one retry attempt for the given pipeline state."""
        self._increment(state_name)
