import { prisma } from "../lib/prisma.js";

export class ProductRepository {
  // ── Produtos ─────────────────────────────────────────────────────────────

  async findAll() {
    return prisma.product.findMany({
      where: { isActive: true, isAvailable: true },
      include: {
        productAddons: {
          include: { addon: true },
          where: { addon: { isActive: true } },
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  async findAllForAdmin() {
    return prisma.product.findMany({
      include: {
        productAddons: { include: { addon: true } },
        productIngredients: { include: { ingredient: true } },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  async findById(productId) {
    return prisma.product.findUnique({
      where: { id: productId },
      include: {
        productAddons: {
          include: { addon: true },
          where: { addon: { isActive: true } },
        },
        productIngredients: { include: { ingredient: true } },
      },
    });
  }

  async create({ name, description, imageUrl, category, basePrice, isBurger }) {
    return prisma.product.create({
      data: {
        name,
        description: description ?? null,
        imageUrl: imageUrl ?? null,
        category: category ?? "Hambúrgueres",
        basePrice,
        isBurger: isBurger ?? false,
      },
    });
  }

  async update(
    productId,
    { name, description, imageUrl, category, basePrice, isBurger, isAvailable },
  ) {
    return prisma.product.update({
      where: { id: productId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(category !== undefined && { category }),
        ...(basePrice !== undefined && { basePrice }),
        ...(isBurger !== undefined && { isBurger }),
        ...(isAvailable !== undefined && { isAvailable }),
      },
      include: { productAddons: { include: { addon: true } } },
    });
  }

  async setActive(productId, isActive) {
    return prisma.product.update({
      where: { id: productId },
      data: { isActive },
    });
  }

  // Vincula/desvincula adicionais de um produto
  async syncAddons(productId, addonIds) {
    await prisma.productAddon.deleteMany({ where: { productId } });
    if (addonIds.length) {
      await prisma.productAddon.createMany({
        data: addonIds.map((addonId) => ({ productId, addonId })),
        skipDuplicates: true,
      });
    }
  }

  // Top N produtos mais vendidos (por quantidade de itens em pedidos ENTREGUE/APROVADO)
  async findTopSelling(limit = 6) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT p.id, p.name, p.category, p."basePrice", p."imageUrl",
              COALESCE(SUM(oi.quantity), 0)::int AS "salesCount"
       FROM "Product" p
       LEFT JOIN "OrderItem" oi ON oi."productId" = p.id
       LEFT JOIN "Order" o ON o.id = oi."orderId"
         AND o.status = 'ENTREGUE'
       WHERE p."isActive" = true
       GROUP BY p.id, p.name, p.category, p."basePrice", p."imageUrl"
       ORDER BY "salesCount" DESC, p.name ASC
       LIMIT $1`,
      limit,
    );
    return rows;
  }

  // ── Adicionais ────────────────────────────────────────────────────────────

  async findAllAddons() {
    return prisma.addon.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  async findAddonById(addonId) {
    return prisma.addon.findUnique({ where: { id: addonId } });
  }

  async createAddon({ name, description, price, category }) {
    return prisma.addon.create({
      data: {
        name,
        description: description ?? null,
        price,
        category: category ?? "Extra",
      },
    });
  }

  async updateAddon(addonId, data) {
    return prisma.addon.update({ where: { id: addonId }, data });
  }

  async setAddonActive(addonId, isActive) {
    return prisma.addon.update({ where: { id: addonId }, data: { isActive } });
  }

  // ── Combos ────────────────────────────────────────────────────────────────

  async findAllCombos() {
    return prisma.combo.findMany({
      where: { isActive: true },
      include: { parts: { include: { product: true } } },
      orderBy: { name: "asc" },
    });
  }

  async findAllCombosForAdmin() {
    return prisma.combo.findMany({
      include: { parts: { include: { product: true } } },
      orderBy: { name: "asc" },
    });
  }

  async findComboById(comboId) {
    return prisma.combo.findUnique({
      where: { id: comboId },
      include: { parts: { include: { product: true } } },
    });
  }

  async createCombo({ name, description, imageUrl, promotionalPrice, parts }) {
    return prisma.combo.create({
      data: {
        name,
        description: description ?? null,
        imageUrl: imageUrl ?? null,
        promotionalPrice,
        parts: {
          create: parts.map(({ productId, quantity }) => ({
            productId,
            quantity: quantity ?? 1,
          })),
        },
      },
      include: { parts: { include: { product: true } } },
    });
  }

  async updateCombo(
    comboId,
    { name, description, imageUrl, promotionalPrice, parts },
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.combo.update({
        where: { id: comboId },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(imageUrl !== undefined && { imageUrl }),
          ...(promotionalPrice !== undefined && { promotionalPrice }),
        },
      });

      if (parts) {
        await tx.comboPart.deleteMany({ where: { comboId } });
        await tx.comboPart.createMany({
          data: parts.map(({ productId, quantity }) => ({
            comboId,
            productId,
            quantity: quantity ?? 1,
          })),
        });
      }

      return tx.combo.findUnique({
        where: { id: comboId },
        include: { parts: { include: { product: true } } },
      });
    });
  }

  async setComboActive(comboId, isActive) {
    return prisma.combo.update({ where: { id: comboId }, data: { isActive } });
  }
}
