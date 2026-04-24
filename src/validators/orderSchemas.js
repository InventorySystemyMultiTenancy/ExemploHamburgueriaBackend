import { z } from "zod";

// ─── Schema de adicional escolhido pelo cliente ───────────────────────────────
const addonRequestSchema = z.object({
  addonId: z.string().cuid("addonId invalido"),
  quantity: z.number().int().positive().max(10).optional().default(1),
});

// ─── Schema de item de pedido ─────────────────────────────────────────────────
const orderItemSchema = z
  .object({
    productId: z.string().cuid().optional(),
    comboId: z.string().cuid().optional(),
    quantity: z.number().int().positive().max(20).optional().default(1),
    notes: z.string().max(500).optional(), // ex: "sem cebola, bem molhado"
    meatDoneness: z.enum(["MAL_PASSADO", "AO_PONTO", "BEM_PASSADO"]).optional(), // ponto da carne (só hambúrgueres)
    removedIngredients: z
      .array(z.string().max(100))
      .max(20)
      .optional()
      .default([]), // ingredientes a remover
    addons: z.array(addonRequestSchema).max(20).optional().default([]),
  })
  .refine((data) => !!(data.productId || data.comboId), {
    message: "Item deve ter productId ou comboId.",
  })
  .refine((data) => !(data.productId && data.comboId), {
    message: "Item nao pode ter productId e comboId simultaneamente.",
  });

// ─── Schema de criação de pedido ──────────────────────────────────────────────
export const createOrderSchema = z.object({
  deliveryAddress: z.string().min(1).max(255).optional(),
  isPickup: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  paymentMethod: z.string().min(2).max(50).optional(),
  deliveryFee: z.number().nonnegative().optional(),
  deliveryLat: z.number().optional(),
  deliveryLon: z.number().optional(),
  couponCode: z.string().max(50).optional(),
  items: z.array(orderItemSchema).min(1).max(30),
});

// ─── Schema de atualização de status ─────────────────────────────────────────
export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "EM_PREPARO",
    "PRONTO",
    "SAIU_PARA_ENTREGA",
    "ENTREGUE",
    "CANCELADO",
  ]),
});

// ─── Schema de cálculo de frete ───────────────────────────────────────────────
export const deliveryFreightSchema = z.object({
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP invalido"),
  numero: z.string().min(1).max(20),
  cidade: z.string().min(2).max(100),
  rua: z.string().max(200).optional(),
  complemento: z.string().max(100).optional(),
});

// ─── Schema do webhook do Mercado Pago ────────────────────────────────────────
export const paymentWebhookSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    type: z.string().optional(),
    topic: z.string().optional(),
    resource: z.union([z.string(), z.number()]).optional(),
    action: z.string().optional(),
    status: z.string().optional(),
    external_reference: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    additional_info: z.record(z.any()).optional(),
    data: z
      .object({
        id: z.union([z.string(), z.number()]).optional(),
        payment_id: z.union([z.string(), z.number()]).optional(),
        state: z.string().optional(),
        status: z.string().optional(),
        external_reference: z.string().optional(),
        status_detail: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
