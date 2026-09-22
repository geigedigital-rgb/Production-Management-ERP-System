import {
  fabricMetersNeeded,
  resolveCargoUsdPerKg,
  type FabricPricingGlobals,
} from "@/lib/fabric-pricing";
import {
  deliveryRateUsdPerKg,
  fabricKgToVolumeM3,
  isVolumeDeliveryType,
} from "@/lib/fabric-delivery-types";

export type FabricDeliveryMaterialSource = {
  type?: string | null;
  metersPerKg?: number | null;
  priceKgUsd?: number | null;
  priceKgUsdCargo?: number | null;
  /** Explicit rate override: $/кг (weight) or ₴/м³ (NP_VOLUME). */
  cargoUsdPerKg?: number | null;
  /** Material / line delivery type — used when cargoUsdPerKg is unset. */
  deliveryType?: string | null;
  /** Explicit USD/UAH rate override for this line (weight tariffs only). */
  usdUahRate?: number | null;
  consumptionPerUnit: number;
  wastePercent: number;
  sizeCode?: string | null;
};

function num(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function resolveLineRate(
  row: Pick<
    FabricDeliveryMaterialSource,
    "priceKgUsd" | "priceKgUsdCargo" | "cargoUsdPerKg" | "deliveryType"
  >,
  globals: FabricPricingGlobals,
): number {
  const explicit = num(row.cargoUsdPerKg);
  if (explicit != null) return explicit;
  if (row.deliveryType) {
    return deliveryRateUsdPerKg(row.deliveryType, globals);
  }
  return resolveCargoUsdPerKg(
    { priceKgUsd: row.priceKgUsd, priceKgUsdCargo: row.priceKgUsdCargo },
    globals,
  );
}

function resolveLineUsdUahRate(
  row: Pick<FabricDeliveryMaterialSource, "usdUahRate">,
  globals: FabricPricingGlobals,
): number {
  const explicit = num(row.usdUahRate);
  if (explicit != null && explicit > 0) return explicit;
  return globals.usdUahRate;
}

/** Preliminary delivery in ₴ for one fabric BOM line. */
export function computeFabricDeliveryLine(
  row: FabricDeliveryMaterialSource,
  quantitiesBySize: Record<string, number>,
  globals: FabricPricingGlobals,
): number {
  if (row.type && row.type !== "FABRIC") return 0;
  const metersPerKg = num(row.metersPerKg);
  if (metersPerKg == null || metersPerKg <= 0) return 0;

  const meters = fabricMetersNeeded({
    consumptionPerUnit: row.consumptionPerUnit,
    wastePercent: row.wastePercent,
    quantitiesBySize,
    sizeCode: row.sizeCode,
  });
  if (meters <= 0) return 0;

  const kgNeeded = meters / metersPerKg;
  const rate = resolveLineRate(row, globals);
  if (rate <= 0) return 0;

  // НП обʼємні: ₴/м³ × м³ (м³ ≈ кг / насипна щільність) — без курсу $.
  if (isVolumeDeliveryType(row.deliveryType)) {
    return round1(fabricKgToVolumeM3(kgNeeded) * rate);
  }

  const usdUahRate = resolveLineUsdUahRate(row, globals);
  if (usdUahRate <= 0) return 0;

  return round1(kgNeeded * rate * usdUahRate);
}

/** Preliminary fabric delivery in ₴ for an order item. */
export function computeOrderItemFabricDelivery(input: {
  materials: FabricDeliveryMaterialSource[];
  quantitiesBySize: Record<string, number>;
  globals: FabricPricingGlobals;
}): number {
  let total = 0;
  for (const row of input.materials) {
    total += computeFabricDeliveryLine(row, input.quantitiesBySize, input.globals);
  }
  return round1(total);
}
