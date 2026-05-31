# SPEC-05: Briefing Agent — Coleta de Requisitos

> Versão: 2.0.0 | Fase: 2 | Dependências: SPEC-04 (Closer), SPEC-11 (Messaging)

---

## Responsabilidade

Coletar todos os requisitos necessários para criar o site após o deal ser fechado.
Separado do Closer propositalmente — contextos e modelos mentais diferentes.
Gerar um `ClientBriefingDTO` estruturado e validado para consumo do Builder.

---

## Por que separado do Closer

O Closer pensa em **fechar vendas**: persuasão, objeções, preços.  
O Briefing pensa em **entender o cliente**: empatia, detalhes, requisitos.  
Misturar os dois deteriora a qualidade de ambos e aumenta o contexto da janela.

---

## Sub-agentes

| Sub-agente | Modelo | Função |
|---|---|---|
| INTERVIEWER | `claude-sonnet-4-6` | Conduz entrevista adaptativa no canal do cliente |
| BRIEF_EXTRACTOR | `claude-haiku-4-5-20251001` | Converte transcrição em JSON estruturado |

---

## Fluxo

```
Trigger: DomainEvent[DealClosed]
│
├─ Criar registro Briefing (status: IN_PROGRESS)
├─ Carregar template de perguntas por nicho (RAG: briefing_templates_by_niche)
│
├─ INTERVIEWER: conduz entrevista via WhatsApp/Telegram/Email
│   ├─ Apresentação amigável: "Ótima notícia! Vamos agora coletar as informações..."
│   ├─ Perguntas adaptativas por nicho (5–10 perguntas)
│   ├─ Receber fotos/logo (asset_receiver — validar magic bytes)
│   └─ Confirmar ao final: "Perfeito! Tenho tudo que preciso."
│
├─ BRIEF_EXTRACTOR: gera ClientBriefingDTO (JSON)
│   ├─ Valida todos os campos obrigatórios
│   ├─ Salva transcrição bruta no vault (criptografado — PII)
│   └─ Salva JSON estruturado no banco
│
├─ Emitir BriefingCompleted
├─ HITL (opcional): operador revisa JSON antes de passar ao Builder
└─ Emitir BriefingApproved → Builder Agent recebe
```

---

## INTERVIEWER — Templates por Nicho

