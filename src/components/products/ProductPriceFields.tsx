"use client";

import { useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { resolveCommercialPricePerUnit } from "@/lib/commercial-price";
import {
  DEFAULT_PRICE_TIRAGE_QTYS,
  defaultSewingMultiplierForQty,
  markupAmountFromSewing,
  suggestSellingFromSewingMarkup,
} from "@/lib/sewing-markup";
import { cn, formatMoneyUah } from "@/lib/utils";

export type CommercialPriceTierDraft = {
  minQuantity: number;
  pricePerUnit: number;
  /** Multiplier on sewing labor for this tirage (owner: ×5 at 100 шт, etc.). */
  sewingMultiplier?: number;
};

export type TirageCostHint = {
  minQuantity: number;
  costPerUnit: number;
  sewingPerUnit: number;
  cutPerUnit: number;
};

export function hintForQty(hints: TirageCostHint[] | undefined, qty: number): TirageCostHint | null {
  if (!hints?.length) return null;
  const exact = hints.find((row) => row.minQuantity === qty);
  if (exact) return exact;
  const sorted = [...hints].sort((a, b) => a.minQuantity - b.minQuantity);
  let match = sorted[0] ?? null;
  for (const row of sorted) {
    if (row.minQuantity <= qty) match = row;
    else break;
  }
  return match;
}

/** Fill client price from cost + sewing×multiplier when price is still 0. */
export function hydrateCommercialPriceTiers(
  tiers: CommercialPriceTierDraft[],
  costHints?: TirageCostHint[],
  opts?: { force?: boolean },
): CommercialPriceTierDraft[] {
  return tiers.map((row) => {
    const sewingMultiplier = row.sewingMultiplier ?? defaultSewingMultiplierForQty(row.minQuantity);
    const hint = hintForQty(costHints, row.minQuantity);
    if (!hint) return { ...row, sewingMultiplier };
    if (!opts?.force && row.pricePerUnit > 0) return { ...row, sewingMultiplier };
    return {
      ...row,
      sewingMultiplier,
      pricePerUnit: suggestSellingFromSewingMarkup({
        costPerUnit: hint.costPerUnit,
        sewingPerUnit: hint.sewingPerUnit,
        multiplier: sewingMultiplier,
      }),
    };
  });
}

export const DEFAULT_COMMERCIAL_PRICE_TIERS: CommercialPriceTierDraft[] =
  DEFAULT_PRICE_TIRAGE_QTYS.map((minQuantity) => ({
    minQuantity,
    pricePerUnit: 0,
    sewingMultiplier: defaultSewingMultiplierForQty(minQuantity),
  }));

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

function MoneyCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[var(--color-text-quiet)]">—</span>;
  return <span className="tabular text-[var(--color-text-secondary)]">{formatMoneyUah(value)}</span>;
}

