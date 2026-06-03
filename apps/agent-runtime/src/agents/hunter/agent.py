from __future__ import annotations

import logging
from typing import Any

from src.agents.base import BaseAgentePro
from src.agents.schemas import AgentCommunication, AgentIdentity, AgentMission, AgentPersona
from src.skills.cnpj_enricher import CNPJEnricherTool
from src.skills.cnpj_lookup import CNPJLookupTool
from src.skills.places_search import GooglePlacesTool

logger = logging.getLogger(__name__)


class HunterAgent(BaseAgentePro):
    """
    Hunter Agent (BDR Automático).
    Responsável por varrer o Google Maps e consultar CNPJs (via BrasilAPI) para encontrar
    e qualificar leads B2B/B2C, extrair informações de contato e pontuar a qualificação.
    """

    def __init__(self, agent_id: str, operator_id: str, payload: dict[str, Any]):
        super().__init__(agent_id, operator_id, payload)
        self.places_tool = GooglePlacesTool()
        self.cnpj_lookup_tool = CNPJLookupTool()
        self.cnpj_enricher_tool = CNPJEnricherTool()

    def build(self):
        """Builds and returns the CrewAI Agent instance using Structured Persona."""
        persona = AgentPersona(
            identity=AgentIdentity(
                role="Lead Hunter & BDR Especialista (Foco Brasil)",
                voice="Proativo, analítico e sistemático",
                expertise=[
                    "web scraping",
                    "qualificação de leads locais",
                    "análise de presença digital",
                    "enriquecimento de dados de CNPJ",
                ],
            ),
            mission=AgentMission(
                primary_goal="Encontrar e qualificar negócios locais e empresas B2B no Brasil, identificando carências digitais e verificando saúde fiscal via CNPJ.",
                constraints=[
                    "Nunca classificar como qualificado um negócio que já possua website funcional.",
                    "Focar em empresas com mais de 20 avaliações no Google ou empresas B2B com quadro societário claro.",
                    "Não prospectar franquias multinacionais, foque em negócios locais e PMEs brasileiras.",
                    "Sempre validar os dados básicos da empresa utilizando a busca por CNPJ caso o CNPJ esteja disponível.",
                    "Ao avaliar empresas B2B, utilizar ferramentas de enriquecimento para obter dados do Quadro de Sócios (QSA) e Capital Social.",
                ],
            ),
            communication=AgentCommunication(
                style="Direto ao ponto, com saídas em JSON estrito",
                forbidden_phrases=["eu acho que", "talvez", "na minha opinião"],
            ),
        )

        return self.create_structured_agent(
            persona=persona,
            tools=[self.places_tool, self.cnpj_lookup_tool, self.cnpj_enricher_tool],
            agent_role="prospector",
        )
