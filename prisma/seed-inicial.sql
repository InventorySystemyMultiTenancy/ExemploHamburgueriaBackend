-- =============================================================
-- Seed Inicial — Hamburgueria
-- Cardápio + Usuários
-- Uso: rodar no DBeaver conectado ao banco da hamburgueria
-- Requisito: extensão pgcrypto ativa (CREATE EXTENSION IF NOT EXISTS "pgcrypto";)
-- =============================================================

-- Garante extensão para uuid e bcrypt
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- 1. USUÁRIOS (CADASTROS)
-- Senha padrão de todos: Admin123!
-- Troque as senhas após o primeiro login.
-- =============================================================

INSERT INTO "User" (id, name, email, "passwordHash", role, "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid()::text,
    'Administrador',
    'admin@hamburgueria.com',
    crypt('Admin123!', gen_salt('bf', 10)),
    'ADMIN',
    NOW(), NOW()
  ),
  (
    gen_random_uuid()::text,
    'Funcionário',
    'funcionario@hamburgueria.com',
    crypt('Admin123!', gen_salt('bf', 10)),
    'FUNCIONARIO',
    NOW(), NOW()
  ),
  (
    gen_random_uuid()::text,
    'Cozinha',
    'cozinha@hamburgueria.com',
    crypt('Admin123!', gen_salt('bf', 10)),
    'COZINHA',
    NOW(), NOW()
  ),
  (
    gen_random_uuid()::text,
    'Motoboy',
    'motoboy@hamburgueria.com',
    crypt('Admin123!', gen_salt('bf', 10)),
    'MOTOBOY',
    NOW(), NOW()
  )
ON CONFLICT (email) DO NOTHING;

-- =============================================================
-- 2. PRODUTOS — HAMBÚRGUERES
-- =============================================================

