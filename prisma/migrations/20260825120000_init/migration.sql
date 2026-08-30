-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMINISTRATOR', 'MANAGER');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('FABRIC', 'OTHER_MATERIAL', 'TRIM');

-- CreateEnum
CREATE TYPE "OperationCalcMethod" AS ENUM ('UNIT_RATE', 'SHIFT_OUTPUT', 'QUANTITY_TIER');

-- CreateEnum
CREATE TYPE "PricingMethod" AS ENUM ('MARGIN', 'MARKUP');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CALCULATION', 'PENDING_APPROVAL', 'APPROVED', 'HANDED_TO_PRODUCTION', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "login" TEXT,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MANAGER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameUk" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "nameUk" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sizes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameUk" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "nameUk" TEXT NOT NULL,
    "type" "MaterialType" NOT NULL,
    "categoryId" TEXT,
    "unitOfMeasureId" TEXT NOT NULL,
    "purchasePrice" DECIMAL(14,4) NOT NULL,
    "defaultWastePercent" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "supplierCode" TEXT,
    "colorOrAttribute" TEXT,
    "priceEffectiveDate" TIMESTAMP(3),
    "note" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations" (
    "id" TEXT NOT NULL,
    "nameUk" TEXT NOT NULL,
    "categoryId" TEXT,
    "calculationMethod" "OperationCalcMethod" NOT NULL DEFAULT 'UNIT_RATE',
    "baseRate" DECIMAL(14,4),
    "shiftCost" DECIMAL(14,4),
    "standardOutputPerShift" DECIMAL(14,4),
    "note" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decoration_methods" (
    "id" TEXT NOT NULL,
    "nameUk" TEXT NOT NULL,
    "calculationUnit" TEXT NOT NULL,
    "setupCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "unitRate" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "note" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decoration_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decoration_quantity_tiers" (
    "id" TEXT NOT NULL,
    "decorationMethodId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "maxQuantity" INTEGER,
    "unitRate" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "decoration_quantity_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "nameUk" TEXT NOT NULL,
    "internalCode" TEXT,
    "categoryId" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_sizes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,

    CONSTRAINT "product_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_materials" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "consumptionPerUnit" DECIMAL(14,6) NOT NULL,
    "wastePercent" DECIMAL(8,4),
    "note" TEXT,

    CONSTRAINT "product_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_operations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "rateOverride" DECIMAL(14,4),
    "standardOverride" DECIMAL(14,4),
    "note" TEXT,

    CONSTRAINT "product_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_decorations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "decorationMethodId" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "product_decorations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_additional_costs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "nameUk" TEXT NOT NULL,
    "amount" DECIMAL(14,4) NOT NULL,
    "isPerUnit" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_additional_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "legalDetails" TEXT,
    "note" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "title" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedDate" TIMESTAMP(3),
    "approvedDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "nameUk" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "sourceProductId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_sizes" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "sizeCode" TEXT NOT NULL,
    "sizeNameUk" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "order_item_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_materials" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "materialId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "unitCodeSnapshot" TEXT NOT NULL,
    "consumptionPerUnit" DECIMAL(14,6) NOT NULL,
    "wastePercent" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "purchasePrice" DECIMAL(14,4) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_item_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_operations" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "operationId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "calculationMethod" "OperationCalcMethod" NOT NULL,
    "unitRate" DECIMAL(14,4),
    "shiftCost" DECIMAL(14,4),
    "standardOutput" DECIMAL(14,4),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_item_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_decorations" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "decorationMethodId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "setupCost" DECIMAL(14,4) NOT NULL,
    "unitRate" DECIMAL(14,4) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_item_decorations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_additional_costs" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "nameUk" TEXT NOT NULL,
    "amount" DECIMAL(14,4) NOT NULL,
    "isPerUnit" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "order_item_additional_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_versions" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT,
    "comment" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "snapshotJson" JSONB NOT NULL,
    "costPerUnit" DECIMAL(14,4) NOT NULL,
    "totalCost" DECIMAL(14,4) NOT NULL,
    "sellingPricePerUnit" DECIMAL(14,4) NOT NULL,
    "totalSellingValue" DECIMAL(14,4) NOT NULL,
    "profitAmount" DECIMAL(14,4) NOT NULL,
    "marginPercent" DECIMAL(8,4) NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "calculationVersionId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_specifications" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "calculationVersionId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotJson" JSONB NOT NULL,

    CONSTRAINT "production_specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_settings" (
    "id" TEXT NOT NULL,
    "pricingMethod" "PricingMethod" NOT NULL DEFAULT 'MARGIN',
    "targetMarginPercent" DECIMAL(8,4) NOT NULL,
    "minimumMarginPercent" DECIMAL(8,4) NOT NULL,
    "managerMaxDiscountPercent" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "roundingRule" TEXT NOT NULL DEFAULT 'ROUND_2',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quantity_tier_rules" (
    "id" TEXT NOT NULL,
    "nameUk" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeRefId" TEXT,
    "minQuantity" INTEGER NOT NULL,
    "maxQuantity" INTEGER,
    "coefficient" DECIMAL(10,6) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "quantity_tier_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "size_rules" (
    "id" TEXT NOT NULL,
    "sizeCode" TEXT NOT NULL,
    "materialCoeff" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "operationCoeff" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "surchargePercent" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "appliesTo" TEXT NOT NULL DEFAULT 'SELECTED',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "size_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "taxId" TEXT,
    "logoUrl" TEXT,
    "quotationFooter" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "clientId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_code_key" ON "units_of_measure"("code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_kind_nameUk_key" ON "categories"("kind", "nameUk");

-- CreateIndex
CREATE UNIQUE INDEX "sizes_code_key" ON "sizes"("code");

-- CreateIndex
CREATE INDEX "materials_nameUk_idx" ON "materials"("nameUk");

-- CreateIndex
CREATE INDEX "materials_status_idx" ON "materials"("status");

-- CreateIndex
CREATE INDEX "operations_nameUk_idx" ON "operations"("nameUk");

-- CreateIndex
CREATE INDEX "decoration_methods_nameUk_idx" ON "decoration_methods"("nameUk");

-- CreateIndex
CREATE INDEX "decoration_quantity_tiers_decorationMethodId_idx" ON "decoration_quantity_tiers"("decorationMethodId");

-- CreateIndex
CREATE UNIQUE INDEX "products_internalCode_key" ON "products"("internalCode");

-- CreateIndex
CREATE INDEX "products_nameUk_idx" ON "products"("nameUk");

-- CreateIndex
CREATE UNIQUE INDEX "product_sizes_productId_sizeId_key" ON "product_sizes"("productId", "sizeId");

-- CreateIndex
CREATE INDEX "product_materials_productId_idx" ON "product_materials"("productId");

-- CreateIndex
CREATE INDEX "product_operations_productId_idx" ON "product_operations"("productId");

-- CreateIndex
CREATE INDEX "product_decorations_productId_idx" ON "product_decorations"("productId");

-- CreateIndex
CREATE INDEX "clients_companyName_idx" ON "clients"("companyName");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_deadline_idx" ON "orders"("deadline");

-- CreateIndex
CREATE INDEX "orders_clientId_idx" ON "orders"("clientId");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "calculation_versions_orderItemId_versionNumber_key" ON "calculation_versions"("orderItemId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_calculationVersionId_key" ON "quotations"("calculationVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_number_key" ON "quotations"("number");

-- CreateIndex
CREATE UNIQUE INDEX "production_specifications_orderItemId_key" ON "production_specifications"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "production_specifications_calculationVersionId_key" ON "production_specifications"("calculationVersionId");

-- CreateIndex
CREATE INDEX "activity_events_entityType_entityId_idx" ON "activity_events"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decoration_quantity_tiers" ADD CONSTRAINT "decoration_quantity_tiers_decorationMethodId_fkey" FOREIGN KEY ("decorationMethodId") REFERENCES "decoration_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_materials" ADD CONSTRAINT "product_materials_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_materials" ADD CONSTRAINT "product_materials_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_operations" ADD CONSTRAINT "product_operations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_operations" ADD CONSTRAINT "product_operations_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_decorations" ADD CONSTRAINT "product_decorations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_decorations" ADD CONSTRAINT "product_decorations_decorationMethodId_fkey" FOREIGN KEY ("decorationMethodId") REFERENCES "decoration_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_additional_costs" ADD CONSTRAINT "product_additional_costs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_sizes" ADD CONSTRAINT "order_item_sizes_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_materials" ADD CONSTRAINT "order_item_materials_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_materials" ADD CONSTRAINT "order_item_materials_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_operations" ADD CONSTRAINT "order_item_operations_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_operations" ADD CONSTRAINT "order_item_operations_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_decorations" ADD CONSTRAINT "order_item_decorations_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_decorations" ADD CONSTRAINT "order_item_decorations_decorationMethodId_fkey" FOREIGN KEY ("decorationMethodId") REFERENCES "decoration_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_additional_costs" ADD CONSTRAINT "order_item_additional_costs_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_versions" ADD CONSTRAINT "calculation_versions_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_versions" ADD CONSTRAINT "calculation_versions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_calculationVersionId_fkey" FOREIGN KEY ("calculationVersionId") REFERENCES "calculation_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_specifications" ADD CONSTRAINT "production_specifications_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_specifications" ADD CONSTRAINT "production_specifications_calculationVersionId_fkey" FOREIGN KEY ("calculationVersionId") REFERENCES "calculation_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
