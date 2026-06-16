# SPEC-12: Settings UI — Revisão e Expansão

> Versão: 1.0.0 | Fase: 1 | Dependências: SPEC-01 (IAM), SPEC-00 (Foundation)

---

## Overview

O módulo **Settings** (`apps/web/src/app/(dashboard)/settings/`) é o painel centralizado de configuração da plataforma AgentePro. Ele expõe ao operador todos os parâmetros necessários para orquestrar os runtimes de agentes: credenciais de provedores LLM, configurações de mensageria, integrações externas (MCP Brasil, ChromaDB, Webhooks, MCPs customizados) e parâmetros de sistema (HITL, segurança, backup).

A página opera em modo **optimistic-pending**: toda alteração é acumulada no `useSettingsStore` (Zustand) como um diff ainda não salvo, exibido em uma save-bar com contagem de mudanças pendentes. Ao clicar em "Salvar", o store serializa e envia o batch de `PendingUpdate[]` para `PATCH /api/v1/settings` via React Query. Conexões com serviços externos são testadas via `POST /api/v1/settings/test` (por categoria), e o resultado é exibido em badges inline.

A UI está dividida em quatro abas:

| Aba          | Componente        | Conteúdo                                           |
| ------------ | ----------------- | -------------------------------------------------- |
| AI Providers | `AIProvidersTab`  | Cards de provedores LLM + Ollama local             |
| Messaging    | `MessagingTab`    | WhatsApp (Evolution API), Telegram, Brevo (e-mail) |
| Integrations | `IntegrationsTab` | MCP Brasil, ChromaDB, Webhooks, MCP Manager        |
| System       | `SystemTab`       | HITL timeouts, segurança, export/import de config  |

---

## Scope

Melhorias implementadas neste branch `feature/settings-ui-overhaul`:

1. **Expansão de provedores AI** — adição dos providers DeepSeek e OpenRouter ao `PROVIDERS` array de `AIProvidersTab`, com lista de modelos atualizada para 2025/2026 em todos os provedores existentes (OpenAI, Anthropic, Google Gemini, Groq).

2. **MCP Manager na aba Integrations** — nova seção que permite ao operador registrar MCPs customizados por `command` (stdio) ou `url` (HTTP/SSE), com botão de teste e remoção por entrada individual, armazenados em `integrations.mcp.entries`.

3. **Tooltips em todos os labels/card headers** — ícone `HelpCircle` ao lado de cada `Label` e `CardTitle` com tooltip explicativo nos três idiomas (pt-BR, en, es), usando o componente `Tooltip` do design system.

4. **Painel de diagnóstico Ollama** — quando `status.reachable === false`, o `OllamaManager` exibe um painel com possíveis causas e comandos de correção, em vez de apenas mostrar o badge "unreachable".

5. **Substituição de `<select>` nativo pelo componente Select do design system** — todos os `<select>` nativos em `AIProvidersTab` e `OllamaManager` substituídos pelo componente `Select` de `@/components/ui/select` (base-ui), mantendo aparência consistente com o restante do design system.

---

## Componentes Afetados

```
apps/web/src/
  app/(dashboard)/settings/
    page.tsx                              — sem alterações estruturais

  components/settings/
    AIProvidersTab.tsx                    — MODIFIED: novos providers, Select component, tooltips
    OllamaManager.tsx                     — MODIFIED: Select component, painel diagnóstico Ollama
    IntegrationsTab.tsx                   — MODIFIED: MCP Manager, tooltips
    SystemTab.tsx                         — MODIFIED: tooltips em labels

  components/ui/
    select.tsx                            — EXISTING (base-ui): usado como substituto do <select>
    tooltip.tsx                           — EXISTING: usado para tooltips de ajuda

  lib/stores/
    settings-store.ts                     — sem alterações (PendingUpdate já suporta qualquer key)

  messages/
    en.json                               — MODIFIED: chaves novas (deepseek, openrouter, tooltips, mcpManager, ollamaDiag)
    pt-BR.json                            — MODIFIED: idem
    es.json                               — MODIFIED: idem
```

