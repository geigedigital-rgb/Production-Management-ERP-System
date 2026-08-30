import { prisma } from "@/server/db/client";
import { getProduct, assertProductOrderable } from "@/server/domains/products/service";
import { recordActivity } from "@/server/domains/activity/service";
import type { OrderStatus, Prisma } from "@prisma/client";
import { orderStatusLabel } from "@/lib/order-status";
import {
  expandMaterialsForSizes,
  expandOperationsForSizes,
  sizeCodesFromScopes,
  sizeConsumptionFromNorms,
} from "@/lib/size-bom";
import {
  buildCalcFromOrderItem,
  cutRateContextFromProduct,
  getPricingForOrder,
} from "@/server/domains/calculation/from-entities";
import { commercialPriceForOrderItem, mergeCommercialAndCost } from "@/lib/order-item-commercial";
import { isCutOperationName, resolveCutUnitRateForProduct } from "@/lib/cut-rate";
import { computeFabricDeliveryLine } from "@/lib/fabric-delivery";
import {
  fabricFieldsForOrderLine,
  materialToSnapshot,
  offerToSnapshot,
} from "@/lib/order-material-terms";
import {
  fabricMetersNeeded,
  fabricPricingModeLabel,
  resolveMaterialLinePurchasePrice,
  resolveCostMode,
  type MaterialCostVatMode,
} from "@/lib/fabric-pricing";
import { getFabricPricingGlobals } from "@/server/domains/catalog/materials";

type FabricMaterialFields = {
  type?: string | null;
  purchasePrice: { toString(): string } | number;
  metersPerKg?: { toString(): string } | number | null;
  priceKgUsd?: { toString(): string } | number | null;
  priceKgUsdCargo?: { toString(): string } | number | null;
  priceMeterUahNoVat?: { toString(): string } | number | null;
  priceMeterUahVat?: { toString(): string } | number | null;
  priceMeterUahCutVat?: { toString(): string } | number | null;
  metersPerRoll?: { toString(): string } | number | null;
  minWholesaleMeters?: { toString(): string } | number | null;
  costVatOverride?: MaterialCostVatMode | null;
};

function numField(value: { toString(): string } | number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function purchasePriceForOrderMaterial(
  material: FabricMaterialFields,
  companyCostMode: MaterialCostVatMode,
  metersNeeded: number | null,
) {
  return resolveMaterialLinePurchasePrice({
    type: material.type,
    purchasePrice: Number(material.purchasePrice),
    priceMeterUahNoVat: numField(material.priceMeterUahNoVat),
    priceMeterUahVat: numField(material.priceMeterUahVat),
    priceMeterUahCutVat: numField(material.priceMeterUahCutVat),
    metersPerRoll: numField(material.metersPerRoll),
    minWholesaleMeters: numField(material.minWholesaleMeters),
    costVatOverride: material.costVatOverride,
    companyCostMode,
    metersNeeded,
  }).purchasePrice;
}

async function supplierOfferForLine(
  materialId: string | null | undefined,
  supplierId: string | null | undefined,
  tx: Prisma.TransactionClient = prisma,
) {
  if (!materialId || !supplierId) return null;
  return tx.materialSupplier.findUnique({
    where: { materialId_supplierId: { materialId, supplierId } },
    include: { supplier: true },
  });
}

function orderLineFabricFields(
  row: { costVatOverride?: MaterialCostVatMode | null },
  material: FabricMaterialFields & { costVatOverride?: MaterialCostVatMode | null },
  offer?: Awaited<ReturnType<typeof supplierOfferForLine>>,
) {
  const merged = fabricFieldsForOrderLine(
    materialToSnapshot(material),
    offer ? offerToSnapshot(offer) : null,
  );
  const costVatOverride = row.costVatOverride ?? material.costVatOverride ?? null;
  return { ...merged, costVatOverride };
}

function previewFabricLineTerms(input: {
  row: {
    consumptionPerUnit: { toString(): string } | number;
    wastePercent: { toString(): string } | number;
    sizeCode: string | null;
    cargoUsdPerKg?: { toString(): string } | number | null;
    usdUahRate?: { toString(): string } | number | null;
    costVatOverride?: MaterialCostVatMode | null;
  };
  material: FabricMaterialFields & {
    type?: string | null;
    purchasePrice: { toString(): string } | number;
    priceMeterUahCutVat?: { toString(): string } | number | null;
    costVatOverride?: MaterialCostVatMode | null;
  };
  offer?: Awaited<ReturnType<typeof supplierOfferForLine>>;
  quantitiesBySize: Record<string, number>;
  globals: Awaited<ReturnType<typeof getFabricPricingGlobals>>;
  costVatOverride?: MaterialCostVatMode | null;
  cargoOverride?: number | null;
  usdUahRateOverride?: number | null;
}) {
  const metersNeeded = fabricMetersNeeded({
    consumptionPerUnit: Number(input.row.consumptionPerUnit),
    wastePercent: Number(input.row.wastePercent),
    quantitiesBySize: input.quantitiesBySize,
    sizeCode: input.row.sizeCode,
  });
  const vatOverride =
    input.costVatOverride ?? input.row.costVatOverride ?? input.material.costVatOverride ?? null;
  const fields = orderLineFabricFields({ costVatOverride: vatOverride }, input.material, input.offer);
  const resolved = resolveMaterialLinePurchasePrice({
    type: input.material.type,
    purchasePrice: Number(input.material.purchasePrice),
    priceMeterUahNoVat: fields.priceMeterUahNoVat,
    priceMeterUahVat: fields.priceMeterUahVat,
    priceMeterUahCutVat: fields.priceMeterUahCutVat ?? numField(input.material.priceMeterUahCutVat),
    metersPerRoll: fields.metersPerRoll,
    minWholesaleMeters: fields.minWholesaleMeters,
    costVatOverride: fields.costVatOverride,
    companyCostMode: input.globals.materialCostVatMode,
    metersNeeded,
  });
  const resolvedNet = resolveMaterialLinePurchasePrice({
    type: input.material.type,
    purchasePrice: Number(input.material.purchasePrice),
    priceMeterUahNoVat: fields.priceMeterUahNoVat,
    priceMeterUahVat: fields.priceMeterUahVat,
    priceMeterUahCutVat: fields.priceMeterUahCutVat ?? numField(input.material.priceMeterUahCutVat),
    metersPerRoll: fields.metersPerRoll,
    minWholesaleMeters: fields.minWholesaleMeters,
    costVatOverride: "NET",
    companyCostMode: "NET",
    metersNeeded,
  });
  const resolvedGross = resolveMaterialLinePurchasePrice({
    type: input.material.type,
    purchasePrice: Number(input.material.purchasePrice),
    priceMeterUahNoVat: fields.priceMeterUahNoVat,
    priceMeterUahVat: fields.priceMeterUahVat,
    priceMeterUahCutVat: fields.priceMeterUahCutVat ?? numField(input.material.priceMeterUahCutVat),
    metersPerRoll: fields.metersPerRoll,
    minWholesaleMeters: fields.minWholesaleMeters,
    costVatOverride: "GROSS",
    companyCostMode: "GROSS",
    metersNeeded,
  });
  const cargoUsdPerKg =
    input.cargoOverride ??
    numField(input.row.cargoUsdPerKg) ??
    (input.offer ? numField(input.offer.cargoUsdPerKg) : null) ??
    input.globals.fabricCargoUsdPerKg;
  const usdUahRate =
    input.usdUahRateOverride ??
    numField(input.row.usdUahRate) ??
    input.globals.usdUahRate;
  const deliveryAmount = computeFabricDeliveryLine(
    {
      type: "FABRIC",
      metersPerKg: fields.metersPerKg,
      priceKgUsd: fields.priceKgUsd,
      priceKgUsdCargo: fields.priceKgUsdCargo,
      cargoUsdPerKg,
      usdUahRate,
      consumptionPerUnit: Number(input.row.consumptionPerUnit),
      wastePercent: Number(input.row.wastePercent),
      sizeCode: input.row.sizeCode,
    },
    input.quantitiesBySize,
    input.globals,
  );
  const metersPerKg = fields.metersPerKg;
  const kgNeeded =
    metersPerKg != null && metersPerKg > 0 && metersNeeded > 0
      ? Math.round((metersNeeded / metersPerKg) * 10) / 10
      : null;

  return {
    purchasePricePerMeter: resolved.purchasePrice,
    purchasePriceNet: resolvedNet.purchasePrice,
    purchasePriceGross: resolvedGross.purchasePrice,
    pricingMode: resolved.pricingMode,
    pricingModeLabel: fabricPricingModeLabel(resolved.pricingMode),
    priceMeterUahNoVat: fields.priceMeterUahNoVat,
    priceMeterUahVat: fields.priceMeterUahVat,
    priceKgUsd: fields.priceKgUsd,
    metersPerKg,
    cargoUsdPerKg,
    usdUahRate,
    metersNeeded: Math.round(metersNeeded * 100) / 100,
    kgNeeded,
    materialPartyCost: Math.round(resolved.purchasePrice * metersNeeded * 100) / 100,
    deliveryAmount,
    costVatMode: resolveCostMode(input.globals.materialCostVatMode, vatOverride),
  };
}

function fabricDeliverySourceForLine(input: {
  row: {
    consumptionPerUnit: { toString(): string } | number;
    wastePercent: { toString(): string } | number;
    sizeCode: string | null;
    cargoUsdPerKg?: { toString(): string } | number | null;
    usdUahRate?: { toString(): string } | number | null;
  };
  material: FabricMaterialFields & { type?: string | null };
  offer?: Awaited<ReturnType<typeof supplierOfferForLine>>;
}) {
  const merged = orderLineFabricFields(
    { costVatOverride: null },
    input.material,
    input.offer,
  );
  const cargoOverride =
    numField(input.row.cargoUsdPerKg) ??
    (input.offer ? numField(input.offer.cargoUsdPerKg) : null);
  const usdUahRateOverride = numField(input.row.usdUahRate);
  return {
    type: merged.type ?? input.material.type,
    metersPerKg: merged.metersPerKg,
    priceKgUsd: merged.priceKgUsd,
    priceKgUsdCargo: merged.priceKgUsdCargo,
    cargoUsdPerKg: cargoOverride,
    usdUahRate: usdUahRateOverride,
    consumptionPerUnit: Number(input.row.consumptionPerUnit),
    wastePercent: Number(input.row.wastePercent),
    sizeCode: input.row.sizeCode,
  };
}

export async function listOrders(filters?: {
  search?: string;
  status?: OrderStatus;
}) {
  const search = filters?.search?.trim();
  return prisma.order.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { client: { companyName: { contains: search, mode: "insensitive" } } },
              { items: { some: { nameUk: { contains: search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: {
      client: true,
      manager: { select: { id: true, name: true } },
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          versions: {
            orderBy: [{ isApproved: "desc" }, { versionNumber: "desc" }],
            take: 1,
            select: {
              versionNumber: true,
              isApproved: true,
              totalSellingValue: true,
              marginPercent: true,
            },
          },
          _count: { select: { materials: true, operations: true } },
        },
      },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      manager: { select: { id: true, name: true, email: true } },
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          product: {
            select: {
              optimalQty: true,
              isBaseModel: true,
              cutRateTiers: { orderBy: { minQuantity: "asc" } },
              commercialPriceTiers: { orderBy: { minQuantity: "asc" } },
            },
          },
          sizes: true,
          materials: {
            orderBy: { sortOrder: "asc" },
            include: {
              material: {
                select: {
                  id: true,
                  nameUk: true,
                  type: true,
                  supplierCode: true,
                  metersPerKg: true,
                  priceKgUsd: true,
                  priceKgUsdCargo: true,
                  priceMeterUahNoVat: true,
                  priceMeterUahVat: true,
                  priceMeterUahCutVat: true,
                  metersPerRoll: true,
                  minWholesaleMeters: true,
                  costVatOverride: true,
                },
              },
            },
          },
          operations: { orderBy: { sortOrder: "asc" } },
          decorations: { orderBy: { sortOrder: "asc" } },
          additionalCosts: true,
          versions: {
            orderBy: { versionNumber: "desc" },
            include: { author: { select: { name: true } } },
          },
          specification: true,
        },
      },
      files: true,
    },
  });
}

