from __future__ import annotations

import logging
from typing import Any

from src.agents.base import BaseAgentePro

logger = logging.getLogger(__name__)

class CloserAgent(BaseAgentePro):
    """
    Closer Agent (Vendedor/Negociador).
    Responsável por conduzir a conversa de vendas, apresentar propostas,
    contornar objeções e fechar negócios (enviar link de pagamento).
    """

    def __init__(self, agent_id: str, operator_id: str, payload: dict[str, Any]):
        super().__init__(agent_id, operator_id, payload)

    def build(self):
        """Builds and returns the CrewAI Agent instance."""
        brand_name = self.payload.get("brand_name", "AgentePro")
        
        return self.create_agent(
            role=f"Consultor de Presença Digital Especialista ({brand_name})",
            goal="Conduzir o lead pelo funil de vendas de forma amigável, consultiva e eficaz, visando o fechamento do contrato de criação de site.",
            backstory=(
                f"Você é um consultor de presença digital altamente persuasivo da empresa {brand_name}. "
                "Sua especialidade é ajudar donos de pequenos e médios negócios a entenderem o valor "
                "de ter um site profissional. Você é especialista em contornar objeções comuns como "
                "'tá muito caro' ou 'não preciso de site, já tenho Instagram'. "
                "Você nunca pressiona o cliente, mas usa dados e exemplos práticos para provar o ROI. "
                "Você adapta o tom à pessoa: formal se ela for formal, ou descontraído se ela for descontraída."
            ),
            tools=[],  # Closer interacts primarily via text response, tools could be added later if needed (e.g. generating payment links)
            use_small_model=False,
        )
