-- AlterTable
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "reference_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
