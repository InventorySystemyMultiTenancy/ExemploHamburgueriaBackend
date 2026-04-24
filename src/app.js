import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { AuthController } from "./controllers/AuthController.js";
import { OrderController } from "./controllers/OrderController.js";
import { PaymentController } from "./controllers/PaymentController.js";
import { ProductController } from "./controllers/ProductController.js";
import { CouponController } from "./controllers/CouponController.js";
import { IngredientController } from "./controllers/IngredientController.js";
import {
  authenticateToken,
  authorizeRoles,
  enforceOrderOwnership,
} from "./middlewares/authMiddleware.js";
import { errorMiddleware } from "./middlewares/errorMiddleware.js";
import { DeliveryService } from "./services/DeliveryService.js";
import { deliveryFreightSchema } from "./validators/orderSchemas.js";
import { prisma } from "./lib/prisma.js";

// ─── Validar variáveis de ambiente obrigatórias ───────────────────────────────
const REQUIRED_ENV = ["JWT_SECRET", "DATABASE_URL"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(
      `[FATAL] Variavel de ambiente obrigatoria nao definida: ${key}`,
    );
    process.exit(1);
  }
}

if (!process.env.MP_WEBHOOK_SECRET) {
  console.warn(
    "[SECURITY] MP_WEBHOOK_SECRET nao definido. Verificacao HMAC desabilitada.",
  );
}

// ─── Instâncias ───────────────────────────────────────────────────────────────
const app = express();
const authController = new AuthController();
const orderController = new OrderController();
const paymentController = new PaymentController();
const productController = new ProductController();
const couponController = new CouponController();
const ingredientController = new IngredientController();
const deliveryService = new DeliveryService();

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5174")
  .split(",")
  .map((o) => o.trim());

// ─── Middlewares globais ──────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin))
        return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { message: "Muitas tentativas. Tente novamente em 15 minutos." },
  },
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

// ─── Autenticação ─────────────────────────────────────────────────────────────
app.post("/api/auth/register", authLimiter, (req, res, next) =>
  authController.register(req, res, next),
);
app.post("/api/auth/login", authLimiter, (req, res, next) =>
  authController.login(req, res, next),
);
app.post(
  "/api/auth/users",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => authController.createUserByAdmin(req, res, next),
);

// ─── Clientes (admin) ─────────────────────────────────────────────────────────
app.get(
  "/api/admin/clients",
  authenticateToken,
  authorizeRoles("ADMIN", "FUNCIONARIO"),
  async (_req, res, next) => {
    try {
      const users = await prisma.user.findMany({
        where: { role: "CLIENTE" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
        },
        orderBy: { name: "asc" },
      });
      return res.status(200).json({ data: users });
    } catch (err) {
      return next(err);
    }
  },
);

// ─── Motoboys (admin) ─────────────────────────────────────────────────────────
app.get(
  "/api/admin/motoboys",
  authenticateToken,
  authorizeRoles("ADMIN", "FUNCIONARIO", "COZINHA"),
  async (_req, res, next) => {
    try {
      const motoboys = await prisma.$queryRaw`
        SELECT id, name FROM "User" WHERE role::text = 'MOTOBOY' ORDER BY name ASC
      `;
      return res.status(200).json({ data: motoboys });
    } catch (err) {
      return next(err);
    }
  },
);

// ─── Produtos (público) ───────────────────────────────────────────────────────
app.get("/api/products", (req, res, next) =>
  productController.list(req, res, next),
);
app.get("/api/products/top", (req, res, next) =>
  productController.listTopSelling(req, res, next),
);
app.get("/api/products/:productId", (req, res, next) =>
  productController.getById(req, res, next),
);

// ─── Combos (público) ─────────────────────────────────────────────────────────
app.get("/api/combos", (req, res, next) =>
  productController.listCombos(req, res, next),
);

// ─── Adicionais (público) ─────────────────────────────────────────────────────
app.get("/api/addons", (req, res, next) =>
  productController.listAddons(req, res, next),
);

