"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/server/auth";
import { assertSessionPermission, accessHas, getCurrentUserAccess } from "@/server/auth/access";
import {
  archiveDecoration,
  archiveDecorations,
  archiveOperation,
  archiveOperations,
  createDecoration,
  createOperation,
  updateDecoration,
  updateOperation,
} from "@/server/domains/catalog/operations";
import {
  archiveMaterial,
  archiveMaterials,
  createMaterial,
  getFabricPricingGlobals,
  listCompositionNames,
  listMaterials,
  listSupplierNames,
  listUnits,
  resyncFabricPurchasePrices,
  updateMaterial,
} from "@/server/domains/catalog/materials";
import { prisma } from "@/server/db/client";
import { materialFormSchema } from "@/server/domains/catalog/schemas";
import {
  decorationFormSchema,
  operationFormSchema,
} from "@/server/domains/catalog/operation-schemas";

export async function getMaterialsAction(search?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  return listMaterials({ search });
}

export async function getUnitsAction() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  return listUnits();
}

export async function listSupplierNamesAction() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  return listSupplierNames();
}

export async function listCompositionNamesAction() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  return listCompositionNames();
}

/** Full material payload for the edit form (avoids stale/incomplete table-row props). */
export async function getMaterialForEditAction(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  if (!id) return { ok: false as const, error: "VALIDATION" as const };

  const [row, fabricGlobals] = await Promise.all([
    prisma.material.findUnique({
      where: { id },
      include: { unitOfMeasure: true },
    }),
    getFabricPricingGlobals(),
  ]);

  if (!row || row.status === "ARCHIVED") {
    return { ok: false as const, error: "NOT_FOUND" as const };
  }

  return {
    ok: true as const,
    fabricGlobals,
    material: {
      id: row.id,
      nameUk: row.nameUk,
      type: row.type,
      unitOfMeasureId: row.unitOfMeasureId,
      purchasePrice: Number(row.purchasePrice),
      defaultWastePercent: Number(row.defaultWastePercent),
      supplierCode: row.supplierCode ?? "",
      colorOrAttribute: row.colorOrAttribute ?? "",
      note: row.note ?? "",
      densityGsm: row.densityGsm ?? "",
      composition: row.composition ?? "",
      metersPerKg: row.metersPerKg != null ? Number(row.metersPerKg) : null,
      priceKgUsd: row.priceKgUsd != null ? Number(row.priceKgUsd) : null,
      priceKgUsdCargo: row.priceKgUsdCargo != null ? Number(row.priceKgUsdCargo) : null,
      priceKgUsdVat: row.priceKgUsdVat != null ? Number(row.priceKgUsdVat) : null,
      priceMeterUahNoVat:
        row.priceMeterUahNoVat != null ? Number(row.priceMeterUahNoVat) : null,
      priceMeterUahVat: row.priceMeterUahVat != null ? Number(row.priceMeterUahVat) : null,
      priceMeterUahCutVat:
        row.priceMeterUahCutVat != null ? Number(row.priceMeterUahCutVat) : null,
      fabricKindUk: row.fabricKindUk ?? "",
      widthCm: row.widthCm ?? "",
      wholesaleNote: row.wholesaleNote ?? "",
      rollWeightKg: row.rollWeightKg != null ? Number(row.rollWeightKg) : null,
      metersPerRoll: row.metersPerRoll != null ? Number(row.metersPerRoll) : null,
      minWholesaleMeters:
        row.minWholesaleMeters != null ? Number(row.minWholesaleMeters) : null,
      costVatOverride: row.costVatOverride,
    },
  };
}

