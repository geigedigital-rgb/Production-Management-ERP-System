import { prisma } from "@/server/db/client";
import {
  decorationFormSchema,
  operationFormSchema,
  type DecorationFormValues,
  type OperationFormValues,
} from "./operation-schemas";
import type { OperationCalcMethod, RecordStatus } from "@prisma/client";
import { isFixedCostOperationName } from "@/lib/fixed-costs";

const operationListInclude = {
  category: true,
  rateTiers: { orderBy: { minQuantity: "asc" as const } },
} as const;

/** Catalog leftover: real PV is directory-based, never an addable operation. */
function isHiddenCatalogOperation(nameUk: string) {
  return isFixedCostOperationName(nameUk);
}

export async function listOperations(params?: { search?: string; status?: RecordStatus }) {
  const search = params?.search?.trim();
  const rows = await prisma.operation.findMany({
    where: {
      status: params?.status ?? "ACTIVE",
      ...(search
        ? { nameUk: { contains: search, mode: "insensitive" } }
        : {}),
    },
    include: operationListInclude,
    orderBy: { nameUk: "asc" },
  });
  return rows.filter((row) => !isHiddenCatalogOperation(row.nameUk));
}

async function replaceOperationRateTiers(
  operationId: string,
  tiers: Array<{ minQuantity: number; ratePerUnit: number }>,
) {
  await prisma.operationRateTier.deleteMany({ where: { operationId } });
  if (tiers.length === 0) return;
  await prisma.operationRateTier.createMany({
    data: tiers.map((tier) => ({
      operationId,
      minQuantity: tier.minQuantity,
      ratePerUnit: tier.ratePerUnit,
    })),
  });
}

export async function createOperation(raw: OperationFormValues) {
  const data = operationFormSchema.parse(raw);
  if (isFixedCostOperationName(data.nameUk)) {
    throw new Error(
      "«Постійні витрати» — не операція. Налаштуйте їх у довіднику постійних витрат.",
    );
  }
  const operation = await prisma.operation.create({
    data: {
      nameUk: data.nameUk,
      categoryId: data.categoryId || null,
      calculationMethod: data.calculationMethod as OperationCalcMethod,
      baseRate: data.baseRate ?? null,
      shiftCost: data.shiftCost ?? null,
      standardOutputPerShift: data.standardOutputPerShift ?? null,
      note: data.note || null,
    },
  });
  if (data.calculationMethod === "QUANTITY_TIER") {
    await replaceOperationRateTiers(operation.id, data.rateTiers);
  }
  return prisma.operation.findUniqueOrThrow({
    where: { id: operation.id },
    include: operationListInclude,
  });
}

export async function updateOperation(id: string, raw: OperationFormValues) {
  const data = operationFormSchema.parse(raw);
  await prisma.operation.update({
    where: { id },
    data: {
      nameUk: data.nameUk,
      categoryId: data.categoryId || null,
      calculationMethod: data.calculationMethod as OperationCalcMethod,
      baseRate: data.baseRate ?? null,
      shiftCost: data.shiftCost ?? null,
      standardOutputPerShift: data.standardOutputPerShift ?? null,
      note: data.note || null,
    },
  });
  if (data.calculationMethod === "QUANTITY_TIER") {
    await replaceOperationRateTiers(id, data.rateTiers);
  } else {
    await prisma.operationRateTier.deleteMany({ where: { operationId: id } });
  }
  return prisma.operation.findUniqueOrThrow({
    where: { id },
    include: operationListInclude,
  });
}

export async function archiveOperation(id: string) {
  return prisma.operation.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
}

export async function archiveOperations(ids: string[]) {
  if (ids.length === 0) return { count: 0 };
  return prisma.operation.updateMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });
}

export async function listDecorations(params?: { search?: string; status?: RecordStatus }) {
  const search = params?.search?.trim();
  return prisma.decorationMethod.findMany({
    where: {
      status: params?.status ?? "ACTIVE",
      ...(search
        ? { nameUk: { contains: search, mode: "insensitive" } }
        : {}),
    },
    include: { quantityTiers: { orderBy: { minQuantity: "asc" } } },
    orderBy: { nameUk: "asc" },
  });
}

export async function createDecoration(raw: DecorationFormValues) {
  const data = decorationFormSchema.parse(raw);
  return prisma.decorationMethod.create({
    data: {
      nameUk: data.nameUk,
      calculationUnit: data.calculationUnit,
      setupCost: data.setupCost,
      unitRate: data.unitRate,
      note: data.note || null,
    },
  });
}

export async function updateDecoration(id: string, raw: DecorationFormValues) {
  const data = decorationFormSchema.parse(raw);
  return prisma.decorationMethod.update({
    where: { id },
    data: {
      nameUk: data.nameUk,
      calculationUnit: data.calculationUnit,
      setupCost: data.setupCost,
      unitRate: data.unitRate,
      note: data.note || null,
    },
  });
}

export async function archiveDecoration(id: string) {
  return prisma.decorationMethod.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
}

export async function archiveDecorations(ids: string[]) {
  if (ids.length === 0) return { count: 0 };
  return prisma.decorationMethod.updateMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });
}
