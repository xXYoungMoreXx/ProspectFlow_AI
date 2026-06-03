import pytest

from src.agents.orchestrator.agent import OrchestratorAgent, PipelineState


def test_briefing_to_designing():
    orch = OrchestratorAgent("a1", "op1", {})
    state, agent = orch.transition(PipelineState.BRIEFING, "BriefingCompleted")
    assert state == PipelineState.DESIGNING
    assert agent == "BUILDER"


def test_mockup_approved_goes_to_building():
    orch = OrchestratorAgent("a1", "op1", {})
    state, agent = orch.transition(PipelineState.MOCKUP_REVIEW, "MockupApproved")
    assert state == PipelineState.BUILDING
    assert agent == "BUILDER"


def test_mockup_rejected_retries_designing():
    orch = OrchestratorAgent("a1", "op1", {})
    state, agent = orch.transition(PipelineState.MOCKUP_REVIEW, "MockupRejected")
    assert state == PipelineState.DESIGNING
    assert agent == "BUILDER"


def test_qa_failed_retries_building():
    orch = OrchestratorAgent("a1", "op1", {})
    state, agent = orch.transition(PipelineState.QA, "QAFailed")
    assert state == PipelineState.BUILDING
    assert agent == "BUILDER"


def test_retry_limit_building():
    orch = OrchestratorAgent("a1", "op1", {})
    orch._retry_counts["BUILDING"] = 3
    assert orch.can_retry("BUILDING") is False


def test_retry_limit_designing():
    orch = OrchestratorAgent("a1", "op1", {})
    orch._retry_counts["DESIGNING"] = 2
    assert orch.can_retry("DESIGNING") is False


def test_invalid_transition_raises():
    orch = OrchestratorAgent("a1", "op1", {})
    with pytest.raises(ValueError, match="No transition"):
        orch.transition(PipelineState.DONE, "AnythingHappened")


def test_record_retry_increments():
    orch = OrchestratorAgent("a1", "op1", {})
    orch.record_retry("BUILDING")
    orch.record_retry("BUILDING")
    assert orch._retry_counts["BUILDING"] == 2
    assert orch.can_retry("BUILDING") is True