WITH p AS (
  INSERT INTO "Product" (id, name, description, "imageUrl", category, stock, "isActive", "createdAt", "updatedAt")
  VALUES
    (
      'hb_smash_classico',
      'Smash Clássico',
      'Blend de carne bovina prensado na chapa, queijo cheddar, alface, tomate, cebola caramelizada e molho especial da casa.',
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
      'Hambúrgueres',
      0, true, NOW(), NOW()
    ),
    (
      'hb_smash_duplo',
      'Smash Duplo',
      'Dois blends de carne bovina prensados na chapa, duplo cheddar, bacon crocante, alface, tomate e molho especial.',
      'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=800&q=80',
      'Hambúrgueres',
      0, true, NOW(), NOW()
    ),
    (
      'hb_smash_bbq',
      'Smash BBQ',
      'Blend de carne, queijo gouda, bacon, cebola crispy, molho barbecue artesanal e pão brioche tostado.',
      'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=800&q=80',
      'Hambúrgueres',
      0, true, NOW(), NOW()
    ),
    (
      'hb_smash_frango',
      'Smash Frango Crispy',
      'Frango empanado crocante, queijo cheddar, alface, tomate, picles e maionese de alho.',
      'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=800&q=80',
      'Hambúrgueres',
      0, true, NOW(), NOW()
    ),
    (
      'hb_smash_veg',
      'Smash Vegetariano',
      'Blend de grão-de-bico e ervas, queijo brie, rúcula, tomate seco, cebola roxa e pesto de manjericão.',
      'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=800&q=80',
      'Hambúrgueres',
      0, true, NOW(), NOW()
    ),
    (
      'hb_smash_especial',
      'Smash Especial da Casa',
      'Blend premium, queijo brie derretido, bacon defumado, ovo caipira, cebola caramelizada, rúcula e aioli trufado.',
      'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800&q=80',
      'Hambúrgueres',
      0, true, NOW(), NOW()
    )
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
-- Tamanhos dos hambúrgueres (todos têm apenas MEDIA = tamanho único)
INSERT INTO "ProductSize" (id, "productId", size, price, "costPrice", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'hb_smash_classico', 'MEDIA', 28.90, 12.00, NOW(), NOW()),
  (gen_random_uuid()::text, 'hb_smash_duplo',    'MEDIA', 35.90, 16.00, NOW(), NOW()),
  (gen_random_uuid()::text, 'hb_smash_bbq',      'MEDIA', 32.90, 14.00, NOW(), NOW()),
  (gen_random_uuid()::text, 'hb_smash_frango',   'MEDIA', 30.90, 13.00, NOW(), NOW()),
  (gen_random_uuid()::text, 'hb_smash_veg',      'MEDIA', 27.90, 11.00, NOW(), NOW()),
  (gen_random_uuid()::text, 'hb_smash_especial', 'MEDIA', 38.90, 18.00, NOW(), NOW())
ON CONFLICT ("productId", size) DO NOTHING;

-- =============================================================
-- 3. PRODUTOS — BATATAS E PORÇÕES
-- =============================================================

INSERT INTO "Product" (id, name, description, "imageUrl", category, stock, "isActive", "createdAt", "updatedAt")
VALUES
  (
    'hb_batata_simples',
    'Batata Frita',
    'Batatas crocantes por fora e macias por dentro, fritas em óleo vegetal.',
    'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80',
    'Porções',
    0, true, NOW(), NOW()
  ),
  (
    'hb_batata_temperada',
    'Batata Temperada',
    'Batata frita com tempero especial da casa: alho, páprica defumada e ervas.',
    'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=800&q=80',
    'Porções',
    0, true, NOW(), NOW()
  ),
  (
    'hb_batata_cheddar',
    'Batata com Cheddar e Bacon',
    'Batata frita coberta com cheddar derretido e bacon crocante.',
    'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=800&q=80',
    'Porções',
    0, true, NOW(), NOW()
  ),
  (
    'hb_onion_rings',
    'Onion Rings',
    'Anéis de cebola empanados e fritos, crocantes por fora e macios por dentro.',
    'https://images.unsplash.com/photo-1639024471283-03518883512d?w=800&q=80',
    'Porções',
    0, true, NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO "ProductSize" (id, "productId", size, price, "costPrice", "createdAt", "updatedAt")
VALUES
  -- Batata Simples: PEQUENA e GRANDE
  (gen_random_uuid()::text, 'hb_batata_simples',    'PEQUENA', 12.90, 4.00, NOW(), NOW()),
  (gen_random_uuid()::text, 'hb_batata_simples',    'GRANDE',  18.90, 6.00, NOW(), NOW()),
  -- Batata Temperada
  (gen_random_uuid()::text, 'hb_batata_temperada',  'PEQUENA', 14.90, 4.50, NOW(), NOW()),
  (gen_random_uuid()::text, 'hb_batata_temperada',  'GRANDE',  21.90, 7.00, NOW(), NOW()),
  -- Batata com Cheddar
  (gen_random_uuid()::text, 'hb_batata_cheddar',    'PEQUENA', 17.90, 6.00, NOW(), NOW()),
  (gen_random_uuid()::text, 'hb_batata_cheddar',    'GRANDE',  24.90, 9.00, NOW(), NOW()),
  -- Onion Rings
  (gen_random_uuid()::text, 'hb_onion_rings',       'MEDIA',   16.90, 5.00, NOW(), NOW())
ON CONFLICT ("productId", size) DO NOTHING;

-- =============================================================
-- 4. PRODUTOS — BEBIDAS
-- =============================================================

INSERT INTO "Product" (id, name, description, "imageUrl", category, stock, "isActive", "createdAt", "updatedAt")
VALUES
  (
    'hb_refri_lata',
    'Refrigerante Lata',
    'Coca-Cola, Guaraná, Sprite ou Fanta. Gelada e na hora.',
    'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&q=80',
    'Bebidas',
    0, true, NOW(), NOW()
  ),
  (
    'hb_suco_natural',
    'Suco Natural',
    'Laranja, limão ou maracujá. Feito na hora com frutas frescas.',
    'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=800&q=80',
    'Bebidas',
    0, true, NOW(), NOW()
  ),
  (
    'hb_milkshake',
    'Milkshake',
    'Chocolate, morango ou baunilha. Cremoso e feito com sorvete artesanal.',
    'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=800&q=80',
    'Bebidas',
    0, true, NOW(), NOW()
  ),
  (
    'hb_agua',
    'Água Mineral',
    'Água mineral sem gás ou com gás, garrafa 500ml.',
    NULL,
    'Bebidas',
    0, true, NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO "ProductSize" (id, "productId", size, price, "costPrice", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'hb_refri_lata',   'PEQUENA',  6.90, 2.50, NOW(), NOW()),
  (gen_random_uuid()::text, 'hb_suco_natural',  'MEDIA',    9.90, 3.00, NOW(), NOW()),
  (gen_random_uuid()::text, 'hb_milkshake',     'MEDIA',   18.90, 6.00, NOW(), NOW()),
  (gen_random_uuid()::text, 'hb_agua',          'PEQUENA',  3.90, 1.20, NOW(), NOW())
ON CONFLICT ("productId", size) DO NOTHING;

-- =============================================================
-- 5. PRODUTOS — SOBREMESAS
-- =============================================================

INSERT INTO "Product" (id, name, description, "imageUrl", category, stock, "isActive", "createdAt", "updatedAt")
VALUES
  (
    'hb_brownie',
    'Brownie',
    'Brownie de chocolate belga com sorvete de baunilha e calda quente.',
    'https://images.unsplash.com/photo-1607920592519-bab2a80efd90?w=800&q=80',
    'Sobremesas',
    0, true, NOW(), NOW()
  ),
  (
    'hb_sorvete',
    'Sorvete Artesanal',
    'Duas bolas de sorvete artesanal. Sabores: chocolate, baunilha, morango ou caramelo salgado.',
    'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80',
    'Sobremesas',
    0, true, NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO "ProductSize" (id, "productId", size, price, "costPrice", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'hb_brownie',  'MEDIA', 14.90, 4.50, NOW(), NOW()),
  (gen_random_uuid()::text, 'hb_sorvete',  'MEDIA', 12.90, 4.00, NOW(), NOW())
ON CONFLICT ("productId", size) DO NOTHING;

-- =============================================================
-- Resultado esperado:
--   Users: 4 cadastros (ADMIN, FUNCIONARIO, COZINHA, MOTOBOY)
--   Products: 16 produtos em 4 categorias
--   ProductSizes: 23 tamanhos
-- =============================================================
