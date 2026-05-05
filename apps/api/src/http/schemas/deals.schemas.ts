import { z } from 'zod';
import { DealStatus } from '@agentepro/shared-types';

const dealStatusValues = Object.values(DealStatus) as [string, ...string[]];

export const CancelDealSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type CancelDealInput = z.infer<typeof CancelDealSchema>;

export const ListDealsQuery = z.object({
  status: z.enum(dealStatusValues).optional(),
  leadId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListDealsQueryInput = z.infer<typeof ListDealsQuery>;
