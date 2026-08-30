-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "fabricDeliveryAmount" DECIMAL(14,4) NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN "fabricDeliveryComputed" DECIMAL(14,4);
ALTER TABLE "order_items" ADD COLUMN "fabricDeliveryManual" BOOLEAN NOT NULL DEFAULT false;
