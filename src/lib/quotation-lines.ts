export type QuotationSizeRow = {
  key: string;
  nameUk: string;
  sizeNameUk: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** e.g. «Нанесення: вишивка логотипу» */
  decorationsLabel: string | null;
};

export type QuotationSnapshot = {
  item?: {
    nameUk?: string;
    totalQuantity?: number;
    sizes?: Array<{ sizeCode: string; sizeNameUk: string; quantity: number }>;
    decorations?: Array<{ nameSnapshot: string }>;
  };
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function decorationLabels(decorations: Array<{ nameSnapshot: string }>) {
  return decorations.map((row) => row.nameSnapshot.trim()).filter(Boolean);
}

/** One KP table row per size (or one row if no size grid). */
export function buildQuotationSizeRows(input: {
  itemKey: string;
  snapshot: QuotationSnapshot;
  unitPrice: number;
  fallbackNameUk: string;
  fallbackSizes: Array<{ sizeCode: string; sizeNameUk: string; quantity: number }>;
  fallbackDecorations: Array<{ nameSnapshot: string }>;
  fallbackTotalQuantity: number;
}): QuotationSizeRow[] {
  const snapItem = input.snapshot.item;
  const nameUk = snapItem?.nameUk ?? input.fallbackNameUk;
  const sizes = snapItem?.sizes ?? input.fallbackSizes;
  const decorations = snapItem?.decorations ?? input.fallbackDecorations;
  const totalQuantity = snapItem?.totalQuantity ?? input.fallbackTotalQuantity;
  const unitPrice = input.unitPrice;

  const labels = decorationLabels(decorations);
  const decorationsLabel =
    labels.length > 0 ? `Нанесення: ${labels.join(", ")}` : null;

  const sizesWithQty = sizes.filter((size) => size.quantity > 0);

  if (sizesWithQty.length === 0) {
    return [
      {
        key: input.itemKey,
        nameUk,
        sizeNameUk: null,
        quantity: totalQuantity,
        unitPrice,
        lineTotal: roundMoney(unitPrice * totalQuantity),
        decorationsLabel,
      },
    ];
  }

  return sizesWithQty.map((size) => ({
    key: `${input.itemKey}-${size.sizeCode}`,
    nameUk,
    sizeNameUk: size.sizeNameUk,
    quantity: size.quantity,
    unitPrice,
    lineTotal: roundMoney(unitPrice * size.quantity),
    decorationsLabel,
  }));
}

export function quotationGrandTotal(
  lines: Array<{ version: { totalSellingValue: unknown } }>,
) {
  return lines.reduce((sum, row) => sum + Number(row.version.totalSellingValue), 0);
}
