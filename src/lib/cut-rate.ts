/**
 * Owner rule (CRM sheet comment 1):
 * Cut cost per unit decreases as run size grows until optimalQty.
 * Above optimalQty the per-unit cut rate stays frozen at the optimal-run rate.
 * Prefer this logic over copying every Google Sheet cell blindly.
 */

export type CutRateTier = {
  minQuantity: number;
  ratePerUnit: number;
};

export function resolveCutRatePerUnit(args: {
  quantity: number;
  optimalQty?: number | null;
  tiers: CutRateTier[];
  fallbackRate: number;
}): number {
  const qty = Math.max(0, Math.floor(args.quantity));
  if (qty <= 0) return args.fallbackRate;

  const tiers = [...args.tiers]
    .filter((tier) => tier.minQuantity > 0 && Number.isFinite(tier.ratePerUnit))
    .sort((a, b) => a.minQuantity - b.minQuantity);

  if (tiers.length === 0) return args.fallbackRate;

  const optimal =
    args.optimalQty != null && args.optimalQty > 0 ? Math.floor(args.optimalQty) : null;
  const effectiveQty = optimal != null && qty > optimal ? optimal : qty;

  let rate = args.fallbackRate;
  for (const tier of tiers) {
    if (tier.minQuantity <= effectiveQty) rate = tier.ratePerUnit;
    else break;
  }
  return rate;
}

export function isCutOperationName(nameUk: string | null | undefined) {
  return (nameUk ?? "").trim().toLowerCase() === "розкрій";
}

export const CUT_OPERATION_METHOD_LABEL = "Крій за тиражем";
export const CUT_RATES_TAB_HINT = "Налаштування — вкладка «Прайс і крій»";

/** How to show «Розкрій» in BOM tables — rate comes from cut tiers, not catalog baseRate. */
export function summarizeCutOperationDisplay(args: {
  optimalQty?: number | null;
  tiers: CutRateTier[];
  fallbackRate: number;
  previewQty?: number;
}): {
  methodLabel: string;
  configured: boolean;
  minRate: number | null;
  maxRate: number | null;
  previewQty: number;
  previewRate: number | null;
} {
  const previewQty = args.previewQty ?? 100;
  const tiers = [...args.tiers]
    .filter((tier) => tier.minQuantity > 0 && Number.isFinite(tier.ratePerUnit))
    .sort((a, b) => a.minQuantity - b.minQuantity);

  if (tiers.length === 0) {
    return {
      methodLabel: CUT_OPERATION_METHOD_LABEL,
      configured: false,
      minRate: null,
      maxRate: null,
      previewQty,
      previewRate: null,
    };
  }

  const rates = tiers.map((tier) => tier.ratePerUnit);
  return {
    methodLabel: CUT_OPERATION_METHOD_LABEL,
    configured: true,
    minRate: Math.min(...rates),
    maxRate: Math.max(...rates),
    previewQty,
    previewRate: resolveCutRatePerUnit({
      quantity: previewQty,
      optimalQty: args.optimalQty,
      tiers,
      fallbackRate: args.fallbackRate,
    }),
  };
}

export type CutRateProduct = {
  optimalQty: number | null;
  cutRateTiers: Array<{ minQuantity: number; ratePerUnit: unknown }>;
};

export function resolveCutUnitRateForProduct(
  product: CutRateProduct,
  quantity: number,
  fallbackRate: number,
): number {
  return resolveCutRatePerUnit({
    quantity,
    optimalQty: product.optimalQty,
    tiers: product.cutRateTiers.map((tier) => ({
      minQuantity: tier.minQuantity,
      ratePerUnit: Number(tier.ratePerUnit),
    })),
    fallbackRate,
  });
}