async function nextOrderNumber() {
  const year = new Date().getFullYear();
  const prefix = `ЗМ-${year}-`;
  const latest = await prisma.order.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = latest ? Number(latest.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

type CatalogProduct = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

function bomFromProduct(
  product: CatalogProduct,
  orderedSizeCodes: string[],
  totalQuantity: number,
  quantitiesBySize: Record<string, number>,
  companyCostMode: MaterialCostVatMode,
) {
  const expandedMaterials = expandMaterialsForSizes(
    product.materials.map((row) => ({
      materialId: row.materialId,
      consumption: Number(row.consumptionPerUnit),
      waste: Number(row.wastePercent ?? row.material.defaultWastePercent),
      sizeCodes: sizeCodesFromScopes(row.sizeScopes),
      sizeConsumption: sizeConsumptionFromNorms(row.sizeNorms),
    })),
    orderedSizeCodes,
  );
  const materialById = new Map(product.materials.map((row) => [row.materialId, row]));
  const expandedOperations = expandOperationsForSizes(
    product.operations.map((row) => ({
      operationId: row.operationId,
      sizeCodes: sizeCodesFromScopes(row.sizeScopes),
    })),
    orderedSizeCodes,
  );
  const operationById = new Map(product.operations.map((row) => [row.operationId, row]));

  return {
    materials: {
      create: expandedMaterials.map((row, index) => {
        const source = materialById.get(row.materialId)!;
        const sizeConsumption = sizeConsumptionFromNorms(source.sizeNorms);
        const waste = Number(
          row.waste ?? source.wastePercent ?? source.material.defaultWastePercent,
        );
        const metersNeeded = fabricMetersNeeded({
          consumptionPerUnit: row.consumption,
          wastePercent: waste,
          quantitiesBySize,
          sizeCode: row.sizeCode,
          sizeConsumption,
        });
        return {
          materialId: source.materialId,
          nameSnapshot: source.material.nameUk,
          unitCodeSnapshot: source.material.unitOfMeasure.code,
          consumptionPerUnit: row.consumption,
          wastePercent: waste,
          purchasePrice: purchasePriceForOrderMaterial(
            source.material,
            companyCostMode,
            metersNeeded,
          ),
          sortOrder: index,
          sizeCode: row.sizeCode,
        };
      }),
    },
    operations: {
      create: expandedOperations.map((row, index) => {
        const source = operationById.get(row.operationId)!;
        const fallbackRate =
          source.rateOverride != null
            ? Number(source.rateOverride)
            : source.operation.baseRate != null
              ? Number(source.operation.baseRate)
              : 0;
        const unitRate = isCutOperationName(source.operation.nameUk)
          ? resolveCutUnitRateForProduct(product, totalQuantity, fallbackRate)
          : fallbackRate;
        return {
          operationId: source.operationId,
          nameSnapshot: source.operation.nameUk,
          calculationMethod: source.operation.calculationMethod,
          unitRate,
          shiftCost: source.operation.shiftCost,
          standardOutput: source.standardOverride ?? source.operation.standardOutputPerShift,
          sortOrder: index,
          sizeCode: row.sizeCode,
        };
      }),
    },
    decorations: {
      create: product.decorations.map((row, index) => ({
        decorationMethodId: row.decorationMethodId,
        nameSnapshot: row.decorationMethod.nameUk,
        setupCost: row.decorationMethod.setupCost,
        unitRate: row.decorationMethod.unitRate,
        sortOrder: index,
      })),
    },
    additionalCosts: {
      create: product.additionalCosts.map((row) => ({
        nameUk: row.nameUk,
        amount: row.amount,
        isPerUnit: row.isPerUnit,
      })),
    },
  };
}

function assertOrderEditable(status: OrderStatus) {
  if (status === "HANDED_TO_PRODUCTION" || status === "CLOSED" || status === "CANCELLED") {
    throw new Error("ORDER_LOCKED");
  }
}

async function assertOrderItemEditable(orderItemId: string) {
  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    select: { order: { select: { status: true } } },
  });
  if (!item) throw new Error("NOT_FOUND");
  assertOrderEditable(item.order.status);
}

async function assertOrderEditableById(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  assertOrderEditable(order.status);
}

async function assertOrderItemMaterialEditable(materialRowId: string) {
  const row = await prisma.orderItemMaterial.findUnique({
    where: { id: materialRowId },
    select: { orderItem: { select: { order: { select: { status: true } } } } },
  });
  if (!row) throw new Error("NOT_FOUND");
  assertOrderEditable(row.orderItem.order.status);
}

async function assertOrderItemOperationEditable(operationRowId: string) {
  const row = await prisma.orderItemOperation.findUnique({
    where: { id: operationRowId },
    select: { orderItem: { select: { order: { select: { status: true } } } } },
  });
  if (!row) throw new Error("NOT_FOUND");
  assertOrderEditable(row.orderItem.order.status);
}

async function assertOrderItemDecorationEditable(decorationRowId: string) {
  const row = await prisma.orderItemDecoration.findUnique({
    where: { id: decorationRowId },
    select: { orderItem: { select: { order: { select: { status: true } } } } },
  });
  if (!row) throw new Error("NOT_FOUND");
  assertOrderEditable(row.orderItem.order.status);
}

