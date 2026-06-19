# SPEC-14: Service Catalog — Tipos de Serviço e Biblioteca de Skills

> Versão: 1.0.0 | Fase: 4 | Dependências: SPEC-02, SPEC-03, SPEC-13

---

## Escopo

- Enum `ServiceType` para categorizar o serviço a ser ofertado ao lead
- Fórmula de qualificação ajustada por `ServiceType` na prospecção
- Catálogo de skills pré-carregadas no sistema (skills builtin)
- Skills pré-carregadas espelham as capabilities usadas na construção do Hefesto:
  Caveman, ECC Code Quality, UI/UX Design Pro, Social Media Strategy,
  Traffic Manager, SEO Optimizer, HUASHU Analytics, Superpowers Workflow
- Sistema de templates de prompts para cada skill
- Sub-agentes especializados pré-definidos por tipo de serviço

---

## ServiceType Enum

```typescript
// packages/shared-types/src/service.types.ts

export type ServiceType =
  | "SITE_CREATION" // Criação de site profissional
  | "TRAFFIC_MANAGEMENT" // Gestão de tráfego (Google Ads, Meta Ads)
  | "SOCIAL_MEDIA" // Gestão de redes sociais
  | "FULL_DIGITAL"; // Pacote completo (os três acima)

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  SITE_CREATION: "Criação de Site",
  TRAFFIC_MANAGEMENT: "Gestão de Tráfego",
  SOCIAL_MEDIA: "Social Media",
  FULL_DIGITAL: "Full Digital (Completo)",
};
```

---

## Impacto na Fórmula de Qualification Score por ServiceType

```typescript
// domain/lead/LeadQualificationService.ts — substitui a fórmula única do SPEC-03

interface ScoringWeights {
  noWebsite: number;
  outdatedSite: number;
  mobileBroken: number;
  cnpjAtiva: number;
  yearsInBusiness: number;
  highRating: number; // >= 4.5
  goodRating: number; // >= 4.0
  okRating: number; // >= 3.5
  manyReviews: number; // >= 100
  someReviews: number; // >= 50
  fewReviews: number; // >= 10
}

const SCORING_WEIGHTS: Record<ServiceType, ScoringWeights> = {
  SITE_CREATION: {
    // Peso máximo em "não tem site" — lead mais quente para criação
    noWebsite: 35,
    outdatedSite: 25,
    mobileBroken: 18,
    cnpjAtiva: 20,
    yearsInBusiness: 10,
    highRating: 20,
    goodRating: 15,
    okRating: 8,
    manyReviews: 10,
    someReviews: 7,
    fewReviews: 3,
  },
  TRAFFIC_MANAGEMENT: {
    // Peso máximo em volume de avaliações — negócio ativo precisa de alcance
    noWebsite: 15,
    outdatedSite: 10,
    mobileBroken: 8,
    cnpjAtiva: 20,
    yearsInBusiness: 10,
    highRating: 25,
    goodRating: 20,
    okRating: 12,
    manyReviews: 25,
    someReviews: 18,
    fewReviews: 8,
  },
  SOCIAL_MEDIA: {
    // Peso em rating Google — bom negócio precisa de presença social
    noWebsite: 10,
    outdatedSite: 8,
    mobileBroken: 5,
    cnpjAtiva: 20,
    yearsInBusiness: 10,
    highRating: 30,
    goodRating: 25,
    okRating: 15,
    manyReviews: 20,
    someReviews: 14,
    fewReviews: 6,
  },
  FULL_DIGITAL: {
    // Pesos equilibrados — replica fórmula original SPEC-03
    noWebsite: 30,
    outdatedSite: 20,
    mobileBroken: 15,
    cnpjAtiva: 20,
    yearsInBusiness: 10,
    highRating: 25,
    goodRating: 20,
    okRating: 10,
    manyReviews: 15,
    someReviews: 10,
    fewReviews: 5,
  },
};

function calculateScore(
  place: GooglePlace,
  enrichment: EnrichmentData,
  serviceType: ServiceType,
): number {
  const w = SCORING_WEIGHTS[serviceType];
  let score = 0;

  if (!enrichment.hasWebsite) score += w.noWebsite;
  else if (enrichment.websiteQualityHint === "outdated")
    score += w.outdatedSite;
  else if (enrichment.websiteQualityHint === "mobile_broken")
    score += w.mobileBroken;

  if (enrichment.cnpjStatus === "ATIVA") score += w.cnpjAtiva;
  if ((enrichment.yearsInBusiness ?? 0) >= 2) score += w.yearsInBusiness;

  if ((place.rating ?? 0) >= 4.5) score += w.highRating;
  else if ((place.rating ?? 0) >= 4.0) score += w.goodRating;
  else if ((place.rating ?? 0) >= 3.5) score += w.okRating;

  if ((place.reviewsCount ?? 0) >= 100) score += w.manyReviews;
  else if ((place.reviewsCount ?? 0) >= 50) score += w.someReviews;
  else if ((place.reviewsCount ?? 0) >= 10) score += w.fewReviews;

  return Math.min(score, 100);
}
```