```python
# Carregado do ChromaDB via RAG (collection: briefing_templates_by_niche)

BRIEFING_INTRO = """
Oi {contactName}! 🎉 Que bom que decidimos trabalhar juntos!
Agora vou fazer algumas perguntas rápidas para criar o site perfeito para {businessName}.
São só {questionCount} perguntinhas, prometo que é rápido!
"""

BRIEFING_TEMPLATES = {
    'restaurant': {
        'intro_context': "Para criar um site incrível para o restaurante",
        'questions': [
            ("nome_tipo", "Qual o nome completo do restaurante e que tipo de culinária vocês fazem?"),
            ("delivery", "Vocês fazem delivery? Se sim, como o cliente pede — pelo iFood, Rappi ou direto?"),
            ("horario", "Qual o horário de funcionamento? (ex: Ter–Dom, 18h–23h)"),
            ("cardapio", "Têm cardápio digital? Posso receber as fotos dos pratos principais?"),
            ("endereco", "Qual o endereço completo? Tem estacionamento?"),
            ("diferencial", "O que faz o {name} especial comparado aos outros restaurantes?"),
            ("logo_fotos", "Têm logo e fotos profissionais do espaço? Podem me enviar?"),
            ("whatsapp", "Qual o WhatsApp para os clientes entrarem em contato?"),
        ],
        'optional': [
            ("reservas", "Vocês aceitam reservas? Como funciona hoje?"),
            ("eventos", "Fazem eventos/festas particulares?"),
        ],
    },

    'clinic': {
        'intro_context': "Para criar um site profissional para a clínica",
        'questions': [
            ("nome_especialidades", "Qual o nome da clínica e quais especialidades são atendidas?"),
            ("convenio", "Atendem por convênio ou particular? Quais convênios?"),
            ("agendamento", "Gostariam de sistema de agendamento online integrado ao site?"),
            ("equipe", "Quantos profissionais trabalham na clínica? Têm fotos para o site?"),
            ("horario", "Qual o horário de atendimento?"),
            ("endereco", "Qual o endereço completo?"),
            ("logo_fotos", "Têm logo e fotos da clínica/consultório?"),
            ("diferencial", "Qual o diferencial da clínica?"),
        ],
        'optional': [
            ("telemedicina", "Oferecem teleconsulta?"),
            ("blog", "Gostariam de publicar artigos de saúde no site?"),
        ],
    },

    'salon': {
        'intro_context': "Para criar um site lindo para o salão",
        'questions': [
            ("nome_servicos", "Qual o nome do salão e quais são os serviços oferecidos?"),
            ("agendamento", "Gostariam que os clientes agendassem horário online pelo site?"),
            ("diferencial", "Qual o diferencial do salão?"),
            ("portfolio", "Têm fotos de trabalhos realizados (antes/depois, penteados, etc.)?"),
            ("horario", "Qual o horário de funcionamento?"),
            ("endereco", "Qual o endereço?"),
            ("logo", "Têm logo do salão?"),
        ],
    },

    'lawyer': {
        'intro_context': "Para criar um site profissional para o escritório",
        'questions': [
            ("nome_areas", "Qual o nome do escritório e as áreas de atuação?"),
            ("contato", "Os clientes preferem contato por WhatsApp ou formulário no site?"),
            ("blog", "Gostariam de publicar artigos jurídicos no site?"),
            ("oab", "Qual o número da OAB? Posso incluir no site."),
            ("equipe", "Quantos advogados? Têm fotos profissionais?"),
            ("diferencial", "O que diferencia o escritório?"),
            ("logo", "Têm logo?"),
        ],
    },

    'gym': {
        'intro_context': "Para criar um site energético para a academia",
        'questions': [
            ("nome_modalidades", "Qual o nome da academia e quais modalidades oferece?"),
            ("planos", "Quais os planos disponíveis e valores?"),
            ("agendamento", "Gostariam de agendamento de aula experimental online?"),
            ("estrutura", "Quais equipamentos e estrutura têm? Têm fotos?"),
            ("horario", "Qual o horário de funcionamento?"),
            ("endereco", "Qual o endereço?"),
            ("logo", "Têm logo?"),
        ],
    },

    'default': {
        'intro_context': "Para criar o site perfeito para o seu negócio",
        'questions': [
            ("nome_descricao", "Qual o nome e o que o negócio faz exatamente?"),
            ("publico", "Quem são os clientes principais?"),
            ("servicos_produtos", "Quais são os principais serviços ou produtos?"),
            ("diferencial", "O que diferencia você dos concorrentes?"),
            ("contato", "Como os clientes entram em contato hoje?"),
            ("horario_endereco", "Qual o horário e endereço (se tiver)?"),
            ("logo_fotos", "Têm logo e fotos para o site?"),
            ("referencias", "Têm algum site que gostam e queriam como referência?"),
        ],
    },
}
```

---

## BRIEF_EXTRACTOR — Geração do ClientBriefingDTO

