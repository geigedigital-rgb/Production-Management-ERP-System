/**
 * Shared quantity ladders for operations (and cut-like pricing).
 * Rate applies when qty >= minQuantity until the next higher tier.
 */

export const DEFAULT_OPERATION_QTY_TIERS = [30, 50, 100, 150, 200, 250] as const;

export type QuantityRateTier = {
  minQuantity: number;
  ratePerUnit: number;
};

export function defaultOperationRateTiers(fallbackRate = 0): QuantityRateTier[] {
  return DEFAULT_OPERATION_QTY_TIERS.map((minQuantity) => ({
    minQuantity,
    ratePerUnit: fallbackRate,
  }));
}

export function resolveQuantityTierRate(args: {
  quantity: number;
  tiers: QuantityRateTier[];
  fallbackRate: number;
}): number {
  const qty = Math.max(0, Math.floor(args.quantity));
  if (qty <= 0) return args.fallbackRate;

  const tiers = [...args.tiers]
    .filter((tier) => tier.minQuantity > 0 && Number.isFinite(tier.ratePerUnit))
    .sort((a, b) => a.minQuantity - b.minQuantity);

  if (tiers.length === 0) return args.fallbackRate;

  // Below the first configured rung: use that rung (small runs are not "free").
  // Previously fallbackRate (often 0) applied until minQuantity, which made ops
  // jump when crossing the first tier (e.g. 20 → 30).
  if (qty < tiers[0]!.minQuantity) {
    return tiers[0]!.ratePerUnit;
  }

  let rate = tiers[0]!.ratePerUnit;
  for (const tier of tiers) {
    if (tier.minQuantity <= qty) rate = tier.ratePerUnit;
    else break;
  }
  return rate;
}

export function mapDbRateTiers(
  rows: Array<{ minQuantity: number; ratePerUnit: unknown }> | null | undefined,
): QuantityRateTier[] {
  if (!rows?.length) return [];
  return rows.map((tier) => ({
    minQuantity: tier.minQuantity,
    ratePerUnit: Number(tier.ratePerUnit),
  }));
}

/** Prefer product override tiers; else catalog tiers; else empty (caller uses fallbackRate). */
export function pickOperationQuantityTiers(
  productTiers: Array<{ minQuantity: number; ratePerUnit: unknown }> | null | undefined,
  catalogTiers: Array<{ minQuantity: number; ratePerUnit: unknown }> | null | undefined,
): QuantityRateTier[] {
  const product = mapDbRateTiers(productTiers);
  if (product.length > 0) return product;
  return mapDbRateTiers(catalogTiers);
}

export function parseRateTiersInput(
  raw: unknown,
  fallbackRate = 0,
): QuantityRateTier[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return defaultOperationRateTiers(fallbackRate);
  }
  const tiers: QuantityRateTier[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const minQuantity = Number((row as { minQuantity?: unknown }).minQuantity);
    const ratePerUnit = Number((row as { ratePerUnit?: unknown }).ratePerUnit);
    if (!Number.isFinite(minQuantity) || minQuantity <= 0) continue;
    if (!Number.isFinite(ratePerUnit) || ratePerUnit < 0) continue;
    tiers.push({ minQuantity: Math.floor(minQuantity), ratePerUnit });
  }
  if (tiers.length === 0) return defaultOperationRateTiers(fallbackRate);
  const byMin = new Map<number, number>();
  for (const tier of tiers) byMin.set(tier.minQuantity, tier.ratePerUnit);
  return [...byMin.entries()]
    .map(([minQuantity, ratePerUnit]) => ({ minQuantity, ratePerUnit }))
    .sort((a, b) => a.minQuantity - b.minQuantity);
}

/** Hardware/material delivery ops priced by tirage (not fabric cargo $/kg). */
export function isDeliveryOperationName(nameUk: string | null | undefined) {
  return /доставк/i.test(String(nameUk ?? "").trim());
}