---

## Skills Pré-carregadas (Builtin — is_builtin = true)

Skills semeadas via migration. Não podem ser deletadas pelo usuário (retornam 403).
Ao adicionar ao agente, uma cópia (`is_builtin = false`) é criada — editável pelo usuário.
Cada skill `prompt_template` tem `systemPromptAddition` que é concatenado ao
system prompt do sub-agente ao qual for atribuída.

### 1. Caveman Workflow (slug: `caveman-workflow`)

```json
{
  "name": "Caveman Workflow",
  "slug": "caveman-workflow",
  "description": "Git workflow, versionamento e deploy. Segue Conventional Commits, feature branches, squash merges, CI/CD. Inclui git worktrees para tasks paralelas.",
  "skill_type": "prompt_template",
  "service_types": ["SITE_CREATION", "FULL_DIGITAL"],
  "persona_hints": ["BUILDER", "QA"],
  "config_template": {
    "systemPromptAddition": "Ao gerenciar código:\n- Siga Conventional Commits (feat/fix/chore/test/docs)\n- Use feature branches, nunca commite direto na main\n- Squash merge ao mesclar PRs\n- Use git worktrees para tasks paralelas\n- Valide CI antes de qualquer merge\n- Documente decisões não óbvias com comentário WHY, nunca WHAT"
  }
}
```

### 2. ECC Code Quality (slug: `ecc-code-quality`)

```json
{
  "name": "ECC Code Quality",
  "slug": "ecc-code-quality",
  "description": "Padrões de qualidade: Clean Architecture, Hexagonal, TDD, TypeScript strict, OWASP security. Sem 'any', sem console.log em produção.",
  "skill_type": "prompt_template",
  "service_types": ["SITE_CREATION", "FULL_DIGITAL"],
  "persona_hints": ["BUILDER", "QA"],
  "config_template": {
    "systemPromptAddition": "Ao escrever código:\n- TypeScript strict, nunca use 'any'\n- Clean Architecture: domain → application → infrastructure → http\n- TDD: RED→GREEN→REFACTOR, teste antes do código\n- Sem console.log, use logger estruturado com correlationId\n- Input validado com Zod em todas as boundaries\n- OWASP Top 10: sem SQL injection, XSS, SSRF"
  }
}
```

### 3. UI/UX Design Pro (slug: `ui-ux-design-pro`)

