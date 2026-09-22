-- Persist chosen delivery method on product BOM lines (with supplier).

ALTER TABLE "product_materials" ADD COLUMN IF NOT EXISTS "delivery_type" "FabricDeliveryType";
