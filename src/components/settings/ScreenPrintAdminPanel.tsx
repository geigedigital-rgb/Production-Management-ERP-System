"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Banner } from "@/components/ui/Banner";
import { saveScreenPrintCatalogAction } from "@/server/domains/screen-print/actions";
import {
  uniqueColorCounts,
  uniqueQtyBands,
  type ScreenPrintCoefficient,
  type ScreenPrintPriceCell,
} from "@/lib/screen-print-pricing";
import { cn } from "@/lib/utils";

export function ScreenPrintAdminPanel({
  cells: initialCells,
  coefficients: initialCoefficients,
}: {
  cells: ScreenPrintPriceCell[];
  coefficients: ScreenPrintCoefficient[];
}) {
  const router = useRouter();
  const [cells, setCells] = useState(initialCells);
  const [coefficients, setCoefficients] = useState(initialCoefficients);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const bands = useMemo(() => uniqueQtyBands(cells), [cells]);
  const colors = useMemo(() => uniqueColorCounts(cells), [cells]);

  function rateAt(qty: number, color: number): number {
    return cells.find((c) => c.minQuantity === qty && c.colorCount === color)?.unitRate ?? 0;
  }

  function setRate(qty: number, color: number, unitRate: number) {
    setCells((prev) => {
      const next = prev.filter((c) => !(c.minQuantity === qty && c.colorCount === color));
      next.push({ minQuantity: qty, colorCount: color, unitRate: Math.max(0, unitRate) });
      return next.sort(
        (a, b) => a.minQuantity - b.minQuantity || a.colorCount - b.colorCount,
      );
    });
  }

  function save() {
    setMessage(null);
    const formData = new FormData();
    formData.set("gridJson", JSON.stringify(cells));
    formData.set("coefficientsJson", JSON.stringify(coefficients));
    startTransition(async () => {
      const result = await saveScreenPrintCatalogAction(formData);
      if (!result.ok) {
        setMessage("Не вдалося зберегти. Перевірте числа.");
        return;
      }
      setMessage("Прайс шовкотрафарету збережено");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <p className="type-label">Прайс ₴/шт (база ≤ А4)</p>
        <p className="type-caption mt-1">
          Стандартна ціна для друку від невеликого розміру до формату А4. Тираж × кількість кольорів.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-auto border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-divider)]">
                <th className="px-2 py-1.5 text-left type-caption">Тираж від</th>
                {colors.map((c) => (
                  <th key={c} className="px-2 py-1.5 text-right type-caption">
                    {c} кол.
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bands.map((qty) => (
                <tr key={qty} className="border-b border-[var(--color-divider)] last:border-0">
                  <td className="px-2 py-1 tabular font-medium">{qty}</td>
                  {colors.map((color) => (
                    <td key={`${qty}-${color}`} className="px-1 py-1">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={rateAt(qty, color)}
                        onChange={(event) => setRate(qty, color, Number(event.target.value) || 0)}
                        className={cn(
                          "h-8 w-[4.5rem] rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 text-right tabular",
                          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <p className="type-label">Коефіцієнти</p>
        <p className="type-caption mt-1">
          Множаться на базовий прайс. Умови — у примітці (напр. площа &gt; А4 до 38×38 → ×1,7).
        </p>
        <ul className="mt-3 space-y-3">
          {coefficients.map((row, index) => (
            <li
              key={row.code}
              className="grid gap-2 rounded-[10px] border border-[var(--color-divider)] p-3 sm:grid-cols-[1fr_5rem]"
            >
              <div className="space-y-1">
                <Input
                  label="Назва"
                  value={row.nameUk}
                  onChange={(event) => {
                    const nameUk = event.target.value;
                    setCoefficients((prev) =>
                      prev.map((c, i) => (i === index ? { ...c, nameUk } : c)),
                    );
                  }}
                />
                <Input
                  label="Примітка"
                  value={row.noteUk ?? ""}
                  onChange={(event) => {
                    const noteUk = event.target.value;
                    setCoefficients((prev) =>
                      prev.map((c, i) => (i === index ? { ...c, noteUk } : c)),
                    );
                  }}
                />
              </div>
              <label className="block space-y-1">
                <span className="type-caption">×</span>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={row.factor}
                  onChange={(event) => {
                    const factor = Number(event.target.value) || 1;
                    setCoefficients((prev) =>
                      prev.map((c, i) => (i === index ? { ...c, factor } : c)),
                    );
                  }}
                  className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-2 text-right tabular"
                />
              </label>
            </li>
          ))}
        </ul>
      </div>

      {message ? <Banner tone="info">{message}</Banner> : null}
      <Button type="button" onClick={save} loading={pending}>
        Зберегти довідник
      </Button>
    </div>
  );
}
