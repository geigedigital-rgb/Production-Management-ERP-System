import { prisma } from "@/server/db/client";
import { materialFormSchema, type MaterialFormValues } from "./schemas";
import type { MaterialCostVatMode, MaterialType, RecordStatus } from "@prisma/client";
import {
  deriveFabricPricing,
  type FabricPricingGlobals,
} from "@/lib/fabric-pricing";

export async function getFabricPricingGlobals(): Promise<FabricPricingGlobals> {
  const pricing = await prisma.pricingSettings.findFirst();
  return {
    usdUahRate: Number(pricing?.usdUahRate ?? 45),
    fabricCargoUsdPerKg: Number(pricing?.fabricCargoUsdPerKg ?? 1.7),
    materialCostVatMode: (pricing?.materialCostVatMode ?? "NET") as MaterialCostVatMode,
  };
}

function fabricDataFromForm(
  data: MaterialFormValues,
  globals: FabricPricingGlobals,
) {
  if (data.type !== "FABRIC") {
    return {
      densityGsm: null,
      composition: null,
      metersPerKg: null,
      priceKgUsd: null,
      priceKgUsdCargo: null,
      priceKgUsdVat: null,
      priceMeterUahNoVat: null,
      priceMeterUahVat: null,
      priceMeterUahCutVat: null,
      fabricKindUk: null,
      widthCm: null,
      wholesaleNote: null,
      rollWeightKg: null,
      metersPerRoll: null,
      minWholesaleMeters: null,
      costVatOverride: null,
      purchasePrice: data.purchasePrice,
    };
  }

  const derived = deriveFabricPricing(
    {
      metersPerKg: data.metersPerKg,
      priceKgUsd: data.priceKgUsd,
      priceKgUsdCargo: data.priceKgUsdCargo,
      priceKgUsdVat: data.priceKgUsdVat,
      priceMeterUahNoVat: data.priceMeterUahNoVat,
      priceMeterUahVat: data.priceMeterUahVat,
      priceMeterUahCutVat: data.priceMeterUahCutVat,
      rollWeightKg: data.rollWeightKg,
      metersPerRoll: data.metersPerRoll,
      minWholesaleMeters: data.minWholesaleMeters,
      costVatOverride: data.costVatOverride,
    },
    globals,
  );

  const purchasePrice =
    derived.purchasePrice > 0 ? derived.purchasePrice : data.purchasePrice;

  return {
    densityGsm: data.densityGsm || null,
    composition: data.composition || null,
    metersPerKg: data.metersPerKg ?? null,
    priceKgUsd: data.priceKgUsd ?? null,
    priceKgUsdCargo: derived.priceKgUsdCargo,
    priceKgUsdVat: data.priceKgUsdVat ?? null,
    priceMeterUahNoVat: derived.priceMeterUahNoVat,
    priceMeterUahVat: derived.priceMeterUahVat,
    priceMeterUahCutVat: data.priceMeterUahCutVat ?? null,
    fabricKindUk: data.fabricKindUk || null,
    widthCm: data.widthCm || null,
    wholesaleNote: data.wholesaleNote || null,
    rollWeightKg: data.rollWeightKg ?? null,
    metersPerRoll: derived.metersPerRoll,
    minWholesaleMeters: data.minWholesaleMeters ?? derived.minWholesaleMeters,
    costVatOverride: data.costVatOverride ?? null,
    purchasePrice,
  };
}

