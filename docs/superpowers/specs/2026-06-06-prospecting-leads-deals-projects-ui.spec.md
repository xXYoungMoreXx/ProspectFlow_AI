# Spec: UI Review — Prospecção, Leads, Deals, Projetos

**Data:** 2026-06-06  
**Sprint:** S5-12  
**Status:** Aprovado  
**Autor:** Sessão de revisão cirúrgica

---

## Objetivo

Revisão cirúrgica das páginas de **Prospecção** (abas Nova Busca, Fila, Configuração), **Leads**, **Deals** e **Projetos** para garantir:

1. Conformidade com o design system (`2026-06-04-ui-ux-redesign-design.md`)
2. Responsividade em mobile (< 480px), tablet (768px) e desktop (1280px+)
3. Integração correta com Google Maps + Google Business (Places API New)
4. i18n completo — nenhuma string hardcoded visível ao usuário
5. TypeScript sem `any` nas páginas revisadas
6. UX gaps críticos corrigidos

---

## 1. Prospecção — Nova Busca

### Estado Pré-S5-12

| Ítem                                                       | Estado     |
| ---------------------------------------------------------- | ---------- |
| Formulário: categorias, cidade, estado, raio, score mínimo | ✅         |
| Mapa: Leaflet + OpenStreetMap + Nominatim geocoding        | ✅         |
| Preview Google Business (Places API New)                   | ✅         |
| Cards de resultado: nome, endereço, rating, telefone, site | ✅         |
| Botão "Iniciar Prospecção" após preview                    | ✅         |
| Estado de erro no preview                                  | ❌ ausente |
| Estado de erro no submit                                   | ❌ ausente |
| Atribuição "Dados do Google Business"                      | ❌ ausente |

### Decisão de Arquitetura: Leaflet vs Google Maps embed

O mapa de preview geográfico usa **Leaflet + OpenStreetMap** (gratuito, sem billing). A busca de negócios usa **Google Places API (New)** para os cards. Esta combinação é a escolha correta:

- **Leaflet**: visualiza o círculo de raio geograficamente (sem custo adicional)
- **Google Places API**: retorna negócios reais com dados do Google Business

**Decisão:** NÃO substituir Leaflet por Google Maps JavaScript API embed — requer billing adicional e não agrega valor ao fluxo de busca.

### Requisitos Funcionais

#### RF-NOVA-01: Estado de Erro no Preview

Quando `previewMutation.isError`, exibir abaixo do botão de busca:

- Ícone `AlertCircle` + texto `t("search.errorPreview")`
- Classe: `flex items-center gap-2 text-sm text-destructive`

#### RF-NOVA-02: Estado de Erro no Submit

Quando `searchMutation.isError`, exibir abaixo do botão "Iniciar Prospecção":

- Texto `t("search.errorSubmit")`
- Classe: `text-sm text-destructive text-center`

#### RF-NOVA-03: Atribuição Google Business

Abaixo da lista de resultados (quando `previewResults.length > 0`):

```
Dados fornecidos pelo Google Business · Google Maps
```

- Classe: `text-[10px] text-muted-foreground text-center mt-2`

#### RF-NOVA-04: Sliders com Unidade no Label

```tsx
// Antes:
{t("search.radius")} {radiusKm}
// Depois:
{t("search.radius")}: {radiusKm} km

// Antes:
{t("search.minScore")} {minScore}
// Depois:
{t("search.minScore")}: {minScore} pts
```

---

## 2. Prospecção — Fila

### Estado Pré-S5-12

| Ítem                                      | Estado                        |
| ----------------------------------------- | ----------------------------- |
| Tabela: Empresa, Score, Fonte, Data, HITL | ✅                            |
| Paginação (10 itens/página)               | ✅                            |
| Estado vazio                              | ✅                            |
| `overflow-x-auto` na tabela               | ❌ ausente — QUEBRA em mobile |
| Coluna Contato (nome)                     | ❌ ausente                    |
| Clique na linha → detalhe do lead         | ❌ ausente                    |

### Requisitos Funcionais

#### RF-FILA-01: Responsividade Mobile (CRÍTICO)

```tsx
// Envolver a tabela existente:
<div className="overflow-x-auto rounded-lg border border-border">
  <table className="w-full text-sm min-w-[580px]">
    {/* conteúdo existente */}
  </table>
</div>
```

Remover `rounded-lg border border-border overflow-hidden` do `<div>` pai (migrar para o wrapper acima).

#### RF-FILA-02: Coluna Contato

Adicionar após coluna Empresa:

- Header: `{t("queue.columns.contact")}`
- Conteúdo: `{lead.contactName || "—"}` com `text-xs text-muted-foreground`

#### RF-FILA-03: Clique na Linha

```tsx
import { useRouter } from "next/navigation";
// ...
const router = useRouter();
// ...
<tr
  className="hover:bg-muted/20 transition-colors cursor-pointer"
  onClick={() => router.push(`/leads/${lead.id}`)}
>
```

