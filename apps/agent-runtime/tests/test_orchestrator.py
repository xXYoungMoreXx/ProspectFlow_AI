import uuid

import pytest

from src.agents.orchestrator.agent import OrchestratorAgent, PipelineState


def _orch() -> OrchestratorAgent:
    """Create an orchestrator with a unique project_id to avoid Redis key collisions between tests."""
    return OrchestratorAgent("a1", "op1", {"project_id": str(uuid.uuid4())})


def test_briefing_to_designing():
    orch = _orch()
    state, agent = orch.transition(PipelineState.BRIEFING, "BriefingCompleted")
    assert state == PipelineState.DESIGNING
    assert agent == "BUILDER"


def test_mockup_approved_goes_to_building():
    orch = _orch()
    state, agent = orch.transition(PipelineState.MOCKUP_REVIEW, "MockupApproved")
    assert state == PipelineState.BUILDING
    assert agent == "BUILDER"


def test_mockup_rejected_retries_designing():
    orch = _orch()
    state, agent = orch.transition(PipelineState.MOCKUP_REVIEW, "MockupRejected")
    assert state == PipelineState.DESIGNING
    assert agent == "BUILDER"


def test_qa_failed_retries_building():
    orch = _orch()
    state, agent = orch.transition(PipelineState.QA, "QAFailed")
    assert state == PipelineState.BUILDING
    assert agent == "BUILDER"


def test_retry_limit_building():
    orch = _orch()
    for _ in range(3):
        orch.record_retry("BUILDING")
    assert orch.can_retry("BUILDING") is False


def test_retry_limit_designing():
    orch = _orch()
    for _ in range(2):
        orch.record_retry("DESIGNING")
    assert orch.can_retry("DESIGNING") is False


def test_invalid_transition_raises():
    orch = _orch()
    with pytest.raises(ValueError, match="No transition"):
        orch.transition(PipelineState.DONE, "AnythingHappened")


def test_record_retry_increments():
    orch = _orch()
    orch.record_retry("BUILDING")
    orch.record_retry("BUILDING")
    assert orch._get_count("BUILDING") == 2
    assert orch.can_retry("BUILDING") is True
