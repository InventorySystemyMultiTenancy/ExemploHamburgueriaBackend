import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let ioInstance = null;

const STAFF_ROLES = new Set(["ADMIN", "FUNCIONARIO", "COZINHA", "MOTOBOY"]);

function getAllowedOrigins() {
  return (process.env.CORS_ORIGIN || "http://localhost:5174")
    .split(",")
    .map((o) => o.trim());
}

export function initializeSocketServer(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Autenticação JWT no handshake
  ioInstance.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) return next(new Error("Token nao fornecido."));

      const payload = jwt.verify(token, process.env.JWT_SECRET);

      socket.data.user = {
        id: payload.sub,
        role: payload.role,
        email: payload.email,
      };

      return next();
    } catch {
      return next(new Error("Token invalido ou expirado."));
    }
  });

  ioInstance.on("connection", (socket) => {
    const { id, role } = socket.data.user;

    // Cada usuário entra na sua sala pessoal e na sala do seu perfil
    socket.join(`user:${id}`);
    socket.join(`role:${role}`);

    // Staff entra na sala geral de funcionários
    if (STAFF_ROLES.has(role)) {
      socket.join("staff");
    }

    socket.on("disconnect", () => {
      console.log(`[socket] Desconectado: ${id} (${role})`);
    });
  });

  return ioInstance;
}

// ─── Emissores de eventos ─────────────────────────────────────────────────────

/**
 * Emite para a sala da cozinha/staff quando um novo pedido chega.
 */
export function emitOrderCreated({ orderId, userId, status, total }) {
  if (!ioInstance) return;

  const payload = { orderId, userId, status, total };

  // Notifica toda a equipe
  ioInstance.to("staff").emit("order:created", payload);

  // Notifica o cliente (app mobile ou web)
  if (userId) {
    ioInstance.to(`user:${userId}`).emit("order:created", payload);
  }

  console.log(`[socket] order:created emitido → ${orderId}`);
}

/**
 * Emite quando o status do pedido muda (ex: RECEBIDO → EM_PREPARO → PRONTO).
 */
export function emitOrderStatusUpdated({
  orderId,
  userId,
  previousStatus,
  status,
}) {
  if (!ioInstance) return;

  const payload = { orderId, userId, previousStatus, status };

  ioInstance.to("staff").emit("order:status_updated", payload);

  if (userId) {
    ioInstance.to(`user:${userId}`).emit("order:status_updated", payload);
  }

  console.log(
    `[socket] order:status_updated → ${orderId}: ${previousStatus} → ${status}`,
  );
}

/**
 * Emite quando o pagamento é confirmado ou rejeitado.
 */
export function emitPaymentUpdated({ orderId, userId, paymentStatus }) {
  if (!ioInstance) return;

  const payload = { orderId, userId, paymentStatus };

  ioInstance.to("staff").emit("order:payment_updated", payload);

  if (userId) {
    ioInstance.to(`user:${userId}`).emit("order:payment_updated", payload);
  }

  console.log(`[socket] order:payment_updated → ${orderId}: ${paymentStatus}`);
}

export function getIO() {
  return ioInstance;
}
