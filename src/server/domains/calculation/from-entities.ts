import { prisma } from "@/server/db/client";
import {
  calculateCosting,
  type CalculationInput,
  type CalculationResult,
  type MaterialLineInput,
  type OperationLineInput,
} from "@/server/domains/calculation/engine";
import type { getProduct } from "@/server/domains/products/service";
import {
  consumptionForSize,
  effectiveSizeCodes,
  linesForSize,
  sizeCodesFromScopes,
  sizeConsumptionFromNorms,
  sizeWasteFromNorms,
  wasteForSize,
} from "@/lib/size-bom";
import {
  type CutRateTier,
  isCutOperationName,
  resolveCutRatePerUnit,
  resolveCutUnitRateForProduct,
  type CutRateProduct,
} from "@/lib/cut-rate";
import {
  pickOperationQuantityTiers,
  resolveQuantityTierRate,
  type QuantityRateTier,
} from "@/lib/quantity-tiers";
import { resolveSizeCoeffs, isOversizeCode } from "@/lib/size-coeffs";
import { isSewOperationName } from "@/lib/sewing-markup";
import {
  FIXED_COST_ADDITIONAL_ID,
  type FixedCostAllocation,
} from "@/lib/fixed-costs";
import {
  buildFixedCostAllocation,
  fixedCostAdditionalLine,
} from "@/server/domains/fixed-costs/service";

export type CutRateContext = {
  optimalQty: number | null;
  tiers: CutRateTier[];
};

export function cutRateContextFromProduct(
  product: CutRateProduct | null | undefined,
): CutRateContext | null {
  if (!product?.cutRateTiers?.length) return null;
  return {
    optimalQty: product.optimalQty,
    tiers: product.cutRateTiers.map((tier) => ({
      minQuantity: tier.minQuantity,
      ratePerUnit: Number(tier.ratePerUnit),
    })),
  };
}

export type QuantityTierLookup = Record<string, QuantityRateTier[]>;

export function quantityTiersByOperationIdFromProduct(
  product:
    | {
        operations?: Array<{
          operationId: string;
          rateTiers?: Array<{ minQuantity: number; ratePerUnit: unknown }>;
          operation: {
            calculationMethod: string;
            rateTiers?: Array<{ minQuantity: number; ratePerUnit: unknown }>;
          };
        }>;
      }
    | null
    | undefined,
): QuantityTierLookup {
  const result: QuantityTierLookup = {};
  for (const row of product?.operations ?? []) {
    if (row.operation.calculationMethod !== "QUANTITY_TIER") continue;
    const tiers = pickOperationQuantityTiers(row.rateTiers, row.operation.rateTiers);
    if (tiers.length > 0) result[row.operationId] = tiers;
  }
  return result;
}

export function calcOptionsFromProduct(
  product:
    | (CutRateProduct & {
        operations?: Array<{
          operationId: string;
          rateTiers?: Array<{ minQuantity: number; ratePerUnit: unknown }>;
          operation: {
            calculationMethod: string;
            rateTiers?: Array<{ minQuantity: number; ratePerUnit: unknown }>;
          };
        }>;
      })
    | null
    | undefined,
): ResolveOrderOpRateOptions {
  return {
    cutRate: cutRateContextFromProduct(product),
    quantityTiersByOperationId: quantityTiersByOperationIdFromProduct(product),
  };
}

function orderItemTotalQuantity(item: OrderItemForCalc): number {
  return item.sizes.reduce((sum, row) => sum + row.quantity, 0);
}

export type ResolveOrderOpRateOptions = {
  cutRate?: CutRateContext | null;
  quantityTiersByOperationId?: QuantityTierLookup;
};

