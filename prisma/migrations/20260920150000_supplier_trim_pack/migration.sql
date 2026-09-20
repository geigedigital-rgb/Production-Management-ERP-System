-- Per-supplier trim pack price + pack delivery (material keeps unitsPerPack).
ALTER TABLE "material_suppliers" ADD COLUMN IF NOT EXISTS "purchase_pack_price" DECIMAL(14,4);
ALTER TABLE "material_suppliers" ADD COLUMN IF NOT EXISTS "pack_delivery_cost_uah" DECIMAL(14,4);

-- Backfill from material-level pack fields onto primary offers.
UPDATE "material_suppliers" ms
SET
  "purchase_pack_price" = m."purchase_pack_price",
  "pack_delivery_cost_uah" = m."pack_delivery_cost_uah"
FROM "materials" m
WHERE m."id" = ms."materialId"
  AND ms."isPrimary" = true
  AND m."type" <> 'FABRIC'
  AND m."purchase_pack_price" IS NOT NULL
  AND ms."purchase_pack_price" IS NULL;