export async function createOrderWithProduct(input: {
  clientId: string;
  managerId: string;
  productId: string;
  title?: string | null;
  deadline?: Date | null;
  sizeQuantities: Array<{ sizeCode: string; sizeNameUk: string; quantity: number }>;
  comment?: string | null;
}) {
  return createOrderWithProducts({
    clientId: input.clientId,
    managerId: input.managerId,
    title: input.title,
    deadline: input.deadline,
    items: [
      {
        productId: input.productId,
        sizeQuantities: input.sizeQuantities,
        comment: input.comment,
      },
    ],
  });
}

export async function createOrderWithProducts(input: {
  clientId: string;
  managerId: string;
  title?: string | null;
  deadline?: Date | null;
  targetMarginPercent?: number | null;
  items: Array<{
    productId: string;
    sizeQuantities: Array<{ sizeCode: string; sizeNameUk: string; quantity: number }>;
    comment?: string | null;
    composition?: {
      materials: Array<{
        materialId: string;
        consumptionPerUnit: number;
        wastePercent?: number | null;
        sizeCode?: string | null;
        sizeCodes?: string[] | null;
        sizeConsumption?: Record<string, number>;
        purchasePrice?: number | null;
      }>;
      operations: Array<{
        operationId: string;
        sizeCode?: string | null;
        sizeCodes?: string[] | null;
      }>;
      decorations: Array<{ decorationMethodId: string }>;
    };
  }>;
}) {
  if (input.items.length === 0) throw new Error("ITEMS_REQUIRED");

  const products = await Promise.all(input.items.map((item) => getProduct(item.productId)));
  if (products.some((product) => !product)) throw new Error("PRODUCT_NOT_FOUND");
  for (const product of products) {
    assertProductOrderable(product);
  }

  const fabricGlobals = await getFabricPricingGlobals();
  const companyCostMode = fabricGlobals.materialCostVatMode;

  const number = await nextOrderNumber();
  const primaryName = products[0]!.nameUk;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        number,
        clientId: input.clientId,
        managerId: input.managerId,
        title: input.title || primaryName,
        status: "CALCULATION",
        deadline: input.deadline ?? null,
        comment: input.items[0]?.comment || null,
        targetMarginPercent:
          input.targetMarginPercent != null && Number.isFinite(input.targetMarginPercent)
            ? input.targetMarginPercent
            : null,
      },
    });

    const createdItems = [];
    for (let i = 0; i < input.items.length; i++) {
      const line = input.items[i];
      const product = products[i]!;
      const totalQuantity = line.sizeQuantities.reduce((s, x) => s + x.quantity, 0);
      const override = line.composition;

      let materialsCreate;
      let operationsCreate;
      let decorationsCreate;

      const orderedSizeCodes = line.sizeQuantities
        .filter((row) => row.quantity > 0)
        .map((row) => row.sizeCode);
      const quantitiesBySize = Object.fromEntries(
        line.sizeQuantities.map((row) => [row.sizeCode, row.quantity]),
      );

      if (override) {
        const materialIds = override.materials.map((row) => row.materialId);
        const operationIds = override.operations.map((row) => row.operationId);
        const decorationIds = override.decorations.map((row) => row.decorationMethodId);

        const [materials, operations, decorations] = await Promise.all([
          materialIds.length
            ? tx.material.findMany({
                where: { id: { in: materialIds } },
                include: { unitOfMeasure: true },
              })
            : Promise.resolve([]),
          operationIds.length
            ? tx.operation.findMany({ where: { id: { in: operationIds } } })
            : Promise.resolve([]),
          decorationIds.length
            ? tx.decorationMethod.findMany({ where: { id: { in: decorationIds } } })
            : Promise.resolve([]),
        ]);

        const materialById = new Map(materials.map((row) => [row.id, row]));
        const operationById = new Map(operations.map((row) => [row.id, row]));
        const decorationById = new Map(decorations.map((row) => [row.id, row]));

        const expandedMaterials = expandMaterialsForSizes(
          override.materials.map((row) => ({
            materialId: row.materialId,
            consumption: row.consumptionPerUnit,
            waste: row.wastePercent,
            sizeCodes: row.sizeCode ? [row.sizeCode] : row.sizeCodes,
            sizeConsumption: row.sizeConsumption,
          })),
          orderedSizeCodes,
        );

        materialsCreate = expandedMaterials
          .map((row, index) => {
            const material = materialById.get(row.materialId);
            if (!material) return null;
            const waste = row.waste ?? Number(material.defaultWastePercent);
            const metersNeeded = fabricMetersNeeded({
              consumptionPerUnit: row.consumption,
              wastePercent: waste,
              quantitiesBySize,
              sizeCode: row.sizeCode,
              sizeConsumption: override.materials.find((m) => m.materialId === row.materialId)
                ?.sizeConsumption,
            });
            const draftPrice = override.materials.find((m) => m.materialId === row.materialId)
              ?.purchasePrice;
            const purchasePrice =
              draftPrice != null && Number.isFinite(Number(draftPrice))
                ? Number(draftPrice)
                : purchasePriceForOrderMaterial(material, companyCostMode, metersNeeded);
            return {
              materialId: material.id,
              nameSnapshot: material.nameUk,
              unitCodeSnapshot: material.unitOfMeasure.code,
              consumptionPerUnit: row.consumption,
              wastePercent: waste,
              purchasePrice,
              sortOrder: index,
              sizeCode: row.sizeCode,
            };
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row));

        const expandedOperations = expandOperationsForSizes(
          override.operations.map((row) => ({
            operationId: row.operationId,
            sizeCodes: row.sizeCode ? [row.sizeCode] : row.sizeCodes,
          })),
          orderedSizeCodes,
        );

        operationsCreate = expandedOperations
          .map((row, index) => {
            const operation = operationById.get(row.operationId);
            if (!operation) return null;
            const productOp = product.operations.find((line) => line.operationId === row.operationId);
            const fallbackRate =
              productOp?.rateOverride != null
                ? Number(productOp.rateOverride)
                : operation.baseRate != null
                  ? Number(operation.baseRate)
                  : 0;
            const unitRate = isCutOperationName(operation.nameUk)
              ? resolveCutUnitRateForProduct(product, totalQuantity, fallbackRate)
              : fallbackRate;
            return {
              operationId: operation.id,
              nameSnapshot: operation.nameUk,
              calculationMethod: operation.calculationMethod,
              unitRate,
              shiftCost: operation.shiftCost,
              standardOutput: operation.standardOutputPerShift,
              sortOrder: index,
              sizeCode: row.sizeCode,
            };
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row));

        decorationsCreate = override.decorations
          .map((row, index) => {
            const decoration = decorationById.get(row.decorationMethodId);
            if (!decoration) return null;
            return {
              decorationMethodId: decoration.id,
              nameSnapshot: decoration.nameUk,
              setupCost: decoration.setupCost,
              unitRate: decoration.unitRate,
              sortOrder: index,
            };
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row));
      } else {
        const bom = bomFromProduct(
          product,
          orderedSizeCodes,
          totalQuantity,
          quantitiesBySize,
          companyCostMode,
        );
        materialsCreate = bom.materials.create;
        operationsCreate = bom.operations.create;
        decorationsCreate = bom.decorations.create;
      }

      const item = await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          sourceProductId: product.id,
          nameUk: product.nameUk,
          totalQuantity,
          comment: line.comment || null,
          sizes: {
            create: line.sizeQuantities
              .filter((s) => s.quantity > 0)
              .map((s) => ({
                sizeCode: s.sizeCode,
                sizeNameUk: s.sizeNameUk,
                quantity: s.quantity,
              })),
          },
          materials: { create: materialsCreate },
          operations: { create: operationsCreate },
          decorations: { create: decorationsCreate },
          additionalCosts: {
            create: product.additionalCosts.map((row) => ({
              nameUk: row.nameUk,
              amount: row.amount,
              isPerUnit: row.isPerUnit,
            })),
          },
        },
      });
      createdItems.push(item);
      await syncOrderItemFabricPricing(item.id, tx);
    }

    return { order, item: createdItems[0], items: createdItems };
  });

  await recordActivity({
    entityType: "order",
    entityId: result.order.id,
    action: "created",
    userId: input.managerId,
    payload: {
      number: result.order.number,
      clientId: input.clientId,
      itemCount: result.items.length,
    },
  });

  return result;
}

