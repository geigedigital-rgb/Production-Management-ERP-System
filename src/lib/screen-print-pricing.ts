/**
 * Screen-print (шовкотрафарет) pricing for order-stage branding.
 * Base grid = tirage band × color count (assumes print ≤ A4).
 * Optional multipliers stack: large area, chemical fabric, customer garment.
 */

export const SCREEN_PRINT_METHOD_NAME_UK = "Шовкотрафаретний друк";

export const SCREEN_PRINT_COEFF_CODES = [
  "LARGE_AREA",
  "CHEMICAL_FABRIC",
  "CUSTOMER_GARMENT",
] as const;

export type ScreenPrintCoeffCode = (typeof SCREEN_PRINT_COEFF_CODES)[number];

export type ScreenPrintPriceCell = {
  minQuantity: number;
  colorCount: number;
  unitRate: number;
};

export type ScreenPrintCoefficient = {
  code: string;
  nameUk: string;
  factor: number;
  noteUk?: string | null;
};

export const DEFAULT_SCREEN_PRINT_GRID: ScreenPrintPriceCell[] = [
  { minQuantity: 20, colorCount: 1, unitRate: 70 },
  { minQuantity: 20, colorCount: 2, unitRate: 80 },
  { minQuantity: 20, colorCount: 3, unitRate: 90 },
  { minQuantity: 20, colorCount: 4, unitRate: 100 },
  { minQuantity: 50, colorCount: 1, unitRate: 50 },
  { minQuantity: 50, colorCount: 2, unitRate: 60 },
  { minQuantity: 50, colorCount: 3, unitRate: 70 },
  { minQuantity: 50, colorCount: 4, unitRate: 85 },
  { minQuantity: 100, colorCount: 1, unitRate: 40 },
  { minQuantity: 100, colorCount: 2, unitRate: 50 },
  { minQuantity: 100, colorCount: 3, unitRate: 60 },
  { minQuantity: 100, colorCount: 4, unitRate: 75 },
  { minQuantity: 300, colorCount: 1, unitRate: 30 },
  { minQuantity: 300, colorCount: 2, unitRate: 40 },
  { minQuantity: 300, colorCount: 3, unitRate: 50 },
  { minQuantity: 300, colorCount: 4, unitRate: 65 },
  { minQuantity: 500, colorCount: 1, unitRate: 25 },
  { minQuantity: 500, colorCount: 2, unitRate: 35 },
  { minQuantity: 500, colorCount: 3, unitRate: 45 },
  { minQuantity: 500, colorCount: 4, unitRate: 55 },
  { minQuantity: 1000, colorCount: 1, unitRate: 22 },
  { minQuantity: 1000, colorCount: 2, unitRate: 28 },
  { minQuantity: 1000, colorCount: 3, unitRate: 33 },
  { minQuantity: 1000, colorCount: 4, unitRate: 39 },
];

export const DEFAULT_SCREEN_PRINT_COEFFS: ScreenPrintCoefficient[] = [
  {
    code: "LARGE_AREA",
    nameUk: "Площа більше А4 (до 38×38 см)",
    factor: 1.7,
    noteUk: "Базовий прайс — до А4. Більше А4, але не більше 38×38 см → ×1,7.",
  },
  {
    code: "CHEMICAL_FABRIC",
    nameUk: "Хімічні тканини",
    factor: 1.5,
    noteUk: "Коефіцієнт до прайсу для хімічних тканин.",
  },
  {
    code: "CUSTOMER_GARMENT",
    nameUk: "Одяг замовника",
    factor: 1.3,
    noteUk: "Якщо друкуємо на одязі клієнта (не наш виріб).",
  },
];

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Highest tier whose minQuantity ≤ quantity; if below all tiers, use lowest band. */
export function resolveScreenPrintBandQty(
  quantity: number,
  cells: ScreenPrintPriceCell[],
): number | null {
  const qty = Math.max(0, Math.floor(quantity));
  const bands = [...new Set(cells.map((c) => c.minQuantity))]
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (bands.length === 0) return null;
  let band = bands[0]!;
  for (const min of bands) {
    if (min <= qty) band = min;
    else break;
  }
  return band;
}

export function lookupScreenPrintBaseRate(args: {
  quantity: number;
  colorCount: number;
  cells: ScreenPrintPriceCell[];
}): { bandQty: number; colorCount: number; baseRate: number } | null {
  const colors = Math.max(1, Math.min(24, Math.floor(args.colorCount) || 1));
  const bandQty = resolveScreenPrintBandQty(args.quantity, args.cells);
  if (bandQty == null) return null;
  const cell = args.cells.find((c) => c.minQuantity === bandQty && c.colorCount === colors);
  if (!cell || !(cell.unitRate >= 0)) return null;
  return { bandQty, colorCount: colors, baseRate: Number(cell.unitRate) };
}