export function ProductPriceFields({
  tiers,
  onTiersChange,
  costHints,
  previewQty = 100,
  footer,
  onRecalc,
}: {
  tiers: CommercialPriceTierDraft[];
  onTiersChange: (tiers: CommercialPriceTierDraft[]) => void;
  costHints?: TirageCostHint[];
  previewQty?: number;
  footer?: ReactNode;
  onRecalc?: () => void;
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

  const hasHints = Boolean(costHints?.length);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-[8px] border border-[var(--color-border)]">
        <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-[var(--color-surface-subtle)]">
              <th className="whitespace-nowrap px-2.5 py-2 font-medium text-[11px] uppercase tracking-[0.04em] text-[var(--color-text-quiet)]">
                Тираж
              </th>
              {hasHints ? (
                <>
                  <th className="whitespace-nowrap px-2.5 py-2 text-right font-medium text-[11px] uppercase tracking-[0.04em] text-[var(--color-text-quiet)]">
                    Собів.
                  </th>
                  <th className="whitespace-nowrap px-2.5 py-2 text-right font-medium text-[11px] uppercase tracking-[0.04em] text-[var(--color-text-quiet)]">
                    Пошив
                  </th>
                  <th className="whitespace-nowrap px-2.5 py-2 text-right font-medium text-[11px] uppercase tracking-[0.04em] text-[var(--color-text-quiet)]">
                    Крій
                  </th>
                  <th className="w-[72px] whitespace-nowrap px-2.5 py-2 text-center font-medium text-[11px] uppercase tracking-[0.04em] text-[var(--color-text-quiet)]">
                    × пошив
                  </th>
                  <th className="whitespace-nowrap px-2.5 py-2 text-right font-medium text-[11px] uppercase tracking-[0.04em] text-[var(--color-text-quiet)]">
                    Націнка
                  </th>
                </>
              ) : null}
              <th className="whitespace-nowrap px-2.5 py-2 text-right font-medium text-[11px] uppercase tracking-[0.04em] text-[var(--color-text-quiet)]">
                Ціна клієнту
              </th>
              <th className="w-9 px-1" />
            </tr>
          </thead>
          <tbody>
            {tiers.map((row, index) => {
              const hint = hintForQty(costHints, row.minQuantity);
              const mult = row.sewingMultiplier ?? defaultSewingMultiplierForQty(row.minQuantity);
              const markup =
                hint != null ? markupAmountFromSewing(hint.sewingPerUnit, mult) : null;
              return (
                <tr
                  key={index}
                  className="border-t border-[var(--color-divider)] hover:bg-[var(--color-surface-tint)]/40"
                >
                  <td className="px-2.5 py-1.5">
                    <CompactInput
                      type="number"
                      min={1}
                      className="w-[68px]"
                      value={row.minQuantity}
                      onChange={(event) => {
                        const minQuantity = Number(event.target.value);
                        const nextHint = hintForQty(costHints, minQuantity);
                        const nextMult =
                          row.sewingMultiplier ?? defaultSewingMultiplierForQty(minQuantity);
                        const next = [...tiers];
                        next[index] = {
                          ...row,
                          minQuantity,
                          sewingMultiplier: nextMult,
                          pricePerUnit:
                            nextHint != null
                              ? suggestSellingFromSewingMarkup({
                                  costPerUnit: nextHint.costPerUnit,
                                  sewingPerUnit: nextHint.sewingPerUnit,
                                  multiplier: nextMult,
                                })
                              : row.pricePerUnit,
                        };
                        onTiersChange(next);
                      }}
                    />
                  </td>
                  {hasHints ? (
                    <>
                      <td className="px-2.5 py-1.5 text-right">
                        <MoneyCell value={hint?.costPerUnit ?? null} />
                      </td>
                      <td className="px-2.5 py-1.5 text-right">
                        <MoneyCell value={hint?.sewingPerUnit ?? null} />
                      </td>
                      <td className="px-2.5 py-1.5 text-right">
                        <MoneyCell value={hint?.cutPerUnit ?? null} />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <CompactInput
                          type="number"
                          min={0}
                          step="0.1"
                          className="mx-auto w-[64px] text-center"
                          value={mult}
                          onChange={(event) => {
                            const nextMult = Number(event.target.value);
                            const nextHint = hintForQty(costHints, row.minQuantity);
                            const suggested =
                              nextHint != null
                                ? suggestSellingFromSewingMarkup({
                                    costPerUnit: nextHint.costPerUnit,
                                    sewingPerUnit: nextHint.sewingPerUnit,
                                    multiplier: nextMult,
                                  })
                                : row.pricePerUnit;
                            const next = [...tiers];
                            next[index] = {
                              ...row,
                              sewingMultiplier: nextMult,
                              pricePerUnit: suggested,
                            };
                            onTiersChange(next);
                          }}
                        />
                      </td>
                      <td className="px-2.5 py-1.5 text-right">
                        <MoneyCell value={markup} />
                      </td>
                    </>
                  ) : null}
                  <td className="px-2.5 py-1.5">
                    <CompactInput
                      type="number"
                      min={0}
                      step="0.01"
                      className="ml-auto w-[96px] text-right font-semibold"
                      value={row.pricePerUnit}
                      onChange={(event) => {
                        const next = [...tiers];
                        next[index] = { ...row, pricePerUnit: Number(event.target.value) };
                        onTiersChange(next);
                      }}
                    />
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--color-text-quiet)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-danger-text)] disabled:opacity-40"
                      onClick={() => onTiersChange(tiers.filter((_, i) => i !== index))}
                      disabled={tiers.length <= 1}
                      aria-label="Видалити рядок"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            const minQuantity = (tiers[tiers.length - 1]?.minQuantity ?? 0) + 50;
            const sewingMultiplier = defaultSewingMultiplierForQty(minQuantity);
            const hint = hintForQty(costHints, minQuantity);
            onTiersChange([
              ...tiers,
              {
                minQuantity,
                sewingMultiplier,
                pricePerUnit: hint
                  ? suggestSellingFromSewingMarkup({
                      costPerUnit: hint.costPerUnit,
                      sewingPerUnit: hint.sewingPerUnit,
                      multiplier: sewingMultiplier,
                    })
                  : 0,
              },
            ]);
          }}
        >
          Додати тираж
        </Button>
        {onRecalc ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRecalc}>
            Перерахувати ціни
          </Button>
        ) : null}
        {footer}
        <span className="type-caption ml-auto">
          {previewQty} шт → {formatMoneyUah(previewPrice ?? 0)} / од.
        </span>
      </div>
    </div>
  );
}
