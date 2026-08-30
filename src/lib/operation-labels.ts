export type OperationCalcMethod = "UNIT_RATE" | "SHIFT_OUTPUT" | "QUANTITY_TIER";

export const OPERATION_METHOD_LABELS: Record<OperationCalcMethod, string> = {
  UNIT_RATE: "Ставка / од.",
  SHIFT_OUTPUT: "Зміна / норма",
  QUANTITY_TIER: "За кількістю",
};

export function operationMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  return OPERATION_METHOD_LABELS[method as OperationCalcMethod] ?? method;
}
