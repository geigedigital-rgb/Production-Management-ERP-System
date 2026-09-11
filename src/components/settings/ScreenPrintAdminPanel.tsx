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
  TFoot,
  TH,
  THead,
  TR,
} from "@/components/ui/Table";
import { saveScreenPrintCatalogAction } from "@/server/domains/screen-print/actions";
import {
  uniqueColorCounts,
  uniqueQtyBands,
  type ScreenPrintCoefficient,
  type ScreenPrintPriceCell,
} from "@/lib/screen-print-pricing";
import { cn } from "@/lib/utils";

const softCell =
  "h-8 w-full min-w-[3.5rem] rounded-[6px] border border-transparent bg-transparent px-1.5 text-right text-[13px] tabular text-[var(--color-text-primary)] outline-none transition-[border-color,background-color] placeholder:text-[var(--color-text-quiet)] hover:border-[var(--color-border)] focus:border-[var(--color-primary-400)] focus:bg-[color-mix(in_srgb,var(--color-primary-50)_40%,transparent)] disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const draftCell =
  "h-8 w-full min-w-[3.5rem] rounded-[6px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 text-right text-[13px] tabular outline-none placeholder:text-[var(--color-text-quiet)] focus:border-solid focus:border-[var(--color-primary-400)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const softLine =
  "h-8 w-full min-w-0 rounded-[6px] border border-transparent bg-transparent px-1.5 text-[13px] outline-none transition-[border-color,background-color] placeholder:text-[var(--color-text-quiet)] hover:border-[var(--color-border)] focus:border-[var(--color-primary-400)] focus:bg-[color-mix(in_srgb,var(--color-primary-50)_40%,transparent)] disabled:opacity-60";

