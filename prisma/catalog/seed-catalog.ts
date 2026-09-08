import type { PrismaClient } from "@prisma/client";
import {
  findFabric,
  loadFabrics,
  loadModels,
  loadTrims,
  type ParsedFabric,
  type ParsedModel,
} from "./from-csv";
import { testNameVariants, withTestMarker } from "./test-marker";

type UpsertMaterial = (
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
    availableColors?: string[];
    legacyNames?: string[];
  },
) => Promise<{ id: string; nameUk: string }>;

type UpsertCategory = (
  prisma: PrismaClient,
  kind: string,
  nameUk: string,
) => Promise<{ id: string; nameUk: string }>;

const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  футболка: "Футболки",
  поло: "Поло",
  світшоти: "Світшоти",
  худі: "Худі",
  лосіни: "Лосіни",
  шорти: "Шорти",
  "флісова кофта": "Флісові кофти",
  кофта: "Кофти",
  штани: "Штани",
  фартухи: "Фартухи",
  кітелі: "Кітелі",
  "головні убори": "Головні убори",
  блузи: "Блузи",
  жилеткі: "Жилетки",
  сорочки: "Сорочки",
  халати: "Халати",
  куртки: "Куртки",
  "сумки та рюкзаки": "Сумки та рюкзаки",
  косметички: "Косметички",
  чохли: "Чохли",
  інше: "Інше",
};

const OLD_DEMO_MATERIAL_NAMES = [
  "Кулір 180 г/м² чорний",
  "Піке 200 г/м² navy",
  "Фліс 280 г/м² графіт",
  "Рибана 1×1 чорна",
  "Нитки поліестер 40/2",
  "Етикетка ткана логотип",
  "Бірка картонна + нитка",
  "Блискавка спіральна 70 см",
  "Кулір 160 г/м² (архів)",
];

const ETALON_ALIASES = {
  "SEED-TS-BASIC": {
    matchName: /^футболка класична чол$/i,
    imageUrl:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
  },
  "SEED-POLO": {
    matchName: /^поло/i,
    imageUrl:
      "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?auto=format&fit=crop&w=800&q=80",
  },
  "SEED-HOODIE": {
    matchName: /^худі класичне на застібку/i,
    imageUrl:
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80",
  },
} as const;

function fabricNote(row: ParsedFabric) {
  return [
    row.fabricKindUk ? `Тип: ${row.fabricKindUk}` : null,
    row.wholesaleNote ? `Гурт: ${row.wholesaleNote}` : null,
    "Ціни з/без ПДВ і $/кг збережені в картці матеріалу",
  ]
    .filter(Boolean)
    .join(" · ");
}

function capitalizeCategory(raw: string) {
  const key = raw.trim().toLowerCase();
  return PRODUCT_CATEGORY_LABELS[key] ?? (raw.trim() || "Інше");
}

export type CatalogSeedResult = {
  products: Record<string, { id: string; internalCode: string | null; nameUk: string }>;
  stats: {
    fabrics: number;
    fabricsSkipped: number;
    trims: number;
    trimsSkipped: number;
    models: number;
    modelsSkipped: number;
  };
  skippedNotes: string[];
};

/**
 * Imports CRM CSV catalogs into materials + products.
 * Keeps SEED-TS-BASIC / SEED-POLO / SEED-HOODIE as etalon aliases with BOM for demo orders.
 */