export async function addOrderItemFromProduct(input: {
  orderId: string;
  productId: string;
  sizeQuantities: Array<{ sizeCode: string; sizeNameUk: string; quantity: number }>;
  userId?: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, status: true },
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  assertOrderEditable(order.status);

  const product = await getProduct(input.productId);
  assertProductOrderable(product);

  const sizeQuantities = input.sizeQuantities.filter((row) => row.quantity > 0);
  const totalQuantity = sizeQuantities.reduce((sum, row) => sum + row.quantity, 0);
  if (totalQuantity <= 0) throw new Error("QUANTITY_REQUIRED");

  const fabricGlobals = await getFabricPricingGlobals();
  const companyCostMode = fabricGlobals.materialCostVatMode;

  const reopen = order.status === "APPROVED" || order.status === "PENDING_APPROVAL";
  const quantitiesBySize = Object.fromEntries(
    sizeQuantities.map((row) => [row.sizeCode, row.quantity]),
  );
  const bom = bomFromProduct(
    product,
    sizeQuantities.map((row) => row.sizeCode),
    totalQuantity,
    quantitiesBySize,
    companyCostMode,
  );

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        sourceProductId: product.id,
        nameUk: product.nameUk,
        totalQuantity,
        sizes: {
          create: sizeQuantities.map((row) => ({
            sizeCode: row.sizeCode,
            sizeNameUk: row.sizeNameUk,
            quantity: row.quantity,
          })),
        },
        ...bom,
      },
    });

    if (reopen) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "CALCULATION", approvedDate: null },
      });
    }

    return created;
  });

  await recordActivity({
    entityType: "order",
    entityId: order.id,
    action: "updated",
    userId: input.userId ?? null,
    payload: { addedItem: product.nameUk, itemId: item.id },
  });

  if (reopen) {
    await recordActivity({
      entityType: "order",
      entityId: order.id,
      action: "status_changed",
      userId: input.userId ?? null,
      payload: {
        from: order.status,
        to: "CALCULATION",
        fromLabel: orderStatusLabel[order.status] ?? order.status,
        toLabel: orderStatusLabel.CALCULATION,
      },
    });
  }

  return item;
}

export async function removeOrderItem(input: { orderItemId: string; userId?: string }) {
  const item = await prisma.orderItem.findUnique({
    where: { id: input.orderItemId },
    select: {
      id: true,
      nameUk: true,
      orderId: true,
      order: { select: { status: true, _count: { select: { items: true } } } },
    },
  });
  if (!item) throw new Error("NOT_FOUND");
  assertOrderEditable(item.order.status);
  if (item.order._count.items <= 1) throw new Error("LAST_ITEM");

  await prisma.$transaction(async (tx) => {
    await tx.quotation.deleteMany({
      where: { calculationVersion: { orderItemId: item.id } },
    });
    await tx.productionSpecification.deleteMany({ where: { orderItemId: item.id } });
    await tx.orderItem.delete({ where: { id: item.id } });
  });

  await recordActivity({
    entityType: "order",
    entityId: item.orderId,
    action: "updated",
    userId: input.userId ?? null,
    payload: { removedItem: item.nameUk, itemId: item.id },
  });

  return { orderId: item.orderId };
}

async function syncCutRatesForOrderItem(
  orderItemId: string,
  totalQuantity: number,
  tx: Prisma.TransactionClient = prisma,
) {
  const item = await tx.orderItem.findUnique({
    where: { id: orderItemId },
    include: {
      operations: true,
      product: {
        select: {
          optimalQty: true,
          cutRateTiers: { orderBy: { minQuantity: "asc" } },
        },
      },
    },
  });
  if (!item?.product?.cutRateTiers.length) return;

  for (const operation of item.operations) {
    if (!isCutOperationName(operation.nameSnapshot)) continue;
    const rate = resolveCutUnitRateForProduct(
      item.product,
      totalQuantity,
      Number(operation.unitRate ?? 0),
    );
    if (Math.abs(Number(operation.unitRate ?? 0) - rate) > 0.0001) {
      await tx.orderItemOperation.update({
        where: { id: operation.id },
        data: { unitRate: rate },
      });
    }
  }
}

async function syncOrderItemFabricPrices(
  orderItemId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  const [item, fabricGlobals] = await Promise.all([
    tx.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        sizes: true,
        materials: {
          include: {
            material: true,
          },
        },
      },
    }),
    getFabricPricingGlobals(),
  ]);
  if (!item) return;

  const quantitiesBySize = Object.fromEntries(
    item.sizes.map((row) => [row.sizeCode, row.quantity]),
  );

  for (const row of item.materials) {
    if (!row.material || row.material.type !== "FABRIC") continue;
    const offer = await supplierOfferForLine(row.materialId, row.supplierId, tx);
    const metersNeeded = fabricMetersNeeded({
      consumptionPerUnit: Number(row.consumptionPerUnit),
      wastePercent: Number(row.wastePercent),
      quantitiesBySize,
      sizeCode: row.sizeCode,
    });
    const fields = orderLineFabricFields(row, row.material, offer);
    const nextPrice = purchasePriceForOrderMaterial(
      fields,
      fabricGlobals.materialCostVatMode,
      metersNeeded,
    );
    if (Number(row.purchasePrice) === nextPrice) continue;
    await tx.orderItemMaterial.update({
      where: { id: row.id },
      data: { purchasePrice: nextPrice },
    });
  }
}

async function syncOrderItemFabricDelivery(
  orderItemId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  const [item, fabricGlobals] = await Promise.all([
    tx.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        sizes: true,
        materials: { include: { material: true } },
      },
    }),
    getFabricPricingGlobals(),
  ]);
  if (!item) return;

  const quantitiesBySize = Object.fromEntries(
    item.sizes.map((row) => [row.sizeCode, row.quantity]),
  );

  let totalComputed = 0;
  let totalAmount = 0;

  for (const row of item.materials) {
    if (!row.material || row.material.type !== "FABRIC") continue;
    const offer = await supplierOfferForLine(row.materialId, row.supplierId, tx);
    const source = fabricDeliverySourceForLine({ row, material: row.material, offer });
    const computed = computeFabricDeliveryLine(source, quantitiesBySize, fabricGlobals);
    const amount = row.fabricDeliveryManual
      ? Number(row.fabricDeliveryAmount)
      : computed;
    totalComputed += computed;
    totalAmount += amount;

    if (
      Number(row.fabricDeliveryComputed ?? -1) === computed &&
      Number(row.fabricDeliveryAmount) === amount
    ) {
      continue;
    }

    await tx.orderItemMaterial.update({
      where: { id: row.id },
      data: {
        fabricDeliveryComputed: computed,
        fabricDeliveryAmount: amount,
      },
    });
  }

  totalComputed = Math.round(totalComputed * 10) / 10;
  totalAmount = Math.round(totalAmount * 10) / 10;

  const itemAmount = item.fabricDeliveryManual
    ? Number(item.fabricDeliveryAmount)
    : totalAmount;

  if (
    Number(item.fabricDeliveryComputed ?? -1) === totalComputed &&
    Number(item.fabricDeliveryAmount) === itemAmount
  ) {
    return;
  }

  await tx.orderItem.update({
    where: { id: orderItemId },
    data: {
      fabricDeliveryComputed: totalComputed,
      fabricDeliveryAmount: itemAmount,
    },
  });
}

export async function updateOrderItemFabricDelivery(
  orderItemId: string,
  input: { amount: number; manual: boolean },
) {
  await assertOrderItemEditable(orderItemId);
  await prisma.orderItem.update({
    where: { id: orderItemId },
    data: {
      fabricDeliveryAmount: Math.max(0, input.amount),
      fabricDeliveryManual: input.manual,
    },
  });
  if (!input.manual) {
    await syncOrderItemFabricDelivery(orderItemId);
  }
}

