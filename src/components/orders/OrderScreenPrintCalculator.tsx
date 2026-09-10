"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { IconPlus } from "@/components/ui/Icons";
import { syncOrderScreenPrintAction } from "@/server/domains/screen-print/actions";
import {
  isScreenPrintDecorationName,
  lookupScreenPrintBaseRate,
  parseScreenPrintLineName,
  resolveScreenPrintUnitRate,
  uniqueColorCounts,
  type ScreenPrintCoefficient,
  type ScreenPrintPriceCell,
} from "@/lib/screen-print-pricing";
import { formatMoneyUah } from "@/lib/utils";
import { SoftBusy } from "@/components/ui/SoftBusy";

type ExistingDecoration = {
  id: string;
  name: string;
};

/**
 * 1) Pick silk-screen (color count) — draft only.
 * 2) Optional coefficient checkboxes appear.
 * 3) «Додати» writes the decoration row into the order calculation.
 */
export function OrderScreenPrintCalculator({
  orderId,
  orderItemId,
  quantity,
  cells,
  coefficients,
  existingDecorations = [],
  locked,
}: {
  orderId: string;
  orderItemId: string;
  quantity: number;
  cells: ScreenPrintPriceCell[];
  coefficients: ScreenPrintCoefficient[];
  existingDecorations?: ExistingDecoration[];
  locked?: boolean;
}) {
  const router = useRouter();
  const existing = useMemo(
    () => existingDecorations.find((row) => isScreenPrintDecorationName(row.name)) ?? null,
    [existingDecorations],
  );
  const parsed = useMemo(
    () => (existing ? parseScreenPrintLineName(existing.name) : null),
    [existing],
  );

  const colorOptions = useMemo(() => {
    const colors = uniqueColorCounts(cells);
    return colors
      .map((colorCount) => {
        const base = lookupScreenPrintBaseRate({ quantity, colorCount, cells });
        if (!base) return null;
        return {
          colorCount,
          bandQty: base.bandQty,
          baseRate: base.baseRate,
          label: `Шовкотрафарет за тиражем · ${colorCount} кол. · ${formatMoneyUah(base.baseRate)}/шт`,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
  }, [cells, quantity]);

  const [draftColorCount, setDraftColorCount] = useState(
    existing ? String(parsed?.colorCount ?? "") : "",
  );
  const [selected, setSelected] = useState<string[]>(parsed?.selectedCodes ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const next = existing ? parseScreenPrintLineName(existing.name) : null;
    if (existing && next) {
      setDraftColorCount(String(next.colorCount));
      setSelected(next.selectedCodes);
    } else if (!existing) {
      setDraftColorCount("");
      setSelected([]);
    }
    setError(null);
  }, [orderItemId, existing?.id, existing?.name]);

  const colorPicked = Boolean(draftColorCount);
  const activeColorCount = Number(draftColorCount) || 1;

  const preview = useMemo(
    () =>
      colorPicked
        ? resolveScreenPrintUnitRate({
            quantity,
            colorCount: activeColorCount,
            cells,
            coefficients,
            selectedCodes: selected,
          })
        : null,
    [colorPicked, quantity, activeColorCount, cells, coefficients, selected],
  );

  const savedCodes = parsed?.selectedCodes ?? [];
  const savedColor = parsed?.colorCount ?? null;
  const isDirty =
    Boolean(existing) &&
    colorPicked &&
    (savedColor !== activeColorCount ||
      savedCodes.length !== selected.length ||
      savedCodes.some((code) => !selected.includes(code)));

  function persist(next: {
    enabled: boolean;
    colorCount: number;
    selectedCodes: string[];
  }) {
    setError(null);
    startTransition(async () => {
      const result = await syncOrderScreenPrintAction({
        orderId,
        orderItemId,
        enabled: next.enabled,
        colorCount: next.colorCount,
        selectedCodes: next.selectedCodes,
      });
      if (!result.ok) {
        setError(
          result.error === "NO_RATE"
            ? "Немає ставки для цього тиражу / кольорів у довіднику"
            : "Не вдалося зберегти нанесення",
        );
        const saved = existing ? parseScreenPrintLineName(existing.name) : null;
        setDraftColorCount(String(saved?.colorCount ?? ""));
        setSelected(saved?.selectedCodes ?? []);
        return;
      }
      router.refresh();
    });
  }

  function toggleCoef(code: string) {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function clearDraft() {
    setDraftColorCount("");
    setSelected([]);
    setError(null);
  }

  if (locked) {
    if (!existing) return null;
    return (
      <div className="border-t border-[var(--color-divider)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
        <p className="text-[12.5px] text-[var(--color-text-secondary)]">
          Шовкотрафарет зафіксовано в таблиці вище.
        </p>
      </div>
    );
  }

  if (colorOptions.length === 0) {
    return (
      <div className="border-t border-[var(--color-divider)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
        <p className="type-caption text-[var(--color-warning-text)]">
          Немає прайсу шовкотрафарету для тиражу {quantity} шт — перевірте довідник.
        </p>
      </div>
    );
  }

  return (
    <SoftBusy
      busy={pending}
      label={existing ? "Оновлюємо нанесення…" : "Додаємо нанесення…"}
    >
      <div className="space-y-2 border-t border-[var(--color-divider)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[220px] flex-1 space-y-0.5">
            <span className="type-caption">Шовкотрафарет за тиражем ({quantity} шт)</span>
            <Select
              size="sm"
              className="w-full"
              value={draftColorCount}
              disabled={pending}
              placeholder="+ шовкодрук…"
              onChange={(event) => {
                const next = event.target.value;
                setDraftColorCount(next);
                if (!next) setSelected([]);
                setError(null);
              }}
            >
              {!existing ? <option value="">+ шовкодрук за тиражем…</option> : null}
              {colorOptions.map((row) => (
                <option key={row.colorCount} value={String(row.colorCount)}>
                  {row.label}
                </option>
              ))}
            </Select>
          </label>

          {preview ? (
            <div className="ml-auto text-right">
              <p className="tabular text-[13px] font-semibold">
                {formatMoneyUah(preview.unitRate)}
                <span className="ml-1 type-caption font-normal">/шт</span>
              </p>
              <p className="type-caption">
                база {formatMoneyUah(preview.baseRate)}
                {preview.applied.length
                  ? ` · ${preview.applied.map((a) => `×${a.factor}`).join(" ")}`
                  : ""}
              </p>
            </div>
          ) : null}
        </div>

        {colorPicked ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {coefficients.map((coef) => (
                <label
                  key={coef.code}
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--color-border)] bg-white px-2 py-1.5 text-[12px]"
                  title={coef.noteUk ?? undefined}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(coef.code)}
                    disabled={pending}
                    onChange={() => toggleCoef(coef.code)}
                  />
                  <span>
                    {coef.nameUk} ×{coef.factor}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!existing ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    loading={pending}
                    disabled={pending || !preview}
                    onClick={() =>
                      persist({
                        enabled: true,
                        colorCount: activeColorCount,
                        selectedCodes: selected,
                      })
                    }
                    className="inline-flex items-center gap-1"
                  >
                    <IconPlus size={14} />
                    Додати
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={clearDraft}
                  >
                    Скинути
                  </Button>
                  <p className="type-caption text-[var(--color-text-quiet)]">
                    Галочки лише для чернетки. «Додати» записує рядок у розрахунок.
                  </p>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    loading={pending}
                    disabled={pending || !preview || !isDirty}
                    onClick={() =>
                      persist({
                        enabled: true,
                        colorCount: activeColorCount,
                        selectedCodes: selected,
                      })
                    }
                  >
                    Оновити рядок
                  </Button>
                  <p className="type-caption text-[var(--color-text-quiet)]">
                    {isDirty
                      ? "Є зміни — натисніть «Оновити рядок»."
                      : "Рядок уже в таблиці. Прибрати — кошиком."}
                  </p>
                </>
              )}
            </div>
          </>
        ) : (
          <p className="type-caption text-[var(--color-text-quiet)]">
            Спочатку оберіть шовкодрук — зʼявляться коефіцієнти, потім «Додати».
          </p>
        )}

        {error ? <p className="type-caption text-[var(--color-danger-text)]">{error}</p> : null}
      </div>
    </SoftBusy>
  );
}
