# BRAND.md — Identidade de Marca Hefesto

> Guia de identidade para contribuidores. Toda contribuição de UI, copy, docs ou
> nomenclatura interna deve respeitar este documento. Em caso de conflito entre
> uma escolha visual/verbal e este guia, **o guia vence** — abra uma issue para
> propor mudanças, não desvie em silêncio.

---

## A narrativa

**Hefesto** é o deus ferreiro da mitologia grega — o artífice que forjava
autômatos de ouro que trabalhavam sozinhos. É a metáfora exata do produto:
_você acende a forja, os autômatos cuidam do resto._

> **Narrativa central (imutável):**
> "Você é o artífice. Os agentes são seus autômatos. A forja nunca para."

> **Voz do produto (1ª pessoa):**
> "A Fornalha processa. Os Autômatos agem. Você colhe."

---

## Nomenclatura mítica

O universo da Forja dá nome aos conceitos do produto. Use estes termos em copy,
docs e UI voltada ao usuário.

| Conceito (técnico)             | Nome de marca         | Inglês (código)         |
| ------------------------------ | --------------------- | ----------------------- |
| Agentes de IA                  | **Autômatos**         | `Automaton`             |
| Motor de processamento         | **A Fornalha**        | `Furnace`               |
| Painel de controle             | **A Bigorna**         | `Anvil`                 |
| Intervenção manual (HITL)      | **A Mão do Artífice** | `ArtificerIntervention` |
| Usuário/operador               | **O Artífice**        | —                       |
| Capacidade paga (mais agentes) | **Poder de forja**    | —                       |

> **Estado da nomenclatura no código (2026-06):** a rebrand de _strings_ e do
> escopo npm (`@hefesto/*`) está concluída. O **rename dos identificadores
> internos** para os nomes míticos (`Automaton`, `Furnace`, `Anvil`,
> `ArtificerIntervention`) é um refactor de arquitetura limpa que cruza domínio,
> aplicação e testes — está **planejado como follow-up** para não acoplar um
> rename de marca a um refactor de classes em um único PR. Veja
> [ARCHITECTURE.md](ARCHITECTURE.md) e [LAUNCH.md](LAUNCH.md).

---

## Paleta

| Token           | Hex       | Uso                             |
| --------------- | --------- | ------------------------------- |
| `--forge-black` | `#0D0D0D` | Background principal            |
| `--ember`       | `#C84B11` | CTA, destaques, ícones de ação  |
| `--bronze`      | `#A0622A` | Elementos secundários, bordas   |
| `--gold`        | `#D4A017` | Títulos premium, badges de tier |
| `--smoke`       | `#2A2A2A` | Superfícies de card             |
| `--ash`         | `#8A8A8A` | Texto auxiliar                  |

A base é escura (a forja). O **ember** é a única cor "quente de ação" — reserve-o
para o que o usuário deve clicar. O **gold** sinaliza tiers/premium; não o use em
texto corrido.

---

## Tipografia

- **Display / headlines:** serifada ou slab com peso alto — _Playfair Display
  Bold_ ou _Bitter ExtraBold_. Transmite o peso do mito e do ofício.
- **UI / corpo:** sans-serif limpa — _Inter_ ou _DM Sans_.
- **Código:** monospace — _JetBrains Mono_ ou _Fira Code_.

---

## Iconografia

- Elementos recorrentes: **bigorna, martelo, fagulha/brasa**.
- **Evite** robôs genéricos, engrenagens clichê e "AI sparkles" de stock.
- Prefira formas míticas/artesanais: a fagulha que salta da bigorna, o metal
  incandescente, a silhueta do ferreiro.

---

## Tom de voz

- **Confiante, mítico, técnico sem ser frio.**
- Fala em 1ª pessoa do produto quando descreve o que faz a Fornalha/Autômatos.
- **Nunca** prometa "enriquecimento rápido", "ganhe dinheiro fácil" ou renda
  garantida. Posicione como **poder de automação**, não como esquema.
- Honestidade técnica acima de hype: se algo exige chave de API ou setup, diga.

### O que evitar

- ❌ "Fique rico", "renda passiva garantida", "dinheiro no automático sem esforço"
- ❌ ALL CAPS em headlines, excesso de `!!!`, emojis em cascata
- ❌ Robôs genéricos / estética de stock de IA
- ❌ Misturar o nome antigo (ProspectFlow / AgentePro) em qualquer material novo
- ✅ "Você acende a forja uma vez. Os Autômatos não dormem."
- ✅ "A Mão do Artífice: você aprova antes de cada envio externo."

---

## Conformidade na comunicação

Todo material público (landing, README, posts) deve deixar claro que o outreach é
**ético e opt-in / baseado em dados públicos** — nunca prometa "envio em massa".
Veja a seção de Conformidade no [README.md](README.md) e os riscos em
[hefesto-rebranding.md](hefesto-rebranding.md).

---

## Checklist para um novo material de marca

- [ ] Usa a narrativa central sem contradizê-la?
- [ ] Usa os nomes míticos (Autômatos/Fornalha/Bigorna/Mão do Artífice) onde cabe?
- [ ] Respeita a paleta (ember só para ação, gold só para tier)?
- [ ] Tom confiante e técnico, **sem** promessa de enriquecimento?
- [ ] Zero rastro de "ProspectFlow" ou "AgentePro"?
- [ ] Outreach descrito como ético/opt-in?