export async function getOrderItemMaterialDetail(orderItemMaterialId: string) {
  const row = await prisma.orderItemMaterial.findUnique({
    where: { id: orderItemMaterialId },
    include: {
      material: true,
      orderItem: { include: { sizes: true } },
    },
  });
  if (!row) return null;

  if (!row.material || row.material.type !== "FABRIC") {
    const quantitiesBySize = Object.fromEntries(
      row.orderItem.sizes.map((size) => [size.sizeCode, size.quantity]),
    );
    const totalQuantity = row.orderItem.sizes.reduce((sum, size) => sum + size.quantity, 0);
    return {
      id: row.id,
      orderId: row.orderItem.orderId,
      orderItemId: row.orderItemId,
      name: row.nameSnapshot,
      unit: row.unitCodeSnapshot,
      consumption: Number(row.consumptionPerUnit),
      waste: Number(row.wastePercent),
      sizeCode: row.sizeCode,
      totalQuantity,
      quantitiesBySize,
      isFabric: false,
      materialId: row.materialId,
      purchasePrice: Number(row.purchasePrice),
      materialPartyCost:
        Math.round(
          Number(row.purchasePrice) *
            Number(row.consumptionPerUnit) *
            (1 + Number(row.wastePercent) / 100) *
            totalQuantity *
            100,
        ) / 100,
      offers: [],
    };
  }

  const globals = await getFabricPricingGlobals();
  const quantitiesBySize = Object.fromEntries(
    row.orderItem.sizes.map((size) => [size.sizeCode, size.quantity]),
  );
  const totalQuantity = row.orderItem.sizes.reduce((sum, size) => sum + size.quantity, 0);
  const isFabric = row.material.type === "FABRIC";
  const costVatOverride = row.costVatOverride ?? row.material.costVatOverride ?? null;

  const supplierRows =
    row.materialId && isFabric
      ? await prisma.materialSupplier.findMany({
          where: { materialId: row.materialId },
          include: { supplier: true },
          orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
        })
      : [];

  const offers = supplierRows.map((offer) => {
    const preview = previewFabricLineTerms({
      row,
      material: row.material!,
      offer,
      quantitiesBySize,
      globals,
      costVatOverride,
    });
    return {
      offerId: offer.id,
      supplierId: offer.supplierId,
      supplierName: offer.supplier.nameUk,
      isPrimary: offer.isPrimary,
      ...preview,
    };
  });

  const catalogPreview =
    isFabric
      ? previewFabricLineTerms({
          row,
          material: row.material,
          offer: null,
          quantitiesBySize,
          globals,
          costVatOverride,
          cargoOverride: numField(row.cargoUsdPerKg),
          usdUahRateOverride: numField(row.usdUahRate),
        })
      : null;

  const selectedOffer =
    row.supplierId && row.materialId
      ? supplierRows.find((offer) => offer.supplierId === row.supplierId) ?? null
      : supplierRows.find((offer) => offer.isPrimary) ?? null;

  const activePreview =
    isFabric
      ? previewFabricLineTerms({
          row,
          material: row.material,
          offer: selectedOffer,
          quantitiesBySize,
          globals,
          costVatOverride,
          cargoOverride: numField(row.cargoUsdPerKg),
          usdUahRateOverride: numField(row.usdUahRate),
        })
      : null;

  return {
    id: row.id,
    orderId: row.orderItem.orderId,
    orderItemId: row.orderItemId,
    name: row.nameSnapshot,
    unit: row.unitCodeSnapshot,
    consumption: Number(row.consumptionPerUnit),
    waste: Number(row.wastePercent),
    sizeCode: row.sizeCode,
    totalQuantity,
    quantitiesBySize,
    isFabric,
    materialId: row.materialId,
    supplierId: row.supplierId,
    supplierName:
      row.supplierNameSnapshot ??
      (selectedOffer ? selectedOffer.supplier.nameUk : row.material.supplierCode ?? null),
    costVatOverride,
    companyCostVatMode: globals.materialCostVatMode,
    purchasePrice: Number(row.purchasePrice),
    purchasePricePerMeter: activePreview?.purchasePricePerMeter ?? Number(row.purchasePrice),
    pricingMode: activePreview?.pricingMode ?? "standard",
    pricingModeLabel: activePreview?.pricingModeLabel ?? "",
    priceMeterUahNoVat: activePreview?.priceMeterUahNoVat ?? null,
    priceMeterUahVat: activePreview?.priceMeterUahVat ?? null,
    materialPartyCost: activePreview?.materialPartyCost ?? 0,
    cargoUsdPerKg:
      numField(row.cargoUsdPerKg) ??
      activePreview?.cargoUsdPerKg ??
      globals.fabricCargoUsdPerKg,
    fabricDeliveryAmount: Number(row.fabricDeliveryAmount),
    fabricDeliveryComputed: Number(
      row.fabricDeliveryComputed ?? activePreview?.deliveryAmount ?? 0,
    ),
    fabricDeliveryManual: row.fabricDeliveryManual,
    metersNeeded: activePreview?.metersNeeded ?? 0,
    kgNeeded: activePreview?.kgNeeded ?? null,
    metersPerKg: activePreview?.metersPerKg ?? numField(row.material.metersPerKg),
    priceKgUsd: activePreview?.priceKgUsd ?? numField(row.material.priceKgUsd),
    usdUahRate:
      numField(row.usdUahRate) ??
      activePreview?.usdUahRate ??
      globals.usdUahRate,
    defaultUsdUahRate: globals.usdUahRate,
    defaultCargoUsdPerKg: globals.fabricCargoUsdPerKg,
    offers,
    catalogPreview,
  };
}

export async function updateOrderItemMaterialTerms(input: {
  id: string;
  supplierId?: string | null;
  cargoUsdPerKg?: number | null;
  usdUahRate?: number | null;
  costVatOverride?: MaterialCostVatMode | null;
  consumptionPerUnit?: number;
  wastePercent?: number;
  fabricDeliveryAmount?: number;
  fabricDeliveryManual?: boolean;
}) {
  await assertOrderItemMaterialEditable(input.id);
  const row = await prisma.orderItemMaterial.findUniqueOrThrow({
    where: { id: input.id },
    include: { material: true, orderItem: { include: { sizes: true } } },
  });

  const supplierId =
    input.supplierId !== undefined ? input.supplierId : row.supplierId;
  const offer =
    supplierId && row.materialId
      ? await supplierOfferForLine(row.materialId, supplierId)
      : null;

  const supplierNameSnapshot =
    input.supplierId === null
      ? null
      : offer?.supplier.nameUk ?? row.supplierNameSnapshot;

  const costVatOverride =
    input.costVatOverride !== undefined ? input.costVatOverride : row.costVatOverride;

  const cargoUsdPerKg =
    input.cargoUsdPerKg !== undefined ? input.cargoUsdPerKg : numField(row.cargoUsdPerKg);

  const usdUahRate =
    input.usdUahRate !== undefined ? input.usdUahRate : numField(row.usdUahRate);

  const consumptionPerUnit =
    input.consumptionPerUnit !== undefined
      ? input.consumptionPerUnit
      : Number(row.consumptionPerUnit);
  const wastePercent =
    input.wastePercent !== undefined ? input.wastePercent : Number(row.wastePercent);

  const globals = await getFabricPricingGlobals();
  const quantitiesBySize = Object.fromEntries(
    row.orderItem.sizes.map((size) => [size.sizeCode, size.quantity]),
  );

  const previewRow = {
    ...row,
    consumptionPerUnit,
    wastePercent,
    costVatOverride,
    cargoUsdPerKg,
    usdUahRate,
  };

  const preview =
    row.material?.type === "FABRIC"
      ? previewFabricLineTerms({
          row: previewRow,
          material: row.material,
          offer,
          quantitiesBySize,
          globals,
          costVatOverride,
          cargoOverride: cargoUsdPerKg,
          usdUahRateOverride: usdUahRate,
        })
      : null;

  const fabricDeliveryManual = input.fabricDeliveryManual ?? row.fabricDeliveryManual;
  const fabricDeliveryAmount = fabricDeliveryManual
    ? Math.max(0, input.fabricDeliveryAmount ?? Number(row.fabricDeliveryAmount))
    : preview?.deliveryAmount ?? 0;

  await prisma.orderItemMaterial.update({
    where: { id: row.id },
    data: {
      supplierId,
      supplierNameSnapshot,
      cargoUsdPerKg,
      usdUahRate,
      costVatOverride,
      consumptionPerUnit,
      wastePercent,
      purchasePrice: preview?.purchasePricePerMeter ?? Number(row.purchasePrice),
      fabricDeliveryComputed: preview?.deliveryAmount ?? 0,
      fabricDeliveryAmount,
      fabricDeliveryManual,
    },
  });

  await prisma.orderItem.update({
    where: { id: row.orderItemId },
    data: { fabricDeliveryManual: false },
  });

  await syncOrderItemFabricPricing(row.orderItemId);
}

async function syncOrderItemFabricPricing(
  orderItemId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  await syncOrderItemFabricPrices(orderItemId, tx);
  await syncOrderItemFabricDelivery(orderItemId, tx);
}

/** Recompute fabric prices and per-line delivery (e.g. after schema migration). */
export async function refreshOrderItemFabricPricing(orderItemId: string) {
  await syncOrderItemFabricPricing(orderItemId);
}

export async function updateOrderItemSizes(
  orderItemId: string,
  sizes: Array<{ sizeCode: string; sizeNameUk: string; quantity: number }>,
) {
  await assertOrderItemEditable(orderItemId);
  const totalQuantity = sizes.reduce((s, x) => s + x.quantity, 0);
  await prisma.$transaction(async (tx) => {
    await tx.orderItemSize.deleteMany({ where: { orderItemId } });
    await tx.orderItemSize.createMany({
      data: sizes
        .filter((s) => s.quantity > 0)
        .map((s) => ({
          orderItemId,
          sizeCode: s.sizeCode,
          sizeNameUk: s.sizeNameUk,
          quantity: s.quantity,
        })),
    });
    await tx.orderItem.update({
      where: { id: orderItemId },
      data: { totalQuantity },
    });
    await syncCutRatesForOrderItem(orderItemId, totalQuantity, tx);
    await syncOrderItemFabricPricing(orderItemId, tx);
  });
}

