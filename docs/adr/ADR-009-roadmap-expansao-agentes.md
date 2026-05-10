# ADR-009: Roadmap de expansão — agentes especializados pós-MVP

**Status:** Aceito (roadmap) 🗺️
**Data:** 2026-05-09  
**Deciders:** Produto, Arquiteto  
**Tags:** tráfego-pago, social-media, seo, analytics, roadmap, mcps

---

## Contexto

O operador identificou interesse em expandir o sistema para outros serviços além de sites:
tráfego pago (Google Ads, Meta Ads), social media, SEO e analytics. A questão é quais
expandir primeiro, em que ordem, e quais os requisitos de segurança e HITL específicos
de cada um.

Cada serviço novo introduz novos riscos — em particular, tráfego pago envolve gestão
de budget financeiro real de clientes, o que exige controles muito mais rígidos.

---

## Decisão

**Expansão faseada baseada em perfil de risco, com bounded contexts independentes.**

### Matriz de risco × valor × viabilidade técnica

| Agente | Risco | Valor para cliente | API disponível | Fase |
|--------|-------|-------------------|----------------|------|
| SEO | Baixo | Alto (recorrência) | Google Search Console (gratuita) | v2 |
| Analytics | Muito baixo | Alto (relatórios) | GA4 API (gratuita) | v2 |
| Social Media | Médio | Alto | Meta Graph API | v3 |
| Tráfego Pago | Alto | Muito alto | Google Ads + Meta Ads API | v4 |

---

### Agente SEO — Fase v2 (recomendado imediato pós-MVP)

**Por que primeiro:** Complemento natural ao Builder (sites entregues já têm GA4).
Risco baixo (pior cenário: conteúdo ruim, reversível). Alto valor percebido (relatórios
de ranking são visualmente impactantes para clientes).

**MCPs e integrações:**
```yaml
skills:
  - google_search_console:   # Leitura de indexação, clicks, impressões
      api: Google Search Console API v3 (OAuth 2.0)
      scope: webmasters.readonly
  - analytics_reader:        # Comportamento de usuários
      api: Google Analytics Data API v1 (GA4)
      scope: analytics.readonly
  - content_generator:       # Artigos SEO, meta tags, alt texts
      llm: claude-sonnet-4-6
      rag_collection: seo_best_practices
  - competitor_analyzer:     # Análise de SERPs, concorrentes
      engine: searxng_local   # Self-hosted, sem rastreadores externos
```

**HITL:** Aprovação antes de publicar qualquer conteúdo novo. Alterações técnicas
(meta tags, estrutura de URLs) aprovadas pelo operador antes de aplicar.

**Modelo de cobrança:** R$ 397–897/mês (inclui relatório mensal + otimizações contínuas).

---

### Agente Analytics — Fase v2

**Por que junto ao SEO:** Dependência natural — relatórios de analytics complementam
relatórios de SEO. Zero risco (apenas leitura de dados).

**MCPs e integrações:**
```yaml
skills:
  - ga4_reader:
      api: Google Analytics Data API v1
  - looker_studio:            # Embedding de dashboards
      api: Looker Studio API (read-only)
  - report_generator:
      output: pdf/html
      llm: claude-haiku-4-5   # Haiku suficiente para relatórios simples
```

**HITL:** Apenas para alterações de configuração de tracking (instalação de pixel novo).
Geração e envio de relatórios: autônomo.

**Modelo de cobrança:** Bundle com outros serviços OU R$ 197/mês standalone.

**Upsell natural:** Todo cliente que comprou site tem GA4 instalado pelo Builder.
Oferta automática do Closer após 30 dias da entrega do site.

---

### Agente Social Media — Fase v3

**Por que depois:** Risco de imagem médio — post inadequado é público e imediato.
Requer HITL de dois níveis: operador aprova, idealmente cliente também aprova.

**MCPs e integrações:**
```yaml
skills:
  - meta_graph_api:           # Instagram + Facebook
      api: Meta Graph API v19
      permissions: [pages_manage_posts, instagram_basic, instagram_content_publish]
  - scheduler:                # Agendamento multi-plataforma
      tool: buffer_api         # Buffer tem API gratuita limitada
  - image_generator:
      primary: stable_diffusion_local   # Self-hosted, custo zero
      fallback: canva_api               # Canva free tier
  - content_calendar:
      storage: postgresql
```

