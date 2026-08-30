-- Per-order material terms: supplier choice and line-level delivery overrides.
ALTER TABLE "order_item_materials" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "order_item_materials" ADD COLUMN "supplierNameSnapshot" TEXT;
ALTER TABLE "order_item_materials" ADD COLUMN "cargoUsdPerKg" DECIMAL(14,4);
ALTER TABLE "order_item_materials" ADD COLUMN "fabricDeliveryAmount" DECIMAL(14,4) NOT NULL DEFAULT 0;
ALTER TABLE "order_item_materials" ADD COLUMN "fabricDeliveryComputed" DECIMAL(14,4);
ALTER TABLE "order_item_materials" ADD COLUMN "fabricDeliveryManual" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "order_item_materials"
  ADD CONSTRAINT "order_item_materials_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "order_item_materials_supplierId_idx" ON "order_item_materials"("supplierId");
