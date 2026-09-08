-- AlterTable
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "available_colors" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "order_item_materials" ADD COLUMN IF NOT EXISTS "colorSnapshot" TEXT;
