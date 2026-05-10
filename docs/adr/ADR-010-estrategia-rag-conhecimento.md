# ADR-010: Estratégia de RAG e gestão de conhecimento dos agentes

**Status:** Aceito  
**Data:** 2026-05-09  
**Deciders:** Arquiteto  
**Tags:** rag, chromadb, embeddings, knowledge, ollama, context7

---

## Contexto

Os agentes do AgentePro precisam de conhecimento especializado que vai além do
treinamento base dos LLMs:

- **Hunter**: critérios de qualificação de leads por nicho/região, histórico de
  leads convertidos, patterns de negócios sem site
- **Closer**: templates de proposta por segmento, histórico de objeções e respostas,
  tabela de preços atualizada, argumentos de vendas que funcionaram
- **Builder**: catálogo de templates, padrões OWASP, documentação de bibliotecas
  de animação, exemplos de código aprovados
- **QA**: checklist OWASP Top 10, critérios de Lighthouse, padrões de segurança

A questão é: qual tecnologia, como organizar as collections, e como manter o
conhecimento atualizado — incluindo custos de ferramentas que mudam com frequência.

---

## Decisão

**ChromaDB self-hosted como vector store principal, com nomic-embed-text via Ollama
para embeddings gratuitos. Context7 MCP como fonte complementar de documentação técnica.**

### Arquitetura RAG

```
Documento (PDF/MD/TXT)
        ↓
Chunking (RecursiveCharacterTextSplitter: 1000 chars, overlap 200)
        ↓
Embedding (nomic-embed-text via Ollama — gratuito, local)
        ↓
ChromaDB (coleção por agente, metadados estruturados)
        ↓
Query em runtime (top_k=5, threshold=0.7)
        ↓
Injeção no contexto do agente (via system prompt ou tool result)
```

### Collections por agente

```yaml
collections:

  hunter_knowledge:
    documents:
      - lead_qualification_criteria.md    # Critérios por nicho/segmento
      - conversion_patterns.md            # O que indica alto potencial
      - sector_analysis/                  # Um doc por setor (restaurante, clínica...)
    update_frequency: semanal (manual + auto via feedback loop)

  closer_knowledge:
    documents:
      - proposal_templates/               # Por tipo de serviço
      - objection_handling.md             # Objeções comuns + respostas
      - pricing_table.md                  # Atualizado pelo PriceCrawler
      - success_stories.md                # Casos de sucesso reais (anonimizados)
    update_frequency: pricing_table diário; resto semanal

  builder_knowledge:
    documents:
      - templates/                        # Documentação de cada template
      - owasp_top10_2025.md
      - framer_motion_patterns.md
      - tailwind_conventions.md
      - next15_best_practices.md
      - wcag21_checklist.md
    update_frequency: mensal ou por release de biblioteca

  qa_knowledge:
    documents:
      - owasp_asvs_v4.md
      - lighthouse_optimization.md
      - security_headers_reference.md
      - common_vulnerabilities.md
    update_frequency: trimestral

  pricing_intelligence:
    documents:
      - tool_costs_current.json           # Atualizado pelo PriceCrawler
      - historical_costs/                 # Histórico de variação de preços
    update_frequency: semanal (automático)
```

### PriceCrawler — atualização automática de custos

Job agendado (todo domingo às 03:00) que mantém `pricing_intelligence` atualizada:

```typescript
class PriceCrawler {
  private readonly SOURCES = [
    { name: 'anthropic', url: 'https://anthropic.com/pricing',    selector: '.pricing-table' },
    { name: 'openai',    url: 'https://platform.openai.com/pricing', selector: '.pricing-table' },
    { name: 'groq',      url: 'https://groq.com/pricing',         selector: '.pricing-table' },
    { name: 'vercel',    url: 'https://vercel.com/pricing',        selector: '.plan-features' },
    { name: 'mercadopago', url: 'https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/sales-processing/fees', selector: 'table' },
  ]

  async crawl(): Promise<CrawlResult> {
    const results = await Promise.allSettled(
      this.SOURCES.map(s => this.scrapeWithFallback(s))
    )
    // Falhas individuais não bloqueiam o job — usa cache
    // Se todos falham → alerta operador via Telegram
    return this.mergWithCache(results)
  }
}
```

### Context7 MCP — documentação técnica complementar

Context7 é usado pelo Builder e QA para consultar documentação técnica atualizada
de bibliotecas (não páginas de pricing):

```
Casos de uso do Context7 no AgentePro:
  ✓ "Como configurar CSP no Next.js 15?" → Builder consulta docs do Next.js
  ✓ "API do Framer Motion 12 para scroll triggers" → Builder consulta docs do Framer
  ✓ "Parâmetros atuais da Vercel API para deploy" → Builder consulta docs da Vercel
  ✓ "Google Ads API v16 — criar campanha" → Futuro agente de tráfego

  ✗ "Quanto custa o Claude Sonnet?" → PriceCrawler, não Context7
  ✗ "Qual o melhor template para restaurante?" → RAG interno (builder_knowledge)
```

### Feedback Loop — melhoria contínua do RAG

```
Venda fechada (DomainEvent: DealClosed)
          ↓
Extrai: nicho do lead, abordagem usada, objeções, preço final
          ↓
Adiciona à collection closer_knowledge (chunk anônimo)
          ↓
Dreaming (Managed Agents) consolida patterns cross-session
          ↓
Hunter e Closer ficam melhores automaticamente ao longo do tempo
```

---

## Alternativas consideradas

### Pinecone (cloud vector store)
- **Descartado** — free tier muito limitado (1 index, 100k vectors); ChromaDB
  self-hosted oferece ilimitado gratuitamente

### OpenAI text-embedding-3-small
- **Descartado para MVP** — custo por embedding ($0,02/1M tokens) se acumula;
  nomic-embed-text via Ollama é gratuito e qualidade comparável para pt-BR

### Weaviate
- **Considerado** — mais features que ChromaDB; descartado por complexidade de
  setup maior sem ganho proporcional no MVP

### LlamaIndex como framework RAG
- **Considerado** — abstração rica; descartado em favor de LangChain que o time
  já conhece e que tem melhor integração com CrewAI/Managed Agents

---

## Consequências

### Positivas
- Embeddings gratuitos via Ollama eliminam custo recorrente de embedding
- ChromaDB roda na mesma VM Oracle Cloud que o Ollama — sem latência de rede
- Feedback loop automático melhora RAG com cada venda real
- Context7 mantém documentação técnica do Builder sempre atualizada

### Negativas
- ChromaDB não tem UI visual nativa — monitoramento via script ou Chroma UI (terceiro)
- nomic-embed-text é menor que text-embedding-3-large — qualidade ligeiramente inferior
  em consultas muito específicas
- PriceCrawler quebra quando sites de pricing mudam layout — manutenção periódica necessária

### Plano de fallback
- Se ChromaDB cair: agentes funcionam sem RAG (degradação graceful) com alerta ao operador
- Se PriceCrawler falhar: usa último cache válido, alerta operador via Telegram
- Backup semanal da pasta ChromaDB para Oracle Object Storage (gratuito 20 GB)
