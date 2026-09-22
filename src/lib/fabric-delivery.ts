import {
  fabricMetersNeeded,
  resolveCargoUsdPerKg,
  type FabricPricingGlobals,
} from "@/lib/fabric-pricing";
import { deliveryRateUsdPerKg } from "@/lib/fabric-delivery-types";
import { resolveSupplierDeliveryRate } from "@/lib/supplier-delivery-rates";

/** Additional-cost id used in product + order calc engines. */
export const FABRIC_DELIVERY_ADDITIONAL_ID = "fabric-delivery";

export type FabricDeliveryMaterialSource = {
  type?: string | null;
  metersPerKg?: number | null;
  priceKgUsd?: number | null;
  priceKgUsdCargo?: number | null;
  /** Explicit cargo override ($/kg) for this line. */
  cargoUsdPerKg?: number | null;
  /** Material / line delivery type — used when cargoUsdPerKg is unset. */
  deliveryType?: string | null;
  /** Explicit USD/UAH rate override for this line. */
  usdUahRate?: number | null;
  consumptionPerUnit: number;
  wastePercent: number;
  sizeCode?: string | null;
};

export type FabricDeliveryOfferSource = {
  supplierId: string;
  isPrimary?: boolean;
  deliveryType?: string | null;
  metersPerKg?: number | null;
  priceKgUsd?: number | null;
  priceKgUsdCargo?: number | null;
  cargoUsdPerKg?: number | null;
  npStandardUsdPerKg?: number | null;
  npVolumeUsdPerKg?: number | null;
};

/** Product BOM fabric line → delivery ₴ for a tirage size mix. */
export type ProductFabricDeliveryBomLine = {
  id: string;
  deliveryType?: string | null;
  supplierId?: string | null;
  consumptionPerUnit: number;
  wastePercent: number;
  /** Size codes this line applies to (empty / null = all). */
  sizeCodes?: string[] | null;
  sizeConsumption?: Record<string, number>;
  sizeWaste?: Record<string, number>;
  material: {
    type?: string | null;
    metersPerKg?: number | null;
    priceKgUsd?: number | null;
    priceKgUsdCargo?: number | null;
    deliveryType?: string | null;
    supplierOffers?: FabricDeliveryOfferSource[];
  };
};

function num(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function resolveLineCargoUsdPerKg(
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

/** Delivery ₴ from already-known meters (product size mix / coeffs). */
export function fabricDeliveryFromMeters(input: {
  meters: number;
  metersPerKg?: number | null;
  cargoUsdPerKg: number;
  usdUahRate: number;
}): number {
  const metersPerKg = num(input.metersPerKg);
  if (metersPerKg == null || metersPerKg <= 0) return 0;
  if (!(input.meters > 0) || !(input.cargoUsdPerKg > 0) || !(input.usdUahRate > 0)) return 0;
  return round1((input.meters / metersPerKg) * input.cargoUsdPerKg * input.usdUahRate);
}

/** Preliminary delivery in ₴ for one fabric BOM line: кг × $/кг × курс. */
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
  const cargoUsdPerKg = resolveLineCargoUsdPerKg(row, globals);
  const usdUahRate = resolveLineUsdUahRate(row, globals);
  if (cargoUsdPerKg <= 0 || usdUahRate <= 0) return 0;

  return round1(kgNeeded * cargoUsdPerKg * usdUahRate);
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

function pickOfferForLine(
  line: ProductFabricDeliveryBomLine,
): FabricDeliveryOfferSource | null {
  const offers = line.material.supplierOffers ?? [];
  if (offers.length === 0) return null;
  if (line.supplierId) {
    const match = offers.find((offer) => offer.supplierId === line.supplierId);
    if (match) return match;
  }
  return offers.find((offer) => offer.isPrimary) ?? offers[0] ?? null;
}

/**
 * Fabric delivery for a product tirage: sum over FABRIC BOM lines.
 * Trim pack delivery stays inside material ₴/од. (not here).
 * Rate: line deliveryType → supplier offer rate for that type → company defaults.
 */
export function computeProductFabricDelivery(input: {
  lines: ProductFabricDeliveryBomLine[];
  sizes: Array<{ sizeCode: string; quantity: number; materialCoeff?: number }>;
  globals: FabricPricingGlobals;
}): {
  totalUah: number;
  lines: Array<{
    id: string;
    amountUah: number;
    deliveryType: string | null;
    rateUsdPerKg: number;
  }>;
} {
  const allSizeCodes = input.sizes.map((size) => size.sizeCode);
  const resultLines: Array<{
    id: string;
    amountUah: number;
    deliveryType: string | null;
    rateUsdPerKg: number;
  }> = [];
  let total = 0;

  for (const line of input.lines) {
    if (line.material.type && line.material.type !== "FABRIC") continue;

    const offer = pickOfferForLine(line);
    const deliveryType =
      line.deliveryType ?? offer?.deliveryType ?? line.material.deliveryType ?? null;
    const resolved = resolveSupplierDeliveryRate(
      {
        deliveryType,
        cargoUsdPerKg: num(offer?.cargoUsdPerKg),
        npStandardUsdPerKg: num(offer?.npStandardUsdPerKg),
        npVolumeUsdPerKg: num(offer?.npVolumeUsdPerKg),
      },
      input.globals,
    );
    const metersPerKg =
      num(offer?.metersPerKg) ?? num(line.material.metersPerKg);
    const applies =
      line.sizeCodes && line.sizeCodes.length > 0 ? line.sizeCodes : allSizeCodes;

    let meters = 0;
    for (const size of input.sizes) {
      if (size.quantity <= 0 || !applies.includes(size.sizeCode)) continue;
      const sizeConsumption = line.sizeConsumption ?? {};
      const sizeWaste = line.sizeWaste ?? {};
      const hasExplicitNorm = sizeConsumption[size.sizeCode] != null;
      const consumption =
        sizeConsumption[size.sizeCode] ?? line.consumptionPerUnit;
      const waste = sizeWaste[size.sizeCode] ?? line.wastePercent;
      const coeff = hasExplicitNorm ? 1 : (size.materialCoeff ?? 1);
      meters += consumption * (1 + waste / 100) * size.quantity * coeff;
    }

    const amountUah = fabricDeliveryFromMeters({
      meters,
      metersPerKg,
      cargoUsdPerKg: resolved.rateUsdPerKg,
      usdUahRate: input.globals.usdUahRate,
    });
    if (amountUah <= 0) continue;

    total += amountUah;
    resultLines.push({
      id: line.id,
      amountUah,
      deliveryType: resolved.type,
      rateUsdPerKg: resolved.rateUsdPerKg,
    });
  }

  return { totalUah: round1(total), lines: resultLines };
}
