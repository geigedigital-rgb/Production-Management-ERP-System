import type { MaterialCostVatMode } from "@/lib/fabric-pricing";
import { resolveMaterialLinePurchasePrice } from "@/lib/fabric-pricing";

export type FabricMaterialSnapshot = {
  type?: string | null;
  purchasePrice: number;
  metersPerKg?: number | null;
  priceKgUsd?: number | null;
  priceKgUsdCargo?: number | null;
  priceMeterUahNoVat?: number | null;
  priceMeterUahVat?: number | null;
  priceMeterUahCutVat?: number | null;
  metersPerRoll?: number | null;
  minWholesaleMeters?: number | null;
  costVatOverride?: MaterialCostVatMode | null;
};

export type SupplierOfferSnapshot = {
  metersPerKg?: number | null;
  priceKgUsd?: number | null;
  priceKgUsdCargo?: number | null;
  priceKgUsdVat?: number | null;
  priceMeterUahNoVat?: number | null;
  priceMeterUahVat?: number | null;
  priceMeterUahCutVat?: number | null;
  metersPerRoll?: number | null;
  minWholesaleMeters?: number | null;
  cargoUsdPerKg?: number | null;
};

/** Prefer BOM/order supplier; else primary; else first offer. */
export function pickSupplierOffer<T extends { supplierId: string; isPrimary?: boolean }>(
  offers: T[] | null | undefined,
  supplierId?: string | null,
): T | null {
  const list = offers ?? [];
  if (list.length === 0) return null;
  if (supplierId) {
    const match = list.find((row) => row.supplierId === supplierId);
    if (match) return match;
  }
  return list.find((row) => row.isPrimary) ?? list[0] ?? null;
}

/** Merge catalog material with a supplier offer for order-line pricing. */
export function fabricFieldsForOrderLine(
  material: FabricMaterialSnapshot,
  offer?: SupplierOfferSnapshot | null,
): FabricMaterialSnapshot {
  if (!offer) return material;
  return {
    ...material,
    metersPerKg: offer.metersPerKg ?? material.metersPerKg,
    priceKgUsd: offer.priceKgUsd ?? material.priceKgUsd,
    priceKgUsdCargo: offer.priceKgUsdCargo ?? material.priceKgUsdCargo,
    priceMeterUahNoVat: offer.priceMeterUahNoVat ?? material.priceMeterUahNoVat,
    priceMeterUahVat: offer.priceMeterUahVat ?? material.priceMeterUahVat,
    priceMeterUahCutVat: offer.priceMeterUahCutVat ?? material.priceMeterUahCutVat,
    metersPerRoll: offer.metersPerRoll ?? material.metersPerRoll,
    minWholesaleMeters: offer.minWholesaleMeters ?? material.minWholesaleMeters,
  };
}

/**
 * Product BOM / tirage COGS using the selected supplier's terms.
 * `metersNeeded` null → conservative (ціна до опт when cut exists).
 * With meters → cut vs опт by threshold (Прайс і крій / order).
 */
