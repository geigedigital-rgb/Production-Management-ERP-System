import { prisma } from "@/server/db/client";
import {
  allocateFixedCosts,
  computeFixedCostMetrics,
  FIXED_COST_ADDITIONAL_ID,
  resolveSewerCount,
  type FixedCostAllocation,
  type FixedCostMetrics,
  type FixedCostParams,
} from "@/lib/fixed-costs";

export type FixedCostCatalog = {
  settings: {
    id: string;
    workingDaysPerMonth: number;
    sewerCount: number;
    dailySewerPay: number;
  };
  articles: Array<{
    id: string;
    nameUk: string;
    monthlyAmount: number;
    isActive: boolean;
    sortOrder: number;
  }>;
  monthlyTotalActive: number;
  metrics: FixedCostMetrics | null;
};

async function ensureFixedCostSettings() {
  const existing = await prisma.fixedCostSettings.findFirst();
  if (existing) return existing;
  return prisma.fixedCostSettings.create({
    data: {
      workingDaysPerMonth: 21,
      sewerCount: 5,
      dailySewerPay: 1500,
    },
  });
}

export async function getFixedCostCatalog(): Promise<FixedCostCatalog> {
  const [settings, articles] = await Promise.all([
    ensureFixedCostSettings(),
    prisma.fixedCostArticle.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);

  const mapped = articles.map((row) => ({
    id: row.id,
    nameUk: row.nameUk,
    monthlyAmount: Number(row.monthlyAmount),
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }));
  const monthlyTotalActive = mapped
    .filter((row) => row.isActive)
    .reduce((sum, row) => sum + row.monthlyAmount, 0);

  const params: FixedCostParams = {
    workingDaysPerMonth: settings.workingDaysPerMonth,
    sewerCount: settings.sewerCount,
    dailySewerPay: Number(settings.dailySewerPay),
    monthlyTotal: monthlyTotalActive,
  };

  return {
    settings: {
      id: settings.id,
      workingDaysPerMonth: settings.workingDaysPerMonth,
      sewerCount: settings.sewerCount,
      dailySewerPay: Number(settings.dailySewerPay),
    },
    articles: mapped,
    monthlyTotalActive,
    metrics: computeFixedCostMetrics(params),
  };
}

/** Params for calc engines (company defaults). */
export async function getFixedCostCalcContext(): Promise<{
  workingDaysPerMonth: number;
  companySewerCount: number;
  dailySewerPay: number;
  monthlyTotal: number;
  metricsAtCompanySewers: FixedCostMetrics | null;
  articles: Array<{ id: string; nameUk: string; monthlyAmount: number }>;
} | null> {
  const catalog = await getFixedCostCatalog();
  return {
    workingDaysPerMonth: catalog.settings.workingDaysPerMonth,
    companySewerCount: catalog.settings.sewerCount,
    dailySewerPay: catalog.settings.dailySewerPay,
    monthlyTotal: catalog.monthlyTotalActive,
    metricsAtCompanySewers: catalog.metrics,
    articles: catalog.articles
      .filter((row) => row.isActive)
      .map((row) => ({
        id: row.id,
        nameUk: row.nameUk,
        monthlyAmount: row.monthlyAmount,
      })),
  };
}

export function buildFixedCostAllocation(args: {
  workingDaysPerMonth: number;
  companySewerCount: number;
  dailySewerPay: number;
  monthlyTotal: number;
  sewerCountOverride?: number | null;
  sizes: Array<{ sizeCode: string; quantity: number; sewingPerUnit: number }>;
}): FixedCostAllocation | null {
  const { sewerCount, usedOrderOverride } = resolveSewerCount({
    companySewerCount: args.companySewerCount,
    orderOverride: args.sewerCountOverride,
  });
  const metrics = computeFixedCostMetrics({
    workingDaysPerMonth: args.workingDaysPerMonth,
    sewerCount,
    dailySewerPay: args.dailySewerPay,
    monthlyTotal: args.monthlyTotal,
  });
  if (!metrics) return null;
  return allocateFixedCosts({
    metrics,
    sewerCountUsed: sewerCount,
    usedOrderOverride,
    sizes: args.sizes,
  });
}

export async function updateFixedCostSettings(input: {
  workingDaysPerMonth: number;
  sewerCount: number;
  dailySewerPay: number;
}) {
  const settings = await ensureFixedCostSettings();
  return prisma.fixedCostSettings.update({
    where: { id: settings.id },
    data: {
      workingDaysPerMonth: input.workingDaysPerMonth,
      sewerCount: input.sewerCount,
      dailySewerPay: input.dailySewerPay,
    },
  });
}

export async function upsertFixedCostArticle(input: {
  id?: string;
  nameUk: string;
  monthlyAmount: number;
  isActive?: boolean;
  sortOrder?: number;
}) {
  if (input.id) {
    return prisma.fixedCostArticle.update({
      where: { id: input.id },
      data: {
        nameUk: input.nameUk,
        monthlyAmount: input.monthlyAmount,
        ...(input.isActive != null ? { isActive: input.isActive } : {}),
        ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
      },
    });
  }
  const maxSort = await prisma.fixedCostArticle.aggregate({ _max: { sortOrder: true } });
  return prisma.fixedCostArticle.create({
    data: {
      nameUk: input.nameUk,
      monthlyAmount: input.monthlyAmount,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
}

export async function setFixedCostArticleActive(id: string, isActive: boolean) {
  return prisma.fixedCostArticle.update({
    where: { id },
    data: { isActive },
  });
}

export async function deleteFixedCostArticle(id: string) {
  return prisma.fixedCostArticle.delete({ where: { id } });
}

export function fixedCostAdditionalLine(allocation: FixedCostAllocation) {
  return {
    id: FIXED_COST_ADDITIONAL_ID,
    amount: allocation.fixedCostTotal,
    isPerUnit: false as const,
  };
}

export async function fixedCostOptionsFromDb(): Promise<{
  workingDaysPerMonth: number;
  companySewerCount: number;
  dailySewerPay: number;
  monthlyTotal: number;
} | null> {
  const ctx = await getFixedCostCalcContext();
  if (!ctx) return null;
  return {
    workingDaysPerMonth: ctx.workingDaysPerMonth,
    companySewerCount: ctx.companySewerCount,
    dailySewerPay: ctx.dailySewerPay,
    monthlyTotal: ctx.monthlyTotal,
  };
}
