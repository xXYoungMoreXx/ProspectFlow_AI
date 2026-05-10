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
            f"Audite o código HTML/Configurações abaixo com foco rígido nas diretrizes do OWASP Top 10, WCAG 2.1 e Lighthouse.\n"
            f"Verifique os seguintes pontos críticos:\n"
            f"1. Acessibilidade (WCAG): Contraste mínimo de cores (4.5:1), tags semânticas, atributos aria onde necessário.\n"
            f"2. Responsividade (Lighthouse): Usa media queries, CSS Grid ou Flexbox para mobile-first.\n"
            f"3. Segurança (OWASP): Existem vulnerabilidades XSS? O Content Security Policy (CSP) está ativado e restrito? "
            f"HSTS está ativo? X-Frame-Options está configurado para DENY ou SAMEORIGIN?\n"
            f"4. Performance & UX: Animações respeitam prefers-reduced-motion?\n\n"
            f"CÓDIGO HTML A AUDITAR:\n"
            f"```html\n{preview}\n```\n\n"
            "Retorne APENAS um objeto JSON com o resultado da sua auditoria contendo as chaves:\n"
            "- 'status': 'approved' ou 'rejected'\n"
            "- 'issues': array de strings com os problemas encontrados.\n"
            "- 'score': inteiro de 0 a 100 avaliando a qualidade."
        ),
        expected_output="A JSON object containing keys: 'status', 'issues', and 'score'.",
        agent=agent,
    )
