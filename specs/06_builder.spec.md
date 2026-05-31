# SPEC-06: Builder Agent — Desenvolvimento do Site

> Versão: 2.0.0 | Fase: 2 | Dependências: SPEC-05 (Briefing), SPEC-10 (Media)

## Responsabilidade

Transformar um briefing aprovado em um site completo, funcional e acessível.
SEMPRE gerar mockup visual antes de qualquer linha de código.

## Ordem de Execução dos Sub-agentes

```
BriefingApproved event recebido
│
├─ PARALELO (grupo 1):
│   ├─ COPYWRITER    (Sonnet 4.6)  — textos de todas as páginas
│   ├─ DESIGNER      (Opus 4.7)   — mockup HTML via Claude Design
│   └─ IMAGER        (NanaBanana) — 6–8 imagens
│
├─ HITL: operador aprova mockup
│
├─ CODER (Opus 4.8) — código Next.js com todos os assets
│
├─ PARALELO (grupo 2):
│   ├─ SEO_OPTIMIZER  (Haiku 4.5) — meta tags, schema.org
│   └─ DEPLOYER       (Haiku 4.5) — staging deploy
│
├─ HITL: operador aprova preview staging
└─ Deploy produção
```

## Copywriter Sub-agent Output

```typescript
interface SiteTexts {
  pages: {
    [pageName: string]: {
      headline: string;      // até 10 palavras
      subheadline: string;   // até 20 palavras
      body: string;          // 3–4 parágrafos
      cta: string;           // call-to-action do botão
      metaDescription: string; // até 160 chars, SEO
    };
  };
  globalElements: {
    headerTagline: string;
    footerSlogan: string;
    whatsappMessage: string;  // mensagem pré-preenchida no WA
  };
}
```

## Designer Sub-agent — Claude Design via Opus 4.7

```typescript
const DESIGN_SYSTEM_PROMPT = `
Você é um designer web senior especializado em sites para pequenos negócios brasileiros.
Crie um mockup HTML/CSS completo e autocontido representando o visual final do site.
Use as cores, fontes e estilo especificados no briefing.
O HTML deve ser renderizável diretamente no browser sem dependências externas.
Inclua: header, hero, services, about, testimonials, footer, WhatsApp button.
`;
```

## Coder Sub-agent — Next.js 15 + Tailwind 4

```typescript
// Arquivos obrigatórios gerados pelo CODER:
const REQUIRED_FILES = [
  'pages/index.tsx',
  'pages/sobre.tsx',
  'pages/servicos.tsx',
  'pages/contato.tsx',
  'components/Header.tsx',
  'components/Footer.tsx',
  'components/WhatsAppButton.tsx',
  'components/SEOHead.tsx',
  'public/robots.txt',
  'public/sitemap.xml',
  'next.config.js',          // com security headers
];

// Security headers obrigatórios em next.config.js:
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
  { key: 'X-XSS-Protection',          value: '0' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
];
```

## Deploy Platforms

```typescript
const PLATFORM_CONFIG = {
  vercel:           { free: true, framework: 'nextjs', cdn: 'global' },
  cloudflare_pages: { free: true, framework: 'static', cdn: 'edge-200-cities' },
  render:           { free: true, framework: 'static', cdn: 'us-east' },
  hostinger:        { free: false, framework: 'any',    cdn: 'limited' },
  netlify:          { free: true, framework: 'static', cdn: 'global' },
};

// Default: vercel
// Fallback: cloudflare_pages (melhor free tier)
```

## Testes Python

```python
def test_copywriter_generates_all_pages()
def test_designer_generates_valid_html()
def test_imager_generates_8_images_for_site()
def test_parallel_group_1_runs_simultaneously()
def test_coder_waits_for_parallel_group_1()
def test_seo_and_deployer_run_simultaneously()
def test_mockup_hitl_blocks_coder()
def test_staging_hitl_blocks_production_deploy()
def test_lighthouse_score_above_85_on_generated_site()
```

## Critérios de Aceite

- [ ] COPYWRITER, DESIGNER e IMAGER iniciam simultaneamente (verificar logs)
- [ ] CODER só inicia APÓS mockup aprovado pelo operador via HITL
- [ ] Site gerado passa Lighthouse: performance >= 85, a11y = 100
- [ ] Security headers presentes em todas as respostas do Next.js
- [ ] Imagens convertidas para WebP com lazy loading
- [ ] robots.txt e sitemap.xml gerados automaticamente
- [ ] Deploy staging funciona antes de produção
