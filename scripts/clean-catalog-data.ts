/**
 * Wipe catalog + orders + suppliers; keep company, users, pricing, units, sizes,
 * operations and decorations.
 *
 * Usage: npx tsx scripts/clean-catalog-data.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const { prisma } = await import("../src/server/db/client");

  const before = {
    company: await prisma.companySettings.count(),
    users: await prisma.user.count(),
    clients: await prisma.client.count(),
    orders: await prisma.order.count(),
    products: await prisma.product.count(),
    materials: await prisma.material.count(),
    suppliers: await prisma.supplier.count(),
    materialOffers: await prisma.materialSupplier.count(),
    operations: await prisma.operation.count(),
    decorations: await prisma.decorationMethod.count(),
    files: await prisma.fileAsset.count(),
    activity: await prisma.activityEvent.count(),
  };
  const company = await prisma.companySettings.findFirst();
  console.log("Before:", before);
  console.log("Company kept:", company?.legalName ?? "(none)");

  await prisma.$transaction(async (tx) => {
    // Orders / commercial docs (FK-safe order)
    await tx.productionSpecification.deleteMany();
    await tx.quotation.deleteMany();
    await tx.calculationVersion.deleteMany();
    await tx.fileAsset.deleteMany();
    await tx.order.deleteMany();
    await tx.client.deleteMany();

    // Models (BOM cascades where configured; delete nested first to be safe)
    await tx.productCommercialPriceTier.deleteMany();
    await tx.productCutRateTier.deleteMany();
    await tx.productAdditionalCost.deleteMany();
    await tx.productDecoration.deleteMany();
    await tx.productOperationSizeScope.deleteMany();
    await tx.productOperation.deleteMany();
    await tx.productMaterialSizeScope.deleteMany();
    await tx.productMaterialSizeNorm.deleteMany();
    await tx.productMaterial.deleteMany();
    await tx.productSize.deleteMany();
    await tx.product.deleteMany();

    // Fabrics / trims / other materials + suppliers
    await tx.materialSupplier.deleteMany();
    await tx.material.deleteMany();
    await tx.supplier.deleteMany();

    // Orphan activity + material/product categories only
    await tx.activityEvent.deleteMany();
    await tx.category.deleteMany({
      where: {
        kind: { in: ["PRODUCT", "MATERIAL", "FABRIC", "TRIM", "OTHER_MATERIAL"] },
      },
    });
  });

  const after = {
    company: await prisma.companySettings.count(),
    users: await prisma.user.count(),
    clients: await prisma.client.count(),
    orders: await prisma.order.count(),
    products: await prisma.product.count(),
    materials: await prisma.material.count(),
    suppliers: await prisma.supplier.count(),
    materialOffers: await prisma.materialSupplier.count(),
    operations: await prisma.operation.count(),
    decorations: await prisma.decorationMethod.count(),
    files: await prisma.fileAsset.count(),
    activity: await prisma.activityEvent.count(),
    pricing: await prisma.pricingSettings.count(),
    units: await prisma.unitOfMeasure.count(),
    sizes: await prisma.size.count(),
  };

  console.log("After:", after);
  console.log("Done. Company, users, pricing, units, sizes, operations and decorations kept.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
