/**
 * Trim / hardware pack quotes → per-consumption-unit cost.
 * Example: pack 1000 pcs for 1500 ₴ → 1,50 ₴/шт.
 *
 * Delivery tariffs (CARGO / НП…) are always $/кг — same as fabric.
 * They are not folded into ₴/од. from the pack quote; optional legacy
 * packDeliveryCostUah still adds a fixed ₴ per pack when set.
 */

import {
  configuredSupplierDeliveryOptions,
  type SupplierDeliveryRates,
} from "@/lib/supplier-delivery-rates";

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

/**
 * @deprecated Typed cargo/np rates are $/кг, not ₴/уп. Always returns null.
 * Use packDeliveryCostUah for fixed pack ₴, or configuredSupplierDeliveryOptions for $/кг.
 */
export function resolveTrimPackDeliveryUah(
  _rates: SupplierDeliveryRates,
): { type: string; rateUah: number } | null {
  return null;
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

/** Derive ₴/од. from pack goods (+ optional legacy packDeliveryCostUah). */
export function deriveTrimUnitPriceFromSupplier(args: {
  unitsPerPack?: number | null;
  purchasePackPrice?: number | null;
  deliveryRates?: SupplierDeliveryRates;
  /** Legacy single pack-delivery field (₴/уп.). */
  packDeliveryCostUah?: number | null;
  fallbackUnitPrice?: number;
}): number {
  void args.deliveryRates;
  return deriveUnitPriceFromPack(
    {
      unitsPerPack: args.unitsPerPack,
      purchasePackPrice: args.purchasePackPrice,
      packDeliveryCostUah: args.packDeliveryCostUah,
    },
    args.fallbackUnitPrice ?? 0,
  );
}

/** Configured $/кг delivery options on a trim/unit supplier offer. */
export function trimConfiguredDeliveryOptions(rates: SupplierDeliveryRates) {
  return configuredSupplierDeliveryOptions(rates).map((opt) => ({
    type: opt.type,
    rateUsdPerKg: opt.rateUsdPerKg,
    /** @deprecated use rateUsdPerKg — kept for older call sites. */
    rateUah: opt.rateUsdPerKg,
    label: opt.label,
  }));
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
