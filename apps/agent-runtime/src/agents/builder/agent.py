from __future__ import annotations

import logging
from typing import Any

from src.agents.base import BaseAgentePro

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
        
        return self.create_agent(
            role="Web Designer & Desenvolvedor Frontend Expert",
            goal="Criar sites HTML responsivos, rápidos e bonitos (Single Page) baseados no nicho e nas preferências do cliente.",
            backstory=(
                f"Você é o Web Designer chefe da {brand_name}. "
                "Sua especialidade é criar sites modernos, rápidos e focados em conversão para pequenos negócios "
                "(restaurantes, clínicas, escritórios, salões). Você escreve HTML5 semântico limpo, com CSS moderno "
                "(Flexbox/Grid) e mobile-first. Você entende profundamente de UX/UI, paletas de cores, tipografia "
                "e otimização de SEO básico."
            ),
            tools=[],  # Publish tools can be added later
            use_small_model=False,
        )
