# SPEC-03: Agente Hunter — Prospecção Inteligente de Leads

> Versão: 2.0.0 | Fase: 1 | Dependências: SPEC-00, SPEC-02

---

## Responsabilidade

O Hunter identifica, qualifica e enriquece leads que se beneficiariam de um site
profissional. É o único ponto de entrada de novos leads no sistema.

---

## Sub-agentes e Modelos

| Sub-agente | Modelo | Modo | Grupo |
|---|---|---|---|
| PROSPECTOR | `gemini/gemini-3.5-flash` | parallel | 1 |
| SITE_INSPECTOR | `gemini/gemini-3.5-flash` | parallel | 1 |
| DATA_ENRICHER | `ollama/llama3.2:3b` | sequential | — |

---

## Fluxo Principal

```
Trigger (Schedule 09:00 ou Manual)
  │
  ├─ Carregar config do Hunter (categorias, região, min_score)
  ├─ Verificar quota do Maps (bloquear se < 100 restantes)
  │
  ├─ PARALELO (PROSPECTOR + SITE_INSPECTOR)
  │   ├─ PROSPECTOR: Google Maps → lista de negócios
  │   └─ SITE_INSPECTOR: Analisa site atual de cada candidato
  │
  ├─ SEQUENCIAL (DATA_ENRICHER)
  │   └─ MCP Brasil: validar CNPJ para cada lead
  │
  ├─ Calcular qualification score (fórmula abaixo)
  ├─ Aplicar rules (bloquear suspensos, deduplicar, etc.)
  │
  ├─ Persistir leads qualificados (status=QUALIFIED)
  ├─ Emitir LeadQualified para cada lead aprovado
  │
  └─ Criar HITL para aprovação da lista pelo operador
```

---

## Fórmula de Qualification Score

```typescript
function calculateScore(place: GooglePlace, enrichment: EnrichmentData): number {
  let score = 0;

  // PRESENÇA DIGITAL (30 pts)
  if (!enrichment.hasWebsite)                        score += 30;
  else if (enrichment.websiteQualityHint === 'outdated')    score += 20;
  else if (enrichment.websiteQualityHint === 'mobile_broken') score += 15;

  // SAÚDE DO NEGÓCIO (30 pts)
  if (enrichment.cnpjStatus === 'ATIVA')             score += 20;
  if ((enrichment.yearsInBusiness ?? 0) >= 2)        score += 10;

  // REPUTAÇÃO GOOGLE (25 pts)
  if (place.rating >= 4.5)      score += 25;
  else if (place.rating >= 4.0) score += 20;
  else if (place.rating >= 3.5) score += 10;

  // VOLUME DE AVALIAÇÕES (15 pts)
  if (place.reviewsCount >= 100)     score += 15;
  else if (place.reviewsCount >= 50) score += 10;
  else if (place.reviewsCount >= 10) score += 5;

  return Math.min(score, 100);
}
```

---

## Rules (CEL) — Avaliadas na Ordem

```typescript
const HUNTER_RULES: Rule[] = [
  {
    name: 'block_suspended_cnpj',
    condition: "enrichment.cnpjStatus IN ['SUSPENSA','INAPTA','BAIXADA']",
    action: 'BLOCK',
    priority: 1,
    blockReason: 'block_suspended_cnpj',
  },
  {
    name: 'block_government',
    condition: "lead.sector == 'GOVERNMENT'",
    action: 'BLOCK',
    priority: 2,
    blockReason: 'government_entity',
  },
  {
    name: 'deduplicate_30_days',
    condition: "existingLead.mapsPlaceId == lead.mapsPlaceId AND existingLead.lastContactedAt > NOW() - 30d",
    action: 'BLOCK',
    priority: 3,
    blockReason: 'duplicate_within_30_days',
  },
  {
    name: 'min_score_threshold',
    condition: "lead.qualificationScore < agentConfig.minScore",
    action: 'LOG',
    priority: 10,
  },
  {
    name: 'rate_limit_scraping',
    condition: "agent.requestsInLastMinute > 30",
    action: 'BLOCK',
    priority: 1,
  },
];
```

---

## Google Maps Adapter — Interface Exata

```typescript
// infrastructure/maps/GoogleMapsAdapter.ts

interface LeadSearchParams {
  query: string;                // Ex: "restaurante Salvador BA"
  includedTypes: string[];      // Ex: ['restaurant', 'food']
  locationCenter: { lat: number; lng: number };
  radiusMeters: number;
  maxResults: number;           // Máx 20 por request na API
  languageCode: 'pt-BR';
}

interface GooglePlace {
  id: string;
  displayName: string;
  formattedAddress: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;          // undefined = lead quente
  rating?: number;
  reviewsCount?: number;
  primaryType?: string;
  openingHours?: { weekdayDescriptions: string[] };
}

// Campos solicitados na API (FieldMask):
const REQUIRED_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
  'places.regularOpeningHours',
].join(',');
```

---

## MCP Brasil Adapter — Interface Exata

