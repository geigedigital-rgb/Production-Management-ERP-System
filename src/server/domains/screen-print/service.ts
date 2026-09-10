import { prisma } from "@/server/db/client";
import {
  DEFAULT_SCREEN_PRINT_COEFFS,
  DEFAULT_SCREEN_PRINT_GRID,
  type ScreenPrintCoefficient,
  type ScreenPrintPriceCell,
} from "@/lib/screen-print-pricing";

export async function ensureScreenPrintCatalog() {
  const [cellCount, coefCount] = await Promise.all([
    prisma.screenPrintPriceCell.count(),
    prisma.screenPrintCoefficient.count(),
  ]);

  if (cellCount === 0) {
    await prisma.screenPrintPriceCell.createMany({
      data: DEFAULT_SCREEN_PRINT_GRID.map((row) => ({
        id: `sp_${row.minQuantity}_${row.colorCount}`,
        minQuantity: row.minQuantity,
        colorCount: row.colorCount,
        unitRate: row.unitRate,
      })),
      skipDuplicates: true,
    });
  }

  if (coefCount === 0) {
    await prisma.screenPrintCoefficient.createMany({
      data: DEFAULT_SCREEN_PRINT_COEFFS.map((row, index) => ({
        id: `sp_coef_${row.code.toLowerCase()}`,
        code: row.code,
        nameUk: row.nameUk,
        factor: row.factor,
        noteUk: row.noteUk ?? null,
        sortOrder: index + 1,
      })),
      skipDuplicates: true,
    });
  }
}

export async function getScreenPrintCatalog(): Promise<{
  cells: ScreenPrintPriceCell[];
  coefficients: ScreenPrintCoefficient[];
}> {
  try {
    await ensureScreenPrintCatalog();
    const [cells, coefficients] = await Promise.all([
      prisma.screenPrintPriceCell.findMany({
        orderBy: [{ minQuantity: "asc" }, { colorCount: "asc" }],
      }),
      prisma.screenPrintCoefficient.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);
    return {
      cells: cells.map((row) => ({
        minQuantity: row.minQuantity,
        colorCount: row.colorCount,
        unitRate: Number(row.unitRate),
      })),
      coefficients: coefficients.map((row) => ({
        code: row.code,
        nameUk: row.nameUk,
        factor: Number(row.factor),
        noteUk: row.noteUk,
      })),
    };
  } catch (error) {
    console.error("[screen-print] catalog load failed:", error);
    return {
      cells: DEFAULT_SCREEN_PRINT_GRID,
      coefficients: DEFAULT_SCREEN_PRINT_COEFFS,
    };
  }
}

export async function saveScreenPrintGrid(
  cells: Array<{ minQuantity: number; colorCount: number; unitRate: number }>,
) {
  const cleaned = cells
    .map((row) => ({
      minQuantity: Math.floor(Number(row.minQuantity)),
      colorCount: Math.floor(Number(row.colorCount)),
      unitRate: Number(row.unitRate),
    }))
    .filter(
      (row) =>
        row.minQuantity > 0 &&
        row.colorCount > 0 &&
        Number.isFinite(row.unitRate) &&
        row.unitRate >= 0,
    );

  await prisma.$transaction(async (tx) => {
    await tx.screenPrintPriceCell.deleteMany();
    if (cleaned.length > 0) {
      await tx.screenPrintPriceCell.createMany({
        data: cleaned.map((row) => ({
          id: `sp_${row.minQuantity}_${row.colorCount}`,
          ...row,
        })),
      });
    }
  });
}

export async function saveScreenPrintCoefficients(
  rows: Array<{ code: string; nameUk: string; factor: number; noteUk?: string | null }>,
) {
  for (const [index, row] of rows.entries()) {
    const code = row.code.trim();
    if (!code) continue;
    const factor = Number(row.factor);
    if (!(factor > 0)) continue;
    const nameUk = row.nameUk.trim() || code;
    const noteUk = row.noteUk?.trim() || null;

    await prisma.screenPrintCoefficient.upsert({
      where: { code },
      create: {
        id: `sp_coef_${code.toLowerCase()}`,
        code,
        nameUk,
        factor,
        noteUk,
        sortOrder: index + 1,
      },
      update: {
        nameUk,
        factor,
        noteUk,
        sortOrder: index + 1,
      },
    });
  }
}
