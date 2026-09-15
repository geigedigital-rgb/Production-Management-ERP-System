-- Manual BOM row order on products (preserved when copying into orders).
-- Tables use Prisma camelCase for FKs (productId); sortOrder is mapped to sort_order.

ALTER TABLE "product_materials" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product_operations" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

WITH ranked_materials AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY "productId" ORDER BY id) - 1)::INTEGER AS rn
  FROM "product_materials"
)
UPDATE "product_materials" AS pm
SET "sort_order" = ranked_materials.rn
FROM ranked_materials
WHERE pm.id = ranked_materials.id;

WITH ranked_operations AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY "productId" ORDER BY id) - 1)::INTEGER AS rn
  FROM "product_operations"
)
UPDATE "product_operations" AS po
SET "sort_order" = ranked_operations.rn
FROM ranked_operations
WHERE po.id = ranked_operations.id;

CREATE INDEX IF NOT EXISTS "product_materials_productId_sort_order_idx" ON "product_materials"("productId", "sort_order");
CREATE INDEX IF NOT EXISTS "product_operations_productId_sort_order_idx" ON "product_operations"("productId", "sort_order");