export async function listMaterials(params?: {
  search?: string;
  status?: RecordStatus;
}) {
  const search = params?.search?.trim();
  return prisma.material.findMany({
    where: {
      status: params?.status ?? "ACTIVE",
      ...(search
        ? {
            OR: [
              { nameUk: { contains: search, mode: "insensitive" } },
              { supplierCode: { contains: search, mode: "insensitive" } },
              { composition: { contains: search, mode: "insensitive" } },
              { fabricKindUk: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      unitOfMeasure: true,
      category: true,
    },
    orderBy: { nameUk: "asc" },
  });
}

export async function findLikelyMaterialDuplicates(input: {
  nameUk: string;
  unitOfMeasureId: string;
  excludeId?: string;
}) {
  return prisma.material.findMany({
    where: {
      nameUk: { equals: input.nameUk, mode: "insensitive" },
      unitOfMeasureId: input.unitOfMeasureId,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    take: 5,
  });
}

export async function createMaterial(raw: MaterialFormValues) {
  const data = materialFormSchema.parse(raw);
  const globals = await getFabricPricingGlobals();
  const fabric = fabricDataFromForm(data, globals);

  const duplicates = await findLikelyMaterialDuplicates({
    nameUk: data.nameUk,
    unitOfMeasureId: data.unitOfMeasureId,
  });

  const material = await prisma.material.create({
    data: {
      nameUk: data.nameUk,
      type: data.type as MaterialType,
      categoryId: data.categoryId || null,
      unitOfMeasureId: data.unitOfMeasureId,
      purchasePrice: fabric.purchasePrice,
      defaultWastePercent: data.defaultWastePercent,
      supplierCode: data.supplierCode || null,
      colorOrAttribute: data.colorOrAttribute || null,
      availableColors: data.availableColors ?? [],
      note: data.note || null,
      densityGsm: fabric.densityGsm,
      composition: fabric.composition,
      metersPerKg: fabric.metersPerKg,
      priceKgUsd: fabric.priceKgUsd,
      priceKgUsdCargo: fabric.priceKgUsdCargo,
      priceKgUsdVat: fabric.priceKgUsdVat,
      priceMeterUahNoVat: fabric.priceMeterUahNoVat,
      priceMeterUahVat: fabric.priceMeterUahVat,
      priceMeterUahCutVat: fabric.priceMeterUahCutVat,
      fabricKindUk: fabric.fabricKindUk,
      widthCm: fabric.widthCm,
      wholesaleNote: fabric.wholesaleNote,
      rollWeightKg: fabric.rollWeightKg,
      metersPerRoll: fabric.metersPerRoll,
      minWholesaleMeters: fabric.minWholesaleMeters,
      costVatOverride: fabric.costVatOverride,
    },
    include: {
      unitOfMeasure: true,
      category: true,
    },
  });

  if (data.type === "FABRIC" && data.supplierCode) {
    const { syncPrimarySupplierOfferFromMaterial } = await import(
      "@/server/domains/catalog/suppliers"
    );
    await syncPrimarySupplierOfferFromMaterial({
      materialId: material.id,
      supplierNameUk: data.supplierCode,
      metersPerKg: fabric.metersPerKg != null ? Number(fabric.metersPerKg) : null,
      priceKgUsd: fabric.priceKgUsd != null ? Number(fabric.priceKgUsd) : null,
      priceKgUsdCargo:
        fabric.priceKgUsdCargo != null ? Number(fabric.priceKgUsdCargo) : null,
      priceKgUsdVat: fabric.priceKgUsdVat != null ? Number(fabric.priceKgUsdVat) : null,
      priceMeterUahNoVat:
        fabric.priceMeterUahNoVat != null ? Number(fabric.priceMeterUahNoVat) : null,
      priceMeterUahVat:
        fabric.priceMeterUahVat != null ? Number(fabric.priceMeterUahVat) : null,
      priceMeterUahCutVat:
        fabric.priceMeterUahCutVat != null ? Number(fabric.priceMeterUahCutVat) : null,
      rollWeightKg: fabric.rollWeightKg != null ? Number(fabric.rollWeightKg) : null,
      metersPerRoll: fabric.metersPerRoll != null ? Number(fabric.metersPerRoll) : null,
      minWholesaleMeters:
        fabric.minWholesaleMeters != null ? Number(fabric.minWholesaleMeters) : null,
      wholesaleNote: fabric.wholesaleNote,
      globals,
    });
  }

  return { material, duplicates };
}

export async function updateMaterial(
  id: string,
  raw: MaterialFormValues,
  options?: { preservePurchaseTerms?: boolean },
) {
  const data = materialFormSchema.parse(raw);
  const globals = await getFabricPricingGlobals();
  const fabric = fabricDataFromForm(data, globals);
  const preserve = options?.preservePurchaseTerms === true && data.type === "FABRIC";

  const duplicates = await findLikelyMaterialDuplicates({
    nameUk: data.nameUk,
    unitOfMeasureId: data.unitOfMeasureId,
    excludeId: id,
  });

  const material = await prisma.material.update({
    where: { id },
    data: {
      nameUk: data.nameUk,
      type: data.type as MaterialType,
      categoryId: data.categoryId || null,
      unitOfMeasureId: data.unitOfMeasureId,
      defaultWastePercent: data.defaultWastePercent,
      colorOrAttribute: data.colorOrAttribute || null,
      availableColors: data.availableColors ?? [],
      note: data.note || null,
      densityGsm: fabric.densityGsm,
      composition: fabric.composition,
      metersPerKg: fabric.metersPerKg,
      fabricKindUk: fabric.fabricKindUk,
      widthCm: fabric.widthCm,
      rollWeightKg: fabric.rollWeightKg,
      metersPerRoll: fabric.metersPerRoll,
      minWholesaleMeters: fabric.minWholesaleMeters,
      costVatOverride: fabric.costVatOverride,
      ...(preserve
        ? {}
        : {
            purchasePrice: fabric.purchasePrice,
            supplierCode: data.supplierCode || null,
            priceKgUsd: fabric.priceKgUsd,
            priceKgUsdCargo: fabric.priceKgUsdCargo,
            priceKgUsdVat: fabric.priceKgUsdVat,
            priceMeterUahNoVat: fabric.priceMeterUahNoVat,
            priceMeterUahVat: fabric.priceMeterUahVat,
            priceMeterUahCutVat: fabric.priceMeterUahCutVat,
            wholesaleNote: fabric.wholesaleNote,
          }),
    },
    include: {
      unitOfMeasure: true,
      category: true,
    },
  });

  if (!preserve && data.type === "FABRIC" && data.supplierCode) {
    const { syncPrimarySupplierOfferFromMaterial } = await import(
      "@/server/domains/catalog/suppliers"
    );
    await syncPrimarySupplierOfferFromMaterial({
      materialId: material.id,
      supplierNameUk: data.supplierCode,
      metersPerKg: fabric.metersPerKg != null ? Number(fabric.metersPerKg) : null,
      priceKgUsd: fabric.priceKgUsd != null ? Number(fabric.priceKgUsd) : null,
      priceKgUsdCargo:
        fabric.priceKgUsdCargo != null ? Number(fabric.priceKgUsdCargo) : null,
      priceKgUsdVat: fabric.priceKgUsdVat != null ? Number(fabric.priceKgUsdVat) : null,
      priceMeterUahNoVat:
        fabric.priceMeterUahNoVat != null ? Number(fabric.priceMeterUahNoVat) : null,
      priceMeterUahVat:
        fabric.priceMeterUahVat != null ? Number(fabric.priceMeterUahVat) : null,
      priceMeterUahCutVat:
        fabric.priceMeterUahCutVat != null ? Number(fabric.priceMeterUahCutVat) : null,
      rollWeightKg: fabric.rollWeightKg != null ? Number(fabric.rollWeightKg) : null,
      metersPerRoll: fabric.metersPerRoll != null ? Number(fabric.metersPerRoll) : null,
      minWholesaleMeters:
        fabric.minWholesaleMeters != null ? Number(fabric.minWholesaleMeters) : null,
      wholesaleNote: fabric.wholesaleNote,
      globals,
    });
  }

  return { material, duplicates };
}

export async function updateMaterialAvailableColors(id: string, colors: string[]) {
  const { mergeColorLists } = await import("@/lib/trim-colors");
  const availableColors = mergeColorLists(colors);
  return prisma.material.update({
    where: { id },
    data: { availableColors },
    select: { id: true, availableColors: true },
  });
}

/** Recompute purchasePrice for all fabrics after company VAT policy / rate change. */
export async function resyncFabricPurchasePrices() {
  const globals = await getFabricPricingGlobals();
  const fabrics = await prisma.material.findMany({
    where: { type: "FABRIC", status: "ACTIVE" },
  });

  let count = 0;
  for (const row of fabrics) {
    const hasKgBasis =
      row.priceKgUsd != null &&
      Number(row.priceKgUsd) > 0 &&
      row.metersPerKg != null &&
      Number(row.metersPerKg) > 0;
    // Material COGS only — cargo is tracked separately as delivery.
    const derived = deriveFabricPricing(
      {
        metersPerKg: row.metersPerKg != null ? Number(row.metersPerKg) : null,
        priceKgUsd: row.priceKgUsd != null ? Number(row.priceKgUsd) : null,
        priceKgUsdCargo: row.priceKgUsdCargo != null ? Number(row.priceKgUsdCargo) : null,
        priceKgUsdVat: row.priceKgUsdVat != null ? Number(row.priceKgUsdVat) : null,
        priceMeterUahNoVat: hasKgBasis
          ? null
          : row.priceMeterUahNoVat != null
            ? Number(row.priceMeterUahNoVat)
            : null,
        priceMeterUahVat: hasKgBasis
          ? null
          : row.priceMeterUahVat != null
            ? Number(row.priceMeterUahVat)
            : null,
        priceMeterUahCutVat:
          row.priceMeterUahCutVat != null ? Number(row.priceMeterUahCutVat) : null,
        rollWeightKg: row.rollWeightKg != null ? Number(row.rollWeightKg) : null,
        metersPerRoll: row.metersPerRoll != null ? Number(row.metersPerRoll) : null,
        minWholesaleMeters:
          row.minWholesaleMeters != null ? Number(row.minWholesaleMeters) : null,
        costVatOverride: row.costVatOverride,
      },
      globals,
    );
    if (derived.purchasePrice <= 0) continue;
    await prisma.material.update({
      where: { id: row.id },
      data: {
        purchasePrice: derived.purchasePrice,
        priceKgUsdCargo: derived.priceKgUsdCargo,
        priceMeterUahNoVat: derived.priceMeterUahNoVat,
        priceMeterUahVat: derived.priceMeterUahVat,
        metersPerRoll: derived.metersPerRoll,
      },
    });
    count += 1;
  }
  return { count };
}

export async function archiveMaterial(id: string) {
  return prisma.material.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
}

export async function archiveMaterials(ids: string[]) {
  if (ids.length === 0) return { count: 0 };
  return prisma.material.updateMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });
}

export async function listUnits() {
  return prisma.unitOfMeasure.findMany({
    where: { status: "ACTIVE" },
    orderBy: { code: "asc" },
  });
}

/** Distinct supplier names from active materials (for fabric form select). */
export async function listSupplierNames() {
  const rows = await prisma.material.findMany({
    where: { status: "ACTIVE", supplierCode: { not: null } },
    select: { supplierCode: true },
    distinct: ["supplierCode"],
    orderBy: { supplierCode: "asc" },
  });
  return rows
    .map((row) => row.supplierCode?.replace(/\s+/g, " ").trim())
    .filter((value): value is string => Boolean(value));
}

/** Distinct fabric compositions from active materials (for form select). */
export async function listCompositionNames() {
  const rows = await prisma.material.findMany({
    where: { status: "ACTIVE", type: "FABRIC", composition: { not: null } },
    select: { composition: true },
    distinct: ["composition"],
    orderBy: { composition: "asc" },
  });
  return rows
    .map((row) => row.composition?.replace(/\s+/g, " ").trim())
    .filter((value): value is string => Boolean(value));
}
