-- AlterTable
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "minWholesaleMeters" DECIMAL(14,4);

-- AlterTable
ALTER TABLE "order_item_materials" ADD COLUMN IF NOT EXISTS "actualPurchasePrice" DECIMAL(14,4);

-- CreateTable
CREATE TABLE IF NOT EXISTS "suppliers" (
    "id" TEXT NOT NULL,
    "nameUk" TEXT NOT NULL,
    "defaultCargoUsdPerKg" DECIMAL(14,4),
    "note" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "material_suppliers" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "metersPerKg" DECIMAL(14,4),
    "cargoUsdPerKg" DECIMAL(14,4),
    "priceKgUsd" DECIMAL(14,4),
    "priceKgUsdCargo" DECIMAL(14,4),
    "priceKgUsdVat" DECIMAL(14,4),
    "priceMeterUahNoVat" DECIMAL(14,4),
    "priceMeterUahVat" DECIMAL(14,4),
    "priceMeterUahCutVat" DECIMAL(14,4),
    "rollWeightKg" DECIMAL(14,4),
    "metersPerRoll" DECIMAL(14,4),
    "minWholesaleMeters" DECIMAL(14,4),
    "wholesaleNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_nameUk_key" ON "suppliers"("nameUk");
CREATE INDEX IF NOT EXISTS "suppliers_status_idx" ON "suppliers"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "material_suppliers_materialId_supplierId_key" ON "material_suppliers"("materialId", "supplierId");
CREATE INDEX IF NOT EXISTS "material_suppliers_supplierId_idx" ON "material_suppliers"("supplierId");
CREATE INDEX IF NOT EXISTS "material_suppliers_materialId_isPrimary_idx" ON "material_suppliers"("materialId", "isPrimary");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "material_suppliers" ADD CONSTRAINT "material_suppliers_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "material_suppliers" ADD CONSTRAINT "material_suppliers_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
