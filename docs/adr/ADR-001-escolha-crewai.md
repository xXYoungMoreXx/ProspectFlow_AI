# ADR-001: Escolha de Framework para Orquestração de Agentes (CrewAI vs LangGraph)

## Contexto
O AgentePro requer um motor de orquestração para coordenar as ações de múltiplos agentes de IA (Hunter, Closer, Builder, QA). Precisamos de uma arquitetura que permita gerenciar o fluxo de trabalho dos agentes, delegar tarefas, gerenciar ferramentas (skills) e manter a confiabilidade.

## Opções Consideradas
1. **CrewAI**: Framework focado em "equipes" (crews) de agentes com funções bem definidas, delegação inerente e execução baseada em processos (sequencial ou hierárquico).
2. **LangGraph**: Framework focado em state machines cíclicas e grafos acíclicos dirigidos (DAGs) para gerenciar o controle de fluxo LLM complexo e stateful.
3. **Orquestração Customizada (Node.js)**: Construir o motor do zero para manter a stack unificada.

## Decisão Tomada
Escolhemos o **CrewAI (Python)** como a camada de *Agent Runtime*.

## Consequências
* **Positivas**: 
  * Abstração de alto nível para papéis (personas) se alinha perfeitamente com os requisitos do PRD (Hunter, Closer, etc.).
  * Suporte embutido para delegação e uso de ferramentas.
  * Curva de aprendizado menor para construir fluxos de agentes baseados em papéis comparado ao LangGraph.
* **Negativas**: 
  * Introduz um ecossistema secundário (Python) em paralelo ao core em Node.js (Fastify).
  * Requer comunicação inter-processo e assíncrona robusta (via mensageria/RPC) entre o core em Node.js e o runtime em Python.
