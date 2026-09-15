-- Fabric delivery type presets + editable NP rates on company pricing settings.

CREATE TYPE "FabricDeliveryType" AS ENUM ('CARGO', 'NP_STANDARD', 'NP_VOLUME');

ALTER TABLE "materials"
ADD COLUMN IF NOT EXISTS "deliveryType" "FabricDeliveryType" NOT NULL DEFAULT 'CARGO';

ALTER TABLE "pricing_settings"
ADD COLUMN IF NOT EXISTS "npStandardUsdPerKg" DECIMAL(14,4) NOT NULL DEFAULT 0.4;

ALTER TABLE "pricing_settings"
ADD COLUMN IF NOT EXISTS "npVolumeUsdPerKg" DECIMAL(14,4) NOT NULL DEFAULT 0.8;
