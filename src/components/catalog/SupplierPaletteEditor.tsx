"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  mergeColorLists,
  normalizeColorLabel,
  rememberCustomColorSwatch,
  swatchForColorLabel,
  TRIM_COLOR_SWATCHES,
} from "@/lib/trim-colors";
import { cn } from "@/lib/utils";

function labelsMatch(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Mini palette table for supplier offers: swatch circle + name.
 * Labels are what product/order color pickers consume.
 */
export function SupplierPaletteEditor({
  value,
  onChange,
}: {
  /** Comma-separated labels (same wire format as before). */
  value: string;
  onChange: (nextCsv: string) => void;
}) {
  const colors = useMemo(() => mergeColorLists(value.split(",")), [value]);
  const [draftName, setDraftName] = useState("");
  const [draftSwatch, setDraftSwatch] = useState("#4B5563");

  function commit(next: string[]) {
    onChange(next.join(", "));
  }

  function renameAt(index: number, raw: string) {
    const label = normalizeColorLabel(raw) ?? raw.trim();
    const next = [...colors];
    if (!label) {
      next.splice(index, 1);
      commit(next);
      return;
    }
    if (next.some((row, i) => i !== index && labelsMatch(row, label))) return;
    next[index] = label;
    commit(next);
  }

  function removeAt(index: number) {
    commit(colors.filter((_, i) => i !== index));
  }

  function addColor(rawName: string, swatch?: string) {
    const label = normalizeColorLabel(rawName);
    if (!label) return;
    if (colors.some((row) => labelsMatch(row, label))) return;
    if (swatch) rememberCustomColorSwatch(label, swatch);
    commit(mergeColorLists(colors, [label]));
    setDraftName("");
    setDraftSwatch("#4B5563");
  }

  const unusedPresets = TRIM_COLOR_SWATCHES.filter(
    (row) => !colors.some((c) => labelsMatch(c, row.label)),
  ).slice(0, 10);

  return (
    <div className="sm:col-span-full space-y-2">
      {colors.length > 0 ? (
        <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)]">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[var(--color-surface-subtle)] text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
              <tr>
                <th className="w-12 px-2.5 py-1.5 font-medium">Колір</th>
                <th className="px-2.5 py-1.5 font-medium">Назва</th>
              </tr>
            </thead>
            <tbody>
              {colors.map((label, index) => {
                const swatch = swatchForColorLabel(label);
                return (
                  <tr
                    key={`${label}-${index}`}
                    className="group/color border-t border-[var(--color-divider)]"
                  >
                    <td className="px-2.5 py-1.5 align-middle">
                      <span
                        className={cn(
                          "block size-6 rounded-full ring-1 ring-black/15",
                          swatch.bordered && "border border-[var(--color-border-strong)]",
                        )}
                        style={{ backgroundColor: swatch.swatch }}
                        title={swatch.swatch}
                        aria-hidden
                      />
                    </td>
                    <td className="px-2.5 py-1.5 align-middle">
                      <div className="flex items-center gap-1.5">
                        <input
                          className="h-8 min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-1.5 text-[13px] outline-none hover:border-[var(--color-border)] focus:border-[var(--color-primary-500)] focus:ring-1 focus:ring-[var(--color-focus-ring)]"
                          value={label}
                          onChange={(event) => {
                            const next = [...colors];
                            next[index] = event.target.value;
                            commit(next);
                          }}
                          onBlur={(event) => renameAt(index, event.target.value)}
                          aria-label={`Назва кольору ${index + 1}`}
                        />
                        <button
                          type="button"
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-[6px] text-[14px] text-[var(--color-text-tertiary)] opacity-0 transition-opacity hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] focus-visible:opacity-100 group-hover/color:opacity-100"
                          onClick={() => removeAt(index)}
                          aria-label={`Прибрати ${label}`}
                          title="Прибрати колір"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {unusedPresets.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {unusedPresets.map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={() => addColor(row.label, row.swatch)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11.5px] hover:border-[var(--color-primary-400)]"
              title={`Додати ${row.label}`}
            >
              <span
                className={cn(
                  "size-3.5 rounded-full ring-1 ring-black/10",
                  row.bordered && "border border-[var(--color-border-strong)]",
                )}
                style={{ backgroundColor: row.swatch }}
                aria-hidden
              />
              {row.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="rounded-[var(--radius-control)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2.5 py-2">
        <p className="mb-1.5 text-[12px] font-medium text-[var(--color-text-primary)]">
          Новий колір
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="type-label">Колір</span>
            <input
              type="color"
              value={draftSwatch}
              onChange={(event) => setDraftSwatch(event.target.value)}
              className="h-10 w-12 cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-1"
              aria-label="Колір зразка"
            />
          </label>
          <Input
            className="min-w-[10rem] flex-1"
            label="Назва"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Олива"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addColor(draftName, draftSwatch);
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!draftName.trim()}
            onClick={() => addColor(draftName, draftSwatch)}
          >
            Додати колір
          </Button>
        </div>
      </div>
    </div>
  );
}
