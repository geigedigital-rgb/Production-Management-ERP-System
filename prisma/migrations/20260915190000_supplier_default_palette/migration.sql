-- Persist supplier color palettes so new materials can reuse them.
ALTER TABLE "suppliers"
  ADD COLUMN IF NOT EXISTS "default_available_colors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill from the most recently updated offer that has colors.
UPDATE "suppliers" AS s
SET "default_available_colors" = sub."available_colors"
FROM (
  SELECT DISTINCT ON ("supplierId")
    "supplierId",
    "available_colors"
  FROM "material_suppliers"
  WHERE cardinality("available_colors") > 0
  ORDER BY "supplierId", "updatedAt" DESC
) AS sub
WHERE s."id" = sub."supplierId"
  AND cardinality(s."default_available_colors") = 0;
