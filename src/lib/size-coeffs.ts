/** Oversized garment sizes: higher material waste and sewing rates. */
export const OVERSIZE_CODES = ["XXL", "3XL", "4XL"] as const;

export type SizeCoeff = {
  materialCoeff: number;
  operationCoeff: number;
};

export type SizeCoeffRule = {
  sizeCode: string;
  materialCoeff: number;
  operationCoeff: number;
};

/** Default when SizeRule row is missing: +15% materials, +20% operations. */
export const OVERSIZE_DEFAULT_COEFFS: SizeCoeff = {
  materialCoeff: 1.15,
  operationCoeff: 1.2,
};

export function isOversizeCode(sizeCode: string | null | undefined): boolean {
  if (!sizeCode) return false;
  return (OVERSIZE_CODES as readonly string[]).includes(sizeCode);
}

export function pctToCoeff(pct: number): number {
  if (!Number.isFinite(pct) || pct < 0) return 1;
  return 1 + pct / 100;
}

export function coeffToPct(coeff: number): number {
  if (!Number.isFinite(coeff) || coeff <= 0) return 0;
  return Math.round((coeff - 1) * 1000) / 10;
}

export function resolveSizeCoeffs(
  sizeCode: string,
  rules?: SizeCoeffRule[] | null,
): SizeCoeff {
  const fromRules = rules?.find((row) => row.sizeCode === sizeCode);
  if (fromRules) {
    return {
      materialCoeff: Number(fromRules.materialCoeff) || 1,
      operationCoeff: Number(fromRules.operationCoeff) || 1,
    };
  }
  if (isOversizeCode(sizeCode)) return { ...OVERSIZE_DEFAULT_COEFFS };
  return { materialCoeff: 1, operationCoeff: 1 };
}

/** Shared oversize uplift from rules (XXL / 3XL / 4XL); falls back to defaults. */
export function resolveOversizeUplift(rules?: SizeCoeffRule[] | null): SizeCoeff {
  for (const code of OVERSIZE_CODES) {
    const fromRules = rules?.find((row) => row.sizeCode === code);
    if (fromRules) {
      return {
        materialCoeff: Number(fromRules.materialCoeff) || 1,
        operationCoeff: Number(fromRules.operationCoeff) || 1,
      };
    }
  }
  return { ...OVERSIZE_DEFAULT_COEFFS };
}

export function oversizeMaterialPct(rules?: SizeCoeffRule[] | null): number {
  return Math.round(coeffToPct(resolveOversizeUplift(rules).materialCoeff));
}

export function oversizeOperationPct(rules?: SizeCoeffRule[] | null): number {
  return Math.round(coeffToPct(resolveOversizeUplift(rules).operationCoeff));
}

/** Short Ukrainian labels for BOM / calc UI. */
export function oversizeUpliftCaption(rules?: SizeCoeffRule[] | null): string {
  return `XXL+ · матеріали +${oversizeMaterialPct(rules)}% · операції +${oversizeOperationPct(rules)}%`;
}

export function effectiveOversizeConsumption(
  base: number,
  materialCoeff: number = OVERSIZE_DEFAULT_COEFFS.materialCoeff,
): number {
  return Math.round(base * materialCoeff * 10000) / 10000;
}
