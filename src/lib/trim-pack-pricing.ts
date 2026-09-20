/**
 * Trim / hardware pack quotes → per-consumption-unit cost.
 * Example: pack 1000 pcs for 1500 ₴ + CARGO delivery 200 ₴ → 1,70 ₴/шт.
 *
 * Pack delivery uses the same type codes as fabric (CARGO / НП…),
 * but rates are ₴ per pack (stored on MaterialSupplier cargo/np fields).
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

/** Active pack-delivery ₴ from typed supplier rates (only filled types count). */
export function resolveTrimPackDeliveryUah(
  rates: SupplierDeliveryRates,
): { type: string; rateUah: number } | null {
  const configured = configuredSupplierDeliveryOptions(rates);
  if (configured.length === 0) return null;
  const preferred =
    configured.find((opt) => opt.type === rates.deliveryType) ?? configured[0]!;
  return { type: preferred.type, rateUah: preferred.rateUsdPerKg };
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

/** Derive ₴/од. from pack goods + typed delivery rates on the supplier offer. */
export function deriveTrimUnitPriceFromSupplier(args: {
  unitsPerPack?: number | null;
  purchasePackPrice?: number | null;
  deliveryRates: SupplierDeliveryRates;
  /** Legacy single pack-delivery field. */
  packDeliveryCostUah?: number | null;
  fallbackUnitPrice?: number;
}): number {
  const typed = resolveTrimPackDeliveryUah(args.deliveryRates);
  const deliveryUah =
    typed?.rateUah ??
    (args.packDeliveryCostUah != null && Number(args.packDeliveryCostUah) >= 0
      ? Number(args.packDeliveryCostUah)
      : null);
  return deriveUnitPriceFromPack(
    {
      unitsPerPack: args.unitsPerPack,
      purchasePackPrice: args.purchasePackPrice,
      packDeliveryCostUah: deliveryUah,
    },
    args.fallbackUnitPrice ?? 0,
  );
}

export function trimConfiguredDeliveryOptions(rates: SupplierDeliveryRates) {
  return configuredSupplierDeliveryOptions(rates).map((opt) => ({
    type: opt.type,
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
