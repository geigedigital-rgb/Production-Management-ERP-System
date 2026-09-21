import { prisma } from "@/server/db/client";
import type { RecordStatus } from "@prisma/client";

export type SizeChartVariantInput = {
  code?: string;
  nameUk: string;
  description?: string | null;
  sortOrder?: number;
  status?: RecordStatus;
};

export type SizeChartSizeInput = {
  code: string;
  nameUk: string;
  descriptionUk?: string | null;
  sortOrder?: number;
  status?: RecordStatus;
};

function slugCode(nameUk: string): string {
  return (
    nameUk
      .trim()
      .toUpperCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "VARIANT"
  );
}

export async function listSizeChartVariants() {
  return prisma.sizeChartVariant.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { nameUk: "asc" }],
    include: {
      sizes: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { products: true, sizes: true } },
    },
  });
}

export async function listSizeChartCatalog() {
  return prisma.sizeChartVariant.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameUk: "asc" }],
    include: {
      sizes: { orderBy: { sortOrder: "asc" } },
      _count: { select: { products: true } },
    },
  });
}

export async function listSizesForVariant(variantId: string | null | undefined) {
  if (!variantId) {
    return prisma.size.findMany({
      where: { status: "ACTIVE" },
      orderBy: { sortOrder: "asc" },
    });
  }
  return prisma.size.findMany({
    where: { status: "ACTIVE", variantId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function upsertSizeChartVariant(input: SizeChartVariantInput & { id?: string }) {
  const nameUk = input.nameUk.trim();
  if (!nameUk) throw new Error("NAME_REQUIRED");
  const code = (input.code?.trim() || slugCode(nameUk)).toUpperCase();
  const sortOrder = Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0;
  const description = input.description?.trim() || null;
  const status = input.status ?? "ACTIVE";

  if (input.id) {
    return prisma.sizeChartVariant.update({
      where: { id: input.id },
      data: { nameUk, code, description, sortOrder, status },
    });
  }

  return prisma.sizeChartVariant.create({
    data: { nameUk, code, description, sortOrder, status },
  });
}

export async function archiveSizeChartVariant(id: string) {
  const used = await prisma.product.count({
    where: { sizeChartVariantId: id, status: "ACTIVE" },
  });
  if (used > 0) throw new Error("VARIANT_IN_USE");
  return prisma.sizeChartVariant.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
}

export async function upsertSizeInVariant(
  variantId: string,
  input: SizeChartSizeInput & { id?: string },
) {
  const code = input.code.trim();
  const nameUk = input.nameUk.trim() || code;
  if (!code) throw new Error("CODE_REQUIRED");
  const sortOrder = Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0;
  const descriptionUk = input.descriptionUk?.trim() || null;
  const status = input.status ?? "ACTIVE";

  if (input.id) {
    return prisma.size.update({
      where: { id: input.id },
      data: { code, nameUk, descriptionUk, sortOrder, status, variantId },
    });
  }

  return prisma.size.create({
    data: { variantId, code, nameUk, descriptionUk, sortOrder, status },
  });
}

export async function archiveSize(id: string) {
  const used = await prisma.productSize.count({ where: { sizeId: id } });
  if (used > 0) throw new Error("SIZE_IN_USE");
  return prisma.size.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
}

/** Replace all sizes for a variant from the admin editor draft. */
export async function replaceVariantSizes(
  variantId: string,
  sizes: SizeChartSizeInput[],
) {
  const variant = await prisma.sizeChartVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new Error("VARIANT_NOT_FOUND");

  const cleaned = sizes
    .map((row, index) => ({
      code: row.code.trim(),
      nameUk: (row.nameUk.trim() || row.code.trim()),
      descriptionUk: row.descriptionUk?.trim() || null,
      sortOrder: Number.isFinite(row.sortOrder) ? Number(row.sortOrder) : index + 1,
      status: row.status ?? ("ACTIVE" as const),
    }))
    .filter((row) => row.code.length > 0);

  const codes = cleaned.map((row) => row.code);
  if (new Set(codes).size !== codes.length) throw new Error("DUPLICATE_CODE");

  await prisma.$transaction(async (tx) => {
    const existing = await tx.size.findMany({ where: { variantId } });
    const keepCodes = new Set(cleaned.map((row) => row.code));
    const toArchive = existing.filter(
      (row) => !keepCodes.has(row.code) && row.status === "ACTIVE",
    );

    for (const row of toArchive) {
      const used = await tx.productSize.count({ where: { sizeId: row.id } });
      if (used > 0) {
        // Keep linked sizes; just leave them (do not delete). Update name if re-added later.
        continue;
      }
      await tx.size.update({
        where: { id: row.id },
        data: { status: "ARCHIVED" },
      });
    }

    for (const row of cleaned) {
      const found = existing.find((item) => item.code === row.code);
      if (found) {
        await tx.size.update({
          where: { id: found.id },
          data: {
            nameUk: row.nameUk,
            descriptionUk: row.descriptionUk,
            sortOrder: row.sortOrder,
            status: "ACTIVE",
          },
        });
      } else {
        await tx.size.create({
          data: {
            variantId,
            code: row.code,
            nameUk: row.nameUk,
            descriptionUk: row.descriptionUk,
            sortOrder: row.sortOrder,
            status: "ACTIVE",
          },
        });
      }
    }
  });
}
