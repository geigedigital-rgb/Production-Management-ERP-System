-- Persist × sewing markup per commercial tirage row.
ALTER TABLE "product_commercial_price_tiers"
ADD COLUMN IF NOT EXISTS "sewing_multiplier" DECIMAL(8,4);