export async function setOrderItemMaterialActualPrice(input: {
  id: string;
  actualPurchasePrice: number | null;
}) {
  await assertOrderItemMaterialEditable(input.id);
  return prisma.orderItemMaterial.update({
    where: { id: input.id },
    data: {
      actualPurchasePrice:
        input.actualPurchasePrice == null || !Number.isFinite(input.actualPurchasePrice)
          ? null
          : Math.max(0, input.actualPurchasePrice),
    },
  });
}

export async function addOrderItemMaterial(input: {
  orderItemId: string;
  materialId: string;
  consumptionPerUnit: number;
  wastePercent?: number | null;
  sizeCode?: string | null;
}) {
  await assertOrderItemEditable(input.orderItemId);
  const [material, item, fabricGlobals] = await Promise.all([
    prisma.material.findUniqueOrThrow({
      where: { id: input.materialId },
      include: { unitOfMeasure: true },
    }),
    prisma.orderItem.findUniqueOrThrow({
      where: { id: input.orderItemId },
      include: { sizes: true },
    }),
    getFabricPricingGlobals(),
  ]);
  const maxSort = await prisma.orderItemMaterial.aggregate({
    where: { orderItemId: input.orderItemId },
    _max: { sortOrder: true },
  });

  const quantitiesBySize = Object.fromEntries(
    item.sizes.map((row) => [row.sizeCode, row.quantity]),
  );
  const waste = Number(input.wastePercent ?? material.defaultWastePercent);
  const metersNeeded = fabricMetersNeeded({
    consumptionPerUnit: input.consumptionPerUnit,
    wastePercent: waste,
    quantitiesBySize,
    sizeCode: input.sizeCode || null,
  });

  const created = await prisma.orderItemMaterial.create({
    data: {
      orderItemId: input.orderItemId,
      materialId: material.id,
      nameSnapshot: material.nameUk,
      unitCodeSnapshot: material.unitOfMeasure.code,
      consumptionPerUnit: input.consumptionPerUnit,
      wastePercent: waste,
      purchasePrice: purchasePriceForOrderMaterial(
        material,
        fabricGlobals.materialCostVatMode,
        metersNeeded,
      ),
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      sizeCode: input.sizeCode || null,
    },
  });
  await syncOrderItemFabricPricing(input.orderItemId);
  return created;
}

export async function setOrderItemMaterialConsumption(input: {
  id: string;
  consumptionPerUnit: number;
  sizeCode?: string | null;
}) {
  await assertOrderItemMaterialEditable(input.id);
  const row = await prisma.orderItemMaterial.findUniqueOrThrow({
    where: { id: input.id },
    include: { orderItem: { include: { sizes: true } } },
  });

  if (!input.sizeCode || row.sizeCode === input.sizeCode) {
    await prisma.orderItemMaterial.update({
      where: { id: row.id },
      data: { consumptionPerUnit: input.consumptionPerUnit },
    });
    await syncOrderItemFabricPricing(row.orderItemId);
    return;
  }

  if (row.sizeCode == null) {
    const sizes = row.orderItem.sizes.filter((size) => size.quantity > 0);
    const others = sizes.filter((size) => size.sizeCode !== input.sizeCode);
    await prisma.$transaction([
      prisma.orderItemMaterial.update({
        where: { id: row.id },
        data: { sizeCode: input.sizeCode, consumptionPerUnit: input.consumptionPerUnit },
      }),
      ...others.map((size, index) =>
        prisma.orderItemMaterial.create({
          data: {
            orderItemId: row.orderItemId,
            materialId: row.materialId,
            nameSnapshot: row.nameSnapshot,
            unitCodeSnapshot: row.unitCodeSnapshot,
            consumptionPerUnit: row.consumptionPerUnit,
            wastePercent: row.wastePercent,
            purchasePrice: row.purchasePrice,
            sortOrder: row.sortOrder + index + 1,
            sizeCode: size.sizeCode,
          },
        }),
      ),
    ]);
    await syncOrderItemFabricPricing(row.orderItemId);
    return;
  }

  await prisma.orderItemMaterial.update({
    where: { id: row.id },
    data: { consumptionPerUnit: input.consumptionPerUnit },
  });
  await syncOrderItemFabricPricing(row.orderItemId);
}

export async function removeOrderItemMaterial(id: string, sizeCode?: string | null) {
  await assertOrderItemMaterialEditable(id);
  const row = await prisma.orderItemMaterial.findUnique({
    where: { id },
    include: { orderItem: { include: { sizes: true } } },
  });
  if (!row) return;

  const orderItemId = row.orderItemId;

  if (!sizeCode || row.sizeCode === sizeCode) {
    await prisma.orderItemMaterial.delete({ where: { id: row.id } });
    await syncOrderItemFabricPricing(orderItemId);
    return;
  }

  if (row.sizeCode == null) {
    const sizes = row.orderItem.sizes.filter((size) => size.quantity > 0);
    const keep = sizes.filter((size) => size.sizeCode !== sizeCode);
    if (keep.length === 0) {
      await prisma.orderItemMaterial.delete({ where: { id: row.id } });
      await syncOrderItemFabricPricing(orderItemId);
      return;
    }
    await prisma.$transaction([
      prisma.orderItemMaterial.delete({ where: { id: row.id } }),
      ...keep.map((size, index) =>
        prisma.orderItemMaterial.create({
          data: {
            orderItemId: row.orderItemId,
            materialId: row.materialId,
            nameSnapshot: row.nameSnapshot,
            unitCodeSnapshot: row.unitCodeSnapshot,
            consumptionPerUnit: row.consumptionPerUnit,
            wastePercent: row.wastePercent,
            purchasePrice: row.purchasePrice,
            sortOrder: row.sortOrder + index,
            sizeCode: size.sizeCode,
          },
        }),
      ),
    ]);
    await syncOrderItemFabricPricing(orderItemId);
    return;
  }

  await prisma.orderItemMaterial.delete({ where: { id: row.id } });
  await syncOrderItemFabricPricing(orderItemId);
}

export async function addOrderItemOperation(input: {
  orderItemId: string;
  operationId: string;
  sizeCode?: string | null;
}) {
  await assertOrderItemEditable(input.orderItemId);
  const [operation, item, maxSort] = await Promise.all([
    prisma.operation.findUniqueOrThrow({ where: { id: input.operationId } }),
    prisma.orderItem.findUniqueOrThrow({
      where: { id: input.orderItemId },
      select: {
        totalQuantity: true,
        product: {
          select: {
            optimalQty: true,
            cutRateTiers: { orderBy: { minQuantity: "asc" } },
          },
        },
      },
    }),
    prisma.orderItemOperation.aggregate({
      where: { orderItemId: input.orderItemId },
      _max: { sortOrder: true },
    }),
  ]);

  const fallbackRate = operation.baseRate != null ? Number(operation.baseRate) : 0;
  const unitRate =
    item.product && isCutOperationName(operation.nameUk)
      ? resolveCutUnitRateForProduct(item.product, item.totalQuantity, fallbackRate)
      : fallbackRate;

  return prisma.orderItemOperation.create({
    data: {
      orderItemId: input.orderItemId,
      operationId: operation.id,
      nameSnapshot: operation.nameUk,
      calculationMethod: operation.calculationMethod,
      unitRate,
      shiftCost: operation.shiftCost,
      standardOutput: operation.standardOutputPerShift,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      sizeCode: input.sizeCode || null,
    },
  });
}

export async function removeOrderItemOperation(id: string, sizeCode?: string | null) {
  await assertOrderItemOperationEditable(id);
  const row = await prisma.orderItemOperation.findUnique({
    where: { id },
    include: { orderItem: { include: { sizes: true } } },
  });
  if (!row) return;
  if (!sizeCode || row.sizeCode === sizeCode) {
    return prisma.orderItemOperation.delete({ where: { id: row.id } });
  }
  if (row.sizeCode == null) {
    const keep = row.orderItem.sizes.filter((size) => size.quantity > 0 && size.sizeCode !== sizeCode);
    if (keep.length === 0) {
      return prisma.orderItemOperation.delete({ where: { id: row.id } });
    }
    await prisma.$transaction([
      prisma.orderItemOperation.delete({ where: { id: row.id } }),
      ...keep.map((size, index) =>
        prisma.orderItemOperation.create({
          data: {
            orderItemId: row.orderItemId,
            operationId: row.operationId,
            nameSnapshot: row.nameSnapshot,
            calculationMethod: row.calculationMethod,
            unitRate: row.unitRate,
            shiftCost: row.shiftCost,
            standardOutput: row.standardOutput,
            sortOrder: row.sortOrder + index,
            sizeCode: size.sizeCode,
          },
        }),
      ),
    ]);
    return;
  }
  return prisma.orderItemOperation.delete({ where: { id: row.id } });
}

