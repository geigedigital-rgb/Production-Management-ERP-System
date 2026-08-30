import { z } from "zod";

export const materialTypeSchema = z.enum(["FABRIC", "OTHER_MATERIAL", "TRIM"]);
export const materialCostVatModeSchema = z.enum(["NET", "GROSS"]);

const emptyToNull = (value: unknown) => {
  if (value === "" || value === undefined) return null;
  return value;
};

const optionalNonNeg = z.preprocess(
  emptyToNull,
  z.coerce.number().nonnegative().nullable().optional(),
);

const optionalString = z.preprocess(
  emptyToNull,
  z.string().trim().nullable().optional(),
);

export const materialFormSchema = z.object({
  nameUk: z.string().trim().min(1, "REQUIRED"),
  type: materialTypeSchema,
  categoryId: z.string().optional().nullable(),
  unitOfMeasureId: z.string().min(1, "REQUIRED"),
  purchasePrice: z.coerce.number().min(0),
  defaultWastePercent: z.coerce.number().min(0).max(100).default(0),
  supplierCode: optionalString,
  colorOrAttribute: optionalString,
  note: optionalString,
  densityGsm: optionalString,
  composition: optionalString,
  metersPerKg: optionalNonNeg,
  priceKgUsd: optionalNonNeg,
  priceKgUsdCargo: optionalNonNeg,
  priceKgUsdVat: optionalNonNeg,
  priceMeterUahNoVat: optionalNonNeg,
  priceMeterUahVat: optionalNonNeg,
  priceMeterUahCutVat: optionalNonNeg,
  fabricKindUk: optionalString,
  widthCm: optionalString,
  wholesaleNote: optionalString,
  rollWeightKg: optionalNonNeg,
  metersPerRoll: optionalNonNeg,
  minWholesaleMeters: optionalNonNeg,
  costVatOverride: z.preprocess(
    emptyToNull,
    materialCostVatModeSchema.nullable().optional(),
  ),
});

export type MaterialFormValues = z.infer<typeof materialFormSchema>;

export const unitFormSchema = z.object({
  code: z.string().trim().min(1).max(16),
  nameUk: z.string().trim().min(1),
});
