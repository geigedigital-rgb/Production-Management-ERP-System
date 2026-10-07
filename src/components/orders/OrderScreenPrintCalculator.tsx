"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { IconPlus } from "@/components/ui/Icons";
import { syncOrderScreenPrintAction } from "@/server/domains/screen-print/actions";
import {
  isScreenPrintDecorationName,
  lookupScreenPrintBaseRate,
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
 * Draft silk-screen print → always inserts a new decoration row.
 * Multiple prints per order item (different colors / приладки) are allowed.
 */
export function OrderScreenPrintCalculator({
  orderId,
  orderItemId,
  quantity,
  cells,
  coefficients,
  existingDecorations = [],
  locked,
  hideCosts = false,
}: {
  orderId: string;
  orderItemId: string;
  quantity: number;
  cells: ScreenPrintPriceCell[];
  coefficients: ScreenPrintCoefficient[];
  existingDecorations?: ExistingDecoration[];
  locked?: boolean;
  hideCosts?: boolean;
}) {
  const router = useRouter();
  const screenPrintCount = useMemo(
    () => existingDecorations.filter((row) => isScreenPrintDecorationName(row.name)).length,
    [existingDecorations],
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
          label: hideCosts
            ? `Шовкотрафарет · ${colorCount} кол.`
            : `Шовкотрафарет за тиражем · ${colorCount} кол. · ${formatMoneyUah(base.baseRate)}/шт`,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
  }, [cells, quantity, hideCosts]);

  const [draftColorCount, setDraftColorCount] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  function clearDraft() {
    setDraftColorCount("");
    setSelected([]);
    setError(null);
  }

  function persist() {
    if (!preview) return;
    setError(null);
    startTransition(async () => {
      const result = await syncOrderScreenPrintAction({
        orderId,
        orderItemId,
        enabled: true,
        colorCount: activeColorCount,
        selectedCodes: selected,
      });
      if (!result.ok) {
        setError(
          result.error === "NO_RATE"
            ? "Немає ставки для цього тиражу / кольорів у довіднику"
            : "Не вдалося зберегти нанесення",
        );
        return;
      }
      clearDraft();
      router.refresh();
    });
  }

  function toggleCoef(code: string) {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  if (locked) {
    if (screenPrintCount === 0) return null;
    return (
      <div className="border-t border-[var(--color-divider)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
        <p className="text-[12.5px] text-[var(--color-text-secondary)]">
          Шовкотрафарет зафіксовано в таблиці вище
          {screenPrintCount > 1 ? ` (${screenPrintCount} рядки)` : ""}.
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
    <SoftBusy busy={pending} label="Додаємо нанесення…">
      <div className="space-y-2 border-t border-[var(--color-divider)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[220px] flex-1 space-y-0.5">
            <span className="type-caption">
              + Шовкотрафарет за тиражем ({quantity} шт)
              {screenPrintCount > 0 ? ` · уже ${screenPrintCount}` : ""}
            </span>
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
              <option value="">+ шовкодрук за тиражем…</option>
              {colorOptions.map((row) => (
                <option key={row.colorCount} value={String(row.colorCount)}>
                  {row.label}
                </option>
              ))}
            </Select>
          </label>

          {preview && !hideCosts ? (
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
              <Button
                type="button"
                size="sm"
                loading={pending}
                disabled={pending || !preview}
                onClick={persist}
                className="inline-flex items-center gap-1"
              >
                <IconPlus size={14} />
                Додати рядок
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
                Кожне «Додати» — новий рядок у таблиці. Приладку можна задати в рядку окремо.
              </p>
            </div>
          </>
        ) : null}

        {error ? <p className="type-caption text-[var(--color-danger-text)]">{error}</p> : null}
      </div>
    </SoftBusy>
  );
}
