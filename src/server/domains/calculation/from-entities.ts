import { prisma } from "@/server/db/client";
import {
  calculateCosting,
  type CalculationInput,
  type CalculationResult,
  type MaterialLineInput,
  type OperationLineInput,
} from "@/server/domains/calculation/engine";
import type { getProduct } from "@/server/domains/products/service";
import {
  consumptionForSize,
  effectiveSizeCodes,
  sizeCodesFromScopes,
  sizeConsumptionFromNorms,
} from "@/lib/size-bom";
import {
  type CutRateTier,
  isCutOperationName,
  resolveCutRatePerUnit,
  resolveCutUnitRateForProduct,
  type CutRateProduct,
} from "@/lib/cut-rate";

export type CutRateContext = {
  optimalQty: number | null;
  tiers: CutRateTier[];
};

export function cutRateContextFromProduct(
  product: CutRateProduct | null | undefined,
): CutRateContext | null {
  if (!product?.cutRateTiers?.length) return null;
  return {
    optimalQty: product.optimalQty,
    tiers: product.cutRateTiers.map((tier) => ({
      minQuantity: tier.minQuantity,
      ratePerUnit: Number(tier.ratePerUnit),
    })),
  };
}

function orderItemTotalQuantity(item: OrderItemForCalc): number {
  return item.sizes.reduce((sum, row) => sum + row.quantity, 0);
}

export function resolveOrderOperationUnitRate(
  row: OrderItemForCalc["operations"][number],
  totalQuantity: number,
  cutRate: CutRateContext | null | undefined,
): number | null {
  const stored = row.unitRate != null ? Number(row.unitRate) : null;
  if (!isCutOperationName(row.nameSnapshot) || !cutRate?.tiers.length) {
    return stored;
  }
  return resolveCutRatePerUnit({
    quantity: totalQuantity,
    optimalQty: cutRate.optimalQty,
    tiers: cutRate.tiers,
    fallbackRate: stored ?? 0,
  });
}

type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

export async function getPricingDefaults() {
  const pricing = await prisma.pricingSettings.findFirst();
  return {
    pricingMethod: (pricing?.pricingMethod ?? "MARGIN") as "MARGIN" | "MARKUP",
    targetRatePercent: Number(pricing?.targetMarginPercent ?? 30),
    minimumMarginPercent: Number(pricing?.minimumMarginPercent ?? 15),
    roundingDecimals: 2,
  };
}

/** Project defaults with optional order-level target margin override. */
export async function getPricingForOrder(orderId?: string | null) {
  const defaults = await getPricingDefaults();
  if (!orderId) return { ...defaults, isOrderOverride: false };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { targetMarginPercent: true },
  });

  if (order?.targetMarginPercent == null) {
    return { ...defaults, isOrderOverride: false };
  }

  return {
    ...defaults,
    targetRatePercent: Number(order.targetMarginPercent),
    isOrderOverride: true,
  };
}

export function buildCalcFromProduct(
  product: ProductDetail,
  quantity: number,
  pricing: { pricingMethod: "MARGIN" | "MARKUP"; targetRatePercent: number },
): CalculationResult {
  const sizes =
    product.sizes.length > 0
      ? product.sizes.map((row) => ({
          sizeCode: row.size.code,
          quantity: 0,
          materialCoeff: 1,
          operationCoeff: 1,
        }))
      : [{ sizeCode: "ONE", quantity: 0, materialCoeff: 1, operationCoeff: 1 }];

  const base = Math.floor(quantity / sizes.length);
  let remainder = quantity - base * sizes.length;
  for (const size of sizes) {
    size.quantity = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }

  const sizeCodes =
    product.sizes.length > 0 ? product.sizes.map((row) => row.size.code) : ["ONE"];

  const input: CalculationInput = {
    sizes,
    materials: product.materials.flatMap((row): MaterialLineInput[] => {
      const waste = Number(row.wastePercent ?? row.material.defaultWastePercent);
      const price = Number(row.material.purchasePrice);
      const applies = effectiveSizeCodes(sizeCodesFromScopes(row.sizeScopes), sizeCodes);
      const sizeConsumption = sizeConsumptionFromNorms(row.sizeNorms);
      const consumptions = applies.map((code) =>
        consumptionForSize(Number(row.consumptionPerUnit), sizeConsumption, code),
      );
      const shared = applies.length === sizeCodes.length && consumptions.every((value) => value === consumptions[0]);
      if (shared) {
        return [
          {
            id: row.id,
            groupKey: row.materialId,
            sizeCode: null,
            consumptionPerUnit: consumptions[0] ?? Number(row.consumptionPerUnit),
            wastePercent: waste,
            purchasePrice: price,
            applySizeCoeff: true,
          },
        ];
      }
      return applies.map((code, index) => ({
        id: `${row.id}:${code}`,
        groupKey: row.materialId,
        sizeCode: code,
        consumptionPerUnit: consumptions[index]!,
        wastePercent: waste,
        purchasePrice: price,
        applySizeCoeff: true,
      }));
    }),
    operations: product.operations.flatMap((row): OperationLineInput[] => {
      const applies = effectiveSizeCodes(sizeCodesFromScopes(row.sizeScopes), sizeCodes);
      const fallbackRate =
        row.rateOverride != null
          ? Number(row.rateOverride)
          : row.operation.baseRate != null
            ? Number(row.operation.baseRate)
            : null;
      const unitRate = isCutOperationName(row.operation.nameUk)
        ? resolveCutUnitRateForProduct(product, quantity, fallbackRate ?? 0)
        : fallbackRate;
      const payload = {
        method: row.operation.calculationMethod as "UNIT_RATE" | "SHIFT_OUTPUT" | "QUANTITY_TIER",
        unitRate,
        shiftCost: row.operation.shiftCost != null ? Number(row.operation.shiftCost) : null,
        standardOutput:
          row.standardOverride != null
            ? Number(row.standardOverride)
            : row.operation.standardOutputPerShift != null
              ? Number(row.operation.standardOutputPerShift)
              : null,
        applySizeCoeff: true as const,
      };
      if (applies.length === sizeCodes.length) {
        return [{ id: row.id, groupKey: row.operationId, sizeCode: null, ...payload }];
      }
      return applies.map((code) => ({
        id: `${row.id}:${code}`,
        groupKey: row.operationId,
        sizeCode: code,
        ...payload,
      }));
    }),
    decorations: product.decorations.map((row) => ({
      id: row.id,
      setupCost: Number(row.decorationMethod.setupCost),
      unitRate: Number(row.decorationMethod.unitRate),
    })),
    additionalCosts: product.additionalCosts.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      isPerUnit: row.isPerUnit,
    })),
    pricingMethod: pricing.pricingMethod,
    targetRatePercent: pricing.targetRatePercent,
  };

  return calculateCosting(input);
}