---

## AI Providers

### Array `PROVIDERS` atualizado em `AIProvidersTab.tsx`

Cada entrada segue a interface `ProviderConfig`:

```typescript
interface ProviderConfig {
  id: string;
  category: "llm";
  keyField: string;
  keyPlaceholder: string;
  modelField: string;
  defaultModel: string;
  models: string[];
  hasBadge?: boolean;
}
```

### OpenAI

```typescript
{
  id: "openai",
  category: "llm",
  keyField: "llm.openai.api_key",
  keyPlaceholder: "sk-••••••••••••••••",
  modelField: "llm.openai.default_model",
  defaultModel: "gpt-4o-mini",
  models: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "o1",
    "o1-mini",
    "o3-mini",
    "o4-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
  ],
}
```

### Anthropic

```typescript
{
  id: "anthropic",
  category: "llm",
  keyField: "llm.anthropic.api_key",
  keyPlaceholder: "sk-ant-••••••••••••",
  modelField: "llm.anthropic.default_model",
  defaultModel: "claude-haiku-4-5-20251001",
  models: [
    "claude-opus-4-8",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
    "claude-opus-4-5",
    "claude-sonnet-4-5",
  ],
}
```

> Atenção: os IDs de modelo Anthropic devem ser usados exatamente como acima — são os identificadores reais da API, não nomes de marketing.

### Google Gemini

```typescript
{
  id: "google",
  category: "llm",
  keyField: "llm.gemini.api_key",
  keyPlaceholder: "AIza••••••••••••••",
  modelField: "llm.gemini.default_model",
  defaultModel: "gemini-2.5-flash",
  models: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ],
}
```

### Groq

```typescript
{
  id: "groq",
  category: "llm",
  keyField: "llm.groq.api_key",
  keyPlaceholder: "gsk_••••••••••••••••",
  modelField: "llm.groq.default_model",
  defaultModel: "llama-3.1-8b-instant",
  models: [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.1-70b-versatile",
    "gemma2-9b-it",
    "mixtral-8x7b-32768",
  ],
  hasBadge: true, // badge "Rápido"
}
```

### DeepSeek (NOVO)

```typescript
{
  id: "deepseek",
  category: "llm",
  keyField: "llm.deepseek.api_key",
  keyPlaceholder: "sk-••••••••",
  modelField: "llm.deepseek.default_model",
  defaultModel: "deepseek-chat",
  models: [
    "deepseek-chat",
    "deepseek-reasoner",
    "deepseek-coder",
  ],
}
```

### OpenRouter (NOVO)

```typescript
{
  id: "openrouter",
  category: "llm",
  keyField: "llm.openrouter.api_key",
  keyPlaceholder: "sk-or-••••••••",
  modelField: "llm.openrouter.default_model",
  defaultModel: "openai/gpt-4o",
  models: [
    "openai/gpt-4o",
    "anthropic/claude-opus-4-5",
    "google/gemini-2.5-pro",
    "meta-llama/llama-3.3-70b-instruct",
    "deepseek/deepseek-chat",
    "mistralai/mistral-large",
  ],
}
```

> OpenRouter unifica acesso a múltiplos provedores sob uma única chave. O modelo é enviado no formato `{provider}/{model}` conforme a API do OpenRouter.

---

## MCP Manager

### Localização

Seção adicionada ao final de `IntegrationsTab`, dentro de um `Card` dedicado.

### Estrutura de dados

Cada MCP customizado é armazenado como JSON serializado na chave de setting:

```
integrations.mcp.entries  →  JSON.stringify(MCPEntry[])
```

Tipo `MCPEntry`:

```typescript
interface MCPEntry {
  name: string; // Identificador único (ex: "my-company-mcp")
  type: "command" | "url";
  value: string; // Comando (stdio) ou URL (HTTP/SSE)
}
```

### Comportamento

