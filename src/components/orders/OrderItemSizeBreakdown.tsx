"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { SizeRun, type SizeRunItem } from "@/components/orders/SizeRun";
import { applyOrderItemSizeBreakdownAction } from "@/server/domains/orders/actions";
import { cn } from "@/lib/utils";
import { realSizesQuantitySum } from "@/lib/order-item-sizes";

export type SizeChartOption = {
  id: string;
  nameUk: string;
  sizes: Array<{ code: string; nameUk: string }>;
};

function mergeChartSizes(prev: SizeRunItem[], chart: SizeChartOption): SizeRunItem[] {
  const byCode = new Map(prev.map((size) => [size.code, size]));
  for (const size of chart.sizes) {
    if (!byCode.has(size.code)) {
      byCode.set(size.code, { code: size.code, nameUk: size.nameUk });
    }
  }
  return [...byCode.values()];
}

export function OrderItemSizeBreakdown({
  orderId,
  orderItemId,
  targetTirage,
  sizeCharts,
  disabled,
}: {
  orderId: string;
  orderItemId: string;
  targetTirage: number;
  sizeCharts: SizeChartOption[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chartId, setChartId] = useState(sizeCharts[0]?.id ?? "");
  const [grid, setGrid] = useState<SizeRunItem[]>(() =>
    sizeCharts[0] ? mergeChartSizes([], sizeCharts[0]) : [],
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const activeChart = sizeCharts.find((chart) => chart.id === chartId) ?? null;

  useEffect(() => {
    if (!chartId && sizeCharts[0]) {
      setChartId(sizeCharts[0].id);
    }
  }, [chartId, sizeCharts]);

  const brokenDown = useMemo(
    () =>
      realSizesQuantitySum(
        grid.map((size) => ({
          sizeCode: size.code,
          sizeNameUk: size.nameUk,
          quantity: quantities[size.code] ?? 0,
        })),
      ),
    [grid, quantities],
  );
  const matched = brokenDown === targetTirage && targetTirage > 0;

  function addChartSizes(chart: SizeChartOption | null) {
    if (!chart) return;
    setGrid((prev) => mergeChartSizes(prev, chart));
  }

  function applyBreakdown() {
    setError(null);
    if (!matched) {
      setError(`Сума по розмірах має дорівнювати ${targetTirage} шт.`);
      return;
    }
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("orderItemId", orderItemId);
    for (const size of grid) {
      const qty = quantities[size.code] ?? 0;
      if (qty <= 0) continue;
      formData.append("sizeCode", size.code);
      formData.append("sizeNameUk", size.nameUk);
      formData.append("sizeQty", String(qty));
    }
    startTransition(async () => {
      const result = await applyOrderItemSizeBreakdownAction(formData);
      if (!result.ok) {
        if (result.error === "SIZES_SUM_MISMATCH") {
          setError(`Сума по розмірах має дорівнювати ${targetTirage} шт.`);
        } else if (result.error === "SIZES_EMPTY") {
          setError("Вкажіть кількості хоча б по одному розміру.");
        } else {
          setError("Не вдалося застосувати розкладку.");
        }
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2.5 rounded-[var(--radius-control)] border border-[var(--color-warning-text)]/25 bg-[var(--color-warning-bg)]/50 px-3 py-2.5">
      <div>
        <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
          Задано загальний тираж {targetTirage} шт.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <Select
            label="Розмірна сітка"
            value={chartId}
            onChange={(event) => setChartId(event.target.value)}
            disabled={disabled || pending || sizeCharts.length === 0}
            options={sizeCharts.map((chart) => ({
              value: chart.id,
              label: chart.nameUk,
            }))}
          />
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || pending || !activeChart}
          onClick={() => addChartSizes(activeChart)}
        >
          Додати розміри сітки
        </Button>
      </div>

      {grid.length === 0 ? (
        <p className="type-caption">Оберіть сітку і натисніть «Додати розміри сітки».</p>
      ) : (
        <SizeRun
          sizes={grid}
          quantities={quantities}
          disabled={disabled || pending}
          quiet
          onChange={(code, quantity) =>
            setQuantities((prev) => ({ ...prev, [code]: quantity }))
          }
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={cn(
            "text-[12.5px] font-medium tabular",
            matched ? "text-[var(--color-success-text)]" : "text-[var(--color-text-secondary)]",
          )}
        >
          розкладено {brokenDown} / {targetTirage}
        </p>
        <Button
          size="sm"
          onClick={applyBreakdown}
          disabled={disabled || pending || !matched}
          loading={pending}
        >
          Застосувати розкладку
        </Button>
      </div>

      {error ? (
        <p className="text-[12.5px] text-[var(--color-danger-text)]">{error}</p>
      ) : null}
    </div>
  );
}
