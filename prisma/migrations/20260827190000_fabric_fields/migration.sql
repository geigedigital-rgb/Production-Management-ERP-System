-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MaterialCostVatMode" AS ENUM ('NET', 'GROSS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable pricing_settings
ALTER TABLE "pricing_settings" ADD COLUMN IF NOT EXISTS "usdUahRate" DECIMAL(14,4) NOT NULL DEFAULT 45;
ALTER TABLE "pricing_settings" ADD COLUMN IF NOT EXISTS "fabricCargoUsdPerKg" DECIMAL(14,4) NOT NULL DEFAULT 1.7;
ALTER TABLE "pricing_settings" ADD COLUMN IF NOT EXISTS "inputVatRatePercent" DECIMAL(8,4) NOT NULL DEFAULT 20;
ALTER TABLE "pricing_settings" ADD COLUMN IF NOT EXISTS "materialCostVatMode" "MaterialCostVatMode" NOT NULL DEFAULT 'NET';

-- AlterTable materials
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "densityGsm" TEXT;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "composition" TEXT;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "metersPerKg" DECIMAL(14,4);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "priceKgUsd" DECIMAL(14,4);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "priceKgUsdCargo" DECIMAL(14,4);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "priceKgUsdVat" DECIMAL(14,4);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "priceMeterUahNoVat" DECIMAL(14,4);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "priceMeterUahVat" DECIMAL(14,4);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "priceMeterUahCutVat" DECIMAL(14,4);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "isPrimarySupplier" BOOLEAN;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "widthCm" TEXT;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "wholesaleNote" TEXT;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "rollWeightKg" DECIMAL(14,4);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "metersPerRoll" DECIMAL(14,4);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "costVatOverride" "MaterialCostVatMode";

CREATE INDEX IF NOT EXISTS "materials_composition_idx" ON "materials"("composition");
