import { z } from "zod";

const moneyValue = z.coerce.number().positive();

// ─── Produto ──────────────────────────────────────────────────────────────────
export const createProductSchema = z
  .object({
    name: z.string().min(2).max(120),
    description: z.string().max(500).optional().nullable(),
    imageUrl: z
      .union([z.string().url(), z.literal("")])
      .optional()
      .nullable(),
    category: z
      .enum([
        "Hambúrgueres",
        "Acompanhamentos",
        "Bebidas",
        "Sobremesas",
        "Outros",
      ])
      .optional(),
    basePrice: moneyValue.optional(),
    price: moneyValue.optional(),
    isBurger: z.boolean().optional(),
    addonIds: z.array(z.string().cuid()).optional(), // adicionais disponíveis
  })
  .superRefine((data, ctx) => {
    if (data.basePrice === undefined && data.price === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "basePrice (ou price) e obrigatorio.",
        path: ["basePrice"],
      });
    }
  })
  .transform(({ price, basePrice, ...rest }) => ({
    ...rest,
    basePrice: basePrice ?? price,
  }));

export const updateProductSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(500).optional().nullable(),
    imageUrl: z
      .union([z.string().url(), z.literal("")])
      .optional()
      .nullable(),
    category: z
      .enum([
        "Hambúrgueres",
        "Acompanhamentos",
        "Bebidas",
        "Sobremesas",
        "Outros",
      ])
      .optional(),
    basePrice: moneyValue.optional(),
    price: moneyValue.optional(),
    isBurger: z.boolean().optional(),
    addonIds: z.array(z.string().cuid()).optional(),
  })
  .transform(({ price, basePrice, ...rest }) => ({
    ...rest,
    ...(basePrice !== undefined || price !== undefined
      ? { basePrice: basePrice ?? price }
      : {}),
  }));

// ─── Adicional ────────────────────────────────────────────────────────────────
export const createAddonSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional().nullable(),
  price: z.number().nonnegative(),
  category: z
    .enum(["Extra", "Molho", "Queijo", "Proteína", "Vegetais"])
    .optional(),
});

// ─── Combo ────────────────────────────────────────────────────────────────────
const comboPartSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().positive().max(10).optional().default(1),
});

export const createComboSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  imageUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .nullable(),
  promotionalPrice: z.number().positive(),
  parts: z.array(comboPartSchema).min(1).max(10),
});

export const updateComboSchema = createComboSchema.partial();

// ─── Ingrediente ──────────────────────────────────────────────────────────────
export const createIngredientSchema = z.object({
  name: z.string().min(2).max(120),
  unit: z
    .enum(["un", "g", "kg", "ml", "l", "folha", "fatia", "tira", "porção"])
    .optional(),
  stockQuantity: z.number().nonnegative().optional(),
  minStock: z.number().nonnegative().optional(),
});

export const updateIngredientSchema = createIngredientSchema.partial();
