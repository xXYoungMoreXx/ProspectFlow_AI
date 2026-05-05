from __future__ import annotations

from crewai import Task, Agent

def create_qa_audit_task(agent: Agent, html_code: str) -> Task:
    """
    Cria a Task de auditoria de qualidade no código HTML.
    """
    # Se o HTML for muito grande, truncamos para focar na estrutura
    preview = html_code if len(html_code) < 15000 else html_code[:15000] + "\n...[TRUNCATED]"

    return Task(
        description=(
            f"Audite o código HTML abaixo. Verifique os seguintes pontos críticos:\n"
            f"1. SEO: Tem a tag <title> e as meta tags corretas (description, viewport)?\n"
            f"2. Responsividade: Usa media queries CSS, CSS Grid ou Flexbox corretamente para mobile?\n"
            f"3. Segurança: Existem scripts inseridos que não são de fontes confiáveis (CDNs comuns como Google Fonts)? Existem links de phishing?\n"
            f"4. Estrutura Semântica: O HTML5 está sendo usado corretamente (header, main, section, footer)?\n\n"
            f"CÓDIGO HTML A AUDITAR:\n"
            f"```html\n{preview}\n```\n\n"
            "Retorne APENAS um objeto JSON com o resultado da sua auditoria contendo as chaves:\n"
            "- 'status': 'approved' ou 'rejected'\n"
            "- 'issues': array de strings com os problemas encontrados (ou array vazio se tudo estiver perfeito)\n"
            "- 'score': inteiro de 0 a 100 avaliando a qualidade geral do código."
        ),
        expected_output="A JSON object containing keys: 'status', 'issues', and 'score'.",
        agent=agent,
    )