// ─── Cupom (público — preview) ────────────────────────────────────────────────
app.get("/api/coupons/validate/:code", (req, res, next) =>
  couponController.validate(req, res, next),
);

// ─── Produtos (admin) ─────────────────────────────────────────────────────────
app.get(
  "/api/admin/products",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => productController.listAdmin(req, res, next),
);
app.post(
  "/api/admin/products",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => productController.create(req, res, next),
);
app.put(
  "/api/admin/products/:productId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => productController.update(req, res, next),
);
app.delete(
  "/api/admin/products/:productId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => productController.deactivate(req, res, next),
);
app.patch(
  "/api/admin/products/:productId/restore",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => productController.restore(req, res, next),
);

// ─── Adicionais (admin) ───────────────────────────────────────────────────────
app.post(
  "/api/admin/addons",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => productController.createAddon(req, res, next),
);
app.put(
  "/api/admin/addons/:addonId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => productController.updateAddon(req, res, next),
);
app.delete(
  "/api/admin/addons/:addonId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => productController.deactivateAddon(req, res, next),
);

// ─── Combos (admin) ───────────────────────────────────────────────────────────
app.get(
  "/api/admin/combos",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => productController.listCombosAdmin(req, res, next),
);
app.post(
  "/api/admin/combos",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => productController.createCombo(req, res, next),
);
app.put(
  "/api/admin/combos/:comboId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => productController.updateCombo(req, res, next),
);
app.delete(
  "/api/admin/combos/:comboId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => productController.deactivateCombo(req, res, next),
);

// ─── Cupons (admin) ───────────────────────────────────────────────────────────
app.get(
  "/api/admin/coupons",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => couponController.list(req, res, next),
);
app.post(
  "/api/admin/coupons",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => couponController.create(req, res, next),
);
app.put(
  "/api/admin/coupons/:couponId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => couponController.update(req, res, next),
);
app.delete(
  "/api/admin/coupons/:couponId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => couponController.deactivate(req, res, next),
);

// ─── Ingredientes/Estoque (admin/funcionario) ─────────────────────────────────
app.get(
  "/api/admin/ingredients",
  authenticateToken,
  authorizeRoles("ADMIN", "FUNCIONARIO"),
  (req, res, next) => ingredientController.list(req, res, next),
);
app.get(
  "/api/admin/ingredients/low-stock",
  authenticateToken,
  authorizeRoles("ADMIN", "FUNCIONARIO"),
  (req, res, next) => ingredientController.listLowStock(req, res, next),
);
app.post(
  "/api/admin/ingredients",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => ingredientController.create(req, res, next),
);
app.put(
  "/api/admin/ingredients/:ingredientId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => ingredientController.update(req, res, next),
);
app.patch(
  "/api/admin/ingredients/:ingredientId/stock",
  authenticateToken,
  authorizeRoles("ADMIN", "FUNCIONARIO"),
  (req, res, next) => ingredientController.adjustStock(req, res, next),
);
app.delete(
  "/api/admin/ingredients/:ingredientId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  (req, res, next) => ingredientController.delete(req, res, next),
);

