-- Add 5XL / 6XL sizes; move oversize uplift from XXL to 3XL+ only.

INSERT INTO "sizes" ("id", "code", "nameUk", "sortOrder", "status", "createdAt", "updatedAt")
VALUES
  ('size_5xl', '5XL', '5XL', 9, 'ACTIVE', NOW(), NOW()),
  ('size_6xl', '6XL', '6XL', 10, 'ACTIVE', NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
  "nameUk" = EXCLUDED."nameUk",
  "sortOrder" = EXCLUDED."sortOrder",
  "status" = 'ACTIVE',
  "updatedAt" = NOW();

DELETE FROM "size_rules" WHERE "sizeCode" IN ('XXL', '3XL', '4XL', '5XL', '6XL');

INSERT INTO "size_rules" ("id", "sizeCode", "materialCoeff", "operationCoeff", "surchargePercent", "appliesTo", "status")
VALUES
  ('sizerule_3xl_oversize', '3XL', 1.15, 1.20, 0, 'SELECTED', 'ACTIVE'),
  ('sizerule_4xl_oversize', '4XL', 1.15, 1.20, 0, 'SELECTED', 'ACTIVE'),
  ('sizerule_5xl_oversize', '5XL', 1.15, 1.20, 0, 'SELECTED', 'ACTIVE'),
  ('sizerule_6xl_oversize', '6XL', 1.15, 1.20, 0, 'SELECTED', 'ACTIVE');
