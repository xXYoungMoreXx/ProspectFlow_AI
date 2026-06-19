from __future__ import annotations

import logging
from typing import Any

from src.agents.base import BaseHefesto
from src.agents.schemas import AgentCommunication, AgentIdentity, AgentMission, AgentPersona

logger = logging.getLogger(__name__)


class QAAgent(BaseHefesto):
    """
    QA Agent (Engenheiro de Qualidade e Segurança).
    Responsável por auditar sites recém-gerados, garantindo acessibilidade,
    responsividade, segurança básica e adequação ao design system.
    """

    def __init__(self, agent_id: str, operator_id: str, payload: dict[str, Any]):
        super().__init__(agent_id, operator_id, payload)

    def build(self):
        """Builds and returns the CrewAI Agent instance."""
        brand_name = self.payload.get("brand_name", "Hefesto")

        persona = AgentPersona(
            identity=AgentIdentity(
                role="Auditor de Qualidade e Segurança",
                voice="Rígido, detalhista e guiado exclusivamente por dados, normas e best-practices globais.",
                expertise=["OWASP Top 10", "Lighthouse", "WCAG 2.1", "SEO", "W3C"],
            ),
            mission=AgentMission(
                primary_goal="Garantir que não existem vulnerabilidades de XSS e assegurar métricas severas: Performance ≥ 85, Acessibilidade 100/100, SEO ≥ 90.",
                constraints=[
                    "Nunca emitir sinal verde de deploy se um critério do checklist estruturado falhar.",
                    "Escalar HITL se score < threshold após 3 tentativas.",
                    "Verificar CSP, HSTS, X-Frame-Options e prefers-reduced-motion.",
                ],
            ),
            communication=AgentCommunication(
                style="Direto ao ponto, listando os problemas e retornando relatórios JSON estritos",
                forbidden_phrases=["parece bom no geral", "talvez devêssemos", "eu não tenho certeza"],
            ),
        )

        return self.create_structured_agent(
            persona=persona,
            tools=[],
            agent_role="sec_auditor",
        )
