"""
AgentePro Agent Runtime — FastAPI bridge.
Receives task requests from the Node.js API (via BullMQ HTTP bridge)
and dispatches them to the appropriate CrewAI agent.
"""
from __future__ import annotations

import logging

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from src.config import config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AgentePro Runtime",
    description="CrewAI agent orchestration bridge",
    version="0.1.0",
)


class TaskRequest(BaseModel):
    """Incoming task from the Node.js API."""
    task_type: str           # hunter.search | closer.negotiate | builder.generate | qa.review
    agent_id: str
    payload: dict
    correlation_id: str


class TaskResponse(BaseModel):
    """Task execution result."""
    status: str              # completed | failed | pending_hitl
    result: dict | None = None
    error: str | None = None
    correlation_id: str


@app.get("/health")
async def health():
    return {"status": "ok", "service": "agent-runtime", "version": "0.1.0"}


@app.post("/tasks", response_model=TaskResponse)
async def execute_task(request: TaskRequest):
    """
    Dispatch a task to the appropriate CrewAI agent.
    This is the single entry point for all agent operations.
    """
    logger.info(
        "Task received: type=%s agent=%s correlation=%s",
        request.task_type,
        request.agent_id,
        request.correlation_id,
    )

    # Route to the appropriate agent
    domain, action = request.task_type.split(".", maxsplit=1)

    try:
        if domain == "hunter":
            from src.agents.hunter.agent import HunterAgent
            from src.agents.hunter.tasks import create_search_and_qualify_task
            from crewai import Crew

            hunter = HunterAgent(request.agent_id, request.correlation_id, request.payload)
            agent_instance = hunter.build()
            
            category = request.payload.get("category", "empresas")
            city = request.payload.get("city", "São Paulo")
            
            search_task = create_search_and_qualify_task(agent_instance, category, city)
            
            crew = Crew(
                agents=[agent_instance],
                tasks=[search_task],
                verbose=True
            )
            
            output = crew.kickoff()
            
            # CrewAI returns an Output object in newer versions, or string in older.
            # We coerce it to string to be safe.
            raw_result = str(output)
            
            # Since expected output is a JSON array, we can return it inside the result
            return TaskResponse(
                status="completed",
                result={"raw_output": raw_result},
                correlation_id=request.correlation_id,
            )
        elif domain == "closer":
            from src.agents.closer.agent import CloserAgent
            from src.agents.closer.tasks import create_negotiate_task
            from crewai import Crew

            closer = CloserAgent(request.agent_id, request.correlation_id, request.payload)
            agent_instance = closer.build()
            
            current_stage = request.payload.get("current_stage", "opening")
            lead_data = request.payload.get("lead_data", {})
            conversation_history = request.payload.get("conversation_history", [])
            user_message = request.payload.get("user_message", "")
            
            negotiate_task = create_negotiate_task(
                agent_instance, 
                current_stage, 
                lead_data, 
                conversation_history, 
                user_message
            )
            
            crew = Crew(
                agents=[agent_instance],
                tasks=[negotiate_task],
                verbose=True
            )
            
            output = crew.kickoff()
            raw_result = str(output)
            
            return TaskResponse(
                status="completed",
                result={"raw_output": raw_result},
                correlation_id=request.correlation_id,
            )
        elif domain == "builder":
            from src.agents.builder.agent import BuilderAgent
            from src.agents.builder.tasks import create_build_site_task
            from crewai import Crew

            builder = BuilderAgent(request.agent_id, request.correlation_id, request.payload)
            agent_instance = builder.build()
            
            lead_data = request.payload.get("lead_data", {})
            design_system = request.payload.get("design_system", {})
            
            build_task = create_build_site_task(agent_instance, lead_data, design_system)
            
            crew = Crew(
                agents=[agent_instance],
                tasks=[build_task],
                verbose=True
            )
            
            output = crew.kickoff()
            raw_html = str(output)
            
            return TaskResponse(
                status="completed",
                result={"html": raw_html},
                correlation_id=request.correlation_id,
            )
        elif domain == "qa":
            from src.agents.qa.agent import QAAgent
            from src.agents.qa.tasks import create_qa_audit_task
            from crewai import Crew

            qa = QAAgent(request.agent_id, request.correlation_id, request.payload)
            agent_instance = qa.build()
            
            html_code = request.payload.get("html_code", "")
            
            audit_task = create_qa_audit_task(agent_instance, html_code)
            
            crew = Crew(
                agents=[agent_instance],
                tasks=[audit_task],
                verbose=True
            )
            
            output = crew.kickoff()
            raw_result = str(output)
            
            return TaskResponse(
                status="completed",
                result={"audit_report": raw_result},
                correlation_id=request.correlation_id,
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unknown agent domain: {domain}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Task failed: %s", e, exc_info=True)
        return TaskResponse(
            status="failed",
            error=str(e),
            correlation_id=request.correlation_id,
        )


if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host=config.runtime_host,
        port=config.runtime_port,
        reload=True,
    )
