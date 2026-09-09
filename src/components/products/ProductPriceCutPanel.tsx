"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import {
  updateProductCommercialPricesAction,
  updateProductCutRatesAction,
} from "@/server/domains/products/actions";
import {
  hintForQty,
  hydrateCommercialPriceTiers,
  type TirageCostHint,
} from "@/components/products/ProductPriceFields";
import {
  defaultSewingMultiplierForQty,
  markupAmountFromSewing,
  SHARED_PRODUCT_TIRAGE_QTYS,
  suggestSellingFromSewingMarkup,
} from "@/lib/sewing-markup";
import { cn, formatMoneyUah } from "@/lib/utils";

export type UnifiedTirageRow = {
  minQuantity: number;
  cutRatePerUnit: number;
  pricePerUnit: number;
  sewingMultiplier: number;
};

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

function MoneyCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[var(--color-text-quiet)]">—</span>;
  return <span className="tabular text-[var(--color-text-secondary)]">{formatMoneyUah(value)}</span>;
}

function buildUnifiedRows(args: {
  cutTiers: Array<{ minQuantity: number; ratePerUnit: number }>;
  priceTiers: Array<{ minQuantity: number; pricePerUnit: number; sewingMultiplier?: number }>;
  costHints?: TirageCostHint[];
}): UnifiedTirageRow[] {
  const cutMap = new Map(args.cutTiers.map((row) => [row.minQuantity, row.ratePerUnit]));
  const priceMap = new Map(
    args.priceTiers.map((row) => [
      row.minQuantity,
      { price: row.pricePerUnit, mult: row.sewingMultiplier },
    ]),
  );

  // Cut ladder is the source of truth for tirage steps; price rows follow the same qtys.
  const sourceQtys = args.cutTiers.length
    ? [...args.cutTiers.map((row) => row.minQuantity)].filter((qty) => qty > 0).sort((a, b) => a - b)
    : args.priceTiers.length
      ? [...args.priceTiers.map((row) => row.minQuantity)].filter((qty) => qty > 0).sort((a, b) => a - b)
      : [...SHARED_PRODUCT_TIRAGE_QTYS];

  const draft = sourceQtys.map((minQuantity) => {
    const priceInfo = priceMap.get(minQuantity);
    return {
      minQuantity,
      cutRatePerUnit: cutMap.get(minQuantity) ?? 0,
      pricePerUnit: priceInfo?.price ?? 0,
      sewingMultiplier: priceInfo?.mult ?? defaultSewingMultiplierForQty(minQuantity),
    };
  });

  return hydrateCommercialPriceTiers(
    draft.map((row) => ({
      minQuantity: row.minQuantity,
      pricePerUnit: row.pricePerUnit,
      sewingMultiplier: row.sewingMultiplier,
    })),
    args.costHints,
  ).map((hydrated, index) => ({
    ...draft[index]!,
    pricePerUnit: hydrated.pricePerUnit,
    sewingMultiplier: hydrated.sewingMultiplier ?? draft[index]!.sewingMultiplier,
  }));
}

