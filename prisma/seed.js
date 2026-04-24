/**
 * Seed: popula o banco com dados iniciais para desenvolvimento.
 * Rode: npm run prisma:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...");

  // ─── Usuários ─────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("123456", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@hamburgueria.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@hamburgueria.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "cozinha@hamburgueria.com" },
    update: {},
    create: {
      name: "Cozinheiro",
      email: "cozinha@hamburgueria.com",
      passwordHash,
      role: "COZINHA",
    },
  });

  await prisma.user.upsert({
    where: { email: "motoboy@hamburgueria.com" },
    update: {},
    create: {
      name: "Motoboy",
      email: "motoboy@hamburgueria.com",
      passwordHash,
      role: "MOTOBOY",
    },
  });

  await prisma.user.upsert({
    where: { email: "cliente@hamburgueria.com" },
    update: {},
    create: {
      name: "Cliente Teste",
      email: "cliente@hamburgueria.com",
      passwordHash,
      role: "CLIENTE",
    },
  });

  console.log("✅ Usuários criados");

  // ─── Ingredientes (Estoque) ────────────────────────────────────────────────
  const [carne, pao, queijo, alface, tomate, bacon, cebola, molhoEspecial] =
    await Promise.all([
      prisma.ingredient.upsert({
        where: { name: "Carne Bovina 180g" },
        update: {},
        create: {
          name: "Carne Bovina 180g",
          unit: "un",
          stockQuantity: 100,
          minStock: 10,
        },
      }),
      prisma.ingredient.upsert({
        where: { name: "Pão Brioche" },
        update: {},
        create: {
          name: "Pão Brioche",
          unit: "un",
          stockQuantity: 100,
          minStock: 10,
        },
      }),
      prisma.ingredient.upsert({
        where: { name: "Queijo Cheddar" },
        update: {},
        create: {
          name: "Queijo Cheddar",
          unit: "un",
          stockQuantity: 200,
          minStock: 20,
        },
      }),
      prisma.ingredient.upsert({
        where: { name: "Alface" },
        update: {},
        create: {
          name: "Alface",
          unit: "folha",
          stockQuantity: 500,
          minStock: 50,
        },
      }),
      prisma.ingredient.upsert({
        where: { name: "Tomate" },
        update: {},
        create: {
          name: "Tomate",
          unit: "fatia",
          stockQuantity: 300,
          minStock: 30,
        },
      }),
      prisma.ingredient.upsert({
        where: { name: "Bacon" },
        update: {},
        create: {
          name: "Bacon",
          unit: "tira",
          stockQuantity: 200,
          minStock: 20,
        },
      }),
      prisma.ingredient.upsert({
        where: { name: "Cebola Caramelizada" },
        update: {},
        create: {
          name: "Cebola Caramelizada",
          unit: "g",
          stockQuantity: 5000,
          minStock: 500,
        },
      }),
      prisma.ingredient.upsert({
        where: { name: "Molho Especial" },
        update: {},
        create: {
          name: "Molho Especial",
          unit: "ml",
          stockQuantity: 3000,
          minStock: 300,
        },
      }),
    ]);

  const batataIngrediente = await prisma.ingredient.upsert({
    where: { name: "Batata Frita 150g" },
    update: {},
    create: {
      name: "Batata Frita 150g",
      unit: "porção",
      stockQuantity: 150,
      minStock: 20,
    },
  });

  const refrigeranteIngrediente = await prisma.ingredient.upsert({
    where: { name: "Refrigerante 350ml" },
    update: {},
    create: {
      name: "Refrigerante 350ml",
      unit: "lata",
      stockQuantity: 200,
      minStock: 24,
    },
  });

  console.log("✅ Ingredientes criados");

  // ─── Adicionais ───────────────────────────────────────────────────────────
  const [
    addonBacon,
    addonQueijoCheddar,
    addonOvo,
    addonMolhoBBQ,
    addonMolhoPicante,
    addonCebola,
    addonJalapeno,
  ] = await Promise.all([
    prisma.addon.upsert({
      where: { id: "addon-bacon-001" },
      update: {},
      create: {
        id: "addon-bacon-001",
        name: "Bacon Extra",
        price: 4.5,
        category: "Proteína",
      },
    }),
    prisma.addon.upsert({
      where: { id: "addon-cheddar-001" },
      update: {},
      create: {
        id: "addon-cheddar-001",
        name: "Queijo Cheddar Extra",
        price: 3.0,
        category: "Queijo",
      },
    }),
    prisma.addon.upsert({
      where: { id: "addon-ovo-001" },
      update: {},
      create: {
        id: "addon-ovo-001",
        name: "Ovo Frito",
        price: 2.5,
        category: "Proteína",
      },
    }),
    prisma.addon.upsert({
      where: { id: "addon-bbq-001" },
      update: {},
      create: {
        id: "addon-bbq-001",
        name: "Molho BBQ",
        price: 1.5,
        category: "Molho",
      },
    }),
    prisma.addon.upsert({
      where: { id: "addon-picante-001" },
      update: {},
      create: {
        id: "addon-picante-001",
        name: "Molho Picante",
        price: 1.5,
        category: "Molho",
      },
    }),
    prisma.addon.upsert({
      where: { id: "addon-cebola-001" },
      update: {},
      create: {
        id: "addon-cebola-001",
        name: "Cebola Crispy",
        price: 2.0,
        category: "Extra",
      },
    }),
    prisma.addon.upsert({
      where: { id: "addon-jalapeno-001" },
      update: {},
      create: {
        id: "addon-jalapeno-001",
        name: "Jalapeño",
        price: 2.0,
        category: "Extra",
      },
    }),
  ]);

  console.log("✅ Adicionais criados");

  // ─── Produtos ─────────────────────────────────────────────────────────────
  const classico = await prisma.product.upsert({
    where: { id: "prod-classico-001" },
    update: {},
    create: {
      id: "prod-classico-001",
      name: "Clássico",
      description:
        "180g de carne, queijo cheddar, alface, tomate e molho especial no pão brioche",
      category: "Hambúrgueres",
      basePrice: 28.9,
      isBurger: true,
      productAddons: {
        create: [
          { addonId: addonBacon.id },
          { addonId: addonQueijoCheddar.id },
          { addonId: addonOvo.id },
          { addonId: addonMolhoBBQ.id },
          { addonId: addonMolhoPicante.id },
          { addonId: addonCebola.id },
          { addonId: addonJalapeno.id },
        ],
      },
      productIngredients: {
        create: [
          { ingredientId: carne.id, quantity: 1 },
          { ingredientId: pao.id, quantity: 1 },
          { ingredientId: queijo.id, quantity: 1 },
          { ingredientId: alface.id, quantity: 2 },
          { ingredientId: tomate.id, quantity: 2 },
          { ingredientId: molhoEspecial.id, quantity: 20 },
        ],
      },
    },
  });

  const smokeHouse = await prisma.product.upsert({
    where: { id: "prod-smokehouse-001" },
    update: {},
    create: {
      id: "prod-smokehouse-001",
      name: "Smoke House",
      description:
        "180g de carne, bacon, queijo cheddar, cebola caramelizada e molho BBQ",
      category: "Hambúrgueres",
      basePrice: 36.9,
      isBurger: true,
      productAddons: {
        create: [
          { addonId: addonBacon.id },
          { addonId: addonQueijoCheddar.id },
          { addonId: addonOvo.id },
          { addonId: addonMolhoPicante.id },
          { addonId: addonJalapeno.id },
        ],
      },
      productIngredients: {
        create: [
          { ingredientId: carne.id, quantity: 1 },
          { ingredientId: pao.id, quantity: 1 },
          { ingredientId: queijo.id, quantity: 1 },
          { ingredientId: bacon.id, quantity: 3 },
          { ingredientId: cebola.id, quantity: 30 },
          { ingredientId: molhoEspecial.id, quantity: 20 },
        ],
      },
    },
  });

  const batata = await prisma.product.upsert({
    where: { id: "prod-batata-001" },
    update: {},
    create: {
      id: "prod-batata-001",
      name: "Batata Frita",
      description: "Porção de 150g de batatas crocantes",
      category: "Acompanhamentos",
      basePrice: 14.9,
      isBurger: false,
      productIngredients: {
        create: [{ ingredientId: batataIngrediente.id, quantity: 1 }],
      },
    },
  });

  const refrigerante = await prisma.product.upsert({
    where: { id: "prod-refri-001" },
    update: {},
    create: {
      id: "prod-refri-001",
      name: "Refrigerante",
      description: "Lata 350ml — Coca-Cola, Guaraná ou Fanta",
      category: "Bebidas",
      basePrice: 7.9,
      isBurger: false,
      productIngredients: {
        create: [{ ingredientId: refrigeranteIngrediente.id, quantity: 1 }],
      },
    },
  });

  console.log("✅ Produtos criados");

  // ─── Combos ───────────────────────────────────────────────────────────────
  await prisma.combo.upsert({
    where: { id: "combo-classico-001" },
    update: {},
    create: {
      id: "combo-classico-001",
      name: "Combo Clássico",
      description: "Clássico + Batata Frita + Refrigerante",
      promotionalPrice: 44.9,
      parts: {
        create: [
          { productId: classico.id, quantity: 1 },
          { productId: batata.id, quantity: 1 },
          { productId: refrigerante.id, quantity: 1 },
        ],
      },
    },
  });

  await prisma.combo.upsert({
    where: { id: "combo-smokehouse-001" },
    update: {},
    create: {
      id: "combo-smokehouse-001",
      name: "Combo Smoke House",
      description: "Smoke House + Batata Frita + Refrigerante",
      promotionalPrice: 52.9,
      parts: {
        create: [
          { productId: smokeHouse.id, quantity: 1 },
          { productId: batata.id, quantity: 1 },
          { productId: refrigerante.id, quantity: 1 },
        ],
      },
    },
  });

  console.log("✅ Combos criados");

  // ─── Cupons ───────────────────────────────────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: "BEM_VINDO10" },
    update: {},
    create: {
      code: "BEM_VINDO10",
      type: "PERCENTUAL",
      value: 10,
      minOrderValue: 30,
      maxUses: 100,
      isActive: true,
    },
  });

  await prisma.coupon.upsert({
    where: { code: "FRETE5" },
    update: {},
    create: {
      code: "FRETE5",
      type: "VALOR_FIXO",
      value: 5,
      isActive: true,
    },
  });

  console.log("✅ Cupons criados");
  console.log("\n🎉 Seed concluído!");
  console.log("   Admin: admin@hamburgueria.com / 123456");
  console.log("   Cozinha: cozinha@hamburgueria.com / 123456");
  console.log("   Motoboy: motoboy@hamburgueria.com / 123456");
  console.log("   Cliente: cliente@hamburgueria.com / 123456");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
