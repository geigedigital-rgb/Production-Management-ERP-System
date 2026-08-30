export type MaterialCostVatMode = "NET" | "GROSS";

export type FabricPricingGlobals = {
  usdUahRate: number;
  fabricCargoUsdPerKg: number;
  materialCostVatMode: MaterialCostVatMode;
};

export type FabricPriceInputs = {
  metersPerKg?: number | null;
  priceKgUsd?: number | null;
  priceKgUsdCargo?: number | null;
  priceKgUsdVat?: number | null;
  priceMeterUahNoVat?: number | null;
  priceMeterUahVat?: number | null;
  priceMeterUahCutVat?: number | null;
  rollWeightKg?: number | null;
  metersPerRoll?: number | null;
  minWholesaleMeters?: number | null;
  costVatOverride?: MaterialCostVatMode | null;
};

export type FabricPricingMode = "cut" | "wholesale" | "standard";

export type FabricPriceDerived = {
  priceKgUsdCargo: number | null;
  priceMeterUahNoVat: number | null;
  priceMeterUahVat: number | null;
  /** Cargo component in ₴/m when derived from $/kg (null when unknown). */
  deliveryPerMeterUah: number | null;
  metersPerRoll: number | null;
  minWholesaleMeters: number | null;
  /** Material COGS only — without delivery/cargo. */
  purchasePrice: number;
  wholesalePurchasePrice: number;
  cutPurchasePrice: number | null;
  pricingMode: FabricPricingMode;
  costMode: MaterialCostVatMode;
};

function num(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}

/** Cargo is an additive $/kg surcharge from the CRM sheet (not a multiplier). */
export function priceKgWithCargo(priceKgUsd: number | null | undefined, cargoUsdPerKg: number) {
  const base = num(priceKgUsd);
  if (base == null) return null;
  return round4(base + cargoUsdPerKg);
}

/** грн/м.п. = ($/кг × курс) / (м.п. у 1 кг) */
export function meterPriceFromKgUsd(
  priceKgUsd: number | null | undefined,
  metersPerKg: number | null | undefined,
  usdUahRate: number,
) {
  const kg = num(priceKgUsd);
  const mpk = num(metersPerKg);
  if (kg == null || mpk == null || mpk <= 0 || usdUahRate <= 0) return null;
  return round1((kg * usdUahRate) / mpk);
}

export function metersPerRollFromWeight(
  rollWeightKg: number | null | undefined,
  metersPerKg: number | null | undefined,
) {
  const weight = num(rollWeightKg);
  const mpk = num(metersPerKg);
  if (weight == null || mpk == null) return null;
  return round1(weight * mpk);
}

export function resolveCostMode(
  companyMode: MaterialCostVatMode,
  override?: MaterialCostVatMode | null,
): MaterialCostVatMode {
  return override ?? companyMode;
}

/**
 * Active COGS price in ₴ / unit (м.п. for fabrics).
 * NET prefers without-VAT; GROSS prefers with-VAT; each falls back to the other.
 */
export function resolveMaterialCostPrice(input: {
  mode: MaterialCostVatMode;
  priceMeterUahNoVat?: number | null;
  priceMeterUahVat?: number | null;
  fallbackPurchasePrice?: number | null;
}): number {
  const noVat = num(input.priceMeterUahNoVat);
  const vat = num(input.priceMeterUahVat);
  const fallback = num(input.fallbackPurchasePrice) ?? 0;
  if (input.mode === "NET") return noVat ?? vat ?? fallback;
  return vat ?? noVat ?? fallback;
}

/** Cargo $/kg to apply: explicit cargo price delta, else company default. */
export function resolveCargoUsdPerKg(
  inputs: Pick<FabricPriceInputs, "priceKgUsd" | "priceKgUsdCargo">,
  globals: FabricPricingGlobals,
): number {
  const base = num(inputs.priceKgUsd);
  const withCargo = num(inputs.priceKgUsdCargo);
  if (base != null && withCargo != null && withCargo >= base) {
    return round4(withCargo - base);
  }
  return globals.fabricCargoUsdPerKg;
}