```typescript
// infrastructure/mcp/MCPBrasilAdapter.ts

interface CNPJData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacaoCadastral: 'ATIVA' | 'SUSPENSA' | 'INAPTA' | 'BAIXADA' | 'NULA';
  dataAbertura: string;          // 'YYYY-MM-DD'
  naturezaJuridica: string;
  cnaePrincipal: { codigo: string; descricao: string };
  endereco: {
    logradouro: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
  };
  telefone?: string;
  email?: string;
}

interface CEPData {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
}

// MCP Brasil é chamado via HTTP para o container mcp-brasil
// Tool: brasilapi_consultar_cnpj → retorna CNPJData
// Tool: brasilapi_consultar_cep  → retorna CEPData
```

---

## EnrichmentData Value Object — Especificação

```typescript
// domain/lead/EnrichmentData.ts

class EnrichmentData {
  constructor(private readonly props: {
    cnpj?: string;
    cnpjStatus?: 'ATIVA' | 'SUSPENSA' | 'INAPTA' | 'BAIXADA' | 'NULA';
    yearsInBusiness?: number;
    googleMapsPlaceId?: string;
    googleRating?: number;
    googleReviewsCount?: number;
    hasWebsite: boolean;
    websiteQualityHint?: 'modern' | 'outdated' | 'mobile_broken' | 'none';
    neighborhood?: string;
    city?: string;
    state?: string;
  }) {}

  get cnpj()              { return this.props.cnpj; }
  get cnpjStatus()        { return this.props.cnpjStatus; }
  get yearsInBusiness()   { return this.props.yearsInBusiness; }
  get googleMapsPlaceId() { return this.props.googleMapsPlaceId; }
  get googleRating()      { return this.props.googleRating; }
  get googleReviewsCount(){ return this.props.googleReviewsCount; }
  get hasWebsite()        { return this.props.hasWebsite; }

  isCNPJActive(): boolean {
    return this.props.cnpjStatus === 'ATIVA';
  }

  isEstablished(): boolean {
    return (this.props.yearsInBusiness ?? 0) >= 2;
  }

  qualificationBonus(): number {
    let bonus = 0;
    if (this.isCNPJActive())    bonus += 20;
    if (this.isEstablished())   bonus += 10;
    if ((this.props.googleRating ?? 0) >= 4.0) bonus += 15;
    if ((this.props.googleReviewsCount ?? 0) >= 50) bonus += 10;
    return bonus;
  }

  toJSON(): Record<string, unknown> {
    return { ...this.props };
  }
}
```

---

## Cache Strategy — Maps

```typescript
// Cache key: maps:{category}:{lat}:{lng}:{radius}:{date}
// TTL: 86400s (24h)
// Razão: resultados do Maps mudam pouco num dia
// Benefício: economiza quota (2500/dia free)

function buildMapsCacheKey(params: LeadSearchParams): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const lat  = params.locationCenter.lat.toFixed(4);
  const lng  = params.locationCenter.lng.toFixed(4);
  return `maps:${params.includedTypes.join('-')}:${lat}:${lng}:${params.radiusMeters}:${date}`;
}
```

---

## Deduplicação de Leads

```typescript
// Regra: não prospectar o mesmo Place ID dentro de 30 dias

async function isDuplicate(mapsPlaceId: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(sql`enrichment_data->>'maps_place_id'`, mapsPlaceId),
        gt(leads.createdAt, sql`NOW() - INTERVAL '30 days'`)
      )
    )
    .limit(1);

  return existing.length > 0;
}
```

---

## API Endpoints

### POST /api/v1/prospecting/search-maps
**Trigger manual de prospecção**

```typescript
// Request
{
  categories: string[];        // ['restaurant', 'beauty_salon']
  region: {
    city: string;              // 'Salvador'
    state: string;             // 'BA'
    radiusKm: number;          // 10
  };
  minScore?: number;           // default: 40
  limit?: number;              // default: 50, max: 200
}

// Response 202 Accepted (processamento assíncrono)
{
  data: {
    jobId: string;
    estimatedDurationSeconds: number;
    webhookCallbackUrl: string;  // onde o resultado será postado
  }
}
```

### GET /api/v1/prospecting/queue
**Leads qualificados aguardando HITL**

```typescript
// Response 200
{
  data: {
    leads: Array<{
      id: string;
      contactName: string;       // mascarado nos 3 primeiros chars
      businessName: string;
      qualificationScore: number;
      source: 'GOOGLE_MAPS';
      enrichmentData: {
        cnpjStatus: string;
        googleRating: number;
        googleReviewsCount: number;
        hasWebsite: boolean;
        city: string;
        state: string;
      };
      mapsUrl?: string;          // Link para o Maps do negócio
      createdAt: string;
    }>;
  };
  meta: { total: number; pending_hitl: number };
}
```

### GET /api/v1/prospecting/config
**Configuração atual da prospecção**

```typescript
// Response 200
{
  data: {
    categories: string[];
    region: { city: string; state: string; radiusKm: number };
    minScore: number;
    scheduleTime: string;        // '09:00'
    scheduleDays: string[];      // ['mon','tue','wed','thu','fri']
    mapsQuotaRemaining: number;  // da API do Maps
    mapsQuotaLimit: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
  }
}
```