export async function createMaterialAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const parsed = materialFormSchema.safeParse(materialFormData(formData));

  if (!parsed.success) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  await syncFabricGlobalsFromForm(formData);

  const result = await createMaterial(parsed.data);
  revalidatePath("/settings/resources");
  revalidatePath("/settings/pricing");
  revalidatePath("/orders");
  return {
    ok: true as const,
    materialId: result.material.id,
    hasDuplicates: result.duplicates.length > 0,
    material: {
      id: result.material.id,
      nameUk: result.material.nameUk,
      unit: result.material.unitOfMeasure.code,
      price: Number(result.material.purchasePrice),
      defaultWaste: Number(result.material.defaultWastePercent),
      materialType: result.material.type,
      priceMeterUahNoVat:
        result.material.priceMeterUahNoVat != null
          ? Number(result.material.priceMeterUahNoVat)
          : null,
      priceMeterUahVat:
        result.material.priceMeterUahVat != null
          ? Number(result.material.priceMeterUahVat)
          : null,
      priceMeterUahCutVat:
        result.material.priceMeterUahCutVat != null
          ? Number(result.material.priceMeterUahCutVat)
          : null,
      metersPerRoll:
        result.material.metersPerRoll != null ? Number(result.material.metersPerRoll) : null,
      minWholesaleMeters:
        result.material.minWholesaleMeters != null
          ? Number(result.material.minWholesaleMeters)
          : null,
      costVatOverride: result.material.costVatOverride,
    },
  };
}

export async function updateMaterialAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const id = String(formData.get("id") || "");
  if (!id) return { ok: false as const, error: "VALIDATION" as const };

  const parsed = materialFormSchema.safeParse(materialFormData(formData));

  if (!parsed.success) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  await syncFabricGlobalsFromForm(formData);

  const result = await updateMaterial(id, parsed.data);
  revalidatePath("/settings/resources");
  revalidatePath("/settings/pricing");
  revalidatePath("/orders");
  revalidatePath("/products");
  return { ok: true as const, materialId: result.material.id };
}

/** Persist course/cargo from the material form into shared PricingSettings. */
async function syncFabricGlobalsFromForm(formData: FormData) {
  const access = await getCurrentUserAccess();
  if (!access) return;
  if (
    !accessHas(access, "createInlineCatalog") &&
    !accessHas(access, "managePricingRules")
  ) {
    return;
  }

  const usdUahRate = Number(formData.get("usdUahRate"));
  const fabricCargoUsdPerKg = Number(formData.get("fabricCargoUsdPerKg"));
  if (!Number.isFinite(usdUahRate) || usdUahRate <= 0) return;
  if (!Number.isFinite(fabricCargoUsdPerKg) || fabricCargoUsdPerKg < 0) return;

  const existing = await prisma.pricingSettings.findFirst();
  if (!existing) return;

  const sameRate = Number(existing.usdUahRate) === usdUahRate;
  const sameCargo = Number(existing.fabricCargoUsdPerKg) === fabricCargoUsdPerKg;
  if (sameRate && sameCargo) return;

  await prisma.pricingSettings.update({
    where: { id: existing.id },
    data: { usdUahRate, fabricCargoUsdPerKg },
  });
  await resyncFabricPurchasePrices();
}

function materialFormData(formData: FormData) {
  return {
    nameUk: formData.get("nameUk"),
    type: formData.get("type"),
    categoryId: formData.get("categoryId") || null,
    unitOfMeasureId: formData.get("unitOfMeasureId"),
    purchasePrice: formData.get("purchasePrice"),
    defaultWastePercent: formData.get("defaultWastePercent") || 0,
    supplierCode: formData.get("supplierCode") || null,
    colorOrAttribute: formData.get("colorOrAttribute") || null,
    note: formData.get("note") || null,
    densityGsm: formData.get("densityGsm") || null,
    composition: formData.get("composition") || null,
    metersPerKg: formData.get("metersPerKg"),
    priceKgUsd: formData.get("priceKgUsd"),
    priceKgUsdCargo: formData.get("priceKgUsdCargo"),
    priceKgUsdVat: formData.get("priceKgUsdVat"),
    priceMeterUahNoVat: formData.get("priceMeterUahNoVat"),
    priceMeterUahVat: formData.get("priceMeterUahVat"),
    priceMeterUahCutVat: formData.get("priceMeterUahCutVat"),
    fabricKindUk: formData.get("fabricKindUk") || null,
    widthCm: formData.get("widthCm") || null,
    wholesaleNote: formData.get("wholesaleNote") || null,
    rollWeightKg: formData.get("rollWeightKg"),
    metersPerRoll: formData.get("metersPerRoll"),
    minWholesaleMeters: formData.get("minWholesaleMeters"),
    costVatOverride: formData.get("costVatOverride") || null,
  };
}

