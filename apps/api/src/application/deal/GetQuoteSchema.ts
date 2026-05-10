import { z } from 'zod';

export const CreateQuoteSchema = z.object({
  serviceType: z.enum(['LANDING_PAGE', 'SITE_INSTITUCIONAL', 'ECOMMERCE', 'PORTFOLIO']),
  pageCount: z.number().int().min(1),
  deliveryDays: z.number().int().min(1),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD_1X', 'CREDIT_CARD_12X']),
  addons: z.array(
    z.object({
      name: z.string(),
      priceCents: z.number().int().min(0),
    })
  ).optional().default([]),
});

export type CreateQuoteDTO = z.infer<typeof CreateQuoteSchema>;