export function resolveOrderOperationUnitRate(
  row: OrderItemForCalc["operations"][number],
  totalQuantity: number,
  options?: ResolveOrderOpRateOptions | CutRateContext | null,
): number | null {
  // Back-compat: older call sites passed CutRateContext as the 3rd argument.
  const opts: ResolveOrderOpRateOptions =
    options == null
      ? {}
      : "tiers" in options && "optimalQty" in options && !("cutRate" in options)
        ? { cutRate: options as CutRateContext }
        : (options as ResolveOrderOpRateOptions);

  const stored = row.unitRate != null ? Number(row.unitRate) : null;

  if (isCutOperationName(row.nameSnapshot) && opts.cutRate?.tiers.length) {
    return resolveCutRatePerUnit({
      quantity: totalQuantity,
      optimalQty: opts.cutRate.optimalQty,
      tiers: opts.cutRate.tiers,
      fallbackRate: stored ?? 0,
    });
  }

  if (row.calculationMethod === "QUANTITY_TIER" && row.operationId) {
    const tiers = opts.quantityTiersByOperationId?.[row.operationId] ?? [];
    if (tiers.length > 0) {
      return resolveQuantityTierRate({
        quantity: totalQuantity,
        tiers,
        fallbackRate: stored ?? 0,
      });
    }
  }

  return stored;
}

export type ProductDetailForCalc = NonNullable<Awaited<ReturnType<typeof getProduct>>>;
type ProductDetail = ProductDetailForCalc;

export async function getPricingDefaults() {
  const [pricing, sizeRules] = await Promise.all([
    prisma.pricingSettings.findFirst(),
    prisma.sizeRule.findMany({ where: { status: "ACTIVE" } }),
  ]);
  return {
    // Selling price is driven by product commercial tiers (sewing markup × tirage),
    // not by a company-wide % on total cost. Keep rate at 0 so cost calc selling = cost.
    pricingMethod: "MARKUP" as const,
    targetRatePercent: 0,
    minimumMarginPercent: Number(pricing?.minimumMarginPercent ?? 15),
    roundingDecimals: 2,
    sizeRules: sizeRules.map((row) => ({
      sizeCode: row.sizeCode,
      materialCoeff: Number(row.materialCoeff),
      operationCoeff: Number(row.operationCoeff),
    })),
  };
}

/** Project defaults. Order-level % margin override is retired (price list owns selling). */
export async function getPricingForOrder(orderId?: string | null) {
  const defaults = await getPricingDefaults();
  void orderId;
  return { ...defaults, isOrderOverride: false };
}

function resolveProductOperationUnitRate(
  row: ProductDetail["operations"][number],
  quantity: number,
  product: ProductDetail,
): number | null {
  const fallbackRate =
    row.rateOverride != null
      ? Number(row.rateOverride)
      : row.operation.baseRate != null
        ? Number(row.operation.baseRate)
        : null;

  if (isCutOperationName(row.operation.nameUk)) {
    return resolveCutUnitRateForProduct(product, quantity, fallbackRate ?? 0);
  }

  if (row.operation.calculationMethod === "QUANTITY_TIER") {
    const tiers = pickOperationQuantityTiers(row.rateTiers, row.operation.rateTiers);
    return resolveQuantityTierRate({
      quantity,
      tiers,
      fallbackRate: fallbackRate ?? 0,
    });
  }

  return fallbackRate;
}

export type FixedCostCalcOptions = {
  workingDaysPerMonth: number;
  companySewerCount: number;
  dailySewerPay: number;
  monthlyTotal: number;
};