- **Adicionar por command (stdio):** o operador informa nome e comando de execução (ex: `npx @modelcontextprotocol/server-github`). O MCP é invocado via stdio pelo agent-runtime.
- **Adicionar por URL (HTTP/SSE):** o operador informa nome e URL base (ex: `https://my-mcp.example.com`). O MCP é consumido via HTTP/SSE pelo agent-runtime.
- **Testar:** botão `TestButton` com `category="integrations_mcp_{name}"` por entrada — testa a conexão individualmente.
- **Remover:** botão com ícone `Trash2` — remove a entrada do array e enfileira o update em `pending`.
- **Persistência:** ao salvar, o array serializado é gravado em `integrations.mcp.entries` pelo endpoint `PATCH /api/v1/settings`.

### Renderização

```typescript
// Dentro de IntegrationsTab.tsx

function MCPManager() {
  // Ler entradas existentes de settings store
  // Formulário inline: nome + tipo (select: command | url) + valor (input)
  // Botão "Adicionar" — append ao array e enfileira pending update
  // Lista de entradas existentes com botão Testar e Remover por linha
}
```

---

## Tooltips

### Regra

Cada `<Label>` e `<CardTitle>` dentro dos componentes de settings deve ter, ao lado, um ícone `HelpCircle` (`lucide-react`) envolto em `<Tooltip>` do design system (`@/components/ui/tooltip`).

### Padrão de uso

```tsx
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Em qualquer Label ou CardTitle:
<Label className="text-xs text-muted-foreground flex items-center gap-1">
  {t("aiProviders.openai.apiKey")}
  <Tooltip>
    <TooltipTrigger asChild>
      <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help" />
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-[200px] text-xs">
      {t("aiProviders.openai.apiKeyTooltip")}
    </TooltipContent>
  </Tooltip>
</Label>;
```

### Cobertura obrigatória

| Componente        | Campos/Títulos com tooltip                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `AIProvidersTab`  | Card header de cada provider; label "API Key"; label "Modelo padrão"                                                           |
| `OllamaManager`   | Label "Pull model"; label "Modelos instalados"; label "Context window"; label "Temperature"; label "Top-p"; label "Max tokens" |
| `IntegrationsTab` | Card header de cada integração; todos os labels de campos; MCP Manager header e campos de entrada                              |
| `SystemTab`       | Label "Timeout padrão HITL"; label "Intervalo de lembrete financeiro"; label "Tamanho máximo de body"; Card header "Backup"    |

### Chaves i18n de tooltip (padrão de nomenclatura)

Para cada campo `foo`, a chave de tooltip é `foo + "Tooltip"`:

```
aiProviders.openai.apiKeyTooltip
aiProviders.openai.defaultModelTooltip
aiProviders.anthropic.apiKeyTooltip
aiProviders.deepseek.apiKeyTooltip
aiProviders.openrouter.apiKeyTooltip
ollama.pullModelTooltip
ollama.contextWindowTooltip
ollama.temperatureTooltip
ollama.topPTooltip
ollama.maxTokensTooltip
integrations.mcpManager.titleTooltip
integrations.mcpManager.nameTooltip
integrations.mcpManager.typeTooltip
integrations.mcpManager.valueTooltip
system.hitlTimeouts.defaultTimeoutTooltip
system.hitlTimeouts.financialIntervalTooltip
system.security.maxBodySizeTooltip
```

---

## Ollama Diagnóstico

### Condição de exibição

O painel de diagnóstico é renderizado no `OllamaManager` quando `status !== null && status.reachable === false`.

### Conteúdo do painel

