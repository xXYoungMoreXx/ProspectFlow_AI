from __future__ import annotations

from crewai import Task, Agent

def create_search_and_qualify_task(agent: Agent, category: str, city: str) -> Task:
    """
    Cria a Task de busca e qualificação de leads.
    """
    return Task(
        description=(
            f"Busque por '{category}' na cidade de '{city}' usando a sua ferramenta do Google Places.\n"
            "Sua missão é identificar estabelecimentos comerciais que atendam ao seguinte critério absoluto:\n"
            "1. NÃO POSSUEM WEBSITE (has_website deve ser false ou nulo).\n\n"
            "Para cada lead que não possui website, analise a qualificação baseada em:\n"
            "- Quantidade de avaliações (total_ratings > 20 é ótimo)\n"
            "- Nota média (rating >= 4.0 é ótimo)\n"
            "- Possuir telefone de contato\n\n"
            "Formate o resultado final como uma lista JSON contendo os melhores leads encontrados que NÃO têm site. "
            "Inclua os campos: name, address, phone, rating, total_ratings, place_id, e um 'score' sugerido de 1 a 10."
        ),
        expected_output="A JSON array containing the qualified leads (only those without websites), each with name, address, phone, rating, total_ratings, place_id, and an internal score (1-10).",
        agent=agent,
    )
