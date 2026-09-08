import { commercialPriceTiersFromProduct } from "@/lib/commercial-price";
import { buildCommercialOrderLinePrice } from "@/lib/commercial-order-line";
import type { CalculationResult } from "@/server/domains/calculation/engine";

export type OrderItemCommercialInput = {
  totalQuantity: number;
  decorations: Array<{
    setupCost: { toString(): string } | number;
    unitRate: { toString(): string } | number;
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
  // Commercial layer applies only when the product has a fixed price ladder.
  // Cost-calc selling already includes decorations in COGS — do not add them again.
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
      fromPriceList: true,
    };
  }

  return {
    fromPriceList: false,
    basePricePerUnit: null as number | null,
    decorationPerUnit: null as number | null,
    sellingPricePerUnit: Number(costCalc.sellingPricePerUnit),
    totalSellingValue: Number(costCalc.totalSellingValue),
    costPerUnit: Number(costCalc.costPerUnit),
    marginPercent: Number(costCalc.marginPercent),
    discountPercent: 0,
  };
}
