from __future__ import annotations

import json
import logging
from typing import Any

from crewai import Agent, Crew, Process

from src.agents.base import BaseAgentePro
from src.agents.builder.tasks import create_build_phase_tasks, create_design_phase_tasks
from src.config.llm_routing import get_model

logger = logging.getLogger(__name__)


class BuilderAgent(BaseAgentePro):
    """
    Builder Agent — 2 fases:
    - run_design_phase(): COPYWRITER + DESIGNER + IMAGER paralelo → HITL APPROVE_MOCKUP
    - run_build_phase(): CODER → SEO + DEPLOY → HITL APPROVE_STAGING
    """

    def __init__(self, agent_id: str, operator_id: str, payload: dict[str, Any]):
        super().__init__(agent_id, operator_id, payload)

    def _make_copywriter(self) -> Agent:
        return Agent(
            role="Copywriter Especialista em Negócios Locais",
            goal="Criar textos persuasivos, específicos e sem lorem ipsum.",
            backstory="Especialista em copywriting para PMEs brasileiras com foco em conversão.",
            llm=get_model("copywriter"),
            verbose=False,
        )

    def _make_designer(self) -> Agent:
        return Agent(
            role="Web Designer Visual Senior",
            goal="Criar mockup HTML/CSS visualmente impressionante aprovável pelo operador.",
            backstory="Designer com 10 anos em landing pages de alta conversão para pequenos negócios.",
            llm=get_model("designer"),
            verbose=False,
        )

    def _make_imager(self) -> Agent:
        return Agent(
            role="Image Prompt Specialist",
            goal="Criar prompts fotorrealistas para Nano Banana Pro.",
            backstory="Especialista em prompts de imagem para B2B brasileiro.",
            llm=get_model("content_check"),
            verbose=False,
        )

    def _make_coder(self) -> Agent:
        return Agent(
            role="Frontend Developer Expert",
            goal="Converter mockup aprovado em HTML5 final, limpo e responsivo.",
            backstory="Desenvolvedor frontend senior especializado em HTML5 semântico e mobile-first.",
            llm=get_model("coder"),
            verbose=False,
        )

    def _make_seo(self) -> Agent:
        return Agent(
            role="SEO Technical Specialist",
            goal="Otimizar meta tags e schema.org para buscas locais.",
            backstory="Especialista em SEO técnico para negócios locais brasileiros.",
            llm=get_model("seo_optimizer"),
            verbose=False,
        )

    def _make_deployer(self) -> Agent:
        return Agent(
            role="Deploy Engineer",
            goal="Preparar artefatos de deploy para staging.",
            backstory="Engenheiro de deploy especializado em sites estáticos JAMstack.",
            llm=get_model("deployer"),
            verbose=False,
        )

    def run_design_phase(self) -> dict[str, Any]:
        """Fase 1: COPYWRITER + DESIGNER + IMAGER em paralelo."""
        briefing: dict = self.payload.get("briefing", {})
        feedback: str | None = self.payload.get("feedback")

        if feedback:
            existing = briefing.get("styleReferences", "")
            briefing["styleReferences"] = f"{existing} | Feedback operador: {feedback}".strip(" |")

        copywriter = self._make_copywriter()
        designer = self._make_designer()
        imager = self._make_imager()

        tasks = create_design_phase_tasks(copywriter, designer, imager, briefing)
        crew = Crew(
            agents=[copywriter, designer, imager],
            tasks=tasks,
            process=Process.sequential,
            verbose=False,
        )
        result = crew.kickoff()
        outputs = result.tasks_output

        copy_result = self._parse_json(outputs[0].raw if len(outputs) > 0 else "{}")
        design_result = self._parse_json(outputs[1].raw if len(outputs) > 1 else "{}")
        image_result = self._parse_json(outputs[2].raw if len(outputs) > 2 else "{}")

        logger.info("builder_design_phase_complete", extra={"agent_id": self.agent_id})

        return {
            "phase": "design",
            "mockup_html": design_result.get("mockup_html", ""),
            "mockup_url": "",
            "mockup_preview_description": design_result.get("mockup_preview_description", ""),
            "color_palette": design_result.get("color_palette", []),
            "sections": design_result.get("sections", []),
            "copy": copy_result,
            "image_prompts": image_result.get("image_prompts", []),
        }

    def run_build_phase(self) -> dict[str, Any]:
        """Fase 2: CODER → SEO + DEPLOY após HITL APPROVE_MOCKUP aprovado."""
        briefing: dict = self.payload.get("briefing", {})
        design_result: dict = self.payload.get("design_result", {})

        coder = self._make_coder()
        seo = self._make_seo()
        deployer = self._make_deployer()

        tasks = create_build_phase_tasks(coder, seo, deployer, briefing, design_result)
        crew = Crew(
            agents=[coder, seo, deployer],
            tasks=tasks,
            process=Process.sequential,
            verbose=False,
        )
        result = crew.kickoff()
        outputs = result.tasks_output

        html = outputs[0].raw if len(outputs) > 0 else ""
        seo_html = outputs[1].raw if len(outputs) > 1 else html
        deploy_info = self._parse_json(outputs[2].raw if len(outputs) > 2 else "{}")

        logger.info("builder_build_phase_complete", extra={"agent_id": self.agent_id})
        return {"phase": "build", "html": seo_html or html, "deploy_info": deploy_info}

    def build(self) -> Agent:
        return self._make_coder()

    def _parse_json(self, raw: str) -> dict:
        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                parts = cleaned.split("```")
                cleaned = parts[1] if len(parts) > 1 else cleaned
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
            return json.loads(cleaned.strip())
        except Exception:
            return {}
