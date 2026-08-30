-- Per-order USD/UAH rate override on fabric material line (delivery calc).
ALTER TABLE "order_item_materials" ADD COLUMN "usdUahRate" DECIMAL(14,4);