### PATCH /api/v1/prospecting/config
```typescript
// Request (todos os campos opcionais)
{
  categories?: string[];
  region?: { city?: string; state?: string; radiusKm?: number };
  minScore?: number;             // 0-100
  scheduleTime?: string;         // 'HH:MM'
  scheduleDays?: string[];
}
```

---

## Python — Hunter Agent

```python
# apps/agent-runtime/src/agents/hunter/hunter_agent.py

from crewai import Agent, Task, Crew, Process
from .sub_agents.prospector import ProspectorSubAgent
from .sub_agents.site_inspector import SiteInspectorSubAgent
from .sub_agents.data_enricher import DataEnricherSubAgent

class HunterAgent:
    def __init__(self, config: AgentConfig, secrets: dict):
        self.prospector    = ProspectorSubAgent(config, secrets)
        self.site_inspector= SiteInspectorSubAgent(config, secrets)
        self.data_enricher = DataEnricherSubAgent(config, secrets)
        self.api_client    = APIClient(config.api_url)

    async def run(self, params: HunterRunParams) -> HunterResult:
        # FASE 1: PARALELO — Prospector e SiteInspector juntos
        parallel_tasks = [
            Task(
                description=f"Buscar negócios na categoria {params.categories} em {params.region}",
                agent=self.prospector.crewai_agent,
                async_execution=True,
            ),
        ]

        parallel_crew = Crew(
            agents=[self.prospector.crewai_agent, self.site_inspector.crewai_agent],
            tasks=parallel_tasks,
            process=Process.sequential,
            verbose=True,
        )
        parallel_results = parallel_crew.kickoff()
        places = self._parse_places(parallel_results)

        # FASE 2: SEQUENTIAL — Data Enricher (precisa da lista do Prospector)
        enriched_leads = []
        for place in places:
            enrichment = await self.data_enricher.execute({
                'place': place,
                'correlationId': params.correlation_id,
            })
            enriched_leads.append({ 'place': place, 'enrichment': enrichment })

        # FASE 3: Scoring e Filtering
        qualified = []
        blocked = []
        for lead_data in enriched_leads:
            score = self._calculate_score(lead_data)
            blocked_by = self._check_rules(lead_data)

            if blocked_by:
                blocked.append({ **lead_data, 'blockReason': blocked_by })
                continue

            if score >= params.min_score:
                qualified.append({ **lead_data, 'score': score })

        # FASE 4: Persistir e criar HITL
        await self.api_client.create_leads_batch(qualified)
        await self.api_client.create_hitl({
            'actionType': 'APPROVE_LEAD_LIST',
            'payload': { 'qualified': len(qualified), 'blocked': len(blocked) },
        })

        return HunterResult(
            qualified=qualified,
            blocked=blocked,
            total_found=len(places),
        )
```

---

## Testes Obrigatórios

```typescript
// Unit tests — LeadQualificationService
describe('LeadQualificationService', () => {
  it('deve retornar 85 para lead sem site + CNPJ ativo + rating 4.8 + 200 reviews')
  it('deve retornar 0 para lead com site moderno + CNPJ suspenso + rating baixo')
  it('deve nunca exceder 100')
  it('deve nunca ser negativo')
  it('deve considerar todos os 4 critérios independentemente')
});

// Integration tests — GoogleMapsAdapter
describe('GoogleMapsAdapter', () => {
  it('deve retornar array vazio para categoria sem resultados')
  it('deve filtrar places com website quando filtro ativo')
  it('deve usar cache em busca repetida com mesmos parâmetros')
  it('deve renovar cache após TTL expirado')
  it('deve lançar QuotaExceededError quando remaining < 0')
  it('deve lançar ExternalServiceError para 4xx da API do Maps')
});

// Integration tests — MCPBrasilAdapter
describe('MCPBrasilAdapter', () => {
  it('deve retornar CNPJData correta para CNPJ ativo válido')
  it('deve retornar situacaoCadastral SUSPENSA para CNPJ suspenso')
  it('deve retornar null para CNPJ inválido')
  it('deve usar cache de 7 dias para CNPJ já consultado')
});

// Security test
describe('Hunter Security', () => {
  it('SSRF: deve bloquear URL interna no campo de configuração de região')
  it('deve requerer HITL antes de qualquer ação externa')
  it('deve mascarar telefone e email do lead no payloadPreview do HITL')
});
```

---

## Critérios de Aceite Finais

- [ ] Hunter executa via API e via schedule automático
- [ ] PROSPECTOR e SITE_INSPECTOR rodam em paralelo (verificar logs de timing)
- [ ] DATA_ENRICHER roda após o paralelo (verificar sequência nos logs)
- [ ] CNPJ suspenso → lead bloqueado (nenhum HITL criado)
- [ ] Lead com mesmo Maps Place ID nos últimos 30 dias → ignorado
- [ ] Score calculado corretamente conforme fórmula acima
- [ ] Cache do Maps funciona (2ª chamada com mesmos params < 5ms)
- [ ] HITL criado com PII mascarado no preview
- [ ] Operador recebe notificação no Telegram com botões inline
- [ ] Aprovação da lista dispara LeadApprovedForContact para o Closer
