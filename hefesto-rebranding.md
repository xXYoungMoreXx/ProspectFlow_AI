# Task: Rebranding ProspectFlow → Hefesto

## Status: PENDING

---

## Context

### O que é o projeto?

**ProspectFlow** (candidato a renomear) é uma automação open source de geração de renda passiva com IA. O sistema prospecta clientes autonomamente, faz contato, fecha vendas oferecendo serviços (sites, tráfego pago, social media), executa e entrega o serviço — tudo automatizado, com a opção de intervenção manual do usuário em qualquer etapa (human-in-the-loop).

### Por que o rebranding?

O nome atual é genérico e não cria identidade de marca. O novo nome **Hefesto** carrega um universo narrativo completo: o deus ferreiro da mitologia grega forjava autômatos de ouro que trabalhavam sozinhos. É a metáfora perfeita para o produto: _você acende a forja, os autômatos cuidam do resto._

### Narrativa central (imutável durante o rebranding)

> "Você é o artífice. Os agentes são seus autômatos. A forja nunca para."

### Decisões já tomadas

- Nome final: **Hefesto**
- Não renomear para AgentePro (genérico e saturado no mercado)
- Modelo de negócio: open-core (núcleo open source + tiers pagos)
- Mecânica pay-to-win = "poder de forja" — mais tier = mais autômatos simultâneos
- Componentes internos nomeados dentro do mito:
  - Agentes de IA → **Autômatos**
  - Motor de processamento → **A Fornalha**
  - Painel de controle → **A Bigorna**
  - Intervenção manual → **A Mão do Artífice**

---

## Decisões Técnicas

- [ ] Confirmar: o rename do repositório GitHub é de `prospectflow` para `hefesto`
- [ ] Confirmar: domínio alvo é `hefesto.dev` ou `hefesto.app` ou outro — **verificar disponibilidade antes de executar**
- [ ] Confirmar: manter histórico de commits intacto no rename do repo
- [ ] Confirmar: variáveis de ambiente, configs e strings internas que referenciam "ProspectFlow" serão substituídas em lote

---

## Identidade Visual

### Paleta

| Token           | Valor sugerido | Uso                             |
| --------------- | -------------- | ------------------------------- |
| `--forge-black` | `#0D0D0D`      | Background principal            |
| `--ember`       | `#C84B11`      | CTA, destaques, ícones de ação  |
| `--bronze`      | `#A0622A`      | Elementos secundários, bordas   |
| `--gold`        | `#D4A017`      | Títulos premium, badges de tier |
| `--smoke`       | `#2A2A2A`      | Superfícies de card             |
| `--ash`         | `#8A8A8A`      | Texto auxiliar                  |

### Tipografia

- Display / headlines: serifada ou slab-serif com peso alto (ex: Playfair Display Bold, ou Bitter ExtraBold)
- UI / corpo: sans-serif limpa (ex: Inter, DM Sans)
- Código: monospace padrão (Fira Code / JetBrains Mono)

### Iconografia

- Bigorna, martelo, fagulha/brasa como elementos visuais recorrentes
- Evitar robôs genéricos — preferir formas míticas/artesanais

### Tom de voz

- Confiante, mítico, técnico sem ser frio
- Nunca prometer "enriquecimento rápido" — posicionar como _poder de automação_
- Voz em 1ª pessoa do produto: "A Fornalha processa. Os Autômatos agem. Você colhe."

---

## Plano de Implementação

### FASE 1 — Repositório e Código

- [ ] **1.1** Renomear repositório GitHub de `prospectflow` para `hefesto`
      → Verificar: URL do repo redireciona corretamente; clonar e confirmar

- [ ] **1.2** Busca global por string `"ProspectFlow"` (case-insensitive) em todo o codebase
      → Verificar: zero ocorrências após substituição (`grep -ri "prospectflow" .`)

- [ ] **1.3** Substituir todas as ocorrências por `"Hefesto"` (mantendo a capitalização correta: `Hefesto`, `HEFESTO`, `hefesto` conforme contexto)
      → Verificar: nenhuma string antiga em arquivos `.js`, `.ts`, `.py`, `.env.example`, `*.md`, `*.json`

