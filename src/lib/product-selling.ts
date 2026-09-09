import type { CalculationResult } from "@/server/domains/calculation/engine";
import {
  commercialPriceTiersFromProduct,
  resolveCommercialPricePerUnit,
  type CommercialPriceProduct,
} from "@/lib/commercial-price";
import { isCutOperationName } from "@/lib/cut-rate";
import {
  defaultSewingMultiplierForQty,
  isSewOperationName,
  suggestSellingFromSewingMarkup,
} from "@/lib/sewing-markup";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type ClientPriceSource = "pricelist" | "sewing_markup" | "cost";

export type ResolvedClientPrice = {
  sellingPricePerUnit: number;
  source: ClientPriceSource;
  sewingPerUnit: number;
  sewingMultiplier: number;
};

/** Pick sewing ₴/шт from named «Пошив», else highest non-cut unit rate. */
export function resolveSewingPerUnitFromOperations(
  operations: Array<{
    nameUk?: string | null;
    nameSnapshot?: string | null;
    unitRate?: number | null;
    rateOverride?: number | null;
    baseRate?: number | null;
  }>,
): number {
  if (!operations.length) return 0;

  const rateOf = (row: (typeof operations)[number]) =>
    Number(row.rateOverride ?? row.unitRate ?? row.baseRate ?? 0);

  const sew = operations.find((row) =>
    isSewOperationName(row.nameUk ?? row.nameSnapshot),
  );
  if (sew) return Math.max(0, rateOf(sew));

  const others = operations
    .filter((row) => !isCutOperationName(row.nameUk ?? row.nameSnapshot))
    .map(rateOf)
    .filter((rate) => rate > 0);
  return others.length ? Math.max(...others) : 0;
}

/**
 * Client unit price: saved commercial ladder first, else sewing×tirage markup on cost.
 * Does not add branding (decorations) — caller may layer that for orders.
 */
export function resolveClientUnitPrice(args: {
  quantity: number;
  costPerUnit: number;
  product?: CommercialPriceProduct | null;
  sewingPerUnit: number;
  sewingMultiplier?: number;
}): ResolvedClientPrice {
  const quantity = Math.max(1, Math.floor(args.quantity));
  const costPerUnit = Number.isFinite(args.costPerUnit) ? args.costPerUnit : 0;
  const sewingPerUnit = Math.max(0, args.sewingPerUnit);
  const sewingMultiplier =
    args.sewingMultiplier ?? defaultSewingMultiplierForQty(quantity);

  const tiers = commercialPriceTiersFromProduct(args.product);
  if (tiers.length > 0) {
    const fromList = resolveCommercialPricePerUnit({
      quantity,
      tiers,
      fallbackPrice: null,
    });
    if (fromList != null && fromList > 0) {
      return {
        sellingPricePerUnit: roundMoney(fromList),
        source: "pricelist",
        sewingPerUnit,
        sewingMultiplier,
      };
    }
  }

  if (sewingPerUnit > 0 && sewingMultiplier > 1) {
    return {
      sellingPricePerUnit: suggestSellingFromSewingMarkup({
        costPerUnit,
        sewingPerUnit,
        multiplier: sewingMultiplier,
      }),
      source: "sewing_markup",
      sewingPerUnit,
      sewingMultiplier,
    };
  }

  return {
    sellingPricePerUnit: roundMoney(costPerUnit),
    source: "cost",
    sewingPerUnit,
    sewingMultiplier,
  };
}

export function overlayClientPriceOnCalc(
  costCalc: CalculationResult,
  sellingPricePerUnit: number,
  quantity: number,
): CalculationResult {
  const qty = Math.max(0, Math.floor(quantity));
  const selling = roundMoney(sellingPricePerUnit);
  const totalSellingValue = roundMoney(selling * qty);
  const totalCost = Number(costCalc.totalCost);
  const profitAmount = roundMoney(totalSellingValue - totalCost);
  const marginPercent =
    totalSellingValue > 0 ? roundMoney((profitAmount / totalSellingValue) * 100) : 0;

  return {
    ...costCalc,
    sellingPricePerUnit: selling.toFixed(2),
    totalSellingValue: totalSellingValue.toFixed(2),
    profitAmount: profitAmount.toFixed(2),
    marginPercent: marginPercent.toFixed(2),
  };
}

export function calcWithClientPrice(args: {
  costCalc: CalculationResult;
  quantity: number;
  product?: CommercialPriceProduct | null;
  sewingPerUnit: number;
  sewingMultiplier?: number;
}): { calc: CalculationResult; resolved: ResolvedClientPrice } {
  const resolved = resolveClientUnitPrice({
    quantity: args.quantity,
    costPerUnit: Number(args.costCalc.costPerUnit),
    product: args.product,
    sewingPerUnit: args.sewingPerUnit,
    sewingMultiplier: args.sewingMultiplier,
  });
  return {
    resolved,
    calc: overlayClientPriceOnCalc(args.costCalc, resolved.sellingPricePerUnit, args.quantity),
  };
}
