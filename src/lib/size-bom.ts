export const ALL_SIZES = "ALL";

export type SizeScope = typeof ALL_SIZES | string;

export type SizeRef = { code: string; nameUk?: string };

export type ExpandableMaterial = {
  materialId: string;
  consumption: number;
  waste?: number | null;
  sizeCodes?: string[] | null;
  sizeConsumption?: Record<string, number>;
};

export type ExpandedMaterial = {
  materialId: string;
  consumption: number;
  waste?: number | null;
  sizeCode: string | null;
};

export type ExpandableOperation = {
  operationId: string;
  sizeCodes?: string[] | null;
};

export type ExpandedOperation = {
  operationId: string;
  sizeCode: string | null;
};

export type SizedLine = {
  id: string;
  groupKey?: string | null;
  sizeCode?: string | null;
};

function isSharedSize(sizeCode: string | null | undefined) {
  return sizeCode == null || sizeCode === "";
}

export function appliesToSize(sizeCodes: string[] | null | undefined, sizeCode: string): boolean {
  if (!sizeCodes || sizeCodes.length === 0) return true;
  return sizeCodes.includes(sizeCode);
}

export function consumptionForSize(
  base: number,
  sizeConsumption: Record<string, number> | undefined,
  sizeCode: string,
): number {
  const override = sizeConsumption?.[sizeCode];
  return override != null && Number.isFinite(override) ? override : base;
}

export function effectiveSizeCodes(
  sizeCodes: string[] | null | undefined,
  allCodes: string[],
): string[] {
  if (!sizeCodes || sizeCodes.length === 0) return allCodes;
  return allCodes.filter((code) => sizeCodes.includes(code));
}

function sameConsumption(values: number[]) {
  if (values.length <= 1) return true;
  return values.every((value) => value === values[0]);
}

export function expandMaterialsForSizes(
  materials: ExpandableMaterial[],
  orderedSizeCodes: string[],
): ExpandedMaterial[] {
  const result: ExpandedMaterial[] = [];
  for (const row of materials) {
    const applies = effectiveSizeCodes(row.sizeCodes, orderedSizeCodes);
    if (applies.length === 0) continue;
    const consumptions = applies.map((code) =>
      consumptionForSize(row.consumption, row.sizeConsumption, code),
    );
    const shared =
      applies.length === orderedSizeCodes.length && sameConsumption(consumptions);
    if (shared) {
      result.push({
        materialId: row.materialId,
        consumption: consumptions[0] ?? row.consumption,
        waste: row.waste,
        sizeCode: null,
      });
    } else {
      for (let i = 0; i < applies.length; i++) {
        result.push({
          materialId: row.materialId,
          consumption: consumptions[i]!,
          waste: row.waste,
          sizeCode: applies[i]!,
        });
      }
    }
  }
  return result;
}

export function expandOperationsForSizes(
  operations: ExpandableOperation[],
  orderedSizeCodes: string[],
): ExpandedOperation[] {
  const result: ExpandedOperation[] = [];
  for (const row of operations) {
    const applies = effectiveSizeCodes(row.sizeCodes, orderedSizeCodes);
    if (applies.length === 0) continue;
    if (applies.length === orderedSizeCodes.length) {
      result.push({ operationId: row.operationId, sizeCode: null });
    } else {
      for (const sizeCode of applies) {
        result.push({ operationId: row.operationId, sizeCode });
      }
    }
  }
  return result;
}

export function linesForSize<T extends SizedLine>(lines: T[], sizeCode: string): T[] {
  const specific = lines.filter((line) => line.sizeCode === sizeCode);
  const taken = new Set(specific.map((line) => line.groupKey || line.id));
  const shared = lines.filter(
    (line) => isSharedSize(line.sizeCode) && !taken.has(line.groupKey || line.id),
  );
  return [...shared, ...specific];
}

export function lineAppliesToSize(line: SizedLine, sizeCode: string, siblings: SizedLine[]) {
  return linesForSize(siblings, sizeCode).some((row) => row.id === line.id);
}

export function formatSizeRun(
  sizes: Array<{ sizeCode?: string; code?: string; quantity: number }>,
): string {
  const active = sizes.filter((row) => row.quantity > 0);
  if (active.length === 0) return "";
  return active
    .map((row) => `${row.sizeCode ?? row.code ?? "?"} ${row.quantity}`)
    .join(" · ");
}