- [ ] **1.4** Renomear variáveis de ambiente relacionadas ao projeto (ex: `PROSPECTFLOW_API_KEY` → `HEFESTO_API_KEY`)
      → Verificar: atualizar `.env.example`, documentação e qualquer CI/CD referenciando as vars

- [ ] **1.5** Atualizar `package.json` / `pyproject.toml` / arquivo de manifesto principal:
  - `name`: `"hefesto"`
  - `description`: conforme narrativa central
  - `homepage`, `repository.url`: novo repo
    → Verificar: `npm pkg get name` (ou equivalente) retorna `"hefesto"`

- [ ] **1.6** Renomear componentes internos no código para refletir a nomenclatura mítica:
  - Classes/módulos de agentes → `Automaton` / `AutomatonAgent`
  - Motor de execução → `Furnace`
  - Painel/dashboard → `Anvil`
  - Hook de intervenção humana → `ArtificerIntervention`
    → Verificar: nomes novos consistentes em toda a codebase; sem aliases quebrados

---

### FASE 2 — README e Documentação

- [ ] **2.1** Reescrever `README.md` completo com a narrativa da Forja:
  - Hero: tagline principal + GIF/vídeo demo de um Autômato fechando uma venda
  - Seção "O que é a Forja?" — explicação do produto dentro do universo mítico
  - Seção "Como funciona" — fluxo: Prospecção → Contato → Fechamento → Entrega → (opcional) Mão do Artífice
  - Seção "Tiers de poder" — tabela de planos (open source vs pagos)
  - Seção "Quickstart" — setup em menos de 5 passos
  - Seção "Conformidade" — LGPD, anti-spam, outreach ético
    → Verificar: README renderiza corretamente no GitHub; todos os links funcionam

- [ ] **2.2** Criar `ARCHITECTURE.md` com mapa dos componentes usando os nomes míticos:
  - Diagrama da Fornalha, Autômatos, Bigorna e Mão do Artífice
    → Verificar: diagrama legível, nomes consistentes com o código

- [ ] **2.3** Atualizar (ou criar) `CONTRIBUTING.md` com tom alinhado à identidade Hefesto
      → Verificar: link no README aponta para o arquivo correto

- [ ] **2.4** Criar `BRAND.md` na raiz — guia de identidade de marca para contribuidores:
  - Paleta, tipografia, nomenclatura interna, tom de voz, o que evitar
    → Verificar: arquivo existe e cobre todos os tokens definidos nesta spec

---

### FASE 3 — Presença Digital

- [ ] **3.1** Registrar domínio (verificar disponibilidade nesta ordem preferencial):
  1. `hefesto.dev`
  2. `hefesto.app`
  3. `usehefesto.com`
     → Verificar: DNS configurado, HTTPS ativo

- [ ] **3.2** Criar landing page minimalista (pode ser GitHub Pages ou Vercel inicialmente):
  - Headline com tagline principal
  - Demo ou GIF de 15-30s
  - Campo de e-mail para waitlist
  - Link para o repositório
  - CTA: "Acenda a Forja"
    → Verificar: Lighthouse score ≥ 90 em Performance e Acessibilidade; formulário de waitlist grava o e-mail

- [ ] **3.3** Criar perfil no Product Hunt em draft (não publicar ainda — publicar apenas na Fase 5)
      → Verificar: thumbnail, tagline e descrição preenchidos com identidade Hefesto

- [ ] **3.4** Criar/atualizar perfis nas redes sociais:
  - GitHub Organization (se aplicável): avatar, bio
  - LinkedIn Page: nome, logo, descrição, link do repo
  - Twitter/X: handle `@hefestoapp` ou similar disponível
    → Verificar: bio de cada perfil usa a narrativa central; links cruzados funcionando

---

### FASE 4 — Estratégia de Conteúdo (Pré-lançamento)

> Esta fase gera ativos de conteúdo. O agente deve criar os arquivos de script/roteiro, não publicar diretamente.