// ─── Pedidos ──────────────────────────────────────────────────────────────────
app.get(
  "/api/orders",
  authenticateToken,
  authorizeRoles("ADMIN", "FUNCIONARIO", "COZINHA"),
  (req, res, next) => orderController.listAll(req, res, next),
);
app.post(
  "/api/orders",
  authenticateToken,
  authorizeRoles("CLIENTE", "ADMIN"),
  (req, res, next) => orderController.create(req, res, next),
);
app.get(
  "/api/orders/me",
  authenticateToken,
  authorizeRoles("CLIENTE"),
  (req, res, next) => orderController.getMyOrders(req, res, next),
);
app.get(
  "/api/orders/:orderId",
  authenticateToken,
  authorizeRoles("CLIENTE", "ADMIN", "COZINHA", "FUNCIONARIO", "MOTOBOY"),
  enforceOrderOwnership,
  (req, res, next) => orderController.getById(req, res, next),
);
app.patch(
  "/api/orders/:orderId/status",
  authenticateToken,
  authorizeRoles("ADMIN", "COZINHA", "FUNCIONARIO"),
  (req, res, next) => orderController.updateStatus(req, res, next),
);
app.patch(
  "/api/orders/:orderId/cancel",
  authenticateToken,
  authorizeRoles("ADMIN", "FUNCIONARIO"),
  (req, res, next) => orderController.cancel(req, res, next),
);
app.patch(
  "/api/orders/:orderId/assign-motoboy",
  authenticateToken,
  authorizeRoles("ADMIN", "FUNCIONARIO", "COZINHA"),
  (req, res, next) => orderController.assignMotoboy(req, res, next),
);
app.post(
  "/api/orders/:orderId/confirm-delivery",
  authenticateToken,
  authorizeRoles("ADMIN", "FUNCIONARIO", "COZINHA", "MOTOBOY"),
  (req, res, next) => orderController.confirmDelivery(req, res, next),
);
app.patch(
  "/api/orders/:orderId/payment-status",
  authenticateToken,
  authorizeRoles("ADMIN", "FUNCIONARIO"),
  (req, res, next) => orderController.adminUpdatePaymentStatus(req, res, next),
);
app.delete(
  "/api/orders/:orderId",
  authenticateToken,
  authorizeRoles("CLIENTE", "ADMIN"),
  (req, res, next) => orderController.deleteOrder(req, res, next),
);

// ─── Histórico e Analytics (admin) ───────────────────────────────────────────
app.get(
  "/api/admin/orders/history",
  authenticateToken,
  authorizeRoles("ADMIN", "FUNCIONARIO"),
  (req, res, next) => orderController.history(req, res, next),
);
app.get(
  "/api/admin/analytics",
  authenticateToken,
  authorizeRoles("ADMIN", "FUNCIONARIO"),
  (req, res, next) => orderController.analytics(req, res, next),
);

// ─── Motoboy ──────────────────────────────────────────────────────────────────
app.get(
  "/api/motoboy/orders",
  authenticateToken,
  authorizeRoles("MOTOBOY", "ADMIN", "FUNCIONARIO"),
  (req, res, next) => orderController.motoboyOrders(req, res, next),
);

// ─── Frete ────────────────────────────────────────────────────────────────────
app.post(
  "/api/delivery/calculate",
  authenticateToken,
  async (req, res, next) => {
    try {
      const payload = deliveryFreightSchema.parse(req.body);
      const result = await deliveryService.calculateFreight(payload);
      return res.status(200).json({ data: result });
    } catch (err) {
      return next(err);
    }
  },
);

// ─── Pagamentos ───────────────────────────────────────────────────────────────

// Webhook do Mercado Pago (público — MP envia POST/GET aqui)
app.post("/api/payments/webhook", (req, res, next) =>
  orderController.paymentWebhook(req, res, next),
);
app.get("/api/payments/webhook", (_req, res) =>
  res.status(200).json({ status: "ok" }),
);

// Confirmação explícita de pagamento Checkout Pro (retorno do MP com payment_id na URL)
app.post(
  "/api/payments/checkout-confirm",
  authenticateToken,
  authorizeRoles("CLIENTE", "ADMIN"),
  (req, res, next) => orderController.confirmCheckoutPayment(req, res, next),
);

// Gerar preferência Checkout Pro
app.post("/api/payments/preference", authenticateToken, (req, res, next) =>
  paymentController.createPreference(req, res, next),
);

// PIX (QR code)
app.post(
  "/api/payments/pix",
  authenticateToken,
  authorizeRoles("CLIENTE", "ADMIN", "FUNCIONARIO"),
  (req, res, next) => paymentController.createPixPayment(req, res, next),
);

// Maquininha MP Point
app.post(
  "/api/payments/terminal",
  authenticateToken,
  authorizeRoles("ADMIN", "FUNCIONARIO"),
  (req, res, next) => paymentController.createTerminalPayment(req, res, next),
);

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorMiddleware);

export { app };
