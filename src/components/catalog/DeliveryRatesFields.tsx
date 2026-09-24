"use client";

import { Input } from "@/components/ui/Input";
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
 * Delivery methods as tabs (+ dashed tabs to add). Active tab = COGS method;
 * rate field edits that tab only. Rates are always $/кг (+ optional course).
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
  const active = normalizeFabricDeliveryType(draft.deliveryType);
  const configured = configuredTypes(draft);
  const openTabs = FABRIC_DELIVERY_TYPES.filter(
    (type) => configured.includes(type) || type === active,
  );
  const availableToAdd = FABRIC_DELIVERY_TYPES.filter((type) => !openTabs.includes(type));
  const suffix = deliveryRateUnitLabel(active);
  const activeKey = rateKey(active);
  const companyDefault = fabricGlobals
    ? String(deliveryRateUsdPerKg(active, fabricGlobals))
    : String(DEFAULT_FABRIC_DELIVERY_RATES[active]);
  const showCourse = onUsdUahRateChange != null;

  function defaultRateFor(type: FabricDeliveryTypeCode): string {
    if (fabricGlobals) return String(deliveryRateUsdPerKg(type, fabricGlobals));
    return String(DEFAULT_FABRIC_DELIVERY_RATES[type]);
  }

  function setActiveType(type: FabricDeliveryTypeCode) {
    const key = rateKey(type);
    const next = { ...draft, deliveryType: type };
    if (!next[key].trim()) {
      next[key] = defaultRateFor(type);
    }
    onChange(next);
  }

  function clearType(type: FabricDeliveryTypeCode) {
    const key = rateKey(type);
    const next = { ...draft, [key]: "" };
    if (draft.deliveryType === type) {
      const remaining = configuredTypes(next);
      if (remaining[0]) {
        next.deliveryType = remaining[0];
      } else {
        next[rateKey("CARGO")] = defaultRateFor("CARGO");
        next.deliveryType = "CARGO";
      }
    }
    onChange(next as DeliveryRateDraft);
  }

  return (
    <div className="sm:col-span-3 space-y-2">
      <div
        className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-1"
        role="tablist"
        aria-label="Спосіб доставки"
      >
        {openTabs.map((type) => {
          const on = type === active;
          const rate = draft[rateKey(type)].trim();
          const canRemove = openTabs.length > 1;
          return (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActiveType(type)}
              className={cn(
                "inline-flex items-center gap-1 rounded-[8px] px-2.5 py-1.5 text-[12.5px] font-semibold tabular transition-colors",
                on
                  ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[0_1px_2px_rgba(18,31,24,0.08)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
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
              {canRemove ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="ml-0.5 text-[var(--color-text-quiet)] hover:text-[var(--color-danger-text)]"
                  onClick={(event) => {
                    event.stopPropagation();
                    clearType(type);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      clearType(type);
                    }
                  }}
                  aria-label={`Прибрати ${fabricDeliveryTypeLabel(type)}`}
                >
                  ×
                </span>
              ) : null}
            </button>
          );
        })}

        {availableToAdd.map((type) => (
          <button
            key={`add-${type}`}
            type="button"
            onClick={() => setActiveType(type)}
            className="inline-flex items-center gap-0.5 rounded-[8px] border border-dashed border-[var(--color-border-strong)] bg-transparent px-2 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary-400)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary-700)]"
          >
            + {fabricDeliveryTypeLabel(type)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          label={`Тариф · ${fabricDeliveryTypeLabel(active)}`}
          type="number"
          min={0}
          step="0.01"
          suffix={suffix}
          optional
          placeholder={companyDefault}
          value={draft[activeKey]}
          onChange={(event) => onChange({ ...draft, [activeKey]: event.target.value })}
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
    </div>
  );
}
