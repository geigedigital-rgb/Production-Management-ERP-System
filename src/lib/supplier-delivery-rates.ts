/**
 * Per-supplier fabric delivery: only configured types (rate filled) are offered on orders.
 */

import {
  FABRIC_DELIVERY_TYPES,
  DEFAULT_FABRIC_DELIVERY_RATES,
  fabricDeliveryTypeLabel,
  normalizeFabricDeliveryType,
  type FabricDeliveryRateGlobals,
  type FabricDeliveryTypeCode,
} from "@/lib/fabric-delivery-types";

export type SupplierDeliveryRates = {
  deliveryType?: FabricDeliveryTypeCode | string | null;
  cargoUsdPerKg?: number | null;
  npStandardUsdPerKg?: number | null;
  npVolumeUsdPerKg?: number | null;
};

export type ConfiguredDeliveryOption = {
  type: FabricDeliveryTypeCode;
  rateUsdPerKg: number;
  label: string;
};

function rateForType(
  rates: SupplierDeliveryRates,
  type: FabricDeliveryTypeCode,
): number | null {
  const raw =
    type === "NP_STANDARD"
      ? rates.npStandardUsdPerKg
      : type === "NP_VOLUME"
        ? rates.npVolumeUsdPerKg
        : rates.cargoUsdPerKg;
  if (raw == null || !Number.isFinite(Number(raw)) || Number(raw) < 0) return null;
  return Number(raw);
}

/** Types with an explicit rate on this supplier offer. */
export function configuredSupplierDeliveryOptions(
  rates: SupplierDeliveryRates,
): ConfiguredDeliveryOption[] {
  return FABRIC_DELIVERY_TYPES.flatMap((type) => {
    const rateUsdPerKg = rateForType(rates, type);
    if (rateUsdPerKg == null) return [];
    return [{ type, rateUsdPerKg, label: fabricDeliveryTypeLabel(type) }];
  });
}

/**
 * Active rate for catalog COGS / order default:
 * preferred deliveryType if configured, else first configured, else company template.
 */
export function resolveSupplierDeliveryRate(
  rates: SupplierDeliveryRates,
  globals: FabricDeliveryRateGlobals,
): { type: FabricDeliveryTypeCode; rateUsdPerKg: number; fromOffer: boolean } {
  const preferred = normalizeFabricDeliveryType(rates.deliveryType);
  const preferredRate = rateForType(rates, preferred);
  if (preferredRate != null) {
    return { type: preferred, rateUsdPerKg: preferredRate, fromOffer: true };
  }
  const configured = configuredSupplierDeliveryOptions(rates);
  if (configured[0]) {
    return {
      type: configured[0].type,
      rateUsdPerKg: configured[0].rateUsdPerKg,
      fromOffer: true,
    };
  }
  const type = preferred;
  const company =
    type === "NP_STANDARD"
      ? globals.npStandardUsdPerKg
      : type === "NP_VOLUME"
        ? globals.npVolumeUsdPerKg
        : globals.fabricCargoUsdPerKg;
  const rateUsdPerKg =
    Number.isFinite(company) && company >= 0
      ? company
      : DEFAULT_FABRIC_DELIVERY_RATES[type];
  return { type, rateUsdPerKg, fromOffer: false };
}

export function supplierRateFieldForType(
  type: FabricDeliveryTypeCode,
): "cargoUsdPerKg" | "npStandardUsdPerKg" | "npVolumeUsdPerKg" {
  switch (type) {
    case "NP_STANDARD":
      return "npStandardUsdPerKg";
    case "NP_VOLUME":
      return "npVolumeUsdPerKg";
    default:
      return "cargoUsdPerKg";
  }
}
