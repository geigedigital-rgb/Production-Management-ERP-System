"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, FormGroup } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { IconClients, IconPurchaseKg } from "@/components/ui/Icons";
import { SupplierPaletteEditor } from "@/components/catalog/SupplierPaletteEditor";
import { DeliveryRatesFields } from "@/components/catalog/DeliveryRatesFields";
import {
  ModeSegment,
  PurchaseModeRow,
  inferFabricDeliveryUiMode,
  inferFabricQuoteMode,
  inferFabricTierMode,
  inferUnitDeliveryUiMode,
  inferUnitQuoteMode,
  type FabricDeliveryUiMode,
  type FabricQuoteMode,
  type FabricTierMode,
  type UnitDeliveryUiMode,
  type UnitQuoteMode,
} from "@/components/catalog/FabricPurchaseModes";
import { deriveFabricPricing, type FabricPricingGlobals } from "@/lib/fabric-pricing";
import {
  deliveryRateUsdPerKg,
  fabricDeliveryTypeLabel,
  type FabricDeliveryTypeCode,
} from "@/lib/fabric-delivery-types";
import { resolveSupplierDeliveryRate } from "@/lib/supplier-delivery-rates";
import { formatMoneyUah, cn } from "@/lib/utils";
import { swatchForColorLabel } from "@/lib/trim-colors";
import { getSupplierPaletteAction } from "@/server/domains/catalog/actions";
import {
  deriveTrimUnitPriceFromSupplier,
  hasTrimPackQuote,
  resolveTrimPackDeliveryUah,
} from "@/lib/trim-pack-pricing";

export type MaterialSupplierOfferDraft = {
  key: string;
  isPrimary: boolean;
  supplierName: string;
  deliveryType: FabricDeliveryTypeCode;
  cargoUsdPerKg: string;
  npStandardUsdPerKg: string;
  npVolumeUsdPerKg: string;
  priceKgUsd: string;
  priceKgUsdVat: string;
  priceMeterUahNoVat: string;
  priceMeterUahVat: string;
  priceMeterUahCutVat: string;
  minWholesaleMeters: string;
  wholesaleNote: string;
  /** Trim: supplier pack quote (₴). */
  purchasePackPrice: string;
  /** Trim: delivery for pack (₴), or from typed delivery tabs. */
  packDeliveryCostUah: string;
  /** Comma-separated color labels (same wire format as MaterialSuppliersEditor). */
  availableColors: string;
};

type DraftForm = Omit<MaterialSupplierOfferDraft, "key" | "isPrimary"> & {
  asPrimary: boolean;
};

function emptyForm(
  asPrimary: boolean,
  deliveryType: FabricDeliveryTypeCode,
  fabricGlobals: FabricPricingGlobals,
): DraftForm {
  return {
    supplierName: "",
    deliveryType,
    cargoUsdPerKg: String(deliveryRateUsdPerKg(deliveryType, fabricGlobals)),
    npStandardUsdPerKg: "",
    npVolumeUsdPerKg: "",
    priceKgUsd: "",
    priceKgUsdVat: "",
    priceMeterUahNoVat: "",
    priceMeterUahVat: "",
    priceMeterUahCutVat: "",
    minWholesaleMeters: "",
    wholesaleNote: "",
    purchasePackPrice: "",
    packDeliveryCostUah: "",
    availableColors: "",
    asPrimary,
  };
}

function formFromOffer(row: MaterialSupplierOfferDraft): DraftForm {
  return {
    supplierName: row.supplierName,
    deliveryType: row.deliveryType,
    cargoUsdPerKg: row.cargoUsdPerKg,
    npStandardUsdPerKg: row.npStandardUsdPerKg ?? "",
    npVolumeUsdPerKg: row.npVolumeUsdPerKg ?? "",
    priceKgUsd: row.priceKgUsd,
    priceKgUsdVat: row.priceKgUsdVat,
    priceMeterUahNoVat: row.priceMeterUahNoVat,
    priceMeterUahVat: row.priceMeterUahVat,
    priceMeterUahCutVat: row.priceMeterUahCutVat,
    minWholesaleMeters: row.minWholesaleMeters,
    wholesaleNote: row.wholesaleNote,
    purchasePackPrice: row.purchasePackPrice ?? "",
    packDeliveryCostUah: row.packDeliveryCostUah ?? "",
    availableColors: row.availableColors,
    asPrimary: row.isPrimary,
  };
}

