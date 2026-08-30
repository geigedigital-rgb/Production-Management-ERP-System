import { prisma } from "@/server/db/client";
import { z } from "zod";
import {
  sizeCodesFromScopes,
  sizeConsumptionFromNorms,
} from "@/lib/size-bom";

export function assertProductOrderable(
  product: { status: string } | null | undefined,
): asserts product is { status: string } {
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  if (product.status === "ARCHIVED") throw new Error("PRODUCT_ARCHIVED");
}

const sizeCodesField = z.array(z.string()).optional().nullable();
const sizeConsumptionField = z.record(z.string(), z.number().nonnegative()).optional();

export const productFormSchema = z.object({
  nameUk: z.string().trim().min(1),
  internalCode: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  imageUrl: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.string().url().nullable().optional(),
  ),
  sizeIds: z.array(z.string()).default([]),
  materials: z
    .array(
      z.object({
        materialId: z.string().min(1),
        consumptionPerUnit: z.number().positive(),
        wastePercent: z.number().min(0).nullable().optional(),
        sizeCodes: sizeCodesField,
        sizeConsumption: sizeConsumptionField,
      }),
    )
    .default([]),
  operations: z
    .array(
      z.object({
        operationId: z.string().min(1),
        sizeCodes: sizeCodesField,
      }),
    )
    .default([]),
  decorations: z
    .array(
      z.object({
        decorationMethodId: z.string().min(1),
      }),
    )
    .default([]),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

const productMaterialInclude = {
  material: { include: { unitOfMeasure: true } },
  sizeNorms: { include: { size: true } },
  sizeScopes: { include: { size: true } },
} as const;

const productOperationInclude = {
  operation: true,
  sizeScopes: { include: { size: true } },
} as const;

const productDetailInclude = {
  category: true,
  sizes: { include: { size: true }, orderBy: { size: { sortOrder: "asc" as const } } },
  materials: { include: productMaterialInclude },
  operations: { include: productOperationInclude },
  decorations: { include: { decorationMethod: true } },
  additionalCosts: true,
  cutRateTiers: { orderBy: { minQuantity: "asc" as const } },
  commercialPriceTiers: { orderBy: { minQuantity: "asc" as const } },
};

function sizeCreateForCodes(
  codes: string[] | null | undefined,
  sizeIdByCode: Map<string, string>,
) {
  if (!codes?.length) return undefined;
  const sizeIds = [...new Set(codes.map((code) => sizeIdByCode.get(code)).filter(Boolean))] as string[];
  if (sizeIds.length === 0) return undefined;
  return { create: sizeIds.map((sizeId) => ({ sizeId })) };
}

function normCreateForMap(
  map: Record<string, number> | undefined,
  sizeIdByCode: Map<string, string>,
) {
  if (!map) return undefined;
  const rows = Object.entries(map)
    .map(([code, consumptionPerUnit]) => {
      const sizeId = sizeIdByCode.get(code);
      if (!sizeId || !Number.isFinite(consumptionPerUnit) || consumptionPerUnit < 0) return null;
      return { sizeId, consumptionPerUnit };
    })
    .filter((row): row is { sizeId: string; consumptionPerUnit: number } => Boolean(row));
  if (rows.length === 0) return undefined;
  return { create: rows };
}
export async function listProducts() {
  return prisma.product.findMany({
    where: { status: "ACTIVE" },
    include: productDetailInclude,
    orderBy: { nameUk: "asc" },
  });
}

/** Lightweight list for the products table — counts only, no nested BOM. */
export async function listProductsSummary() {
  return prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      nameUk: true,
      internalCode: true,
      isBaseModel: true,
      _count: {
        select: {
          materials: true,
          operations: true,
          decorations: true,
        },
      },
    },
    orderBy: { nameUk: "asc" },
  });
}

/** Full detail for a subset (e.g. ready products that need price calc). */
export async function listProductsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return prisma.product.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    include: productDetailInclude,
  });
}