export async function copyOrderItemSizeSpec(input: {
  orderItemId: string;
  fromSizeCode: string;
  toSizeCodes: string[];
}) {
  await assertOrderItemEditable(input.orderItemId);
  const item = await prisma.orderItem.findUniqueOrThrow({
    where: { id: input.orderItemId },
    include: { materials: true, operations: true, sizes: true },
  });
  const targets = input.toSizeCodes.filter((code) => code !== input.fromSizeCode);
  if (targets.length === 0) return;

  const materialApplies = (row: (typeof item.materials)[number], sizeCode: string) =>
    row.sizeCode == null || row.sizeCode === sizeCode;
  const operationApplies = (row: (typeof item.operations)[number], sizeCode: string) =>
    row.sizeCode == null || row.sizeCode === sizeCode;

  await prisma.$transaction(async (tx) => {
    for (const material of item.materials) {
      if (!materialApplies(material, input.fromSizeCode)) continue;
      const specific = item.materials.find(
        (row) =>
          (row.materialId ?? row.nameSnapshot) === (material.materialId ?? material.nameSnapshot) &&
          row.sizeCode === input.fromSizeCode,
      );
      const source = specific ?? material;
      for (const sizeCode of targets) {
        const existing = item.materials.find(
          (row) =>
            (row.materialId ?? row.nameSnapshot) === (source.materialId ?? source.nameSnapshot) &&
            row.sizeCode === sizeCode,
        );
        if (existing) {
          await tx.orderItemMaterial.update({
            where: { id: existing.id },
            data: { consumptionPerUnit: source.consumptionPerUnit },
          });
          continue;
        }
        if (source.sizeCode == null) {
          continue;
        }
        await tx.orderItemMaterial.create({
          data: {
            orderItemId: item.id,
            materialId: source.materialId,
            nameSnapshot: source.nameSnapshot,
            unitCodeSnapshot: source.unitCodeSnapshot,
            consumptionPerUnit: source.consumptionPerUnit,
            wastePercent: source.wastePercent,
            purchasePrice: source.purchasePrice,
            sortOrder: source.sortOrder,
            sizeCode,
          },
        });
      }
    }

    for (const operation of item.operations) {
      if (!operationApplies(operation, input.fromSizeCode) || operation.sizeCode == null) continue;
      for (const sizeCode of targets) {
        const existing = item.operations.find(
          (row) =>
            (row.operationId ?? row.nameSnapshot) === (operation.operationId ?? operation.nameSnapshot) &&
            row.sizeCode === sizeCode,
        );
        if (existing) continue;
        await tx.orderItemOperation.create({
          data: {
            orderItemId: item.id,
            operationId: operation.operationId,
            nameSnapshot: operation.nameSnapshot,
            calculationMethod: operation.calculationMethod,
            unitRate: operation.unitRate,
            shiftCost: operation.shiftCost,
            standardOutput: operation.standardOutput,
            sortOrder: operation.sortOrder,
            sizeCode,
          },
        });
      }
    }
  });
}

export async function addOrderItemDecoration(input: {
  orderItemId: string;
  decorationMethodId: string;
}) {
  await assertOrderItemEditable(input.orderItemId);
  const method = await prisma.decorationMethod.findUniqueOrThrow({
    where: { id: input.decorationMethodId },
  });
  const maxSort = await prisma.orderItemDecoration.aggregate({
    where: { orderItemId: input.orderItemId },
    _max: { sortOrder: true },
  });

  return prisma.orderItemDecoration.create({
    data: {
      orderItemId: input.orderItemId,
      decorationMethodId: method.id,
      nameSnapshot: method.nameUk,
      setupCost: method.setupCost,
      unitRate: method.unitRate,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
}

export async function removeOrderItemDecoration(id: string) {
  await assertOrderItemDecorationEditable(id);
  return prisma.orderItemDecoration.delete({ where: { id } });
}

export async function saveCalculationVersion(input: {
  orderItemId: string;
  authorId: string;
  label?: string | null;
  comment?: string | null;
  proposalRevision?: number | null;
  proposalLabel?: string | null;
  snapshot: Prisma.InputJsonValue;
  totals: {
    costPerUnit: number;
    totalCost: number;
    sellingPricePerUnit: number;
    totalSellingValue: number;
    profitAmount: number;
    marginPercent: number;
  };
}) {
  await assertOrderItemEditable(input.orderItemId);
  const last = await prisma.calculationVersion.findFirst({
    where: { orderItemId: input.orderItemId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });

  const version = await prisma.calculationVersion.create({
    data: {
      orderItemId: input.orderItemId,
      versionNumber: (last?.versionNumber ?? 0) + 1,
      label: input.label || null,
      comment: input.comment || null,
      proposalRevision: input.proposalRevision ?? null,
      proposalLabel: input.proposalLabel ?? null,
      snapshotJson: input.snapshot,
      costPerUnit: input.totals.costPerUnit,
      totalCost: input.totals.totalCost,
      sellingPricePerUnit: input.totals.sellingPricePerUnit,
      totalSellingValue: input.totals.totalSellingValue,
      profitAmount: input.totals.profitAmount,
      marginPercent: input.totals.marginPercent,
      authorId: input.authorId,
    },
  });

  const order = await prisma.order.findFirst({
    where: { items: { some: { id: input.orderItemId } } },
    select: { id: true, status: true },
  });

  await prisma.order.updateMany({
    where: { items: { some: { id: input.orderItemId } }, status: "DRAFT" },
    data: { status: "CALCULATION" },
  });

  if (order) {
    await recordActivity({
      entityType: "order",
      entityId: order.id,
      action: "version_saved",
      userId: input.authorId,
      payload: {
        versionNumber: version.versionNumber,
        label: version.label,
        sellingPricePerUnit: input.totals.sellingPricePerUnit,
      },
    });
  }

  return version;
}

export async function approveVersion(versionId: string, userId?: string) {
  const version = await prisma.calculationVersion.findUniqueOrThrow({
    where: { id: versionId },
  });

  if (version.isApproved) return version;

  const approved = await prisma.$transaction(async (tx) => {
    await tx.calculationVersion.updateMany({
      where: { orderItemId: version.orderItemId, isApproved: true },
      data: { isApproved: false },
    });

    const next = await tx.calculationVersion.update({
      where: { id: versionId },
      data: { isApproved: true },
    });

    const line = await tx.orderItem.findUniqueOrThrow({
      where: { id: version.orderItemId },
      select: { orderId: true },
    });
    const order = await tx.order.findUniqueOrThrow({
      where: { id: line.orderId },
      select: { status: true },
    });

    const locked =
      order.status === "HANDED_TO_PRODUCTION" ||
      order.status === "CLOSED" ||
      order.status === "CANCELLED";

    if (!locked) {
      const siblings = await tx.orderItem.findMany({
        where: { orderId: line.orderId },
        select: {
          id: true,
          versions: { where: { isApproved: true }, select: { id: true }, take: 1 },
        },
      });
      const allApproved = siblings.every((row) =>
        row.id === version.orderItemId ? true : row.versions.length > 0,
      );
      await tx.order.update({
        where: { id: line.orderId },
        data: allApproved
          ? { status: "APPROVED", approvedDate: new Date() }
          : { status: "PENDING_APPROVAL" },
      });
    }

    return next;
  });

  const order = await prisma.order.findFirst({
    where: { items: { some: { id: version.orderItemId } } },
    select: { id: true },
  });
  if (order) {
    await recordActivity({
      entityType: "order",
      entityId: order.id,
      action: "version_approved",
      userId: userId ?? null,
      payload: { versionNumber: approved.versionNumber, versionId: approved.id },
    });
  }

  return approved;
}

async function nextProposalRevision(orderId: string) {
  const agg = await prisma.calculationVersion.aggregate({
    where: { orderItem: { orderId }, proposalRevision: { not: null } },
    _max: { proposalRevision: true },
  });
  return (agg._max.proposalRevision ?? 0) + 1;
}

export async function saveProposal(input: {
  orderId: string;
  authorId: string;
  label?: string | null;
  comment?: string | null;
  lines: Array<{
    orderItemId: string;
    manualSellingPricePerUnit?: number | null;
    discountPercent?: number | null;
  }>;
}) {
  const order = await getOrder(input.orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  assertOrderEditable(order.status);
  if (order.items.length === 0) throw new Error("NO_ITEM");

  const lineMap = new Map(input.lines.map((line) => [line.orderItemId, line]));
  for (const item of order.items) {
    if (!lineMap.has(item.id)) throw new Error("MISSING_LINE");
    if (item.totalQuantity <= 0) throw new Error("NO_QUANTITY");
    if (item.materials.length === 0 || item.operations.length === 0) throw new Error("INCOMPLETE");
  }

  const proposalRevision = await nextProposalRevision(input.orderId);
  const proposalLabel = input.label?.trim() || null;
  const comment = input.comment?.trim() || null;
  const pricing = await getPricingForOrder(input.orderId);

  const created = await prisma.$transaction(async (tx) => {
    const versions = [];
    for (const item of order.items) {
      const line = lineMap.get(item.id)!;
      const manualSellingPricePerUnit =
        line.manualSellingPricePerUnit != null && !Number.isNaN(line.manualSellingPricePerUnit)
          ? line.manualSellingPricePerUnit
          : null;
      const costCalc = buildCalcFromOrderItem(
        item,
        { ...pricing },
        { cutRate: cutRateContextFromProduct(item.product) },
      );

      const commercial = commercialPriceForOrderItem(item, {
        discountPercent: line.discountPercent,
        fallbackPricePerUnit: manualSellingPricePerUnit ?? Number(costCalc.sellingPricePerUnit),
      });

      let sellingPricePerUnit: number;
      let totalSellingValue: number;
      let marginPercent: number;
      let profitAmount: number;

      if (manualSellingPricePerUnit != null) {
        sellingPricePerUnit = manualSellingPricePerUnit;
        totalSellingValue = manualSellingPricePerUnit * item.totalQuantity;
        profitAmount = totalSellingValue - Number(costCalc.totalCost);
        marginPercent =
          totalSellingValue > 0 ? (profitAmount / totalSellingValue) * 100 : 0;
      } else if (commercial) {
        const merged = mergeCommercialAndCost(commercial, costCalc, item.totalQuantity);
        sellingPricePerUnit = merged.sellingPricePerUnit;
        totalSellingValue = merged.totalSellingValue;
        marginPercent = merged.marginPercent;
        profitAmount = totalSellingValue - Number(costCalc.totalCost);
      } else {
        sellingPricePerUnit = Number(costCalc.sellingPricePerUnit);
        totalSellingValue = Number(costCalc.totalSellingValue);
        marginPercent = Number(costCalc.marginPercent);
        profitAmount = Number(costCalc.profitAmount);
      }

      const calc = {
        ...costCalc,
        sellingPricePerUnit: sellingPricePerUnit.toFixed(2),
        totalSellingValue: totalSellingValue.toFixed(2),
        marginPercent: marginPercent.toFixed(2),
        profitAmount: profitAmount.toFixed(2),
      };

      const last = await tx.calculationVersion.findFirst({
        where: { orderItemId: item.id },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });

      const version = await tx.calculationVersion.create({
        data: {
          orderItemId: item.id,
          versionNumber: (last?.versionNumber ?? 0) + 1,
          label: proposalLabel,
          comment,
          proposalRevision,
          proposalLabel,
          snapshotJson: {
            item: {
              nameUk: item.nameUk,
              totalQuantity: item.totalQuantity,
              sizes: item.sizes,
              materials: item.materials,
              operations: item.operations,
              decorations: item.decorations,
              additionalCosts: item.additionalCosts,
            },
            calc,
            pricing,
            commercial: commercial ?? null,
            manualSellingPricePerUnit,
            proposalRevision,
          },
          costPerUnit: Number(costCalc.costPerUnit),
          totalCost: Number(costCalc.totalCost),
          sellingPricePerUnit,
          totalSellingValue,
          profitAmount,
          marginPercent,
          authorId: input.authorId,
        },
      });
      versions.push(version);
    }

    await tx.order.updateMany({
      where: { id: input.orderId, status: "DRAFT" },
      data: { status: "CALCULATION" },
    });

    return versions;
  });

  await recordActivity({
    entityType: "order",
    entityId: input.orderId,
    action: "proposal_saved",
    userId: input.authorId,
    payload: {
      proposalRevision,
      label: proposalLabel,
      lineCount: created.length,
    },
  });

  return { proposalRevision, versions: created };
}

export async function approveProposal(orderId: string, proposalRevision: number, userId?: string) {
  const order = await getOrder(orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const versions = await prisma.calculationVersion.findMany({
    where: {
      proposalRevision,
      orderItem: { orderId },
    },
  });

  const itemIds = new Set(order.items.map((item) => item.id));
  const covered = new Set(versions.map((version) => version.orderItemId));
  if (covered.size !== itemIds.size || [...itemIds].some((id) => !covered.has(id))) {
    throw new Error("INCOMPLETE_PROPOSAL");
  }

  if (versions.every((version) => version.isApproved)) {
    return versions;
  }

  const approved = await prisma.$transaction(async (tx) => {
    await tx.calculationVersion.updateMany({
      where: { orderItem: { orderId }, isApproved: true },
      data: { isApproved: false },
    });

    await tx.calculationVersion.updateMany({
      where: { id: { in: versions.map((version) => version.id) } },
      data: { isApproved: true },
    });

    const orderRow = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true },
    });

    const locked =
      orderRow.status === "HANDED_TO_PRODUCTION" ||
      orderRow.status === "CLOSED" ||
      orderRow.status === "CANCELLED";

    if (!locked) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "APPROVED", approvedDate: new Date() },
      });
    }

    return tx.calculationVersion.findMany({
      where: { id: { in: versions.map((version) => version.id) } },
    });
  });

  await recordActivity({
    entityType: "order",
    entityId: orderId,
    action: "proposal_approved",
    userId: userId ?? null,
    payload: { proposalRevision, versionIds: approved.map((row) => row.id) },
  });

  return approved;
}