```tsx
{
  status && !status.reachable && (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
        <AlertTriangle className="h-4 w-4" />
        {t("ollama.diagTitle")}
      </div>

      {/* Possíveis causas */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          {t("ollama.diagCausesTitle")}
        </p>
        <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
          <li>{t("ollama.diagCause1")}</li> {/* Ollama não instalado */}
          <li>{t("ollama.diagCause2")}</li> {/* Serviço não iniciado */}
          <li>{t("ollama.diagCause3")}</li> {/* Porta 11434 bloqueada */}
        </ul>
      </div>

      {/* Comandos de correção */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          {t("ollama.diagFixTitle")}
        </p>
        <code className="block text-xs font-mono bg-card rounded px-3 py-1.5 border border-border/60">
          ollama serve
        </code>
      </div>

      {/* Link de download */}
      <a
        href="https://ollama.com/download"
        target="_blank"
        rel="noreferrer"
        className="text-xs text-primary underline underline-offset-2"
      >
        {t("ollama.diagDownloadLink")}
      </a>
    </div>
  );
}
```

### Chaves i18n do painel de diagnóstico

```
ollama.diagTitle          → "Ollama inacessível"
ollama.diagCausesTitle    → "Possíveis causas:"
ollama.diagCause1         → "Ollama não está instalado nesta máquina"
ollama.diagCause2         → "O serviço Ollama não foi iniciado"
ollama.diagCause3         → "Porta 11434 bloqueada por firewall"
ollama.diagFixTitle       → "Para iniciar o serviço:"
ollama.diagDownloadLink   → "Baixar Ollama em ollama.com/download"
```

---

## Select Component

### Motivação

O `<select>` HTML nativo não respeita o tema (dark/light), possui aparência inconsistente entre sistemas operacionais e não suporta o sistema de design do projeto. Todos os `<select>` nativos nas telas de Settings são substituídos pelo componente `Select` de `@/components/ui/select` (base-ui).

### Padrão de substituição

```tsx
// ANTES (nativo):
<select
  id={`${provider.id}-model`}
  value={get(provider.modelField) || provider.defaultModel}
  onChange={(e) => set(provider.modelField, e.target.value)}
  disabled={!isEnabled(provider.id)}
  className="flex h-9 w-full rounded-md border border-input bg-transparent ..."
>
  {provider.models.map((m) => (
    <option key={m} value={m}>
      {m}
    </option>
  ))}
</select>;

// DEPOIS (design system):
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

<Select
  value={get(provider.modelField) || provider.defaultModel}
  onValueChange={(v) => set(provider.modelField, v)}
  disabled={!isEnabled(provider.id)}
>
  <SelectTrigger id={`${provider.id}-model`} className="h-9 text-sm">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {provider.models.map((m) => (
      <SelectItem key={m} value={m} className="font-mono text-sm">
        {m}
      </SelectItem>
    ))}
  </SelectContent>
</Select>;
```

### Ocorrências substituídas

| Arquivo               | Campo                                                            |
| --------------------- | ---------------------------------------------------------------- |
| `AIProvidersTab.tsx`  | Seletor de modelo padrão de cada provider (loop `PROVIDERS.map`) |
| `OllamaManager.tsx`   | Seletor "Context window" (`num_ctx`)                             |
| `IntegrationsTab.tsx` | Seletor de tipo de MCP no MCP Manager (`command` / `url`)        |

---

## Considerações de I18n

### Obrigatoriedade

Toda string visível ao usuário adicionada neste branch deve estar presente nos três arquivos de mensagens antes de abrir PR:

- `apps/web/messages/pt-BR.json` — idioma primário
- `apps/web/messages/en.json`
- `apps/web/messages/es.json`

### Novas chaves adicionadas (namespace `settings`)