export function resolveMinWholesaleMeters(input: {
  minWholesaleMeters?: number | null;
  metersPerRoll?: number | null;
}): number | null {
  return num(input.minWholesaleMeters) ?? num(input.metersPerRoll);
}

/**
 * Pick cut vs wholesale for an order line by fabric meters needed.
 * Catalog / base model should use resolveCatalogPurchasePrice (always conservative).
 */
export function resolveOrderFabricPurchasePrice(input: {
  metersNeeded: number;
  wholesalePurchasePrice: number;
  cutPurchasePrice?: number | null;
  minWholesaleMeters?: number | null;
}): { purchasePrice: number; pricingMode: FabricPricingMode } {
  const cut = num(input.cutPurchasePrice);
  const minM = num(input.minWholesaleMeters);
  const wholesale = input.wholesalePurchasePrice;

  if (cut == null || cut <= 0) {
    return { purchasePrice: wholesale, pricingMode: wholesale > 0 ? "wholesale" : "standard" };
  }

  if (minM != null && minM > 0 && input.metersNeeded >= minM) {
    return { purchasePrice: wholesale > 0 ? wholesale : cut, pricingMode: "wholesale" };
  }

  return { purchasePrice: cut, pricingMode: "cut" };
}

/** Derive cargo / meter / roll prices and the purchasePrice used by the calc engine. */
export function deriveFabricPricing(
  inputs: FabricPriceInputs,
  globals: FabricPricingGlobals,
): FabricPriceDerived {
  const metersPerKg = num(inputs.metersPerKg);
  const priceKgUsd = num(inputs.priceKgUsd);
  const cargoPerKg = resolveCargoUsdPerKg(inputs, globals);

  const priceKgUsdCargo =
    num(inputs.priceKgUsdCargo) ?? priceKgWithCargo(priceKgUsd, cargoPerKg);

  const explicitMeterNoVat = num(inputs.priceMeterUahNoVat);
  const explicitMeterVat = num(inputs.priceMeterUahVat);

  // Material COGS: base $/kg (and explicit ₴/m) without cargo.
  const priceMeterUahNoVat =
    explicitMeterNoVat ??
    meterPriceFromKgUsd(priceKgUsd, metersPerKg, globals.usdUahRate);

  const priceMeterUahVat =
    explicitMeterVat ??
    meterPriceFromKgUsd(num(inputs.priceKgUsdVat), metersPerKg, globals.usdUahRate);

  const priceMeterUahNoVatWithCargo = meterPriceFromKgUsd(
    priceKgUsdCargo,
    metersPerKg,
    globals.usdUahRate,
  );

  const deliveryPerMeterUah =
    explicitMeterNoVat != null || priceKgUsd == null || metersPerKg == null
      ? null
      : priceMeterUahNoVatWithCargo != null && priceMeterUahNoVat != null
        ? round1(Math.max(0, priceMeterUahNoVatWithCargo - priceMeterUahNoVat))
        : null;

  const metersPerRoll =
    num(inputs.metersPerRoll) ??
    metersPerRollFromWeight(inputs.rollWeightKg, metersPerKg);

  const minWholesaleMeters = resolveMinWholesaleMeters({
    minWholesaleMeters: inputs.minWholesaleMeters,
    metersPerRoll,
  });

  const costMode = resolveCostMode(globals.materialCostVatMode, inputs.costVatOverride);
  const wholesalePurchasePrice = resolveMaterialCostPrice({
    mode: costMode,
    priceMeterUahNoVat,
    priceMeterUahVat,
  });

  const cutPurchasePrice = num(inputs.priceMeterUahCutVat);

  // Catalog / base model: conservative cut price when present.
  let purchasePrice = wholesalePurchasePrice;
  let pricingMode: FabricPricingMode = wholesalePurchasePrice > 0 ? "wholesale" : "standard";
  if (cutPurchasePrice != null && cutPurchasePrice > 0) {
    purchasePrice = cutPurchasePrice;
    pricingMode = "cut";
  }

  return {
    priceKgUsdCargo,
    priceMeterUahNoVat,
    priceMeterUahVat,
    deliveryPerMeterUah,
    metersPerRoll,
    minWholesaleMeters,
    purchasePrice,
    wholesalePurchasePrice,
    cutPurchasePrice,
    pricingMode,
    costMode,
  };
}

