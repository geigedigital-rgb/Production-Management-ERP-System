-- Operation quantity-tier rates (catalog defaults) and product overrides.
CREATE TABLE "operation_rate_tiers" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "ratePerUnit" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "operation_rate_tiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operation_rate_tiers_operationId_minQuantity_key" ON "operation_rate_tiers"("operationId", "minQuantity");
CREATE INDEX "operation_rate_tiers_operationId_idx" ON "operation_rate_tiers"("operationId");

ALTER TABLE "operation_rate_tiers" ADD CONSTRAINT "operation_rate_tiers_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "product_operation_rate_tiers" (
    "id" TEXT NOT NULL,
    "productOperationId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "ratePerUnit" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "product_operation_rate_tiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_operation_rate_tiers_productOperationId_minQuantity_key" ON "product_operation_rate_tiers"("productOperationId", "minQuantity");
CREATE INDEX "product_operation_rate_tiers_productOperationId_idx" ON "product_operation_rate_tiers"("productOperationId");

ALTER TABLE "product_operation_rate_tiers" ADD CONSTRAINT "product_operation_rate_tiers_productOperationId_fkey" FOREIGN KEY ("productOperationId") REFERENCES "product_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
