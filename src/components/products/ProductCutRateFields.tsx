"use client";

import { useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className,
      )}
    />
  );
}

function cutRateFromOptimalTotal(optimalTotal: number, qty: number): number {
  if (!(qty > 0) || !(optimalTotal >= 0) || !Number.isFinite(optimalTotal)) return 0;
  return Math.round((optimalTotal / qty) * 100) / 100;
}

function ensureOptimalRow(
  tiers: CutRateTierDraft[],
  optimalQty: number,
  ratePerUnit: number,
): CutRateTierDraft[] {
  if (!(optimalQty > 0)) return tiers;
  const idx = tiers.findIndex((tier) => tier.minQuantity === optimalQty);
  if (idx >= 0) {
    const next = [...tiers];
    next[idx] = { ...next[idx]!, ratePerUnit };
    return next.sort((a, b) => a.minQuantity - b.minQuantity);
  }
  return [...tiers, { minQuantity: optimalQty, ratePerUnit }].sort(
    (a, b) => a.minQuantity - b.minQuantity,
  );
}

function spreadCutFromOptimal(
  tiers: CutRateTierDraft[],
  optimalTotal: number,
): CutRateTierDraft[] {
  return tiers.map((tier) => ({
    ...tier,
    ratePerUnit: cutRateFromOptimalTotal(optimalTotal, tier.minQuantity),
  }));
}

export function ProductCutRateFields({
  tiers,
  onTiersChange,
  optimalQty: controlledOptimalQty,
  onOptimalQtyChange,
  optimalCutTotal: controlledOptimalTotal,
  onOptimalCutTotalChange,
  previewQty = 40,
  footer,
}: {
  tiers: CutRateTierDraft[];
  onTiersChange: (tiers: CutRateTierDraft[]) => void;
  optimalQty?: number;
  onOptimalQtyChange?: (qty: number) => void;
  optimalCutTotal?: number;
  onOptimalCutTotalChange?: (total: number) => void;
  previewQty?: number;
  footer?: ReactNode;
}) {
  const derivedOptimal = resolveOptimalCutQty({
    optimalQty: controlledOptimalQty ?? null,
    tiers,
  });
  const optimalQty = controlledOptimalQty ?? derivedOptimal ?? 100;
  const optimalCutTotal =
    controlledOptimalTotal ??
    Math.round(
      (tiers.find((t) => t.minQuantity === optimalQty)?.ratePerUnit ??
        tiers[tiers.length - 1]?.ratePerUnit ??
        0) *
        optimalQty *
        100,
    ) / 100;

  function applyOptimal(nextQty: number, nextTotal: number) {
    const qty = Math.max(1, Math.round(nextQty) || 1);
    const total = Math.max(0, Number.isFinite(nextTotal) ? nextTotal : 0);
    const rate = cutRateFromOptimalTotal(total, qty);
    onOptimalQtyChange?.(qty);
    onOptimalCutTotalChange?.(Math.round(total * 100) / 100);
    onTiersChange(spreadCutFromOptimal(ensureOptimalRow(tiers, qty, rate), total));
  }

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
        Оптимальний тираж і вартість крою на нього → ₴/шт = вартість ÷ тираж. Решта сходинок
        рахується так само. Вище оптимуму ₴/шт не падає.
      </p>

      {(onOptimalQtyChange || onOptimalCutTotalChange) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="type-caption">Оптимальний тираж, шт</span>
            <Input
              type="number"
              min={1}
              step={1}
              value={optimalQty}
              onChange={(event) => applyOptimal(Number(event.target.value), optimalCutTotal)}
            />
          </label>
          <label className="block space-y-1">
            <span className="type-caption">Вартість крою на оптимум, ₴</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={optimalCutTotal}
              onChange={(event) => applyOptimal(optimalQty, Number(event.target.value))}
            />
          </label>
        </div>
      )}

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
            {tiers.map((tier, index) => {
              const isOptimal = tier.minQuantity === optimalQty;
              return (
                <tr
                  key={`${tier.minQuantity}-${index}`}
                  className={cn(
                    "border-b border-[var(--color-border)] last:border-b-0",
                    isOptimal && "bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]",
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <CompactInput
                        type="number"
                        min={1}
                        value={tier.minQuantity || ""}
                        onChange={(event) => {
                          const minQuantity = Number(event.target.value) || 0;
                          const next = [...tiers];
                          next[index] = {
                            ...tier,
                            minQuantity,
                            ratePerUnit: cutRateFromOptimalTotal(optimalCutTotal, minQuantity),
                          };
                          onTiersChange(next);
                        }}
                      />
                      {isOptimal ? (
                        <span className="type-caption shrink-0 text-[var(--color-accent)]">
                          опт.
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <CompactInput
                      type="number"
                      min={0}
                      step="0.01"
                      value={tier.ratePerUnit || ""}
                      onChange={(event) => {
                        const ratePerUnit = Number(event.target.value) || 0;
                        const next = [...tiers];
                        next[index] = { ...tier, ratePerUnit };
                        onTiersChange(next);
                        if (isOptimal) {
                          onOptimalCutTotalChange?.(
                            Math.round(ratePerUnit * optimalQty * 100) / 100,
                          );
                        }
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
              );
            })}
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
                ratePerUnit: cutRateFromOptimalTotal(
                  optimalCutTotal,
                  (tiers[tiers.length - 1]?.minQuantity ?? 0) + 50,
                ),
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
