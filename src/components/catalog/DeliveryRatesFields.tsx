"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { IconClose, IconPlus } from "@/components/ui/Icons";
import {
  FABRIC_DELIVERY_TYPES,
  DEFAULT_FABRIC_DELIVERY_RATES,
  deliveryRateUsdPerKg,
  deliveryRateUnitLabel,
  fabricDeliveryTypeLabel,
  normalizeFabricDeliveryType,
  type FabricDeliveryTypeCode,
  type FabricDeliveryRateGlobals,
} from "@/lib/fabric-delivery-types";
import { cn } from "@/lib/utils";

export type DeliveryRateDraft = {
  deliveryType: FabricDeliveryTypeCode;
  cargoUsdPerKg: string;
  npStandardUsdPerKg: string;
  npVolumeUsdPerKg: string;
};

function rateKey(
  type: FabricDeliveryTypeCode,
): "cargoUsdPerKg" | "npStandardUsdPerKg" | "npVolumeUsdPerKg" {
  if (type === "NP_STANDARD") return "npStandardUsdPerKg";
  if (type === "NP_VOLUME") return "npVolumeUsdPerKg";
  return "cargoUsdPerKg";
}

function hasRate(draft: DeliveryRateDraft, type: FabricDeliveryTypeCode): boolean {
  const raw = draft[rateKey(type)].trim();
  if (!raw) return false;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0;
}

function configuredTypes(draft: DeliveryRateDraft): FabricDeliveryTypeCode[] {
  return FABRIC_DELIVERY_TYPES.filter((type) => hasRate(draft, type));
}

/**
 * Delivery methods as tabs. Nothing is pre-selected: add via «+», remove via «×».
 * Clicking a tab only switches the active method — it does not add one.
 * Rates are always $/кг (+ optional course).
 */
export function DeliveryRatesFields({
  draft,
  onChange,
  mode: _mode = "fabric",
  fabricGlobals,
  usdUahRate,
  onUsdUahRateChange,
}: {
  draft: DeliveryRateDraft;
  onChange: (next: DeliveryRateDraft) => void;
  /** @deprecated Always $/кг — kept for call-site compat. */
  mode?: "fabric" | "trim";
  fabricGlobals?: FabricDeliveryRateGlobals;
  /** Editable ₴/$ course used in $/кг → ₴ calculations. */
  usdUahRate?: string;
  onUsdUahRateChange?: (next: string) => void;
}) {
  void _mode;
  const openTabs = configuredTypes(draft);
  const availableToAdd = FABRIC_DELIVERY_TYPES.filter((type) => !openTabs.includes(type));
  const preferred = normalizeFabricDeliveryType(draft.deliveryType);
  const active = openTabs.includes(preferred) ? preferred : (openTabs[0] ?? null);
  const showCourse = onUsdUahRateChange != null;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  function defaultRateFor(type: FabricDeliveryTypeCode): string {
    if (fabricGlobals) return String(deliveryRateUsdPerKg(type, fabricGlobals));
    return String(DEFAULT_FABRIC_DELIVERY_RATES[type]);
  }

  function selectType(type: FabricDeliveryTypeCode) {
    if (draft.deliveryType === type) return;
    onChange({ ...draft, deliveryType: type });
  }

  function addType(type: FabricDeliveryTypeCode) {
    const key = rateKey(type);
    const next = {
      ...draft,
      deliveryType: type,
      [key]: draft[key].trim() || defaultRateFor(type),
    };
    onChange(next as DeliveryRateDraft);
    setMenuOpen(false);
  }

  function clearType(type: FabricDeliveryTypeCode) {
    const key = rateKey(type);
    const next = { ...draft, [key]: "" } as DeliveryRateDraft;
    const remaining = configuredTypes(next);
    if (draft.deliveryType === type) {
      next.deliveryType = remaining[0] ?? "CARGO";
    }
    onChange(next);
  }

  return (
    <div className="sm:col-span-3 space-y-2">
      <div
        className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-1"
        role="tablist"
        aria-label="Спосіб доставки"
      >
        {openTabs.length === 0 ? (
          <span className="px-2 py-1.5 text-[12px] text-[var(--color-text-tertiary)]">
            Немає тарифів
          </span>
        ) : null}

        {openTabs.map((type) => {
          const on = type === active;
          const rate = draft[rateKey(type)].trim();
          return (
            <div
              key={type}
              className={cn(
                "inline-flex items-center gap-0.5 rounded-[8px] pl-2.5 pr-1 py-1 text-[12.5px] font-semibold tabular transition-colors",
                on
                  ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[0_1px_2px_rgba(18,31,24,0.08)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => selectType(type)}
                className="inline-flex items-center gap-1"
              >
                <span>{fabricDeliveryTypeLabel(type)}</span>
                {rate ? (
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      on ? "text-[var(--color-primary-700)]" : "text-[var(--color-text-tertiary)]",
                    )}
                  >
                    {rate} $
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[var(--color-text-quiet)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                onClick={() => clearType(type)}
                aria-label={`Прибрати ${fabricDeliveryTypeLabel(type)}`}
              >
                <IconClose size={12} />
              </button>
            </div>
          );
        })}

        {availableToAdd.length > 0 ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-dashed border-[var(--color-border-strong)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary-400)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary-700)]"
              aria-label="Додати тариф доставки"
              aria-expanded={menuOpen}
            >
              <IconPlus size={14} />
            </button>
            {menuOpen ? (
              <div className="absolute left-0 top-[calc(100%+4px)] z-20 min-w-[10rem] overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[0_8px_24px_rgba(18,31,24,0.12)]">
                {availableToAdd.map((type) => (
                  <button
                    key={`add-${type}`}
                    type="button"
                    onClick={() => addType(type)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12.5px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
                  >
                    <span>{fabricDeliveryTypeLabel(type)}</span>
                    <span className="tabular text-[11px] text-[var(--color-text-tertiary)]">
                      {defaultRateFor(type)} $
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {active ? (
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label={`Тариф · ${fabricDeliveryTypeLabel(active)}`}
            type="number"
            min={0}
            step="0.01"
            suffix={deliveryRateUnitLabel(active)}
            optional
            placeholder={defaultRateFor(active)}
            value={draft[rateKey(active)]}
            onChange={(event) =>
              onChange({ ...draft, [rateKey(active)]: event.target.value })
            }
            className="max-w-[12rem]"
          />
          {showCourse ? (
            <Input
              label="Курс"
              type="number"
              min={0}
              step="0.01"
              suffix="₴/$"
              value={usdUahRate ?? ""}
              onChange={(event) => onUsdUahRateChange?.(event.target.value)}
              className="max-w-[10rem]"
            />
          ) : null}
        </div>
      ) : (
        <p className="type-caption text-[var(--color-text-tertiary)]">
          Натисніть «+», щоб додати спосіб доставки.
        </p>
      )}
    </div>
  );
}
