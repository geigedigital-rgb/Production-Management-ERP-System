"use client";

import { cn } from "@/lib/utils";

/** Compact segmented control for material purchase modes. */
export function ModeSegment<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label?: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 sm:col-span-full", className)}>
      {label ? (
        <p className="type-label text-[var(--color-text-tertiary)]">{label}</p>
      ) : null}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                active
                  ? "bg-[var(--color-tint-sage)] text-[var(--color-primary-800)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type FabricQuoteMode = "meter" | "kg";
export type FabricTierMode = "single" | "tier";
export type FabricDeliveryUiMode = "kg" | "none";

export function inferFabricQuoteMode(input: {
  priceKgUsd?: string | number | null;
}): FabricQuoteMode {
  const raw = input.priceKgUsd;
  if (raw == null || raw === "") return "meter";
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? "kg" : "meter";
}

export function inferFabricTierMode(input: {
  minWholesaleMeters?: string | number | null;
  priceMeterUahCutVat?: string | number | null;
}): FabricTierMode {
  const minRaw = input.minWholesaleMeters;
  const cutRaw = input.priceMeterUahCutVat;
  const min =
    minRaw == null || minRaw === ""
      ? 0
      : typeof minRaw === "number"
        ? minRaw
        : Number(String(minRaw).replace(",", "."));
  const cut =
    cutRaw == null || cutRaw === ""
      ? 0
      : typeof cutRaw === "number"
        ? cutRaw
        : Number(String(cutRaw).replace(",", "."));
  return (Number.isFinite(min) && min > 0) || (Number.isFinite(cut) && cut > 0)
    ? "tier"
    : "single";
}

export function inferFabricDeliveryUiMode(input: {
  cargoUsdPerKg?: string | number | null;
  npStandardUsdPerKg?: string | number | null;
  npVolumeUsdPerKg?: string | number | null;
}): FabricDeliveryUiMode {
  const values = [input.cargoUsdPerKg, input.npStandardUsdPerKg, input.npVolumeUsdPerKg];
  for (const raw of values) {
    if (raw == null || raw === "") continue;
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
    if (Number.isFinite(n) && n >= 0) return "kg";
  }
  return "none";
}
