-- Upsert oversized sizes and size coeff rules (+15% materials, +20% operations).

INSERT INTO "sizes" ("id", "code", "nameUk", "sortOrder", "status", "createdAt", "updatedAt")
VALUES
  ('size_3xl_oversize', '3XL', '3XL', 7, 'ACTIVE', NOW(), NOW()),
  ('size_4xl_oversize', '4XL', '4XL', 8, 'ACTIVE', NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
  "nameUk" = EXCLUDED."nameUk",
  "sortOrder" = EXCLUDED."sortOrder",
  "status" = 'ACTIVE',
  "updatedAt" = NOW();

UPDATE "sizes"
SET "sortOrder" = 6, "nameUk" = 'XXL', "status" = 'ACTIVE', "updatedAt" = NOW()
WHERE "code" = 'XXL';

DELETE FROM "size_rules" WHERE "sizeCode" IN ('XXL', '3XL', '4XL');

INSERT INTO "size_rules" ("id", "sizeCode", "materialCoeff", "operationCoeff", "surchargePercent", "appliesTo", "status")
VALUES
  ('sizerule_xxl_oversize', 'XXL', 1.15, 1.20, 0, 'SELECTED', 'ACTIVE'),
  ('sizerule_3xl_oversize', '3XL', 1.15, 1.20, 0, 'SELECTED', 'ACTIVE'),
  ('sizerule_4xl_oversize', '4XL', 1.15, 1.20, 0, 'SELECTED', 'ACTIVE');
