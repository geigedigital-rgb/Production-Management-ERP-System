import { commercialPriceTiersFromProduct } from "@/lib/commercial-price";
import { buildCommercialOrderLinePrice } from "@/lib/commercial-order-line";
import type { CalculationResult } from "@/server/domains/calculation/engine";
import {
  calcWithClientPrice,
  resolveSewingPerUnitFromOperations,
} from "@/lib/product-selling";

export type OrderItemCommercialInput = {
  totalQuantity: number;
  decorations: Array<{
    setupCost: { toString(): string } | number;
    unitRate: { toString(): string } | number;
  }>;
  operations?: Array<{
    nameSnapshot?: string | null;
    unitRate?: { toString(): string } | number | null;
    calculationMethod?: string;
  }>;
  product?: {
    isBaseModel?: boolean;
    commercialPriceTiers: Array<{ minQuantity: number; pricePerUnit: unknown }>;
  } | null;
};

export function commercialPriceForOrderItem(
  item: OrderItemCommercialInput,
  options?: {
    discountPercent?: number | null;
    fallbackPricePerUnit?: number | null;
  },
) {
  const tiers = commercialPriceTiersFromProduct(item.product);
  if (tiers.length === 0) return null;

  return buildCommercialOrderLinePrice({
    quantity: item.totalQuantity,
    priceTiers: tiers,
    decorations: item.decorations.map((row) => ({
      setupCost: Number(row.setupCost),
      unitRate: Number(row.unitRate),
    })),
    discountPercent: options?.discountPercent,
    fallbackPricePerUnit: options?.fallbackPricePerUnit ?? null,
  });
}

export function mergeCommercialAndCost(
  commercial: NonNullable<ReturnType<typeof buildCommercialOrderLinePrice>>,
  costCalc: CalculationResult,
  quantity: number,
) {
  const costPerUnit = Number(costCalc.costPerUnit);
  const totalCost = costPerUnit * quantity;
  const profitAmount = commercial.totalSellingValue - totalCost;
  const marginPercent =
    commercial.totalSellingValue > 0 ? (profitAmount / commercial.totalSellingValue) * 100 : 0;

  return {
    fromPriceList: commercial.fromPriceList,
    basePricePerUnit: commercial.basePricePerUnit,
    decorationPerUnit: commercial.decorationPerUnit,
    sellingPricePerUnit: commercial.sellingPricePerUnit,
    totalSellingValue: commercial.totalSellingValue,
    costPerUnit,
    marginPercent,
    discountPercent: commercial.discountPercent,
  };
}

export function draftLineFromItem(
  item: OrderItemCommercialInput,
  costCalc: CalculationResult,
  discountPercent?: number | null,
) {
  const commercial = commercialPriceForOrderItem(item, { discountPercent });

  if (commercial?.fromPriceList) {
    const merged = mergeCommercialAndCost(commercial, costCalc, item.totalQuantity);
    return {
      ...merged,
      fromPriceList: true as const,
      priceSource: "pricelist" as const,
    };
  }

  const sewingPerUnit = resolveSewingPerUnitFromOperations(
    (item.operations ?? []).map((row) => ({
      nameSnapshot: row.nameSnapshot,
      unitRate: row.unitRate != null ? Number(row.unitRate) : null,
    })),
  );

  const { calc, resolved } = calcWithClientPrice({
    costCalc,
    quantity: item.totalQuantity,
    product: item.product,
    sewingPerUnit,
  });

  let sellingPricePerUnit = Number(calc.sellingPricePerUnit);
  let totalSellingValue = Number(calc.totalSellingValue);
  let marginPercent = Number(calc.marginPercent);

  if (discountPercent != null && discountPercent > 0 && resolved.source !== "cost") {
    const factor = 1 - Math.min(99, discountPercent) / 100;
    totalSellingValue = Math.round(totalSellingValue * factor * 100) / 100;
    sellingPricePerUnit =
      item.totalQuantity > 0
        ? Math.round((totalSellingValue / item.totalQuantity) * 100) / 100
        : sellingPricePerUnit;
    const profit = totalSellingValue - Number(costCalc.totalCost);
    marginPercent = totalSellingValue > 0 ? (profit / totalSellingValue) * 100 : 0;
  }

  return {
    fromPriceList: resolved.source === "pricelist",
    priceSource: resolved.source,
    basePricePerUnit: sellingPricePerUnit,
    decorationPerUnit: null as number | null,
    sellingPricePerUnit,
    totalSellingValue,
    costPerUnit: Number(costCalc.costPerUnit),
    marginPercent,
    discountPercent: discountPercent ?? 0,
  };
}
