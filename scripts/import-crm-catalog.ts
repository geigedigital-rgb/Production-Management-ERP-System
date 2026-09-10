/**
 * Import CRM catalog CSVs only (fabrics, trims, models).
 * Does not wipe company/users or create demo orders/clients.
 *
 * Usage: npx tsx scripts/import-crm-catalog.ts
 */
import { config } from "dotenv";
import { hash } from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { seedCrmCatalog } from "../prisma/catalog/seed-catalog";
import { loadFabrics } from "../prisma/catalog/from-csv";
import { testNameVariants } from "../prisma/catalog/test-marker";

config({ path: ".env.local" });
config();

async function upsertCategory(prisma: PrismaClient, kind: string, nameUk: string) {
  return prisma.category.upsert({
    where: { kind_nameUk: { kind, nameUk } },
    update: { status: "ACTIVE" },
    create: { kind, nameUk },
  });
}

async function upsertMaterial(
  prisma: PrismaClient,
  data: {
    nameUk: string;
    type: "FABRIC" | "OTHER_MATERIAL" | "TRIM";
    categoryId: string | null;
    unitOfMeasureId: string;
    purchasePrice: number;
    defaultWastePercent: number;
    supplierCode?: string;
    colorOrAttribute?: string;
    note?: string;
    status?: "ACTIVE" | "ARCHIVED";
    densityGsm?: string | null;
    composition?: string | null;
    metersPerKg?: number | null;
    priceKgUsd?: number | null;
    priceKgUsdCargo?: number | null;
    priceKgUsdVat?: number | null;
    priceMeterUahNoVat?: number | null;
    priceMeterUahVat?: number | null;
    priceMeterUahCutVat?: number | null;
    fabricKindUk?: string | null;
    widthCm?: string | null;
    wholesaleNote?: string | null;
    rollWeightKg?: number | null;
    metersPerRoll?: number | null;
    legacyNames?: string[];
    availableColors?: string[];
  },
) {
  const legacyOnly = [
    ...new Set((data.legacyNames ?? []).flatMap((name) => testNameVariants(name))),
  ].filter(Boolean);

  let existing =
    data.type === "FABRIC"
      ? await prisma.material.findFirst({
          where: {
            type: "FABRIC",
            nameUk: data.nameUk,
            supplierCode: data.supplierCode ?? null,
            densityGsm: data.densityGsm ?? null,
          },
        })
      : await prisma.material.findFirst({
          where: {
            type: "TRIM",
            OR: [
              { nameUk: { in: testNameVariants(data.nameUk) } },
              { nameUk: { startsWith: `${data.nameUk} ·` } },
            ],
          },
        });

  if (!existing && legacyOnly.length > 0) {
    existing = await prisma.material.findFirst({
      where: { nameUk: { in: legacyOnly } },
    });
  }

  const fabricFields = {
    densityGsm: data.densityGsm ?? null,
    composition: data.composition ?? null,
    metersPerKg: data.metersPerKg ?? null,
    priceKgUsd: data.priceKgUsd ?? null,
    priceKgUsdCargo: data.priceKgUsdCargo ?? null,
    priceKgUsdVat: data.priceKgUsdVat ?? null,
    priceMeterUahNoVat: data.priceMeterUahNoVat ?? null,
    priceMeterUahVat: data.priceMeterUahVat ?? null,
    priceMeterUahCutVat: data.priceMeterUahCutVat ?? null,
    fabricKindUk: data.fabricKindUk ?? null,
    widthCm: data.widthCm ?? null,
    wholesaleNote: data.wholesaleNote ?? null,
    rollWeightKg: data.rollWeightKg ?? null,
    metersPerRoll: data.metersPerRoll ?? null,
  };

  const availableColors = data.availableColors ?? [];

  if (existing) {
    const mergedColors = [
      ...new Set([...(existing.availableColors ?? []), ...availableColors]),
    ];
    return prisma.material.update({
      where: { id: existing.id },
      data: {
        nameUk: data.nameUk,
        type: data.type,
        categoryId: data.categoryId,
        unitOfMeasureId: data.unitOfMeasureId,
        purchasePrice: data.purchasePrice,
        defaultWastePercent: data.defaultWastePercent,
        supplierCode: data.supplierCode ?? null,
        colorOrAttribute: data.colorOrAttribute ?? null,
        note: data.note ?? null,
        status: data.status ?? "ACTIVE",
        availableColors: mergedColors,
        ...fabricFields,
      },
    });
  }

  return prisma.material.create({
    data: {
      nameUk: data.nameUk,
      type: data.type,
      categoryId: data.categoryId,
      unitOfMeasureId: data.unitOfMeasureId,
      purchasePrice: data.purchasePrice,
      defaultWastePercent: data.defaultWastePercent,
      supplierCode: data.supplierCode ?? null,
      colorOrAttribute: data.colorOrAttribute ?? null,
      note: data.note ?? null,
      status: data.status ?? "ACTIVE",
      availableColors,
      ...fabricFields,
    },
  });
}

