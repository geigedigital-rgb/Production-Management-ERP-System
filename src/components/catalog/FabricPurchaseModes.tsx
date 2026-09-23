"use client";

import { cn } from "@/lib/utils";

/** Dense segmented control — active = solid green. */
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
    <div className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {label ? (
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]">
          {label}
        </span>
      ) : null}
      <div className="inline-flex items-center gap-0.5 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-0.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-[6px] px-2 py-1 text-[11.5px] font-semibold leading-none transition-colors",
                active
                  ? "bg-[var(--color-primary-500)] text-white"
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

/** One compact row for purchase mode toggles. */
export function PurchaseModeRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sm:col-span-full flex flex-wrap items-center gap-x-3 gap-y-1.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type FabricQuoteMode = "meter" | "kg";
export type FabricTierMode = "single" | "tier";
export type FabricDeliveryUiMode = "kg" | "none";

/** шт / бобіна: direct unit price vs pack quote. */
export type UnitQuoteMode = "each" | "pack";
export type UnitDeliveryUiMode = "pack" | "none";

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

export function inferUnitQuoteMode(input: {
  purchasePackPrice?: string | number | null;
}): UnitQuoteMode {
  const raw = input.purchasePackPrice;
  if (raw == null || raw === "") return "each";
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? "pack" : "each";
}

export function inferUnitDeliveryUiMode(input: {
  cargoUsdPerKg?: string | number | null;
  npStandardUsdPerKg?: string | number | null;
  npVolumeUsdPerKg?: string | number | null;
  packDeliveryCostUah?: string | number | null;
}): UnitDeliveryUiMode {
  if (inferFabricDeliveryUiMode(input) === "kg") return "pack";
  const raw = input.packDeliveryCostUah;
  if (raw == null || raw === "") return "none";
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? "pack" : "none";
}