export async function listSizes() {
  return prisma.size.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createProductDraft(raw: ProductFormValues) {
  const data = productFormSchema.parse(raw);
  const imageUrl = data.imageUrl?.trim() ? data.imageUrl.trim() : null;

  const materialIds = [...new Set(data.materials.map((row) => row.materialId))];
  const materials =
    materialIds.length > 0
      ? await prisma.material.findMany({ where: { id: { in: materialIds } } })
      : [];
  const materialById = new Map(materials.map((row) => [row.id, row]));
  const sizeRecords = data.sizeIds.length
    ? await prisma.size.findMany({ where: { id: { in: data.sizeIds } } })
    : await prisma.size.findMany({ where: { status: "ACTIVE" } });
  const sizeIdByCode = new Map(sizeRecords.map((row) => [row.code, row.id]));

  return prisma.product.create({
    data: {
      nameUk: data.nameUk,
      internalCode: data.internalCode || null,
      description: data.description || null,
      imageUrl,
      status: "ACTIVE",
      sizes: {
        create: data.sizeIds.map((sizeId) => ({ sizeId })),
      },
      materials: {
        create: data.materials.map((row) => {
          const catalog = materialById.get(row.materialId);
          return {
            materialId: row.materialId,
            consumptionPerUnit: row.consumptionPerUnit,
            wastePercent: row.wastePercent ?? catalog?.defaultWastePercent ?? 0,
            sizeScopes: sizeCreateForCodes(row.sizeCodes, sizeIdByCode),
            sizeNorms: normCreateForMap(row.sizeConsumption, sizeIdByCode),
          };
        }),
      },
      operations: {
        create: data.operations.map((row) => ({
          operationId: row.operationId,
          sizeScopes: sizeCreateForCodes(row.sizeCodes, sizeIdByCode),
        })),
      },
      decorations: {
        create: data.decorations.map((row) => ({
          decorationMethodId: row.decorationMethodId,
        })),
      },
    },
    include: productDetailInclude,
  });
}

export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: productDetailInclude,
  });
}

export function toCompositionTemplate(product: NonNullable<Awaited<ReturnType<typeof getProduct>>>) {
  return {
    materials: product.materials.map((row) => ({
      materialId: row.materialId,
      name: row.material.nameUk,
      unit: row.material.unitOfMeasure.code,
      consumption: Number(row.consumptionPerUnit),
      waste: Number(row.wastePercent ?? row.material.defaultWastePercent),
      price: Number(row.material.purchasePrice),
      sizeCodes: sizeCodesFromScopes(row.sizeScopes),
      sizeConsumption: sizeConsumptionFromNorms(row.sizeNorms),
    })),
    operations: product.operations.map((row) => ({
      operationId: row.operationId,
      name: row.operation.nameUk,
      method: row.operation.calculationMethod,
      unitRate:
        row.rateOverride != null
          ? Number(row.rateOverride)
          : row.operation.baseRate != null
            ? Number(row.operation.baseRate)
            : null,
      shiftCost: row.operation.shiftCost != null ? Number(row.operation.shiftCost) : null,
      standardOutput:
        row.standardOverride != null
          ? Number(row.standardOverride)
          : row.operation.standardOutputPerShift != null
            ? Number(row.operation.standardOutputPerShift)
            : null,
      sizeCodes: sizeCodesFromScopes(row.sizeScopes),
    })),
    decorations: product.decorations.map((row) => ({
      decorationMethodId: row.decorationMethodId,
      name: row.decorationMethod.nameUk,
      setupCost: Number(row.decorationMethod.setupCost),
      unitRate: Number(row.decorationMethod.unitRate),
    })),
  };
}

export async function addProductMaterial(input: {
  productId: string;
  materialId: string;
  consumptionPerUnit: number;
  wastePercent?: number | null;
  sizeIds?: string[];
}) {
  const material = await prisma.material.findUniqueOrThrow({
    where: { id: input.materialId },
  });

  return prisma.productMaterial.create({
    data: {
      productId: input.productId,
      materialId: input.materialId,
      consumptionPerUnit: input.consumptionPerUnit,
      wastePercent: input.wastePercent ?? material.defaultWastePercent,
      sizeScopes:
        input.sizeIds && input.sizeIds.length > 0
          ? { create: input.sizeIds.map((sizeId) => ({ sizeId })) }
          : undefined,
    },
  });
}