export function ProductPriceCutPanel({
  productId,
  cutTiers,
  priceTiers,
  costHints,
}: {
  productId: string;
  /** @deprecated unused — optimal = last tirage step */
  optimalQty?: number | null;
  cutTiers: Array<{ minQuantity: number; ratePerUnit: number }>;
  /** @deprecated unused — base flag set automatically when prices saved */
  isBaseModel?: boolean;
  priceTiers: Array<{ minQuantity: number; pricePerUnit: number }>;
  costHints?: TirageCostHint[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<UnifiedTirageRow[]>(() =>
    buildUnifiedRows({ cutTiers, priceTiers, costHints }),
  );

  const previewQty = rows.find((row) => row.minQuantity >= 40)?.minQuantity ?? rows[0]?.minQuantity ?? 40;

  const previewCut = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.minQuantity - b.minQuantity);
    const optimal = sorted[sorted.length - 1]?.minQuantity ?? null;
    const effective = optimal != null && previewQty > optimal ? optimal : previewQty;
    let rate = 0;
    for (const row of sorted) {
      if (row.minQuantity <= effective) rate = row.cutRatePerUnit;
      else break;
    }
    return rate;
  }, [previewQty, rows]);

  const previewPrice = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.minQuantity - b.minQuantity);
    let price = sorted[0]?.pricePerUnit ?? 0;
    for (const row of sorted) {
      if (row.minQuantity <= previewQty) price = row.pricePerUnit;
      else break;
    }
    return price;
  }, [previewQty, rows]);

  function updateQty(index: number, minQuantity: number) {
    setRows((prev) => {
      const next = [...prev];
      const row = next[index]!;
      const hint = hintForQty(costHints, minQuantity);
      const sewingMultiplier = row.sewingMultiplier || defaultSewingMultiplierForQty(minQuantity);
      next[index] = {
        ...row,
        minQuantity,
        sewingMultiplier,
        pricePerUnit: hint
          ? suggestSellingFromSewingMarkup({
              costPerUnit: hint.costPerUnit,
              sewingPerUnit: hint.sewingPerUnit,
              multiplier: sewingMultiplier,
            })
          : row.pricePerUnit,
      };
      return next;
    });
  }

  function addTirage() {
    setRows((prev) => {
      const minQuantity = (prev[prev.length - 1]?.minQuantity ?? 0) + 50;
      const sewingMultiplier = defaultSewingMultiplierForQty(minQuantity);
      const hint = hintForQty(costHints, minQuantity);
      return [
        ...prev,
        {
          minQuantity,
          cutRatePerUnit: prev[prev.length - 1]?.cutRatePerUnit ?? 0,
          sewingMultiplier,
          pricePerUnit: hint
            ? suggestSellingFromSewingMarkup({
                costPerUnit: hint.costPerUnit,
                sewingPerUnit: hint.sewingPerUnit,
                multiplier: sewingMultiplier,
              })
            : 0,
        },
      ];
    });
  }

  function saveAll() {
    setError(null);
    const sorted = [...rows].sort((a, b) => a.minQuantity - b.minQuantity);
    const optimalQty = sorted[sorted.length - 1]?.minQuantity ?? "";

    const cutForm = new FormData();
    cutForm.set("productId", productId);
    cutForm.set("optimalQty", String(optimalQty));
    for (const row of rows) {
      cutForm.append("tierMinQuantity", String(row.minQuantity));
      cutForm.append("tierRate", String(row.cutRatePerUnit));
    }

    const priceForm = new FormData();
    priceForm.set("productId", productId);
    if (rows.some((row) => row.pricePerUnit > 0)) {
      priceForm.set("isBaseModel", "1");
    }
    for (const row of rows) {
      priceForm.append("tierMinQuantity", String(row.minQuantity));
      priceForm.append("tierPrice", String(row.pricePerUnit));
    }

    startTransition(async () => {
      const [cutResult, priceResult] = await Promise.all([
        updateProductCutRatesAction(cutForm),
        updateProductCommercialPricesAction(priceForm),
      ]);
      if (!cutResult.ok || !priceResult.ok) {
        setError("Перевірте тиражі, ставки крою та ціни клієнту.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_1px_0_rgba(15,23,32,0.03)]">
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          Прайс і крій за тиражем
        </h3>
        <p className="type-caption mt-0.5 max-w-2xl">
          Тираж спільний. Остання сходинка тиражу — оптимум крою (далі ₴/шт не падає). Прайс
          зберігається разом із кроєм.
        </p>
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <div className="overflow-x-auto rounded-[8px] border border-[var(--color-border)]">
        <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
          <colgroup>
            <col className="w-[72px]" />
            <col className="w-[76px]" />
            <col />
            <col />
            <col className="w-[56px]" />
            <col />
            <col className="w-[100px]" />
            <col className="w-[36px]" />
          </colgroup>
          <thead>
            <tr className="bg-[var(--color-surface-subtle)]">
              <th
                rowSpan={2}
                className="border-r border-[var(--color-border)] px-2 py-2 align-middle text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-secondary)]"
              >
                Тираж
                <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-[var(--color-text-quiet)]">
                  спільний
                </span>
              </th>
              <th
                className="border-r border-[var(--color-border)] bg-[var(--color-tint-amber)]/35 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-warning-text)]"
              >
                Крій
              </th>
              <th
                colSpan={5}
                className="bg-[var(--color-tint-sage)]/50 px-2.5 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-primary-700)]"
              >
                Базовий прайс
              </th>
              <th rowSpan={2} className="w-9" />
            </tr>
            <tr className="border-t border-[var(--color-divider)] bg-[var(--color-surface-subtle)]">
              <th className="border-r border-[var(--color-border)] bg-[var(--color-tint-amber)]/20 px-2 py-2 text-right font-medium text-[11px] uppercase tracking-[0.04em] text-[var(--color-text-quiet)]">
                ₴ / шт
              </th>
              <th className="px-2 py-2 text-right font-medium text-[11px] uppercase tracking-[0.04em] text-[var(--color-text-quiet)]">
                Собів.
              </th>
              <th className="px-2 py-2 text-right font-medium text-[11px] uppercase tracking-[0.04em] text-[var(--color-text-quiet)]">
                Пошив
              </th>
              <th className="px-2 py-2 text-center font-medium text-[11px] uppercase tracking-[0.04em] text-[var(--color-text-quiet)]">
                ×
              </th>
              <th className="px-2 py-2 text-right font-medium text-[11px] uppercase tracking-[0.04em] text-[var(--color-text-quiet)]">
                Націнка
              </th>
              <th className="px-2 py-2 text-right font-medium text-[11px] uppercase tracking-[0.04em] text-[var(--color-text-quiet)]">
                Ціна
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const hint = hintForQty(costHints, row.minQuantity);
              const markup = hint
                ? markupAmountFromSewing(hint.sewingPerUnit, row.sewingMultiplier)
                : null;
              return (
                <tr
                  key={index}
                  className="border-t border-[var(--color-divider)] hover:bg-[var(--color-surface-tint)]/40"
                >
                  <td className="border-r border-[var(--color-border)] bg-[var(--color-surface-subtle)]/60 px-1.5 py-1">
                    <CompactInput
                      type="number"
                      min={1}
                      className="w-full px-1.5 text-center font-semibold"
                      value={row.minQuantity}
                      onChange={(event) => updateQty(index, Number(event.target.value))}
                    />
                  </td>
                  <td className="border-r border-[var(--color-border)] bg-[var(--color-tint-amber)]/10 px-1.5 py-1">
                    <CompactInput
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-full px-1.5 text-right font-semibold"
                      value={row.cutRatePerUnit}
                      onChange={(event) => {
                        const cutRatePerUnit = Number(event.target.value);
                        setRows((prev) => {
                          const next = [...prev];
                          next[index] = { ...row, cutRatePerUnit };
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <MoneyCell value={hint?.costPerUnit ?? null} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <MoneyCell value={hint?.sewingPerUnit ?? null} />
                  </td>
                  <td className="px-1.5 py-1">
                    <CompactInput
                      type="number"
                      min={0}
                      step="0.1"
                      className="mx-auto w-full max-w-[52px] px-1 text-center"
                      value={row.sewingMultiplier}
                      onChange={(event) => {
                        const sewingMultiplier = Number(event.target.value);
                        const nextHint = hintForQty(costHints, row.minQuantity);
                        setRows((prev) => {
                          const next = [...prev];
                          next[index] = {
                            ...row,
                            sewingMultiplier,
                            pricePerUnit: nextHint
                              ? suggestSellingFromSewingMarkup({
                                  costPerUnit: nextHint.costPerUnit,
                                  sewingPerUnit: nextHint.sewingPerUnit,
                                  multiplier: sewingMultiplier,
                                })
                              : row.pricePerUnit,
                          };
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <MoneyCell value={markup} />
                  </td>
                  <td className="px-1.5 py-1">
                    <CompactInput
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-full px-1.5 text-right font-semibold"
                      value={row.pricePerUnit}
                      onChange={(event) => {
                        const pricePerUnit = Number(event.target.value);
                        setRows((prev) => {
                          const next = [...prev];
                          next[index] = { ...row, pricePerUnit };
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="px-0.5 py-1 text-center">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--color-text-quiet)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-danger-text)] disabled:opacity-40"
                      disabled={rows.length <= 1}
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Видалити тираж"
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

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-divider)] pt-3">
        <Button type="button" variant="secondary" size="sm" onClick={addTirage}>
          Додати тираж
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            setRows((prev) =>
              hydrateCommercialPriceTiers(
                prev.map((row) => ({
                  minQuantity: row.minQuantity,
                  pricePerUnit: row.pricePerUnit,
                  sewingMultiplier: row.sewingMultiplier,
                })),
                costHints,
                { force: true },
              ).map((hydrated, index) => ({
                ...prev[index]!,
                pricePerUnit: hydrated.pricePerUnit,
                sewingMultiplier: hydrated.sewingMultiplier ?? prev[index]!.sewingMultiplier,
              })),
            )
          }
        >
          Перерахувати ціни
        </Button>
        <Button type="button" size="sm" onClick={saveAll} disabled={pending}>
          {pending ? "Збереження…" : "Зберегти крій і прайс"}
        </Button>
        <span className="type-caption ml-auto">
          {previewQty} шт → крій {formatMoneyUah(previewCut)} · клієнту {formatMoneyUah(previewPrice)}
        </span>
      </div>
    </div>
  );
}
