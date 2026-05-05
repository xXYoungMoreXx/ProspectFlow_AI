import { z } from 'zod';

export const ApproveSchema = z.object({
  note: z.string().max(1000).optional(),
});
export type ApproveInput = z.infer<typeof ApproveSchema>;

export const RejectSchema = z.object({
  note: z.string().max(1000).optional(),
});
export type RejectInput = z.infer<typeof RejectSchema>;

export const EditApproveSchema = z.object({
  editedPayload: z.record(z.unknown()),
  note: z.string().max(1000).optional(),
});
export type EditApproveInput = z.infer<typeof EditApproveSchema>;
