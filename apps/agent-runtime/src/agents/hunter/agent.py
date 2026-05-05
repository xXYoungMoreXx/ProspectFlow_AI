from __future__ import annotations

import logging
from typing import Any

from src.agents.base import BaseAgentePro
from src.skills.places_search import GooglePlacesTool

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
        """Builds and returns the CrewAI Agent instance."""
        return self.create_agent(
            role="Lead Hunter & BDR Especialista",
            goal="Encontrar negócios locais qualificados que NÃO possuam website e tenham alto potencial de fechamento.",
            backstory=(
                "Você é um BDR (Business Development Representative) altamente experiente e focado em prospecção outbound. "
                "Sua especialidade é varrer ferramentas de busca e o Google Maps para encontrar empresas físicas "
                "(como clínicas, restaurantes, oficinas, escritórios) que já possuem clientes (boas avaliações) "
                "mas que ainda não têm um website. Você sabe que empresas com nota alta e muitas avaliações, "
                "mas sem presença digital própria, são os melhores clientes em potencial para vendermos a criação de um site."
            ),
            tools=[self.places_tool],
            use_small_model=False,
        )
