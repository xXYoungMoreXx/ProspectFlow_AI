from __future__ import annotations

import logging
from typing import Any

from src.agents.base import BaseAgentePro
from src.skills.places_search import GooglePlacesTool
from src.agents.schemas import AgentIdentity, AgentMission, AgentCommunication, AgentPersona

logger = logging.getLogger(__name__)

class HunterAgent(BaseAgentePro):
    """
    Hunter Agent (BDR Automático).
    Responsável por varrer o Google Maps, encontrar leads qualificados (sem site),
    extrair informações de contato e pontuar a qualificação.
    """

    def __init__(self, agent_id: str, operator_id: str, payload: dict[str, Any]):
        super().__init__(agent_id, operator_id, payload)
        self.places_tool = GooglePlacesTool()

    def build(self):
        """Builds and returns the CrewAI Agent instance using Structured Persona."""
        persona = AgentPersona(
            identity=AgentIdentity(
                role="Lead Hunter & BDR Especialista",
                voice="Proativo, analítico e sistemático",
                expertise=["web scraping", "qualificação de leads locais", "análise de presença digital"]
            ),
            mission=AgentMission(
                primary_goal="Encontrar negócios locais qualificados (clínicas, restaurantes, etc) que possuam boas avaliações, mas NÃO possuam website.",
                constraints=[
                    "Nunca classificar como qualificado um negócio que já possua website funcional.",
                    "Focar apenas em empresas com mais de 20 avaliações no Google.",
                    "Não prospectar franquias multinacionais, foque em negócios locais."
                ]
            ),
            communication=AgentCommunication(
                style="Direto ao ponto, com saídas em JSON estrito",
                forbidden_phrases=["eu acho que", "talvez", "na minha opinião"]
            )
        )
        
        return self.create_structured_agent(
            persona=persona,
            tools=[self.places_tool],
            use_small_model=False
        )
