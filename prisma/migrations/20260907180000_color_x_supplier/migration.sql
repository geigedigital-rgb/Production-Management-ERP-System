-- Color palette per supplier offer + product-line supplier/color defaults.

ALTER TABLE "material_suppliers"
  ADD COLUMN IF NOT EXISTS "available_colors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "product_materials"
  ADD COLUMN IF NOT EXISTS "supplierId" TEXT,
  ADD COLUMN IF NOT EXISTS "colorSnapshot" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_materials_supplierId_fkey'
  ) THEN
    ALTER TABLE "product_materials"
      ADD CONSTRAINT "product_materials_supplierId_fkey"
      FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "product_materials_supplierId_idx"
  ON "product_materials"("supplierId");

-- Backfill offer palettes from material.available_colors.
UPDATE "material_suppliers" ms
SET "available_colors" = m."available_colors"
FROM "materials" m
WHERE ms."materialId" = m."id"
  AND cardinality(m."available_colors") > 0
  AND cardinality(ms."available_colors") = 0;

-- Materials with colors but no offers: ensure supplier row.
INSERT INTO "suppliers" ("id", "nameUk", "createdAt", "updatedAt", "status")
SELECT
  'sup_' || substr(md5(random()::text || m."id"), 1, 20),
  COALESCE(NULLIF(trim(m."supplierCode"), ''), 'Каталог'),
  NOW(),
  NOW(),
  'ACTIVE'
FROM "materials" m
WHERE cardinality(m."available_colors") > 0
  AND NOT EXISTS (SELECT 1 FROM "material_suppliers" ms WHERE ms."materialId" = m."id")
  AND NOT EXISTS (
    SELECT 1 FROM "suppliers" s
    WHERE lower(s."nameUk") = lower(COALESCE(NULLIF(trim(m."supplierCode"), ''), 'Каталог'))
  )
ON CONFLICT ("nameUk") DO NOTHING;

INSERT INTO "material_suppliers" (
  "id", "materialId", "supplierId", "isPrimary", "available_colors", "createdAt", "updatedAt"
)
SELECT
  'mso_' || substr(md5(random()::text || m."id"), 1, 20),
  m."id",
  s."id",
  true,
  m."available_colors",
  NOW(),
  NOW()
FROM "materials" m
JOIN "suppliers" s
  ON lower(s."nameUk") = lower(COALESCE(NULLIF(trim(m."supplierCode"), ''), 'Каталог'))
WHERE cardinality(m."available_colors") > 0
  AND NOT EXISTS (SELECT 1 FROM "material_suppliers" ms WHERE ms."materialId" = m."id");
