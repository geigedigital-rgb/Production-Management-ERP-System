import { prisma } from "@/server/db/client";
import {
  deriveFabricPricing,
  type FabricPricingGlobals,
} from "@/lib/fabric-pricing";
import { getFabricPricingGlobals } from "@/server/domains/catalog/materials";

export async function listSuppliers(params?: { search?: string }) {
  const search = params?.search?.trim();
  return prisma.supplier.findMany({
    where: {
      status: "ACTIVE",
      ...(search
        ? { nameUk: { contains: search, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: { nameUk: "asc" },
  });
}

export async function findOrCreateSupplier(input: {
  nameUk: string;
  defaultCargoUsdPerKg?: number | null;
}) {
  const nameUk = input.nameUk.replace(/\s+/g, " ").trim();
  if (!nameUk) return null;

  const existing = await prisma.supplier.findFirst({
    where: { nameUk: { equals: nameUk, mode: "insensitive" } },
  });
  if (existing) {
    if (
      input.defaultCargoUsdPerKg != null &&
      existing.defaultCargoUsdPerKg == null
    ) {
      return prisma.supplier.update({
        where: { id: existing.id },
        data: { defaultCargoUsdPerKg: input.defaultCargoUsdPerKg },
      });
    }
    return existing;
  }

  return prisma.supplier.create({
    data: {
      nameUk,
      defaultCargoUsdPerKg: input.defaultCargoUsdPerKg ?? null,
    },
  });
}

export type MaterialSupplierOfferInput = {
  supplierId?: string | null;
  supplierNameUk?: string | null;
  isPrimary?: boolean;
  metersPerKg?: number | null;
  cargoUsdPerKg?: number | null;
  priceKgUsd?: number | null;
  priceKgUsdVat?: number | null;
  priceMeterUahNoVat?: number | null;
  priceMeterUahVat?: number | null;
  priceMeterUahCutVat?: number | null;
  rollWeightKg?: number | null;
  metersPerRoll?: number | null;
  minWholesaleMeters?: number | null;
  wholesaleNote?: string | null;
};

/** Upsert primary offer from material form fields (supplier name + prices on Material). */
export async function syncPrimarySupplierOfferFromMaterial(input: {
  materialId: string;
  supplierNameUk?: string | null;
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
  wholesaleNote?: string | null;
  globals?: FabricPricingGlobals;
}) {
  const supplier = await findOrCreateSupplier({
    nameUk: input.supplierNameUk ?? "",
    defaultCargoUsdPerKg: null,
  });
  if (!supplier) return null;

  const globals = input.globals ?? (await getFabricPricingGlobals());
  const cargoUsdPerKg =
    input.priceKgUsd != null && input.priceKgUsdCargo != null
      ? Number(input.priceKgUsdCargo) - Number(input.priceKgUsd)
      : globals.fabricCargoUsdPerKg;

  const derived = deriveFabricPricing(
    {
      metersPerKg: input.metersPerKg,
      priceKgUsd: input.priceKgUsd,
      priceKgUsdCargo: input.priceKgUsdCargo,
      priceKgUsdVat: input.priceKgUsdVat,
      priceMeterUahNoVat: input.priceMeterUahNoVat,
      priceMeterUahVat: input.priceMeterUahVat,
      priceMeterUahCutVat: input.priceMeterUahCutVat,
      rollWeightKg: input.rollWeightKg,
      metersPerRoll: input.metersPerRoll,
      minWholesaleMeters: input.minWholesaleMeters,
    },
    {
      ...globals,
      fabricCargoUsdPerKg:
        cargoUsdPerKg >= 0 ? cargoUsdPerKg : globals.fabricCargoUsdPerKg,
    },
  );

  await prisma.materialSupplier.updateMany({
    where: { materialId: input.materialId, isPrimary: true },
    data: { isPrimary: false },
  });

  const offer = await prisma.materialSupplier.upsert({
    where: {
      materialId_supplierId: {
        materialId: input.materialId,
        supplierId: supplier.id,
      },
    },
    create: {
      materialId: input.materialId,
      supplierId: supplier.id,
      isPrimary: true,
      metersPerKg: input.metersPerKg ?? null,
      cargoUsdPerKg: cargoUsdPerKg >= 0 ? cargoUsdPerKg : null,
      priceKgUsd: input.priceKgUsd ?? null,
      priceKgUsdCargo: derived.priceKgUsdCargo,
      priceKgUsdVat: input.priceKgUsdVat ?? null,
      priceMeterUahNoVat: derived.priceMeterUahNoVat,
      priceMeterUahVat: derived.priceMeterUahVat,
      priceMeterUahCutVat: input.priceMeterUahCutVat ?? null,
      rollWeightKg: input.rollWeightKg ?? null,
      metersPerRoll: derived.metersPerRoll,
      minWholesaleMeters: input.minWholesaleMeters ?? derived.minWholesaleMeters,
      wholesaleNote: input.wholesaleNote ?? null,
    },
    update: {
      isPrimary: true,
      metersPerKg: input.metersPerKg ?? null,
      cargoUsdPerKg: cargoUsdPerKg >= 0 ? cargoUsdPerKg : null,
      priceKgUsd: input.priceKgUsd ?? null,
      priceKgUsdCargo: derived.priceKgUsdCargo,
      priceKgUsdVat: input.priceKgUsdVat ?? null,
      priceMeterUahNoVat: derived.priceMeterUahNoVat,
      priceMeterUahVat: derived.priceMeterUahVat,
      priceMeterUahCutVat: input.priceMeterUahCutVat ?? null,
      rollWeightKg: input.rollWeightKg ?? null,
      metersPerRoll: derived.metersPerRoll,
      minWholesaleMeters: input.minWholesaleMeters ?? derived.minWholesaleMeters,
      wholesaleNote: input.wholesaleNote ?? null,
    },
    include: { supplier: true },
  });

  await prisma.material.update({
    where: { id: input.materialId },
    data: {
      supplierCode: supplier.nameUk,
      purchasePrice: derived.purchasePrice > 0 ? derived.purchasePrice : undefined,
      priceKgUsdCargo: derived.priceKgUsdCargo,
      priceMeterUahNoVat: derived.priceMeterUahNoVat,
      priceMeterUahVat: derived.priceMeterUahVat,
      metersPerRoll: derived.metersPerRoll,
      minWholesaleMeters: input.minWholesaleMeters ?? derived.minWholesaleMeters,
    },
  });

  return offer;
}

export async function listMaterialSupplierOffers(materialId: string) {
  return prisma.materialSupplier.findMany({
    where: { materialId },
    include: { supplier: true },
    orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
  });
}

export async function upsertMaterialSupplierOffer(
  materialId: string,
  offer: MaterialSupplierOfferInput,
) {
  const supplier =
    offer.supplierId
      ? await prisma.supplier.findUniqueOrThrow({ where: { id: offer.supplierId } })
      : await findOrCreateSupplier({ nameUk: offer.supplierNameUk ?? "" });
  if (!supplier) throw new Error("SUPPLIER_REQUIRED");

  const globals = await getFabricPricingGlobals();
  const cargo =
    offer.cargoUsdPerKg ??
    (supplier.defaultCargoUsdPerKg != null
      ? Number(supplier.defaultCargoUsdPerKg)
      : globals.fabricCargoUsdPerKg);

  const derived = deriveFabricPricing(
    {
      metersPerKg: offer.metersPerKg,
      priceKgUsd: offer.priceKgUsd,
      priceKgUsdVat: offer.priceKgUsdVat,
      priceMeterUahNoVat: offer.priceMeterUahNoVat,
      priceMeterUahVat: offer.priceMeterUahVat,
      priceMeterUahCutVat: offer.priceMeterUahCutVat,
      rollWeightKg: offer.rollWeightKg,
      metersPerRoll: offer.metersPerRoll,
      minWholesaleMeters: offer.minWholesaleMeters,
    },
    { ...globals, fabricCargoUsdPerKg: cargo },
  );

  if (offer.isPrimary) {
    await prisma.materialSupplier.updateMany({
      where: { materialId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const row = await prisma.materialSupplier.upsert({
    where: {
      materialId_supplierId: { materialId, supplierId: supplier.id },
    },
    create: {
      materialId,
      supplierId: supplier.id,
      isPrimary: offer.isPrimary ?? false,
      metersPerKg: offer.metersPerKg ?? null,
      cargoUsdPerKg: cargo,
      priceKgUsd: offer.priceKgUsd ?? null,
      priceKgUsdCargo: derived.priceKgUsdCargo,
      priceKgUsdVat: offer.priceKgUsdVat ?? null,
      priceMeterUahNoVat: derived.priceMeterUahNoVat,
      priceMeterUahVat: derived.priceMeterUahVat,
      priceMeterUahCutVat: offer.priceMeterUahCutVat ?? null,
      rollWeightKg: offer.rollWeightKg ?? null,
      metersPerRoll: derived.metersPerRoll,
      minWholesaleMeters: offer.minWholesaleMeters ?? derived.minWholesaleMeters,
      wholesaleNote: offer.wholesaleNote ?? null,
    },
    update: {
      isPrimary: offer.isPrimary ?? false,
      metersPerKg: offer.metersPerKg ?? null,
      cargoUsdPerKg: cargo,
      priceKgUsd: offer.priceKgUsd ?? null,
      priceKgUsdCargo: derived.priceKgUsdCargo,
      priceKgUsdVat: offer.priceKgUsdVat ?? null,
      priceMeterUahNoVat: derived.priceMeterUahNoVat,
      priceMeterUahVat: derived.priceMeterUahVat,
      priceMeterUahCutVat: offer.priceMeterUahCutVat ?? null,
      rollWeightKg: offer.rollWeightKg ?? null,
      metersPerRoll: derived.metersPerRoll,
      minWholesaleMeters: offer.minWholesaleMeters ?? derived.minWholesaleMeters,
      wholesaleNote: offer.wholesaleNote ?? null,
    },
    include: { supplier: true },
  });

  if (row.isPrimary) {
    await prisma.material.update({
      where: { id: materialId },
      data: {
        supplierCode: supplier.nameUk,
        purchasePrice: derived.purchasePrice,
        metersPerKg: offer.metersPerKg ?? undefined,
        priceKgUsd: offer.priceKgUsd ?? undefined,
        priceKgUsdCargo: derived.priceKgUsdCargo,
        priceKgUsdVat: offer.priceKgUsdVat ?? undefined,
        priceMeterUahNoVat: derived.priceMeterUahNoVat,
        priceMeterUahVat: derived.priceMeterUahVat,
        priceMeterUahCutVat: offer.priceMeterUahCutVat ?? undefined,
        metersPerRoll: derived.metersPerRoll,
        minWholesaleMeters: offer.minWholesaleMeters ?? derived.minWholesaleMeters,
        wholesaleNote: offer.wholesaleNote ?? undefined,
      },
    });
  }

  return row;
}

export async function deleteMaterialSupplierOffer(id: string) {
  const row = await prisma.materialSupplier.findUnique({ where: { id } });
  if (!row) return;
  if (row.isPrimary) throw new Error("PRIMARY_OFFER");
  await prisma.materialSupplier.delete({ where: { id } });
}
