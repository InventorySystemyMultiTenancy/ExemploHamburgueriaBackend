import {
  MercadoPagoConfig,
  Preference,
  Payment as MPPayment,
} from "mercadopago";
import { AppError } from "../errors/AppError.js";
import { OrderRepository } from "../repositories/OrderRepository.js";
import { OrderService } from "../services/OrderService.js";
import axios from "axios";

const orderRepository = new OrderRepository();
const orderService = new OrderService();

export class PaymentController {
  // ── Checkout Pro (redirecionamento) ───────────────────────────────────────

  async createPreference(req, res, next) {
    try {
      const { orderId } = req.body;
      if (!orderId) throw new AppError("orderId obrigatorio.", 422);

      const order = await orderRepository.findById(orderId);
      if (!order) throw new AppError("Pedido nao encontrado.", 404);

      if (order.userId !== req.user.id && req.user.role !== "ADMIN") {
        throw new AppError("Acesso negado.", 403);
      }

      const accessToken = process.env.MP_ACCESS_TOKEN;
      if (!accessToken)
        throw new AppError("Mercado Pago nao configurado.", 500);

      const client = new MercadoPagoConfig({ accessToken });
      const preferenceApi = new Preference(client);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5174";
      const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

      const preference = await preferenceApi.create({
        body: {
          items: [
            {
              id: order.id,
              title: `Pedido ${process.env.STORE_NAME || "Hamburgueria"}`,
              description: `Pedido #${order.id.slice(-6).toUpperCase()}`,
              quantity: 1,
              unit_price: parseFloat(Number(order.total).toFixed(2)),
              currency_id: "BRL",
            },
          ],
          external_reference: order.id,
          back_urls: {
            success: `${frontendUrl}/checkout/retorno`,
            failure: `${frontendUrl}/checkout/retorno`,
            pending: `${frontendUrl}/checkout/retorno`,
          },
          auto_return: "approved",
          notification_url: `${backendUrl}/api/payments/webhook`,
          statement_descriptor: (process.env.STORE_NAME || "HAMBURGUERIA")
            .toUpperCase()
            .slice(0, 22),
        },
      });

      return res.status(200).json({
        data: {
          preferenceId: preference.id,
          initPoint: preference.init_point,
          sandboxInitPoint: preference.sandbox_init_point,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  // ── PIX (QR Code) ─────────────────────────────────────────────────────────

  async createPixPayment(req, res, next) {
    try {
      const { orderId } = req.body;
      if (!orderId) throw new AppError("orderId obrigatorio.", 422);

      const order = await orderRepository.findById(orderId);
      if (!order) throw new AppError("Pedido nao encontrado.", 404);

      if (
        order.userId !== req.user.id &&
        req.user.role !== "ADMIN" &&
        req.user.role !== "FUNCIONARIO"
      ) {
        throw new AppError("Acesso negado.", 403);
      }

      if (order.paymentStatus === "APROVADO")
        throw new AppError("Pedido ja pago.", 409);

      const mpToken = process.env.MP_ACCESS_TOKEN;
      if (!mpToken) throw new AppError("Mercado Pago nao configurado.", 500);

      const client = new MercadoPagoConfig({ accessToken: mpToken });
      const paymentApi = new MPPayment(client);

      const response = await paymentApi.create({
        body: {
          transaction_amount: parseFloat(Number(order.total).toFixed(2)),
          payment_method_id: "pix",
          payer: {
            email: process.env.MP_PIX_PAYER_EMAIL || "caixa@hamburgueria.com",
          },
          description: `Pedido #${order.id.slice(-6).toUpperCase()}`,
          external_reference: order.id,
          notification_url: `${process.env.BACKEND_URL}/api/payments/webhook`,
        },
      });

      const pixData = response.point_of_interaction?.transaction_data;

      return res.status(200).json({
        data: {
          paymentId: response.id,
          status: response.status,
          qrCode: pixData?.qr_code,
          qrCodeBase64: pixData?.qr_code_base64,
          ticketUrl: pixData?.ticket_url,
          expiresAt: response.date_of_expiration,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  // ── Maquininha MP Point (terminal) ─────────────────────────────────────────

  async createTerminalPayment(req, res, next) {
    try {
      const { orderId, deviceId } = req.body;
      if (!orderId) throw new AppError("orderId obrigatorio.", 422);
      if (!deviceId) throw new AppError("deviceId obrigatorio.", 422);

      const order = await orderRepository.findById(orderId);
      if (!order) throw new AppError("Pedido nao encontrado.", 404);

      if (order.paymentStatus === "APROVADO")
        throw new AppError("Pedido ja pago.", 409);

      const mpToken = process.env.MP_ACCESS_TOKEN;
      if (!mpToken) throw new AppError("Mercado Pago nao configurado.", 500);

      // Cancela intenção anterior para evitar cobrança dupla
      if (order.terminalIntentId) {
        try {
          await axios.patch(
            `https://api.mercadopago.com/v1/orders/${order.terminalIntentId}`,
            { status: "canceled" },
            {
              headers: {
                Authorization: `Bearer ${mpToken}`,
                "Content-Type": "application/json",
              },
            },
          );
          console.log(
            `[terminal] Intenção anterior ${order.terminalIntentId} cancelada.`,
          );
        } catch (err) {
          console.warn(
            "[terminal] Falha ao cancelar intenção anterior:",
            err.message,
          );
        }
      }

      const amount = parseFloat(Number(order.total).toFixed(2));

      const response = await axios.post(
        `https://api.mercadopago.com/v2/point/integration-api/devices/${deviceId}/payment-intents`,
        {
          amount,
          description: `Pedido #${order.id.slice(-6).toUpperCase()}`,
          payment_method_id: "credit_card",
          external_reference: order.id,
        },
        {
          headers: {
            Authorization: `Bearer ${mpToken}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": order.id,
          },
        },
      );

      const intentId = response.data?.id;
      if (intentId) {
        await orderService.saveTerminalIntentId(orderId, intentId);
      }

      return res.status(200).json({
        data: {
          intentId,
          status: response.data?.state,
          amount,
        },
      });
    } catch (error) {
      if (error.response) {
        console.error("[terminal] Erro MP:", error.response.data);
        return next(new AppError("Erro ao criar cobrança na maquininha.", 502));
      }
      return next(error);
    }
  }
}
