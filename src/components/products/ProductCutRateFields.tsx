"use client";

import { useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { resolveCutRatePerUnit, resolveOptimalCutQty } from "@/lib/cut-rate";
import { cn, formatMoneyUah } from "@/lib/utils";

export type CutRateTierDraft = { minQuantity: number; ratePerUnit: number };

export const DEFAULT_CUT_RATE_TIERS: CutRateTierDraft[] = [
  { minQuantity: 10, ratePerUnit: 0 },
  { minQuantity: 20, ratePerUnit: 0 },
  { minQuantity: 30, ratePerUnit: 0 },
  { minQuantity: 50, ratePerUnit: 0 },
  { minQuantity: 60, ratePerUnit: 0 },
  { minQuantity: 100, ratePerUnit: 0 },
  { minQuantity: 150, ratePerUnit: 0 },
  { minQuantity: 200, ratePerUnit: 0 },
  { minQuantity: 250, ratePerUnit: 0 },
];

function CompactInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-8 w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[13px] tabular text-[var(--color-text-primary)] outline-none transition-colors",
        "hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-100)]",
        className,
      )}
    />
  );
}

export function ProductCutRateFields({
  tiers,
  onTiersChange,
  previewQty = 40,
  footer,
}: {
  tiers: CutRateTierDraft[];
  onTiersChange: (tiers: CutRateTierDraft[]) => void;
  previewQty?: number;
  footer?: ReactNode;
}) {
  const optimalQty = resolveOptimalCutQty({
    optimalQty: null,
    tiers,
  });

  const previewRate = useMemo(
    () =>
      resolveCutRatePerUnit({
        quantity: previewQty,
        optimalQty,
        tiers,
        fallbackRate: tiers[tiers.length - 1]?.ratePerUnit ?? 0,
      }),
    [optimalQty, previewQty, tiers],
  );

  return (
    <div className="space-y-3">
      <p className="type-caption">
        Оптимум крою — остання сходинка тиражу ({optimalQty ?? "—"}) шт. Далі ₴/шт не падає.
      </p>
      <div className="overflow-x-auto rounded-[8px] border border-[var(--color-border)]">
        <table className="w-full min-w-[320px] border-collapse text-left text-[13px]">
          <thead className="bg-[var(--color-surface-subtle)]">
            <tr className="border-b border-[var(--color-border)]">
              <th className="px-3 py-2 font-medium text-[var(--color-text-secondary)]">
                Тираж від
              </th>
              <th className="px-3 py-2 font-medium text-[var(--color-text-secondary)]">
                ₴ / шт крою
              </th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, index) => (
              <tr
                key={`${tier.minQuantity}-${index}`}
                className="border-b border-[var(--color-border)] last:border-b-0"
              >
                <td className="px-3 py-2">
                  <CompactInput
                    type="number"
                    min={1}
                    value={tier.minQuantity || ""}
                    onChange={(event) => {
                      const next = [...tiers];
                      next[index] = {
                        ...tier,
                        minQuantity: Number(event.target.value) || 0,
                      };
                      onTiersChange(next);
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <CompactInput
                    type="number"
                    min={0}
                    step="0.01"
                    value={tier.ratePerUnit || ""}
                    onChange={(event) => {
                      const next = [...tiers];
                      next[index] = {
                        ...tier,
                        ratePerUnit: Number(event.target.value) || 0,
                      };
                      onTiersChange(next);
                    }}
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                    onClick={() => onTiersChange(tiers.filter((_, i) => i !== index))}
                    aria-label="Видалити сходинку"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
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
          + Тираж
        </Button>
        <p className="type-caption">
          Приклад: {previewQty} шт → {formatMoneyUah(previewRate)} / шт крою
        </p>
      </div>
      {footer}
    </div>
  );
}
