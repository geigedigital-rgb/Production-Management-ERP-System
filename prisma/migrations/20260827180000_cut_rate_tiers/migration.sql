-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "optimalQty" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "product_cut_rate_tiers" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "ratePerUnit" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "product_cut_rate_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_cut_rate_tiers_productId_idx" ON "product_cut_rate_tiers"("productId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "product_cut_rate_tiers_productId_minQuantity_key" ON "product_cut_rate_tiers"("productId", "minQuantity");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "product_cut_rate_tiers"
    ADD CONSTRAINT "product_cut_rate_tiers_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
