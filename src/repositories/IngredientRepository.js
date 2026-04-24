import { prisma } from "../lib/prisma.js";

export class IngredientRepository {
  async findAll() {
    return prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  }

  async findById(id) {
    return prisma.ingredient.findUnique({ where: { id } });
  }

  async findLowStock() {
    return prisma.$queryRaw`
      SELECT * FROM "Ingredient"
      WHERE "stockQuantity" <= "minStock"
      ORDER BY ("stockQuantity" - "minStock") ASC
    `;
  }

  async create({ name, unit, stockQuantity, minStock }) {
    return prisma.ingredient.create({
      data: {
        name,
        unit: unit ?? "un",
        stockQuantity: stockQuantity ?? 0,
        minStock: minStock ?? 0,
      },
    });
  }

  async update(id, data) {
    return prisma.ingredient.update({ where: { id }, data });
  }

  async adjustStock(id, delta) {
    return prisma.ingredient.update({
      where: { id },
      data: { stockQuantity: { increment: delta } },
    });
  }

  async delete(id) {
    return prisma.ingredient.delete({ where: { id } });
  }
}
