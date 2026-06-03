from __future__ import annotations

from crewai import Agent, Task


def build_designer_description(briefing: dict) -> str:
    """Build the task description string from a briefing dict. Testable without crewai Task."""
    business_name = briefing.get("businessName", "Empresa")
    niche = briefing.get("niche", "negócio")
    primary_color = briefing.get("primaryColor", "#2563eb")
    style = briefing.get("style", "profissional")
    site_type = briefing.get("siteType", "landing page")
    references = briefing.get("styleReferences", "")

    return f"""
Crie um mockup visual completo em HTML/CSS semântico para {business_name} ({niche}).

Especificações obrigatórias:
- Tipo de site: {site_type}
- Cor primária: {primary_color} (derive paleta complementar)
- Estilo visual: {style}
- Referências: {references or "nenhuma — use julgamento profissional"}
- Estrutura: header+hero, serviços (3 cards), depoimentos, CTA, footer
- Mobile-first (breakpoints 768px e 1024px)
- Sem JS complexo — CSS puro para animações simples
- Google Fonts via CDN
- Copy real e específico para {niche} — proibido lorem ipsum
- Imagens: placeholders CSS (background gradient) — sem <img src external>

Output OBRIGATÓRIO em JSON:
{{
  "mockup_html": "<HTML completo <!DOCTYPE html>...</html>>",
  "mockup_preview_description": "<2 frases descrevendo o visual>",
  "color_palette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "sections": ["header", "hero", "services", "testimonials", "cta", "footer"]
}}
"""


def create_designer_task(designer_agent: Agent, briefing: dict) -> Task:
    """Task do DESIGNER — mockup HTML/CSS via claude-opus-4-7 (Claude Design model)."""
    description = build_designer_description(briefing)
    return Task(
        description=description,
        expected_output=(
            "JSON com mockup_html (HTML completo renderizável), mockup_preview_description, color_palette e sections."
        ),
        agent=designer_agent,
    )