export async function addProductOperation(input: {
  productId: string;
  operationId: string;
  sizeIds?: string[];
}) {
  return prisma.productOperation.create({
    data: {
      productId: input.productId,
      operationId: input.operationId,
      sizeScopes:
        input.sizeIds && input.sizeIds.length > 0
          ? { create: input.sizeIds.map((sizeId) => ({ sizeId })) }
          : undefined,
    },
  });
}

export async function setProductMaterialConsumption(id: string, consumptionPerUnit: number) {
  return prisma.productMaterial.update({
    where: { id },
    data: { consumptionPerUnit },
  });
}

export async function setProductMaterialWaste(id: string, wastePercent: number) {
  return prisma.productMaterial.update({
    where: { id },
    data: { wastePercent },
  });
}

export async function setProductMaterialSizeNorm(input: {
  productMaterialId: string;
  sizeId: string;
  consumptionPerUnit: number;
}) {
  return prisma.productMaterialSizeNorm.upsert({
    where: {
      productMaterialId_sizeId: {
        productMaterialId: input.productMaterialId,
        sizeId: input.sizeId,
      },
    },
    update: { consumptionPerUnit: input.consumptionPerUnit },
    create: {
      productMaterialId: input.productMaterialId,
      sizeId: input.sizeId,
      consumptionPerUnit: input.consumptionPerUnit,
    },
  });
}

export async function removeProductMaterialFromSize(input: {
  productMaterialId: string;
  sizeId: string | null;
}) {
  const row = await prisma.productMaterial.findUnique({
    where: { id: input.productMaterialId },
    include: {
      sizeScopes: true,
      product: { include: { sizes: true } },
    },
  });
  if (!row) return;

  if (!input.sizeId) {
    await prisma.productMaterial.delete({ where: { id: row.id } });
    return;
  }

  const productSizeIds = row.product.sizes.map((size) => size.sizeId);
  if (row.sizeScopes.length === 0) {
    const keep = productSizeIds.filter((id) => id !== input.sizeId);
    await prisma.$transaction([
      prisma.productMaterialSizeNorm.deleteMany({
        where: { productMaterialId: row.id, sizeId: input.sizeId },
      }),
      prisma.productMaterialSizeScope.createMany({
        data: keep.map((sizeId) => ({ productMaterialId: row.id, sizeId })),
        skipDuplicates: true,
      }),
    ]);
    if (keep.length === 0) {
      await prisma.productMaterial.delete({ where: { id: row.id } });
    }
    return;
  }

  await prisma.$transaction([
    prisma.productMaterialSizeScope.deleteMany({
      where: { productMaterialId: row.id, sizeId: input.sizeId },
    }),
    prisma.productMaterialSizeNorm.deleteMany({
      where: { productMaterialId: row.id, sizeId: input.sizeId },
    }),
  ]);
  const remaining = await prisma.productMaterialSizeScope.count({
    where: { productMaterialId: row.id },
  });
  if (remaining === 0) {
    await prisma.productMaterial.delete({ where: { id: row.id } });
  }
}

export async function removeProductOperationFromSize(input: {
  productOperationId: string;
  sizeId: string | null;
}) {
  const row = await prisma.productOperation.findUnique({
    where: { id: input.productOperationId },
    include: {
      sizeScopes: true,
      product: { include: { sizes: true } },
    },
  });
  if (!row) return;

  if (!input.sizeId) {
    await prisma.productOperation.delete({ where: { id: row.id } });
    return;
  }

  const productSizeIds = row.product.sizes.map((size) => size.sizeId);
  if (row.sizeScopes.length === 0) {
    const keep = productSizeIds.filter((id) => id !== input.sizeId);
    if (keep.length === 0) {
      await prisma.productOperation.delete({ where: { id: row.id } });
      return;
    }
    await prisma.productOperationSizeScope.createMany({
      data: keep.map((sizeId) => ({ productOperationId: row.id, sizeId })),
      skipDuplicates: true,
    });
    return;
  }

  await prisma.productOperationSizeScope.deleteMany({
    where: { productOperationId: row.id, sizeId: input.sizeId },
  });
  const remaining = await prisma.productOperationSizeScope.count({
    where: { productOperationId: row.id },
  });
  if (remaining === 0) {
    await prisma.productOperation.delete({ where: { id: row.id } });
  }
}

