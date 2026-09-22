/** Fabric shipping tariff presets: кг × $/кг × курс → ₴. */

export const FABRIC_DELIVERY_TYPES = ["CARGO", "NP_STANDARD", "NP_VOLUME"] as const;

export type FabricDeliveryTypeCode = (typeof FABRIC_DELIVERY_TYPES)[number];

export const DEFAULT_FABRIC_DELIVERY_RATES: Record<FabricDeliveryTypeCode, number> = {
  CARGO: 1.7,
  NP_STANDARD: 0.4,
  NP_VOLUME: 0.8,
};

export type FabricDeliveryRateGlobals = {
  fabricCargoUsdPerKg: number;
  npStandardUsdPerKg: number;
  npVolumeUsdPerKg: number;
};

export function isFabricDeliveryType(value: unknown): value is FabricDeliveryTypeCode {
  return (
    typeof value === "string" &&
    (FABRIC_DELIVERY_TYPES as readonly string[]).includes(value)
  );
}

export function normalizeFabricDeliveryType(
  value: unknown,
): FabricDeliveryTypeCode {
  return isFabricDeliveryType(value) ? value : "CARGO";
}

export function fabricDeliveryTypeLabel(type: FabricDeliveryTypeCode): string {
  switch (type) {
    case "NP_STANDARD":
      return "НП стандарт";
    case "NP_VOLUME":
      return "НП обʼємні";
    default:
      return "CARGO";
  }
}

/** Unit next to the rate field: fabric $/кг, trim packs ₴/уп. */
export function deliveryRateUnitLabel(
  _type: FabricDeliveryTypeCode | string | null | undefined,
  mode: "fabric" | "trim" = "fabric",
): string {
  return mode === "trim" ? "₴/уп." : "$/кг";
}

export function deliveryRateUsdPerKg(
  type: FabricDeliveryTypeCode | string | null | undefined,
  globals: FabricDeliveryRateGlobals,
): number {
  const code = normalizeFabricDeliveryType(type);
  switch (code) {
    case "NP_STANDARD":
      return Number.isFinite(globals.npStandardUsdPerKg) && globals.npStandardUsdPerKg >= 0
        ? globals.npStandardUsdPerKg
        : DEFAULT_FABRIC_DELIVERY_RATES.NP_STANDARD;
    case "NP_VOLUME":
      return Number.isFinite(globals.npVolumeUsdPerKg) && globals.npVolumeUsdPerKg >= 0
        ? globals.npVolumeUsdPerKg
        : DEFAULT_FABRIC_DELIVERY_RATES.NP_VOLUME;
    default:
      return Number.isFinite(globals.fabricCargoUsdPerKg) && globals.fabricCargoUsdPerKg >= 0
        ? globals.fabricCargoUsdPerKg
        : DEFAULT_FABRIC_DELIVERY_RATES.CARGO;
  }
}

/** Map rate edit back onto the PricingSettings column for the selected type. */
export function pricingSettingsRatePatch(
  type: FabricDeliveryTypeCode,
  rateUsdPerKg: number,
): Partial<FabricDeliveryRateGlobals> {
  switch (type) {
    case "NP_STANDARD":
      return { npStandardUsdPerKg: rateUsdPerKg };
    case "NP_VOLUME":
      return { npVolumeUsdPerKg: rateUsdPerKg };
    default:
      return { fabricCargoUsdPerKg: rateUsdPerKg };
  }
}