const draftLine =
  "h-8 w-full min-w-0 rounded-[6px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 text-[13px] outline-none placeholder:text-[var(--color-text-quiet)] focus:border-solid focus:border-[var(--color-primary-400)]";

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
 * Screen-print catalog: tirage × colors price matrix + coefficient rows.
 * New entries via empty draft rows at the bottom.
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

  /** Draft new tirage row: qty + rate per existing color column. */
  const [draftQty, setDraftQty] = useState("");
  const [draftRates, setDraftRates] = useState<Record<number, string>>({});
  /** Draft new color column. */
  const [draftColor, setDraftColor] = useState("");

  const [draftCoefName, setDraftCoefName] = useState("");
  const [draftCoefNote, setDraftCoefNote] = useState("");
  const [draftCoefFactor, setDraftCoefFactor] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const bands = useMemo(() => uniqueQtyBands(cells), [cells]);
  const colors = useMemo(() => uniqueColorCounts(cells), [cells]);

  useEffect(() => {
    setCells(sortCells(initialCells));
    setCoefficients(
      initialCoefficients.map((row, i) => ({ ...row, key: row.code || `c-${i}` })),
    );
  }, [initialCells, initialCoefficients]);

  const dirty = useMemo(() => {
    const cellKey = (rows: ScreenPrintPriceCell[]) => JSON.stringify(sortCells(rows));
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

  function rateAt(qty: number, color: number): number {
    return cells.find((c) => c.minQuantity === qty && c.colorCount === color)?.unitRate ?? 0;
  }

  function setRate(qty: number, color: number, unitRate: number) {
    setCells((prev) => {
      const next = prev.filter((c) => !(c.minQuantity === qty && c.colorCount === color));
      next.push({ minQuantity: qty, colorCount: color, unitRate: Math.max(0, unitRate) });
      return sortCells(next);
    });
  }

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

  function addTirageRow() {
    const qty = Math.floor(Number(draftQty));
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Вкажіть тираж від (шт)");
      return;
    }
    if (bands.includes(qty)) {
      setError(`Тираж від ${qty} уже є`);
      return;
    }
    const colorList = colors.length > 0 ? colors : [1];
    const additions: ScreenPrintPriceCell[] = [];
    for (const color of colorList) {
      const raw = draftRates[color] ?? "";
      const unitRate = Number(String(raw).replace(",", "."));
      if (!Number.isFinite(unitRate) || unitRate < 0) {
        setError(`Вкажіть ціну для ${color} кол.`);
        return;
      }
      additions.push({ minQuantity: qty, colorCount: color, unitRate });
    }

    setError(null);
    const next = sortCells([...cells, ...additions]);
    setCells(next);
    setDraftQty("");
    setDraftRates({});
    persist(next, coefficients);
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
    if (bands.length === 0) {
      setError("Спочатку додайте рядок тиражу");
      return;
    }
    setError(null);
    const next = sortCells([
      ...cells,
      ...bands.map((qty) => ({ minQuantity: qty, colorCount: color, unitRate: 0 })),
    ]);
    setCells(next);
    setDraftColor("");
    persist(next, coefficients);
  }

  function removeBand(qty: number) {
    const next = cells.filter((c) => c.minQuantity !== qty);
    setCells(next);
    persist(next, coefficients);
  }

  function removeColorColumn(color: number) {
    const next = cells.filter((c) => c.colorCount !== color);
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

  const displayColors = colors.length > 0 ? colors : [1];

  return (
    <SoftBusy busy={pending} label="Збереження…">
      <div className="space-y-4">
        <TableCard>
          <TableToolbar
            left={
              <div className="min-w-0">
                <p className="type-subsection">Прайс ₴/шт · база ≤ А4</p>
                <p className="type-caption mt-0.5">
                  Шапка — кольори · рядок — тираж · клітинка — ціна. Новий тираж — порожній рядок
                  знизу.
                </p>
              </div>
            }
            right={
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={24}
                  disabled={pending}
                  className={cn(draftLine, "w-[4.5rem] text-center tabular")}
                  value={draftColor}
                  onChange={(event) => setDraftColor(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addColorColumn();
                    }
                  }}
                  placeholder="кол."
                  aria-label="Нова кількість кольорів"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={addColorColumn}
                >
                  <IconPlus size={14} />
                  Кольори
                </Button>
                {dirty ? (
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
                )}
              </div>
            }
          />

          <div className="overflow-x-auto">
            <form
              id="sp-draft-tirage"
              className="hidden"
              onSubmit={(event) => {
                event.preventDefault();
                addTirageRow();
              }}
            />
            <Table>
              <THead>
                <TH width="110px">Тираж від</TH>
                {displayColors.map((c) => (
                  <TH key={c} align="right" width="96px">
                    <span className="inline-flex items-center justify-end gap-1">
                      <span>{c} кол.</span>
                      {colors.includes(c) ? (
                        <button
                          type="button"
                          title={`Прибрати ${c} кол.`}
                          aria-label={`Прибрати стовпчик ${c} кол.`}
                          disabled={pending || colors.length <= 1}
                          onClick={() => removeColorColumn(c)}
                          className="rounded p-0.5 text-[var(--color-text-quiet)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] disabled:opacity-30"
                        >
                          <IconTrash size={12} />
                        </button>
                      ) : null}
                    </span>
                  </TH>
                ))}
                <TH width="88px" />
              </THead>
              <TBody>
                {bands.length === 0 ? (
                  <TableEmpty
                    colSpan={displayColors.length + 2}
                    title="Порожньо"
                    description="Заповніть новий рядок тиражу знизу й натисніть «Додати»."
                  />
                ) : (
                  bands.map((qty) => (
                    <TR key={qty}>
                      <TD className="py-1 tabular font-medium">{qty}</TD>
                      {displayColors.map((color) => (
                        <TD key={`${qty}-${color}`} className="py-1" numeric>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            disabled={pending}
                            className={softCell}
                            value={rateAt(qty, color)}
                            aria-label={`₴/шт від ${qty}, ${color} кол.`}
                            onChange={(event) =>
                              setRate(qty, color, Number(event.target.value) || 0)
                            }
                          />
                        </TD>
                      ))}
                      <TD className="py-1" align="center">
                        <button
                          type="button"
                          disabled={pending}
                          title={`Прибрати тираж від ${qty}`}
                          aria-label={`Прибрати тираж від ${qty}`}
                          onClick={() => removeBand(qty)}
                          className="rounded p-1 text-[var(--color-text-quiet)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] disabled:opacity-40"
                        >
                          <IconTrash size={14} />
                        </button>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
              <TFoot>
                <tr className="border-t border-dashed border-[var(--color-border-strong)] bg-[color-mix(in_srgb,var(--color-primary-50)_35%,var(--color-surface))]">
                  <TD className="py-2 align-bottom">
                    <label className="flex flex-col gap-0.5">
                      <span className="type-caption normal-case tracking-normal text-[var(--color-primary-700)]">
                        Новий тираж
                      </span>
                      <input
                        form="sp-draft-tirage"
                        type="number"
                        min={1}
                        disabled={pending}
                        className={cn(draftCell, "text-left")}
                        value={draftQty}
                        onChange={(event) => setDraftQty(event.target.value)}
                        placeholder="шт"
                        aria-label="Новий тираж від"
                      />
                    </label>
                  </TD>
                  {displayColors.map((color) => (
                    <TD key={`draft-${color}`} className="py-2 align-bottom" numeric>
                      <label className="flex flex-col gap-0.5">
                        <span className="type-caption normal-case tracking-normal text-[var(--color-text-quiet)]">
                          {color} кол. · ₴
                        </span>
                        <input
                          form="sp-draft-tirage"
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={pending}
                          className={draftCell}
                          value={draftRates[color] ?? ""}
                          onChange={(event) =>
                            setDraftRates((prev) => ({
                              ...prev,
                              [color]: event.target.value,
                            }))
                          }
                          placeholder="0"
                          aria-label={`Нова ціна ${color} кол.`}
                        />
                      </label>
                    </TD>
                  ))}
                  <TD className="py-2 align-bottom" align="center">
                    <Button
                      form="sp-draft-tirage"
                      type="submit"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      className="w-full"
                    >
                      <IconPlus size={14} />
                      Додати
                    </Button>
                  </TD>
                </tr>
              </TFoot>
            </Table>
          </div>
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
          <form
            id="sp-draft-coef"
            className="hidden"
            onSubmit={(event) => {
              event.preventDefault();
              addCoefRow();
            }}
          />
          <Table>
            <THead>
              <TH>Назва</TH>
              <TH>Примітка</TH>
              <TH width="88px" align="right">
                ×
              </TH>
              <TH width="88px" />
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
                        className={softLine}
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
                        className={softLine}
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
                        className={cn(softLine, "text-right tabular")}
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
            <TFoot>
              <tr className="border-t border-dashed border-[var(--color-border-strong)] bg-[color-mix(in_srgb,var(--color-primary-50)_35%,var(--color-surface))]">
                <TD className="py-2 align-bottom">
                  <label className="flex flex-col gap-0.5">
                    <span className="type-caption normal-case tracking-normal text-[var(--color-primary-700)]">
                      Нова назва
                    </span>
                    <input
                      form="sp-draft-coef"
                      disabled={pending}
                      className={draftLine}
                      value={draftCoefName}
                      onChange={(event) => setDraftCoefName(event.target.value)}
                      placeholder="Умова"
                      aria-label="Нова назва коефіцієнта"
                    />
                  </label>
                </TD>
                <TD className="py-2 align-bottom">
                  <label className="flex flex-col gap-0.5">
                    <span className="type-caption normal-case tracking-normal text-[var(--color-text-quiet)]">
                      Примітка
                    </span>
                    <input
                      form="sp-draft-coef"
                      disabled={pending}
                      className={draftLine}
                      value={draftCoefNote}
                      onChange={(event) => setDraftCoefNote(event.target.value)}
                      placeholder="—"
                      aria-label="Примітка нового коефіцієнта"
                    />
                  </label>
                </TD>
                <TD className="py-2 align-bottom" numeric>
                  <label className="flex flex-col gap-0.5">
                    <span className="type-caption normal-case tracking-normal text-[var(--color-text-quiet)]">
                      Множник ×
                    </span>
                    <input
                      form="sp-draft-coef"
                      type="number"
                      min={0.01}
                      step="0.01"
                      disabled={pending}
                      className={cn(draftLine, "text-right tabular")}
                      value={draftCoefFactor}
                      onChange={(event) => setDraftCoefFactor(event.target.value)}
                      placeholder="1.5"
                      aria-label="Множник нового коефіцієнта"
                    />
                  </label>
                </TD>
                <TD className="py-2 align-bottom" align="center">
                  <Button
                    form="sp-draft-coef"
                    type="submit"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    className="w-full"
                  >
                    <IconPlus size={14} />
                    Додати
                  </Button>
                </TD>
              </tr>
            </TFoot>
          </Table>
        </TableCard>

        {error ? <Banner tone="danger">{error}</Banner> : null}
        {message && !error ? <Banner tone="info">{message}</Banner> : null}
      </div>
    </SoftBusy>
  );
}