export function applyScreenPrintCoefficients(args: {
  baseRate: number;
  coefficients: ScreenPrintCoefficient[];
  selectedCodes: string[];
}): { unitRate: number; applied: Array<{ code: string; nameUk: string; factor: number }> } {
  const applied: Array<{ code: string; nameUk: string; factor: number }> = [];
  let rate = args.baseRate;
  for (const code of args.selectedCodes) {
    const coef = args.coefficients.find((c) => c.code === code);
    if (!coef || !(coef.factor > 0)) continue;
    rate *= Number(coef.factor);
    applied.push({ code: coef.code, nameUk: coef.nameUk, factor: Number(coef.factor) });
  }
  return { unitRate: roundMoney(rate), applied };
}

export function resolveScreenPrintUnitRate(args: {
  quantity: number;
  colorCount: number;
  cells: ScreenPrintPriceCell[];
  coefficients: ScreenPrintCoefficient[];
  selectedCodes: string[];
}): {
  bandQty: number;
  colorCount: number;
  baseRate: number;
  unitRate: number;
  applied: Array<{ code: string; nameUk: string; factor: number }>;
} | null {
  const base = lookupScreenPrintBaseRate({
    quantity: args.quantity,
    colorCount: args.colorCount,
    cells: args.cells,
  });
  if (!base) return null;
  const { unitRate, applied } = applyScreenPrintCoefficients({
    baseRate: base.baseRate,
    coefficients: args.coefficients,
    selectedCodes: args.selectedCodes,
  });
  return { ...base, unitRate, applied };
}

export function screenPrintLineName(args: {
  colorCount: number;
  applied: Array<{ code: string; nameUk: string; factor: number }>;
}): string {
  const parts = [`${SCREEN_PRINT_METHOD_NAME_UK}`, `${args.colorCount} кол.`];
  for (const row of args.applied) {
    parts.push(`${row.nameUk} ×${row.factor}`);
  }
  return parts.join(" · ");
}

export function isScreenPrintDecorationName(name: string | null | undefined): boolean {
  if (!name) return false;
  return name.trim().startsWith(SCREEN_PRINT_METHOD_NAME_UK);
}

/** Restore calculator state from a saved order decoration nameSnapshot. */
export function parseScreenPrintLineName(
  name: string | null | undefined,
  coefficients: ScreenPrintCoefficient[] = DEFAULT_SCREEN_PRINT_COEFFS,
): {
  colorCount: number;
  selectedCodes: string[];
} | null {
  if (!isScreenPrintDecorationName(name)) return null;
  const text = name!.trim();
  const colorMatch = text.match(/(\d+)\s*кол\./u);
  const colorCount = colorMatch ? Math.max(1, Math.min(24, Number(colorMatch[1]) || 1)) : 1;

  const selectedCodes: string[] = [];
  for (const coef of coefficients) {
    if (text.includes(coef.code) || text.includes(coef.nameUk)) {
      selectedCodes.push(coef.code);
    }
  }
  // Legacy rows stored raw codes even if the catalog label later changed.
  for (const code of SCREEN_PRINT_COEFF_CODES) {
    if (text.includes(code) && !selectedCodes.includes(code)) {
      selectedCodes.push(code);
    }
  }
  return { colorCount, selectedCodes };
}

/** Human-readable label for UI (table, delete confirm) — rewrites legacy code-based names. */
export function displayScreenPrintLineName(
  name: string | null | undefined,
  coefficients: ScreenPrintCoefficient[] = DEFAULT_SCREEN_PRINT_COEFFS,
): string {
  const parsed = parseScreenPrintLineName(name, coefficients);
  if (!parsed) return name?.trim() || "";
  const applied = parsed.selectedCodes
    .map((code) => {
      const coef = coefficients.find((row) => row.code === code);
      if (!coef) return null;
      return { code: coef.code, nameUk: coef.nameUk, factor: Number(coef.factor) };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
  return screenPrintLineName({ colorCount: parsed.colorCount, applied });
}

export function uniqueQtyBands(cells: ScreenPrintPriceCell[]): number[] {
  return [...new Set(cells.map((c) => c.minQuantity))].filter((n) => n > 0).sort((a, b) => a - b);
}

export function uniqueColorCounts(cells: ScreenPrintPriceCell[]): number[] {
  return [...new Set(cells.map((c) => c.colorCount))].filter((n) => n > 0).sort((a, b) => a - b);
}