export function buildCalcFromProduct(
  product: ProductDetail,
  quantity: number,
  pricing: {
    pricingMethod: "MARGIN" | "MARKUP";
    targetRatePercent: number;
    sizeRules?: Array<{ sizeCode: string; materialCoeff: number; operationCoeff: number }>;
    fixedCosts?: FixedCostCalcOptions | null;
  },
): CalculationResult {
  const sizeRules = pricing.sizeRules;
  const sizes =
    product.sizes.length > 0
      ? product.sizes.map((row) => {
          const coeffs = resolveSizeCoeffs(row.size.code, sizeRules);
          return {
            sizeCode: row.size.code,
            quantity: 0,
            materialCoeff: coeffs.materialCoeff,
            operationCoeff: coeffs.operationCoeff,
          };
        })
      : [{ sizeCode: "ONE", quantity: 0, materialCoeff: 1, operationCoeff: 1 }];

  const base = Math.floor(quantity / sizes.length);
  let remainder = quantity - base * sizes.length;
  for (const size of sizes) {
    size.quantity = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }

  const sizeCodes =
    product.sizes.length > 0 ? product.sizes.map((row) => row.size.code) : ["ONE"];

  const input: CalculationInput = {
    sizes,
    materials: product.materials.flatMap((row): MaterialLineInput[] => {
      const baseWaste = Number(row.wastePercent ?? row.material.defaultWastePercent);
      const price = Number(row.material.purchasePrice);
      const applies = effectiveSizeCodes(sizeCodesFromScopes(row.sizeScopes), sizeCodes);
      const sizeConsumption = sizeConsumptionFromNorms(row.sizeNorms);
      const sizeWaste = sizeWasteFromNorms(row.sizeNorms);
      const consumptions = applies.map((code) =>
        consumptionForSize(Number(row.consumptionPerUnit), sizeConsumption, code),
      );
      const wastes = applies.map((code) => wasteForSize(baseWaste, sizeWaste, code));
      const shared =
        applies.length === sizeCodes.length &&
        consumptions.every((value) => value === consumptions[0]) &&
        wastes.every((value) => value === wastes[0]);
      if (shared) {
        return [
          {
            id: row.id,
            groupKey: row.materialId,
            sizeCode: null,
            consumptionPerUnit: consumptions[0] ?? Number(row.consumptionPerUnit),
            wastePercent: wastes[0] ?? baseWaste,
            purchasePrice: price,
            applySizeCoeff: true,
          },
        ];
      }
      return applies.map((code, index) => {
        const hasExplicitNorm = sizeConsumption[code] != null;
        return {
          id: `${row.id}:${code}`,
          groupKey: row.materialId,
          sizeCode: code,
          consumptionPerUnit: consumptions[index]!,
          wastePercent: wastes[index]!,
          purchasePrice: price,
          // Explicit per-size norm already embeds oversize uplift — don't apply coeff again.
          applySizeCoeff: !hasExplicitNorm,
        };
      });
    }),
    operations: product.operations.flatMap((row): OperationLineInput[] => {
      const applies = effectiveSizeCodes(sizeCodesFromScopes(row.sizeScopes), sizeCodes);
      const unitRate = resolveProductOperationUnitRate(row, quantity, product);
      const payload = {
        method: row.operation.calculationMethod as "UNIT_RATE" | "SHIFT_OUTPUT" | "QUANTITY_TIER",
        unitRate,
        shiftCost: row.operation.shiftCost != null ? Number(row.operation.shiftCost) : null,
        standardOutput:
          row.standardOverride != null
            ? Number(row.standardOverride)
            : row.operation.standardOutputPerShift != null
              ? Number(row.operation.standardOutputPerShift)
              : null,
        applySizeCoeff: true as const,
      };
      if (applies.length === sizeCodes.length) {
        return [{ id: row.id, groupKey: row.operationId, sizeCode: null, ...payload }];
      }
      return applies.map((code) => ({
        id: `${row.id}:${code}`,
        groupKey: row.operationId,
        sizeCode: code,
        ...payload,
      }));
    }),
    decorations: product.decorations.map((row) => ({
      id: row.id,
      setupCost:
        row.setupCostOverride != null
          ? Number(row.setupCostOverride)
          : Number(row.decorationMethod.setupCost),
      unitRate: Number(row.decorationMethod.unitRate),
    })),
    additionalCosts: product.additionalCosts.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      isPerUnit: row.isPerUnit,
    })),
    pricingMethod: pricing.pricingMethod,
    targetRatePercent: pricing.targetRatePercent,
  };

  if (pricing.fixedCosts) {
    const sewingSizes = sizes.map((size) => {
      let sewingPerUnit = 0;
      for (const row of product.operations) {
        if (!isSewOperationName(row.operation.nameUk)) continue;
        const applies = effectiveSizeCodes(sizeCodesFromScopes(row.sizeScopes), sizeCodes);
        if (!applies.includes(size.sizeCode)) continue;
        const method = row.operation.calculationMethod;
        let unit = 0;
        if (method === "SHIFT_OUTPUT") {
          const output =
            row.standardOverride != null
              ? Number(row.standardOverride)
              : row.operation.standardOutputPerShift != null
                ? Number(row.operation.standardOutputPerShift)
                : 0;
          unit = output > 0 ? Number(row.operation.shiftCost ?? 0) / output : 0;
        } else {
          unit = resolveProductOperationUnitRate(row, quantity, product) ?? 0;
        }
        sewingPerUnit += unit * (size.operationCoeff ?? 1);
      }
      return {
        sizeCode: size.sizeCode,
        quantity: size.quantity,
        sewingPerUnit,
      };
    });
    const allocation = buildFixedCostAllocation({
      ...pricing.fixedCosts,
      sewerCountOverride: null,
      sizes: sewingSizes,
    });
    if (allocation && allocation.fixedCostTotal > 0) {
      input.additionalCosts.push(fixedCostAdditionalLine(allocation));
    }
  }

  return calculateCosting(input);
}

