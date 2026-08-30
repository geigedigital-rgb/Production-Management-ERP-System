-- Commercial price list tiers (comment 2): fixed client price by quantity ladder.

ALTER TABLE "products" ADD COLUMN "is_base_model" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "product_commercial_price_tiers" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "pricePerUnit" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "product_commercial_price_tiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_commercial_price_tiers_productId_minQuantity_key" ON "product_commercial_price_tiers"("productId", "minQuantity");
CREATE INDEX "product_commercial_price_tiers_productId_idx" ON "product_commercial_price_tiers"("productId");

ALTER TABLE "product_commercial_price_tiers" ADD CONSTRAINT "product_commercial_price_tiers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