export async function seedCrmCatalog(args: {
  prisma: PrismaClient;
  upsertMaterial: UpsertMaterial;
  upsertCategory: UpsertCategory;
  unitByCode: Record<string, { id: string }>;
  sizeByCode: Record<string, { id: string }>;
  opCutId: string;
  opSewId: string;
  opPackId: string;
  decorations: {
    print1cId: string;
    embroideryId: string;
    dtfId: string;
  };
}): Promise<CatalogSeedResult> {
  const { prisma, upsertMaterial, upsertCategory, unitByCode, sizeByCode } = args;
  const { fabrics, skipped: fabricsSkipped, usdUah, cargoUsd } = loadFabrics({
    materialCostVatMode: "NET",
  });
  void usdUah;
  void cargoUsd;
  const { trims, skipped: trimsSkipped } = loadTrims();
  const { models, skipped: modelsSkipped } = loadModels();

  const materialCategoryIds = new Map<string, string>();
  async function materialCategory(nameUk: string) {
    const key = nameUk.trim() || "Інше";
    const cached = materialCategoryIds.get(key);
    if (cached) return cached;
    const row = await upsertCategory(prisma, "material", key);
    materialCategoryIds.set(key, row.id);
    return row.id;
  }

  const productCategoryIds = new Map<string, string>();
  async function productCategory(raw: string) {
    const nameUk = capitalizeCategory(raw);
    const cached = productCategoryIds.get(nameUk);
    if (cached) return cached;
    const row = await upsertCategory(prisma, "product", nameUk);
    productCategoryIds.set(nameUk, row.id);
    return row.id;
  }

  const materialByName = new Map<string, { id: string; nameUk: string }>();

  for (const fabric of fabrics) {
    const material = await upsertMaterial(prisma, {
      nameUk: fabric.nameUk,
      type: "FABRIC",
      categoryId: await materialCategory(fabric.category),
      unitOfMeasureId: unitByCode.m!.id,
      purchasePrice: fabric.pricePerMeter,
      defaultWastePercent: 5,
      supplierCode: fabric.supplier ?? undefined,
      colorOrAttribute: undefined,
      note: fabricNote(fabric),
      status: "ACTIVE",
      densityGsm: fabric.density,
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
      legacyNames: [fabric.legacyNameUk],
    });
    materialByName.set(fabric.nameUk, material);
    materialByName.set(fabric.legacyNameUk, material);
    materialByName.set(fabric.key, material);
  }

  // Archive leftover concatenated titles from older seeds (name · dens · supplier)
  const legacyTitled = await prisma.material.findMany({
    where: { type: "FABRIC", status: "ACTIVE", nameUk: { contains: " · " } },
    select: { id: true, nameUk: true },
  });
  for (const row of legacyTitled) {
    await prisma.material.update({
      where: { id: row.id },
      data: {
        status: "ARCHIVED",
        note: "Архів: назва містила параметри; актуальний запис — окремі поля dens/склад/постачальник",
      },
    });
  }

  for (const trim of trims) {
    const unitId =
      trim.unitCode === "m"
        ? unitByCode.m!.id
        : trim.unitCode === "cone"
          ? unitByCode.cone!.id
          : unitByCode.pcs!.id;
    const material = await upsertMaterial(prisma, {
      nameUk: trim.nameUk,
      type: "TRIM",
      categoryId: await materialCategory(trim.category),
      unitOfMeasureId: unitId,
      purchasePrice: trim.purchasePrice,
      defaultWastePercent: trim.unitCode === "pcs" ? 1 : 2,
      supplierCode: trim.supplierCode ?? undefined,
      colorOrAttribute: trim.colorOrAttribute ?? undefined,
      note: trim.packNote ? `Упаковка: ${trim.packNote}` : undefined,
      status: "ACTIVE",
      availableColors: trim.availableColors,
    });
    materialByName.set(trim.nameUk, material);
  }

  // Archive pre-CSV demo materials (not from CRM files) and mark them [ТЕСТ]
  for (const nameUk of OLD_DEMO_MATERIAL_NAMES) {
    if (materialByName.has(nameUk)) continue;
    const variants = testNameVariants(nameUk);
    const existing = await prisma.material.findFirst({
      where: { nameUk: { in: variants } },
    });
    if (existing) {
      await prisma.material.update({
        where: { id: existing.id },
        data: {
          nameUk: withTestMarker(nameUk),
          status: "ARCHIVED",
          note: "Демо до CSV · замінено каталогом CRM",
        },
      });
    }
  }

  const pick = (predicate: (row: ParsedFabric) => boolean) => {
    const row = findFabric(fabrics, predicate);
    if (!row) return null;
    return materialByName.get(row.key) ?? materialByName.get(row.nameUk) ?? null;
  };

  const fabricTee =
    pick((f) => /кулір 30\/1/i.test(f.nameUk) && /зейджан/i.test(f.supplier ?? "")) ??
    pick((f) => /кулір 30\/1/i.test(f.nameUk)) ??
    pick((f) => /кулір/i.test(f.nameUk));
  const fabricPolo =
    pick((f) => /лакоста|піке/i.test(f.nameUk) && /зейджан/i.test(f.supplier ?? "")) ??
    pick((f) => /лакоста/i.test(f.nameUk));
  const fabricHoodie =
    pick((f) => /футер.*начіс/i.test(f.nameUk) && /зейджан/i.test(f.supplier ?? "")) ??
    pick((f) => /футер/i.test(f.nameUk));
  const collarPolo =
    pick((f) => /комірц/i.test(f.nameUk)) ?? null;
  const ribKnit =
    pick((f) => /кашкорс для 3/i.test(f.nameUk)) ??
    pick((f) => /кашкорс|кашкорсе|рибан|рібан/i.test(f.nameUk));

  const thread =
    [...materialByName.values()].find((m) => /^нитки(\s|·|$)/i.test(m.nameUk)) ??
    [...materialByName.values()].find((m) => /швейні\s+поліестер/i.test(m.nameUk)) ??
    null;
  const zipper =
    [...materialByName.values()].find((m) =>
      /^блискавка(\s|·|$)/i.test(m.nameUk) && /спіральна.*№5.*75\s*см/i.test(m.nameUk),
    ) ??
    [...materialByName.values()].find((m) => /^блискавка(\s|·|$)/i.test(m.nameUk)) ??
    null;
  const packBag =
    [...materialByName.values()].find((m) => /^пакування(\s|·|$)/i.test(m.nameUk) && /25[×x]35/i.test(m.nameUk)) ??
    [...materialByName.values()].find((m) => /^пакування(\s|·|$)/i.test(m.nameUk)) ??
    null;

  type ProductSeed = {
    internalCode: string;
    nameUk: string;
    categoryId: string;
    description: string;
    imageUrl: string | null;
    optimalQty: number;
    cutTiers: Array<{ minQuantity: number; ratePerUnit: number }>;
    sizeCodes: string[];
    materials: Array<{ materialId: string; consumptionPerUnit: number; wastePercent?: number }>;
    operations: Array<{ operationId: string; rateOverride?: number; standardOverride?: number }>;
    decorations: Array<{ decorationMethodId: string }>;
    additionalCosts: Array<{ nameUk: string; amount: number; isPerUnit: boolean }>;
  };

  function opsFor(model: ParsedModel) {
    return [
      { operationId: args.opCutId, rateOverride: model.cutRateOptimal },
      { operationId: args.opSewId, rateOverride: model.sewRate },
      { operationId: args.opPackId, rateOverride: model.packRate },
    ];
  }

  function bomForAlias(code: keyof typeof ETALON_ALIASES) {
    if (code === "SEED-TS-BASIC") {
      return [
        fabricTee ? { materialId: fabricTee.id, consumptionPerUnit: 1.4, wastePercent: 5 } : null,
        ribKnit ? { materialId: ribKnit.id, consumptionPerUnit: 0.15, wastePercent: 4 } : null,
        thread ? { materialId: thread.id, consumptionPerUnit: 0.02 } : null,
        packBag ? { materialId: packBag.id, consumptionPerUnit: 1 } : null,
      ].filter(Boolean) as ProductSeed["materials"];
    }
    if (code === "SEED-POLO") {
      return [
        fabricPolo ? { materialId: fabricPolo.id, consumptionPerUnit: 1.6, wastePercent: 6 } : null,
        collarPolo ? { materialId: collarPolo.id, consumptionPerUnit: 0.2, wastePercent: 4 } : null,
        thread ? { materialId: thread.id, consumptionPerUnit: 0.025 } : null,
        packBag ? { materialId: packBag.id, consumptionPerUnit: 1 } : null,
      ].filter(Boolean) as ProductSeed["materials"];
    }
    return [
      fabricHoodie ? { materialId: fabricHoodie.id, consumptionPerUnit: 2.2, wastePercent: 7 } : null,
      ribKnit ? { materialId: ribKnit.id, consumptionPerUnit: 0.25, wastePercent: 4 } : null,
      zipper ? { materialId: zipper.id, consumptionPerUnit: 1 } : null,
      thread ? { materialId: thread.id, consumptionPerUnit: 0.04 } : null,
      packBag ? { materialId: packBag.id, consumptionPerUnit: 1 } : null,
    ].filter(Boolean) as ProductSeed["materials"];
  }

  function decorationsFor(code: string | null, category: string) {
    if (code === "SEED-TS-BASIC" || /футбол/i.test(category)) {
      return [{ decorationMethodId: args.decorations.print1cId }];
    }
    if (code === "SEED-POLO" || /поло/i.test(category)) {
      return [{ decorationMethodId: args.decorations.embroideryId }];
    }
    if (code === "SEED-HOODIE" || /худі|світш/i.test(category)) {
      return [{ decorationMethodId: args.decorations.dtfId }];
    }
    return [];
  }

  const productDefs: ProductSeed[] = [];
  const usedAlias = new Set<string>();

  for (const model of models) {
    const categoryId = await productCategory(model.category);
    let aliasCode: string | null = null;
    for (const [code, meta] of Object.entries(ETALON_ALIASES)) {
      if (usedAlias.has(code)) continue;
      if (meta.matchName.test(model.nameUk)) {
        aliasCode = code;
        usedAlias.add(code);
        break;
      }
    }

    const internalCode = aliasCode ?? model.internalCode;
    const imageUrl = aliasCode
      ? ETALON_ALIASES[aliasCode as keyof typeof ETALON_ALIASES].imageUrl
      : null;

    // CSV models are production — never prefix [ТЕСТ].
    // SEED-* codes only keep demo-order linkage + sample BOM on 3 etalons.
    productDefs.push({
      internalCode,
      nameUk: model.nameUk,
      categoryId,
      description: [
        `Каталог CRM · ${model.category}`,
        `Оптимальний тираж ≈ ${model.optimalQty} шт`,
        `Зміна: ${model.shiftCost} грн / ${model.outputPerShift} шт`,
        aliasCode
          ? "Еталон для демо-замовлень: додано зразкову комплектацію (норми орієнтовні)."
          : "Комплектація матеріалів у CSV відсутня — додайте норми в картці виробу.",
      ].join(". "),
      imageUrl,
      optimalQty: model.optimalQty,
      cutTiers: model.cutTiers,
      sizeCodes: model.sizeCodes.filter((code) => sizeByCode[code]),
      materials: aliasCode ? bomForAlias(aliasCode as keyof typeof ETALON_ALIASES) : [],
      operations: opsFor(model),
      decorations: decorationsFor(aliasCode, model.category),
      additionalCosts: [],
    });
  }

  // Ensure aliases exist even if name match failed
  for (const [code, meta] of Object.entries(ETALON_ALIASES)) {
    if (usedAlias.has(code)) continue;
    const fallback =
      models.find((m) => meta.matchName.test(m.nameUk)) ??
      models.find((m) => /футбол|поло|худі/i.test(m.nameUk));
    if (!fallback) continue;
    const categoryId = await productCategory(fallback.category);
    productDefs.push({
      internalCode: code,
      nameUk: fallback.nameUk,
      categoryId,
      description: [
        `Каталог CRM · ${fallback.category}`,
        `Еталон ${code}: зразкова комплектація для демо-замовлень.`,
      ].join(". "),
      imageUrl: meta.imageUrl,
      optimalQty: fallback.optimalQty,
      cutTiers: fallback.cutTiers,
      sizeCodes: fallback.sizeCodes.filter((c) => sizeByCode[c]),
      materials: bomForAlias(code as keyof typeof ETALON_ALIASES),
      operations: opsFor(fallback),
      decorations: decorationsFor(code, fallback.category),
      additionalCosts: [],
    });
    usedAlias.add(code);
  }

  const products: CatalogSeedResult["products"] = {};

  for (const def of productDefs) {
    const before = await prisma.product.findUnique({
      where: { internalCode: def.internalCode },
      select: {
        id: true,
        _count: { select: { materials: true, operations: true } },
      },
    });

    const product = await prisma.product.upsert({
      where: { internalCode: def.internalCode },
      update: {
        nameUk: def.nameUk,
        categoryId: def.categoryId,
        description: def.description,
        imageUrl: def.imageUrl,
        optimalQty: def.optimalQty,
        isBaseModel: true,
        status: "ACTIVE",
      },
      create: {
        internalCode: def.internalCode,
        nameUk: def.nameUk,
        categoryId: def.categoryId,
        description: def.description,
        imageUrl: def.imageUrl,
        optimalQty: def.optimalQty,
        isBaseModel: true,
      },
    });

    const forceRefresh = process.env.CATALOG_SEED_REFRESH_BOM === "1";
    const hasBom =
      before != null && (before._count.materials > 0 || before._count.operations > 0);
    const refreshBom = !before || forceRefresh || !hasBom;

    if (refreshBom) {
    await prisma.productSize.deleteMany({ where: { productId: product.id } });
    await prisma.productMaterial.deleteMany({ where: { productId: product.id } });
    await prisma.productOperation.deleteMany({ where: { productId: product.id } });
    await prisma.productDecoration.deleteMany({ where: { productId: product.id } });
    await prisma.productAdditionalCost.deleteMany({ where: { productId: product.id } });
    await prisma.productCutRateTier.deleteMany({ where: { productId: product.id } });

    if (def.sizeCodes.length) {
      await prisma.productSize.createMany({
        data: def.sizeCodes.map((code) => ({
          productId: product.id,
          sizeId: sizeByCode[code]!.id,
        })),
      });
    }
    if (def.cutTiers.length) {
      await prisma.productCutRateTier.createMany({
        data: def.cutTiers.map((tier) => ({
          productId: product.id,
          minQuantity: tier.minQuantity,
          ratePerUnit: tier.ratePerUnit,
        })),
      });
    }
    if (def.materials.length) {
      await prisma.productMaterial.createMany({
        data: def.materials.map((row) => ({
          productId: product.id,
          materialId: row.materialId,
          consumptionPerUnit: row.consumptionPerUnit,
          wastePercent: row.wastePercent ?? null,
        })),
      });
    }
    if (def.operations.length) {
      await prisma.productOperation.createMany({
        data: def.operations.map((row) => ({
          productId: product.id,
          operationId: row.operationId,
          rateOverride: row.rateOverride ?? null,
          standardOverride: row.standardOverride ?? null,
        })),
      });
    }
    if (def.decorations.length) {
      await prisma.productDecoration.createMany({
        data: def.decorations.map((row) => ({
          productId: product.id,
          decorationMethodId: row.decorationMethodId,
        })),
      });
    }
    if (def.additionalCosts.length) {
      await prisma.productAdditionalCost.createMany({
        data: def.additionalCosts.map((row) => ({
          productId: product.id,
          nameUk: row.nameUk,
          amount: row.amount,
          isPerUnit: row.isPerUnit,
        })),
      });
    }
    }

    products[def.internalCode] = product;
  }

  // Archive leftover demo products from older seeds (keep only this CRM import set)
  const keepCodes = Object.keys(products);
  await prisma.product.updateMany({
    where: {
      status: "ACTIVE",
      OR: [{ internalCode: null }, { internalCode: { notIn: keepCodes } }],
    },
    data: { status: "ARCHIVED", description: "Архів: замінено каталогом CRM" },
  });

  const skippedNotes = [
    ...fabricsSkipped.map((s) => `Тканина «${s.name}»: ${s.reason}`),
    ...trimsSkipped.map((s) => `Фурнітура «${s.name}»: ${s.reason}`),
    ...modelsSkipped.map((s) => `Модель «${s.name}»: ${s.reason}`),
  ];

  return {
    products,
    stats: {
      fabrics: fabrics.length,
      fabricsSkipped: fabricsSkipped.length,
      trims: trims.length,
      trimsSkipped: trimsSkipped.length,
      models: models.length,
      modelsSkipped: modelsSkipped.length,
    },
    skippedNotes,
  };
}
