# Design Spec: UI/UX Redesign + Dark/Light Theme + i18n

**Data:** 2026-06-04  
**Projeto:** Hefesto (ProspectFlow_AI)  
**Status:** Aprovado  
**Abordagem:** Big Bang — única feature branch, commits separados por frente

---

## Escopo

Três frentes entregues juntas numa única branch `feat/ui-redesign-theme-i18n`:

1. **Design System** — nova paleta azul, escala tipográfica, componentes refinados
2. **Dark/Light Theme** — substituição do toggle manual por `next-themes`
3. **Internacionalização** — `next-intl` com PT-BR, ES e EN

---

## Frente 1: Design System

### Paleta de Cores (OKLch)

**Dark mode (`.dark`):**

| Token CSS              | Valor OKLch             | Uso                                 |
| ---------------------- | ----------------------- | ----------------------------------- |
| `--background`         | `oklch(0.09 0.005 230)` | Fundo da aplicação                  |
| `--surface`            | `oklch(0.12 0.006 230)` | Cards, sidebar                      |
| `--surface-2`          | `oklch(0.15 0.007 230)` | Inputs, hover rows                  |
| `--border`             | `oklch(0.22 0.008 230)` | Bordas                              |
| `--primary`            | `oklch(0.60 0.20 230)`  | Azul vibrante — CTAs, active states |
| `--primary-foreground` | `oklch(0.98 0.005 230)` | Texto sobre primário                |
| `--accent`             | `oklch(0.70 0.14 195)`  | Ciano — destaque secundário         |
| `--muted`              | `oklch(0.45 0.010 230)` | Texto secundário                    |
| `--foreground`         | `oklch(0.93 0.005 230)` | Texto principal                     |
| `--destructive`        | `oklch(0.60 0.22 25)`   | Erros, ações destrutivas            |

**Light mode (`:root`):**

| Token CSS              | Valor OKLch             | Uso                    |
| ---------------------- | ----------------------- | ---------------------- |
| `--background`         | `oklch(0.98 0.003 230)` | Fundo                  |
| `--surface`            | `oklch(0.96 0.004 230)` | Cards, sidebar         |
| `--surface-2`          | `oklch(0.93 0.005 230)` | Inputs, hover rows     |
| `--border`             | `oklch(0.88 0.008 230)` | Bordas                 |
| `--primary`            | `oklch(0.48 0.20 230)`  | Azul profundo no light |
| `--primary-foreground` | `oklch(0.98 0.005 230)` | Texto sobre primário   |
| `--accent`             | `oklch(0.55 0.14 195)`  | Ciano secundário       |
| `--muted`              | `oklch(0.55 0.010 230)` | Texto secundário       |
| `--foreground`         | `oklch(0.15 0.008 230)` | Texto principal        |
| `--destructive`        | `oklch(0.50 0.22 25)`   | Erros                  |

Tokens adicionais para sidebar, charts (5 cores) e ring permanecem, atualizados para o hue azul (230).

### Tipografia

**Fonte:** Geist (MIT, open-source, já instalada via `next/font/local`). Nenhuma dependência externa nova.

**Escala (CSS custom properties em `globals.css`):**

| Token            | Size             | Weight | Line-height | Uso                   |
| ---------------- | ---------------- | ------ | ----------- | --------------------- |
| `--text-display` | 28px / 1.75rem   | 700    | 1.2         | H1 de página          |
| `--text-title`   | 20px / 1.25rem   | 600    | 1.3         | H2, títulos de card   |
| `--text-heading` | 15px / 0.9375rem | 600    | 1.4         | H3, labels de seção   |
| `--text-body`    | 14px / 0.875rem  | 400    | 1.5         | Texto corrido         |
| `--text-sm`      | 13px / 0.8125rem | 400    | 1.5         | Metadados, badges     |
| `--text-xs`      | 11px / 0.6875rem | 500    | 1.4         | Timestamps, sublabels |

### Componentes Refinados

#### Sidebar

- Largura: 220px (desktop), ícone + label
- Active state: pill azul 3px à esquerda + `bg-primary/10 text-primary`
- Hover: `bg-surface-2/60` com transição 120ms
- Sem borda direita — sombra `shadow-sm` separa do conteúdo
- Seções agrupadas com label uppercase xs muted

#### Cards

- `border border-border/60 bg-surface rounded-xl shadow-sm`
- Padding interno: `p-5` uniforme
- Interativos: `hover:shadow-md hover:border-border` transição 150ms

#### Botões

Tamanhos: `sm` (h-8) / `default` (h-9) / `lg` (h-10)

Variantes adicionadas:

- `glow` — primary com `box-shadow: 0 0 20px oklch(0.60 0.20 230 / 0.4)` para CTAs principais
- `ghost` — hover com `bg-surface-2/60`