export async function handOverToProduction(orderId: string, userId?: string) {
  const order = await getOrder(orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.items.length === 0) throw new Error("NO_ITEM");

  const lines = order.items.map((item) => {
    const approved = item.versions.find((v) => v.isApproved);
    if (!approved) throw new Error("NO_APPROVED_VERSION");
    if (item.totalQuantity <= 0) throw new Error("NO_QUANTITY");
    return { item, approved };
  });

  const needsArtwork = order.items.some((item) => item.decorations.length > 0);
  if (needsArtwork && order.files.length === 0) throw new Error("NO_ARTWORK");

  const updated = await prisma.$transaction(async (tx) => {
    for (const { item, approved } of lines) {
      await tx.productionSpecification.upsert({
        where: { orderItemId: item.id },
        create: {
          orderItemId: item.id,
          calculationVersionId: approved.id,
          snapshotJson: approved.snapshotJson as Prisma.InputJsonValue,
        },
        update: {
          calculationVersionId: approved.id,
          snapshotJson: approved.snapshotJson as Prisma.InputJsonValue,
          lockedAt: new Date(),
        },
      });
    }

    return tx.order.update({
      where: { id: orderId },
      data: { status: "HANDED_TO_PRODUCTION" },
    });
  });

  await recordActivity({
    entityType: "order",
    entityId: orderId,
    action: "handed_to_production",
    userId: userId ?? null,
    payload: { number: order.number, itemCount: lines.length },
  });

  return updated;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, userId?: string) {
  const before = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });
  if (before && before.status !== status) {
    await recordActivity({
      entityType: "order",
      entityId: orderId,
      action: "status_changed",
      userId: userId ?? null,
      payload: {
        from: before.status,
        to: status,
        fromLabel: orderStatusLabel[before.status] ?? before.status,
        toLabel: orderStatusLabel[status] ?? status,
      },
    });
  }
  return updated;
}

export async function cancelOrders(ids: string[], userId?: string) {
  if (ids.length === 0) return { count: 0 };

  const orders = await prisma.order.findMany({
    where: {
      id: { in: ids },
      status: { not: "CANCELLED" },
    },
    select: { id: true, status: true },
  });

  if (orders.length === 0) return { count: 0 };

  await prisma.$transaction(
    orders.map((order) =>
      prisma.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      }),
    ),
  );

  for (const order of orders) {
    await recordActivity({
      entityType: "order",
      entityId: order.id,
      action: "status_changed",
      userId: userId ?? null,
      payload: {
        from: order.status,
        to: "CANCELLED",
        fromLabel: orderStatusLabel[order.status] ?? order.status,
        toLabel: orderStatusLabel.CANCELLED,
      },
    });
  }

  return { count: orders.length };
}

export async function updateOrderTargetMargin(orderId: string, targetMarginPercent: number | null) {
  await assertOrderEditableById(orderId);
  return prisma.order.update({
    where: { id: orderId },
    data: {
      targetMarginPercent:
        targetMarginPercent != null && Number.isFinite(targetMarginPercent)
          ? targetMarginPercent
          : null,
    },
  });
}

export async function addOrderFile(input: {
  orderId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
}) {
  await assertOrderEditableById(input.orderId);
  return prisma.fileAsset.create({
    data: {
      orderId: input.orderId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageKey: input.storageKey,
    },
  });
}

export async function removeOrderFile(id: string) {
  const file = await prisma.fileAsset.findUnique({
    where: { id },
    select: { orderId: true },
  });
  if (!file?.orderId) throw new Error("NOT_FOUND");
  await assertOrderEditableById(file.orderId);
  return prisma.fileAsset.delete({ where: { id } });
}