export async function copyProductSizeSpec(input: {
  productId: string;
  fromSizeId: string;
  toSizeIds: string[];
}) {
  const product = await getProduct(input.productId);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const from = product.sizes.find((row) => row.sizeId === input.fromSizeId);
  if (!from) throw new Error("SIZE_NOT_FOUND");
  const targets = input.toSizeIds.filter((id) => id !== input.fromSizeId);
  if (targets.length === 0) return;

  const fromCode = from.size.code;

  await prisma.$transaction(async (tx) => {
    for (const material of product.materials) {
      const applies =
        material.sizeScopes.length === 0 ||
        material.sizeScopes.some((scope) => scope.sizeId === input.fromSizeId);
      if (!applies) continue;
      const consumption = Number(
        material.sizeNorms.find((norm) => norm.sizeId === input.fromSizeId)?.consumptionPerUnit ??
          material.consumptionPerUnit,
      );
      for (const sizeId of targets) {
        if (material.sizeScopes.length > 0) {
          await tx.productMaterialSizeScope.upsert({
            where: {
              productMaterialId_sizeId: { productMaterialId: material.id, sizeId },
            },
            update: {},
            create: { productMaterialId: material.id, sizeId },
          });
        }
        await tx.productMaterialSizeNorm.upsert({
          where: {
            productMaterialId_sizeId: { productMaterialId: material.id, sizeId },
          },
          update: { consumptionPerUnit: consumption },
          create: {
            productMaterialId: material.id,
            sizeId,
            consumptionPerUnit: consumption,
          },
        });
      }
      if (material.sizeScopes.length === 0) {
        await tx.productMaterialSizeNorm.upsert({
          where: {
            productMaterialId_sizeId: {
              productMaterialId: material.id,
              sizeId: input.fromSizeId,
            },
          },
          update: { consumptionPerUnit: consumption },
          create: {
            productMaterialId: material.id,
            sizeId: input.fromSizeId,
            consumptionPerUnit: consumption,
          },
        });
      }
    }

    for (const operation of product.operations) {
      const applies =
        operation.sizeScopes.length === 0 ||
        operation.sizeScopes.some((scope) => scope.sizeId === input.fromSizeId);
      if (!applies || operation.sizeScopes.length === 0) continue;
      for (const sizeId of targets) {
        await tx.productOperationSizeScope.upsert({
          where: {
            productOperationId_sizeId: { productOperationId: operation.id, sizeId },
          },
          update: {},
          create: { productOperationId: operation.id, sizeId },
        });
      }
    }
  });

  return;
}

export async function addProductDecoration(input: {
  productId: string;
  decorationMethodId: string;
}) {
  return prisma.productDecoration.create({
    data: {
      productId: input.productId,
      decorationMethodId: input.decorationMethodId,
    },
  });
}

export async function removeProductDecoration(productDecorationId: string) {
  return prisma.productDecoration.delete({ where: { id: productDecorationId } });
}

export async function archiveProducts(ids: string[]) {
  if (ids.length === 0) return { count: 0 };
  return prisma.product.updateMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });
}

export function parseCutRateTiersInput(input: {
  optimalQty?: unknown;
  tiers?: unknown;
}):
  | {
      ok: true;
      optimalQty: number | null;
      tiers: Array<{ minQuantity: number; ratePerUnit: number }>;
    }
  | { ok: false } {
  const optimalRaw =
    input.optimalQty == null || input.optimalQty === ""
      ? null
      : Number(input.optimalQty);
  if (optimalRaw != null && (!Number.isFinite(optimalRaw) || optimalRaw <= 0)) {
    return { ok: false };
  }

  const tiers: Array<{ minQuantity: number; ratePerUnit: number }> = [];
  if (Array.isArray(input.tiers)) {
    for (const row of input.tiers) {
      if (!row || typeof row !== "object") continue;
      const minQuantity = Number((row as { minQuantity?: unknown }).minQuantity);
      const ratePerUnit = Number((row as { ratePerUnit?: unknown }).ratePerUnit);
      if (!Number.isFinite(minQuantity) || !Number.isFinite(ratePerUnit)) continue;
      if (minQuantity <= 0 || ratePerUnit < 0) continue;
      tiers.push({ minQuantity, ratePerUnit });
    }
  }

  return { ok: true, optimalQty: optimalRaw, tiers };
}