- [ ] **4.1** Escrever 5 posts de build-in-public para LinkedIn (arquivar em `content/linkedin/`):
  - Post 1: Anúncio do rebranding — "Por que ProspectFlow virou Hefesto"
  - Post 2: A arquitetura da Forja — como os Autômatos funcionam
  - Post 3: A Mão do Artífice — por que human-in-the-loop importa
  - Post 4: Open source como estratégia — transparência como venda
  - Post 5: Countdown para o lançamento
    → Verificar: cada post ≤ 1.300 caracteres (limite ideal LinkedIn); tom alinhado ao brand

- [ ] **4.2** Escrever 3 roteiros de short-form video (15-30s) para TikTok/Reels/Shorts (arquivar em `content/shorts/`):
  - Roteiro A: "Assista um Autômato fechar uma venda em tempo real" (screen recording + narração)
  - Roteiro B: "Você acende a forja uma vez..." (storytelling + corte rápido)
  - Roteiro C: "Pay-to-win mas de verdade" (gancho polêmico + explicação)
    → Verificar: roteiro tem hook nos primeiros 3 segundos; CTA para waitlist/repo no final

- [ ] **4.3** Criar template de e-mail de boas-vindas para a waitlist (arquivar em `content/email/`):
  - Tom mítico, confirma inscrição, promete acesso antecipado
    → Verificar: sem spam triggers; personalização com `{{first_name}}`

---

### FASE 5 — Lançamento

- [ ] **5.1** Publicar no Product Hunt (coordenar horário: 00:01 PST de uma terça ou quarta-feira)
      → Verificar: página ao vivo, primeiros 10 upvotes de aliados confirmados antes da publicação

- [ ] **5.2** Publicar post âncora no LinkedIn (Post 5 da Fase 4 adaptado para o dia D)
      → Verificar: publicado com imagem de capa formatada para LinkedIn (1200x627px)

- [ ] **5.3** Publicar os 3 short-form videos simultaneamente nas plataformas
      → Verificar: link do repo/landing na bio de cada plataforma

- [ ] **5.4** Enviar e-mail para lista de waitlist
      → Verificar: taxa de entrega ≥ 95%; link do repo no corpo do e-mail

- [ ] **5.5** Abrir issues no GitHub com label `good first issue` para engajar a comunidade open source no dia do lançamento
      → Verificar: ≥ 5 issues abertas e etiquetadas

---

### FASE 6 — Verificação Final

- [ ] Zero ocorrências de "ProspectFlow" em todo o repositório (`grep -ri "prospectflow" .`)
- [ ] README renderiza corretamente com todos os links funcionando
- [ ] Landing page no ar com HTTPS e waitlist funcional
- [ ] Domínio registrado e apontando para a landing page
- [ ] `BRAND.md` publicado e acessível a contribuidores
- [ ] Todos os arquivos de conteúdo (`content/`) criados e revisados
- [ ] Nenhum componente interno ainda referenciado pelo nome antigo
- [ ] Conformidade: README contém seção sobre LGPD e outreach ético

---

## Conformidade e Riscos

| Risco                                   | Mitigação                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Prospecção automática violar LGPD       | Documentar na landing e README que o outreach é opt-in ou baseado em dados públicos; jamais prometer envio em massa |
| Nome "Hefesto" já registrado como marca | Verificar INPI (Brasil) e USPTO antes do lançamento                                                                 |
| Links quebrados após rename do repo     | Configurar redirect no GitHub Settings após o rename                                                                |
| Context rot entre sessões do agente     | Ler este arquivo no início de cada sessão; nunca começar sem re-ler a spec                                          |

---

## Done When

- [ ] Nenhum rastro do nome ProspectFlow no codebase, docs ou perfis digitais
- [ ] README, landing page e redes sociais comunicam a narrativa da Forja de forma consistente
- [ ] Waitlist no ar e capturando e-mails
- [ ] Ativos de conteúdo de pré-lançamento prontos para publicar
- [ ] `BRAND.md` garante que futuros contribuidores mantenham a identidade

---

## Contexto de Recuperação (para novas sessões)

Ao retomar o trabalho nesta task:

1. Ler este arquivo inteiro
2. Checar quais itens já estão marcados com `[x]`
3. Identificar o próximo item pendente `[ ]`
4. Nunca implementar sem re-ler a spec

> **A spec é o contrato. Código ou conteúdo que não bate com a spec está errado — não a spec.**
