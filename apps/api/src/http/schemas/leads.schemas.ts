import { z } from "zod";
import { LeadSource, LeadStatus } from "@hefesto/shared-types";

const leadSourceValues = Object.values(LeadSource) as [string, ...string[]];
const leadStatusValues = Object.values(LeadStatus) as [string, ...string[]];

export const CreateLeadSchema = z.object({
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email().max(254).optional(),
  contactPhone: z.string().max(30).optional(),
  contactCompany: z.string().max(200).optional(),
  contactWebsite: z.string().url().max(500).optional(),
  source: z.enum(leadSourceValues).default("MANUAL"),
  assignedAgentId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;

export const UpdateLeadStatusSchema = z.object({
  status: z.enum(leadStatusValues),
  reason: z.string().max(500).optional(),
});
export type UpdateLeadStatusInput = z.infer<typeof UpdateLeadStatusSchema>;

export const ListLeadsQuery = z.object({
  status: z.enum(leadStatusValues).optional(),
  assignedAgentId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListLeadsQueryInput = z.infer<typeof ListLeadsQuery>;
