import { Prisma } from "@prisma/client";
import { MercadoPagoConfig, Payment as MPPayment } from "mercadopago";
import { AppError } from "../errors/AppError.js";
import { OrderRepository } from "../repositories/OrderRepository.js";
import { ProductRepository } from "../repositories/ProductRepository.js";
import { CouponRepository } from "../repositories/CouponRepository.js";
import { prisma } from "../lib/prisma.js";
import {
  emitOrderCreated,
  emitOrderStatusUpdated,
  emitPaymentUpdated,
} from "../realtime/socketServer.js";

// ─── Máquina de estados do pedido ────────────────────────────────────────────
const ORDER_TRANSITIONS = {
  RECEBIDO: ["EM_PREPARO", "CANCELADO"],
  EM_PREPARO: ["PRONTO"],
  PRONTO: ["SAIU_PARA_ENTREGA", "ENTREGUE"], // ENTREGUE direto para retirada
  SAIU_PARA_ENTREGA: ["ENTREGUE"],
  ENTREGUE: [],
  CANCELADO: [],
};

const PAYMENT_STATUS_MAP = {
  approved: "APROVADO",
  rejected: "RECUSADO",
  cancelled: "RECUSADO",
  refunded: "ESTORNADO",
  in_process: "PENDENTE",
  pending: "PENDENTE",
};

const toCents = (value) => Math.round(Number(value) * 100);
const fromCents = (value) => (value / 100).toFixed(2);

export class OrderService {
  constructor(
    orderRepository = new OrderRepository(),
    productRepository = new ProductRepository(),
    couponRepository = new CouponRepository(),
  ) {
    this.orderRepository = orderRepository;
    this.productRepository = productRepository;
    this.couponRepository = couponRepository;
  }

  // ─── Criar Pedido ─────────────────────────────────────────────────────────
  async createOrder({
    userId,
    deliveryAddress,
    notes,
    items,
    paymentMethod,
    deliveryFee,
    deliveryLat,
    deliveryLon,
    isPickup,
    couponCode,
  }) {
    if (!userId)
      throw new AppError("Pedido deve ser vinculado a um usuario.", 422);
    if (!items?.length)
      throw new AppError("Pedido deve conter ao menos 1 item.", 422);

    // ── Passo 1: Validar e precificar cada item ────────────────────────────
    const validatedItems = [];

    for (const item of items) {
      if (item.comboId) {
        const validated = await this.#validateComboItem(item);
        validatedItems.push(validated);
        continue;
      }

      if (item.productId) {
        const validated = await this.#validateProductItem(item);
        validatedItems.push(validated);
        continue;
      }

      throw new AppError("Cada item deve ter productId ou comboId.", 422);
    }

    const subtotalCents = validatedItems.reduce(
      (acc, i) => acc + i.totalPriceCents,
      0,
    );
    const deliveryFeeCents = deliveryFee ? toCents(deliveryFee) : 0;

    // ── Passo 2: Validar cupom de desconto ────────────────────────────────
    let discountCents = 0;
    let coupon = null;

    if (couponCode) {
      coupon = await this.couponRepository.findByCode(couponCode);
      if (!coupon) throw new AppError("Cupom nao encontrado.", 404);
      if (!coupon.isActive) throw new AppError("Cupom inativo.", 422);
      if (coupon.expiresAt && new Date() > coupon.expiresAt)
        throw new AppError("Cupom expirado.", 422);
      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        throw new AppError("Cupom esgotado.", 422);
      }
      if (coupon.minOrderValue) {
        const minCents = toCents(coupon.minOrderValue);
        if (subtotalCents < minCents) {
          throw new AppError(
            `Pedido minimo para este cupom: R$ ${Number(coupon.minOrderValue).toFixed(2).replace(".", ",")}.`,
            422,
          );
        }
      }

      discountCents =
        coupon.type === "PERCENTUAL"
          ? Math.round(subtotalCents * (Number(coupon.value) / 100))
          : toCents(coupon.value);

      discountCents = Math.min(discountCents, subtotalCents);
    }

    const totalCents = subtotalCents - discountCents + deliveryFeeCents;