```python
EXTRACTION_SYSTEM_PROMPT = """
Você é um especialista em extrair informações estruturadas de conversas.
A partir da transcrição de entrevista abaixo, extraia TODAS as informações
e gere um JSON válido conforme o schema ClientBriefingDTO.

REGRAS:
- Se uma informação não foi mencionada, use null ou false (não invente)
- businessName e siteType são OBRIGATÓRIOS (se ausentes, lançar erro)
- pages: inferir as páginas necessárias baseado nas respostas
- Inferir niche a partir do contexto do negócio
- deliveryDays: sempre 3 se não especificado

Responda APENAS com o JSON. Sem explicações. Sem markdown. JSON puro.
"""

# ClientBriefingDTO - schema completo
BRIEFING_DTO_SCHEMA = {
    "businessName":        str,       # OBRIGATÓRIO
    "businessDescription": str,
    "niche":               str,       # restaurant|clinic|salon|lawyer|gym|...
    "targetAudience":      str,
    "siteType":            str,       # OBRIGATÓRIO: institutional|ecommerce|scheduling|portfolio|landing
    "pages":               list[str], # ['home','sobre','servicos','contato',...]
    "colorPreferences":    list[str],
    "fontStyle":           str,       # modern|classic|bold|minimal (default: modern)
    "differentials":       list[str],
    "hasEcommerce":        bool,
    "hasBlog":             bool,
    "hasCustomForm":       bool,
    "hasScheduling":       bool,
    "hasWhatsAppButton":   bool,
    "needsCopywriting":    bool,      # True se cliente quer textos profissionais
    "deliveryDays":        int,
    "contactPhone":        str,
    "contactWhatsApp":     str,
    "address":             str,
    "openingHours":        str,
    "socialLinks":         dict,      # {"instagram": "url", "facebook": "url"}
    "logoProvided":        bool,
    "photosProvided":      bool,
    "referenceWebsites":   list[str],
}
```

---

## Asset Receiver — Validação de Magic Bytes

```typescript
// infrastructure/briefing/AssetReceiver.ts

class AssetReceiver {
  async receiveFromWhatsApp(mediaId: string, briefingId: string): Promise<BriefingAsset> {
    // 1. Baixar mídia da Evolution API
    const mediaBuffer = await this.evolutionApi.downloadMedia(mediaId);

    // 2. OBRIGATÓRIO: validar magic bytes
    await this.validateMagicBytes(mediaBuffer);

    // 3. Verificar tamanho (max 10MB)
    if (mediaBuffer.length > 10 * 1024 * 1024) {
      throw new ValidationError('Arquivo muito grande. Máximo: 10MB.');
    }

    // 4. Armazenar e retornar referência
    const storagePath = await this.storage.save(
      mediaBuffer,
      `briefings/${briefingId}/${randomUUID()}`
    );

    return new BriefingAsset({
      fileName: `asset_${Date.now()}`,
      mimeType: (await fileTypeFromBuffer(mediaBuffer))!.mime,
      sizeBytes: mediaBuffer.length,
      storagePath,
      magicBytesValidated: true,
    });
  }

  private async validateMagicBytes(buffer: Buffer): Promise<void> {
    const detected = await fileTypeFromBuffer(buffer.slice(0, 12));
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

    if (!detected || !ALLOWED.includes(detected.mime)) {
      throw new SecurityError(
        `Tipo de arquivo não permitido: ${detected?.mime ?? 'desconhecido'}. ` +
        `Aceitos: ${ALLOWED.join(', ')}`
      );
    }
  }
}
```

---

## Validação do ClientBriefingDTO

```typescript
// domain/briefing/ClientBriefingDTOValidator.ts

const ClientBriefingSchema = z.object({
  businessName:       z.string().min(2).max(200),
  businessDescription:z.string().optional(),
  niche:              z.string().min(2),
  targetAudience:     z.string().optional(),
  siteType:           z.enum(['institutional','ecommerce','scheduling','portfolio','landing']),
  pages:              z.array(z.string()).min(1).max(20),
  colorPreferences:   z.array(z.string()).default([]),
  fontStyle:          z.enum(['modern','classic','bold','minimal']).default('modern'),
  differentials:      z.array(z.string()).default([]),
  hasEcommerce:       z.boolean().default(false),
  hasBlog:            z.boolean().default(false),
  hasCustomForm:      z.boolean().default(false),
  hasScheduling:      z.boolean().default(false),
  hasWhatsAppButton:  z.boolean().default(true),
  needsCopywriting:   z.boolean().default(true),
  deliveryDays:       z.number().min(1).max(30).default(3),
  contactPhone:       z.string().optional(),
  contactWhatsApp:    z.string().optional(),
  address:            z.string().optional(),
  openingHours:       z.string().optional(),
  socialLinks:        z.record(z.string()).default({}),
  logoProvided:       z.boolean().default(false),
  photosProvided:     z.boolean().default(false),
  referenceWebsites:  z.array(z.string().url()).default([]),
});
```

