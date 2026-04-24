import jwt from "jsonwebtoken";
import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";

// ─── Autenticação JWT ─────────────────────────────────────────────────────────
export const authenticateToken = (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("Token nao fornecido.", 401);
    }

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };

    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError("Token invalido ou expirado.", 401));
  }
};

// ─── RBAC: Role-Based Access Control ─────────────────────────────────────────
export const authorizeRoles =
  (...allowedRoles) =>
  (req, _res, next) => {
    if (!req.user?.role) {
      return next(new AppError("Usuario nao autenticado.", 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError("Acesso negado.", 403));
    }

    return next();
  };

// ─── IDOR: proteção de acesso a pedidos alheios ───────────────────────────────
// Garante que o CLIENTE só acessa seus próprios pedidos.
// Staff (ADMIN, COZINHA, FUNCIONARIO, MOTOBOY) passa sem restrição.
export const enforceOrderOwnership = async (req, _res, next) => {
  try {
    const orderId = req.params.orderId || req.params.id;

    if (!orderId) {
      throw new AppError("orderId nao informado.", 400);
    }

    const STAFF_BYPASS = new Set([
      "ADMIN",
      "COZINHA",
      "FUNCIONARIO",
      "MOTOBOY",
    ]);

    if (STAFF_BYPASS.has(req.user.role)) {
      return next();
    }

    // Busca o pedido verificando dono sem expor dados desnecessários
    const rows = await prisma.$queryRaw`
      SELECT o.id, o."userId", u.id AS "uId", u.role::text AS "uRole"
      FROM "Order" o
      LEFT JOIN "User" u ON u.id = o."userId"
      WHERE o.id = ${orderId}
    `;

    if (!rows.length) {
      throw new AppError("Pedido nao encontrado.", 404);
    }

    const order = rows[0];

    if (req.user.role === "CLIENTE") {
      if (!order.uId || order.uId !== req.user.id) {
        throw new AppError(
          "Voce nao tem permissao para acessar este pedido.",
          403,
        );
      }
      return next();
    }

    throw new AppError("Perfil sem permissao para acessar pedido.", 403);
  } catch (error) {
    return next(error);
  }
};