export type OrderItemForCalc = {
  sizes: Array<{ sizeCode: string; quantity: number }>;
  materials: Array<{
    id: string;
    materialId?: string | null;
    nameSnapshot?: string;
    sizeCode?: string | null;
    consumptionPerUnit: { toString(): string } | number;
    wastePercent: { toString(): string } | number;
    purchasePrice: { toString(): string } | number;
  }>;
  operations: Array<{
    id: string;
    operationId?: string | null;
    nameSnapshot?: string;
    sizeCode?: string | null;
    calculationMethod: "UNIT_RATE" | "SHIFT_OUTPUT" | "QUANTITY_TIER";
    unitRate: { toString(): string } | number | null;
    shiftCost: { toString(): string } | number | null;
    standardOutput: { toString(): string } | number | null;
  }>;
  decorations: Array<{
    id: string;
    setupCost: { toString(): string } | number;
    unitRate: { toString(): string } | number;
  }>;
  additionalCosts: Array<{
    id: string;
    amount: { toString(): string } | number;
    isPerUnit: boolean;
  }>;
  fabricDeliveryAmount?: number | { toString(): string } | null;
  sewerCountOverride?: number | null;
};

export type BuildCalcOrderOptions = ResolveOrderOpRateOptions & {
  fixedCosts?: FixedCostCalcOptions | null;
};

/** Sewing ₴/шт per size (Пошиття ops only), with oversize operation coeff. */
export function resolveOrderSewingPerUnitBySize(
  item: OrderItemForCalc,
  options?: ResolveOrderOpRateOptions,
  sizeRules?: Array<{ sizeCode: string; materialCoeff: number; operationCoeff: number }>,
): Array<{ sizeCode: string; quantity: number; sewingPerUnit: number }> {
  const totalQuantity = orderItemTotalQuantity(item);
  return item.sizes.map((size) => {
    const coeffs = resolveSizeCoeffs(size.sizeCode, sizeRules);
    const ops = linesForSize(
      item.operations.map((row) => ({
        id: row.id,
        groupKey: row.operationId ?? row.nameSnapshot ?? row.id,
        sizeCode: row.sizeCode ?? null,
        nameSnapshot: row.nameSnapshot,
        calculationMethod: row.calculationMethod,
        unitRate: row.unitRate,
        shiftCost: row.shiftCost,
        standardOutput: row.standardOutput,
      })),
      size.sizeCode,
    ).filter((row) => isSewOperationName(row.nameSnapshot));

    let sewingPerUnit = 0;
    for (const row of ops) {
      let unit = 0;
      if (row.calculationMethod === "SHIFT_OUTPUT") {
        const output = Number(row.standardOutput ?? 0);
        unit = output > 0 ? Number(row.shiftCost ?? 0) / output : 0;
      } else {
        unit = resolveOrderOperationUnitRate(row, totalQuantity, options) ?? 0;
      }
      sewingPerUnit += unit * coeffs.operationCoeff;
    }
    return {
      sizeCode: size.sizeCode,
      quantity: size.quantity,
      sewingPerUnit,
    };
  });
}

