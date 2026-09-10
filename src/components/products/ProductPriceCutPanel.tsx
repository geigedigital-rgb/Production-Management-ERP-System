"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateProductCommercialPricesAction, updateProductCutRatesAction } from "@/server/domains/products/actions";
import {
  hintForQty,
  hydrateCommercialPriceTiers,
  type TirageCostHint,
} from "@/components/products/ProductPriceFields";
import { resolveCutRatePerUnit, resolveOptimalCutQty } from "@/lib/cut-rate";
import { resolveCommercialPricePerUnit } from "@/lib/commercial-price";
import { defaultSewingMultiplierForQty } from "@/lib/sewing-markup";
import { formatMoneyUah } from "@/lib/utils";

type Row = {
  minQuantity: number;
  cutRate: number;
  pricePerUnit: number;
  sewingMultiplier: number;
  showOnCard: boolean;
};

function CompactInput(props: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={[
        "h-7 w-full min-w-0 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 text-[12.5px] tabular-nums text-[var(--color-text)]",
        "focus-visible:border-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color-mix(in_srgb,var(--color-accent)_22%,transparent)]",
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function MoneyCell({ value }: { value: number }) {
  return (
    <span className="type-mono text-[11.5px] tabular-nums text-[var(--color-text-quiet)]">
      {Number.isFinite(value) ? formatMoneyUah(value) : "—"}
    </span>
  );
}

function cutRateFromOptimalTotal(optimalTotal: number, qty: number): number {
  if (!(qty > 0) || !(optimalTotal >= 0) || !Number.isFinite(optimalTotal)) return 0;
  return Math.round((optimalTotal / qty) * 100) / 100;
}

function ensureOptimalRow(rows: Row[], optimalQty: number, cutRate: number): Row[] {
  if (!(optimalQty > 0)) return rows;
  const idx = rows.findIndex((row) => row.minQuantity === optimalQty);
  if (idx >= 0) {
    const next = [...rows];
    next[idx] = { ...next[idx]!, cutRate };
    return next.sort((a, b) => a.minQuantity - b.minQuantity);
  }
  const last = rows[rows.length - 1];
  return [
    ...rows,
    {
      minQuantity: optimalQty,
      cutRate,
      pricePerUnit: last?.pricePerUnit ?? 0,
      sewingMultiplier: last?.sewingMultiplier ?? defaultSewingMultiplierForQty(optimalQty),
      showOnCard: false,
    },
  ].sort((a, b) => a.minQuantity - b.minQuantity);
}

/** Розкладає крій по всіх сходинках від вартості оптимуму: ₴/шт = вартість_оптимуму ÷ тираж_сходинки. */
function spreadCutFromOptimal(rows: Row[], optimalTotal: number): Row[] {
  return rows.map((row) => ({
    ...row,
    cutRate: cutRateFromOptimalTotal(optimalTotal, row.minQuantity),
  }));
}

export function ProductPriceCutPanel({
  productId,
  optimalQty: initialOptimalQty,
  cutTiers,
  isBaseModel: initialIsBaseModel,
  priceTiers,
  costHints = [],
}: {
  productId: string;
  optimalQty: number | null;
  cutTiers: Array<{ minQuantity: number; ratePerUnit: number }>;
  isBaseModel: boolean;
  priceTiers: Array<{ minQuantity: number; pricePerUnit: number; showOnCard?: boolean }>;
  costHints?: TirageCostHint[];
}) {
  const initialMerged = useMemo(() => {
    const qtySet = new Set<number>();
    for (const t of cutTiers) qtySet.add(t.minQuantity);
    for (const t of priceTiers) qtySet.add(t.minQuantity);
    const qtys = [...qtySet].sort((a, b) => a - b);
    if (qtys.length === 0) qtys.push(50);

    const cutMap = new Map(cutTiers.map((t) => [t.minQuantity, t.ratePerUnit]));
    const priceMap = new Map(priceTiers.map((t) => [t.minQuantity, t.pricePerUnit]));
    const cardMap = new Map(priceTiers.map((t) => [t.minQuantity, t.showOnCard === true]));

    const base = qtys.map((q) => ({
      minQuantity: q,
      cutRate: cutMap.get(q) ?? 0,
      pricePerUnit: priceMap.get(q) ?? 0,
      sewingMultiplier: defaultSewingMultiplierForQty(q),
      showOnCard: cardMap.get(q) ?? false,
    }));

    return hydrateCommercialPriceTiers(base, costHints).map((row, index) => ({
      minQuantity: row.minQuantity,
      pricePerUnit: row.pricePerUnit,
      sewingMultiplier: row.sewingMultiplier ?? defaultSewingMultiplierForQty(row.minQuantity),
      cutRate: base[index]?.cutRate ?? 0,
      showOnCard: base[index]?.showOnCard ?? false,
    }));
  }, [cutTiers, priceTiers, costHints]);

  const resolvedInitialOptimal = useMemo(() => {
    if (initialOptimalQty != null && initialOptimalQty > 0) return initialOptimalQty;
    return (
      resolveOptimalCutQty({
        optimalQty: null,
        tiers: cutTiers.map((t) => ({ minQuantity: t.minQuantity, ratePerUnit: t.ratePerUnit })),
      }) ??
      cutTiers[cutTiers.length - 1]?.minQuantity ??
      50
    );
  }, [initialOptimalQty, cutTiers]);

  const initialOptimalTotal = useMemo(() => {
    const rate =
      cutTiers.find((t) => t.minQuantity === resolvedInitialOptimal)?.ratePerUnit ??
      cutTiers[cutTiers.length - 1]?.ratePerUnit ??
      0;
    return Math.round(rate * resolvedInitialOptimal * 100) / 100;
  }, [cutTiers, resolvedInitialOptimal]);

  const [rows, setRows] = useState(() =>
    initialMerged.map((r) => ({
      minQuantity: r.minQuantity,
      cutRate: r.cutRate,
      pricePerUnit: r.pricePerUnit,
      sewingMultiplier: r.sewingMultiplier,
      showOnCard: r.showOnCard,
    })),
  );
  const [optimalQty, setOptimalQty] = useState(resolvedInitialOptimal);
  const [optimalCutTotal, setOptimalCutTotal] = useState(initialOptimalTotal);
  const [isBaseModel, setIsBaseModel] = useState(initialIsBaseModel);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const previewQty = rows[0]?.minQuantity || 50;
  const previewCut = resolveCutRatePerUnit({
    quantity: previewQty,
    optimalQty,
    tiers: rows.map((r) => ({ minQuantity: r.minQuantity, ratePerUnit: r.cutRate })),
    fallbackRate: rows[rows.length - 1]?.cutRate ?? 0,
  });
  const previewPrice =
    resolveCommercialPricePerUnit({
      quantity: previewQty,
      tiers: rows.map((r) => ({ minQuantity: r.minQuantity, pricePerUnit: r.pricePerUnit })),
      fallbackPrice: rows[0]?.pricePerUnit ?? 0,
    }) ?? 0;

  function applyOptimal(nextQty: number, nextTotal: number, spreadAll: boolean) {
    const qty = Math.max(1, Math.round(nextQty) || 1);
    const total = Math.max(0, Number.isFinite(nextTotal) ? nextTotal : 0);
    const rate = cutRateFromOptimalTotal(total, qty);
    setOptimalQty(qty);
    setOptimalCutTotal(Math.round(total * 100) / 100);
    setRows((prev) => {
      const withRow = ensureOptimalRow(prev, qty, rate);
      return spreadAll ? spreadCutFromOptimal(withRow, total) : withRow;
    });
  }

  function addTirage() {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      const nextQty = last ? last.minQuantity * 2 : 50;
      const next: Row = {
        minQuantity: nextQty,
        cutRate: cutRateFromOptimalTotal(optimalCutTotal, nextQty),
        pricePerUnit: last?.pricePerUnit ?? 0,
        sewingMultiplier: last?.sewingMultiplier ?? defaultSewingMultiplierForQty(nextQty),
        showOnCard: false,
      };
      const hydrated = hydrateCommercialPriceTiers(
        [...prev, next].map((r) => ({
          minQuantity: r.minQuantity,
          pricePerUnit: r.pricePerUnit,
          sewingMultiplier: r.sewingMultiplier,
          cutRate: r.cutRate,
        })),
        costHints,
      );
      return hydrated.map((h, i) => ({
        minQuantity: h.minQuantity,
        cutRate: i < prev.length ? prev[i]!.cutRate : next.cutRate,
        pricePerUnit: h.pricePerUnit,
        sewingMultiplier: h.sewingMultiplier ?? defaultSewingMultiplierForQty(h.minQuantity),
        showOnCard: i < prev.length ? prev[i]!.showOnCard : false,
      }));
    });
  }

  function saveAll() {
    setMessage(null);
    startTransition(async () => {
      const cutResult = await updateProductCutRatesAction({
        productId,
        optimalQty,
        tiers: rows.map((r) => ({
          minQuantity: r.minQuantity,
          ratePerUnit: r.cutRate,
        })),
      });
      if (!cutResult.ok) {
        setMessage(cutResult.error);
        return;
      }
      const priceResult = await updateProductCommercialPricesAction({
        productId,
        isBaseModel,
        tiers: rows.map((r) => ({
          minQuantity: r.minQuantity,
          pricePerUnit: r.pricePerUnit,
          showOnCard: r.showOnCard,
        })),
      });
      setMessage(priceResult.ok ? "Крій і прайс збережено" : priceResult.error);
    });
  }

  return (
    <div className="space-y-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="type-label">Прайс і крій</p>
          <p className="type-caption mt-0.5">
            Спочатку оптимум: вартість крою ÷ тираж → ₴/шт. Галочка «У картці» — базовий прайс у меню
            «Вироби».
          </p>
        </div>
        <label className="inline-flex items-center gap-2 type-caption">
          <input
            type="checkbox"
            checked={isBaseModel}
            onChange={(event) => setIsBaseModel(event.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border)]"
          />
          Базова модель (без націнки за крій)
        </label>
      </div>

      <div className="grid gap-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-2.5 sm:grid-cols-[7.5rem_9rem_auto] sm:items-end">
        <label className="block space-y-1">
          <span className="type-caption">Оптимум, шт</span>
          <Input
            type="number"
            min={1}
            step={1}
            inputClassName="h-8 text-[13px]"
            value={optimalQty}
            onChange={(event) => applyOptimal(Number(event.target.value), optimalCutTotal, true)}
          />
        </label>
        <label className="block space-y-1">
          <span className="type-caption">Крій на оптимум, ₴</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            inputClassName="h-8 text-[13px]"
            value={optimalCutTotal}
            onChange={(event) => applyOptimal(optimalQty, Number(event.target.value), true)}
          />
        </label>
        <div className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5">
          <p className="type-caption">₴/шт</p>
          <p className="type-mono text-[14px] font-semibold tabular-nums">
            {formatMoneyUah(cutRateFromOptimalTotal(optimalCutTotal, optimalQty))}
          </p>
        </div>
      </div>

      {message ? <p className="type-caption text-[var(--color-text-muted)]">{message}</p> : null}

      <div className="overflow-x-auto rounded-[12px] border border-[var(--color-border)]">
        <table className="w-auto min-w-0 border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-divider)] bg-[var(--color-bg)]/50">
              <th className="whitespace-nowrap px-1 py-1.5 type-caption font-medium" title="Показувати в картці виробу">
                Картка
              </th>
              <th className="whitespace-nowrap px-1.5 py-1.5 type-caption font-medium">Тираж</th>
              <th className="whitespace-nowrap px-1.5 py-1.5 type-caption font-medium">Крій</th>
              <th className="whitespace-nowrap px-1.5 py-1.5 type-caption font-medium">Собів.</th>
              <th className="whitespace-nowrap px-1.5 py-1.5 type-caption font-medium">Пошив</th>
              <th className="whitespace-nowrap px-1 py-1.5 type-caption font-medium">×</th>
              <th className="whitespace-nowrap px-1.5 py-1.5 type-caption font-medium">Націнка</th>
              <th className="whitespace-nowrap px-1.5 py-1.5 type-caption font-medium">Ціна</th>
              <th className="w-7 px-0.5 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const hint = hintForQty(costHints, row.minQuantity);
              const sewing = hint?.sewingPerUnit ?? 0;
              const cost = hint?.costPerUnit ?? 0;
              const markup = row.pricePerUnit - cost;
              const isOptimal = row.minQuantity === optimalQty;
              return (
                <tr
                  key={`${row.minQuantity}-${index}`}
                  className={[
                    "border-b border-[var(--color-divider)] last:border-0",
                    isOptimal ? "bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]" : "",
                  ].join(" ")}
                >
                  <td className="px-1 py-0.5 text-center">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-[var(--color-border)]"
                      checked={row.showOnCard}
                      title="Базовий прайс у картці «Вироби»"
                      onChange={(event) => {
                        const showOnCard = event.target.checked;
                        setRows((prev) => {
                          const next = [...prev];
                          next[index] = { ...row, showOnCard };
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <div className="flex items-center gap-0.5">
                      <CompactInput
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        className="w-[3.25rem] text-right"
                        value={row.minQuantity}
                        onChange={(event) => {
                          const minQuantity = Math.max(1, Math.round(Number(event.target.value)) || 1);
                          setRows((prev) => {
                            const next = [...prev];
                            next[index] = {
                              ...row,
                              minQuantity,
                              cutRate: cutRateFromOptimalTotal(optimalCutTotal, minQuantity),
                            };
                            return next.sort((a, b) => a.minQuantity - b.minQuantity);
                          });
                        }}
                      />
                      {isOptimal ? (
                        <span className="type-caption shrink-0 text-[10px] text-[var(--color-accent)]">
                          опт
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-1 py-0.5">
                    <CompactInput
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      className="w-[3.75rem] text-right"
                      value={row.cutRate}
                      title="Можна підправити вручну; «Розкласти крій» знову візьме від оптимуму"
                      onChange={(event) => {
                        const cutRate = Number(event.target.value);
                        setRows((prev) => {
                          const next = [...prev];
                          next[index] = { ...row, cutRate };
                          return next;
                        });
                        if (isOptimal && Number.isFinite(cutRate)) {
                          setOptimalCutTotal(Math.round(cutRate * optimalQty * 100) / 100);
                        }
                      }}
                    />
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-0.5 text-right">
                    <MoneyCell value={cost} />
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-0.5 text-right">
                    <MoneyCell value={sewing} />
                  </td>
                  <td className="px-1 py-0.5">
                    <CompactInput
                      type="number"
                      min={1}
                      step="0.01"
                      inputMode="decimal"
                      className="w-[2.75rem] text-right"
                      value={row.sewingMultiplier}
                      onChange={(event) => {
                        const sewingMultiplier = Number(event.target.value);
                        const pricePerUnit =
                          sewing > 0 && Number.isFinite(sewingMultiplier)
                            ? Math.round(sewing * sewingMultiplier * 100) / 100
                            : row.pricePerUnit;
                        setRows((prev) => {
                          const next = [...prev];
                          next[index] = { ...row, sewingMultiplier, pricePerUnit };
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-0.5 text-right">
                    <MoneyCell value={markup} />
                  </td>
                  <td className="px-1 py-0.5">
                    <CompactInput
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      className="w-[4.25rem] text-right font-semibold"
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
                  <td className="px-0.5 py-0.5 text-center">
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-[5px] text-[11px] text-[var(--color-text-quiet)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-danger-text)] disabled:opacity-40"
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
            setRows((prev) => spreadCutFromOptimal(ensureOptimalRow(prev, optimalQty, cutRateFromOptimalTotal(optimalCutTotal, optimalQty)), optimalCutTotal))
          }
        >
          Розкласти крій
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
