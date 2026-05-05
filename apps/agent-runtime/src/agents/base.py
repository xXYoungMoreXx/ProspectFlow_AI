"""
Base Agent definitions for CrewAI orchestration.
Provides standard wrappers and utility methods for all AgentePro personas.
"""
from __future__ import annotations

import logging
from typing import Any

from crewai import Agent, Task
from litellm import completion

from src.config import config

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
        
    def create_agent(self, role: str, goal: str, backstory: str, tools: list | None = None, use_small_model: bool = False) -> Agent:
        """
        Creates a CrewAI agent with standard configurations.
        """
        llm = self._get_llm(use_small_model)
        
        # Inject standard AgentePro context into the backstory
        full_backstory = (
            f"{backstory}\n\n"
            f"You are operating within the AgentePro platform on behalf of Operator ID: {self.operator_id}."
        )
        
        return Agent(
            role=role,
            goal=goal,
            backstory=full_backstory,
            verbose=True,
            allow_delegation=False,
            tools=tools or [],
            llm=llm
        )