async function upsertOperation(
  prisma: PrismaClient,
  data: {
    nameUk: string;
    categoryId: string | null;
    calculationMethod: "UNIT_RATE" | "SHIFT_OUTPUT" | "QUANTITY_TIER";
    baseRate?: number | null;
    note?: string;
  },
) {
  const variants = testNameVariants(data.nameUk);
  const existing = await prisma.operation.findFirst({
    where: { nameUk: { in: variants } },
  });
  if (existing) {
    return prisma.operation.update({
      where: { id: existing.id },
      data: {
        nameUk: data.nameUk,
        categoryId: data.categoryId,
        calculationMethod: data.calculationMethod,
        baseRate: data.baseRate ?? null,
        note: data.note ?? null,
        status: "ACTIVE",
      },
    });
  }
  return prisma.operation.create({
    data: {
      nameUk: data.nameUk,
      categoryId: data.categoryId,
      calculationMethod: data.calculationMethod,
      baseRate: data.baseRate ?? null,
      note: data.note ?? null,
    },
  });
}

async function upsertDecoration(
  prisma: PrismaClient,
  data: {
    nameUk: string;
    calculationUnit: string;
    setupCost: number;
    unitRate: number;
  },
) {
  const variants = testNameVariants(data.nameUk);
  const existing = await prisma.decorationMethod.findFirst({
    where: { nameUk: { in: variants } },
  });
  if (existing) {
    return prisma.decorationMethod.update({
      where: { id: existing.id },
      data: {
        nameUk: data.nameUk,
        calculationUnit: data.calculationUnit,
        setupCost: data.setupCost,
        unitRate: data.unitRate,
        status: "ACTIVE",
      },
    });
  }
  return prisma.decorationMethod.create({ data });
}

