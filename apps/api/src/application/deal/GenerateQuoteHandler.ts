import { type DealRepository } from '../../domain/deal/DealRepository.js';
import { type LeadRepository } from '../../domain/lead/LeadRepository.js';
import { type CompositeLLMRouter } from '../../infrastructure/llm/CompositeLLMRouter.js';
import { Deal } from '../../domain/deal/Deal.js';
import { NotFoundError, ok, err, type Result, ValidationError } from '../../domain/shared/Result.js';
import { ulid } from 'ulid';

export interface GenerateQuoteInput {
  leadId: string;
  operatorId: string;
  agentId?: string;
}

export class GenerateQuoteHandler {
  constructor(
    private readonly dealRepo: DealRepository,
    private readonly leadRepo: LeadRepository,
    private readonly llm: CompositeLLMRouter,
  ) {}

  async execute(input: GenerateQuoteInput): Promise<Result<Deal, Error>> {
    // 1. Fetch Lead
    const lead = await this.leadRepo.findById(input.leadId, input.operatorId);
    if (!lead) {
      return err(new NotFoundError('Lead', input.leadId));
    }

    // 2. Prepare Context for LLM
    const contextStr = JSON.stringify({
      contactInfo: lead.toJSON().contact,
      notes: lead.toJSON().notes,
    });

    const systemPrompt = `You are an expert tech budgeting agent. Analyze the following lead context and provide a budget estimation.
Respond strictly in JSON format with the following structure:
{
  "basePriceCents": number (in USD cents),
  "addons": [ { "name": string, "priceCents": number } ],
  "proposalText": string (a short professional text explaining the quote),
  "serviceType": "CUSTOM" | "SUBSCRIPTION" | "CONSULTING"
}`;

    // 3. Call LLM
    let llmResponseText = '';
    try {
      const llmResult = await this.llm.complete({
        provider: 'OPENAI',
        model: 'gpt-4o',
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Lead Context:\n${contextStr}` },
        ],
      });
      llmResponseText = llmResult.content;
    } catch (error: any) {
      return err(new Error(`LLM Error: ${error.message}`));
    }

    // 4. Parse JSON
    let parsed: any;
    try {
      // Clean up markdown block if present
      const cleanJson = llmResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (_e) {
      return err(new ValidationError('Failed to parse LLM quote output as JSON'));
    }

    // 5. Create Deal Aggregate
    const dealId = ulid();
    const serviceType = parsed.serviceType || 'CUSTOM';
    
    const dealResult = Deal.create({
      id: dealId,
      leadId: input.leadId,
      operatorId: input.operatorId,
      agentId: input.agentId,
      serviceType: serviceType as any,
      briefing: { generatedBy: 'AI', rawContext: contextStr },
      basePriceCents: parsed.basePriceCents || 0,
    });

    if (dealResult.isErr()) return dealResult;
    
    const deal = dealResult.value;

    if (parsed.proposalText) {
      deal.setProposal(parsed.proposalText);
    }

    if (Array.isArray(parsed.addons)) {
      parsed.addons.forEach((addon: any) => {
        if (addon.name && typeof addon.priceCents === 'number') {
          deal.addAddon({ name: String(addon.name), priceCents: Number(addon.priceCents) });
        }
      });
    }

    // 6. Save and Return
    await this.dealRepo.save(deal);
    
    return ok(deal);
  }
}