```
// Provedores novos
aiProviders.deepseek.name
aiProviders.deepseek.description
aiProviders.deepseek.apiKey
aiProviders.deepseek.apiKeyTooltip
aiProviders.deepseek.defaultModel
aiProviders.deepseek.defaultModelTooltip

aiProviders.openrouter.name
aiProviders.openrouter.description
aiProviders.openrouter.apiKey
aiProviders.openrouter.apiKeyTooltip
aiProviders.openrouter.defaultModel
aiProviders.openrouter.defaultModelTooltip

// MCP Manager
integrations.mcpManager.title
integrations.mcpManager.titleTooltip
integrations.mcpManager.description
integrations.mcpManager.addButton
integrations.mcpManager.namePlaceholder
integrations.mcpManager.nameTooltip
integrations.mcpManager.typeTooltip
integrations.mcpManager.typeCommand
integrations.mcpManager.typeUrl
integrations.mcpManager.valueCommandPlaceholder
integrations.mcpManager.valueUrlPlaceholder
integrations.mcpManager.valueTooltip
integrations.mcpManager.noEntries
integrations.mcpManager.removeAriaLabel

// Diagnóstico Ollama
ollama.diagTitle
ollama.diagCausesTitle
ollama.diagCause1
ollama.diagCause2
ollama.diagCause3
ollama.diagFixTitle
ollama.diagDownloadLink

// Tooltips existentes (campos já presentes, apenas tooltip novo)
aiProviders.openai.apiKeyTooltip
aiProviders.openai.defaultModelTooltip
aiProviders.anthropic.apiKeyTooltip
aiProviders.anthropic.defaultModelTooltip
aiProviders.google.apiKeyTooltip
aiProviders.google.defaultModelTooltip
aiProviders.groq.apiKeyTooltip
aiProviders.groq.defaultModelTooltip
ollama.pullModelTooltip
ollama.contextWindowTooltip
ollama.temperatureTooltip
ollama.topPTooltip
ollama.maxTokensTooltip
integrations.mcpBrasil.transparenciaKeyTooltip
integrations.mcpBrasil.datajudKeyTooltip
integrations.mcpBrasil.metaTokenTooltip
integrations.chromadb.urlTooltip
integrations.webhooks.urlTooltip
integrations.webhooks.secretTooltip
system.hitlTimeouts.defaultTimeoutTooltip
system.hitlTimeouts.financialIntervalTooltip
system.security.maxBodySizeTooltip
```

### Exemplo de entrada (pt-BR / en / es)

```json
// pt-BR
"aiProviders": {
  "deepseek": {
    "name": "DeepSeek",
    "description": "Modelos DeepSeek Chat, Reasoner e Coder via API oficial",
    "apiKey": "Chave de API",
    "apiKeyTooltip": "Obtenha sua chave em platform.deepseek.com",
    "defaultModel": "Modelo padrão",
    "defaultModelTooltip": "Modelo usado quando nenhum modelo específico é solicitado"
  },
  "openrouter": {
    "name": "OpenRouter",
    "description": "Acesso unificado a OpenAI, Anthropic, Google, Meta e outros via uma chave",
    "apiKey": "Chave de API",
    "apiKeyTooltip": "Obtenha sua chave em openrouter.ai/keys",
    "defaultModel": "Modelo padrão",
    "defaultModelTooltip": "Formato: {provedor}/{modelo}, ex: openai/gpt-4o"
  }
}

// en
"aiProviders": {
  "deepseek": {
    "name": "DeepSeek",
    "description": "DeepSeek Chat, Reasoner and Coder models via official API",
    "apiKey": "API Key",
    "apiKeyTooltip": "Get your key at platform.deepseek.com",
    "defaultModel": "Default model",
    "defaultModelTooltip": "Model used when no specific model is requested"
  },
  "openrouter": {
    "name": "OpenRouter",
    "description": "Unified access to OpenAI, Anthropic, Google, Meta and more via one key",
    "apiKey": "API Key",
    "apiKeyTooltip": "Get your key at openrouter.ai/keys",
    "defaultModel": "Default model",
    "defaultModelTooltip": "Format: {provider}/{model}, e.g. openai/gpt-4o"
  }
}

// es
"aiProviders": {
  "deepseek": {
    "name": "DeepSeek",
    "description": "Modelos DeepSeek Chat, Reasoner y Coder vía API oficial",
    "apiKey": "Clave de API",
    "apiKeyTooltip": "Obtén tu clave en platform.deepseek.com",
    "defaultModel": "Modelo predeterminado",
    "defaultModelTooltip": "Modelo usado cuando no se solicita un modelo específico"
  },
  "openrouter": {
    "name": "OpenRouter",
    "description": "Acceso unificado a OpenAI, Anthropic, Google, Meta y más con una clave",
    "apiKey": "Clave de API",
    "apiKeyTooltip": "Obtén tu clave en openrouter.ai/keys",
    "defaultModel": "Modelo predeterminado",
    "defaultModelTooltip": "Formato: {proveedor}/{modelo}, ej: openai/gpt-4o"
  }
}
```