async function ensureSupplierOffers(prisma: PrismaClient) {
  const fabrics = await prisma.material.findMany({
    where: { type: "FABRIC", status: "ACTIVE", supplierCode: { not: null } },
    select: {
      id: true,
      supplierCode: true,
      metersPerKg: true,
      priceKgUsd: true,
      priceKgUsdCargo: true,
      priceKgUsdVat: true,
      priceMeterUahNoVat: true,
      priceMeterUahVat: true,
      priceMeterUahCutVat: true,
      rollWeightKg: true,
      metersPerRoll: true,
      wholesaleNote: true,
    },
  });

  const names = [
    ...new Set(
      fabrics
        .map((row) => row.supplierCode?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  for (const nameUk of names) {
    const supplier =
      (await prisma.supplier.findFirst({ where: { nameUk } })) ??
      (await prisma.supplier.create({ data: { nameUk, status: "ACTIVE" } }));

    for (const fabric of fabrics.filter((row) => row.supplierCode?.trim() === nameUk)) {
      const existing = await prisma.materialSupplier.findUnique({
        where: {
          materialId_supplierId: { materialId: fabric.id, supplierId: supplier.id },
        },
      });
      const data = {
        isPrimary: true,
        metersPerKg: fabric.metersPerKg,
        priceKgUsd: fabric.priceKgUsd,
        priceKgUsdCargo: fabric.priceKgUsdCargo,
        priceKgUsdVat: fabric.priceKgUsdVat,
        priceMeterUahNoVat: fabric.priceMeterUahNoVat,
        priceMeterUahVat: fabric.priceMeterUahVat,
        priceMeterUahCutVat: fabric.priceMeterUahCutVat,
        rollWeightKg: fabric.rollWeightKg,
        metersPerRoll: fabric.metersPerRoll,
        wholesaleNote: fabric.wholesaleNote,
      };
      if (existing) {
        await prisma.materialSupplier.update({ where: { id: existing.id }, data });
      } else {
        await prisma.materialSupplier.create({
          data: { materialId: fabric.id, supplierId: supplier.id, ...data },
        });
      }
    }
  }

  return names.length;
}

async function main() {
  const { prisma } = await import("../src/server/db/client");

  // Keep company; ensure login user exists
  const company = await prisma.companySettings.findFirst();
  if (!company) {
    await prisma.companySettings.create({
      data: {
        legalName: "ТОВ «Текстиль Пром»",
        address: "м. Київ, вул. Індустріальна, 12",
        phone: "+380 44 500 12 34",
        email: "sales@tekstyl-prom.ua",
        taxId: "41234567",
      },
    });
  }

  if ((await prisma.user.count()) === 0) {
    await prisma.user.create({
      data: {
        email: "admin@local",
        login: "admin",
        name: "Адміністратор",
        passwordHash: await hash("admin123", 10),
        role: "ADMINISTRATOR",
        permissions: [],
      },
    });
  }

  for (const unit of [
    { code: "m", nameUk: "м.п." },
    { code: "pcs", nameUk: "шт" },
    { code: "kg", nameUk: "кг" },
    { code: "cone", nameUk: "бобіна" },
  ]) {
    await prisma.unitOfMeasure.upsert({
      where: { code: unit.code },
      update: { nameUk: unit.nameUk, status: "ACTIVE" },
      create: unit,
    });
  }

  for (const size of [
    { code: "XS", nameUk: "XS", sortOrder: 1 },
    { code: "S", nameUk: "S", sortOrder: 2 },
    { code: "M", nameUk: "M", sortOrder: 3 },
    { code: "L", nameUk: "L", sortOrder: 4 },
    { code: "XL", nameUk: "XL", sortOrder: 5 },
    { code: "XXL", nameUk: "XXL", sortOrder: 6 },
    { code: "3XL", nameUk: "3XL", sortOrder: 7 },
    { code: "4XL", nameUk: "4XL", sortOrder: 8 },
    { code: "5XL", nameUk: "5XL", sortOrder: 9 },
    { code: "6XL", nameUk: "6XL", sortOrder: 10 },
  ]) {
    await prisma.size.upsert({
      where: { code: size.code },
      update: { nameUk: size.nameUk, sortOrder: size.sortOrder, status: "ACTIVE" },
      create: size,
    });
  }

  const { usdUah, cargoUsd, skipped: fabricsSkipped } = loadFabrics({
    materialCostVatMode: "NET",
  });

  const pricing = await prisma.pricingSettings.findFirst();
  if (pricing) {
    await prisma.pricingSettings.update({
      where: { id: pricing.id },
      data: { usdUahRate: usdUah, fabricCargoUsdPerKg: cargoUsd },
    });
  } else {
    await prisma.pricingSettings.create({
      data: {
        pricingMethod: "MARGIN",
        targetMarginPercent: 30,
        minimumMarginPercent: 15,
        managerMaxDiscountPercent: 5,
        roundingRule: "ROUND_2",
        usdUahRate: usdUah,
        fabricCargoUsdPerKg: cargoUsd,
        inputVatRatePercent: 20,
        materialCostVatMode: "NET",
      },
    });
  }

  const unitByCode = Object.fromEntries(
    (await prisma.unitOfMeasure.findMany()).map((u) => [u.code, u]),
  );
  const sizeByCode = Object.fromEntries((await prisma.size.findMany()).map((s) => [s.code, s]));

  const catCut = await upsertCategory(prisma, "operation", "Розкрій");
  const catSew = await upsertCategory(prisma, "operation", "Пошив");
  const catPack = await upsertCategory(prisma, "operation", "Пакування");

  const opCut = await upsertOperation(prisma, {
    nameUk: "Розкрій",
    categoryId: catCut.id,
    calculationMethod: "UNIT_RATE",
    baseRate: 5,
  });
  const opSew = await upsertOperation(prisma, {
    nameUk: "Пошив",
    categoryId: catSew.id,
    calculationMethod: "UNIT_RATE",
    baseRate: 30,
  });
  const opPack = await upsertOperation(prisma, {
    nameUk: "Пакування",
    categoryId: catPack.id,
    calculationMethod: "UNIT_RATE",
    baseRate: 4,
  });

  const print1c = await upsertDecoration(prisma, {
    nameUk: "Друк 1 колір",
    calculationUnit: "шт",
    setupCost: 350,
    unitRate: 18,
  });
  const embroidery = await upsertDecoration(prisma, {
    nameUk: "Вишивка логотипу",
    calculationUnit: "шт",
    setupCost: 500,
    unitRate: 35,
  });
  const dtf = await upsertDecoration(prisma, {
    nameUk: "DTF нанесення",
    calculationUnit: "шт",
    setupCost: 200,
    unitRate: 28,
  });

  console.log("Sheet globals → pricing:", { usdUah, cargoUsd });
  console.log(
    "Fabrics without meter price (skipped):",
    fabricsSkipped.map((row) => row.name).join(", ") || "(none)",
  );

  const catalog = await seedCrmCatalog({
    prisma,
    upsertMaterial,
    upsertCategory,
    unitByCode,
    sizeByCode,
    opCutId: opCut.id,
    opSewId: opSew.id,
    opPackId: opPack.id,
    decorations: {
      print1cId: print1c.id,
      embroideryId: embroidery.id,
      dtfId: dtf.id,
    },
  });

  const supplierCount = await ensureSupplierOffers(prisma);

  const counts = {
    products: await prisma.product.count({ where: { status: "ACTIVE" } }),
    fabrics: await prisma.material.count({ where: { type: "FABRIC", status: "ACTIVE" } }),
    trims: await prisma.material.count({ where: { type: "TRIM", status: "ACTIVE" } }),
    suppliers: await prisma.supplier.count(),
    materialOffers: await prisma.materialSupplier.count(),
    company: (await prisma.companySettings.findFirst())?.legalName,
  };

  console.log("Import stats:", catalog.stats);
  if (catalog.skippedNotes.length) {
    console.log("Notes:", catalog.skippedNotes.slice(0, 20));
  }
  console.log("Suppliers upserted from fabric sheet:", supplierCount);
  console.log("DB after:", counts);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