export function lineCostOnSizes(
  row: {
    id: string;
    groupKey?: string | null;
    sizeCode?: string | null;
    consumption: number;
    waste: number;
    price: number;
  },
  siblings: Array<{ id: string; groupKey?: string | null; sizeCode?: string | null }>,
  sizes: Array<{ sizeCode: string; quantity: number }>,
) {
  let cost = 0;
  const unit = row.consumption * (1 + row.waste / 100) * row.price;
  for (const size of sizes) {
    if (size.quantity <= 0) continue;
    if (!linesForSize(siblings, size.sizeCode).some((line) => line.id === row.id)) continue;
    cost += unit * size.quantity;
  }
  return cost;
}

export function lineNeedOnSizes(
  row: {
    id: string;
    groupKey?: string | null;
    sizeCode?: string | null;
    consumption: number;
    waste: number;
  },
  siblings: Array<{ id: string; groupKey?: string | null; sizeCode?: string | null }>,
  sizes: Array<{ sizeCode: string; quantity: number }>,
) {
  let need = 0;
  const perUnit = row.consumption * (1 + row.waste / 100);
  for (const size of sizes) {
    if (size.quantity <= 0) continue;
    if (!linesForSize(siblings, size.sizeCode).some((line) => line.id === row.id)) continue;
    need += perUnit * size.quantity;
  }
  return need;
}

export function uniqueBomCount(rows: Array<{ groupKey?: string | null; id?: string }>) {
  return new Set(rows.map((row) => row.groupKey || row.id || "")).size;
}

export function customizedSizeCodes(input: {
  allCodes: string[];
  materials: Array<{
    sizeCodes?: string[] | null;
    sizeConsumption?: Record<string, number>;
  }>;
  operations?: Array<{ sizeCodes?: string[] | null }>;
}): Set<string> {
  const result = new Set<string>();
  for (const row of input.materials) {
    if (row.sizeCodes && row.sizeCodes.length > 0 && row.sizeCodes.length < input.allCodes.length) {
      for (const code of row.sizeCodes) result.add(code);
      for (const code of input.allCodes) {
        if (!row.sizeCodes.includes(code)) result.add(code);
      }
    }
    for (const code of Object.keys(row.sizeConsumption ?? {})) result.add(code);
  }
  for (const row of input.operations ?? []) {
    if (row.sizeCodes && row.sizeCodes.length > 0 && row.sizeCodes.length < input.allCodes.length) {
      for (const code of row.sizeCodes) result.add(code);
      for (const code of input.allCodes) {
        if (!row.sizeCodes.includes(code)) result.add(code);
      }
    }
  }
  return result;
}

export function visibleDraftRows<T extends { sizeCodes?: string[] | null }>(
  rows: T[],
  scope: SizeScope,
): T[] {
  if (scope === ALL_SIZES) return rows;
  return rows.filter((row) => appliesToSize(row.sizeCodes, scope));
}

export function draftConsumption(
  row: { consumption: number; sizeConsumption?: Record<string, number> },
  scope: SizeScope,
) {
  if (scope === ALL_SIZES) return row.consumption;
  return consumptionForSize(row.consumption, row.sizeConsumption, scope);
}

export function patchDraftConsumption<
  T extends { consumption: number; sizeConsumption?: Record<string, number> },
>(row: T, scope: SizeScope, value: number): T {
  if (scope === ALL_SIZES) return { ...row, consumption: value };
  return {
    ...row,
    sizeConsumption: { ...row.sizeConsumption, [scope]: value },
  };
}

export function patchDraftScope<T extends { sizeCodes?: string[] | null; sizeConsumption?: Record<string, number> }>(
  row: T,
  scope: SizeScope,
  allCodes: string[],
): T | null {
  if (scope === ALL_SIZES) return null;
  const current = effectiveSizeCodes(row.sizeCodes, allCodes);
  const next = current.filter((code) => code !== scope);
  if (next.length === 0) return null;
  const rest = { ...(row.sizeConsumption ?? {}) };
  delete rest[scope];
  return { ...row, sizeCodes: next, sizeConsumption: rest };
}

export function attachDraftScope<T extends { sizeCodes?: string[] | null }>(
  row: T,
  scope: SizeScope,
): T {
  if (scope === ALL_SIZES) return { ...row, sizeCodes: null };
  return { ...row, sizeCodes: [scope] };
}

export function sizeCodesFromScopes(
  scopes: Array<{ size: { code: string } }>,
): string[] | null {
  if (scopes.length === 0) return null;
  return scopes.map((row) => row.size.code);
}

export function sizeConsumptionFromNorms(
  norms: Array<{ size: { code: string }; consumptionPerUnit: { toString(): string } | number }>,
): Record<string, number> {
  return Object.fromEntries(
    norms.map((row) => [row.size.code, Number(row.consumptionPerUnit)]),
  );
}
