import dotenv from "dotenv";
import http from "http";
import { app } from "./app.js";
import { initializeSocketServer } from "./realtime/socketServer.js";
import { prisma } from "./lib/prisma.js";

dotenv.config();

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

const port = Number(process.env.PORT || 3001);
const server = http.createServer(app);

initializeSocketServer(server);

// Auto-migrations para colunas adicionadas incrementalmente
async function runMigrations() {
  const migrations = [
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "subtotal" NUMERIC(10,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discount" NUMERIC(10,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "terminalIntentId" TEXT`,
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryCode" TEXT`,
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "assignedMotoboyId" TEXT`,
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isPickup" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "removedIngredients" TEXT[] DEFAULT '{}'`,
    `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
  ];

  for (const sql of migrations) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (err) {
      if (!err.message?.includes("already exists")) {
        console.error("[migration] Falhou:", sql, err.message);
      }
    }
  }
}

async function startServer() {
  await runMigrations();

  server.listen(port, () => {
    console.log(`\n🍔 Hamburgueria Premium API rodando na porta ${port}`);
    console.log(`   Ambiente: ${process.env.NODE_ENV || "development"}`);
    console.log(`   Socket.IO: habilitado`);
    console.log(
      `   HMAC webhook: ${process.env.MP_WEBHOOK_SECRET ? "✅ ativo" : "⚠️ desabilitado"}\n`,
    );
  });
}

startServer().catch((err) => {
  console.error("[FATAL] Falha ao iniciar servidor:", err);
  process.exit(1);
});