    // ── Passo 3: Transação — checar estoque, descontar e criar pedido ──────
    const order = await prisma.$transaction(async (tx) => {
      // 3a. Validar e descontar estoque
      await this.#deductStock(tx, validatedItems);

      // 3b. Incrementar uso do cupom
      if (coupon) {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      // 3c. Criar o pedido com itens e adicionais
      return tx.order.create({
        data: {
          userId,
          subtotal: new Prisma.Decimal(fromCents(subtotalCents)),
          discount: new Prisma.Decimal(fromCents(discountCents)),
          deliveryFee:
            deliveryFee != null ? new Prisma.Decimal(deliveryFee) : null,
          total: new Prisma.Decimal(fromCents(totalCents)),
          paymentStatus: "PENDENTE",
          paymentMethod: paymentMethod ?? null,
          deliveryAddress: deliveryAddress ?? null,
          deliveryLat: deliveryLat ?? null,
          deliveryLon: deliveryLon ?? null,
          isPickup: isPickup ?? false,
          notes: notes ?? null,
          couponId: coupon?.id ?? null,
          deliveryCode: isPickup
            ? null
            : String(Math.floor(1000 + Math.random() * 9000)),
          items: {
            create: validatedItems.map((item) => ({
              productId: item.productId ?? null,
              comboId: item.comboId ?? null,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(fromCents(item.unitPriceCents)),
              totalPrice: new Prisma.Decimal(fromCents(item.totalPriceCents)),
              notes: item.notes ?? null,
              meatDoneness: item.meatDoneness ?? null,
              removedIngredients: item.removedIngredients ?? [],
              addons: {
                create: (item.addons ?? []).map((a) => ({
                  addonId: a.addonId,
                  quantity: a.quantity,
                  unitPrice: new Prisma.Decimal(fromCents(a.unitPriceCents)),
                  totalPrice: new Prisma.Decimal(
                    fromCents(a.unitPriceCents * a.quantity),
                  ),
                })),
              },
            })),
          },
          payment: {
            create: {
              provider: "MERCADO_PAGO",
              amount: new Prisma.Decimal(fromCents(totalCents)),
              status: "PENDENTE",
              payload: { paymentMethod: paymentMethod || "nao_informado" },
            },
          },
        },
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
    });

    emitOrderCreated({
      orderId: order.id,
      userId: order.userId,
      status: order.status,
      total: Number(order.total),
    });

    return order;
  }

  // ─── Cancelar Pedido ──────────────────────────────────────────────────────
  async cancelOrder(orderId) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new AppError("Pedido nao encontrado.", 404);
    if (order.status === "ENTREGUE")
      throw new AppError("Pedido ja entregue nao pode ser cancelado.", 409);
    if (order.status === "CANCELADO")
      throw new AppError("Pedido ja esta cancelado.", 409);

    const updated = await this.orderRepository.updateStatus(
      orderId,
      "CANCELADO",
    );

    emitOrderStatusUpdated({
      orderId: updated.id,
      userId: order.userId,
      previousStatus: order.status,
      status: "CANCELADO",
    });

    return updated;
  }

  // ─── Atualizar Status ─────────────────────────────────────────────────────
  async updateOrderStatus(orderId, nextStatus) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new AppError("Pedido nao encontrado.", 404);

    const allowed = ORDER_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new AppError(
        `Transicao invalida de ${order.status} para ${nextStatus}.`,
        409,
      );
    }

    const deliveredAt = nextStatus === "ENTREGUE" ? new Date() : null;
    const updated = await this.orderRepository.updateStatus(
      orderId,
      nextStatus,
      deliveredAt,
    );

    emitOrderStatusUpdated({
      orderId: updated.id,
      userId: order.userId,
      previousStatus: order.status,
      status: nextStatus,
    });

