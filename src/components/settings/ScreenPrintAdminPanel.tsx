"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { SoftBusy } from "@/components/ui/SoftBusy";
import { IconPlus, IconTrash } from "@/components/ui/Icons";
import {
  Table,
  TableCard,
  TableEmpty,
  TableToolbar,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/Table";
import { saveScreenPrintCatalogAction } from "@/server/domains/screen-print/actions";
import type {
  ScreenPrintCoefficient,
  ScreenPrintPriceCell,
} from "@/lib/screen-print-pricing";
import { cn } from "@/lib/utils";

/** Soft field — light border, no heavy box. */
const field =
  "h-8 w-full min-w-0 rounded-[6px] border border-transparent bg-transparent px-1.5 text-[13px] text-[var(--color-text-primary)] outline-none transition-[border-color,background-color] placeholder:text-[var(--color-text-quiet)] hover:border-[var(--color-border)] focus:border-[var(--color-primary-400)] focus:bg-[color-mix(in_srgb,var(--color-primary-50)_40%,transparent)] disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const draftField =
  "h-8 w-full min-w-0 rounded-[6px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 text-[13px] outline-none placeholder:text-[var(--color-text-quiet)] focus:border-[var(--color-primary-400)] focus:border-solid [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

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

function sortCells(rows: ScreenPrintPriceCell[]) {
  return [...rows].sort(
    (a, b) => a.minQuantity - b.minQuantity || a.colorCount - b.colorCount,
  );
}

type CoefRow = ScreenPrintCoefficient & { key: string };

/**
 * Row-first screen-print catalog: empty draft line → fill → add; soft fields like fixed costs.
 */
export function ScreenPrintAdminPanel({
  cells: initialCells,
  coefficients: initialCoefficients,
}: {
  cells: ScreenPrintPriceCell[];
  coefficients: ScreenPrintCoefficient[];
}) {
  const router = useRouter();
  const [cells, setCells] = useState(() => sortCells(initialCells));
  const [coefficients, setCoefficients] = useState<CoefRow[]>(() =>
    initialCoefficients.map((row, i) => ({ ...row, key: row.code || `c-${i}` })),
  );

  const [draftQty, setDraftQty] = useState("");
  const [draftColors, setDraftColors] = useState("");
  const [draftRate, setDraftRate] = useState("");

  const [draftCoefName, setDraftCoefName] = useState("");
  const [draftCoefNote, setDraftCoefNote] = useState("");
  const [draftCoefFactor, setDraftCoefFactor] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setCells(sortCells(initialCells));
    setCoefficients(
      initialCoefficients.map((row, i) => ({ ...row, key: row.code || `c-${i}` })),
    );
  }, [initialCells, initialCoefficients]);

  const dirty = useMemo(() => {
    const cellKey = (rows: ScreenPrintPriceCell[]) =>
      JSON.stringify(sortCells(rows));
    const coefKey = (rows: ScreenPrintCoefficient[]) =>
      JSON.stringify(
        rows.map((r) => ({
          code: r.code,
          nameUk: r.nameUk,
          factor: r.factor,
          noteUk: r.noteUk ?? "",
        })),
      );
    return (
      cellKey(cells) !== cellKey(initialCells) ||
      coefKey(coefficients) !== coefKey(initialCoefficients)
    );
  }, [cells, coefficients, initialCells, initialCoefficients]);

  function persist(nextCells: ScreenPrintPriceCell[], nextCoefs: CoefRow[]) {
    setMessage(null);
    setError(null);
    for (const row of nextCoefs) {
      if (!row.nameUk.trim()) {
        setError("У кожного коефіцієнта має бути назва");
        return;
      }
      if (!(Number(row.factor) > 0)) {
        setError("Коефіцієнт × має бути більше 0");
        return;
      }
    }
    const used = new Set<string>();
    const coefPayload = nextCoefs.map((row) => {
      const code = row.code.trim() || slugCode(row.nameUk, used);
      used.add(code);
      return {
        code,
        nameUk: row.nameUk.trim(),
        factor: Number(row.factor),
        noteUk: row.noteUk?.trim() || null,
      };
    });

    const formData = new FormData();
    formData.set("gridJson", JSON.stringify(sortCells(nextCells)));
    formData.set("coefficientsJson", JSON.stringify(coefPayload));
    startTransition(async () => {
      const result = await saveScreenPrintCatalogAction(formData);
      if (!result.ok) {
        setError("Не вдалося зберегти. Перевірте числа.");
        return;
      }
      setMessage("Збережено");
      router.refresh();
    });
  }

  function addPriceRow() {
    const minQuantity = Math.floor(Number(draftQty));
    const colorCount = Math.floor(Number(draftColors));
    const unitRate = Number(String(draftRate).replace(",", "."));
    if (!Number.isFinite(minQuantity) || minQuantity <= 0) {
      setError("Вкажіть тираж від (шт)");
      return;
    }
    if (!Number.isFinite(colorCount) || colorCount <= 0 || colorCount > 24) {
      setError("Кількість кольорів: 1–24");
      return;
    }
    if (!Number.isFinite(unitRate) || unitRate < 0) {
      setError("Вкажіть ціну ₴/шт");
      return;
    }
    if (cells.some((c) => c.minQuantity === minQuantity && c.colorCount === colorCount)) {
      setError(`Уже є рядок: від ${minQuantity} шт · ${colorCount} кол.`);
      return;
    }
    setError(null);
    const next = sortCells([...cells, { minQuantity, colorCount, unitRate }]);
    setCells(next);
    setDraftQty("");
    setDraftColors("");
    setDraftRate("");
    persist(next, coefficients);
  }

  function updatePriceRow(index: number, patch: Partial<ScreenPrintPriceCell>) {
    setCells((prev) => {
      const next = prev.map((row, i) => (i === index ? { ...row, ...patch } : row));
      return sortCells(next);
    });
  }

  function removePriceRow(index: number) {
    const next = cells.filter((_, i) => i !== index);
    setCells(next);
    persist(next, coefficients);
  }

  function addCoefRow() {
    const nameUk = draftCoefName.trim();
    const factor = Number(String(draftCoefFactor).replace(",", ".")) || 0;
    if (!nameUk) {
      setError("Вкажіть назву коефіцієнта");
      return;
    }
    if (!(factor > 0)) {
      setError("Множник × має бути більше 0");
      return;
    }
    setError(null);
    const used = new Set(coefficients.map((c) => c.code));
    const code = slugCode(nameUk, used);
    const next: CoefRow[] = [
      ...coefficients,
      { key: code, code, nameUk, factor, noteUk: draftCoefNote.trim() || "" },
    ];
    setCoefficients(next);
    setDraftCoefName("");
    setDraftCoefNote("");
    setDraftCoefFactor("");
    persist(cells, next);
  }

  function removeCoefRow(key: string) {
    const next = coefficients.filter((c) => c.key !== key);
    setCoefficients(next);
    persist(cells, next);
  }

  return (
    <SoftBusy busy={pending} label="Збереження…">
      <div className="space-y-4">
        <TableCard>
          <TableToolbar
            left={
              <div className="min-w-0">
                <p className="type-subsection">Прайс ₴/шт · база ≤ А4</p>
                <p className="type-caption mt-0.5">
                  Один рядок — тираж × кольори × ціна. Додайте порожній рядок знизу.
                </p>
              </div>
            }
            right={
              dirty ? (
                <Button
                  type="button"
                  size="sm"
                  loading={pending}
                  onClick={() => persist(cells, coefficients)}
                >
                  Зберегти зміни
                </Button>
              ) : (
                <span className="type-caption">Усе збережено</span>
              )
            }
          />
          <Table>
            <THead>
              <TH width="120px">Тираж від, шт</TH>
              <TH width="100px">Кольорів</TH>
              <TH width="120px" align="right">
                ₴ / шт
              </TH>
              <TH width="44px" />
            </THead>
            <TBody>
              {cells.length === 0 ? (
                <TableEmpty
                  colSpan={4}
                  title="Порожньо"
                  description="Заповніть рядок знизу й натисніть «Додати»."
                />
              ) : (
                cells.map((row, index) => (
                  <TR key={`${row.minQuantity}-${row.colorCount}-${index}`}>
                    <TD className="py-1">
                      <input
                        type="number"
                        min={1}
                        disabled={pending}
                        className={cn(field, "tabular")}
                        value={row.minQuantity}
                        aria-label="Тираж від"
                        onChange={(event) =>
                          updatePriceRow(index, {
                            minQuantity: Math.max(1, Math.floor(Number(event.target.value)) || 1),
                          })
                        }
                      />
                    </TD>
                    <TD className="py-1">
                      <input
                        type="number"
                        min={1}
                        max={24}
                        disabled={pending}
                        className={cn(field, "tabular")}
                        value={row.colorCount}
                        aria-label="Кількість кольорів"
                        onChange={(event) =>
                          updatePriceRow(index, {
                            colorCount: Math.max(
                              1,
                              Math.min(24, Math.floor(Number(event.target.value)) || 1),
                            ),
                          })
                        }
                      />
                    </TD>
                    <TD className="py-1" numeric>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={pending}
                        className={cn(field, "text-right tabular")}
                        value={row.unitRate}
                        aria-label="Ціна за шт"
                        onChange={(event) =>
                          updatePriceRow(index, {
                            unitRate: Math.max(0, Number(event.target.value) || 0),
                          })
                        }
                      />
                    </TD>
                    <TD className="py-1" align="center">
                      <button
                        type="button"
                        disabled={pending}
                        aria-label="Прибрати рядок"
                        onClick={() => removePriceRow(index)}
                        className="rounded p-1 text-[var(--color-text-quiet)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] disabled:opacity-40"
                      >
                        <IconTrash size={14} />
                      </button>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>

          <form
            className="grid grid-cols-[120px_100px_120px_auto] items-center gap-2 border-t border-[var(--color-divider)] px-3 py-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              addPriceRow();
            }}
          >
            <input
              type="number"
              min={1}
              disabled={pending}
              className={cn(draftField, "tabular")}
              value={draftQty}
              onChange={(event) => setDraftQty(event.target.value)}
              placeholder="напр. 50"
              aria-label="Новий тираж від"
            />
            <input
              type="number"
              min={1}
              max={24}
              disabled={pending}
              className={cn(draftField, "tabular")}
              value={draftColors}
              onChange={(event) => setDraftColors(event.target.value)}
              placeholder="кол."
              aria-label="Нова кількість кольорів"
            />
            <input
              type="number"
              min={0}
              step="0.01"
              disabled={pending}
              className={cn(draftField, "text-right tabular")}
              value={draftRate}
              onChange={(event) => setDraftRate(event.target.value)}
              placeholder="₴"
              aria-label="Нова ціна"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              <IconPlus size={14} />
              Додати
            </Button>
          </form>
        </TableCard>

        <TableCard>
          <TableToolbar
            left={
              <div className="min-w-0">
                <p className="type-subsection">Коефіцієнти</p>
                <p className="type-caption mt-0.5">
                  Галочки в замовленні. Новий рядок знизу — заповніть і додайте.
                </p>
              </div>
            }
          />
          <Table>
            <THead>
              <TH>Назва</TH>
              <TH>Примітка</TH>
              <TH width="88px" align="right">
                ×
              </TH>
              <TH width="44px" />
            </THead>
            <TBody>
              {coefficients.length === 0 ? (
                <TableEmpty
                  colSpan={4}
                  title="Без коефіцієнтів"
                  description="Додайте умову в рядку знизу, якщо потрібні множники."
                />
              ) : (
                coefficients.map((row, index) => (
                  <TR key={row.key}>
                    <TD className="py-1">
                      <input
                        disabled={pending}
                        className={field}
                        value={row.nameUk}
                        aria-label="Назва коефіцієнта"
                        onChange={(event) => {
                          const nameUk = event.target.value;
                          setCoefficients((prev) =>
                            prev.map((c, i) => (i === index ? { ...c, nameUk } : c)),
                          );
                        }}
                      />
                    </TD>
                    <TD className="py-1">
                      <input
                        disabled={pending}
                        className={field}
                        value={row.noteUk ?? ""}
                        placeholder="—"
                        aria-label="Примітка"
                        onChange={(event) => {
                          const noteUk = event.target.value;
                          setCoefficients((prev) =>
                            prev.map((c, i) => (i === index ? { ...c, noteUk } : c)),
                          );
                        }}
                      />
                    </TD>
                    <TD className="py-1" numeric>
                      <input
                        type="number"
                        min={0.01}
                        step="0.01"
                        disabled={pending}
                        className={cn(field, "text-right tabular")}
                        value={row.factor}
                        aria-label="Множник"
                        onChange={(event) => {
                          const factor = Number(event.target.value) || 1;
                          setCoefficients((prev) =>
                            prev.map((c, i) => (i === index ? { ...c, factor } : c)),
                          );
                        }}
                      />
                    </TD>
                    <TD className="py-1" align="center">
                      <button
                        type="button"
                        disabled={pending}
                        aria-label={`Прибрати ${row.nameUk || "коефіцієнт"}`}
                        onClick={() => removeCoefRow(row.key)}
                        className="rounded p-1 text-[var(--color-text-quiet)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] disabled:opacity-40"
                      >
                        <IconTrash size={14} />
                      </button>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>

          <form
            className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_88px_auto] items-center gap-2 border-t border-[var(--color-divider)] px-3 py-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              addCoefRow();
            }}
          >
            <input
              disabled={pending}
              className={draftField}
              value={draftCoefName}
              onChange={(event) => setDraftCoefName(event.target.value)}
              placeholder="Назва умови"
              aria-label="Нова назва коефіцієнта"
            />
            <input
              disabled={pending}
              className={draftField}
              value={draftCoefNote}
              onChange={(event) => setDraftCoefNote(event.target.value)}
              placeholder="Примітка (необовʼязково)"
              aria-label="Примітка нового коефіцієнта"
            />
            <input
              type="number"
              min={0.01}
              step="0.01"
              disabled={pending}
              className={cn(draftField, "text-right tabular")}
              value={draftCoefFactor}
              onChange={(event) => setDraftCoefFactor(event.target.value)}
              placeholder="1.5"
              aria-label="Множник нового коефіцієнта"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              <IconPlus size={14} />
              Додати
            </Button>
          </form>
        </TableCard>

        {error ? <Banner tone="danger">{error}</Banner> : null}
        {message && !error ? <Banner tone="info">{message}</Banner> : null}
      </div>
    </SoftBusy>
  );
}
