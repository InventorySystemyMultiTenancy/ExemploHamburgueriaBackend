import { prisma } from "../lib/prisma.js";

export class OrderRepository {
  // ── Criação ───────────────────────────────────────────────────────────────

  async createOrder(data) {
    return prisma.order.create({
      data,
      include: {
        items: {
          include: {
            addons: { include: { addon: true } },
            product: true,
            combo: true,
          },
        },
        payment: true,
        user: { select: { id: true, name: true, email: true } },
        coupon: true,
      },
    });
  }

  // ── Busca ─────────────────────────────────────────────────────────────────

  async findById(orderId) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            addons: { include: { addon: true } },
            product: true,
            combo: { include: { parts: { include: { product: true } } } },
          },
        },
        payment: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        coupon: true,
      },
    });
  }

  async findByIdLean(orderId) {
    const rows = await prisma.$queryRaw`
      SELECT o.id, o."userId", o.status::text AS status,
             o."paymentStatus"::text AS "paymentStatus",
             o."terminalIntentId", o.total,
             u.id AS "uId", u.role::text AS "uRole"
      FROM "Order" o
      LEFT JOIN "User" u ON u.id = o."userId"
      WHERE o.id = ${orderId}
    `;
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.userId,
      status: r.status,
      paymentStatus: r.paymentStatus,
      terminalIntentId: r.terminalIntentId,
      total: r.total,
      user: r.uId ? { id: r.uId, role: r.uRole } : null,
    };
  }

  async findByUserId(userId) {
    return prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            addons: { include: { addon: true } },
            product: true,
            combo: true,
          },
        },
        payment: true,
        coupon: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findActive() {
    return prisma.order.findMany({
      where: {
        status: { notIn: ["ENTREGUE", "CANCELADO"] },
      },
      include: {
        items: {
          include: {
            addons: { include: { addon: true } },
            product: true,
            combo: true,
          },
        },
        user: { select: { id: true, name: true, phone: true } },
        coupon: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async findMotoboyOrders() {
    return prisma.order.findMany({
      where: { status: "PRONTO", isPickup: false },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        items: { include: { product: true, combo: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async findHistory({ startDate, endDate, userId } = {}) {
    return prisma.order.findMany({
      where: {
        status: { in: ["ENTREGUE", "CANCELADO"] },
        ...(startDate && { createdAt: { gte: new Date(startDate) } }),
        ...(endDate && { createdAt: { lte: new Date(endDate) } }),
        ...(userId && { userId }),
      },
      include: {
        user: { select: { id: true, name: true } },
        items: {
          include: {
            product: true,
            combo: true,
            addons: { include: { addon: true } },
          },
        },
        coupon: true,
        payment: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async findByTerminalIntentId(intentId) {
    const rows = await prisma.$queryRaw`
      SELECT id, "paymentStatus"::text AS "paymentStatus", "userId", total
      FROM "Order"
      WHERE "terminalIntentId" = ${intentId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async findPendingTerminalOrderByAmount(amountCents) {
    const amount = (amountCents / 100).toFixed(2);
    const rows = await prisma.$queryRaw`
      SELECT id, "paymentStatus"::text AS "paymentStatus", "userId", total
      FROM "Order"
      WHERE "paymentStatus" = 'PENDENTE'
        AND "terminalIntentId" IS NOT NULL
        AND ROUND(total::numeric, 2) = ${parseFloat(amount)}
        AND "createdAt" >= NOW() - INTERVAL '24 hours'
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  // ── Atualizações ──────────────────────────────────────────────────────────

  async updateStatus(orderId, status, deliveredAt = null) {
    const deliveredClause = deliveredAt
      ? `, "deliveredAt" = '${new Date(deliveredAt).toISOString()}'`
      : "";
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET "status" = $1::"OrderStatus", "updatedAt" = NOW()${deliveredClause} WHERE "id" = $2`,
      status,
      orderId,
    );
    return this.findById(orderId);
  }

  async updatePaymentStatus(orderId, paymentStatus) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET "paymentStatus" = $1::"PaymentStatus", "updatedAt" = NOW() WHERE "id" = $2`,
      paymentStatus,
      orderId,
    );
  }

  async updatePaymentRecord(orderId, { externalId, status, payload }) {
    await prisma.payment.updateMany({
      where: { orderId },
      data: {
        ...(externalId && { externalId }),
        ...(status && { status }),
        ...(payload && { payload }),
        updatedAt: new Date(),
      },
    });
  }

  async assignMotoboy(orderId, motoboyId) {
    await prisma.$executeRaw`
      UPDATE "Order" SET "assignedMotoboyId" = ${motoboyId}, "updatedAt" = NOW()
      WHERE "id" = ${orderId}
    `;
  }

  async saveTerminalIntentId(orderId, intentId) {
    await prisma.$executeRaw`
      UPDATE "Order" SET "terminalIntentId" = ${intentId}, "updatedAt" = NOW()
      WHERE "id" = ${orderId}
    `;
  }

  async delete(orderId) {
    return prisma.order.delete({ where: { id: orderId } });
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  async getAnalytics() {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayRevenue, monthRevenue, statusCounts, topProducts] =
      await Promise.all([
        // Receita hoje
        prisma.$queryRaw`
          SELECT COALESCE(SUM(total), 0) AS revenue
          FROM "Order"
          WHERE "paymentStatus" = 'APROVADO'
            AND "createdAt" >= ${todayStart}
        `,
        // Receita do mês
        prisma.$queryRaw`
          SELECT COALESCE(SUM(total), 0) AS revenue
          FROM "Order"
          WHERE "paymentStatus" = 'APROVADO'
            AND "createdAt" >= ${monthStart}
        `,
        // Contagem por status
        prisma.$queryRaw`
          SELECT status::text AS status, COUNT(*)::int AS count
          FROM "Order"
          WHERE "createdAt" >= ${monthStart}
          GROUP BY status
        `,
        // Top produtos (último mês)
        prisma.$queryRaw`
          SELECT p.name, SUM(oi.quantity)::int AS "salesCount",
                 SUM(oi."totalPrice")::numeric AS revenue
          FROM "OrderItem" oi
          JOIN "Product" p ON p.id = oi."productId"
          JOIN "Order" o ON o.id = oi."orderId"
          WHERE o."createdAt" >= ${monthStart}
            AND o."paymentStatus" = 'APROVADO'
          GROUP BY p.name
          ORDER BY "salesCount" DESC
          LIMIT 5
        `,
      ]);

    return {
      todayRevenue: Number(todayRevenue[0]?.revenue ?? 0),
      monthRevenue: Number(monthRevenue[0]?.revenue ?? 0),
      statusCounts: statusCounts.reduce((acc, r) => {
        acc[r.status] = r.count;
        return acc;
      }, {}),
      topProducts,
    };
  }
}
