from __future__ import annotations

import json
from crewai import Task, Agent

def create_build_site_task(agent: Agent, lead_data: dict, design_system: dict) -> Task:
    """
    Cria a Task de geração do HTML do site.
    """
    lead_info = json.dumps(lead_data, ensure_ascii=False, indent=2)
    ds_info = json.dumps(design_system, ensure_ascii=False, indent=2)
    
    business_name = lead_data.get("name", "Negócio Local")
    category = lead_data.get("category", "Geral")

    return Task(
        description=(
            f"Sua missão é gerar o código HTML5 completo e funcional para o site de {business_name}.\n\n"
            f"DADOS DO CLIENTE:\n{lead_info}\n\n"
            f"DESIGN SYSTEM DE REFERÊNCIA:\n{ds_info}\n\n"
            "REGRAS ESTRITAS:\n"
            "1. Retorne APENAS o código HTML completo. O HTML deve incluir o CSS dentro da tag <style> e qualquer JS dentro da tag <script>.\n"
            "2. O design deve ser moderno, responsivo (mobile-first) e visualmente muito atraente.\n"
            "3. Use a paleta de cores fornecida no Design System ou sugerida pelo cliente.\n"
            "4. Crie seções para: Hero (com CTA), Sobre, Serviços/Produtos, Depoimentos e Contato (com forms falso e links de WhatsApp).\n"
            f"5. Adapte a linguagem e o tom para o nicho de: {category}.\n"
            "6. Use placeholders bonitos de imagens do Unsplash se necessário.\n"
            "7. Nunca inclua blocos markdown (```html) na sua resposta final, apenas o código cru que começa com <!DOCTYPE html> e termina com </html>."
        ),
        expected_output="A single string containing raw HTML5 code for the complete generated website, starting with <!DOCTYPE html>.",
        agent=agent,
    )
