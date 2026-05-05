from __future__ import annotations

import logging
from typing import Any

from src.agents.base import BaseAgentePro

logger = logging.getLogger(__name__)

class QAAgent(BaseAgentePro):
    """
    QA Agent (Engenheiro de Qualidade e Segurança).
    Responsável por auditar sites recém-gerados, garantindo acessibilidade,
    responsividade, segurança básica e adequação ao design system.
    """

    def __init__(self, agent_id: str, operator_id: str, payload: dict[str, Any]):
        super().__init__(agent_id, operator_id, payload)

    def build(self):
        """Builds and returns the CrewAI Agent instance."""
        brand_name = self.payload.get("brand_name", "AgentePro")
        
        return self.create_agent(
            role="Auditor de Qualidade e Segurança Web",
            goal="Revisar e validar códigos HTML gerados, garantindo que não existam vulnerabilidades óbvias (como links maliciosos) e assegurando a qualidade de UI/UX e SEO.",
            backstory=(
                f"Você é o engenheiro de QA sênior da {brand_name}. "
                "Sua missão é atuar como a última linha de defesa antes de um site ir para produção. "
                "Você é especialista em identificar problemas de responsividade, quebras de layout CSS, "
                "falta de tags de SEO (title, meta tags), e vulnerabilidades de segurança como XSS ou links "
                "para sites maliciosos. Você é minucioso, direto ao ponto e não deixa passar erros primários."
            ),
            tools=[],  # In the future, we could add a LightHouse tool or Security Scanner tool
            use_small_model=False,
        )