```json
{
  "name": "UI/UX Design Pro",
  "slug": "ui-ux-design-pro",
  "description": "Design de interfaces: princípios UX, sistema de cores, tipografia, acessibilidade WCAG 2.2, shadcn/ui, Tailwind CSS 4, mobile-first.",
  "skill_type": "prompt_template",
  "service_types": ["SITE_CREATION", "SOCIAL_MEDIA", "FULL_DIGITAL"],
  "persona_hints": ["BUILDER", "BRIEFING"],
  "config_template": {
    "systemPromptAddition": "Ao criar interfaces:\n- Mobile-first, depois desktop\n- Contraste mínimo WCAG AA (4.5:1 texto, 3:1 UI)\n- Sistema de design consistente: variáveis CSS, escala tipográfica\n- Componentes acessíveis: aria-labels, roles, keyboard nav\n- Performance: imagens WebP, lazy loading, CLS < 0.1\n- CTA deve ser o elemento mais visualmente proeminente"
  }
}
```

### 4. Social Media Strategy (slug: `social-media-strategy`)

```json
{
  "name": "Social Media Strategy",
  "slug": "social-media-strategy",
  "description": "Estratégia de redes sociais: calendário editorial, formatos por plataforma (Instagram, Facebook, TikTok), hashtags, engajamento, métricas.",
  "skill_type": "prompt_template",
  "service_types": ["SOCIAL_MEDIA", "FULL_DIGITAL"],
  "persona_hints": ["CLOSER", "BUILDER"],
  "config_template": {
    "systemPromptAddition": "Ao criar estratégia de social media:\n- Mapeie público-alvo antes de qualquer conteúdo\n- Instagram: 3-5 posts/semana, Reels têm 3x mais alcance\n- Calendário: 40% educativo, 30% entretenimento, 20% vendas, 10% UGC\n- 5-10 hashtags (mistura popular + nicho)\n- KPIs: taxa de engajamento > 3%, crescimento orgânico mensal"
  }
}
```

### 5. Traffic Manager (slug: `traffic-manager`)

```json
{
  "name": "Traffic Manager",
  "slug": "traffic-manager",
  "description": "Gestão de tráfego pago e orgânico: Google Ads, Meta Ads, UTM tracking, otimização de conversão, análise de ROI, retargeting.",
  "skill_type": "prompt_template",
  "service_types": ["TRAFFIC_MANAGEMENT", "FULL_DIGITAL"],
  "persona_hints": ["CLOSER", "BUILDER"],
  "config_template": {
    "systemPromptAddition": "Ao planejar tráfego:\n- Google Ads: Search > Display para conversão; use negative keywords\n- Meta Ads: segmentação por interesse + lookalike 1-2%\n- UTM em todos os links: source, medium, campaign\n- Budget mínimo R$30/dia para dados em 7 dias\n- ROAS alvo: >= 3x e-commerce, >= 5x leads\n- Teste A/B antes de escalar orçamento"
  }
}
```

### 6. SEO Optimizer (slug: `seo-optimizer`)

```json
{
  "name": "SEO Optimizer",
  "slug": "seo-optimizer",
  "description": "Otimização para buscadores: meta tags, schema markup, Core Web Vitals, sitemap, robots.txt, SEO local (Google Business Profile).",
  "skill_type": "prompt_template",
  "service_types": ["SITE_CREATION", "FULL_DIGITAL"],
  "persona_hints": ["BUILDER", "QA"],
  "config_template": {
    "systemPromptAddition": "Ao otimizar para SEO:\n- Title: 50-60 chars, palavra-chave no início\n- Meta description: 120-160 chars, unique por página\n- Schema markup: LocalBusiness, Product, FAQ conforme conteúdo\n- Core Web Vitals: LCP < 2.5s, CLS < 0.1\n- Google Business Profile completo, NAP consistente\n- H1 único por página, H2-H6 semântico"
  }
}
```

### 7. HUASHU Analytics (slug: `huashu-analytics`)

