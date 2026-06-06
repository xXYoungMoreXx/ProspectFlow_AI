import { type DealRepository } from "../../domain/deal/DealRepository.js";
import { type LeadRepository } from "../../domain/lead/LeadRepository.js";
import { type CompositeLLMRouter } from "../../infrastructure/llm/CompositeLLMRouter.js";
import { Deal } from "../../domain/deal/Deal.js";
import {
  PricingEngine,
  PricingConfig,
} from "../../domain/pricing/PricingEngine.js";
import {
  ClientBriefing,
  OperationalCosts,
  PaymentMethod,
  ServiceType as PricingServiceType,
} from "../../domain/pricing/PricingModels.js";
import { Money } from "../../domain/pricing/Money.js";
import {
  NotFoundError,
  ok,
  err,
  type Result,
  ValidationError,
} from "../../domain/shared/Result.js";
import { ulid } from "ulid";

export interface GenerateQuoteInput {
  leadId: string;
  operatorId: string;
  organizationId: string;
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
    const lead = await this.leadRepo.findById(
      input.leadId,
      input.operatorId,
      input.organizationId,
    );
    if (!lead) {
      return err(new NotFoundError("Lead", input.leadId));
    }

    // 2. Prepare Context for LLM
    const contextStr = JSON.stringify({
      contactInfo: lead.toJSON().contact,
      notes: lead.toJSON().notes,
    });

    const systemPrompt = `You are an expert tech budgeting agent. Analyze the following lead context and extract the briefing details.
Respond strictly in JSON format with the following structure:
{
  "serviceType": "LANDING_PAGE" | "SITE_INSTITUCIONAL" | "ECOMMERCE" | "PORTFOLIO",
  "pageCount": number,
  "deliveryDays": number,
  "paymentMethod": "PIX" | "CREDIT_CARD_1X" | "CREDIT_CARD_12X",
  "addons": [ { "name": string, "priceCents": number } ],
  "proposalText": string (a short professional text explaining the quote)
}`;

    // 3. Call LLM
    let llmResponseText = "";
    try {
      const llmResult = await this.llm.complete({
        provider: "OPENAI",
        model: "gpt-4o",
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Lead Context:\n${contextStr}` },
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
      const cleanJson = llmResponseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      return err(
        new ValidationError("Failed to parse LLM quote output as JSON"),
      );
    }

    // 5. Use PricingEngine to calculate the price
    const serviceType = (parsed.serviceType ||
      "LANDING_PAGE") as PricingServiceType;
    const paymentMethod = (parsed.paymentMethod || "PIX") as PaymentMethod;
    const pageCount = parsed.pageCount || 1;
    const deliveryDays = parsed.deliveryDays || 14;

    const addonsForEngine = Array.isArray(parsed.addons)
      ? parsed.addons.map((a: any) => ({
          name: String(a.name),
          price: Money.BRL(Number(a.priceCents) || 0),
        }))
      : [];

    let briefing: ClientBriefing;
    try {
      briefing = new ClientBriefing(
        serviceType,
        pageCount,
        deliveryDays,
        paymentMethod,
        addonsForEngine,
      );
    } catch (e: any) {
      return err(
        new ValidationError(`Invalid briefing parameters: ${e.message}`),
      );
    }

    const opsCosts = new OperationalCosts(
      Money.fromReal(50), // estimated LLM tokens
      Money.fromReal(150), // deploy costs
      Money.fromReal(20), // prospecting cost
    );

    const pricingEngine = new PricingEngine();
    const config = PricingConfig.default();
    const pricingResult = pricingEngine.calculate(briefing, opsCosts, config);

    // 6. Create Deal Aggregate
    const dealId = ulid();

    const dealResult = Deal.create({
      id: dealId,
      leadId: input.leadId,
      operatorId: input.operatorId,
      agentId: input.agentId,
      serviceType: serviceType as any,
      briefing: { generatedBy: "AI", rawContext: contextStr, details: parsed },
      basePriceCents: pricingResult.basePrice.getCents(),
    });

    if (dealResult.isErr()) return dealResult;

    const deal = dealResult.value;

    if (parsed.proposalText) {
      deal.setProposal(parsed.proposalText);
    }

    addonsForEngine.forEach((addon: { name: string; price: Money }) => {
      deal.addAddon({
        name: addon.name,
        priceCents: addon.price.getCents(),
      });
    });

    // We can also apply the payment fee as an addon for simplicity if it's > 0
    if (pricingResult.paymentFee.getCents() > 0) {
      deal.addAddon({
        name: "Taxa de Pagamento",
        priceCents: pricingResult.paymentFee.getCents(),
      });
    }

    // 7. Save and Return
    await this.dealRepo.save(deal);

    return ok(deal);
  }
}