#### Badges de Status

8 variantes semânticas (`bg-color/10 text-color border-color/20`):

| Variante      | Cor base  | Uso               |
| ------------- | --------- | ----------------- |
| `new`         | Azul      | Lead novo         |
| `qualified`   | Verde     | Qualificado       |
| `negotiating` | Amarelo   | Em negociação     |
| `converted`   | Esmeralda | Convertido        |
| `lost`        | Vermelho  | Perdido           |
| `pending`     | Laranja   | Aguardando ação   |
| `active`      | Ciano     | Ativo/em execução |
| `error`       | Rubro     | Erro              |

#### Tabelas e Listas

- Hover row: `bg-surface-2/60`
- Ações contextuais: `opacity-0 group-hover:opacity-100` (aparecem no hover, sem coluna fixa)
- Skeleton loader padronizado: componente `<Skeleton>` com animação pulse

#### Empty States

Novo componente `<EmptyState>` com:

- Ícone Lucide centralizado (48px, cor muted)
- Título (`text-heading`)
- Descrição (`text-sm text-muted`)
- CTA opcional (`Button` variante `ghost` ou `default`)

Usado em todas as listas quando `data.length === 0`.

#### Microinterações

- Transição padrão: `transition-all duration-150 ease-out`
- Page fade: `opacity` 0 → 1 em 100ms via CSS
- Sidebar items: `transition-colors duration-[120ms]`
- Sem animações custosas — performance first

---

## Frente 2: Dark/Light Theme

### Problema Atual

- `<html className="dark">` hardcoded no root layout
- Toggle via `document.documentElement.classList.toggle("dark")` em `useState`
- Sem persistência real entre sessões, sem respeito à preferência do sistema operacional

### Solução: `next-themes`

**Dependência adicionada:** `next-themes` (última versão estável)

**Arquivos alterados:**

`src/app/providers.tsx` — adiciona `ThemeProvider`:

```tsx
import { ThemeProvider } from "next-themes";

export function Providers({ children }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

`src/app/layout.tsx` (Server Component) — carrega locale + messages e envolve com `NextIntlClientProvider`:

```tsx
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

O `NextIntlClientProvider` fica no Server Component `layout.tsx` — não em `providers.tsx` (que é `"use client"` e não consegue carregar messages do servidor).

`src/app/layout.tsx`:

- Remove `className="dark"` do `<html>`
- Mantém `suppressHydrationWarning`

`src/app/(dashboard)/layout.tsx`:

- Remove `useState(darkMode)` e manipulação manual do DOM
- Usa `useTheme()` de `next-themes`

### Toggle na Top Bar

Botão `ghost` `size="icon"` com ícone `Sun` (light) ou `Moon` (dark) do Lucide. Tooltip traduzível via i18n key `theme.toggle`.

Abre `DropdownMenu` com três itens (ícones Lucide + texto, sem emojis):

```
[Sun icon]     Claro       (light)
[Moon icon]    Escuro      (dark)
[Monitor icon] Sistema     (system)
```

Ao selecionar, chama `setTheme('light' | 'dark' | 'system')`.

### Layout da Top Bar (lado direito, esquerda para direita)

```
[Globe + código idioma]   [Sun/Moon icon]   [Avatar dropdown]
```

---

## Frente 3: Internacionalização (next-intl)

### Configuração

**Dependência adicionada:** `next-intl` (última versão estável)

**Sem alteração de rotas.** URLs permanecem `/agents`, `/leads`, etc.

**Detecção de locale (ordem de prioridade):**

1. Cookie `NEXT_LOCALE`
2. Header `Accept-Language`
3. Fallback: `pt-BR`

**Locales suportados:** `pt-BR`, `es`, `en`

### Estrutura de Arquivos

```
apps/web/
  messages/
    pt-BR.json          ← idioma padrão (todas as strings)
    es.json             ← traduções em Espanhol
    en.json             ← traduções em Inglês
  src/
    i18n/
      config.ts         ← { locales: ['pt-BR','es','en'], defaultLocale: 'pt-BR' }
      request.ts        ← getRequestConfig() — lê cookie NEXT_LOCALE por request
    middleware.ts       ← detecta locale, seta cookie, sem redirect de URL
```

### Namespaces de Tradução

```
nav          → itens da navegação lateral
agents       → página e formulários de agentes
leads        → página e formulários de leads
deals        → página de deals
projects     → página de projetos
briefings    → página de briefings
prospecting  → página de prospecção
hitl         → aprovações HITL
costs        → página de custos
settings     → todas as abas de configuração
auth         → login, registro, forgot-password, reset, verify
common       → save, cancel, loading, error, success, confirm, delete, edit, back, search
theme        → light, dark, system, toggle
language     → pt-BR, es, en (nomes exibidos dos idiomas)
errors       → mensagens de erro da API mapeadas para exibição ao usuário
```