```json
{
  "name": "HUASHU Analytics",
  "slug": "huashu-analytics",
  "description": "Análise de dados, métricas de negócio, dashboards, KPIs, funil de conversão, cohort analysis, relatórios automatizados para clientes.",
  "skill_type": "prompt_template",
  "service_types": [
    "SITE_CREATION",
    "TRAFFIC_MANAGEMENT",
    "SOCIAL_MEDIA",
    "FULL_DIGITAL"
  ],
  "persona_hints": ["CLOSER", "QA"],
  "config_template": {
    "systemPromptAddition": "Ao analisar dados:\n- Defina KPIs antes de implementar tracking\n- Funil: Impressões → Cliques → Sessões → Leads → Conversões\n- Relatório semanal: GAP vs meta + 3 insights acionáveis\n- Anomaly detection: alerta se métrica cair > 20% vs semana anterior\n- Atribuição multi-toque linear como default\n- Data storytelling: número + contexto + próxima ação"
  }
}
```

### 8. Superpowers Workflow (slug: `superpowers-workflow`)

```json
{
  "name": "Superpowers Workflow",
  "slug": "superpowers-workflow",
  "description": "Metodologia de alta produtividade: spec-driven, brainstorming estruturado, planos de implementação, verificação antes de completar, iterações pequenas.",
  "skill_type": "prompt_template",
  "service_types": ["SITE_CREATION", "FULL_DIGITAL"],
  "persona_hints": ["BUILDER", "QA", "BRIEFING"],
  "config_template": {
    "systemPromptAddition": "Ao executar projetos:\n- Spec-driven: documente antes de implementar\n- Brainstorming: proponha 2-3 abordagens antes de decidir\n- TDD: RED→GREEN→REFACTOR\n- Verificação: teste no app real antes de marcar concluído\n- Iterações pequenas: 10 commits pequenos > 1 commit grande\n- Post-mortem: documente aprendizados após cada entrega"
  }
}
```

---

## Seeds SQL (Migration)

```sql
-- infrastructure/db/migrations/XXXX_seed_skill_catalog.sql
-- Executado após a criação da tabela skill_catalog (SPEC-13)

INSERT INTO skill_catalog (name, slug, description, skill_type, config_template, service_types, persona_hints, is_builtin)
VALUES
  ('Caveman Workflow',      'caveman-workflow',      'Git workflow e deploy',           'prompt_template', '{"systemPromptAddition":"..."}', ARRAY['SITE_CREATION','FULL_DIGITAL'],                                          ARRAY['BUILDER','QA'],           true),
  ('ECC Code Quality',      'ecc-code-quality',      'Clean arch, TDD, TypeScript',     'prompt_template', '{"systemPromptAddition":"..."}', ARRAY['SITE_CREATION','FULL_DIGITAL'],                                          ARRAY['BUILDER','QA'],           true),
  ('UI/UX Design Pro',      'ui-ux-design-pro',      'Design mobile-first, WCAG 2.2',   'prompt_template', '{"systemPromptAddition":"..."}', ARRAY['SITE_CREATION','SOCIAL_MEDIA','FULL_DIGITAL'],                           ARRAY['BUILDER','BRIEFING'],     true),
  ('Social Media Strategy', 'social-media-strategy', 'Calendário editorial e métricas', 'prompt_template', '{"systemPromptAddition":"..."}', ARRAY['SOCIAL_MEDIA','FULL_DIGITAL'],                                           ARRAY['CLOSER','BUILDER'],       true),
  ('Traffic Manager',       'traffic-manager',       'Google Ads, Meta Ads, UTM',       'prompt_template', '{"systemPromptAddition":"..."}', ARRAY['TRAFFIC_MANAGEMENT','FULL_DIGITAL'],                                     ARRAY['CLOSER','BUILDER'],       true),
  ('SEO Optimizer',         'seo-optimizer',         'Meta tags, schema, CWVs',         'prompt_template', '{"systemPromptAddition":"..."}', ARRAY['SITE_CREATION','FULL_DIGITAL'],                                          ARRAY['BUILDER','QA'],           true),
  ('HUASHU Analytics',      'huashu-analytics',      'KPIs, funil, relatórios',         'prompt_template', '{"systemPromptAddition":"..."}', ARRAY['SITE_CREATION','TRAFFIC_MANAGEMENT','SOCIAL_MEDIA','FULL_DIGITAL'],      ARRAY['CLOSER','QA'],            true),
  ('Superpowers Workflow',  'superpowers-workflow',  'Spec-driven, TDD, iterações',     'prompt_template', '{"systemPromptAddition":"..."}', ARRAY['SITE_CREATION','FULL_DIGITAL'],                                          ARRAY['BUILDER','QA','BRIEFING'],true)
ON CONFLICT (slug) DO NOTHING;
```

