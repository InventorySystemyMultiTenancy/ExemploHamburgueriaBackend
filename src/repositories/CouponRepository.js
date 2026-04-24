import { prisma } from "../lib/prisma.js";

export class CouponRepository {
  async findByCode(code) {
    return prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  }

  async findById(id) {
    return prisma.coupon.findUnique({ where: { id } });
  }

  async findAll() {
    return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  }

  async create({ code, type, value, minOrderValue, maxUses, expiresAt }) {
    return prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        type,
        value,
        minOrderValue: minOrderValue ?? null,
        maxUses: maxUses ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
  }

  async update(id, data) {
    return prisma.coupon.update({ where: { id }, data });
  }

  async setActive(id, isActive) {
    return prisma.coupon.update({ where: { id }, data: { isActive } });
  }
}
