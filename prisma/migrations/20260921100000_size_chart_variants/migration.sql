-- Size chart variants + sizes belong to a variant; products pick a variant first.

CREATE TABLE IF NOT EXISTS "size_chart_variants" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "nameUk" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "size_chart_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "size_chart_variants_code_key" ON "size_chart_variants"("code");

INSERT INTO "size_chart_variants" ("id", "code", "nameUk", "description", "sortOrder", "status", "createdAt", "updatedAt")
VALUES
  ('scv_intl_unisex', 'INTL_UNISEX', 'Міжнародна унісекс', 'Міжнародні літерні розміри (2XS–5XL)', 1, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('scv_ua_chest', 'UA_CHEST_HALF', 'Українська 1/2 обхв. грудей', 'Числові розміри за 1/2 обхвату грудей', 2, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('scv_kids_height', 'KIDS_HEIGHT', 'Дитяча · зріст', 'Дитячі розміри за зростом, см', 3, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('scv_intl_men_ua', 'INTL_MEN_UA', 'Міжнар / Чол. укр.', 'Міжнародний розмір ↔ чоловічий український діапазон', 4, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('scv_intl_women_ua', 'INTL_WOMEN_UA', 'Міжнар / Жін. укр.', 'Міжнародний розмір ↔ жіночий український діапазон', 5, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "nameUk" = EXCLUDED."nameUk",
  "description" = EXCLUDED."description",
  "sortOrder" = EXCLUDED."sortOrder",
  "status" = 'ACTIVE',
  "updatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "sizes" ADD COLUMN IF NOT EXISTS "variantId" TEXT;
ALTER TABLE "sizes" ADD COLUMN IF NOT EXISTS "descriptionUk" TEXT;

UPDATE "sizes"
SET "variantId" = (SELECT "id" FROM "size_chart_variants" WHERE "code" = 'INTL_UNISEX' LIMIT 1)
WHERE "variantId" IS NULL;

-- Drop global unique on code BEFORE inserting overlapping codes per variant
ALTER TABLE "sizes" DROP CONSTRAINT IF EXISTS "sizes_code_key";
DROP INDEX IF EXISTS "sizes_code_key";

INSERT INTO "sizes" ("id", "code", "nameUk", "sortOrder", "status", "variantId", "createdAt", "updatedAt")
SELECT
  'size_intl_2xs',
  '2XS',
  '2XS',
  0,
  'ACTIVE',
  v."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "size_chart_variants" v
WHERE v."code" = 'INTL_UNISEX'
  AND NOT EXISTS (
    SELECT 1 FROM "sizes" s WHERE s."variantId" = v."id" AND s."code" = '2XS'
  );

UPDATE "sizes" s
SET "nameUk" = '2XL', "updatedAt" = CURRENT_TIMESTAMP
FROM "size_chart_variants" v
WHERE s."variantId" = v."id"
  AND v."code" = 'INTL_UNISEX'
  AND s."code" = 'XXL';

INSERT INTO "sizes" ("id", "code", "nameUk", "sortOrder", "status", "variantId", "createdAt", "updatedAt")
SELECT
  'size_ua_' || n::text,
  n::text,
  n::text,
  (n - 36) / 2 + 1,
  'ACTIVE',
  v."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "size_chart_variants" v
CROSS JOIN generate_series(36, 70, 2) AS n
WHERE v."code" = 'UA_CHEST_HALF'
  AND NOT EXISTS (
    SELECT 1 FROM "sizes" s WHERE s."variantId" = v."id" AND s."code" = n::text
  );

INSERT INTO "sizes" ("id", "code", "nameUk", "sortOrder", "status", "variantId", "createdAt", "updatedAt")
SELECT
  'size_kids_' || n::text,
  n::text,
  n::text,
  (n - 110) / 6 + 1,
  'ACTIVE',
  v."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "size_chart_variants" v
CROSS JOIN generate_series(110, 164, 6) AS n
WHERE v."code" = 'KIDS_HEIGHT'
  AND NOT EXISTS (
    SELECT 1 FROM "sizes" s WHERE s."variantId" = v."id" AND s."code" = n::text
  );

INSERT INTO "sizes" ("id", "code", "nameUk", "sortOrder", "status", "variantId", "createdAt", "updatedAt")
SELECT x.id, x.code, x.nameUk, x.sortOrder, 'ACTIVE', v."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "size_chart_variants" v
CROSS JOIN (
  VALUES
    ('size_men_2xs', '2XS', '2XS · 38', 1),
    ('size_men_xs', 'XS', 'XS · 40', 2),
    ('size_men_s', 'S', 'S · 42–44', 3),
    ('size_men_m', 'M', 'M · 46–48', 4),
    ('size_men_l', 'L', 'L · 50–52', 5),
    ('size_men_xl', 'XL', 'XL · 54–56', 6),
    ('size_men_2xl', '2XL', '2XL · 58–60', 7),
    ('size_men_3xl', '3XL', '3XL · 62–64', 8),
    ('size_men_4xl', '4XL', '4XL · 66–68', 9),
    ('size_men_5xl', '5XL', '5XL · 70–72', 10)
) AS x(id, code, nameUk, sortOrder)
WHERE v."code" = 'INTL_MEN_UA'
  AND NOT EXISTS (
    SELECT 1 FROM "sizes" s WHERE s."variantId" = v."id" AND s."code" = x.code
  );

INSERT INTO "sizes" ("id", "code", "nameUk", "sortOrder", "status", "variantId", "createdAt", "updatedAt")
SELECT x.id, x.code, x.nameUk, x.sortOrder, 'ACTIVE', v."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "size_chart_variants" v
CROSS JOIN (
  VALUES
    ('size_women_2xs', '2XS', '2XS · 36', 1),
    ('size_women_xs', 'XS', 'XS · 38', 2),
    ('size_women_s', 'S', 'S · 40–42', 3),
    ('size_women_m', 'M', 'M · 44–46', 4),
    ('size_women_l', 'L', 'L · 48–50', 5),
    ('size_women_xl', 'XL', 'XL · 52–54', 6),
    ('size_women_2xl', '2XL', '2XL · 56–58', 7),
    ('size_women_3xl', '3XL', '3XL · 60–62', 8),
    ('size_women_4xl', '4XL', '4XL · 64–66', 9),
    ('size_women_5xl', '5XL', '5XL · 68–70', 10)
) AS x(id, code, nameUk, sortOrder)
WHERE v."code" = 'INTL_WOMEN_UA'
  AND NOT EXISTS (
    SELECT 1 FROM "sizes" s WHERE s."variantId" = v."id" AND s."code" = x.code
  );

ALTER TABLE "sizes" ALTER COLUMN "variantId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sizes_variantId_fkey'
  ) THEN
    ALTER TABLE "sizes"
      ADD CONSTRAINT "sizes_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "size_chart_variants"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "sizes_variantId_code_key" ON "sizes"("variantId", "code");
CREATE INDEX IF NOT EXISTS "sizes_variantId_idx" ON "sizes"("variantId");

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "size_chart_variant_id" TEXT;

UPDATE "products" p
SET "size_chart_variant_id" = sub."variantId"
FROM (
  SELECT ps."productId", MIN(s."variantId") AS "variantId"
  FROM "product_sizes" ps
  JOIN "sizes" s ON s."id" = ps."sizeId"
  GROUP BY ps."productId"
) AS sub
WHERE p."id" = sub."productId"
  AND p."size_chart_variant_id" IS NULL;

UPDATE "products"
SET "size_chart_variant_id" = (SELECT "id" FROM "size_chart_variants" WHERE "code" = 'INTL_UNISEX' LIMIT 1)
WHERE "size_chart_variant_id" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_size_chart_variant_id_fkey'
  ) THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_size_chart_variant_id_fkey"
      FOREIGN KEY ("size_chart_variant_id") REFERENCES "size_chart_variants"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "products_size_chart_variant_id_idx" ON "products"("size_chart_variant_id");