/** Meters of fabric needed for a BOM line across size quantities. */
export function fabricMetersNeeded(input: {
  consumptionPerUnit: number;
  wastePercent: number;
  quantitiesBySize: Record<string, number>;
  sizeCode?: string | null;
  sizeConsumption?: Record<string, number> | null;
}): number {
  const waste = 1 + (input.wastePercent || 0) / 100;
  let total = 0;
  for (const [code, qty] of Object.entries(input.quantitiesBySize)) {
    if (qty <= 0) continue;
    if (input.sizeCode && input.sizeCode !== code) continue;
    const consumption =
      input.sizeConsumption?.[code] ?? input.consumptionPerUnit;
    total += consumption * waste * qty;
  }
  return total;
}

export function fabricPricingModeLabel(mode: FabricPricingMode): string {
  switch (mode) {
    case "cut":
      return "ціна на відріз";
    case "wholesale":
      return "гуртова ціна";
    default:
      return "каталожна ціна";
  }
}

/** Resolve snapshot purchase price for an order material line from catalog fabric fields. */
export function resolveMaterialLinePurchasePrice(input: {
  type?: string | null;
  purchasePrice: number;
  priceMeterUahNoVat?: number | null;
  priceMeterUahVat?: number | null;
  priceMeterUahCutVat?: number | null;
  metersPerRoll?: number | null;
  minWholesaleMeters?: number | null;
  costVatOverride?: MaterialCostVatMode | null;
  companyCostMode: MaterialCostVatMode;
  /** When null/undefined → catalog conservative (cut preferred). */
  metersNeeded?: number | null;
}): { purchasePrice: number; pricingMode: FabricPricingMode; wholesalePurchasePrice: number; cutPurchasePrice: number | null } {
  const catalogPrice = num(input.purchasePrice) ?? 0;
  if (input.type && input.type !== "FABRIC") {
    return {
      purchasePrice: catalogPrice,
      pricingMode: "standard",
      wholesalePurchasePrice: catalogPrice,
      cutPurchasePrice: null,
    };
  }

  const costMode = resolveCostMode(input.companyCostMode, input.costVatOverride);
  const wholesalePurchasePrice = resolveMaterialCostPrice({
    mode: costMode,
    priceMeterUahNoVat: input.priceMeterUahNoVat,
    priceMeterUahVat: input.priceMeterUahVat,
    fallbackPurchasePrice: catalogPrice,
  });
  const cutPurchasePrice = num(input.priceMeterUahCutVat);
  const minWholesaleMeters = resolveMinWholesaleMeters({
    minWholesaleMeters: input.minWholesaleMeters,
    metersPerRoll: input.metersPerRoll,
  });

  if (input.metersNeeded == null) {
    // Catalog / base model path
    if (cutPurchasePrice != null && cutPurchasePrice > 0) {
      return {
        purchasePrice: cutPurchasePrice,
        pricingMode: "cut",
        wholesalePurchasePrice,
        cutPurchasePrice,
      };
    }
    return {
      purchasePrice: wholesalePurchasePrice > 0 ? wholesalePurchasePrice : catalogPrice,
      pricingMode: wholesalePurchasePrice > 0 ? "wholesale" : "standard",
      wholesalePurchasePrice,
      cutPurchasePrice,
    };
  }

  const resolved = resolveOrderFabricPurchasePrice({
    metersNeeded: input.metersNeeded,
    wholesalePurchasePrice: wholesalePurchasePrice > 0 ? wholesalePurchasePrice : catalogPrice,
    cutPurchasePrice,
    minWholesaleMeters,
  });

  return {
    purchasePrice: resolved.purchasePrice,
    pricingMode: resolved.pricingMode,
    wholesalePurchasePrice,
    cutPurchasePrice,
  };
}