function trimDraftRates(draft: DraftForm) {
  return {
    deliveryType: draft.deliveryType,
    cargoUsdPerKg: draft.cargoUsdPerKg ? Number(draft.cargoUsdPerKg) : null,
    npStandardUsdPerKg: draft.npStandardUsdPerKg
      ? Number(draft.npStandardUsdPerKg)
      : null,
    npVolumeUsdPerKg: draft.npVolumeUsdPerKg ? Number(draft.npVolumeUsdPerKg) : null,
  };
}

function newKey() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function MaterialSupplierDraftsEditor({
  offers,
  onChange,
  metersPerKg,
  unitsPerPack = null,
  fabricGlobals,
  knownSuppliers,
  defaultDeliveryType = "CARGO",
  onEditingChange,
  pricingKind = "fabric",
  usdUahRate,
  onUsdUahRateChange,
}: {
  offers: MaterialSupplierOfferDraft[];
  onChange: (next: MaterialSupplierOfferDraft[]) => void;
  metersPerKg?: number | null;
  /** Trim: шт в упаковці з картки матеріалу. */
  unitsPerPack?: number | null;
  fabricGlobals: FabricPricingGlobals;
  knownSuppliers: string[];
  defaultDeliveryType?: FabricDeliveryTypeCode;
  onEditingChange: (editing: boolean) => void;
  /** fabric = $/кг + м.п.; unit = ціна ₴/од. (фурнітура / інші матеріали). */
  pricingKind?: "fabric" | "unit";
  /** Editable company course (₴/$); used in fabric $/кг → ₴ math. */
  usdUahRate?: number;
  onUsdUahRateChange?: (next: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<DraftForm>(() =>
    emptyForm(true, defaultDeliveryType, fabricGlobals),
  );
  const [quoteMode, setQuoteMode] = useState<FabricQuoteMode>("kg");
  const [tierMode, setTierMode] = useState<FabricTierMode>("single");
  const [deliveryUiMode, setDeliveryUiMode] = useState<FabricDeliveryUiMode>("kg");
  const [unitQuoteMode, setUnitQuoteMode] = useState<UnitQuoteMode>("each");
  const [unitDeliveryUiMode, setUnitDeliveryUiMode] = useState<UnitDeliveryUiMode>("pack");
  const [localUsdRate, setLocalUsdRate] = useState(
    String(usdUahRate ?? fabricGlobals.usdUahRate),
  );

  function applyModesFromDraft(next: DraftForm) {
    setQuoteMode(inferFabricQuoteMode(next));
    setTierMode(inferFabricTierMode(next));
    setDeliveryUiMode(inferFabricDeliveryUiMode(next));
    setUnitQuoteMode(inferUnitQuoteMode(next));
    setUnitDeliveryUiMode(inferUnitDeliveryUiMode(next));
  }

  const effectiveUsdRate = (() => {
    const n = Number(String(localUsdRate).replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
    return usdUahRate ?? fabricGlobals.usdUahRate;
  })();

  const liveGlobals = useMemo<FabricPricingGlobals>(() => {
    const resolved = resolveSupplierDeliveryRate(
      {
        deliveryType: draft.deliveryType,
        cargoUsdPerKg: draft.cargoUsdPerKg ? Number(draft.cargoUsdPerKg) : null,
        npStandardUsdPerKg: draft.npStandardUsdPerKg
          ? Number(draft.npStandardUsdPerKg)
          : null,
        npVolumeUsdPerKg: draft.npVolumeUsdPerKg ? Number(draft.npVolumeUsdPerKg) : null,
      },
      fabricGlobals,
    );
    return {
      ...fabricGlobals,
      usdUahRate: effectiveUsdRate,
      fabricCargoUsdPerKg: resolved.rateUsdPerKg,
    };
  }, [fabricGlobals, draft, effectiveUsdRate]);

  function setCourse(next: string) {
    setLocalUsdRate(next);
    const n = Number(String(next).replace(",", "."));
    if (Number.isFinite(n) && n > 0) onUsdUahRateChange?.(n);
  }

  const derived = useMemo(
    () =>
      deriveFabricPricing(
        {
          metersPerKg: metersPerKg ?? null,
          priceKgUsd: draft.priceKgUsd ? Number(draft.priceKgUsd) : null,
          priceKgUsdVat: draft.priceKgUsdVat ? Number(draft.priceKgUsdVat) : null,
          priceMeterUahNoVat: draft.priceMeterUahNoVat
            ? Number(draft.priceMeterUahNoVat)
            : null,
          priceMeterUahVat: draft.priceMeterUahVat ? Number(draft.priceMeterUahVat) : null,
          priceMeterUahCutVat: draft.priceMeterUahCutVat
            ? Number(draft.priceMeterUahCutVat)
            : null,
        },
        liveGlobals,
      ),
    [draft, metersPerKg, liveGlobals],
  );

  function setEditing(next: string | "new" | null) {
    setEditingKey(next);
    onEditingChange(next != null);
  }

  function openNew(asPrimary: boolean) {
    setError(null);
    const next = emptyForm(asPrimary || offers.length === 0, defaultDeliveryType, fabricGlobals);
    if (pricingKind === "unit") {
      next.cargoUsdPerKg = "";
      next.npStandardUsdPerKg = "";
      next.npVolumeUsdPerKg = "";
      next.packDeliveryCostUah = "";
    }
    setDraft(next);
    if (pricingKind === "fabric") {
      setQuoteMode("meter");
      setTierMode("single");
      setDeliveryUiMode("kg");
    } else {
      applyModesFromDraft(next);
    }
    setEditing("new");
  }

  function openEdit(row: MaterialSupplierOfferDraft) {
    setError(null);
    const next = formFromOffer(row);
    setDraft(next);
    applyModesFromDraft(next);
    setEditing(row.key);
  }

  function applyDeliveryRates(
    patch: Pick<
      DraftForm,
      "deliveryType" | "cargoUsdPerKg" | "npStandardUsdPerKg" | "npVolumeUsdPerKg"
    >,
  ) {
    setDraft((prev) => {
      const merged = { ...prev, ...patch };
      if (!merged.priceKgUsd) return merged;
      const resolved = resolveSupplierDeliveryRate(
        {
          deliveryType: merged.deliveryType,
          cargoUsdPerKg: merged.cargoUsdPerKg ? Number(merged.cargoUsdPerKg) : null,
          npStandardUsdPerKg: merged.npStandardUsdPerKg
            ? Number(merged.npStandardUsdPerKg)
            : null,
          npVolumeUsdPerKg: merged.npVolumeUsdPerKg
            ? Number(merged.npVolumeUsdPerKg)
            : null,
        },
        fabricGlobals,
      );
      const auto = deriveFabricPricing(
        {
          metersPerKg: metersPerKg ?? null,
          priceKgUsd: Number(merged.priceKgUsd),
          priceKgUsdVat: merged.priceKgUsdVat ? Number(merged.priceKgUsdVat) : null,
        },
        { ...fabricGlobals, fabricCargoUsdPerKg: resolved.rateUsdPerKg },
      );
      return {
        ...merged,
        priceMeterUahNoVat:
          auto.priceMeterUahNoVat != null
            ? String(auto.priceMeterUahNoVat)
            : merged.priceMeterUahNoVat,
        priceMeterUahVat:
          auto.priceMeterUahVat != null
            ? String(auto.priceMeterUahVat)
            : merged.priceMeterUahVat,
      };
    });
  }

  function saveDraft() {
    setError(null);
    if (!draft.supplierName.trim()) {
      setError("Вкажіть постачальника.");
      return;
    }
    if (pricingKind === "unit") {
      const packPrice = draft.purchasePackPrice.trim();
      const hasPack =
        unitsPerPack != null &&
        unitsPerPack > 0 &&
        packPrice !== "" &&
        Number(packPrice) >= 0;
      const unit = Number(draft.priceMeterUahNoVat);
      if (!hasPack && (!(unit >= 0) || draft.priceMeterUahNoVat.trim() === "")) {
        setError(
          unitsPerPack != null && unitsPerPack > 0
            ? "Вкажіть ціну упаковки або ціну за 1 шт."
            : "Вкажіть ціну закупки (₴/од.) або спочатку «Шт в упаковці» на кроці Основне.",
        );
        return;
      }
    }
    const cut = draft.priceMeterUahCutVat.trim();
    const threshold = draft.minWholesaleMeters.trim();
    const cutValue = cut ? Number(cut) : 0;
    const hasCut = cutValue > 0;
    if (pricingKind === "fabric") {
      if (tierMode === "tier") {
        if (!hasCut) {
          setError("Вкажіть ціну ₴/м.");
          return;
        }
        if (!threshold || Number(threshold) <= 0) {
          setError("Вкажіть межу опт.");
          return;
        }
        if (!draft.priceMeterUahNoVat.trim()) {
          setError("Вкажіть ціну опт ₴/м.");
          return;
        }
      } else {
        const ordinary = draft.priceMeterUahNoVat.trim();
        if (quoteMode === "meter" && !ordinary) {
          setError("Вкажіть ціну ₴/м.");
          return;
        }
        if (quoteMode === "kg" && !draft.priceKgUsd.trim() && !ordinary) {
          setError("Вкажіть $/кг або ₴/м.");
          return;
        }
      }
    }

    const rates = trimDraftRates(draft);
    const typedDelivery = resolveTrimPackDeliveryUah(rates);
    const packDelivery =
      typedDelivery?.rateUah ??
      (draft.packDeliveryCostUah ? Number(draft.packDeliveryCostUah) : null);
    const unitFromPack =
      pricingKind === "unit"
        ? deriveTrimUnitPriceFromSupplier({
            unitsPerPack,
            purchasePackPrice: draft.purchasePackPrice
              ? Number(draft.purchasePackPrice)
              : null,
            deliveryRates: rates,
            packDeliveryCostUah: packDelivery,
            fallbackUnitPrice: draft.priceMeterUahNoVat
              ? Number(draft.priceMeterUahNoVat)
              : 0,
          })
        : null;

    const wantPrimary = draft.asPrimary || offers.length === 0;
    const row: MaterialSupplierOfferDraft = {
      key: editingKey === "new" || editingKey == null ? newKey() : editingKey,
      isPrimary: wantPrimary,
      supplierName: draft.supplierName.trim(),
      deliveryType: draft.deliveryType,
      cargoUsdPerKg:
        (pricingKind === "unit" && unitDeliveryUiMode === "pack") ||
        (pricingKind === "fabric" && deliveryUiMode === "kg")
          ? draft.cargoUsdPerKg
          : "",
      npStandardUsdPerKg:
        (pricingKind === "unit" && unitDeliveryUiMode === "pack") ||
        (pricingKind === "fabric" && deliveryUiMode === "kg")
          ? draft.npStandardUsdPerKg
          : "",
      npVolumeUsdPerKg:
        (pricingKind === "unit" && unitDeliveryUiMode === "pack") ||
        (pricingKind === "fabric" && deliveryUiMode === "kg")
          ? draft.npVolumeUsdPerKg
          : "",
      priceKgUsd: pricingKind === "fabric" && quoteMode === "kg" ? draft.priceKgUsd : "",
      priceKgUsdVat: draft.priceKgUsdVat,
      priceMeterUahNoVat:
        pricingKind === "unit" && unitFromPack != null && unitFromPack > 0
          ? String(unitFromPack)
          : draft.priceMeterUahNoVat ||
            (derived.priceMeterUahNoVat != null ? String(derived.priceMeterUahNoVat) : ""),
      priceMeterUahVat:
        pricingKind === "unit" && unitFromPack != null && unitFromPack > 0
          ? String(unitFromPack)
          : draft.priceMeterUahVat ||
            (derived.priceMeterUahVat != null ? String(derived.priceMeterUahVat) : ""),
      priceMeterUahCutVat:
        pricingKind === "fabric" && tierMode === "tier" && hasCut ? cut : "",
      minWholesaleMeters:
        pricingKind === "fabric" &&
        tierMode === "tier" &&
        threshold &&
        Number(threshold) > 0
          ? threshold
          : "",
      wholesaleNote: draft.wholesaleNote,
      purchasePackPrice:
        pricingKind === "unit" && unitQuoteMode === "pack" ? draft.purchasePackPrice : "",
      packDeliveryCostUah:
        pricingKind === "unit" && unitDeliveryUiMode === "pack"
          ? typedDelivery
            ? String(typedDelivery.rateUah)
            : draft.packDeliveryCostUah
          : "",
      availableColors: draft.availableColors,
    };

    let next = [...offers];
    if (wantPrimary) {
      next = next.map((item) => ({ ...item, isPrimary: false }));
      row.isPrimary = true;
    }

    const index = next.findIndex((item) => item.key === row.key);
    if (index >= 0) next[index] = row;
    else next.push(row);

    if (!next.some((item) => item.isPrimary) && next.length > 0) {
      next[0] = { ...next[0], isPrimary: true };
    }

    onChange(next);
    setEditing(null);
  }

  function removeOffer(key: string) {
    const target = offers.find((item) => item.key === key);
    if (!target) return;
    if (target.isPrimary && offers.length > 1) {
      setError("Спочатку зробіть іншу пропозицію основною.");
      return;
    }
    const next = offers.filter((item) => item.key !== key);
    if (next.length === 1) next[0] = { ...next[0], isPrimary: true };
    onChange(next);
    if (editingKey === key) setEditing(null);
  }

  function makePrimary(key: string) {
    onChange(
      offers.map((item) => ({
        ...item,
        isPrimary: item.key === key,
      })),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="type-subsection inline-flex items-center gap-1.5">
          <IconClients size={14} />
          Постачальники
        </h4>
        {editingKey == null ? (
          <Button type="button" size="sm" onClick={() => openNew(offers.length === 0)}>
            {offers.length === 0 ? "Додати постачальника" : "Додати ще"}
          </Button>
        ) : null}
      </div>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      {offers.length > 0 ? (
        <ul className="space-y-1.5">
          {offers.map((row) => {
            const colors = row.availableColors
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean);
            return (
              <li
                key={row.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] bg-[var(--color-surface-subtle)] px-2.5 py-1.5 text-[13px]"
              >
                <span className="min-w-0">
                  <span className="font-medium">{row.supplierName}</span>
                  {row.isPrimary ? (
                    <span className="ml-2 rounded-[4px] bg-[var(--color-tint-sage)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-primary-800)]">
                      основний
                    </span>
                  ) : null}
                  <span className="type-caption ml-2">
                    {pricingKind === "unit"
                      ? row.priceMeterUahNoVat
                        ? formatMoneyUah(Number(row.priceMeterUahNoVat))
                        : "без ціни"
                      : (() => {
                          const rate =
                            row.deliveryType === "NP_STANDARD"
                              ? row.npStandardUsdPerKg
                              : row.deliveryType === "NP_VOLUME"
                                ? row.npVolumeUsdPerKg
                                : row.cargoUsdPerKg;
                          return `${fabricDeliveryTypeLabel(row.deliveryType)}${
                            rate ? ` · ${rate} $/кг` : ""
                          }`;
                        })()}
                  </span>
                  {colors.length > 0 ? (
                    <span className="type-caption ml-2 inline-flex flex-wrap items-center gap-1">
                      {colors.slice(0, 6).map((label) => {
                        const swatch = swatchForColorLabel(label);
                        return (
                          <span
                            key={label}
                            className="inline-flex items-center gap-1"
                            title={label}
                          >
                            <span
                              className={cn(
                                "size-2.5 rounded-full ring-1 ring-black/15",
                                swatch.bordered && "border border-[var(--color-border-strong)]",
                              )}
                              style={{ backgroundColor: swatch.swatch }}
                              aria-hidden
                            />
                          </span>
                        );
                      })}
                      {colors.length > 6 ? (
                        <span className="text-[11px]">+{colors.length - 6}</span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
                <span className="flex flex-wrap gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row)}>
                    Змінити
                  </Button>
                  {!row.isPrimary ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => makePrimary(row.key)}
                      >
                        Основний
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOffer(row.key)}
                      >
                        Прибрати
                      </Button>
                    </>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {editingKey != null ? (
        <div className="space-y-3 rounded-[var(--radius-control)] border border-[var(--color-border)] p-3">
          <FormGroup columns={2} compact>
            <Select
              className="sm:col-span-2"
              label="Постачальник"
              required
              value={
                knownSuppliers.some(
                  (name) => name.toLowerCase() === draft.supplierName.toLowerCase(),
                )
                  ? knownSuppliers.find(
                      (name) => name.toLowerCase() === draft.supplierName.toLowerCase(),
                    ) ?? draft.supplierName
                  : draft.supplierName
                    ? "__custom__"
                    : ""
              }
              onChange={(event) => {
                const value = event.target.value;
                if (value === "__custom__") {
                  setDraft((prev) => ({
                    ...prev,
                    supplierName: "",
                    availableColors: "",
                  }));
                  return;
                }
                if (!value) {
                  setDraft((prev) => ({ ...prev, supplierName: "", availableColors: "" }));
                  return;
                }
                setDraft((prev) => ({ ...prev, supplierName: value }));
                void getSupplierPaletteAction(value).then((result) => {
                  if (!result.ok || result.colors.length === 0) return;
                  setDraft((prev) => {
                    if (prev.supplierName.toLowerCase() !== value.toLowerCase()) return prev;
                    return {
                      ...prev,
                      availableColors: result.colors.join(", "),
                    };
                  });
                });
              }}
            >
              <option value="">Оберіть…</option>
              {knownSuppliers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="__custom__">Новий постачальник…</option>
            </Select>
            {!knownSuppliers.some(
              (name) => name.toLowerCase() === draft.supplierName.toLowerCase(),
            ) ? (
              <Input
                className="sm:col-span-2"
                label="Назва нового"
                required
                value={draft.supplierName}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, supplierName: event.target.value }))
                }
                placeholder="Зейджан"
                autoFocus
              />
            ) : null}
          </FormGroup>

          <FormGroup label="Палітра" columns={1} compact>
            <SupplierPaletteEditor
              value={draft.availableColors}
              onChange={(next) => setDraft((prev) => ({ ...prev, availableColors: next }))}
            />
          </FormGroup>

          {pricingKind === "unit" ? (
            <>
            <FormGroup label="Закупівля" icon={<IconPurchaseKg size={14} />} columns={2} compact>
              <PurchaseModeRow>
                <ModeSegment
                  label="Ціна"
                  value={unitQuoteMode}
                  options={[
                    { value: "each", label: "₴/шт" },
                    { value: "pack", label: "₴/уп." },
                  ]}
                  onChange={(next) => {
                    setUnitQuoteMode(next);
                    if (next === "each") {
                      setDraft((prev) => ({ ...prev, purchasePackPrice: "" }));
                    }
                  }}
                />
              </PurchaseModeRow>
              {unitQuoteMode === "pack" ? (
                <Input
                  label="Ціна упаковки"
                  type="number"
                  min={0}
                  step="0.01"
                  suffix="₴"
                  value={draft.purchasePackPrice}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, purchasePackPrice: event.target.value }))
                  }
                  hint={
                    unitsPerPack != null && unitsPerPack > 0
                      ? `На ${unitsPerPack} шт → ₴/од. автоматично`
                      : "Спочатку «Шт в упаковці» на Основному"
                  }
                />
              ) : null}
              <Input
                label="Ціна"
                type="number"
                min={0}
                step="0.01"
                suffix="₴"
                readOnly={
                  unitQuoteMode === "pack" &&
                  hasTrimPackQuote({
                    unitsPerPack,
                    purchasePackPrice: draft.purchasePackPrice
                      ? Number(draft.purchasePackPrice)
                      : null,
                    packDeliveryCostUah:
                      resolveTrimPackDeliveryUah(trimDraftRates(draft))?.rateUah ??
                      (draft.packDeliveryCostUah ? Number(draft.packDeliveryCostUah) : null),
                  })
                }
                value={
                  unitQuoteMode === "pack" &&
                  hasTrimPackQuote({
                    unitsPerPack,
                    purchasePackPrice: draft.purchasePackPrice
                      ? Number(draft.purchasePackPrice)
                      : null,
                    packDeliveryCostUah:
                      resolveTrimPackDeliveryUah(trimDraftRates(draft))?.rateUah ??
                      (draft.packDeliveryCostUah ? Number(draft.packDeliveryCostUah) : null),
                  })
                    ? String(
                        deriveTrimUnitPriceFromSupplier({
                          unitsPerPack,
                          purchasePackPrice: Number(draft.purchasePackPrice),
                          deliveryRates: trimDraftRates(draft),
                          packDeliveryCostUah: draft.packDeliveryCostUah
                            ? Number(draft.packDeliveryCostUah)
                            : null,
                        }),
                      )
                    : draft.priceMeterUahNoVat
                }
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    priceMeterUahNoVat: event.target.value,
                    priceMeterUahVat: event.target.value,
                  }))
                }
              />
              <Input
                className="sm:col-span-2"
                label="Примітка"
                optional
                value={draft.wholesaleNote}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, wholesaleNote: event.target.value }))
                }
              />
            </FormGroup>
            <FormGroup label="Доставка" icon={<IconPurchaseKg size={14} />} columns={3} compact>
              <PurchaseModeRow>
                <ModeSegment
                  value={unitDeliveryUiMode}
                  options={[
                    { value: "pack", label: "За уп." },
                    { value: "none", label: "Немає" },
                  ]}
                  onChange={(next) => {
                    setUnitDeliveryUiMode(next);
                    if (next === "none") {
                      setDraft((prev) => ({
                        ...prev,
                        cargoUsdPerKg: "",
                        npStandardUsdPerKg: "",
                        npVolumeUsdPerKg: "",
                        packDeliveryCostUah: "",
                      }));
                    }
                  }}
                />
              </PurchaseModeRow>
              {unitDeliveryUiMode === "pack" ? (
                <DeliveryRatesFields
                  mode="trim"
                  draft={draft}
                  onChange={(next) => setDraft((prev) => ({ ...prev, ...next }))}
                />
              ) : (
                <p className="type-caption sm:col-span-3 text-[var(--color-text-tertiary)]">
                  Доставка не враховується в собівартості.
                </p>
              )}
            </FormGroup>
            </>
          ) : (
          <>
          <FormGroup label="Закупівля" icon={<IconPurchaseKg size={14} />} columns={2} compact>
            <PurchaseModeRow>
            <ModeSegment
              label="Ціна"
              value={quoteMode}
              options={[
                { value: "meter", label: "₴/м" },
                { value: "kg", label: "$/кг" },
              ]}
              onChange={(next) => {
                setQuoteMode(next);
                if (next === "meter") {
                  setDraft((prev) => ({ ...prev, priceKgUsd: "", priceKgUsdVat: "" }));
                }
              }}
            />
            <ModeSegment
              label="Тариф"
              value={tierMode}
              options={[
                { value: "single", label: "Ціна" },
                { value: "tier", label: "Ціна + опт" },
              ]}
              onChange={(next) => {
                setTierMode(next);
                if (next === "tier") {
                  setDraft((prev) => {
                    const hasOrdinary =
                      prev.priceMeterUahCutVat.trim() !== "" &&
                      Number(prev.priceMeterUahCutVat) > 0;
                    if (hasOrdinary) return prev;
                    return {
                      ...prev,
                      priceMeterUahCutVat: prev.priceMeterUahNoVat,
                      priceMeterUahNoVat: "",
                      priceMeterUahVat: "",
                    };
                  });
                } else {
                  setDraft((prev) => {
                    const ordinary =
                      prev.priceMeterUahCutVat.trim() || prev.priceMeterUahNoVat;
                    return {
                      ...prev,
                      priceMeterUahNoVat: ordinary,
                      priceMeterUahCutVat: "",
                      minWholesaleMeters: "",
                      priceMeterUahVat: "",
                    };
                  });
                }
              }}
            />
          </PurchaseModeRow>
            {quoteMode === "kg" ? (
              <Input
                label="Прайс постачальника"
                type="number"
                min={0}
                step="0.01"
                suffix="$/кг"
                value={draft.priceKgUsd}
                onChange={(event) => {
                  const value = event.target.value;
                  const auto = deriveFabricPricing(
                    {
                      metersPerKg: metersPerKg ?? null,
                      priceKgUsd: value ? Number(value) : null,
                      priceKgUsdVat: null,
                    },
                    liveGlobals,
                  );
                  setDraft((prev) => {
                    const meter =
                      auto.priceMeterUahNoVat != null
                        ? String(auto.priceMeterUahNoVat)
                        : "";
                    if (tierMode === "tier") {
                      return {
                        ...prev,
                        priceKgUsd: value,
                        priceKgUsdVat: "",
                        priceMeterUahCutVat: meter || prev.priceMeterUahCutVat,
                        priceMeterUahVat: "",
                      };
                    }
                    return {
                      ...prev,
                      priceKgUsd: value,
                      priceKgUsdVat: "",
                      priceMeterUahNoVat: meter || prev.priceMeterUahNoVat,
                      priceMeterUahVat: "",
                    };
                  });
                }}
                hint="Без ПДВ — як у більшості прайсів"
              />
            ) : null}
            <Input
              label="Ціна"
              type="number"
              min={0}
              step="0.1"
              suffix="₴/м"
              value={
                tierMode === "tier" ? draft.priceMeterUahCutVat : draft.priceMeterUahNoVat
              }
              onChange={(event) => {
                const value = event.target.value;
                setDraft((prev) =>
                  tierMode === "tier"
                    ? { ...prev, priceMeterUahCutVat: value, priceMeterUahVat: "" }
                    : {
                        ...prev,
                        priceMeterUahNoVat: value,
                        priceMeterUahVat: "",
                      },
                );
              }}
              hint={
                quoteMode === "kg"
                  ? "Авто: $/кг ÷ м.п./кг × курс (без доставки)"
                  : "Базова ціна тканини без доставки"
              }
            />
            {tierMode === "tier" ? (
              <>
                <Input
                  label="Межа опт"
                  type="number"
                  min={0}
                  step="0.1"
                  suffix="м"
                  value={draft.minWholesaleMeters}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((prev) => ({
                      ...prev,
                      minWholesaleMeters: value,
                    }));
                  }}
                  hint="Після цієї кількості діє ціна опт"
                />
                <Input
                  label="Ціна опт"
                  type="number"
                  min={0}
                  step="0.1"
                  suffix="₴/м"
                  disabled={
                    draft.minWholesaleMeters.trim() === "" ||
                    Number(draft.minWholesaleMeters) <= 0
                  }
                  value={draft.priceMeterUahNoVat}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((prev) => ({
                      ...prev,
                      priceMeterUahNoVat: value,
                      priceMeterUahVat: "",
                    }));
                  }}
                  hint={
                    draft.minWholesaleMeters.trim() === "" ||
                    Number(draft.minWholesaleMeters) <= 0
                      ? "Спочатку вкажіть межу опт"
                      : "Ціна після межі (зазвичай дешевша)"
                  }
                />
              </>
            ) : null}
            <Input
              className="sm:col-span-2"
              label="Примітка"
              optional
              value={draft.wholesaleNote}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, wholesaleNote: event.target.value }))
              }
            />
            {derived.purchasePrice > 0 ? (
              <p className="type-caption sm:col-span-2 tabular">
                Собівартість: {formatMoneyUah(derived.purchasePrice)}/м
                {tierMode === "tier" &&
                draft.minWholesaleMeters.trim() !== "" &&
                Number(draft.minWholesaleMeters) > 0
                  ? draft.priceMeterUahNoVat.trim() && Number(draft.priceMeterUahNoVat) > 0
                    ? ` · ≥ ${draft.minWholesaleMeters} → опт`
                    : ` · опт від ${draft.minWholesaleMeters}`
                  : " · ціна"}
              </p>
            ) : null}
          </FormGroup>
          <FormGroup label="Доставка" icon={<IconPurchaseKg size={14} />} columns={3} compact>
            <PurchaseModeRow>
              <ModeSegment
                value={deliveryUiMode}
                options={[
                  { value: "kg", label: "За кг ($)" },
                  { value: "none", label: "Немає" },
                ]}
                onChange={(next) => {
                  setDeliveryUiMode(next);
                  if (next === "none") {
                    setDraft((prev) => ({
                      ...prev,
                      cargoUsdPerKg: "",
                      npStandardUsdPerKg: "",
                      npVolumeUsdPerKg: "",
                    }));
                  } else {
                    setDraft((prev) => ({
                      ...prev,
                      cargoUsdPerKg:
                        prev.cargoUsdPerKg.trim() ||
                        String(deliveryRateUsdPerKg("CARGO", fabricGlobals)),
                    }));
                  }
                }}
              />
            </PurchaseModeRow>
            {deliveryUiMode === "kg" ? (
              <DeliveryRatesFields
                mode="fabric"
                fabricGlobals={fabricGlobals}
                usdUahRate={localUsdRate}
                onUsdUahRateChange={setCourse}
                draft={draft}
                onChange={(next) => applyDeliveryRates(next)}
              />
            ) : (
                <p className="type-caption sm:col-span-3 text-[var(--color-text-tertiary)]">
                  Тарифи доставки вимкнено.
                </p>
            )}
          </FormGroup>
          </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={saveDraft}>
              Зберегти постачальника
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Скасувати
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
