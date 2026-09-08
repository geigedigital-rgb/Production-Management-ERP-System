"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ALL_SIZES, type SizeRef, type SizeScope } from "@/lib/size-bom";
import { isOversizeCode } from "@/lib/size-coeffs";

export function SizeScopeTabs({
  sizes,
  value,
  onChange,
  customized,
}: {
  sizes: SizeRef[];
  value: SizeScope;
  onChange: (next: SizeScope) => void;
  customized?: Set<string>;
}) {
  if (sizes.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(ALL_SIZES)}
        className={cn(
          "rounded-[8px] px-2.5 py-1 text-[12.5px] font-semibold transition-colors",
          value === ALL_SIZES
            ? "bg-[var(--color-tint-sage)] text-[var(--color-primary-800)]"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]",
        )}
      >
        Усі
      </button>
      {sizes.map((size) => {
        const active = value === size.code;
        const mark = customized?.has(size.code);
        const oversize = isOversizeCode(size.code);
        return (
          <button
            key={size.code}
            type="button"
            title={oversize ? "Крупний розмір: автонадбавка в розрахунку" : undefined}
            onClick={() => onChange(size.code)}
            className={cn(
              "inline-flex items-center gap-1 rounded-[8px] px-2.5 py-1 text-[12.5px] font-semibold transition-colors",
              active
                ? "bg-[var(--color-tint-sage)] text-[var(--color-primary-800)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]",
            )}
          >
            {size.nameUk ?? size.code}
            {oversize ? (
              <span className="text-[10px] font-medium text-[var(--color-warning-text)]">+</span>
            ) : null}
            {mark ? (
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warning-text)]" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function CopySizeSpec({
  from,
  sizes,
  onCopy,
  disabled,
}: {
  from: string;
  sizes: SizeRef[];
  onCopy: (to: string[]) => void;
  disabled?: boolean;
}) {
  const others = sizes.filter((size) => size.code !== from);
  const [selected, setSelected] = useState<string[]>(others.map((size) => size.code));

  if (others.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
      <span className="text-[var(--color-text-tertiary)]">Скопіювати специфіку на</span>
      {others.map((size) => {
        const active = selected.includes(size.code);
        return (
          <label
            key={size.code}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1 rounded-[6px] border px-2 py-0.5",
              active
                ? "border-[var(--color-primary-500)] bg-[var(--color-tint-sage)]"
                : "border-[var(--color-border)]",
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={active}
              onChange={() =>
                setSelected((prev) =>
                  prev.includes(size.code)
                    ? prev.filter((code) => code !== size.code)
                    : [...prev, size.code],
                )
              }
            />
            {size.nameUk ?? size.code}
          </label>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled || selected.length === 0}
        onClick={() => onCopy(selected)}
      >
        Застосувати
      </Button>
    </div>
  );
}
