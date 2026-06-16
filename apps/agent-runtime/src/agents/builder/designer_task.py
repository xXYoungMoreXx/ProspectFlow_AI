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
Crie um mockup visual completo em HTML/CSS semântico para {business_name} ({niche}),
com padrão de design de 2026 — nível de agência premium, não template genérico.

Especificações obrigatórias:
- Tipo de site: {site_type}
- Cor primária: {primary_color} (derive paleta completa em CSS custom properties,
  incluindo tons de superfície, texto e um accent de contraste)
- Estilo visual: {style}
- Referências: {references or "nenhuma — use julgamento profissional"}
- Estrutura: header sticky + hero, serviços (3-6 cards), prova social/depoimentos, CTA, footer

Linguagem visual 2026 (obrigatório):
- Tipografia fluida com clamp() — display expressivo no hero, corpo legível (16px+)
- Hero com profundidade: gradiente mesh/radial sutil ou formas orgânicas em CSS, nunca flat branco
- Cards com elevação suave (sombras em camadas) ou glassmorphism discreto
- Espaço em branco generoso; grid assimétrico onde fizer sentido
- Micro-interações CSS: hover states com transform/transition, scroll-margin, :focus-visible
- @media (prefers-reduced-motion: reduce) desativando animações
- Mobile-first (breakpoints 768px e 1024px), CSS Grid + Flexbox

Restrições técnicas:
- Sem JS complexo — CSS puro para animações simples
- Google Fonts via CDN (máx 2 famílias, display=swap)
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