export async function archiveMaterialAction(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("archiveRecords");

  await archiveMaterial(id);
  revalidatePath("/settings/resources");
  return { ok: true as const };
}

export async function createOperationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const parsed = operationFormSchema.safeParse({
    nameUk: formData.get("nameUk"),
    categoryId: formData.get("categoryId") || null,
    calculationMethod: formData.get("calculationMethod") || "UNIT_RATE",
    baseRate: formData.get("baseRate") || null,
    shiftCost: formData.get("shiftCost") || null,
    standardOutputPerShift: formData.get("standardOutputPerShift") || null,
    note: formData.get("note") || null,
  });

  if (!parsed.success) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  const operation = await createOperation(parsed.data);
  revalidatePath("/settings/operations");
  revalidatePath("/orders");
  return {
    ok: true as const,
    operationId: operation.id,
    operation: {
      id: operation.id,
      nameUk: operation.nameUk,
      method: operation.calculationMethod,
      unitRate: operation.baseRate != null ? Number(operation.baseRate) : null,
      shiftCost: operation.shiftCost != null ? Number(operation.shiftCost) : null,
      standardOutput:
        operation.standardOutputPerShift != null
          ? Number(operation.standardOutputPerShift)
          : null,
    },
  };
}

export async function updateOperationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const id = String(formData.get("id") || "");
  if (!id) return { ok: false as const, error: "VALIDATION" as const };

  const parsed = operationFormSchema.safeParse({
    nameUk: formData.get("nameUk"),
    categoryId: formData.get("categoryId") || null,
    calculationMethod: formData.get("calculationMethod") || "UNIT_RATE",
    baseRate: formData.get("baseRate") || null,
    shiftCost: formData.get("shiftCost") || null,
    standardOutputPerShift: formData.get("standardOutputPerShift") || null,
    note: formData.get("note") || null,
  });

  if (!parsed.success) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  const operation = await updateOperation(id, parsed.data);
  revalidatePath("/settings/operations");
  revalidatePath("/orders");
  revalidatePath("/products");
  return { ok: true as const, operationId: operation.id };
}

export async function archiveOperationAction(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("archiveRecords");
  await archiveOperation(id);
  revalidatePath("/settings/operations");
  return { ok: true as const };
}

export async function createDecorationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const parsed = decorationFormSchema.safeParse({
    nameUk: formData.get("nameUk"),
    calculationUnit: formData.get("calculationUnit"),
    setupCost: formData.get("setupCost") || 0,
    unitRate: formData.get("unitRate") || 0,
    note: formData.get("note") || null,
  });

  if (!parsed.success) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  const decoration = await createDecoration(parsed.data);
  revalidatePath("/settings/applications");
  revalidatePath("/orders");
  return {
    ok: true as const,
    decorationId: decoration.id,
    decoration: {
      id: decoration.id,
      nameUk: decoration.nameUk,
      setupCost: Number(decoration.setupCost),
      unitRate: Number(decoration.unitRate),
    },
  };
}

export async function updateDecorationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("createInlineCatalog");

  const id = String(formData.get("id") || "");
  if (!id) return { ok: false as const, error: "VALIDATION" as const };

  const parsed = decorationFormSchema.safeParse({
    nameUk: formData.get("nameUk"),
    calculationUnit: formData.get("calculationUnit"),
    setupCost: formData.get("setupCost") || 0,
    unitRate: formData.get("unitRate") || 0,
    note: formData.get("note") || null,
  });

  if (!parsed.success) {
    return { ok: false as const, error: "VALIDATION" as const };
  }

  const decoration = await updateDecoration(id, parsed.data);
  revalidatePath("/settings/applications");
  revalidatePath("/orders");
  revalidatePath("/products");
  return { ok: true as const, decorationId: decoration.id };
}

export async function archiveDecorationAction(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("archiveRecords");
  await archiveDecoration(id);
  revalidatePath("/settings/applications");
  return { ok: true as const };
}

