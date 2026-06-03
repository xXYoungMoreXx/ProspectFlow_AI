from __future__ import annotations

from enum import StrEnum
from typing import Any


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
    """Orquestrador determinístico sem LLM (custo $0). PRD v2 §8 Agente 0."""

    def __init__(self, agent_id: str, operator_id: str, payload: dict[str, Any]):
        self.agent_id = agent_id
        self.operator_id = operator_id
        self.payload = payload
        self._retry_counts: dict[str, int] = {}

    def transition(self, current_state: PipelineState, event: str) -> tuple[PipelineState, str | None]:
        for from_s, evt, to_s, agent in _TRANSITIONS:
            if from_s == current_state and evt == event:
                return to_s, agent
        raise ValueError(f"No transition from '{current_state}' on event '{event}'")

    def can_retry(self, state_name: str) -> bool:
        return self._retry_counts.get(state_name, 0) < _RETRY_LIMITS.get(state_name, 999)

    def record_retry(self, state_name: str) -> None:
        self._retry_counts[state_name] = self._retry_counts.get(state_name, 0) + 1
