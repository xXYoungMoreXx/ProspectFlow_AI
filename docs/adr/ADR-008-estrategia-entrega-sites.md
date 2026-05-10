# ADR-008: Estratégia de entrega de sites — Builder Agent

**Status:** Aceito  
**Data:** 2026-05-09  
**Deciders:** Arquiteto, Produto  
**Tags:** builder, sites, animação, templates, framer-motion, figma, remotion

---

## Contexto

O agente Builder precisa entregar sites profissionais de forma autônoma, com qualidade
consistente, segurança (OWASP), performance (Lighthouse ≥ 85) e diferencial visual
(animações, design moderno). Dois riscos opostos precisam ser balanceados:

- **Risco de qualidade baixa**: LLM gerando código livre pode produzir sites inconsistentes,
  inseguros ou lentos — danifica a reputação do operador
- **Risco de over-engineering**: integrar múltiplas ferramentas de design/animação antes
  de validar o mercado desperdiça tempo de desenvolvimento

A pergunta central: **templates curados vs geração livre de código?**

---

## Decisão

**Templates curados como fundação obrigatória; geração livre de código somente para
customização dentro dos templates.**

### Princípio: o Builder escolhe e adapta, nunca inventa

O Builder não gera sites do zero. Ele:
1. Seleciona o template mais adequado via RAG (ChromaDB com metadados dos templates)
2. Customiza cores, tipografia, textos, imagens dentro do template
3. Adiciona componentes animados de uma biblioteca aprovada
4. Valida com o QA Agent antes de qualquer preview

### Catálogo de templates do MVP (5 templates)

Todos em Next.js 15 + Tailwind CSS 4 + TypeScript. Todos com:
- Lighthouse baseline ≥ 90 performance, 100 acessibilidade
- Security headers pré-configurados (CSP, HSTS, X-Frame-Options)
- WCAG 2.1 AA compliance
- SEO básico (meta tags, OG tags, schema.org, sitemap, robots.txt)
- `prefers-reduced-motion` respeitado em todas as animações

```
templates/
  T001-landing-page/         # 1 página, conversão, CTA
  T002-institucional-5p/     # 5 páginas, empresa, contato
  T003-blog-portfolio/       # Blog + portfólio com MDX
  T004-ecommerce-basico/     # Catálogo + Stripe
  T005-portfolio-criativo/   # Animações pesadas, Framer Motion
```

### Estratégia de animações — 3 tiers

**Tier 1 — MVP (obrigatório em todos os templates):**
- CSS animations nativas (transform, opacity — GPU-accelerated)
- Framer Motion: scroll-triggered reveals, page transitions, hover states
- Custo: zero. LLM tem conhecimento excelente de Framer Motion

**Tier 2 — Premium v2 (upsell R$ 300–500 adicional):**
- GSAP ScrollTrigger: animações de timeline complexas
- Remotion: hero video gerado a partir de componentes React (renderizado no servidor)
- Integração Figma: cliente fornece arquivo Figma → Builder extrai tokens via API

**Tier 3 — Ultra Premium v3:**
- Google Veo 2 (Vertex AI): background videos cinematográficos gerados por IA
- Three.js: elementos 3D interativos no hero
- Custo de geração repassado ao cliente (Veo: ~R$ 4–8 por 10s de vídeo)

### Integração Figma (Tier 2)

```typescript
class FigmaAdapter implements DesignSourceProvider {
  // Extrai: tokens (cores, tipografia, espaçamentos), assets, estrutura de layout
  async extractDesignTokens(fileUrl: string, token: string): Promise<DesignTokens> {
    // Valida URL contra allowlist: apenas figma.com
    await validateExternalUrl(fileUrl, ['figma.com'])
    const fileKey = this.extractFileKey(fileUrl)
    return this.figmaClient.getFileTokens(fileKey)
  }
}
```

**Pencil (Evolus) descartado:** sem API programática — integração impossível sem OCR frágil.

**Google Stitch descartado no MVP:** API instável em mai/2026 — risco de quebra alto.

### Pipeline de qualidade obrigatório antes de qualquer deploy

```
Builder gera código
       ↓
QA Agent: OWASP scan (XSS, open redirect, CSP válido)
       ↓
QA Agent: Lighthouse audit (perf ≥ 80, a11y = 100, SEO ≥ 90)
       ↓
QA Agent: HTML W3C validation
       ↓                    ↓
Score OK             Score abaixo do threshold
       ↓                    ↓
Gerar preview URL    Loop de correção (max 3 tentativas)
       ↓                    ↓ (se 3 falhas)
HITL: operador       Escalar para operador com relatório
aprova preview
       ↓
HITL: operador confirma deploy produção
       ↓
Deploy (Vercel/Netlify) + registro no CRM
```

### Seleção de template via RAG

```typescript
// ChromaDB collection: site_templates
// Metadados indexados: serviceType, pageCount, hasEcommerce, hasBlog,
//                      animationLevel, complexity, Lighthouse scores
async function selectTemplate(briefing: ClientBriefing): Promise<Template> {
  const results = await chromaDB.query({
    collection: 'site_templates',
    queryText: briefing.toNaturalLanguage(),
    nResults: 3,
    where: {
      status: 'approved',
      service_type: briefing.serviceType,
    }
  })
  // LLM escolhe entre os top 3 baseado no briefing completo
  return this.llm.selectBest(results, briefing)
}
```

---

## Consequências

### Positivas
- Qualidade consistente: templates aprovados têm scores de Lighthouse conhecidos
- Segurança: security headers já no template — QA confirma que não foram removidos
- Velocidade de entrega: customizar um template é muito mais rápido que gerar do zero
- Diferencial visual: Framer Motion em todos os sites já supera 95% dos concorrentes

### Negativas
- Limitação criativa: clientes com briefings muito específicos podem perceber o template
- Catálogo precisa de manutenção: templates desatualizam com versões do Next.js/Tailwind
- Tier 2 e 3 adicionam complexidade operacional (Remotion requer Node.js no servidor)

### Mitigações
- Catálogo de 5 templates cobre 90% dos casos do mercado de pequenos negócios
- Versionamento semântico dos templates: templates/ → template_v1/, template_v2/
- Remotion renderiza como worker assíncrono — não bloqueia o Builder

---

## Notas sobre vibe coding

O CLAUDE.md instrui o Builder a:
- "Sempre selecionar um template do catálogo via RAG antes de qualquer geração de código"
- "Nunca usar inline styles — apenas classes Tailwind"
- "Nunca remover headers de segurança do next.config.js"
- "Sempre incluir prefers-reduced-motion em animações CSS e Framer Motion"

---

## 📋 Status de Implementação (2026-05-09)

**Implementação:** Planejada — **Fase 13** do `task.md`

| Componente | Status |
|-----------|--------|
| `packages/templates/T001-T005` (5 templates) | ⏳ Pendente — Fase 13.1 |
| `DeploymentRouter` + VercelAdapter + NetlifyAdapter | ⏳ Pendente — Fase 13.2 |
| ChromaDB `builder_knowledge` seeding script | ⏳ Pendente — Fase 13.3 |
| `site_generator.py` com RAG de template | ⏳ Pendente — Fase 13.3 |