---

## 3. Prospecção — Configuração

### Estado Pré-S5-12

| Ítem                                                          | Estado     |
| ------------------------------------------------------------- | ---------- |
| Form editável: categorias, região, raio, score, horário, dias | ✅         |
| Status read-only: último/próximo run, quota                   | ✅         |
| Feedback de sucesso/erro no save                              | ❌ ausente |

### Requisitos Funcionais

#### RF-CONFIG-01: Feedback de Sucesso/Erro

Acima do botão Save, exibir estado:

```tsx
{
  saveMutation.isSuccess && (
    <p className="text-xs text-emerald-400 text-center">
      {t("config.saveSuccess")}
    </p>
  );
}
{
  saveMutation.isError && (
    <p className="text-xs text-destructive text-center">
      {t("config.saveError")}
    </p>
  );
}
```

---

## 4. Leads — Kanban

### Estado Pré-S5-12

| Ítem                             | Estado                   |
| -------------------------------- | ------------------------ |
| Kanban 8 colunas + DnD (dnd-kit) | ✅                       |
| Cores semânticas por status      | ✅                       |
| Contagem por coluna              | ✅                       |
| DragOverlay com label traduzida  | ❌ mostra enum raw — BUG |
| Click no card → `/leads/:id`     | ❌ ausente               |

### Requisitos Funcionais

#### RF-LEADS-01: DragOverlay Label Traduzida (BUG)

Em `leads/page.tsx`, dentro do `<DragOverlay>`:

```tsx
// Antes (linha ~284):
{
  activeLead.status;
}

// Depois:
{
  t(`columns.${activeLead.status}`);
}
```

#### RF-LEADS-02: Click no Card → Detalhe

No `SortableLeadCard`, adicionar handler de clique que só navega quando não está arrastando:

```tsx
import { useRouter } from "next/navigation";

// Dentro do componente SortableLeadCard:
const router = useRouter();

// No elemento interno (não no ref do dnd-kit):
<CardContent
  className="py-3 px-4 pl-6 cursor-pointer"
  onClick={() => { if (!isDragging) router.push(`/leads/${lead.id}`); }}
>
```

---

## 5. Deals

### Estado Pré-S5-12

| Ítem                                | Estado     |
| ----------------------------------- | ---------- |
| Lista: ID hash, valor, status badge | ✅         |
| Status traduzido via i18n           | ✅         |
| EmptyState + Skeleton               | ✅         |
| `deal: any` TypeScript              | ❌         |
| Nome cliente / data do deal         | ❌ ausente |

### Tipo Deal (inferido da API)

```typescript
interface Deal {
  id: string;
  status: "PROPOSED" | "NEGOTIATING" | "CLOSED" | "CANCELLED";
  pricing?: { total?: number };
  leadId?: string;
  clientName?: string;
  createdAt: string;
}
```

### Requisitos Funcionais

#### RF-DEALS-01: Tipo Correto

Substituir `deal: any` por `Deal` inline.

#### RF-DEALS-02: Informação Adicional no Card

Linha secundária no card: data formatada + nome do cliente:

```tsx
<p className="text-xs text-muted-foreground mt-0.5">
  {deal.clientName && `${deal.clientName} · `}
  {new Date(deal.createdAt).toLocaleDateString("pt-BR")}
</p>
```

---

## 6. Projetos — Lista

### Estado Pré-S5-12

| Ítem                                      | Estado         |
| ----------------------------------------- | -------------- |
| Grid responsivo 1/2/3 colunas             | ✅             |
| Link para `/projects/:id`                 | ✅             |
| Lighthouse scores (quando presentes)      | ✅             |
| Status badge com enum raw (não traduzido) | ❌ BUG CRÍTICO |
| `project: any` TypeScript                 | ❌             |
| i18n keys `projects.status.*`             | ❌ ausente     |

### Tipo Project (inferido da API)

```typescript
interface Project {
  id: string;
  clientName?: string;
  status: "PENDING" | "IN_PROGRESS" | "REVIEW" | "DELIVERED" | "REVISION";
  lighthouseScores?: { performance?: number; accessibility?: number };
  previewUrl?: string;
  createdAt: string;
}
```

### Requisitos Funcionais

#### RF-PROJ-01: Status i18n (BUG CRÍTICO)

```tsx
// Antes (linha ~71):
{
  project.status;
}

// Depois:
{
  t(`status.${project.status}`);
}
```

#### RF-PROJ-02: Tipo Project Correto

Substituir `project: any` por `Project` inline.

---

## 7. i18n — Novas Keys (S5-12)

### Namespace `prospecting` (adicionar a pt-BR, en, es)

