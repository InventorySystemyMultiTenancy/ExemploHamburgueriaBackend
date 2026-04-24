import { z } from "zod";

export const createCouponSchema = z.object({
  code: z.string().min(3).max(30).toUpperCase(),
  type: z.enum(["PERCENTUAL", "VALOR_FIXO"]),
  value: z.number().positive(),
  minOrderValue: z.number().nonnegative().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const updateCouponSchema = createCouponSchema.partial().extend({
  isActive: z.boolean().optional(),
});
