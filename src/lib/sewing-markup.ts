/**
 * Owner rule: commercial uplift is tied to sewing labor × tirage multiplier,
 * not a % of total product cost (fabric must not inflate selling proportionally).
 *
 * Suggested client price = costPerUnit + sewingPerUnit × (multiplier − 1)
 * i.e. replace sewing cost with sewing × multiplier, keep materials/cut/other.
 */

export function isSewOperationName(nameUk: string | null | undefined) {
  const name = (nameUk ?? "").trim().toLowerCase();
  return name === "пошив" || name.startsWith("пошив ");
}

export function suggestSellingFromSewingMarkup(args: {
  costPerUnit: number;
  sewingPerUnit: number;
  multiplier: number;
}): number {
  const cost = Number.isFinite(args.costPerUnit) ? args.costPerUnit : 0;
  const sewing = Number.isFinite(args.sewingPerUnit) ? Math.max(0, args.sewingPerUnit) : 0;
  const mult = Number.isFinite(args.multiplier) ? Math.max(0, args.multiplier) : 1;
  const suggested = cost + sewing * (mult - 1);
  return Math.round(Math.max(0, suggested) * 100) / 100;
}

export function markupAmountFromSewing(sewingPerUnit: number, multiplier: number): number {
  const sewing = Number.isFinite(sewingPerUnit) ? Math.max(0, sewingPerUnit) : 0;
  const mult = Number.isFinite(multiplier) ? Math.max(0, multiplier) : 1;
  return Math.round(sewing * mult * 100) / 100;
}

/** Default / shared tirage ladder for cut rates and commercial price (same steps). */
export const SHARED_PRODUCT_TIRAGE_QTYS = [10, 20, 30, 50, 60, 100, 150, 200, 250] as const;

/** Default tirage ladder for base commercial price lists. */
export const DEFAULT_PRICE_TIRAGE_QTYS = [30, 60, 100, 150, 200] as const;

/** Larger run → lower sewing markup (owner examples: ×7 / ×5 / ×4). */
export function defaultSewingMultiplierForQty(qty: number): number {
  const n = Math.max(0, Math.floor(qty));
  if (n <= 30) return 7;
  if (n <= 60) return 6;
  if (n <= 100) return 5;
  if (n <= 150) return 4.5;
  return 4;
}
