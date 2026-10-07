-- Link order attachments to a specific order line (product) for artwork.
ALTER TABLE "file_assets" ADD COLUMN IF NOT EXISTS "orderItemId" TEXT;

CREATE INDEX IF NOT EXISTS "file_assets_orderId_idx" ON "file_assets"("orderId");
CREATE INDEX IF NOT EXISTS "file_assets_orderItemId_idx" ON "file_assets"("orderItemId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'file_assets_orderItemId_fkey'
  ) THEN
    ALTER TABLE "file_assets"
      ADD CONSTRAINT "file_assets_orderItemId_fkey"
      FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
