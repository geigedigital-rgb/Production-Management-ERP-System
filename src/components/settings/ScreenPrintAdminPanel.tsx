"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { SoftBusy } from "@/components/ui/SoftBusy";
import { IconPlus, IconTrash } from "@/components/ui/Icons";
import { saveScreenPrintCatalogAction } from "@/server/domains/screen-print/actions";
import {
  uniqueColorCounts,
  uniqueQtyBands,
  type ScreenPrintCoefficient,
  type ScreenPrintPriceCell,
} from "@/lib/screen-print-pricing";
import { cn } from "@/lib/utils";

const cellInput =
  "h-7 w-full min-w-[3.25rem] rounded-[5px] border border-[var(--color-border)] bg-white px-1 text-right text-[12.5px] tabular outline-none focus:border-[var(--color-primary-500)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const compactInput =
  "h-8 w-full rounded-[6px] border border-[var(--color-border)] bg-white px-2 text-[12.5px] outline-none focus:border-[var(--color-primary-500)] placeholder:text-[var(--color-text-quiet)]";

function slugCode(nameUk: string, used: Set<string>): string {
  const base =
    nameUk
      .trim()
      .toUpperCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || "COEF";
  let code = base;
  let n = 2;
  while (used.has(code)) {
    code = `${base}_${n}`;
    n += 1;
  }
  return code;
}