function parseIds(formData: FormData) {
  return formData
    .getAll("ids")
    .map(String)
    .filter(Boolean);
}

export async function bulkArchiveMaterialsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("archiveRecords");

  const ids = parseIds(formData);
  if (ids.length === 0) return { ok: false as const, error: "EMPTY" as const };

  const result = await archiveMaterials(ids);
  revalidatePath("/settings/resources");
  revalidatePath("/orders");
  return { ok: true as const, count: result.count };
}

export async function bulkArchiveOperationsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("archiveRecords");

  const ids = parseIds(formData);
  if (ids.length === 0) return { ok: false as const, error: "EMPTY" as const };

  const result = await archiveOperations(ids);
  revalidatePath("/settings/operations");
  revalidatePath("/orders");
  return { ok: true as const, count: result.count };
}

export async function bulkArchiveDecorationsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  await assertSessionPermission("archiveRecords");

  const ids = parseIds(formData);
  if (ids.length === 0) return { ok: false as const, error: "EMPTY" as const };

  const result = await archiveDecorations(ids);
  revalidatePath("/settings/applications");
  revalidatePath("/orders");
  return { ok: true as const, count: result.count };
}

export async function upsertMaterialSupplierOfferAction(formData: FormData) {
  await assertSessionPermission("createInlineCatalog");
  const materialId = String(formData.get("materialId") ?? "");
  if (!materialId) return { ok: false as const, error: "INVALID" as const };

  const { upsertMaterialSupplierOffer } = await import("@/server/domains/catalog/suppliers");
  await upsertMaterialSupplierOffer(materialId, {
    supplierNameUk: String(formData.get("supplierNameUk") ?? "") || null,
    isPrimary: formData.get("isPrimary") === "1",
    metersPerKg: formData.get("metersPerKg")
      ? Number(formData.get("metersPerKg"))
      : null,
    cargoUsdPerKg: formData.get("cargoUsdPerKg")
      ? Number(formData.get("cargoUsdPerKg"))
      : null,
    priceKgUsd: formData.get("priceKgUsd") ? Number(formData.get("priceKgUsd")) : null,
    priceKgUsdVat: formData.get("priceKgUsdVat")
      ? Number(formData.get("priceKgUsdVat"))
      : null,
    priceMeterUahCutVat: formData.get("priceMeterUahCutVat")
      ? Number(formData.get("priceMeterUahCutVat"))
      : null,
    minWholesaleMeters: formData.get("minWholesaleMeters")
      ? Number(formData.get("minWholesaleMeters"))
      : null,
  });
  revalidatePath("/settings/resources");
  return { ok: true as const };
}

export async function deleteMaterialSupplierOfferAction(formData: FormData) {
  await assertSessionPermission("createInlineCatalog");
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, error: "INVALID" as const };
  const { deleteMaterialSupplierOffer } = await import("@/server/domains/catalog/suppliers");
  try {
    await deleteMaterialSupplierOffer(id);
  } catch {
    return { ok: false as const, error: "PRIMARY_OFFER" as const };
  }
  revalidatePath("/settings/resources");
  return { ok: true as const };
}

export async function listMaterialSupplierOffersAction(materialId: string) {
  await assertSessionPermission("createInlineCatalog");
  const { listMaterialSupplierOffers } = await import("@/server/domains/catalog/suppliers");
  const offers = await listMaterialSupplierOffers(materialId);
  return {
    ok: true as const,
    offers: offers.map((row) => ({
      id: row.id,
      isPrimary: row.isPrimary,
      supplierName: row.supplier.nameUk,
      priceKgUsd: row.priceKgUsd != null ? Number(row.priceKgUsd) : null,
      priceMeterUahCutVat:
        row.priceMeterUahCutVat != null ? Number(row.priceMeterUahCutVat) : null,
      purchaseHint:
        row.priceMeterUahCutVat != null
          ? Number(row.priceMeterUahCutVat)
          : row.priceMeterUahNoVat != null
            ? Number(row.priceMeterUahNoVat)
            : null,
    })),
  };
}
