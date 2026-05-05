# ADR-003: Adoção do Padrão CQRS (Command Query Responsibility Segregation)

## Contexto
O AgentePro precisa de uma arquitetura escalável e clara para lidar com lógicas de negócio complexas (execução de comandos do operador/agentes) separadamente da leitura intensiva de dados (CRM, dashboards, históricos de auditoria).

## Opções Consideradas
1. **Arquitetura em Camadas Tradicional (Controller -> Service -> Repository)**: Abordagem padrão CRUD.
2. **CQRS**: Separação física ou lógica entre modelos de leitura (Queries) e modelos de escrita (Commands).

## Decisão Tomada
Decidimos adotar **CQRS (Logical Separation)** na Application Layer.

## Consequências
* **Positivas**:
  * O código que altera o estado do sistema (ex: qualificar lead, debitar tokens) fica isolado, permitindo validações rigorosas e testes focados nas regras de negócio (Domain).
  * As rotas de leitura (queries) podem contornar o domínio e acessar o banco diretamente ou via projeções otimizadas, garantindo alta performance para dashboards de CRM.
  * Facilita a implementação do padrão *Event-Driven* em conjunto (ex: Command gera um Domain Event).
* **Negativas**:
  * Maior número de classes e boilerplate inicial (handlers, commands, queries).
  * Risco de "Over-engineering" se aplicado em domínios puramente anêmicos de CRUD (o que tentaremos evitar limitando o CQRS a Bounded Contexts core).