---

## Prospecting Config — Adição do ServiceType

```sql
-- Migração na tabela de configuração de prospecção
ALTER TABLE prospecting_configs
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'SITE_CREATION';
```

```typescript
// Extension da interface ProspectingConfig (domain/lead/ProspectingConfig.ts)
interface ProspectingConfig {
  // ...campos existentes de SPEC-03...
  serviceType: ServiceType; // NOVO — qual serviço será ofertado aos leads
}
```

---

## API — Endpoints

```
GET    /api/v1/service-types
  Response 200: { data: Array<{ value: ServiceType, label: string }> }

GET    /api/v1/skill-catalog
  Query: serviceType?, persona?, search?, limit?, cursor?
  Response 200: { data: SkillCatalogEntry[], meta: PaginationMeta }

PATCH  /api/v1/prospecting/config
  Body agora aceita: { ..., serviceType?: ServiceType }
  (extensão do endpoint existente — backward compatible)
```

---

## Testes Obrigatórios

```typescript
describe('calculateScore() com ServiceType') {
  it('SITE_CREATION: lead sem site recebe score máximo na dimensão digital (35)')
  it('TRAFFIC_MANAGEMENT: 200 reviews recebe score máximo de reviews (25)')
  it('SOCIAL_MEDIA: rating 4.8 recebe score máximo de reputação (30)')
  it('FULL_DIGITAL: comportamento igual à fórmula original SPEC-03')
  it('nunca excede 100 em nenhum ServiceType')
  it('nunca é negativo em nenhum ServiceType')
}

describe('Skill Catalog Seeds') {
  it('8 skills builtin existem no banco após migration')
  it('DELETE /api/v1/skill-catalog/:id retorna 403 para skill builtin')
  it('skill clonada para agente tem is_builtin=false (pode ser editada)')
  it('GET /skill-catalog?serviceType=SITE_CREATION retorna skills corretas')
  it('GET /skill-catalog?persona=BUILDER retorna skills com BUILDER em persona_hints')
}

describe('ProspectingConfig ServiceType') {
  it('PATCH /prospecting/config aceita serviceType=TRAFFIC_MANAGEMENT')
  it('PATCH /prospecting/config rejeita serviceType=INVALIDO (400)')
  it('GET /prospecting/config retorna serviceType atual')
  it('score usa weights do serviceType configurado (não hardcoded FULL_DIGITAL)')
}
```

---

## Critérios de Aceite

- [ ] Menu de prospecção tem campo "Serviço Alvo" com 4 opções (PT-BR)
- [ ] Fórmula de score aplicada com pesos por ServiceType (não mais fórmula única)
- [ ] 8 skills builtin semeadas via migration (ON CONFLICT DO NOTHING)
- [ ] Skills builtin visíveis na aba Skills do Capability Studio (SPEC-13)
- [ ] DELETE em skill builtin retorna 403 com mensagem clara
- [ ] Skill clonada ao agente: is_builtin=false, editável independentemente
- [ ] GET /api/v1/service-types retorna 4 tipos com labels em português
- [ ] Lead card na fila mostra "Serviço Sugerido" baseado na configuração ativa
