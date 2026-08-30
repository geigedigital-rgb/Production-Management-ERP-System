-- AlterTable: replace main/spare flag with CRM fabric kind
ALTER TABLE "materials" DROP COLUMN IF EXISTS "isPrimarySupplier";
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "fabricKindUk" TEXT;

CREATE INDEX IF NOT EXISTS "materials_fabricKindUk_idx" ON "materials"("fabricKindUk");
