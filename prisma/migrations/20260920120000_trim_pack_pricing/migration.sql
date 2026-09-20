-- Trim / hardware: pack quote → per-piece purchasePrice.
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "units_per_pack" INTEGER;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "purchase_pack_price" DECIMAL(14,4);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "pack_delivery_cost_uah" DECIMAL(14,4);
