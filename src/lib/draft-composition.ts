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
  resolveMaterialLinePurchasePrice,
  type FabricPricingMode,
  type MaterialCostVatMode,
} from "@/lib/fabric-pricing";

export function draftKey() {
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyComposition(): DraftComposition {
  return { materials: [], operations: [], decorations: [] };
}

export function pricingFieldsFromCatalogOption(
  option: MaterialCatalogOption,
  companyCostMode: MaterialCostVatMode = "NET",
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
  const costVatMode = option.costVatOverride ?? companyCostMode;
  const resolved = resolveMaterialLinePurchasePrice({
    type: option.materialType ?? "FABRIC",
    purchasePrice: option.price,
    priceMeterUahNoVat: option.priceMeterUahNoVat,
    priceMeterUahVat: option.priceMeterUahVat,
    priceMeterUahCutVat: option.priceMeterUahCutVat,
    metersPerRoll: option.metersPerRoll,
    minWholesaleMeters: option.minWholesaleMeters,
    costVatOverride: costVatMode,
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
    costVatMode,
    priceMode: "auto",
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
        ? pricingFieldsFromCatalogOption(option, companyCostMode)
        : {
            materialType: row.materialType ?? null,
            priceMeterUahNoVat: row.priceMeterUahNoVat ?? null,
            priceMeterUahVat: row.priceMeterUahVat ?? null,
            priceMeterUahCutVat: row.priceMeterUahCutVat ?? null,
            metersPerRoll: row.metersPerRoll ?? null,
            minWholesaleMeters: row.minWholesaleMeters ?? null,
            costVatMode: row.costVatMode ?? companyCostMode,
            priceMode: (row.priceMode ?? "auto") as "auto" | "cut" | "wholesale",
            price: row.price,
          };
      return {
        ...row,
        ...pricing,
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

export function operationUnitCost(row: DraftOperationRow) {
  if (row.method === "SHIFT_OUTPUT") {
    if (!row.standardOutput) return 0;
    return (row.shiftCost ?? 0) / row.standardOutput;
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

export function resolveDraftMaterialPrice(
  row: DraftMaterialRow,
  quantitiesBySize: Record<string, number> | undefined,
  companyCostMode: MaterialCostVatMode,
): { purchasePrice: number; pricingMode: FabricPricingMode; hint: string } {
  const costVatMode = (row.costVatMode ?? companyCostMode) as MaterialCostVatMode;
  const metersNeeded =
    quantitiesBySize && Object.values(quantitiesBySize).some((q) => q > 0)
      ? draftMaterialMetersNeeded(row, quantitiesBySize)
      : null;

  const priceMode = row.priceMode ?? "auto";
  let resolvedMeters: number | null | undefined = metersNeeded;
  if (priceMode === "cut") {
    resolvedMeters = 0;
  } else if (priceMode === "wholesale") {
    const min = row.minWholesaleMeters ?? row.metersPerRoll;
    // Force wholesale branch even when threshold is unknown.
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

  const vatHint = costVatMode === "GROSS" ? "з ПДВ" : "без ПДВ";
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

/** Apply live price resolution to materials that have catalog pricing context. */
export function syncDraftMaterialPrices(
  composition: DraftComposition,
  quantitiesBySize: Record<string, number> | undefined,
  companyCostMode: MaterialCostVatMode,
): DraftComposition {
  let changed = false;
  const materials = composition.materials.map((row) => {
    if (!materialHasPricingControls(row)) return row;
    const { purchasePrice } = resolveDraftMaterialPrice(row, quantitiesBySize, companyCostMode);
    if (Math.abs(purchasePrice - row.price) < 0.0001) return row;
    changed = true;
    return { ...row, price: purchasePrice };
  });
  return changed ? { ...composition, materials } : composition;
}
