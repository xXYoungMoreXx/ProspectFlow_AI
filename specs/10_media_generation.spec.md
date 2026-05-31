# SPEC-10: MediaGenerationService — Nano Banana Pro + Fallback

> Versão: 2.0.0 | Fase: 2 | Dependências: SPEC-00

## Responsabilidade

Gerar imagens profissionais para os sites dos clientes.
Provider primário: Nano Banana Pro (Gemini 3 Pro Image).
Fallback automático: DALL-E 3 → Ollama LLaVA.

## Interface de Domínio

```typescript
// domain/media/MediaGenerationPort.ts
interface MediaGenerationPort {
  generateImage(prompt: ImagePrompt, options: ImageOptions): Promise<GeneratedAsset>;
  validateGeneratedImage(bytes: Buffer): Promise<void>;
}

interface ImagePrompt {
  description: string;
  style: 'photorealistic' | 'illustration' | 'minimal' | 'bold';
  businessContext: string;
  niche: string;
  colorScheme: string[];
  textToInclude?: string;
}

interface ImageOptions {
  resolution: '1K' | '2K' | '4K';
  aspectRatio: '16:9' | '1:1' | '4:3' | '9:16';
  format: 'webp' | 'jpeg' | 'png';
  provider?: 'nano_banana_pro' | 'dalle3' | 'ollama';
}
```

## Validação de Magic Bytes — OBRIGATÓRIA

```typescript
// SEMPRE validar magic bytes, mesmo de APIs confiáveis
async function validateGeneratedImage(bytes: Buffer): Promise<void> {
  const VALID_MAGIC = {
    webp: Buffer.from('RIFF'),
    jpeg: Buffer.from([0xff, 0xd8, 0xff]),
    png:  Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  };

  const header = bytes.slice(0, 4);
  const isValid = Object.values(VALID_MAGIC)
    .some(magic => bytes.slice(0, magic.length).equals(magic));

  if (!isValid) {
    throw new SecurityError(`Magic bytes inválidos: ${header.toString('hex')}`);
  }

  // Polyglot attack detection
  const preview = bytes.slice(0, 200).toString('latin1');
  if (preview.includes('<script') || preview.includes('<?php')) {
    throw new SecurityError('Arquivo suspeito detectado — script embutido');
  }
}
```

## Fallback Chain

```typescript
class MediaGenerationRouter implements MediaGenerationPort {
  private readonly chain = [
    { name: 'nano_banana_pro', adapter: this.nanaBanana },
    { name: 'dalle3',          adapter: this.dalle },
    { name: 'ollama',          adapter: this.ollamaVision },
  ];

  async generateImage(prompt: ImagePrompt, options: ImageOptions): Promise<GeneratedAsset> {
    let lastError: Error | undefined;

    for (const { name, adapter } of this.chain) {
      try {
        const asset = await adapter.generateImage(prompt, options);
        await this.validateGeneratedImage(asset.rawBytes);
        this.metrics.increment('media_generation_total', { provider: name, status: 'success' });
        return asset;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn({ provider: name, error: lastError.message }, 'provider_failed_trying_next');
        this.metrics.increment('media_generation_total', { provider: name, status: 'failed' });
      }
    }

    throw new MediaGenerationError('Todos os providers falharam', lastError);
  }
}
```

## Prompts por Nicho e Tipo

```typescript
const PROMPT_TEMPLATES = {
  hero: {
    restaurant: "Professional hero for restaurant {name}. Warm, artisanal, inviting. Colors: {colors}. Food photography style.",
    clinic:     "Professional hero for medical clinic {name}. Clean, modern, trustworthy. Colors: {colors}.",
    salon:      "Elegant hero for beauty salon {name}. Stylish, professional. Colors: {colors}.",
    lawyer:     "Formal hero for law firm {name}. Trustworthy, professional. Colors: {colors}. Office setting.",
    gym:        "Energetic hero for gym {name}. Motivational, active. Colors: {colors}.",
    default:    "Professional hero for {niche} business {name}. Colors: {colors}. Modern, clean.",
  },
  about: {
    restaurant: "Warm team photo in restaurant kitchen. Chef and staff smiling.",
    clinic:     "Medical professionals in clinic. Approachable, competent.",
    default:    "Professional team photo for {niche}. Warm, trustworthy.",
  },
  service_icon: {
    default: "Minimal flat icon for '{service}' ({niche}). Color: {primary_color}. Simple, modern.",
  },
};
```

## Testes Obrigatórios

```typescript
describe('MediaGenerationRouter') {
  it('usa NanaBanana como primário')
  it('faz fallback para DALL-E quando NanaBanana falha')
  it('faz fallback para Ollama quando DALL-E falha')
  it('lança MediaGenerationError quando todos falham')
  it('registra métrica de sucesso/falha por provider')
}

describe('Security: magic bytes em imagens geradas') {
  it('rejeita EXE com extensão .webp')
  it('rejeita arquivo com <script nos primeiros bytes')
  it('aceita WebP real gerado pela API')
  it('aceita JPEG real gerado pela API')
}
```

## Critérios de Aceite

- [ ] NanaBanana gera imagem 2K com SynthID
- [ ] Fallback DALL-E ativo quando NanaBanana retorna erro
- [ ] Magic bytes validados em TODOS os retornos — sem exceção
- [ ] Imagem gerada armazenada no storage com URL pública
- [ ] Convertida automaticamente para WebP
- [ ] Métrica `media_generation_total{provider, status}` incrementada
