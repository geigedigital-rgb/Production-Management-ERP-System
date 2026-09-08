-- Prisma expects camelCase "colorSnapshot"; an earlier revision used color_snapshot.
ALTER TABLE "order_item_materials" ADD COLUMN IF NOT EXISTS "colorSnapshot" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_item_materials'
      AND column_name = 'color_snapshot'
  ) THEN
    UPDATE "order_item_materials"
    SET "colorSnapshot" = "color_snapshot"
    WHERE "colorSnapshot" IS NULL AND "color_snapshot" IS NOT NULL;

    ALTER TABLE "order_item_materials" DROP COLUMN "color_snapshot";
  END IF;
END $$;
