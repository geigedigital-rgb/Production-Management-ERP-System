"use client";

import { MATERIAL_TAG_COLORS, MATERIAL_TAG_STYLES, type MaterialTagColor } from "@/lib/material-tags";
import { cn } from "@/lib/utils";

/** Compact color-tag picker — 5 swatches + clear. */
export function MaterialTagPicker({
  value,
  onChange,
  name = "tagColor",
}: {
  value: MaterialTagColor | null;
  onChange: (next: MaterialTagColor | null) => void;
  name?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="hidden" name={name} value={value ?? ""} />
      <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]">
        Тег
      </span>
      <div
        className="inline-flex items-center gap-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-1"
        role="radiogroup"
        aria-label="Колір тега"
      >
        <button
          type="button"
          role="radio"
          aria-checked={value == null}
          aria-label="Без тега"
          onClick={() => onChange(null)}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-medium transition-colors",
            value == null
              ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[0_1px_2px_rgba(18,31,24,0.08)]"
              : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]",
          )}
        >
          –
        </button>
        {MATERIAL_TAG_COLORS.map((color) => {
          const style = MATERIAL_TAG_STYLES[color];
          const selected = value === color;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={style.label}
              title={style.label}
              onClick={() => onChange(selected ? null : color)}
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-full transition-shadow",
                selected && `ring-2 ring-offset-1 ring-offset-[var(--color-surface-subtle)] ${style.ring}`,
              )}
            >
              <span className={cn("size-4 rounded-full", style.swatch)} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Colored mark next to material name in the catalog table. */
export function MaterialTagDot({
  color,
  className,
}: {
  color: MaterialTagColor | null | undefined;
  className?: string;
}) {
  if (!color) return null;
  const style = MATERIAL_TAG_STYLES[color];
  return (
    <span
      className={cn(
        "mt-0.5 inline-flex size-3 shrink-0 rounded-full ring-2 ring-[var(--color-surface)]",
        style.swatch,
        className,
      )}
      title={style.label}
      aria-label={style.label}
    />
  );
}
