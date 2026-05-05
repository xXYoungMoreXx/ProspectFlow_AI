from __future__ import annotations

import json
from crewai import Task, Agent

def create_negotiate_task(agent: Agent, current_stage: str, lead_data: dict, conversation_history: list[dict], user_message: str) -> Task:
    """
    Cria a Task de negociação para responder à última mensagem do cliente.
    """
    
    # Format the history
    history_lines = []
    for msg in conversation_history[-10:]:
        role = "Cliente" if msg.get("role") == "user" else "Você"
        history_lines.append(f"{role}: {msg.get('content')}")
    history_str = "\n".join(history_lines) if history_lines else "(nenhuma conversa anterior)"
    
    lead_info = json.dumps(lead_data, ensure_ascii=False, indent=2)

    return Task(
        description=(
            f"O cliente enviou a seguinte mensagem:\n"
            f"<USER_MESSAGE>\n{user_message}\n</USER_MESSAGE>\n\n"
            f"Estágio atual do Funil: {current_stage}\n"
            f"Dados do Lead:\n{lead_info}\n\n"
            f"Histórico da conversa:\n{history_str}\n\n"
            "Sua missão:\n"
            "1. Analise o estágio atual do funil e a intenção do cliente.\n"
            "2. Elabore a melhor resposta possível (máximo 150 palavras) para avançar a venda ou contornar a objeção.\n"
            "3. Decida qual será o próximo estágio do funil (ex: presentation, personalization, proposal, objection, closing, done).\n\n"
            "Você deve retornar estritamente um objeto JSON contendo:\n"
            "- 'response': O texto exato da mensagem que enviaremos ao cliente (seu discurso).\n"
            "- 'next_stage': O novo estágio do funil sugerido baseado na resposta.\n"
            "- 'analysis': Uma breve frase de 10 palavras explicando o comportamento do cliente (ex: 'Cliente achou caro, contornei objeção').\n"
            "- 'sentiment': 'positive', 'neutral' ou 'negative'."
        ),
        expected_output="A valid JSON object containing keys: 'response', 'next_stage', 'analysis', and 'sentiment'.",
        agent=agent,
    )
