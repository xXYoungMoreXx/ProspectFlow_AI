from __future__ import annotations

from crewai import Agent, Task

from src.agents.builder.designer_task import create_designer_task


def create_design_phase_tasks(
    copywriter_agent: Agent,
    designer_agent: Agent,
    imager_agent: Agent,
    briefing: dict,
) -> list[Task]:
    """Fase 1 — paralelo: COPYWRITER + DESIGNER + IMAGER."""
    business_name = briefing.get("businessName", "cliente")
    niche = briefing.get("niche", "")
    style = briefing.get("style", "profissional")

    copywriter_task = Task(
        description=(
            f"Crie textos completos para {business_name} ({niche}). Tom: {style}. "
            f"Inclua: headline (max 10 palavras), subheadline (max 20 palavras), "
            f"3 benefícios com sugestão de ícone, texto sobre a empresa (2 parágrafos), "
            f"CTA principal, tagline do footer. "
            f"Output JSON: {{headline, subheadline, benefits: [{{icon, title, description}}], "
            f"about_text, cta_text, footer_tagline}}"
        ),
        expected_output="JSON com headline, subheadline, benefits (list), about_text, cta_text, footer_tagline.",
        agent=copywriter_agent,
        async_execution=True,
    )

    designer_task = create_designer_task(designer_agent, briefing)
    designer_task.async_execution = True

    imager_task = Task(
        description=(
            f"Crie 4 prompts fotorrealistas para geração de imagem (Nano Banana Pro/DALL-E). "
            f"Contexto: {business_name} ({niche}). Estilo: {style}. "
            f"Cada prompt específico e adequado ao contexto B2B brasileiro. "
            f'Output JSON: {{"image_prompts": ["prompt1","prompt2","prompt3","prompt4"]}}'
        ),
        expected_output='JSON com "image_prompts": lista de 4 strings de prompt fotorrealista.',
        agent=imager_agent,
        async_execution=True,
    )

    return [copywriter_task, designer_task, imager_task]


def create_build_phase_tasks(
    coder_agent: Agent,
    seo_agent: Agent,
    deployer_agent: Agent,
    briefing: dict,
    design_result: dict,
) -> list[Task]:
    """Fase 2 — CODER sequencial → SEO + DEPLOY paralelo."""
    business_name = briefing.get("businessName", "cliente")
    niche = briefing.get("niche", "")
    mockup_desc = design_result.get("mockup_preview_description", "mockup aprovado")
    copy_data = design_result.get("copy", {})
    color_palette = design_result.get("color_palette", [])

    coder_task = Task(
        description=(
            f"Converta o mockup aprovado em HTML5 final para {business_name} ({niche}). "
            f"Mockup: {mockup_desc}. Paleta: {color_palette}. Textos: {copy_data}. "
            f"Requisitos: mobile-first, sem JS externo, imagens como placeholders CSS, "
            f"Google Fonts via CDN, HTML5 semântico. "
            f"Output: HTML completo (<!DOCTYPE html>...</html>). Sem markdown."
        ),
        expected_output="HTML5 completo e válido, sem markdown, começando com <!DOCTYPE html>.",
        agent=coder_agent,
    )

    seo_task = Task(
        description=(
            f"Adicione meta tags SEO ao HTML de {business_name} ({niche}): "
            f"<title>, meta description (150 chars), og:title, og:description, "
            f"og:type=website, twitter:card, schema.org LocalBusiness. "
            f"Retorne HTML completo com tags no <head>."
        ),
        expected_output="HTML completo com meta tags SEO inseridas no <head>.",
        agent=seo_agent,
        async_execution=True,
        context=[coder_task],
    )

    deployer_task = Task(
        description=(
            "Prepare manifesto de deploy para staging. Retorne JSON: "
            '{"deploy_ready": true, "files": ["index.html"], "staging_url": "pending", "provider": "vercel"}'
        ),
        expected_output="JSON com deploy_ready, files, staging_url, provider.",
        agent=deployer_agent,
        async_execution=True,
        context=[coder_task],
    )

    return [coder_task, seo_task, deployer_task]


# Keep legacy function so existing main.py import doesn't break
def create_build_site_task(agent: Agent, lead_data: dict, design_system: dict) -> Task:
    """Legacy task kept for backward compatibility with existing main.py routing."""
    import json

    from crewai import Task as _Task

    lead_info = json.dumps(lead_data, ensure_ascii=False, indent=2)
    ds_info = json.dumps(design_system, ensure_ascii=False, indent=2)
    business_name = lead_data.get("name", "Negócio Local")
    category = lead_data.get("category", "Geral")

    return _Task(
        description=(
            f"Sua missão é gerar o código HTML5 completo e funcional para o site de {business_name}.\n\n"
            f"DADOS DO CLIENTE:\n{lead_info}\n\n"
            f"DESIGN SYSTEM DE REFERÊNCIA:\n{ds_info}\n\n"
            "REGRAS ESTRITAS:\n"
            "1. Retorne APENAS o código HTML completo.\n"
            "2. Design moderno, responsivo (mobile-first).\n"
            "3. Use a paleta de cores fornecida no Design System.\n"
            f"4. Adapte a linguagem para o nicho: {category}.\n"
            "5. Nunca inclua blocos markdown na sua resposta final."
        ),
        expected_output="A single string containing raw HTML5 code, starting with <!DOCTYPE html>.",
        agent=agent,
    )
