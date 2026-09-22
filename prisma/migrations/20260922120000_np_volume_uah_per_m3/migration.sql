-- NP volume tariff for fabric is ₴/м³ (not $/kg). Convert legacy dollar-like rates (< 50)
-- only on fabric supplier offers + company settings. Trim ₴/уп. rates stay as-is.
UPDATE "pricing_settings"
SET "npVolumeUsdPerKg" = ROUND(("npVolumeUsdPerKg" * "usdUahRate" * 150)::numeric, 2)
WHERE "npVolumeUsdPerKg" > 0 AND "npVolumeUsdPerKg" < 50;

UPDATE "material_suppliers" ms
SET "np_volume_usd_per_kg" = ROUND(
  (ms."np_volume_usd_per_kg" * COALESCE(ps."usdUahRate", 45) * 150)::numeric,
  2
)
FROM "pricing_settings" ps, "materials" m
WHERE ms."materialId" = m."id"
  AND m."type" = 'FABRIC'
  AND ms."np_volume_usd_per_kg" IS NOT NULL
  AND ms."np_volume_usd_per_kg" > 0
  AND ms."np_volume_usd_per_kg" < 50;

ALTER TABLE "pricing_settings"
  ALTER COLUMN "npVolumeUsdPerKg" SET DEFAULT 2500;