**HITL obrigatório — regra inviolável:**
```
Agente gera post (texto + imagem)
          ↓
HITL-1: Operador aprova conteúdo
          ↓
HITL-2 (opcional): Cliente aprova via link de preview
          ↓
Agendamento → Publicação automática no horário
```

**Nunca publicar sem aprovação.** Um post mal posicionado pode destruir a reputação
de um negócio em horas. O agente sugere, humanos aprovam.

**Modelo de cobrança:** R$ 297–697/mês por gestão de perfis (inclui X posts/semana
definidos no contrato).

---

### Agente Tráfego Pago — Fase v4

**Por que por último:** Risco financeiro direto ao cliente. Um bug pode zerar o budget
em minutos. Requer controles de HITL financeiro que precisam ser maduros.

**APIs:**
```yaml
google_ads_api:
  version: v16
  auth: OAuth 2.0 (conta do cliente, não do operador)
  note: Requer Developer Token aprovado pelo Google

meta_marketing_api:
  version: v19
  auth: User Access Token (Business Manager do cliente)
  note: Requer App Review para permissões de gestão de ads
```

**Pré-requisitos antes de implementar:**
- Sistema de HITL financeiro maduro (6+ meses em produção)
- Teto de gasto configurável e imponível tecnicamente (não apenas por contrato)
- Monitoramento de spend em tempo real com alertas automáticos
- Seguro ou garantia contratual clara sobre responsabilidade por gastos indevidos

**HITL financeiro — regras específicas:**
```typescript
const TRAFFIC_HITL_RULES = {
  // Nunca expira — aprovação manual obrigatória sempre
  CREATE_CAMPAIGN:       { requiresHITL: true, timeout: null },
  ACTIVATE_CAMPAIGN:     { requiresHITL: true, timeout: null },
  INCREASE_BUDGET:       { requiresHITL: true, timeout: null },
  // Relatórios e análises: autônomos
  READ_PERFORMANCE:      { requiresHITL: false },
  GENERATE_REPORT:       { requiresHITL: false },
  // Pausar campanha: autônomo (ação de proteção)
  PAUSE_CAMPAIGN:        { requiresHITL: false },
}

// Teto de gasto diário — bloqueio técnico no adapter, não apenas no prompt
class GoogleAdsAdapter {
  async adjustBudget(campaignId: string, newBudget: Money): Promise<void> {
    const maxAllowed = await this.getBudgetCap(campaignId) // do banco, não do prompt
    if (newBudget.greaterThan(maxAllowed)) {
      throw new BudgetCapExceededError(`Teto de ${maxAllowed} excedido`)
    }
    // ...
  }
}
```

**Modelo de cobrança:** 10–15% do spend gerenciado (padrão de mercado) + fee de setup.

---

## Princípios de extensibilidade

Cada novo agente é adicionado como bounded context independente:
```
src/domain/seo/          # SEO context
src/domain/social/       # Social Media context  
src/domain/traffic/      # Traffic context
src/domain/analytics/    # Analytics context
```

Comunicação com contexts existentes exclusivamente via Domain Events. O CRM (context
de Memory) recebe eventos de todos os contexts para consolidar histórico do cliente.

---

## Consequências

### Positivas
- Faseamento por risco protege o operador de exposição prematura a riscos altos
- Cada bounded context é deployável e testável independentemente
- Upsells naturais entre serviços: site → SEO → analytics → social → tráfego
- MRR cresce com cada serviço adicionado sem substituir os anteriores

### Negativas
- Tráfego pago na v4 significa ~6–12 meses para estar disponível
- Google Ads Developer Token requer aprovação manual do Google (processo burocrático)
- Meta App Review para permissões de ads pode levar semanas

---

## Critérios de avanço de fase

- **v2 (SEO + Analytics):** MVP em produção com ≥ 5 clientes entregues
- **v3 (Social Media):** v2 estável por 60 dias, HITL com < 5% taxa de rejeição por erro
- **v4 (Tráfego Pago):** v3 estável, HITL financeiro testado extensivamente, consultoria jurídica sobre responsabilidade
