"use client";

import { useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { resolveCutRatePerUnit } from "@/lib/cut-rate";
import { formatMoneyUah } from "@/lib/utils";

export type CutRateTierDraft = { minQuantity: number; ratePerUnit: number };

export const DEFAULT_CUT_RATE_TIERS: CutRateTierDraft[] = [
  { minQuantity: 10, ratePerUnit: 0 },
  { minQuantity: 50, ratePerUnit: 0 },
  { minQuantity: 100, ratePerUnit: 0 },
];

export function ProductCutRateFields({
  optimalQty,
  onOptimalQtyChange,
  tiers,
  onTiersChange,
  previewQty = 40,
  footer,
}: {
  optimalQty: string;
  onOptimalQtyChange: (value: string) => void;
  tiers: CutRateTierDraft[];
  onTiersChange: (tiers: CutRateTierDraft[]) => void;
  previewQty?: number;
  footer?: ReactNode;
}) {
  const previewRate = useMemo(
    () =>
      resolveCutRatePerUnit({
        quantity: previewQty,
        optimalQty: optimalQty ? Number(optimalQty) : null,
        tiers,
        fallbackRate: tiers[tiers.length - 1]?.ratePerUnit ?? 0,
      }),
    [optimalQty, previewQty, tiers],
  );

  return (
    <div className="space-y-3">
      <div className="grid max-w-xs gap-2">
        <Input
          label="Оптимальний тираж, шт"
          type="number"
          min={1}
          value={optimalQty}
          onChange={(event) => onOptimalQtyChange(event.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="erp-table w-full min-w-[320px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-table-section-border)]">
              <th className="py-1.5">Тираж від, шт</th>
              <th className="py-1.5">₴ / шт крою</th>
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
                    value={row.ratePerUnit}
                    onChange={(event) => {
                      const next = [...tiers];
                      next[index] = { ...row, ratePerUnit: Number(event.target.value) };
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
                ratePerUnit: tiers[tiers.length - 1]?.ratePerUnit ?? 0,
              },
            ])
          }
        >
          Додати сходинку
        </Button>
        {footer}
        <span className="type-caption">
          Приклад: {previewQty} шт → {formatMoneyUah(previewRate)} / шт
        </span>
      </div>
    </div>
  );
}
