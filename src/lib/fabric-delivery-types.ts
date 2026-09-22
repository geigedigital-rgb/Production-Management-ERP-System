/** Delivery tariffs: weight-based ($/кг) vs volumetric (₴/м³). */

export const FABRIC_DELIVERY_TYPES = ["CARGO", "NP_STANDARD", "NP_VOLUME"] as const;

export type FabricDeliveryTypeCode = (typeof FABRIC_DELIVERY_TYPES)[number];

/**
 * Soft-goods bulk density: кг тканини ≈ цей обʼєм у м³ для тарифу «НП обʼємні».
 * (кг / щільність = м³; доставка = м³ × ₴/м³)
 */
export const FABRIC_BULK_DENSITY_KG_PER_M3 = 150;

export const DEFAULT_FABRIC_DELIVERY_RATES: Record<FabricDeliveryTypeCode, number> = {
  CARGO: 1.7,
  NP_STANDARD: 0.4,
  /** ₴/м³ (не $/кг). */
  NP_VOLUME: 2500,
};

export type FabricDeliveryRateGlobals = {
  fabricCargoUsdPerKg: number;
  npStandardUsdPerKg: number;
  /** Volumetric NP tariff in ₴/м³ (field name is legacy). */
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

export function isVolumeDeliveryType(
  type: FabricDeliveryTypeCode | string | null | undefined,
): boolean {
  return normalizeFabricDeliveryType(type) === "NP_VOLUME";
}

/** Weight-based tariffs that use $/кг × кг × курс. */
export function isWeightDeliveryType(
  type: FabricDeliveryTypeCode | string | null | undefined,
): boolean {
  return !isVolumeDeliveryType(type);
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

/**
 * Unit shown next to the rate field.
 * Trim packs always ₴/уп.; fabric NP volume is ₴/м³; CARGO / НП стандарт — $/кг.
 */
export function deliveryRateUnitLabel(
  type: FabricDeliveryTypeCode | string | null | undefined,
  mode: "fabric" | "trim" = "fabric",
): string {
  if (mode === "trim") return "₴/уп.";
  if (isVolumeDeliveryType(type)) return "₴/м³";
  return "$/кг";
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

/** м³ ≈ кг / насипна щільність. */
export function fabricKgToVolumeM3(
  kg: number,
  bulkKgPerM3: number = FABRIC_BULK_DENSITY_KG_PER_M3,
): number {
  if (!(kg > 0) || !(bulkKgPerM3 > 0)) return 0;
  return kg / bulkKgPerM3;
}

/** ₴ доставки за м.п. з тарифу ₴/м³. */
export function volumeDeliveryPerMeterUah(
  rateUahPerM3: number,
  metersPerKg: number,
  bulkKgPerM3: number = FABRIC_BULK_DENSITY_KG_PER_M3,
): number | null {
  if (!(rateUahPerM3 >= 0) || !(metersPerKg > 0) || !(bulkKgPerM3 > 0)) return null;
  return Math.round((rateUahPerM3 / (metersPerKg * bulkKgPerM3)) * 10) / 10;
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
