"""
Base Agent definitions for CrewAI orchestration.
Provides standard wrappers and utility methods for all AgentePro personas.
"""

from __future__ import annotations

import logging
from typing import Any

from crewai import Agent, Task
from pydantic import BaseModel

from src.agents.callbacks import SecureToolWrapper, agent_step_callback
from src.agents.schemas import AgentPersona
from src.config import config
from src.config.llm_routing import get_model

logger = logging.getLogger(__name__)


class BaseAgentePro:
    """
    Base wrapper for AgentePro CrewAI agents.
    Provides standard LLM configuration and common behaviors.
    """

    def __init__(self, agent_id: str, operator_id: str, payload: dict[str, Any]):
        self.agent_id = agent_id
        self.operator_id = operator_id
        self.payload = payload

    def _get_llm(self, use_small_model: bool = False) -> str:
        """Returns the configured LLM model string for litellm/crewai."""
        return config.llm_small_model if use_small_model else config.llm_model

    def create_agent(
        self,
        role: str,
        goal: str,
        backstory: str,
        tools: list | None = None,
        use_small_model: bool = False,
        llm_override: str | None = None,
    ) -> Agent:
        """
        Creates a CrewAI agent with standard configurations (Legacy string-based).
        Injects ADK Guardrails (SecureToolWrapper and step_callback).

        `llm_override` takes precedence over use_small_model when provided.
        """
        llm = llm_override if llm_override is not None else self._get_llm(use_small_model)

        # Inject standard AgentePro context into the backstory
        full_backstory = (
            f"{backstory}\n\n"
            "You are operating within the AgentePro platform on behalf of"
            f" Operator ID: {self.operator_id}."
        )

        from src.agents.state import AgentSessionManager

        # Register session start
        AgentSessionManager.get_session(self.agent_id)

        # Wrap tools with Security Callbacks (SSRF/Argument validation)
        secure_tools = [SecureToolWrapper(t) for t in (tools or [])]

        return Agent(
            role=role,
            goal=goal,
            backstory=full_backstory,
            verbose=True,
            allow_delegation=False,
            tools=secure_tools,
            llm=llm,
            step_callback=agent_step_callback,
        )

    def create_structured_agent(
        self,
        persona: AgentPersona,
        tools: list | None = None,
        use_small_model: bool = False,
        agent_role: str | None = None,
    ) -> Agent:
        """
        Creates a CrewAI agent using the new Structured AgentPersona V2.

        When `agent_role` is provided the model is resolved via the LLM
        routing table (llm_routing.get_model), overriding the global config.
        """
        llm_override = get_model(agent_role) if agent_role is not None else None
        return self.create_agent(
            role=persona.identity.role,
            goal=persona.mission.primary_goal,
            backstory=persona.to_backstory(),
            tools=tools,
            use_small_model=use_small_model,
            llm_override=llm_override,
        )

    def create_structured_task(
        self,
        description: str,
        expected_output: str,
        agent: Agent,
        output_pydantic: type[BaseModel] | None = None,
    ) -> Task:
        """
        Creates a CrewAI Task that enforces Structured Output (JSON Schema).
        This aligns with ADK/Ollama Best Practices for V2.
        """
        return Task(
            description=description,
            expected_output=expected_output,
            agent=agent,
            output_pydantic=output_pydantic,
        )
