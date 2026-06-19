from __future__ import annotations

import logging
from typing import Any

from src.agents.base import BaseHefesto
from src.agents.schemas import AgentCommunication, AgentIdentity, AgentMission, AgentPersona

logger = logging.getLogger(__name__)


class BriefingInterviewerAgent(BaseHefesto):
    """
    Briefing Interviewer — conducts adaptive client interview.
    Generates structured question batch tailored to the client's niche.
    Output is sent to the operator who collects client responses manually
    (or via messaging webhook), then passed to BriefingExtractorAgent.
    """

    def __init__(self, agent_id: str, operator_id: str, payload: dict[str, Any]):
        super().__init__(agent_id, operator_id, payload)

    def build(self):
        persona = AgentPersona(
            identity=AgentIdentity(
                role="Consultor de Briefing & Especialista em Coleta de Requisitos",
                voice="Empático, profissional, conversacional — como um designer que quer entender a fundo o negócio do cliente",
                expertise=[
                    "coleta de requisitos para sites",
                    "perguntas adaptativas por nicho",
                    "UX research",
                    "branding e identidade visual",
                ],
            ),
            mission=AgentMission(
                primary_goal=(
                    "Gerar um conjunto completo de perguntas de briefing adaptadas ao nicho do cliente. "
                    "As perguntas devem ser claras, amigáveis e cobrir: identidade visual, serviços, "
                    "público-alvo, diferencial, formas de contato e assets disponíveis (logo, fotos)."
                ),
                constraints=[
                    "Nunca fazer mais de 10 perguntas — priorize as mais impactantes.",
                    "Formatar as perguntas em lista numerada, prontas para enviar via WhatsApp.",
                    "Nunca pedir informações que já estejam no payload (nome do cliente, nicho).",
                    "Sempre incluir uma pergunta sobre logo e fotos disponíveis.",
                ],
            ),
            communication=AgentCommunication(
                style="Amigável, direto. Output: lista numerada de perguntas em português.",
                forbidden_phrases=["eu sou uma IA", "como posso ajudar", "certamente"],
            ),
        )
        return self.create_structured_agent(persona=persona, tools=[], agent_role="interviewer")


class BriefingExtractorAgent(BaseHefesto):
    """
    Brief Extractor — converts raw interview transcript into ClientBriefingDTO JSON.
    Uses small/fast model since it's a structured extraction task.
    """

    def __init__(self, agent_id: str, operator_id: str, payload: dict[str, Any]):
        super().__init__(agent_id, operator_id, payload)

    def build(self):
        persona = AgentPersona(
            identity=AgentIdentity(
                role="Especialista em Extração Estruturada de Dados",
                voice="Preciso, técnico, sem interpretações extras",
                expertise=["NLP", "extração de informações", "JSON structuring"],
            ),
            mission=AgentMission(
                primary_goal=(
                    "Converter a transcrição da entrevista de briefing em um JSON estruturado "
                    "(ClientBriefingDTO) com todos os campos necessários para o Builder criar o site."
                ),
                constraints=[
                    "Retornar APENAS JSON válido — sem texto extra, sem markdown.",
                    "Se um campo não foi mencionado, usar null.",
                    "Nunca inventar informações não presentes na transcrição.",
                ],
            ),
            communication=AgentCommunication(
                style="Output: JSON puro e válido, nada mais.",
                forbidden_phrases=["com base na transcrição", "aqui está o JSON"],
            ),
        )
        return self.create_structured_agent(persona=persona, tools=[], agent_role="brief_extractor")
