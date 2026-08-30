import { prisma } from "@/server/db/client";
import {
  decorationFormSchema,
  operationFormSchema,
  type DecorationFormValues,
  type OperationFormValues,
} from "./operation-schemas";
import type { OperationCalcMethod, RecordStatus } from "@prisma/client";

export async function listOperations(params?: { search?: string; status?: RecordStatus }) {
  const search = params?.search?.trim();
  return prisma.operation.findMany({
    where: {
      status: params?.status ?? "ACTIVE",
      ...(search
        ? { nameUk: { contains: search, mode: "insensitive" } }
        : {}),
    },
    include: { category: true },
    orderBy: { nameUk: "asc" },
  });
}

export async function createOperation(raw: OperationFormValues) {
  const data = operationFormSchema.parse(raw);
  return prisma.operation.create({
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
}

export async function updateOperation(id: string, raw: OperationFormValues) {
  const data = operationFormSchema.parse(raw);
  return prisma.operation.update({
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
