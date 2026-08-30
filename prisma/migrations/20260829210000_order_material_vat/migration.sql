-- Per-order purchase VAT mode override on material line.
ALTER TABLE "order_item_materials" ADD COLUMN "costVatOverride" "MaterialCostVatMode";
