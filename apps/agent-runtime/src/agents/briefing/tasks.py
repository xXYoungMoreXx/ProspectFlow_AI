from __future__ import annotations

from crewai import Agent, Task

# Niche-specific question hints — interviewer adapts based on this
NICHE_HINTS: dict[str, str] = {
    "restaurant": "restaurante, delivery, cardápio, horários de funcionamento, reservas, endereço",
    "clinic": "especialidades médicas, convênios, agendamento online, equipe, endereço",
    "salon": "serviços de beleza, agendamento online, portfólio de trabalhos, endereço",
    "lawyer": "áreas de atuação, atendimento presencial ou online, OAB, localização",
    "gym": "modalidades, planos, equipamentos, endereço, horários",
    "store": "produtos, formas de pagamento, entrega/retirada, endereço físico ou e-commerce",
    "generic": "serviços oferecidos, público-alvo, diferencial competitivo, formas de contato",
}


def create_interview_task(agent: Agent, business_name: str, niche: str, contact_name: str) -> Task:
    """
    Generates adaptive briefing questions for the client's business.
    Output: numbered list of questions ready to send via WhatsApp/Telegram.
    """
    niche_context = NICHE_HINTS.get(niche.lower(), NICHE_HINTS["generic"])

    return Task(
        description=(
            f"Você precisa coletar informações para criar o site de '{business_name}' "
            f"(nicho: {niche}), cujo responsável é {contact_name}.\n\n"
            f"Contexto do nicho: {niche_context}\n\n"
            "Gere uma lista numerada de 6 a 10 perguntas de briefing adaptadas a este negócio. "
            "As perguntas devem ser:\n"
            "- Escritas em português informal e amigável\n"
            "- Prontas para envio via WhatsApp (sem markdown, apenas texto limpo)\n"
            "- Cobrindo: nome/tipo do negócio, serviços principais, horários, endereço, "
            "  diferenciais, formas de contato (WhatsApp/Instagram/telefone), "
            "  disponibilidade de logo e fotos, e qualquer informação essencial do nicho.\n\n"
            "Inicie com uma mensagem de apresentação curta e amigável antes da lista."
        ),
        expected_output=(
            "Mensagem de apresentação seguida de lista numerada de perguntas de briefing "
            "em português, formatada para envio via mensagem de texto."
        ),
        agent=agent,
    )


def create_extract_task(agent: Agent, business_name: str, niche: str, transcript: str) -> Task:
    """
    Extracts ClientBriefingDTO from interview transcript.
    Output: valid JSON matching ClientBriefingDTO schema.
    """
    return Task(
        description=(
            f"Extraia um ClientBriefingDTO completo da seguinte transcrição de entrevista "
            f"de briefing para o negócio '{business_name}' (nicho: {niche}).\n\n"
            f"TRANSCRIÇÃO:\n{transcript}\n\n"
            "Retorne APENAS um JSON válido com a seguinte estrutura:\n"
            "{\n"
            '  "businessName": string,\n'
            '  "niche": string,\n'
            '  "contactName": string | null,\n'
            '  "contactPhone": string | null,\n'
            '  "contactEmail": string | null,\n'
            '  "address": string | null,\n'
            '  "services": string[],\n'
            '  "openingHours": string | null,\n'
            '  "differentials": string[],\n'
            '  "socialMedia": { "instagram": string | null, "whatsapp": string | null, "facebook": string | null },\n'
            '  "hasLogo": boolean,\n'
            '  "hasPhotos": boolean,\n'
            '  "colorPreferences": string | null,\n'
            '  "additionalNotes": string | null\n'
            "}\n\n"
            "Se um campo não foi mencionado, use null ou [] para arrays."
        ),
        expected_output="Valid JSON object matching ClientBriefingDTO schema with no extra text.",
        agent=agent,
    )
