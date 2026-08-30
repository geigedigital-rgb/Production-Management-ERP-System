"use client";

import { useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { resolveCommercialPricePerUnit } from "@/lib/commercial-price";
import { formatMoneyUah } from "@/lib/utils";

export type CommercialPriceTierDraft = { minQuantity: number; pricePerUnit: number };

export const DEFAULT_COMMERCIAL_PRICE_TIERS: CommercialPriceTierDraft[] = [
  { minQuantity: 30, pricePerUnit: 0 },
  { minQuantity: 60, pricePerUnit: 0 },
  { minQuantity: 100, pricePerUnit: 0 },
];

export function ProductPriceFields({
  tiers,
  onTiersChange,
  previewQty = 40,
  footer,
}: {
  tiers: CommercialPriceTierDraft[];
  onTiersChange: (tiers: CommercialPriceTierDraft[]) => void;
  previewQty?: number;
  footer?: ReactNode;
}) {
  const previewPrice = useMemo(
    () =>
      resolveCommercialPricePerUnit({
        quantity: previewQty,
        tiers,
        fallbackPrice: tiers[0]?.pricePerUnit ?? 0,
      }),
    [previewQty, tiers],
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="erp-table w-full min-w-[320px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-table-section-border)]">
              <th className="py-1.5">Тираж від, шт</th>
              <th className="py-1.5">Ціна для клієнта / од.</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {tiers.map((row, index) => (
              <tr key={index} className="border-b border-[var(--color-border-muted)]">
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={1}
                    className="field-input w-full"
                    value={row.minQuantity}
                    onChange={(event) => {
                      const next = [...tiers];
                      next[index] = { ...row, minQuantity: Number(event.target.value) };
                      onTiersChange(next);
                    }}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="field-input w-full"
                    value={row.pricePerUnit}
                    onChange={(event) => {
                      const next = [...tiers];
                      next[index] = { ...row, pricePerUnit: Number(event.target.value) };
                      onTiersChange(next);
                    }}
                  />
                </td>
                <td className="py-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onTiersChange(tiers.filter((_, i) => i !== index))}
                    disabled={tiers.length <= 1}
                  >
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            onTiersChange([
              ...tiers,
              {
                minQuantity: (tiers[tiers.length - 1]?.minQuantity ?? 0) + 50,
                pricePerUnit: tiers[tiers.length - 1]?.pricePerUnit ?? 0,
              },
            ])
          }
        >
          Додати діапазон
        </Button>
        {footer}
        <span className="type-caption">
          Приклад: {previewQty} шт → {formatMoneyUah(previewPrice ?? 0)} / од. (без брендування)
        </span>
      </div>
    </div>
  );
}
