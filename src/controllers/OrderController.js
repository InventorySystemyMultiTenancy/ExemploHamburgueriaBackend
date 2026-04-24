import crypto from "crypto";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import { OrderService } from "../services/OrderService.js";
import {
  createOrderSchema,
  updateOrderStatusSchema,
  paymentWebhookSchema,
} from "../validators/orderSchemas.js";

const orderService = new OrderService();

export class OrderController {
  // ── Criar Pedido ──────────────────────────────────────────────────────────

  async create(req, res, next) {
    try {
      const payload = createOrderSchema.parse(req.body);
      const order = await orderService.createOrder({
        userId: req.user.id,
        ...payload,
      });
      return res
        .status(201)
        .json({ message: "Pedido criado com sucesso.", data: order });
    } catch (error) {
      return this.#handleError(error, next);
    }
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async getById(req, res, next) {
    try {
      const order = await orderService.getOrderById(req.params.orderId);
      return res.status(200).json({ data: order });
    } catch (error) {
      return next(error);
    }
  }

  async getMyOrders(req, res, next) {
    try {
      const orders = await orderService.listOrdersByUser(req.user.id);
      return res.status(200).json({ data: orders });
    } catch (error) {
      return next(error);
    }
  }

  async listAll(_req, res, next) {
    try {
      const orders = await orderService.listActiveOrders();
      return res.status(200).json({ data: orders });
    } catch (error) {
      return next(error);
    }
  }

  async motoboyOrders(_req, res, next) {
    try {
      const orders = await orderService.motoboyOrders();
      return res.status(200).json({ data: orders });
    } catch (error) {
      return next(error);
    }
  }

  async history(req, res, next) {
    try {
      const { startDate, endDate, userId } = req.query;
      const orders = await orderService.history({ startDate, endDate, userId });
      return res.status(200).json({ data: orders });
    } catch (error) {
      return next(error);
    }
  }

  async analytics(_req, res, next) {
    try {
      const data = await orderService.analytics();
      return res.status(200).json({ data });
    } catch (error) {
      return next(error);
    }
  }

  // ── Ações de Status ───────────────────────────────────────────────────────

  async updateStatus(req, res, next) {
    try {
      const { status } = updateOrderStatusSchema.parse(req.body);
      const updated = await orderService.updateOrderStatus(
        req.params.orderId,
        status,
      );
      return res
        .status(200)
        .json({ message: "Status atualizado.", data: updated });
    } catch (error) {
      return this.#handleError(error, next);
    }
  }

  async cancel(req, res, next) {
    try {
      const updated = await orderService.cancelOrder(req.params.orderId);
      return res
        .status(200)
        .json({ message: "Pedido cancelado.", data: updated });
    } catch (error) {
      return next(error);
    }
  }

  async assignMotoboy(req, res, next) {
    try {
      const { motoboyId } = req.body;
      if (!motoboyId || typeof motoboyId !== "string") {
        throw new AppError("motoboyId e obrigatorio.", 422);
      }
      const updated = await orderService.assignMotoboy(
        req.params.orderId,
        motoboyId,
      );
      return res
        .status(200)
        .json({ message: "Motoboy atribuido.", data: updated });
    } catch (error) {
      return next(error);
    }
  }

  async confirmDelivery(req, res, next) {
    try {
      const { deliveryCode } = req.body;
      const updated = await orderService.confirmDelivery(
        req.params.orderId,
        deliveryCode,
      );
      return res
        .status(200)
        .json({ message: "Entrega confirmada.", data: updated });
    } catch (error) {
      return next(error);
    }
  }

  async deleteOrder(req, res, next) {
    try {
      await orderService.deleteOrder(req.params.orderId, req.user.id);
      return res.status(200).json({ message: "Pedido excluido." });
    } catch (error) {
      return next(error);
    }
  }

  async adminUpdatePaymentStatus(req, res, next) {
    try {
      const { paymentStatus } = req.body;
      const VALID = ["PENDENTE", "APROVADO", "RECUSADO", "ESTORNADO"];
      if (!VALID.includes(paymentStatus)) {
        throw new AppError("Status de pagamento invalido.", 422);
      }
      await orderService.adminUpdatePaymentStatus(
        req.params.orderId,
        paymentStatus,
      );
      return res
        .status(200)
        .json({ message: "Status de pagamento atualizado." });
    } catch (error) {
      return next(error);
    }
  }

  // ── Webhook Mercado Pago ───────────────────────────────────────────────────

  async paymentWebhook(req, res, _next) {
    const ts = new Date().toISOString();
    console.log(`\n[webhook] ========== RECEBIDO ${ts} ==========`);
    console.log("[webhook] query:", JSON.stringify(req.query));
    console.log("[webhook] body:", JSON.stringify(req.body));

    // Verificação HMAC-SHA256 da assinatura do MP (quando configurado)
    if (process.env.MP_WEBHOOK_SECRET) {
      const xSignature = req.headers["x-signature"] || "";
      const xRequestId = req.headers["x-request-id"] || "";
      const dataId =
        req.query["data.id"] || req.query.id || req.body?.data?.id || "";

      const tsPart = xSignature.split(",").find((p) => p.startsWith("ts="));
      const v1Part = xSignature.split(",").find((p) => p.startsWith("v1="));

      if (tsPart && v1Part) {
        const timestamp = tsPart.slice(3);
        const receivedHmac = v1Part.slice(3);
        const template = `id:${dataId};request-id:${xRequestId};ts:${timestamp}`;
        const expectedHmac = crypto
          .createHmac("sha256", process.env.MP_WEBHOOK_SECRET)
          .update(template)
          .digest("hex");

        if (
          receivedHmac.length !== expectedHmac.length ||
          !crypto.timingSafeEqual(
            Buffer.from(receivedHmac),
            Buffer.from(expectedHmac),
          )
        ) {
          console.error("[webhook] HMAC invalido! Webhook bloqueado.");
          return res.status(200).json({ message: "OK" });
        }
        console.log("[webhook] HMAC verificado.");
      }
    }

    try {
      const rawPayload = { ...req.query, ...req.body };
      const payload = paymentWebhookSchema.parse(rawPayload);

      // Responde 200 imediatamente para evitar retry do MP
      res.status(200).json({ message: "OK" });

      orderService.handlePaymentWebhook(payload).catch((err) => {
        console.error("[webhook] Erro background:", err.message);
      });
    } catch (error) {
      res.status(200).json({ message: "OK" });
      console.error("[webhook] Parse error:", error.message);
    }
  }

  // ── Confirmar pagamento Checkout Pro (retorno do MP) ──────────────────────

  async confirmCheckoutPayment(req, res, next) {
    try {
      const { orderId, paymentId } = req.body;
      if (!orderId || !paymentId) {
        throw new AppError("orderId e paymentId sao obrigatorios.", 422);
      }
      const result = await orderService.confirmCheckoutPayment(
        orderId,
        String(paymentId),
        req.user,
      );
      return res.status(200).json({ data: result });
    } catch (error) {
      return next(error);
    }
  }

  #handleError(error, next) {
    if (error instanceof ZodError) {
      return next(new AppError("Payload invalido.", 422, error.flatten()));
    }
    return next(error);
  }
}
