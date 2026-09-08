import { z } from "zod";
import { parseRateTiersInput } from "@/lib/quantity-tiers";

export const operationCalcMethodSchema = z.enum([
  "UNIT_RATE",
  "SHIFT_OUTPUT",
  "QUANTITY_TIER",
]);

const rateTiersSchema = z
  .array(
    z.object({
      minQuantity: z.coerce.number().int().positive(),
      ratePerUnit: z.coerce.number().min(0),
    }),
  )
  .optional()
  .default([]);

export const operationFormSchema = z
  .object({
    nameUk: z.string().trim().min(1),
    categoryId: z.string().optional().nullable(),
    calculationMethod: operationCalcMethodSchema.default("UNIT_RATE"),
    baseRate: z.coerce.number().min(0).optional().nullable(),
    shiftCost: z.coerce.number().min(0).optional().nullable(),
    standardOutputPerShift: z.coerce.number().min(0).optional().nullable(),
    note: z.string().trim().optional().nullable(),
    rateTiers: rateTiersSchema,
  })
  .superRefine((data, ctx) => {
    if (data.calculationMethod === "UNIT_RATE" && (data.baseRate == null || Number.isNaN(data.baseRate))) {
      ctx.addIssue({ code: "custom", message: "BASE_RATE_REQUIRED", path: ["baseRate"] });
    }
    if (data.calculationMethod === "SHIFT_OUTPUT") {
      if (data.shiftCost == null || Number.isNaN(data.shiftCost)) {
        ctx.addIssue({ code: "custom", message: "SHIFT_COST_REQUIRED", path: ["shiftCost"] });
      }
      if (
        data.standardOutputPerShift == null ||
        Number.isNaN(data.standardOutputPerShift) ||
        data.standardOutputPerShift <= 0
      ) {
        ctx.addIssue({
          code: "custom",
          message: "STANDARD_OUTPUT_REQUIRED",
          path: ["standardOutputPerShift"],
        });
      }
    }
    if (data.calculationMethod === "QUANTITY_TIER") {
      const tiers = parseRateTiersInput(data.rateTiers, data.baseRate ?? 0);
      if (tiers.length === 0) {
        ctx.addIssue({ code: "custom", message: "RATE_TIERS_REQUIRED", path: ["rateTiers"] });
      }
    }
  })
  .transform((data) => {
    if (data.calculationMethod !== "QUANTITY_TIER") {
      return { ...data, rateTiers: [] as Array<{ minQuantity: number; ratePerUnit: number }> };
    }
    return {
      ...data,
      rateTiers: parseRateTiersInput(data.rateTiers, data.baseRate ?? 0),
    };
  });

export type OperationFormValues = z.infer<typeof operationFormSchema>;

/**
 * What the decoration tariff is charged per. Single source of truth for the
 * create form, the catalog table and any seeded data.
 */
export const decorationUnitLabels = {
  PLACEMENT: "Місце нанесення",
  COLOR: "Колір",
  AREA: "Площа",
  UNIT: "Одиниця виробу",
} as const;

export type DecorationUnit = keyof typeof decorationUnitLabels;

export const decorationUnitSchema = z.enum(
  Object.keys(decorationUnitLabels) as [DecorationUnit, ...DecorationUnit[]],
);

export const decorationFormSchema = z.object({
  nameUk: z.string().trim().min(1),
  calculationUnit: decorationUnitSchema,
  setupCost: z.coerce.number().min(0).default(0),
  unitRate: z.coerce.number().min(0).default(0),
  note: z.string().trim().optional().nullable(),
});

export type DecorationFormValues = z.infer<typeof decorationFormSchema>;
