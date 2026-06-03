"""
AgentePro Agent Runtime — FastAPI bridge.
Receives task requests from the Node.js API (via BullMQ HTTP bridge)
and dispatches them to the appropriate CrewAI agent.
"""

from __future__ import annotations

import logging
import time

import uvicorn
from fastapi import FastAPI, HTTPException, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import BaseModel

from src.agents.callbacks import RequiresApprovalException
from src.agents.state import AgentSessionManager
from src.config import config

# Prometheus Metrics
agent_sessions_total = Counter(
    "agentepro_agent_sessions_total", "Total number of agent sessions executed", ["persona", "status"]
)
agent_session_duration_seconds = Histogram(
    "agentepro_agent_session_duration_seconds", "Duration of agent sessions in seconds", ["persona"]
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


def _s(value: str) -> str:
    """Sanitize a user-supplied string for safe log output (prevent log injection)."""
    return str(value).replace("\n", "\\n").replace("\r", "\\r")


app = FastAPI(
    title="AgentePro Runtime",
    description="CrewAI agent orchestration bridge",
    version="0.1.0",
)


class TaskRequest(BaseModel):
    """Incoming task from the Node.js API."""

    task_type: str  # hunter.search | closer.negotiate | builder.generate | qa.review
    agent_id: str
    payload: dict
    correlation_id: str


class TaskResponse(BaseModel):
    """Task execution result."""

    status: str  # completed | failed | pending_hitl
    result: dict | None = None
    error: str | None = None
    correlation_id: str


class TaskApprovalRequest(BaseModel):
    """Request from Node.js API to approve a paused HITL task."""

    session_id: str
    approval_id: str
    operator_id: str


@app.get("/health")
async def health():
    return {"status": "ok", "service": "agent-runtime", "version": "0.1.0"}


@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/tasks", response_model=TaskResponse)
async def execute_task(request: TaskRequest):
    """
    Dispatch a task to the appropriate CrewAI agent.
    This is the single entry point for all agent operations.
    """
    logger.info(
        "Task received: type=%s agent=%s correlation=%s",
        _s(request.task_type),
        _s(request.agent_id),
        _s(request.correlation_id),
    )

    # Route to the appropriate agent
    domain, action = request.task_type.split(".", maxsplit=1)
    persona = domain
    start_time = time.time()

    try:
        if domain == "hunter":
            from crewai import Crew

            from src.agents.hunter.agent import HunterAgent
            from src.agents.hunter.tasks import create_search_and_qualify_task

            hunter = HunterAgent(request.agent_id, request.correlation_id, request.payload)
            agent_instance = hunter.build()

            category = request.payload.get("category", "empresas")
            city = request.payload.get("city", "São Paulo")

            search_task = create_search_and_qualify_task(agent_instance, category, city)

            crew = Crew(agents=[agent_instance], tasks=[search_task], verbose=True)

            output = crew.kickoff()

            # CrewAI returns an Output object in newer versions, or string in older.
            # We coerce it to string to be safe.
            raw_result = str(output)

            # Since expected output is a JSON array, we can return it inside the result
            agent_session_duration_seconds.labels(persona=persona).observe(time.time() - start_time)
            agent_sessions_total.labels(persona=persona, status="completed").inc()
            return TaskResponse(
                status="completed",
                result={"raw_output": raw_result},
                correlation_id=request.correlation_id,
            )
        elif domain == "closer":
            from crewai import Crew

            from src.agents.closer.agent import CloserAgent
            from src.agents.closer.tasks import create_negotiate_task

            closer = CloserAgent(request.agent_id, request.correlation_id, request.payload)
            agent_instance = closer.build()

            current_stage = request.payload.get("current_stage", "opening")
            lead_data = request.payload.get("lead_data", {})
            conversation_history = request.payload.get("conversation_history", [])
            user_message = request.payload.get("user_message", "")

            negotiate_task = create_negotiate_task(
                agent_instance, current_stage, lead_data, conversation_history, user_message
            )

            crew = Crew(agents=[agent_instance], tasks=[negotiate_task], verbose=True)

            output = crew.kickoff()
            raw_result = str(output)

            agent_session_duration_seconds.labels(persona=persona).observe(time.time() - start_time)
            agent_sessions_total.labels(persona=persona, status="completed").inc()
            return TaskResponse(
                status="completed",
                result={"raw_output": raw_result},
                correlation_id=request.correlation_id,
            )
        elif domain == "builder":
            from crewai import Crew

            from src.agents.builder.agent import BuilderAgent
            from src.agents.builder.tasks import create_build_site_task

            if action == "design":
                builder = BuilderAgent(request.agent_id, request.correlation_id, request.payload)
                result_data = builder.run_design_phase()
                agent_session_duration_seconds.labels(persona=persona).observe(time.time() - start_time)
                agent_sessions_total.labels(persona=persona, status="completed").inc()
                return TaskResponse(
                    status="completed",
                    result=result_data,
                    correlation_id=request.correlation_id,
                )
            elif action == "build":
                builder = BuilderAgent(request.agent_id, request.correlation_id, request.payload)
                result_data = builder.run_build_phase()
                agent_session_duration_seconds.labels(persona=persona).observe(time.time() - start_time)
                agent_sessions_total.labels(persona=persona, status="completed").inc()
                return TaskResponse(
                    status="completed",
                    result=result_data,
                    correlation_id=request.correlation_id,
                )
            else:
                # Legacy: builder.generate
                builder = BuilderAgent(request.agent_id, request.correlation_id, request.payload)
                agent_instance = builder.build()

                lead_data = request.payload.get("lead_data", {})
                design_system = request.payload.get("design_system", {})

                build_task = create_build_site_task(agent_instance, lead_data, design_system)

                crew = Crew(agents=[agent_instance], tasks=[build_task], verbose=True)

                output = crew.kickoff()
                raw_html = str(output)

                agent_session_duration_seconds.labels(persona=persona).observe(time.time() - start_time)
                agent_sessions_total.labels(persona=persona, status="completed").inc()
                return TaskResponse(
                    status="completed",
                    result={"html": raw_html},
                    correlation_id=request.correlation_id,
                )
        elif domain == "qa":
            from crewai import Crew

            from src.agents.qa.agent import QAAgent
            from src.agents.qa.tasks import create_qa_audit_task

            qa = QAAgent(request.agent_id, request.correlation_id, request.payload)
            agent_instance = qa.build()

            html_code = request.payload.get("html_code", "")

            audit_task = create_qa_audit_task(agent_instance, html_code)

            crew = Crew(agents=[agent_instance], tasks=[audit_task], verbose=True)

            output = crew.kickoff()
            raw_result = str(output)

            agent_session_duration_seconds.labels(persona=persona).observe(time.time() - start_time)
            agent_sessions_total.labels(persona=persona, status="completed").inc()
            return TaskResponse(
                status="completed",
                result={"audit_report": raw_result},
                correlation_id=request.correlation_id,
            )
        elif domain == "orchestrator":
            from src.agents.orchestrator.agent import OrchestratorAgent, PipelineState

            orch = OrchestratorAgent(request.agent_id, request.correlation_id, request.payload)
            current = PipelineState(request.payload["current_state"])
            event = request.payload["event"]
            next_state, next_agent = orch.transition(current, event)
            agent_session_duration_seconds.labels(persona=persona).observe(time.time() - start_time)
            agent_sessions_total.labels(persona=persona, status="completed").inc()
            return TaskResponse(
                status="completed",
                result={"next_state": next_state, "next_agent": next_agent},
                correlation_id=request.correlation_id,
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unknown agent domain: {domain}")

    except RequiresApprovalException as e:
        logger.warning("Task paused for HITL approval: %s", str(e))
        agent_sessions_total.labels(persona=persona, status="pending_hitl").inc()
        return TaskResponse(
            status="pending_hitl",
            error=str(e),
            correlation_id=request.correlation_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Task failed: %s", e, exc_info=True)
        agent_sessions_total.labels(persona=persona, status="failed").inc()
        return TaskResponse(
            status="failed",
            error=str(e),
            correlation_id=request.correlation_id,
        )


@app.post("/tasks/approve")
async def approve_task(request: TaskApprovalRequest):
    """
    Called by the Node.js API when a human operator approves a pending tool.
    This unblocks the state so the task can be safely retried.
    """
    logger.info(
        "Received approval for session %s, tool/approval %s from operator %s",
        _s(request.session_id),
        _s(request.approval_id),
        _s(request.operator_id),
    )

    success = AgentSessionManager.grant_approval(
        session_id=request.session_id, approval_id=request.approval_id, operator_id=request.operator_id
    )

    if not success:
        raise HTTPException(status_code=404, detail="Pending approval not found or already approved.")

    return {"status": "approved", "session_id": request.session_id}


if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host=config.runtime_host,
        port=config.runtime_port,
        reload=True,
    )
