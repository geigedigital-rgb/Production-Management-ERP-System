-- Per-supplier delivery type + optional NP rates (only filled rates appear on orders).
ALTER TABLE "material_suppliers" ADD COLUMN IF NOT EXISTS "delivery_type" "FabricDeliveryType" NOT NULL DEFAULT 'CARGO';
ALTER TABLE "material_suppliers" ADD COLUMN IF NOT EXISTS "np_standard_usd_per_kg" DECIMAL(14,4);
ALTER TABLE "material_suppliers" ADD COLUMN IF NOT EXISTS "np_volume_usd_per_kg" DECIMAL(14,4);

-- Backfill: copy material delivery type; seed active rate column from cargoUsdPerKg when present.
UPDATE "material_suppliers" ms
SET "delivery_type" = m."deliveryType"
FROM "materials" m
WHERE m."id" = ms."materialId";

UPDATE "material_suppliers" ms
SET "np_standard_usd_per_kg" = ms."cargoUsdPerKg"
WHERE ms."delivery_type" = 'NP_STANDARD'
  AND ms."cargoUsdPerKg" IS NOT NULL
  AND ms."np_standard_usd_per_kg" IS NULL;

UPDATE "material_suppliers" ms
SET "np_volume_usd_per_kg" = ms."cargoUsdPerKg"
WHERE ms."delivery_type" = 'NP_VOLUME'
  AND ms."cargoUsdPerKg" IS NOT NULL
  AND ms."np_volume_usd_per_kg" IS NULL;

ALTER TABLE "order_item_materials" ADD COLUMN IF NOT EXISTS "delivery_type" "FabricDeliveryType";