export function resolveFixedCostAllocationForOrderItem(
  item: OrderItemForCalc,
  fixedCosts: FixedCostCalcOptions,
  options?: ResolveOrderOpRateOptions,
  sizeRules?: Array<{ sizeCode: string; materialCoeff: number; operationCoeff: number }>,
): FixedCostAllocation | null {
  const sewingSizes = resolveOrderSewingPerUnitBySize(item, options, sizeRules);
  return buildFixedCostAllocation({
    ...fixedCosts,
    sewerCountOverride: item.sewerCountOverride,
    sizes: sewingSizes,
  });
}

export function buildCalcFromOrderItem(
  item: OrderItemForCalc,
  pricing: {
    pricingMethod: "MARGIN" | "MARKUP";
    targetRatePercent: number;
    manualSellingPricePerUnit?: number | null;
    sizeRules?: Array<{ sizeCode: string; materialCoeff: number; operationCoeff: number }>;
  },
  options?: BuildCalcOrderOptions,
): CalculationResult {
  const totalQuantity = orderItemTotalQuantity(item);
  const fabricDelivery = Number(item.fabricDeliveryAmount ?? 0);
  const additionalCosts = [
    ...item.additionalCosts
      .filter((row) => row.id !== FIXED_COST_ADDITIONAL_ID)
      .map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        isPerUnit: row.isPerUnit,
      })),
    ...(fabricDelivery > 0
      ? [{ id: "fabric-delivery", amount: fabricDelivery, isPerUnit: false }]
      : []),
  ];

  if (options?.fixedCosts) {
    const allocation = resolveFixedCostAllocationForOrderItem(
      item,
      options.fixedCosts,
      options,
      pricing.sizeRules,
    );
    if (allocation && allocation.fixedCostTotal > 0) {
      additionalCosts.push(fixedCostAdditionalLine(allocation));
    }
  }

  const sizeRules = pricing.sizeRules;

  return calculateCosting({
    sizes: item.sizes.map((s) => {
      const coeffs = resolveSizeCoeffs(s.sizeCode, sizeRules);
      return {
        sizeCode: s.sizeCode,
        quantity: s.quantity,
        materialCoeff: coeffs.materialCoeff,
        operationCoeff: coeffs.operationCoeff,
      };
    }),
    materials: item.materials.map((row) => {
      const sizeCode = row.sizeCode ?? null;
      return {
        id: row.id,
        groupKey: row.materialId ?? row.nameSnapshot ?? row.id,
        sizeCode,
        consumptionPerUnit: Number(row.consumptionPerUnit),
        wastePercent: Number(row.wastePercent),
        purchasePrice: Number(row.purchasePrice),
        // Size-specific oversize lines should already carry absolute consumption.
        applySizeCoeff: !(sizeCode != null && isOversizeCode(sizeCode)),
      };
    }),
    operations: item.operations.map((row) => ({
      id: row.id,
      groupKey: row.operationId ?? row.nameSnapshot ?? row.id,
      sizeCode: row.sizeCode ?? null,
      method: row.calculationMethod,
      unitRate: resolveOrderOperationUnitRate(row, totalQuantity, options),
      shiftCost: row.shiftCost != null ? Number(row.shiftCost) : null,
      standardOutput: row.standardOutput != null ? Number(row.standardOutput) : null,
      applySizeCoeff: true,
    })),
    decorations: item.decorations.map((row) => ({
      id: row.id,
      setupCost: Number(row.setupCost),
      unitRate: Number(row.unitRate),
    })),
    additionalCosts,
    pricingMethod: pricing.pricingMethod,
    targetRatePercent: pricing.targetRatePercent,
    manualSellingPricePerUnit: pricing.manualSellingPricePerUnit,
  });
}
