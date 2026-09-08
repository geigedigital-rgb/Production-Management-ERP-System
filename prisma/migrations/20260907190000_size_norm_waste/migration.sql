-- Per-size waste override on product material norms (null = use shared ProductMaterial.wastePercent).

ALTER TABLE "product_material_size_norms"
  ADD COLUMN IF NOT EXISTS "wastePercent" DECIMAL(8,4);
