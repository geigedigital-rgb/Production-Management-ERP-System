-- Revert NP volume tariffs from ₴/м³ back to $/кг (undo 20260922120000 conversion).
-- Converted values were rate * usdUahRate * 150; values ≥ 50 are treated as converted.
UPDATE "pricing_settings"
SET "npVolumeUsdPerKg" = ROUND(("npVolumeUsdPerKg" / NULLIF("usdUahRate", 0) / 150)::numeric, 4)
WHERE "npVolumeUsdPerKg" >= 50;

UPDATE "material_suppliers" ms
SET "np_volume_usd_per_kg" = ROUND(
  (ms."np_volume_usd_per_kg" / NULLIF(COALESCE(ps."usdUahRate", 45), 0) / 150)::numeric,
  4
)
FROM "pricing_settings" ps, "materials" m
WHERE ms."materialId" = m."id"
  AND m."type" = 'FABRIC'
  AND ms."np_volume_usd_per_kg" IS NOT NULL
  AND ms."np_volume_usd_per_kg" >= 50;

ALTER TABLE "pricing_settings"
  ALTER COLUMN "npVolumeUsdPerKg" SET DEFAULT 0.8;