/**
 * Compact screen-print catalog editor: tirage × colors grid + coefficient rows.
 */
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
  const [draftBand, setDraftBand] = useState("");
  const [draftColor, setDraftColor] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  function addBand() {
    const qty = Math.floor(Number(draftBand));
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Вкажіть тираж від (шт) більше 0");
      return;
    }
    if (bands.includes(qty)) {
      setError(`Тираж від ${qty} уже є`);
      return;
    }
    setError(null);
    const colorList = colors.length > 0 ? colors : [1];
    setCells((prev) => {
      const next = [...prev];
      for (const color of colorList) {
        if (!next.some((c) => c.minQuantity === qty && c.colorCount === color)) {
          next.push({ minQuantity: qty, colorCount: color, unitRate: 0 });
        }
      }
      return next.sort(
        (a, b) => a.minQuantity - b.minQuantity || a.colorCount - b.colorCount,
      );
    });
    setDraftBand("");
  }

  function removeBand(qty: number) {
    setCells((prev) => prev.filter((c) => c.minQuantity !== qty));
  }

  function addColorColumn() {
    const color = Math.floor(Number(draftColor));
    if (!Number.isFinite(color) || color <= 0 || color > 24) {
      setError("Кількість кольорів: 1–24");
      return;
    }
    if (colors.includes(color)) {
      setError(`${color} кол. уже є`);
      return;
    }
    setError(null);
    const bandList = bands.length > 0 ? bands : [50];
    setCells((prev) => {
      const next = [...prev];
      for (const qty of bandList) {
        if (!next.some((c) => c.minQuantity === qty && c.colorCount === color)) {
          next.push({ minQuantity: qty, colorCount: color, unitRate: 0 });
        }
      }
      return next.sort(
        (a, b) => a.minQuantity - b.minQuantity || a.colorCount - b.colorCount,
      );
    });
    setDraftColor("");
  }

  function removeColorColumn(color: number) {
    setCells((prev) => prev.filter((c) => c.colorCount !== color));
  }

  function addCoefficient() {
    const used = new Set(coefficients.map((c) => c.code));
    const code = slugCode("Новий коефіцієнт", used);
    setCoefficients((prev) => [
      ...prev,
      { code, nameUk: "", factor: 1.1, noteUk: "" },
    ]);
  }

  function removeCoefficient(code: string) {
    setCoefficients((prev) => prev.filter((c) => c.code !== code));
  }

  function save() {
    setMessage(null);
    setError(null);
    if (bands.length === 0 || colors.length === 0) {
      setError("Додайте хоча б один тираж і один стовпчик кольорів");
      return;
    }
    for (const row of coefficients) {
      if (!row.nameUk.trim()) {
        setError("У кожного коефіцієнта має бути назва");
        return;
      }
      if (!(Number(row.factor) > 0)) {
        setError("Коефіцієнт × має бути більше 0");
        return;
      }
    }
    const formData = new FormData();
    formData.set("gridJson", JSON.stringify(cells));
    formData.set(
      "coefficientsJson",
      JSON.stringify(
        coefficients.map((row) => ({
          ...row,
          code: row.code.trim() || slugCode(row.nameUk, new Set()),
        })),
      ),
    );
    startTransition(async () => {
      const result = await saveScreenPrintCatalogAction(formData);
      if (!result.ok) {
        setError("Не вдалося зберегти. Перевірте числа.");
        return;
      }
      setMessage("Довідник збережено");
      router.refresh();
    });
  }

  return (
    <SoftBusy busy={pending} label="Збереження…">
      <div className="space-y-3">
        {/* Price grid */}
        <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--color-divider)] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                Прайс ₴/шт · база ≤ А4
              </p>
              <p className="type-caption mt-0.5">
                Рядок = тираж від N шт · стовпчик = кількість кольорів
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="number"
                min={1}
                placeholder="Тираж"
                value={draftBand}
                onChange={(event) => setDraftBand(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addBand();
                  }
                }}
                className={cn(compactInput, "w-[5.5rem]")}
                aria-label="Новий тираж від"
              />
              <Button type="button" size="sm" variant="secondary" onClick={addBand}>
                <IconPlus size={14} />
                Тираж
              </Button>
              <input
                type="number"
                min={1}
                max={24}
                placeholder="Кол."
                value={draftColor}
                onChange={(event) => setDraftColor(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addColorColumn();
                  }
                }}
                className={cn(compactInput, "w-[4.5rem]")}
                aria-label="Нова кількість кольорів"
              />
              <Button type="button" size="sm" variant="secondary" onClick={addColorColumn}>
                <IconPlus size={14} />
                Кольори
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto px-2 py-2">
            {bands.length === 0 || colors.length === 0 ? (
              <p className="px-2 py-6 text-center type-caption text-[var(--color-text-quiet)]">
                Додайте тираж і кількість кольорів — зʼявиться сітка цін.
              </p>
            ) : (
              <table className="w-auto min-w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-[var(--color-divider)]">
                    <th className="sticky left-0 bg-[var(--color-surface)] px-2 py-1.5 text-left type-caption">
                      Від, шт
                    </th>
                    {colors.map((c) => (
                      <th key={c} className="px-1 py-1.5 text-center">
                        <div className="inline-flex items-center justify-center gap-0.5">
                          <span className="type-caption whitespace-nowrap">{c} кол.</span>
                          <button
                            type="button"
                            title={`Прибрати ${c} кол.`}
                            aria-label={`Прибрати стовпчик ${c} кол.`}
                            onClick={() => removeColorColumn(c)}
                            className="rounded p-0.5 text-[var(--color-text-quiet)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                          >
                            <IconTrash size={12} />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="w-8 px-1" />
                  </tr>
                </thead>
                <tbody>
                  {bands.map((qty) => (
                    <tr
                      key={qty}
                      className="border-b border-[var(--color-divider)] last:border-0"
                    >
                      <td className="sticky left-0 bg-[var(--color-surface)] px-2 py-1 tabular font-medium">
                        {qty}
                      </td>
                      {colors.map((color) => (
                        <td key={`${qty}-${color}`} className="px-1 py-1">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={rateAt(qty, color)}
                            onChange={(event) =>
                              setRate(qty, color, Number(event.target.value) || 0)
                            }
                            className={cellInput}
                            aria-label={`₴/шт від ${qty}, ${color} кол.`}
                          />
                        </td>
                      ))}
                      <td className="px-1 py-1 text-center">
                        <button
                          type="button"
                          title={`Прибрати тираж від ${qty}`}
                          aria-label={`Прибрати тираж від ${qty}`}
                          onClick={() => removeBand(qty)}
                          className="rounded p-1 text-[var(--color-text-quiet)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                        >
                          <IconTrash size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Coefficients */}
        <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--color-divider)] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                Коефіцієнти (галочки в замовленні)
              </p>
              <p className="type-caption mt-0.5">
                Множаться на базовий прайс. Можна додавати й прибирати умови.
              </p>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={addCoefficient}>
              <IconPlus size={14} />
              Коефіцієнт
            </Button>
          </div>

          <div className="px-2 py-2">
            {coefficients.length === 0 ? (
              <p className="px-2 py-5 text-center type-caption text-[var(--color-text-quiet)]">
                Немає коефіцієнтів — додайте, якщо потрібні умови (площа, тканина тощо).
              </p>
            ) : (
              <ul className="space-y-1.5">
                <li className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_4.5rem_2rem] gap-1.5 px-1 type-caption sm:grid">
                  <span>Назва</span>
                  <span>Примітка</span>
                  <span className="text-right">×</span>
                  <span />
                </li>
                {coefficients.map((row, index) => (
                  <li
                    key={row.code}
                    className="grid grid-cols-1 gap-1.5 rounded-[8px] bg-[var(--color-surface-subtle)]/60 px-1.5 py-1.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_4.5rem_2rem] sm:items-center"
                  >
                    <input
                      value={row.nameUk}
                      placeholder="Назва умови"
                      aria-label="Назва коефіцієнта"
                      className={compactInput}
                      onChange={(event) => {
                        const nameUk = event.target.value;
                        setCoefficients((prev) =>
                          prev.map((c, i) => (i === index ? { ...c, nameUk } : c)),
                        );
                      }}
                    />
                    <input
                      value={row.noteUk ?? ""}
                      placeholder="Підказка (необовʼязково)"
                      aria-label="Примітка"
                      className={compactInput}
                      onChange={(event) => {
                        const noteUk = event.target.value;
                        setCoefficients((prev) =>
                          prev.map((c, i) => (i === index ? { ...c, noteUk } : c)),
                        );
                      }}
                    />
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={row.factor}
                      aria-label="Множник"
                      className={cn(compactInput, "text-right tabular")}
                      onChange={(event) => {
                        const factor = Number(event.target.value) || 1;
                        setCoefficients((prev) =>
                          prev.map((c, i) => (i === index ? { ...c, factor } : c)),
                        );
                      }}
                    />
                    <button
                      type="button"
                      title="Прибрати коефіцієнт"
                      aria-label={`Прибрати ${row.nameUk || row.code}`}
                      onClick={() => removeCoefficient(row.code)}
                      className="justify-self-center rounded p-1 text-[var(--color-text-quiet)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                    >
                      <IconTrash size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {error ? <Banner tone="danger">{error}</Banner> : null}
        {message ? <Banner tone="info">{message}</Banner> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={save} loading={pending}>
            Зберегти довідник
          </Button>
          <span className="type-caption text-[var(--color-text-quiet)]">
            Зміни діють для нових розрахунків у замовленнях
          </span>
        </div>
      </div>
    </SoftBusy>
  );
}