export function resolveBomMaterialPurchasePrice(input: {
  material: {
    type?: string | null;
    purchasePrice: { toString(): string } | number;
    metersPerKg?: { toString(): string } | number | null;
    priceKgUsd?: { toString(): string } | number | null;
    priceKgUsdCargo?: { toString(): string } | number | null;
    priceMeterUahNoVat?: { toString(): string } | number | null;
    priceMeterUahVat?: { toString(): string } | number | null;
    priceMeterUahCutVat?: { toString(): string } | number | null;
    metersPerRoll?: { toString(): string } | number | null;
    minWholesaleMeters?: { toString(): string } | number | null;
    costVatOverride?: MaterialCostVatMode | null;
  };
  offers?: Array<{
    supplierId: string;
    isPrimary?: boolean;
    metersPerKg?: { toString(): string } | number | null;
    priceKgUsd?: { toString(): string } | number | null;
    priceKgUsdCargo?: { toString(): string } | number | null;
    priceKgUsdVat?: { toString(): string } | number | null;
    priceMeterUahNoVat?: { toString(): string } | number | null;
    priceMeterUahVat?: { toString(): string } | number | null;
    priceMeterUahCutVat?: { toString(): string } | number | null;
    metersPerRoll?: { toString(): string } | number | null;
    minWholesaleMeters?: { toString(): string } | number | null;
    cargoUsdPerKg?: { toString(): string } | number | null;
  }> | null;
  supplierId?: string | null;
  companyCostMode: MaterialCostVatMode;
  metersNeeded?: number | null;
}): number {
  const offer = pickSupplierOffer(input.offers, input.supplierId);
  const base = materialToSnapshot(input.material);
  const merged = fabricFieldsForOrderLine(base, offer ? offerToSnapshot(offer) : null);

  let purchaseFallback = base.purchasePrice;
  if (offer) {
    const unit = offerToSnapshot(offer).priceMeterUahNoVat;
    if (input.material.type !== "FABRIC" && unit != null && unit > 0) {
      purchaseFallback = unit;
    } else if (
      input.material.type === "FABRIC" &&
      unit != null &&
      unit > 0 &&
      !(base.purchasePrice > 0)
    ) {
      purchaseFallback = unit;
    }
  }

  return resolveMaterialLinePurchasePrice({
    type: merged.type,
    purchasePrice: purchaseFallback,
    priceMeterUahNoVat: merged.priceMeterUahNoVat,
    priceMeterUahVat: merged.priceMeterUahVat,
    priceMeterUahCutVat: merged.priceMeterUahCutVat,
    metersPerRoll: merged.metersPerRoll,
    minWholesaleMeters: merged.minWholesaleMeters,
    costVatOverride: merged.costVatOverride ?? null,
    companyCostMode: input.companyCostMode,
    metersNeeded: input.metersNeeded,
  }).purchasePrice;
}

export function offerToSnapshot(offer: {
  metersPerKg?: { toString(): string } | number | null;
  priceKgUsd?: { toString(): string } | number | null;
  priceKgUsdCargo?: { toString(): string } | number | null;
  priceKgUsdVat?: { toString(): string } | number | null;
  priceMeterUahNoVat?: { toString(): string } | number | null;
  priceMeterUahVat?: { toString(): string } | number | null;
  priceMeterUahCutVat?: { toString(): string } | number | null;
  metersPerRoll?: { toString(): string } | number | null;
  minWholesaleMeters?: { toString(): string } | number | null;
  cargoUsdPerKg?: { toString(): string } | number | null;
}): SupplierOfferSnapshot {
  const num = (v: { toString(): string } | number | null | undefined) => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    metersPerKg: num(offer.metersPerKg),
    priceKgUsd: num(offer.priceKgUsd),
    priceKgUsdCargo: num(offer.priceKgUsdCargo),
    priceKgUsdVat: num(offer.priceKgUsdVat),
    priceMeterUahNoVat: num(offer.priceMeterUahNoVat),
    priceMeterUahVat: num(offer.priceMeterUahVat),
    priceMeterUahCutVat: num(offer.priceMeterUahCutVat),
    metersPerRoll: num(offer.metersPerRoll),
    minWholesaleMeters: num(offer.minWholesaleMeters),
    cargoUsdPerKg: num(offer.cargoUsdPerKg),
  };
}

export function materialToSnapshot(material: {
  type?: string | null;
  purchasePrice: { toString(): string } | number;
  metersPerKg?: { toString(): string } | number | null;
  priceKgUsd?: { toString(): string } | number | null;
  priceKgUsdCargo?: { toString(): string } | number | null;
  priceMeterUahNoVat?: { toString(): string } | number | null;
  priceMeterUahVat?: { toString(): string } | number | null;
  priceMeterUahCutVat?: { toString(): string } | number | null;
  metersPerRoll?: { toString(): string } | number | null;
  minWholesaleMeters?: { toString(): string } | number | null;
  costVatOverride?: MaterialCostVatMode | null;
}): FabricMaterialSnapshot {
  const num = (v: { toString(): string } | number | null | undefined) => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    type: material.type,
    purchasePrice: Number(material.purchasePrice),
    metersPerKg: num(material.metersPerKg),
    priceKgUsd: num(material.priceKgUsd),
    priceKgUsdCargo: num(material.priceKgUsdCargo),
    priceMeterUahNoVat: num(material.priceMeterUahNoVat),
    priceMeterUahVat: num(material.priceMeterUahVat),
    priceMeterUahCutVat: num(material.priceMeterUahCutVat),
    metersPerRoll: num(material.metersPerRoll),
    minWholesaleMeters: num(material.minWholesaleMeters),
    costVatOverride: material.costVatOverride,
  };
}
