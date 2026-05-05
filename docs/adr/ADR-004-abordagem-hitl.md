# ADR-004: Abordagem de Human-in-the-Loop (HITL) Obrigatório

## Contexto
O sistema AgentePro foi projetado para atuar no mundo real, enviando mensagens a clientes e executando deploys. Ações automatizadas sem supervisão podem causar danos graves de reputação à agência (ex: mensagens inadequadas, envio de propostas com valores não lucrativos).

## Opções Consideradas
1. **Totalmente Autônomo**: Agentes tomam decisão final sobre tudo após o setup. Alto risco.
2. **Supervisão Opcional**: O operador escolhe quais tarefas requerem HITL na criação do workflow.
3. **HITL Mandatório com Hard Timeout**: O sistema bloqueia hard-coded e de forma centralizada qualquer ação que envolva canais externos, requerendo intervenção do operador para aprovação dentro de uma janela de tempo.

## Decisão Tomada
Adotamos o **HITL Mandatório com Hard Timeout** (Padrão 60 minutos) como núcleo de segurança.

## Consequências
* **Positivas**:
  * Redução drástica de risco de marca (Brand Safety) para os operadores do sistema.
  * Agentes podem testar os limites do sistema sem medo de causar danos, pois existe uma rede de proteção humana.
* **Negativas**:
  * Adiciona latência e gargalo de aprovação humana no tempo total do fluxo de valor (Cycle Time).
  * Pode sobrecarregar o operador em cenários de alto volume (necessário otimizar as interfaces de aprovação UX).
