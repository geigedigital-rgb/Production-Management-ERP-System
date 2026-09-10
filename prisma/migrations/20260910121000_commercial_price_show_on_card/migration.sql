-- Base price tiers for product cards + already includes sizes migration sibling.

ALTER TABLE "product_commercial_price_tiers"
ADD COLUMN IF NOT EXISTS "show_on_card" BOOLEAN NOT NULL DEFAULT false;
