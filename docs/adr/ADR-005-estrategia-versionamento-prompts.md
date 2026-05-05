# ADR-005: Estratégia de Versionamento de Prompts (Prompt-as-Code)

## Contexto
O comportamento dos agentes no CrewAI e LiteLLM é governado primordialmente pelos *System Prompts*. Alterações nesses prompts podem ter efeitos colaterais drásticos. Tratar prompts como "configuração de banco de dados" impede auditoria clara e rollback seguro.

## Opções Consideradas
1. **Prompts no Banco de Dados**: Fácil edição pelo usuário na UI, mas complexo para garantir controle de versão e revisão de pares (PR).
2. **Prompts Hard-coded no Código Fonte**: Difícil para operadores alterarem, requer um ciclo de deploy completo.
3. **Prompts como Artefatos Versionados (Prompt-as-Code)**: Os prompts iniciais são arquivos `.md` versionados via Git (`docs/agents/prompts/`), que podem ser importados/sincronizados pela UI.

## Decisão Tomada
Adotamos a estratégia **Prompt-as-Code** combinada com **Git-Versioning** para a fundação. Os prompts *baseline* são arquivos de texto versionados em repositório (Git).

## Consequências
* **Positivas**:
  * Rastreabilidade total sobre mudanças de comportamento.
  * Testes E2E podem ser atrelados a versões específicas do prompt.
  * Revisão de pares para cada mudança de lógica linguística.
* **Negativas**:
  * Operadores do sistema que desejam *fine-tuning* precisarão utilizar o Editor na UI, o que cria um "fork" do prompt versionado, exigindo lógica para gerenciar prompts "default" vs "customizados" no banco de dados.
