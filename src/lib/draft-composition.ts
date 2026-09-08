import type { CatalogProduct, DraftComposition } from "@/components/orders/ProductCatalogPanel";
import type {
  DraftDecorationRow,
  DraftMaterialRow,
  DraftOperationRow,
} from "@/components/orders/ProductCatalogPanel";
import type { MaterialCatalogOption } from "@/components/composition/DraftCompositionForms";
import {
  fabricMetersNeeded,
  fabricPricingModeLabel,
  resolveMaterialCostPrice,
  resolveMaterialLinePurchasePrice,
  type FabricPricingMode,
  type MaterialCostVatMode,
} from "@/lib/fabric-pricing";
import { resolveQuantityTierRate } from "@/lib/quantity-tiers";

export function draftKey() {
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyComposition(): DraftComposition {
  return { materials: [], operations: [], decorations: [] };
}

export function pricingFieldsFromCatalogOption(
  option: MaterialCatalogOption,
  companyCostMode: MaterialCostVatMode = "NET",
  options?: { deferUserChoices?: boolean },
): Pick<
  DraftMaterialRow,
  | "materialType"
  | "priceMeterUahNoVat"
  | "priceMeterUahVat"
  | "priceMeterUahCutVat"
  | "metersPerRoll"
  | "minWholesaleMeters"
  | "costVatMode"
  | "priceMode"
  | "price"
> {
  const defer = options?.deferUserChoices ?? false;
  const previewVatMode = option.costVatOverride ?? companyCostMode;
  const resolved = resolveMaterialLinePurchasePrice({
    type: option.materialType ?? "FABRIC",
    purchasePrice: option.price,
    priceMeterUahNoVat: option.priceMeterUahNoVat,
    priceMeterUahVat: option.priceMeterUahVat,
    priceMeterUahCutVat: option.priceMeterUahCutVat,
    metersPerRoll: option.metersPerRoll,
    minWholesaleMeters: option.minWholesaleMeters,
    costVatOverride: previewVatMode,
    companyCostMode,
    metersNeeded: null,
  });
  return {
    materialType: option.materialType ?? null,
    priceMeterUahNoVat: option.priceMeterUahNoVat ?? null,
    priceMeterUahVat: option.priceMeterUahVat ?? null,
    priceMeterUahCutVat: option.priceMeterUahCutVat ?? null,
    metersPerRoll: option.metersPerRoll ?? null,
    minWholesaleMeters: option.minWholesaleMeters ?? null,
    costVatMode: defer ? null : previewVatMode,
    priceMode: defer ? null : "auto",
    price: resolved.purchasePrice > 0 ? resolved.purchasePrice : option.price,
  };
}

export function cloneComposition(
  product: CatalogProduct,
  materialCatalog: MaterialCatalogOption[] = [],
  companyCostMode: MaterialCostVatMode = "NET",
): DraftComposition {
  const byId = new Map(materialCatalog.map((row) => [row.id, row]));
  return {
    materials: product.composition.materials.map((row) => {
      const option = byId.get(row.materialId);
      const pricing = option
        ? pricingFieldsFromCatalogOption(option, companyCostMode, { deferUserChoices: true })
        : {
            materialType: row.materialType ?? null,
            priceMeterUahNoVat: row.priceMeterUahNoVat ?? null,
            priceMeterUahVat: row.priceMeterUahVat ?? null,
            priceMeterUahCutVat: row.priceMeterUahCutVat ?? null,
            metersPerRoll: row.metersPerRoll ?? null,
            minWholesaleMeters: row.minWholesaleMeters ?? null,
            costVatMode: null,
            priceMode: null,
            price: row.price,
          };
      return {
        ...row,
        ...pricing,
        lineColor: null,
        availableColors: option?.availableColors ?? row.availableColors ?? [],
        materialType: option?.materialType ?? row.materialType ?? pricing.materialType,
        metersPerKg: option?.metersPerKg ?? row.metersPerKg ?? null,
        wholesaleNote: option?.wholesaleNote ?? row.wholesaleNote ?? null,
        cargoUsdPerKg: null,
        usdUahRate: null,
        fabricDeliveryManual: false,
        fabricDeliveryAmount: null,
        key: draftKey(),
      };
    }),
    operations: product.composition.operations.map((row) => ({
      ...row,
      key: draftKey(),
    })),
    decorations: product.composition.decorations.map((row) => ({
      ...row,
      key: draftKey(),
    })),
  };
}

export function materialUnitCost(row: DraftMaterialRow) {
  return row.price * row.consumption * (1 + row.waste / 100);
}

export function operationUnitCost(row: DraftOperationRow, quantityHint = 100) {
  if (row.method === "SHIFT_OUTPUT") {
    if (!row.standardOutput) return 0;
    return (row.shiftCost ?? 0) / row.standardOutput;
  }
  if (row.method === "QUANTITY_TIER" && row.rateTiers?.length) {
    return resolveQuantityTierRate({
      quantity: quantityHint,
      tiers: row.rateTiers,
      fallbackRate: row.unitRate ?? 0,
    });
  }
  return row.unitRate ?? 0;
}

export function decorationBatchCost(row: DraftDecorationRow, quantity: number) {
  return row.setupCost + row.unitRate * quantity;
}

export function draftMaterialMetersNeeded(
  row: DraftMaterialRow,
  quantitiesBySize: Record<string, number>,
): number {
  return fabricMetersNeeded({
    consumptionPerUnit: row.consumption,
    wastePercent: row.waste,
    quantitiesBySize,
    sizeCode: row.sizeCodes?.length === 1 ? row.sizeCodes[0] : null,
    sizeConsumption: row.sizeConsumption,
  });
}

export function catalogOptionHasPricingControls(option: MaterialCatalogOption): boolean {
  return (
    option.materialType === "FABRIC" ||
    option.priceMeterUahNoVat != null ||
    option.priceMeterUahVat != null ||
    option.priceMeterUahCutVat != null
  );
}

export function materialHasPricingControls(row: DraftMaterialRow): boolean {
  return (
    row.materialType === "FABRIC" ||
    row.priceMeterUahNoVat != null ||
    row.priceMeterUahVat != null ||
    row.priceMeterUahCutVat != null
  );
}

/** Fabric with cut price needs an explicit auto / cut / wholesale choice. */
export function materialNeedsPriceModeChoice(row: DraftMaterialRow): boolean {
  return (
    materialHasPricingControls(row) &&
    row.priceMeterUahCutVat != null &&
    row.priceMeterUahCutVat > 0
  );
}

export function draftMaterialRowPricingReady(row: DraftMaterialRow): boolean {
  if (!materialHasPricingControls(row)) return true;
  if (!row.costVatMode) return false;
  if (materialNeedsPriceModeChoice(row) && !row.priceMode) return false;
  return true;
}

export function resolveDraftMaterialPrice(
  row: DraftMaterialRow,
  quantitiesBySize: Record<string, number> | undefined,
  companyCostMode: MaterialCostVatMode,
): { purchasePrice: number; pricingMode: FabricPricingMode; hint: string } {
  if (!row.costVatMode) {
    return { purchasePrice: row.price, pricingMode: "standard", hint: "" };
  }

  const costVatMode = row.costVatMode as MaterialCostVatMode;
  const vatHint = costVatMode === "GROSS" ? "з ПДВ" : "без ПДВ";
  const needsPriceMode = materialNeedsPriceModeChoice(row);

  if (needsPriceMode && !row.priceMode) {
    const wholesalePurchasePrice = resolveMaterialCostPrice({
      mode: costVatMode,
      priceMeterUahNoVat: row.priceMeterUahNoVat,
      priceMeterUahVat: row.priceMeterUahVat,
      fallbackPurchasePrice: row.price,
    });
    return {
      purchasePrice: wholesalePurchasePrice,
      pricingMode: "wholesale",
      hint: vatHint,
    };
  }

  const metersNeeded =
    quantitiesBySize && Object.values(quantitiesBySize).some((q) => q > 0)
      ? draftMaterialMetersNeeded(row, quantitiesBySize)
      : null;

  const priceMode = needsPriceMode ? row.priceMode! : "auto";
  let resolvedMeters: number | null | undefined = metersNeeded;
  if (priceMode === "cut") {
    resolvedMeters = 0;
  } else if (priceMode === "wholesale") {
    const min = row.minWholesaleMeters ?? row.metersPerRoll;
    resolvedMeters = min != null && min > 0 ? Math.max(min, metersNeeded ?? min) : 1e12;
  }

  const resolved = resolveMaterialLinePurchasePrice({
    type: row.materialType ?? "FABRIC",
    purchasePrice: row.price,
    priceMeterUahNoVat: row.priceMeterUahNoVat,
    priceMeterUahVat: row.priceMeterUahVat,
    priceMeterUahCutVat: row.priceMeterUahCutVat,
    metersPerRoll: row.metersPerRoll,
    minWholesaleMeters: row.minWholesaleMeters,
    costVatOverride: costVatMode,
    companyCostMode,
    metersNeeded: priceMode === "auto" ? metersNeeded : resolvedMeters,
  });

  if (!needsPriceMode) {
    return {
      purchasePrice: resolved.purchasePrice,
      pricingMode: resolved.pricingMode,
      hint: vatHint,
    };
  }

  const modeHint =
    priceMode === "auto"
      ? fabricPricingModeLabel(resolved.pricingMode)
      : priceMode === "cut"
        ? "відріз (вручну)"
        : "гурт (вручну)";

  return {
    purchasePrice: resolved.purchasePrice,
    pricingMode: resolved.pricingMode,
    hint: `${vatHint} · ${modeHint}`,
  };
}

/** Compact table subtitle from VAT / price mode / color choices. */
export function draftMaterialChoiceSummary(
  row: DraftMaterialRow,
  companyCostMode: MaterialCostVatMode,
  options?: { includePricing?: boolean },
): string | null {
  const parts: string[] = [];
  const includePricing = options?.includePricing ?? materialHasPricingControls(row);
  if (includePricing && row.costVatMode) {
    const vatMode = row.costVatMode as MaterialCostVatMode;
    parts.push(vatMode === "GROSS" ? "з ПДВ" : "без ПДВ");
    if (row.priceMode) {
      parts.push(
        row.priceMode === "cut" ? "відріз" : row.priceMode === "wholesale" ? "гурт" : "авто",
      );
    }
  }
  const color = !isPackagingMaterial(row) ? row.lineColor?.trim() : null;
  if (color) parts.push(color);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Shown under the material name while pricing toggles are still unset. */
export function draftMaterialPricingChoiceHint(
  row: DraftMaterialRow,
  options: { enableLinePricingControls: boolean },
): string | null {
  if (!options.enableLinePricingControls || !materialHasPricingControls(row)) {
    return null;
  }
  const parts: string[] = [];
  if (!row.costVatMode) {
    parts.push("без ПДВ / з ПДВ");
  }
  if (materialNeedsPriceModeChoice(row) && !row.priceMode) {
    parts.push("авто / відріз / гурт");
  }
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

function isPackagingMaterial(row: Pick<DraftMaterialRow, "materialType" | "name">): boolean {
  const name = row.name.trim();
  return (
    /^пакуван/i.test(name) ||
    /пакет|бопп|поліетил|єврошов|zip.*bag|поліграф/i.test(name)
  );
}

/** Packaging / bags — no color in order spec. */
export function isPackagingSku(row: Pick<DraftMaterialRow, "materialType" | "name">): boolean {
  return isPackagingMaterial(row);
}

/** «3-х нитки» / «2-х нитки» — тип трикотажу, не швейна нитка. */
function isKnitGaugeLabel(name: string): boolean {
  return /\d[\s.\-]*х[\s.\-]*нитк/i.test(name);
}

function isSewingThreadName(name: string): boolean {
  if (isKnitGaugeLabel(name)) return false;
  const trimmed = name.trim();
  if (/^нитк[аиіє]/i.test(trimmed)) return true;
  return /[\s,+(·]нитк[аиіє]/i.test(name);
}

/** Trim / thread SKUs that need an explicit color in order spec. */
export function isTrimLikeMaterial(row: Pick<DraftMaterialRow, "materialType" | "name">): boolean {
  if (isPackagingMaterial(row)) return false;
  if (row.materialType === "TRIM") return true;
  const name = row.name;
  if (/фурнітур|блискав|гудзик|бігун/i.test(name)) return true;
  return isSewingThreadName(name);
}

export function draftMaterialNeedsColor(row: DraftMaterialRow): boolean {
  if (isPackagingMaterial(row)) return false;
  if (isTrimLikeMaterial(row)) return true;
  if ((row.availableColors?.length ?? 0) > 0) return true;
  // Order spec: fabric roll color is chosen per line (лакоста, комірці, основа тощо).
  if (row.materialType === "FABRIC") return true;
  if (materialHasPricingControls(row)) return true;
  return false;
}

/** Whether the row shows the color slot (swatch or «?») in the materials table. */
export function draftMaterialShowsColorSlot(
  row: DraftMaterialRow,
  options: { enableLinePricingControls: boolean },
): boolean {
  if (!options.enableLinePricingControls || isPackagingMaterial(row)) return false;
  return (
    draftMaterialNeedsColor(row) ||
    Boolean(row.lineColor?.trim()) ||
    (row.availableColors?.length ?? 0) > 0
  );
}

/** Ukrainian labels for fields still required before the line can be confirmed. */
export function draftMaterialMissingChoices(
  row: DraftMaterialRow,
  options: {
    enableLinePricingControls: boolean;
    companyCostMode: MaterialCostVatMode;
  },
): string[] {
  const missing: string[] = [];

  if (draftMaterialNeedsColor(row) && !row.lineColor?.trim()) {
    missing.push("Колір");
  }
  if (
    options.enableLinePricingControls &&
    materialHasPricingControls(row) &&
    !row.costVatMode
  ) {
    missing.push("ПДВ");
  }
  if (
    options.enableLinePricingControls &&
    materialNeedsPriceModeChoice(row) &&
    !row.priceMode
  ) {
    missing.push("Режим ціни");
  }
  return missing;
}

export function draftMaterialRowComplete(
  row: DraftMaterialRow,
  options: {
    enableLinePricingControls: boolean;
    companyCostMode: MaterialCostVatMode;
  },
): boolean {
  return draftMaterialMissingChoices(row, options).length === 0;
}

export function compositionMissingMaterialChoices(
  composition: DraftComposition,
  options: {
    enableLinePricingControls: boolean;
    companyCostMode: MaterialCostVatMode;
  },
): Array<{ key: string; name: string; missing: string[] }> {
  return composition.materials
    .map((row) => ({
      key: row.key,
      name: row.name,
      missing: draftMaterialMissingChoices(row, options),
    }))
    .filter((row) => row.missing.length > 0);
}

/** Apply live price resolution to materials that have catalog pricing context. */
export function syncDraftMaterialPrices(
  composition: DraftComposition,
  quantitiesBySize: Record<string, number> | undefined,
  companyCostMode: MaterialCostVatMode,
): DraftComposition {
  let changed = false;
  const materials = composition.materials.map((row) => {
    if (!materialHasPricingControls(row) || !row.costVatMode) return row;
    const { purchasePrice } = resolveDraftMaterialPrice(row, quantitiesBySize, companyCostMode);
    if (Math.abs(purchasePrice - row.price) < 0.0001) return row;
    changed = true;
    return { ...row, price: purchasePrice };
  });
  return changed ? { ...composition, materials } : composition;
}