---

## Testes Obrigatórios

```typescript
describe('AIProvidersTab — Novos Providers') {
  it('deve renderizar card DeepSeek com keyField llm.deepseek.api_key')
  it('deve renderizar card OpenRouter com keyField llm.openrouter.api_key')
  it('deve listar modelos corretos para DeepSeek: deepseek-chat, deepseek-reasoner, deepseek-coder')
  it('deve listar modelos corretos para OpenRouter no formato {provider}/{model}')
  it('deve usar Select component (não <select> nativo) no seletor de modelo')
  it('deve exibir tooltip em API Key label de cada provider')
}

describe('MCPManager') {
  it('deve renderizar formulário de adição com campos nome, tipo e valor')
  it('deve adicionar entrada ao array e enfileirar pending update ao clicar em Adicionar')
  it('deve serializar array como JSON em integrations.mcp.entries')
  it('deve renderizar botão TestButton com category="integrations_mcp_{name}"')
  it('deve remover entrada do array ao clicar em Remover e enfileirar pending update')
  it('deve exibir estado vazio quando não houver MCPs cadastrados')
}

describe('OllamaManager — Diagnóstico') {
  it('deve exibir painel de diagnóstico quando status.reachable === false')
  it('deve ocultar painel de diagnóstico quando status.reachable === true')
  it('deve exibir as 3 causas possíveis no painel')
  it('deve exibir comando "ollama serve" no painel')
  it('deve exibir link para ollama.com/download no painel')
}

describe('Select Component') {
  it('AIProvidersTab: seletor de modelo usa SelectTrigger, não <select> nativo')
  it('OllamaManager: seletor de context window usa SelectTrigger, não <select> nativo')
  it('MCPManager: seletor de tipo usa SelectTrigger, não <select> nativo')
}

describe('I18n — Novas Chaves') {
  it('todas as chaves de deepseek estão presentes nos 3 idiomas')
  it('todas as chaves de openrouter estão presentes nos 3 idiomas')
  it('todas as chaves de mcpManager estão presentes nos 3 idiomas')
  it('todas as chaves de ollama.diag* estão presentes nos 3 idiomas')
}
```

---

## Critérios de Aceite

- [ ] Card DeepSeek aparece na aba AI Providers com os 3 modelos corretos
- [ ] Card OpenRouter aparece na aba AI Providers com os 6 modelos no formato `{provider}/{model}`
- [ ] Modelos de OpenAI, Anthropic, Google Gemini e Groq atualizados conforme listas deste spec
- [ ] Nenhum `<select>` nativo remanescente em `AIProvidersTab`, `OllamaManager` ou `IntegrationsTab`
- [ ] `Select` do design system renderiza corretamente em tema claro e escuro
- [ ] Seção MCP Manager visível no final da aba Integrations
- [ ] Adicionar MCP por command e por URL funciona e acumula pending update
- [ ] Botão testar por MCP dispara `POST /api/v1/settings/test` com categoria correta
- [ ] Botão remover por MCP atualiza o array serializado em pending
- [ ] Ícone `HelpCircle` presente ao lado de todos os labels/card headers listados
- [ ] Tooltip exibe texto correto no idioma ativo (pt-BR, en, es)
- [ ] Painel de diagnóstico Ollama exibido quando `status.reachable === false`
- [ ] Painel de diagnóstico oculto quando `status.reachable === true`
- [ ] Todas as strings novas presentes nos três arquivos de mensagens
- [ ] `npx playwright test` passa sem regressão nas telas de settings