    return updated;
  }

  // ─── Consultas ────────────────────────────────────────────────────────────

  async getOrderById(orderId) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new AppError("Pedido nao encontrado.", 404);
    return order;
  }

  async listOrdersByUser(userId) {
    return this.orderRepository.findByUserId(userId);
  }

  async listActiveOrders() {
    return this.orderRepository.findActive();
  }

  async motoboyOrders() {
    return this.orderRepository.findMotoboyOrders();
  }

  async history(filters) {
    return this.orderRepository.findHistory(filters);
  }

  async analytics() {
    return this.orderRepository.getAnalytics();
  }

  // ─── Atribuir Motoboy ────────────────────────────────────────────────────
  async assignMotoboy(orderId, motoboyId) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new AppError("Pedido nao encontrado.", 404);
    await this.orderRepository.assignMotoboy(orderId, motoboyId);
    return this.orderRepository.findById(orderId);
  }

  // ─── Confirmar Entrega ────────────────────────────────────────────────────
  async confirmDelivery(orderId, deliveryCode) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new AppError("Pedido nao encontrado.", 404);

    if (!order.isPickup && order.deliveryCode) {
      if (order.deliveryCode !== String(deliveryCode)) {
        throw new AppError("Codigo de entrega incorreto.", 422);
      }
    }

    return this.updateOrderStatus(orderId, "ENTREGUE");
  }

  // ─── Deletar Pedido ───────────────────────────────────────────────────────
  async deleteOrder(orderId, requestingUserId) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new AppError("Pedido nao encontrado.", 404);

    if (order.userId && order.userId !== requestingUserId) {
      throw new AppError(
        "Voce nao pode excluir pedidos de outros usuarios.",
        403,
      );
    }

    if (!["CANCELADO", "ENTREGUE"].includes(order.status)) {
      throw new AppError(
        "Apenas pedidos Cancelados ou Entregues podem ser excluidos.",
        409,
      );
    }

    return this.orderRepository.delete(orderId);
  }

  // ─── Atualizar Status de Pagamento (admin) ────────────────────────────────
  async adminUpdatePaymentStatus(orderId, paymentStatus) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new AppError("Pedido nao encontrado.", 404);

    await this.orderRepository.updatePaymentStatus(orderId, paymentStatus);

    emitPaymentUpdated({
      orderId,
      userId: order.userId,
      paymentStatus,
    });
  }

  // ─── Webhook do Mercado Pago ──────────────────────────────────────────────
  async handlePaymentWebhook(payload) {
    const isOrderWebhook = payload?.type === "order";
    const isPointWebhook = payload?.type === "point_integration_wh";
    const isLegacyWebhook =
      !!payload?.topic && !!payload?.resource && !payload?.type;

    let providerStatus = "pending";
    let orderId =
      payload?.data?.external_reference ??
      payload?.external_reference ??
      payload?.additional_info?.external_reference ??
      payload?.data?.metadata?.order_id ??
      payload?.metadata?.order_id;
    let externalId = "";

    const mpToken = process.env.MP_ACCESS_TOKEN;

    if (isOrderWebhook) {
      const orderData = payload?.data ?? {};
      externalId = String(orderData.id ?? "");
      orderId = orderId || orderData.external_reference;

      const mpOrderStatus = String(orderData.status ?? "").toLowerCase();

      if (
        mpOrderStatus === "processed" ||
        mpOrderStatus === "payment_required"
      ) {
        providerStatus = "approved";
      } else if (["cancelled", "expired"].includes(mpOrderStatus)) {
        providerStatus = "cancelled";
      } else {
        providerStatus = "pending";
      }

      if (!orderId && externalId && mpToken) {
        try {
          const response = await fetch(
            `https://api.mercadopago.com/v1/orders/${externalId}`,
            { headers: { Authorization: `Bearer ${mpToken}` } },
          );
          const mpOrder = await response.json();
          orderId = mpOrder?.external_reference;
          externalId = String(mpOrder?.id ?? externalId);
        } catch (err) {
          console.error("[webhook] Falha ao buscar /v1/orders:", err.message);
        }
      }
    } else if (isPointWebhook) {
      const data = payload?.data ?? {};
      externalId = String(data.id ?? "");
      const paymentId = String(data.payment_id ?? "");

      if (paymentId && mpToken) {
        try {
          const client = new MercadoPagoConfig({ accessToken: mpToken });
          const mpPaymentApi = new MPPayment(client);
          const paymentData = await mpPaymentApi.get({ id: paymentId });
          providerStatus = paymentData.status ?? "pending";
          externalId = paymentId;
          orderId = orderId || paymentData.external_reference;

          if (!orderId) {
            const foundByIntent =
              await this.orderRepository.findByTerminalIntentId(externalId);
            if (foundByIntent) orderId = foundByIntent.id;
          }

          if (!orderId) {
            const amountCents = Math.round(
              (paymentData.transaction_amount ?? 0) * 100,
            );
            const foundByAmount =
              await this.orderRepository.findPendingTerminalOrderByAmount(
                amountCents,
              );
            if (foundByAmount) orderId = foundByAmount.id;
          }
        } catch (err) {
          console.error(
            "[webhook] Falha ao buscar pagamento Point:",
            err.message,
          );
        }
      }
    } else if (isLegacyWebhook || payload?.type === "payment") {
      const paymentId = String(
        payload?.data?.id ?? payload?.id ?? payload?.resource ?? "",
      );
      externalId = paymentId;

      if (paymentId && mpToken) {
        try {
          const client = new MercadoPagoConfig({ accessToken: mpToken });
          const mpPaymentApi = new MPPayment(client);
          const paymentData = await mpPaymentApi.get({ id: paymentId });
          providerStatus = paymentData.status ?? "pending";
          orderId = orderId || paymentData.external_reference;
        } catch (err) {
          console.error("[webhook] Falha ao buscar pagamento:", err.message);
        }
      }
    }

    if (!orderId) {
      console.warn(
        "[webhook] orderId nao resolvido. Payload:",
        JSON.stringify(payload),
      );
      return;
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      console.warn("[webhook] Pedido nao encontrado:", orderId);
      return;
    }

    const newPaymentStatus = PAYMENT_STATUS_MAP[providerStatus] ?? "PENDENTE";

    if (
      order.paymentStatus === "APROVADO" &&
      newPaymentStatus !== "ESTORNADO"
    ) {
      console.log("[webhook] Pedido ja aprovado. Ignorando.");
      return;
    }

    await this.orderRepository.updatePaymentStatus(orderId, newPaymentStatus);
    await this.orderRepository.updatePaymentRecord(orderId, {
      externalId,
      status: newPaymentStatus,
      payload: { providerStatus, source: payload?.type || "legacy" },
    });

    console.log(`[webhook] Pedido ${orderId} → pagamento ${newPaymentStatus}`);

    emitPaymentUpdated({
      orderId,
      userId: order.userId,
      paymentStatus: newPaymentStatus,
    });
  }

  // ─── Confirmar Pagamento Checkout Pro (retorno do MP) ─────────────────────
  async confirmCheckoutPayment(orderId, paymentId, requestingUser) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new AppError("Pedido nao encontrado.", 404);

    if (
      requestingUser.role === "CLIENTE" &&
      order.userId !== requestingUser.id
    ) {
      throw new AppError("Acesso negado.", 403);
    }

    if (order.paymentStatus === "APROVADO") {
      return order;
    }

    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) throw new AppError("Mercado Pago nao configurado.", 500);

    const client = new MercadoPagoConfig({ accessToken: mpToken });
    const mpPaymentApi = new MPPayment(client);
    const paymentData = await mpPaymentApi.get({ id: paymentId });

    if (paymentData.status !== "approved") {
      throw new AppError(
        `Pagamento nao aprovado (status: ${paymentData.status}).`,
        409,
      );
    }

    const extRef = paymentData.external_reference;
    if (extRef && extRef !== orderId) {
      throw new AppError("Pagamento nao corresponde a este pedido.", 409);
    }

    if (!extRef) {
      const paidCents = Math.round((paymentData.transaction_amount ?? 0) * 100);
      const orderCents = toCents(order.total);
      if (Math.abs(paidCents - orderCents) > 1) {
        throw new AppError(
          "Valor do pagamento nao corresponde ao pedido.",
          409,
        );
      }
    }

    await this.orderRepository.updatePaymentStatus(orderId, "APROVADO");
    await this.orderRepository.updatePaymentRecord(orderId, {
      externalId: String(paymentId),
      status: "APROVADO",
      payload: { confirmed: true, paymentId: String(paymentId) },
    });

    emitPaymentUpdated({
      orderId,
      userId: order.userId,
      paymentStatus: "APROVADO",
    });

    return this.orderRepository.findById(orderId);
  }

  // ─── Salvar intentId da maquininha ────────────────────────────────────────
  async saveTerminalIntentId(orderId, intentId) {
    return this.orderRepository.saveTerminalIntentId(orderId, intentId);
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  async #validateProductItem(item) {
    const product = await prisma.product.findFirst({
      where: { id: item.productId, isActive: true, isAvailable: true },
    });
    if (!product) {
      throw new AppError(
        `Produto ${item.productId} nao encontrado ou indisponivel.`,
        422,
      );
    }

    if (item.meatDoneness && !product.isBurger) {
      throw new AppError(
        `Produto "${product.name}" nao suporta ponto da carne.`,
        422,
      );
    }

    // Validar adicionais vinculados ao produto
    let addonsTotalCents = 0;
    const resolvedAddons = [];

    for (const addonReq of item.addons ?? []) {
      const pa = await prisma.productAddon.findFirst({
        where: { productId: product.id, addonId: addonReq.addonId },
        include: { addon: true },
      });
      if (!pa || !pa.addon.isActive) {
        throw new AppError(
          `Adicional ${addonReq.addonId} nao disponivel para este produto.`,
          422,
        );
      }
      const qty = addonReq.quantity ?? 1;
      const unitPriceCents = toCents(pa.addon.price);
      addonsTotalCents += unitPriceCents * qty;
      resolvedAddons.push({
        addonId: pa.addon.id,
        quantity: qty,
        unitPriceCents,
      });
    }

    const quantity = item.quantity ?? 1;
    const productUnitCents = toCents(product.basePrice);
    const unitPriceCents = productUnitCents + addonsTotalCents;

    return {
      type: "PRODUCT",
      productId: product.id,
      comboId: null,
      quantity,
      unitPriceCents,
      totalPriceCents: unitPriceCents * quantity,
      notes: item.notes ?? null,
      meatDoneness: item.meatDoneness ?? null,
      removedIngredients: item.removedIngredients ?? [],
      addons: resolvedAddons,
      // Para controle de estoque
      _productIds: [product.id],
    };
  }

  async #validateComboItem(item) {
    const combo = await prisma.combo.findFirst({
      where: { id: item.comboId, isActive: true },
      include: { parts: { include: { product: true } } },
    });
    if (!combo) {
      throw new AppError(
        `Combo ${item.comboId} nao encontrado ou inativo.`,
        422,
      );
    }

    let addonsTotalCents = 0;
    const resolvedAddons = [];

    for (const addonReq of item.addons ?? []) {
      const addon = await prisma.addon.findFirst({
        where: { id: addonReq.addonId, isActive: true },
      });
      if (!addon) {
        throw new AppError(
          `Adicional ${addonReq.addonId} nao encontrado.`,
          422,
        );
      }
      const qty = addonReq.quantity ?? 1;
      const unitPriceCents = toCents(addon.price);
      addonsTotalCents += unitPriceCents * qty;
      resolvedAddons.push({ addonId: addon.id, quantity: qty, unitPriceCents });
    }

    const quantity = item.quantity ?? 1;
    const comboUnitCents = toCents(combo.promotionalPrice);
    const unitPriceCents = comboUnitCents + addonsTotalCents;

    return {
      type: "COMBO",
      productId: null,
      comboId: combo.id,
      quantity,
      unitPriceCents,
      totalPriceCents: unitPriceCents * quantity,
      notes: item.notes ?? null,
      meatDoneness: null,
      removedIngredients: [],
      addons: resolvedAddons,
      // Produtos dos combo parts para controle de estoque
      _productIds: combo.parts.flatMap((p) =>
        Array(p.quantity).fill(p.productId),
      ),
    };
  }

  async #deductStock(tx, validatedItems) {
    // Agrupa todos os productIds necessários
    const productQtyMap = new Map(); // productId → total quantity

    for (const item of validatedItems) {
      for (const pid of item._productIds) {
        const qty = (productQtyMap.get(pid) ?? 0) + item.quantity;
        productQtyMap.set(pid, qty);
      }
    }

    for (const [productId, totalQty] of productQtyMap.entries()) {
      const productIngredients = await tx.productIngredient.findMany({
        where: { productId },
        include: { ingredient: true },
      });

      for (const pi of productIngredients) {
        const required = pi.quantity * totalQty;

        if (pi.ingredient.stockQuantity < required) {
          throw new AppError(
            `Estoque insuficiente de "${pi.ingredient.name}". Disponivel: ${pi.ingredient.stockQuantity} ${pi.ingredient.unit}, necessario: ${required} ${pi.ingredient.unit}.`,
            409,
          );
        }

        await tx.ingredient.update({
          where: { id: pi.ingredientId },
          data: { stockQuantity: { decrement: required } },
        });
      }
    }
  }
}