---

## Database Schema

```sql
CREATE TYPE briefing_status AS ENUM ('IN_PROGRESS', 'COMPLETED', 'APPROVED');
CREATE TYPE site_type AS ENUM ('institutional','ecommerce','scheduling','portfolio','landing');

CREATE TABLE briefings (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id              UUID NOT NULL REFERENCES deals(id),
    lead_id              UUID NOT NULL REFERENCES leads(id),
    operator_id          UUID NOT NULL REFERENCES operators(id),
    agent_id             UUID REFERENCES agents(id),
    status               briefing_status NOT NULL DEFAULT 'IN_PROGRESS',
    niche                TEXT,
    site_type            site_type,
    structured_brief     JSONB NOT NULL DEFAULT '{}',  -- ClientBriefingDTO
    transcript_vault_ref TEXT,                          -- Ref ao vault (PII)
    uploaded_assets      JSONB NOT NULL DEFAULT '[]',
    completed_at         TIMESTAMPTZ,
    approved_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE briefing_assets (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    briefing_id           UUID NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
    file_name             TEXT NOT NULL,
    mime_type             TEXT NOT NULL,
    size_bytes            INTEGER NOT NULL,
    storage_path          TEXT NOT NULL,
    magic_bytes_validated BOOLEAN NOT NULL DEFAULT false,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_briefings_deal ON briefings(deal_id);
CREATE INDEX idx_briefings_status ON briefings(status);
```

---

## HTTP Endpoints

```
GET    /api/v1/briefings
  Query: status?, limit?, cursor?

GET    /api/v1/briefings/:id
  Response: { data: { ...briefing, structuredBrief: ClientBriefingDTO } }

PATCH  /api/v1/briefings/:id/approve
  Body: {} ou { notes?: string }
  Efeito: status → APPROVED, emite BriefingApproved

POST   /api/v1/briefings/:id/assets
  Multipart: file (imagem, max 10MB)
  Validação: magic bytes obrigatória
  Response 201: { data: BriefingAsset }
```

---

## Testes Obrigatórios

```python
def test_interviewer_uses_restaurant_questions_for_restaurant()
def test_interviewer_uses_clinic_questions_for_clinic()
def test_interviewer_asks_about_scheduling_for_clinic()
def test_interviewer_does_not_ask_about_menu_for_lawyer()
def test_brief_extractor_generates_valid_dto_from_transcript()
def test_brief_extractor_marks_logo_provided_when_sent()
def test_brief_extractor_infers_scheduling_site_type_for_clinic()
def test_brief_extractor_raises_error_when_business_name_missing()

def test_asset_receiver_rejects_exe_as_jpeg()
def test_asset_receiver_rejects_file_over_10mb()
def test_asset_receiver_accepts_valid_jpeg()
def test_asset_receiver_accepts_valid_png()
```

```typescript
describe('Briefing.complete()') {
  it('deve emitir BriefingCompleted com JSON válido')
  it('deve lançar ValidationError para JSON sem businessName')
  it('deve lançar ValidationError para JSON sem siteType')
}

describe('Briefing.approve()') {
  it('deve emitir BriefingApproved quando COMPLETED')
  it('deve lançar DomainError quando ainda IN_PROGRESS')
}
```

---

## Critérios de Aceite

- [ ] INTERVIEWER usa perguntas específicas por nicho (restaurante ≠ clínica ≠ advogado)
- [ ] Perguntas sobre cardápio NUNCA aparecem em briefing de clínica
- [ ] BRIEF_EXTRACTOR gera JSON válido segundo ClientBriefingDTO schema
- [ ] Transcrição bruta salva no vault (não no banco principal)
- [ ] Assets (logo, fotos) validados com magic bytes antes de salvar
- [ ] Asset > 10MB rejeitado com mensagem clara
- [ ] Operador pode revisar o JSON via HITL antes de passar ao Builder
- [ ] BriefingApproved event dispara o Builder Agent
