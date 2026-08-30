-- AlterTable
ALTER TABLE "order_item_materials" ADD COLUMN "sizeCode" TEXT;

-- AlterTable
ALTER TABLE "order_item_operations" ADD COLUMN "sizeCode" TEXT;

-- CreateIndex
CREATE INDEX "order_item_materials_orderItemId_sizeCode_idx" ON "order_item_materials"("orderItemId", "sizeCode");

-- CreateIndex
CREATE INDEX "order_item_operations_orderItemId_sizeCode_idx" ON "order_item_operations"("orderItemId", "sizeCode");

-- CreateTable
CREATE TABLE "product_material_size_norms" (
    "id" TEXT NOT NULL,
    "productMaterialId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "consumptionPerUnit" DECIMAL(14,6) NOT NULL,

    CONSTRAINT "product_material_size_norms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_material_size_scopes" (
    "id" TEXT NOT NULL,
    "productMaterialId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,

    CONSTRAINT "product_material_size_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_operation_size_scopes" (
    "id" TEXT NOT NULL,
    "productOperationId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,

    CONSTRAINT "product_operation_size_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_material_size_norms_productMaterialId_sizeId_key" ON "product_material_size_norms"("productMaterialId", "sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "product_material_size_scopes_productMaterialId_sizeId_key" ON "product_material_size_scopes"("productMaterialId", "sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "product_operation_size_scopes_productOperationId_sizeId_key" ON "product_operation_size_scopes"("productOperationId", "sizeId");

-- AddForeignKey
ALTER TABLE "product_material_size_norms" ADD CONSTRAINT "product_material_size_norms_productMaterialId_fkey" FOREIGN KEY ("productMaterialId") REFERENCES "product_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_material_size_norms" ADD CONSTRAINT "product_material_size_norms_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_material_size_scopes" ADD CONSTRAINT "product_material_size_scopes_productMaterialId_fkey" FOREIGN KEY ("productMaterialId") REFERENCES "product_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_material_size_scopes" ADD CONSTRAINT "product_material_size_scopes_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_operation_size_scopes" ADD CONSTRAINT "product_operation_size_scopes_productOperationId_fkey" FOREIGN KEY ("productOperationId") REFERENCES "product_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_operation_size_scopes" ADD CONSTRAINT "product_operation_size_scopes_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON UPDATE CASCADE;