export function parseCommercialPriceTiersInput(input: {
  isBaseModel?: unknown;
  tiers?: unknown;
}):
  | {
      ok: true;
      isBaseModel: boolean;
      tiers: Array<{ minQuantity: number; pricePerUnit: number }>;
    }
  | { ok: false } {
  const isBaseModel =
    input.isBaseModel === true ||
    input.isBaseModel === "1" ||
    input.isBaseModel === "true";

  const tiers: Array<{ minQuantity: number; pricePerUnit: number }> = [];
  if (Array.isArray(input.tiers)) {
    for (const row of input.tiers) {
      if (!row || typeof row !== "object") continue;
      const minQuantity = Number((row as { minQuantity?: unknown }).minQuantity);
      const pricePerUnit = Number((row as { pricePerUnit?: unknown }).pricePerUnit);
      if (!Number.isFinite(minQuantity) || !Number.isFinite(pricePerUnit)) continue;
      if (minQuantity <= 0 || pricePerUnit < 0) continue;
      tiers.push({ minQuantity, pricePerUnit });
    }
  }

  return { ok: true, isBaseModel, tiers };
}

export async function setProductCommercialPrices(input: {
  productId: string;
  isBaseModel: boolean;
  tiers: Array<{ minQuantity: number; pricePerUnit: number }>;
}) {
  const tiers = input.tiers
    .filter((tier) => tier.minQuantity > 0 && tier.pricePerUnit >= 0)
    .sort((a, b) => a.minQuantity - b.minQuantity);

  const unique = new Map<number, number>();
  for (const tier of tiers) unique.set(tier.minQuantity, tier.pricePerUnit);

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: input.productId },
      data: { isBaseModel: input.isBaseModel },
    });
    await tx.productCommercialPriceTier.deleteMany({ where: { productId: input.productId } });
    if (unique.size > 0) {
      await tx.productCommercialPriceTier.createMany({
        data: [...unique.entries()].map(([minQuantity, pricePerUnit]) => ({
          productId: input.productId,
          minQuantity,
          pricePerUnit,
        })),
      });
    }
  });
}

export async function setProductCutRates(input: {
  productId: string;
  optimalQty: number | null;
  tiers: Array<{ minQuantity: number; ratePerUnit: number }>;
}) {
  const tiers = input.tiers
    .filter((tier) => tier.minQuantity > 0 && tier.ratePerUnit >= 0)
    .sort((a, b) => a.minQuantity - b.minQuantity);

  // Dedupe by minQuantity (last wins)
  const unique = new Map<number, number>();
  for (const tier of tiers) unique.set(tier.minQuantity, tier.ratePerUnit);

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: input.productId },
      data: { optimalQty: input.optimalQty },
    });
    await tx.productCutRateTier.deleteMany({ where: { productId: input.productId } });
    if (unique.size > 0) {
      await tx.productCutRateTier.createMany({
        data: [...unique.entries()].map(([minQuantity, ratePerUnit]) => ({
          productId: input.productId,
          minQuantity,
          ratePerUnit,
        })),
      });
    }

    // Keep Розкрій rateOverride aligned with optimal-run rate for order snapshots.
    if (input.optimalQty != null && unique.has(input.optimalQty)) {
      const cutOps = await tx.productOperation.findMany({
        where: { productId: input.productId, operation: { nameUk: "Розкрій" } },
        select: { id: true },
      });
      for (const op of cutOps) {
        await tx.productOperation.update({
          where: { id: op.id },
          data: { rateOverride: unique.get(input.optimalQty)! },
        });
      }
    }
  });
}