```json
"search": {
  "errorPreview": "Falha ao buscar resultados. Verifique a chave do Google Maps nas Configurações.",
  "errorSubmit": "Falha ao enfileirar a prospecção. Tente novamente.",
  "googleAttribution": "Dados fornecidos pelo Google Business · Google Maps"
},
"queue": {
  "columns": {
    "contact": "Contato"
  }
},
"config": {
  "saveSuccess": "Configuração salva com sucesso.",
  "saveError": "Erro ao salvar. Tente novamente."
}
```

### Namespace `projects` (adicionar a pt-BR, en, es)

```json
"status": {
  "PENDING": "Pendente",
  "IN_PROGRESS": "Em andamento",
  "REVIEW": "Em revisão",
  "DELIVERED": "Entregue",
  "REVISION": "Em revisão"
}
```

---

## 8. Critérios de Aceitação

- [ ] Fila de prospecção: `overflow-x-auto` — não quebra em 375px
- [ ] Nova Busca: erro de preview exibido quando API falha
- [ ] Nova Busca: erro de submit exibido quando enfileirar falha
- [ ] Configuração: "Configuração salva" aparece após save bem-sucedido
- [ ] DragOverlay Leads: label em português (não enum raw)
- [ ] Click em card de Lead navega para `/leads/:id`
- [ ] Lista Projetos: status em português (não "IN_PROGRESS" raw)
- [ ] Sem `deal: any` ou `project: any`
- [ ] Keys i18n adicionadas em pt-BR, en e es
- [ ] `npm run typecheck -w @agentepro/web` passa sem erros novos

---

## 9. Fora do Escopo — S5-13+

| Item                                                    | Motivo                            |
| ------------------------------------------------------- | --------------------------------- |
| `leads/[id]/page.tsx`: i18n completo + conversação real | Mock hardcoded — refactor maior   |
| `projects/[id]/page.tsx`: i18n strings inglês           | Refactor maior                    |
| `/deals/[id]` rota de detalhe                           | Nova rota                         |
| Filtros na Fila de prospecção                           | G12 — backlog                     |
| Mapa preview na aba Configuração                        | G12 refinamento                   |
| Google Maps JavaScript API embed                        | Billing adicional sem ganho de UX |

---

## 10. S5-13 — Agentes + Leads fixes (2026-06-06)

### Agentes — Criar Agente (`agents/new/page.tsx`)

| Item                   | Estado Anterior                                 | Estado S5-13                                                           |
| ---------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| `handleSave`           | Mock com `setTimeout` sem chamada real          | `useMutation` → `api.agents.create()` ✅                               |
| Modelos Anthropic      | IDs incorretos (`claude-4.7-opus` etc.)         | `claude-sonnet-4-6`, `claude-opus-4-8`, `claude-haiku-4-5-20251001` ✅ |
| Modelos OpenAI         | Apenas `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo` | Adiciona `o3`, `gpt-4.1` ✅                                            |
| Modelos Google         | `gemini-3.1-flash`, `gemini-3.0-ultra`          | `gemini-3.5-flash` (default), `gemini-3.1-pro` ✅                      |
| Provider → Model sync  | Não resetava ao trocar provider                 | `handleProviderChange` reseta para 1ª opção ✅                         |
| Skills                 | Fake: `read_files`, `write_files`               | 8 skills reais do agent-runtime ✅                                     |
| Loading/erro deploy    | Sem feedback visual                             | Spinner `isPending`, mensagem `isError` ✅                             |
| `agents/page.tsx`      | `agent: any`                                    | `AgentListItem` interface ✅                                           |
| `agents/[id]/page.tsx` | `skill: any` + `console.warn`                   | `AgentSkillItem` interface, sem console ✅                             |

#### Skills disponíveis (corrigidas)

`web_search`, `places_search`, `cnpj_lookup`, `cnpj_enricher`, `email_sender`, `whatsapp_sender`, `contract_notifier`, `site_generator`

`security_guard` é always-on (exibido separadamente como card "Security Guard").

### Leads — Scroll + "Novo Lead"

| Item              | Estado Anterior                                | Estado S5-13                                                   |
| ----------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| Botão "Novo Lead" | Sem `onClick` — não funcionava                 | `<Link href="/leads/new">` ✅                                  |
| Scroll horizontal | Resetava ao tocar cards                        | `{...listeners}` isolado no `GripVertical` com `touch-none` ✅ |
| Click no card     | `didDrag` ref + `onPointerMove` em todo o card | Usa `isDragging` do `useSortable` ✅                           |
| Rota `/leads/new` | Não existia                                    | Form: nome, empresa, telefone, email, origem ✅                |

#### Decisão arquitetural: drag handle isolado

`{...listeners}` movido do outer div para o `GripVertical` (`touch-none`). O dnd-kit só ativa o PointerSensor ao pressionar o handle — qualquer toque no resto do card não bloqueia scroll nativo.

### i18n adicionadas (S5-13)

- `agents.new.skillLabels.*` — 8 skills reais (pt-BR/en/es)
- `agents.new.deploying`, `agents.new.deployError`
- `leads.new.*` — keys do form de criação de lead