### Uso nos Componentes

Server Components:

```tsx
import { getTranslations } from "next-intl/server";
const t = await getTranslations("agents");
return <h1>{t("title")}</h1>;
```

Client Components:

```tsx
"use client";
import { useTranslations } from "next-intl";
const t = useTranslations("common");
return <Button>{t("save")}</Button>;
```

### Seletor de Idioma na Top Bar

Botão `ghost` `size="sm"` com ícone `Globe` (Lucide) + código do locale atual (`PT`, `ES`, `EN`).

Abre `DropdownMenu`:

```
Português (PT-BR)    [Check icon se ativo]
Español (ES)         [Check icon se ativo]
English (EN)         [Check icon se ativo]
```

Ao selecionar: Server Action `setLocale(locale)` seta o cookie `NEXT_LOCALE`, depois `router.refresh()` recarrega a página com o novo idioma. Sem perda de estado de navegação (URL não muda).

### Escopo de Extração

**Extraídas:** toda string visível ao usuário — navegação, títulos, labels, placeholders, tooltips, mensagens de erro exibidas na UI, estados vazios, textos de botão, textos de confirmação, aria-labels.

**Não extraídas:** chaves de configuração internas, valores de enum da API, strings de log, dados vindos da API (nomes de leads, agentes, etc.).

---

## Arquivos Impactados

| Arquivo                                      | Tipo de mudança                                                |
| -------------------------------------------- | -------------------------------------------------------------- |
| `apps/web/package.json`                      | Adiciona `next-themes`, `next-intl`                            |
| `apps/web/src/app/globals.css`               | Nova paleta OKLch azul + escala tipográfica                    |
| `apps/web/src/app/layout.tsx`                | Remove `className="dark"`, mantém `suppressHydrationWarning`   |
| `apps/web/src/app/providers.tsx`             | Adiciona `ThemeProvider` + `NextIntlClientProvider`            |
| `apps/web/src/app/(dashboard)/layout.tsx`    | Refatora toggle de tema, adiciona seletor de idioma na top bar |
| `apps/web/src/app/(dashboard)/**/page.tsx`   | Aplica `t()` em todas as strings (13 páginas)                  |
| `apps/web/src/app/(auth)/**/page.tsx`        | Aplica `t()` (5 páginas)                                       |
| `apps/web/src/components/ui/*.tsx`           | Refinamentos visuais dos componentes base (19 componentes)     |
| `apps/web/src/components/ui/empty-state.tsx` | Novo componente                                                |
| `apps/web/src/components/ui/skeleton.tsx`    | Novo componente                                                |
| `apps/web/src/components/settings/*.tsx`     | Aplica `t()` (6 componentes)                                   |
| `apps/web/src/i18n/config.ts`                | Novo                                                           |
| `apps/web/src/i18n/request.ts`               | Novo                                                           |
| `apps/web/src/middleware.ts`                 | Novo (ou atualizado se existir)                                |
| `apps/web/messages/pt-BR.json`               | Novo — todas as strings em PT-BR                               |
| `apps/web/messages/es.json`                  | Novo — traduções em Espanhol                                   |
| `apps/web/messages/en.json`                  | Novo — traduções em Inglês                                     |

---

## Ordem de Implementação

1. Instalar dependências (`next-themes`, `next-intl`)
2. `globals.css` — nova paleta azul e escala tipográfica
3. Componentes base `ui/` — refinamentos visuais
4. Novos componentes: `<EmptyState>`, `<Skeleton>`
5. `next-themes` — `ThemeProvider` em `providers.tsx`, toggle na top bar, remover toggle manual
6. `next-intl` — config, middleware, arquivos de mensagens PT-BR completos
7. Traduções ES e EN
8. Extração de strings — todas as páginas e componentes
9. Seletor de idioma na top bar
10. Testes E2E — validar toggle de tema e troca de idioma

---

## Critérios de Aceitação

- [ ] Light e dark mode funcionam em todas as páginas sem flash (FOUC) no carregamento
- [ ] Preferência de tema persiste entre sessões via `localStorage`
- [ ] Tema "Sistema" respeita a preferência do SO
- [ ] Troca de idioma funciona em todas as páginas sem perda de estado de navegação
- [ ] Todas as strings visíveis estão traduzidas nas 3 línguas
- [ ] Nenhuma string hardcoded remanescente nas páginas e componentes
- [ ] Geist é a única fonte carregada (gratuita, MIT)
- [ ] Sem regressão nos testes E2E existentes
- [ ] Build `next build` sem erros de TypeScript
- [ ] Nenhum emoji na UI (apenas ícones Lucide)
