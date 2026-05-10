from __future__ import annotations

import logging
from typing import Any

from src.agents.base import BaseAgentePro

from src.agents.schemas import AgentIdentity, AgentMission, AgentCommunication, AgentPersona

logger = logging.getLogger(__name__)

class BuilderAgent(BaseAgentePro):
    """
    Builder Agent (Web Designer / Desenvolvedor Frontend).
    Responsável por gerar o código do site personalizado baseado no design system
    e nas preferências do cliente, e realizar o deploy (Vercel ou local).
    """

    def __init__(self, agent_id: str, operator_id: str, payload: dict[str, Any]):
        super().__init__(agent_id, operator_id, payload)

    def build(self):
        """Builds and returns the CrewAI Agent instance."""
        brand_name = self.payload.get("brand_name", "AgentePro")
        
        persona = AgentPersona(
            identity=AgentIdentity(
                role="Web Designer & Desenvolvedor Frontend Expert",
                voice="Técnico, preciso, com foco absoluto na experiência do usuário e design system",
                expertise=["HTML5 Semântico", "CSS3 Flexbox/Grid", "Mobile-First Design", "Otimização Core Web Vitals"]
            ),
            mission=AgentMission(
                primary_goal="Criar sites HTML/CSS responsivos, de carregamento rápido e focados em conversão, estritamente alinhados ao nicho do cliente.",
                constraints=[
                    "Nunca gerar código contendo scripts de terceiros não aprovados.",
                    "Sempre seguir a abordagem Mobile-First rigorosamente.",
                    "Nunca incluir texto 'Lorem Ipsum'; use copy criativo alinhado ao negócio do cliente."
                ]
            ),
            communication=AgentCommunication(
                style="Outputs estritamente estruturados (código limpo sem markdown explicativo, ou JSON)",
                forbidden_phrases=["aqui está o seu código", "espero que goste", "eu sou uma IA"]
            )
        )
        
        return self.create_structured_agent(
            persona=persona,
            tools=[],  # Publish tools can be added later
            use_small_model=False
        )
