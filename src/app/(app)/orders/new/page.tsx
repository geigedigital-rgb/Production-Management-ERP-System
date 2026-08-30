import { listClients } from "@/server/domains/clients/service";
import { listProducts, listSizes, toCompositionTemplate } from "@/server/domains/products/service";
import { getFabricPricingGlobals, listMaterials, listUnits } from "@/server/domains/catalog/materials";
import { listDecorations, listOperations } from "@/server/domains/catalog/operations";
import { buildCalcFromProduct, getPricingDefaults } from "@/server/domains/calculation/from-entities";
import { Breadcrumbs } from "@/components/ui/ObjectHeader";
import { OrderCreateForm } from "./OrderCreateForm";

const PRICE_TIERS = [1, 10, 50, 100, 250, 500, 1000];

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; productId?: string }>;
}) {
  const params = await searchParams;
  const [clients, products, pricing, sizes, materials, operations, decorations, units, fabricGlobals] =
    await Promise.all([
      listClients(),
      listProducts(),
      getPricingDefaults(),
      listSizes(),
      listMaterials(),
      listOperations(),
      listDecorations(),
      listUnits(),
      getFabricPricingGlobals(),
    ]);

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Замовлення", href: "/orders" }, { label: "Нове замовлення" }]} />

      <div>
        <h1 className="type-page-title">Нове замовлення</h1>
        <p className="type-body-secondary mt-1 max-w-2xl">
          Оберіть клієнта, додайте вироби в таблицю позицій, за потреби підправте склад кожного —
          і створіть замовлення. Пізніше в картці замовлення можна додати ще вироби.
        </p>
      </div>

      <OrderCreateForm
        initialClientId={params.clientId}
        initialProductId={params.productId}
        defaultTargetMargin={pricing.targetRatePercent}
        pricingMethod={pricing.pricingMethod}
        companyCostMode={fabricGlobals.materialCostVatMode}
        clients={clients.map((client) => ({ id: client.id, label: client.companyName }))}
        sizeOptions={sizes.map((size) => ({
          id: size.id,
          label: size.nameUk,
          code: size.code,
        }))}
        unitOptions={units.map((unit) => ({
          id: unit.id,
          label: `${unit.nameUk} (${unit.code})`,
        }))}
        materialCatalog={materials.map((material) => ({
          id: material.id,
          label: `${material.nameUk} (${material.unitOfMeasure.code})`,
          unit: material.unitOfMeasure.code,
          price: Number(material.purchasePrice),
          defaultWaste: Number(material.defaultWastePercent),
          name: material.nameUk,
          materialType: material.type,
          priceMeterUahNoVat:
            material.priceMeterUahNoVat != null ? Number(material.priceMeterUahNoVat) : null,
          priceMeterUahVat:
            material.priceMeterUahVat != null ? Number(material.priceMeterUahVat) : null,
          priceMeterUahCutVat:
            material.priceMeterUahCutVat != null ? Number(material.priceMeterUahCutVat) : null,
          metersPerRoll: material.metersPerRoll != null ? Number(material.metersPerRoll) : null,
          minWholesaleMeters:
            material.minWholesaleMeters != null ? Number(material.minWholesaleMeters) : null,
          costVatOverride: material.costVatOverride,
        }))}
        operationCatalog={operations.map((operation) => ({
          id: operation.id,
          label: operation.nameUk,
          method: operation.calculationMethod,
          unitRate: operation.baseRate != null ? Number(operation.baseRate) : null,
          shiftCost: operation.shiftCost != null ? Number(operation.shiftCost) : null,
          standardOutput:
            operation.standardOutputPerShift != null
              ? Number(operation.standardOutputPerShift)
              : null,
        }))}
        decorationCatalog={decorations.map((decoration) => ({
          id: decoration.id,
          label: decoration.nameUk,
          setupCost: Number(decoration.setupCost),
          unitRate: Number(decoration.unitRate),
        }))}
        products={products.map((product) => {
          const composition = toCompositionTemplate(product);
          return {
            id: product.id,
            label: product.internalCode
              ? `${product.nameUk} (${product.internalCode})`
              : product.nameUk,
            nameUk: product.nameUk,
            internalCode: product.internalCode,
            imageUrl: product.imageUrl,
            materialsCount: product.materials.length,
            operationsCount: product.operations.length,
            decorationsCount: product.decorations.length,
            sizes: product.sizes.map((size) => ({
              code: size.size.code,
              nameUk: size.size.nameUk,
            })),
            composition,
            priceTiers:
              product.commercialPriceTiers.length > 0
                ? product.commercialPriceTiers.map((tier) => ({
                    qty: tier.minQuantity,
                    price: Number(tier.pricePerUnit),
                  }))
                : product.materials.length > 0 || product.operations.length > 0
                  ? PRICE_TIERS.map((qty) => ({
                      qty,
                      price: Number(buildCalcFromProduct(product, qty, pricing).sellingPricePerUnit),
                    }))
                  : [],
          };
        })}
      />
    </div>
  );
}
