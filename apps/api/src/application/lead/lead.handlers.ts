import { ulid } from "ulid";
import type {
  LeadRepository,
  LeadFilters,
  LeadListResult,
} from "../../domain/lead/LeadRepository.js";
import { Lead, type ContactInfo } from "../../domain/lead/Lead.js";
import {
  NotFoundError,
  ok,
  err,
  type Result,
} from "../../domain/shared/Result.js";
import type { LeadSource, LeadStatus } from "@agentepro/shared-types";

export class CreateLeadHandler {
  constructor(private readonly repo: LeadRepository) {}

  async execute(
    operatorId: string,
    input: {
      contactName: string;
      contactEmail?: string;
      contactPhone?: string;
      contactCompany?: string;
      contactWebsite?: string;
      source?: LeadSource;
      assignedAgentId?: string;
    },
  ): Promise<Result<Lead, Error>> {
    const contact: ContactInfo = {
      name: input.contactName,
      email: input.contactEmail,
      phone: input.contactPhone,
      company: input.contactCompany,
      website: input.contactWebsite,
    };

    const leadResult = Lead.create({
      id: ulid(),
      operatorId,
      contact,
      source: input.source ?? "MANUAL",
      assignedAgentId: input.assignedAgentId,
    });

    if (leadResult.isErr()) return leadResult;

    const lead = leadResult.value;
    await this.repo.save(lead);
    return ok(lead);
  }
}

export class UpdateLeadStatusHandler {
  constructor(private readonly repo: LeadRepository) {}

  async execute(
    leadId: string,
    operatorId: string,
    status: LeadStatus,
    reason?: string,
  ): Promise<Result<Lead, Error>> {
    const lead = await this.repo.findById(leadId, operatorId);
    if (!lead) return err(new NotFoundError("Lead", leadId));

    if (status === "LOST" && reason) {
      lead.markLost(reason);
    } else {
      lead.updateStatus(status);
    }

    await this.repo.save(lead);
    return ok(lead);
  }
}

export class GetLeadsHandler {
  constructor(private readonly repo: LeadRepository) {}

  async execute(filters: LeadFilters): Promise<LeadListResult> {
    return this.repo.findMany(filters);
  }
}

export class GetLeadByIdHandler {
  constructor(private readonly repo: LeadRepository) {}

  async execute(
    leadId: string,
    operatorId: string,
  ): Promise<Result<Lead, NotFoundError>> {
    const lead = await this.repo.findById(leadId, operatorId);
    if (!lead) return err(new NotFoundError("Lead", leadId));
    return ok(lead);
  }
}
