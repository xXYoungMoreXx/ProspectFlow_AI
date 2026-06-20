# LAUNCH.md — Ações externas e follow-ups do rebranding Hefesto

> O rename de marca **no repositório** (strings, escopo npm `@hefesto/*`, docs,
> conteúdo) está feito e verificado. Este arquivo rastreia o que **não pode ser
> feito por um agente de código**: ações que exigem contas, registros externos ou
> decisões humanas. Trate cada item como um checklist de lançamento.

Origem: [hefesto-rebranding.md](hefesto-rebranding.md) (a spec). Marque `[x]` à
medida que concluir.

---

## 1. Decisões pendentes (precisam de você)

- [x] **Licença vs. narrativa open source.** _Resolvido (2026-06-18):_ manter o
      `LICENSE` source-available não-comercial e **ajustar a narrativa** — em vez de
      relicenciar para OSI. Os textos não devem usar o selo categórico "open source"
      / "open-core" (que implica liberdade de revenda/SaaS, o que a licença proíbe).
      Termo correto: **"código aberto e auditável"** (fonte pública, livre para usar
      e modificar, inclusive nas suas operações) sob **licença de uso não-comercial**
      (sem revenda nem SaaS de terceiros). README e `content/` alinhados.
- [ ] **Domínio alvo** (ordem de preferência): `hefesto.dev` → `hefesto.app` →
      `usehefesto.com`. Verificar disponibilidade **antes** de divulgar.
- [ ] **Handle social**: `@hefestoapp` ou similar disponível nas plataformas.

## 2. Repositório GitHub (rename + redirect)

- [ ] Renomear o repo de `ProspectFlow_AI` para `hefesto` em
      Settings → General → Repository name.
- [ ] GitHub cria redirect automático das URLs antigas — confirmar que
      `git remote` antigo ainda resolve.
- [ ] **Após o rename**, trocar as URLs no código (hoje apontam para o slug atual
      `xXYoungMoreXx/ProspectFlow_AI` para não quebrar antes do rename):
  ```bash
  grep -rl 'xXYoungMoreXx/ProspectFlow_AI' . --exclude-dir=node_modules --exclude-dir=.git \
    | xargs sed -i 's#xXYoungMoreXx/ProspectFlow_AI#xXYoungMoreXx/hefesto#g'
  ```
  Conferir também `cd ProspectFlow_AI` nas instruções de clone (README, SETUP,
  CONTRIBUTING) → `cd hefesto`.
- [ ] Atualizar o caminho local de desenvolvimento se desejar (`E:/Dev/ProspectFlow_AI`
      é o diretório físico em disco; renomeá-lo é opcional e exige reconfigurar
      `.mcp.json` e o worktree).

## 3. Marca registrada (antes do lançamento)

- [ ] Verificar "Hefesto" no **INPI** (Brasil) e **USPTO** (EUA) para a classe de
      software. Mitiga o risco de colisão de marca.

## 4. Presença digital (FASE 3 da spec)

- [ ] Registrar o domínio escolhido; configurar DNS + HTTPS.
- [ ] Landing page minimalista (GitHub Pages ou Vercel): headline com a tagline,
      demo/GIF de 15–30s, campo de e-mail (waitlist), link do repo, CTA "Acenda a
      Forja". Meta: Lighthouse ≥ 90 em Performance e Acessibilidade.
- [ ] Product Hunt: criar em **draft** (não publicar — só na FASE 5).
- [ ] Perfis sociais: GitHub Org (avatar/bio), LinkedIn Page, Twitter/X handle —
      bios usando a narrativa central, links cruzados.

## 5. Conteúdo (pronto no repo — falta publicar)

Os arquivos já existem em [`content/`](content/) (FASE 4 concluída):

- `content/linkedin/01..05` — 5 posts build-in-public (todos ≤ 1300 caracteres).
- `content/shorts/roteiro-a|b|c.md` — 3 roteiros de short-form (hook nos 3s).
- `content/email/waitlist-welcome.md` — e-mail de boas-vindas (com `{{first_name}}`).

- [ ] Revisar/ajustar tom final e agendar.

## 6. Lançamento (FASE 5)

- [ ] Product Hunt ao vivo (00:01 PST, terça ou quarta); 10 upvotes de aliados
      confirmados antes.
- [ ] Post âncora no LinkedIn (Post 5) com capa 1200×627px.
- [ ] Publicar os 3 shorts simultaneamente; link do repo na bio de cada plataforma.
- [ ] Enviar e-mail para a waitlist (meta de entrega ≥ 95%).
- [ ] Abrir ≥ 5 issues `good first issue` para engajar a comunidade.

---

## Follow-up técnico (no código, planejado)

- [ ] **Rename mítico dos identificadores internos** (spec 1.6): `Automaton`,
      `Furnace`, `Anvil`, `ArtificerIntervention`. Refactor transversal
      (domínio + aplicação + 150+ testes) — fazer em PR dedicado, com TDD, para não
      acoplar a um rebranding de strings. Ver dicionário em
      [ARCHITECTURE.md](ARCHITECTURE.md).
- [ ] Substituir o `<img>` por `next/image` em
      `apps/web/src/app/(dashboard)/prospecting/page.tsx` (warning de lint pré-existente).

---

## Verificação final (FASE 6 da spec)

- [x] Zero ocorrências de "ProspectFlow"/"AgentePro" no código e docs (exceto a
      própria spec e este checklist, que citam o nome antigo por contexto histórico).
- [x] `BRAND.md` publicado na raiz.
- [x] Ativos de `content/` criados.
- [ ] README renderiza com todos os links funcionando (validar no GitHub após push).
- [ ] Landing no ar com HTTPS e waitlist funcional.
- [ ] Domínio registrado apontando para a landing.
