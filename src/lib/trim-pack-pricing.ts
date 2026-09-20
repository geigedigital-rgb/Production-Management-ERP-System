/**
 * Trim / hardware pack quotes → per-consumption-unit cost.
 * Example: pack 1000 pcs for 1500 ₴ + delivery 200 ₴ → 1,70 ₴/шт.
 */

export type TrimPackQuote = {
  unitsPerPack?: number | null;
  purchasePackPrice?: number | null;
  packDeliveryCostUah?: number | null;
};

export function hasTrimPackQuote(quote: TrimPackQuote): boolean {
  const n = Math.floor(Number(quote.unitsPerPack) || 0);
  const pack = Number(quote.purchasePackPrice);
  return n > 0 && Number.isFinite(pack) && pack >= 0;
}

/** Active calc price ₴ / consumption unit (шт, м.п., …). */
export function deriveUnitPriceFromPack(
  quote: TrimPackQuote,
  fallbackUnitPrice = 0,
): number {
  if (!hasTrimPackQuote(quote)) {
    const fallback = Number(fallbackUnitPrice);
    return Number.isFinite(fallback) && fallback >= 0 ? fallback : 0;
  }
  const n = Math.floor(Number(quote.unitsPerPack));
  const pack = Number(quote.purchasePackPrice);
  const delivery = Math.max(0, Number(quote.packDeliveryCostUah) || 0);
  return Math.round(((pack + delivery) / n) * 10000) / 10000;
}

/** Whole packs to buy for a production need (ceil). */
export function packsToOrder(unitsNeeded: number, unitsPerPack: number | null | undefined): number {
  const n = Math.floor(Number(unitsPerPack) || 0);
  const need = Number(unitsNeeded);
  if (!(n > 0) || !(need > 0) || !Number.isFinite(need)) return 0;
  return Math.ceil(need / n);
}

export function trimPackSpend(args: {
  packs: number;
  purchasePackPrice?: number | null;
  packDeliveryCostUah?: number | null;
}) {
  const packs = Math.max(0, Math.floor(args.packs) || 0);
  const goods = Math.max(0, Number(args.purchasePackPrice) || 0) * packs;
  const delivery = Math.max(0, Number(args.packDeliveryCostUah) || 0) * packs;
  return {
    goods: Math.round(goods * 100) / 100,
    delivery: Math.round(delivery * 100) / 100,
    total: Math.round((goods + delivery) * 100) / 100,
  };
}