export type OrderItemForCalc = {
  sizes: Array<{ sizeCode: string; quantity: number }>;
  materials: Array<{
    id: string;
    materialId?: string | null;
    nameSnapshot?: string;
    sizeCode?: string | null;
    consumptionPerUnit: { toString(): string } | number;
    wastePercent: { toString(): string } | number;
    purchasePrice: { toString(): string } | number;
  }>;
  operations: Array<{
    id: string;
    operationId?: string | null;
    nameSnapshot?: string;
    sizeCode?: string | null;
    calculationMethod: "UNIT_RATE" | "SHIFT_OUTPUT" | "QUANTITY_TIER";
    unitRate: { toString(): string } | number | null;
    shiftCost: { toString(): string } | number | null;
    standardOutput: { toString(): string } | number | null;
  }>;
  decorations: Array<{
    id: string;
    setupCost: { toString(): string } | number;
    unitRate: { toString(): string } | number;
  }>;
  additionalCosts: Array<{
    id: string;
    amount: { toString(): string } | number;
    isPerUnit: boolean;
  }>;
  fabricDeliveryAmount?: number | { toString(): string } | null;
};

export function buildCalcFromOrderItem(
  item: OrderItemForCalc,
  pricing: {
    pricingMethod: "MARGIN" | "MARKUP";
    targetRatePercent: number;
    manualSellingPricePerUnit?: number | null;
  },
  options?: { cutRate?: CutRateContext | null },
): CalculationResult {
  const totalQuantity = orderItemTotalQuantity(item);
  const fabricDelivery = Number(item.fabricDeliveryAmount ?? 0);
  const additionalCosts = [
    ...item.additionalCosts.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      isPerUnit: row.isPerUnit,
    })),
    ...(fabricDelivery > 0
      ? [{ id: "fabric-delivery", amount: fabricDelivery, isPerUnit: false }]
      : []),
  ];

  return calculateCosting({
    sizes: item.sizes.map((s) => ({
      sizeCode: s.sizeCode,
      quantity: s.quantity,
      materialCoeff: 1,
      operationCoeff: 1,
    })),
    materials: item.materials.map((row) => ({
      id: row.id,
      groupKey: row.materialId ?? row.nameSnapshot ?? row.id,
      sizeCode: row.sizeCode ?? null,
      consumptionPerUnit: Number(row.consumptionPerUnit),
      wastePercent: Number(row.wastePercent),
      purchasePrice: Number(row.purchasePrice),
      applySizeCoeff: true,
    })),
    operations: item.operations.map((row) => ({
      id: row.id,
      groupKey: row.operationId ?? row.nameSnapshot ?? row.id,
      sizeCode: row.sizeCode ?? null,
      method: row.calculationMethod,
      unitRate: resolveOrderOperationUnitRate(row, totalQuantity, options?.cutRate),
      shiftCost: row.shiftCost != null ? Number(row.shiftCost) : null,
      standardOutput: row.standardOutput != null ? Number(row.standardOutput) : null,
      applySizeCoeff: true,
    })),
    decorations: item.decorations.map((row) => ({
      id: row.id,
      setupCost: Number(row.setupCost),
      unitRate: Number(row.unitRate),
    })),
    additionalCosts,
    pricingMethod: pricing.pricingMethod,
    targetRatePercent: pricing.targetRatePercent,
    manualSellingPricePerUnit: pricing.manualSellingPricePerUnit,
  });
}
