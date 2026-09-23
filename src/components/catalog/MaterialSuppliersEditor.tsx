"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, FormGroup } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { IconClients, IconPurchaseKg } from "@/components/ui/Icons";
import {
  deleteMaterialSupplierOfferAction,
  getSupplierPaletteAction,
  listMaterialSupplierOffersAction,
  listSupplierNamesAction,
  setPrimaryMaterialSupplierOfferAction,
  upsertMaterialSupplierOfferAction,
} from "@/server/domains/catalog/actions";
import { deriveFabricPricing, type FabricPricingGlobals } from "@/lib/fabric-pricing";
import {
  deliveryRateUsdPerKg,
  normalizeFabricDeliveryType,
  type FabricDeliveryTypeCode,
} from "@/lib/fabric-delivery-types";
import {
  configuredSupplierDeliveryOptions,
  resolveSupplierDeliveryRate,
} from "@/lib/supplier-delivery-rates";
import {
  deriveTrimUnitPriceFromSupplier,
  hasTrimPackQuote,
  resolveTrimPackDeliveryUah,
  trimConfiguredDeliveryOptions,
} from "@/lib/trim-pack-pricing";
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
import { formatMoneyUah, cn } from "@/lib/utils";
import { swatchForColorLabel } from "@/lib/trim-colors";

type OfferRow = {
  id: string;
  isPrimary: boolean;
  supplierName: string;
  availableColors: string[];
  deliveryType: FabricDeliveryTypeCode;
  cargoUsdPerKg: number | null;
  npStandardUsdPerKg: number | null;
  npVolumeUsdPerKg: number | null;
  purchasePackPrice: number | null;
  packDeliveryCostUah: number | null;
  priceKgUsd: number | null;
  priceKgUsdVat: number | null;
  priceMeterUahNoVat: number | null;
  priceMeterUahVat: number | null;
  priceMeterUahCutVat: number | null;
  minWholesaleMeters: number | null;
  wholesaleNote: string | null;
  purchaseHint: number | null;
};

type OfferDraft = {
  supplierName: string;
  deliveryType: FabricDeliveryTypeCode;
  cargoUsdPerKg: string;
  npStandardUsdPerKg: string;
  npVolumeUsdPerKg: string;
  purchasePackPrice: string;
  packDeliveryCostUah: string;
  priceKgUsd: string;
  priceKgUsdVat: string;
  priceMeterUahNoVat: string;
  priceMeterUahVat: string;
  priceMeterUahCutVat: string;
  minWholesaleMeters: string;
  wholesaleNote: string;
  availableColors: string;
  asPrimary: boolean;
};

const emptyDraft = (
  asPrimary: boolean,
  globals: FabricPricingGlobals,
): OfferDraft => ({
  supplierName: "",
  deliveryType: "CARGO",
  cargoUsdPerKg: String(deliveryRateUsdPerKg("CARGO", globals)),
  npStandardUsdPerKg: "",
  npVolumeUsdPerKg: "",
  purchasePackPrice: "",
  packDeliveryCostUah: "",
  priceKgUsd: "",
  priceKgUsdVat: "",
  priceMeterUahNoVat: "",
  priceMeterUahVat: "",
  priceMeterUahCutVat: "",
  minWholesaleMeters: "",
  wholesaleNote: "",
  availableColors: "",
  asPrimary,
});

function numStr(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "";
  return String(value);
}

function draftFromOffer(row: OfferRow, pricingKind: "fabric" | "unit" = "fabric"): OfferDraft {
  const hasTypedRates =
    row.cargoUsdPerKg != null ||
    row.npStandardUsdPerKg != null ||
    row.npVolumeUsdPerKg != null;
  return {
    supplierName: row.supplierName,
    deliveryType: normalizeFabricDeliveryType(row.deliveryType),
    cargoUsdPerKg:
      numStr(row.cargoUsdPerKg) ||
      // Trim only: legacy pack delivery in UAH must not leak into fabric $/кг.
      (pricingKind === "unit" && !hasTypedRates ? numStr(row.packDeliveryCostUah) : ""),
    npStandardUsdPerKg: numStr(row.npStandardUsdPerKg),
    npVolumeUsdPerKg: numStr(row.npVolumeUsdPerKg),
    purchasePackPrice: numStr(row.purchasePackPrice),
    packDeliveryCostUah: numStr(row.packDeliveryCostUah),
    priceKgUsd: numStr(row.priceKgUsd),
    priceKgUsdVat: numStr(row.priceKgUsdVat),
    priceMeterUahNoVat: numStr(row.priceMeterUahNoVat),
    priceMeterUahVat: numStr(row.priceMeterUahVat),
    priceMeterUahCutVat: numStr(row.priceMeterUahCutVat),
    minWholesaleMeters: numStr(row.minWholesaleMeters),
    wholesaleNote: row.wholesaleNote ?? "",
    availableColors: (row.availableColors ?? []).join(", "),
    asPrimary: row.isPrimary,
  };
}

function trimDraftRates(draft: OfferDraft) {
  return {
    deliveryType: draft.deliveryType,
    cargoUsdPerKg: draft.cargoUsdPerKg ? Number(draft.cargoUsdPerKg) : null,
    npStandardUsdPerKg: draft.npStandardUsdPerKg
      ? Number(draft.npStandardUsdPerKg)
      : null,
    npVolumeUsdPerKg: draft.npVolumeUsdPerKg ? Number(draft.npVolumeUsdPerKg) : null,
  };
}

export function MaterialSuppliersEditor({
  materialId,
  metersPerKg,
  unitsPerPack = null,
  fabricGlobals,
  onPrimaryChanged,
  pricingKind = "fabric",
  embedded = false,
}: {
  materialId: string;
  metersPerKg?: number | null;
  /** Trim: шт в упаковці з картки матеріалу. */
  unitsPerPack?: number | null;
  fabricGlobals: FabricPricingGlobals;
  onPrimaryChanged?: () => void;
  pricingKind?: "fabric" | "unit";
  /** Inside edit-panel tab: hide redundant title / captions. */
  embedded?: boolean;
}) {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [usdUahRate, setUsdUahRate] = useState(fabricGlobals.usdUahRate);
  const [usdUahRateInput, setUsdUahRateInput] = useState(String(fabricGlobals.usdUahRate));
  const [knownSuppliers, setKnownSuppliers] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<OfferDraft>(() => emptyDraft(true, fabricGlobals));
  const [quoteMode, setQuoteMode] = useState<FabricQuoteMode>("kg");
  const [tierMode, setTierMode] = useState<FabricTierMode>("single");
  const [deliveryUiMode, setDeliveryUiMode] = useState<FabricDeliveryUiMode>("kg");
  const [unitQuoteMode, setUnitQuoteMode] = useState<UnitQuoteMode>("each");
  const [unitDeliveryUiMode, setUnitDeliveryUiMode] = useState<UnitDeliveryUiMode>("pack");

  function applyModesFromDraft(next: OfferDraft) {
    setQuoteMode(inferFabricQuoteMode(next));
    setTierMode(inferFabricTierMode(next));
    setDeliveryUiMode(inferFabricDeliveryUiMode(next));
    setUnitQuoteMode(inferUnitQuoteMode(next));
    setUnitDeliveryUiMode(inferUnitDeliveryUiMode(next));
  }

  function reload() {
    startTransition(async () => {
      const [result, names] = await Promise.all([
        listMaterialSupplierOffersAction(materialId),
        listSupplierNamesAction().catch(() => [] as string[]),
      ]);
      if (!result.ok) return;
      setOffers(result.offers as OfferRow[]);
      setUsdUahRate(result.usdUahRate);
      setUsdUahRateInput(String(result.usdUahRate));
      setKnownSuppliers(names);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId]);

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
      usdUahRate,
      fabricCargoUsdPerKg: resolved.rateUsdPerKg,
    };
  }, [fabricGlobals, usdUahRate, draft]);

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

  const hasCutPrice =
    draft.priceMeterUahCutVat.trim() !== "" && Number(draft.priceMeterUahCutVat) > 0;

  function openEdit(row: OfferRow) {
    setError(null);
    setEditingId(row.id);
    const next = draftFromOffer(row, pricingKind);
    if (
      pricingKind === "fabric" &&
      !next.cargoUsdPerKg.trim() &&
      !next.npStandardUsdPerKg.trim() &&
      !next.npVolumeUsdPerKg.trim()
    ) {
      next.cargoUsdPerKg = String(deliveryRateUsdPerKg("CARGO", fabricGlobals));
    }
    setDraft(next);
    applyModesFromDraft(next);
  }

  function openNew(asPrimary: boolean) {
    setError(null);
    setEditingId("new");
    const next = emptyDraft(asPrimary || offers.length === 0, fabricGlobals);
    if (pricingKind === "unit") {
      next.cargoUsdPerKg = "";
      next.npStandardUsdPerKg = "";
      next.npVolumeUsdPerKg = "";
      next.packDeliveryCostUah = "";
    }
    setDraft(next);
    if (pricingKind === "fabric") {
      // Ensure $/кг defaults when opening delivery (never UAH pack amounts).
      if (!next.cargoUsdPerKg.trim()) {
        next.cargoUsdPerKg = String(deliveryRateUsdPerKg("CARGO", fabricGlobals));
      }
      setQuoteMode("meter");
      setTierMode("single");
      setDeliveryUiMode("kg");
    } else {
      applyModesFromDraft(next);
    }
  }

  function saveDraft() {
    setError(null);
    if (!draft.supplierName.trim()) {
      setError("Вкажіть постачальника.");
      return;
    }
    const cut = draft.priceMeterUahCutVat.trim();
    const threshold = draft.minWholesaleMeters.trim();
    const hasCut = cut !== "" && Number(cut) > 0;
    if (pricingKind === "unit") {
      const rates = trimDraftRates(draft);
      const typed = resolveTrimPackDeliveryUah(rates);
      const packQuote = {
        unitsPerPack,
        purchasePackPrice: draft.purchasePackPrice
          ? Number(draft.purchasePackPrice)
          : null,
        packDeliveryCostUah: typed?.rateUah ?? null,
      };
      const fromPack = hasTrimPackQuote(packQuote)
        ? deriveTrimUnitPriceFromSupplier({
            unitsPerPack,
            purchasePackPrice: packQuote.purchasePackPrice,
            deliveryRates: rates,
            fallbackUnitPrice: 0,
          })
        : null;
      if (fromPack == null && (!draft.priceMeterUahNoVat.trim() || !(Number(draft.priceMeterUahNoVat) >= 0))) {
        setError("Вкажіть ціну упаковки (і шт в упаковці на матеріалі) або ціну за 1 шт.");
        return;
      }
    } else if (tierMode === "tier") {
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
    const data = new FormData();
    data.set("materialId", materialId);
    data.set("supplierNameUk", draft.supplierName.trim());
    data.set("isPrimary", draft.asPrimary || offers.length === 0 ? "1" : "0");
    data.set("deliveryType", draft.deliveryType);
    const saveDelivery =
      (pricingKind === "unit" && unitDeliveryUiMode === "pack") ||
      (pricingKind === "fabric" && deliveryUiMode === "kg");
    if (saveDelivery && draft.cargoUsdPerKg) data.set("cargoUsdPerKg", draft.cargoUsdPerKg);
    else data.set("cargoUsdPerKg", "");
    if (saveDelivery && draft.npStandardUsdPerKg) {
      data.set("npStandardUsdPerKg", draft.npStandardUsdPerKg);
    } else data.set("npStandardUsdPerKg", "");
    if (saveDelivery && draft.npVolumeUsdPerKg) {
      data.set("npVolumeUsdPerKg", draft.npVolumeUsdPerKg);
    } else data.set("npVolumeUsdPerKg", "");
    if (pricingKind === "unit") {
      if (unitQuoteMode === "pack" && draft.purchasePackPrice) {
        data.set("purchasePackPrice", draft.purchasePackPrice);
      } else {
        data.set("purchasePackPrice", "");
      }
      const rates = unitDeliveryUiMode === "pack" ? trimDraftRates(draft) : {
        deliveryType: draft.deliveryType,
        cargoUsdPerKg: null as number | null,
        npStandardUsdPerKg: null as number | null,
        npVolumeUsdPerKg: null as number | null,
      };
      const typed = resolveTrimPackDeliveryUah(rates);
      if (typed) data.set("packDeliveryCostUah", String(typed.rateUah));
      else data.set("packDeliveryCostUah", "");
      const unitPrice = deriveTrimUnitPriceFromSupplier({
        unitsPerPack,
        purchasePackPrice:
          unitQuoteMode === "pack" && draft.purchasePackPrice
            ? Number(draft.purchasePackPrice)
            : null,
        deliveryRates: rates,
        fallbackUnitPrice: draft.priceMeterUahNoVat
          ? Number(draft.priceMeterUahNoVat)
          : 0,
      });
      if (
        hasTrimPackQuote({
          unitsPerPack,
          purchasePackPrice:
            unitQuoteMode === "pack" && draft.purchasePackPrice
              ? Number(draft.purchasePackPrice)
              : null,
          packDeliveryCostUah: typed?.rateUah ?? null,
        }) ||
        draft.priceMeterUahNoVat
      ) {
        data.set("priceMeterUahNoVat", String(unitPrice));
      }
    }
    if (pricingKind === "fabric" && quoteMode === "kg" && draft.priceKgUsd) {
      data.set("priceKgUsd", draft.priceKgUsd);
    } else if (pricingKind === "fabric") {
      data.set("priceKgUsd", "");
    }
    data.set("priceKgUsdVat", draft.priceKgUsdVat || "");
    if (pricingKind === "fabric") {
      if (draft.priceMeterUahNoVat) data.set("priceMeterUahNoVat", draft.priceMeterUahNoVat);
      else if (derived.priceMeterUahNoVat != null) {
        data.set("priceMeterUahNoVat", String(derived.priceMeterUahNoVat));
      }
    }
    data.set("priceMeterUahVat", draft.priceMeterUahVat || "");
    if (pricingKind === "fabric" && tierMode === "tier" && hasCut) {
      data.set("priceMeterUahCutVat", cut);
    } else {
      data.set("priceMeterUahCutVat", "");
    }
    if (pricingKind === "fabric" && tierMode === "tier" && threshold && Number(threshold) > 0) {
      data.set("minWholesaleMeters", threshold);
    } else {
      data.set("minWholesaleMeters", "");
    }
    if (draft.wholesaleNote) data.set("wholesaleNote", draft.wholesaleNote);
    data.set("availableColors", draft.availableColors);
    if (metersPerKg != null) data.set("metersPerKg", String(metersPerKg));
    if (pricingKind === "fabric" && usdUahRate > 0) {
      data.set("usdUahRate", String(usdUahRate));
    }

    startTransition(async () => {
      const result = await upsertMaterialSupplierOfferAction(data);
      if (!result.ok) {
        setError("Не вдалося зберегти умови постачальника.");
        return;
      }
      const wasPrimary = draft.asPrimary || offers.length === 0;
      setEditingId(null);
      reload();
      if (wasPrimary) onPrimaryChanged?.();
    });
  }

  function makePrimary(id: string) {
    setError(null);
    const data = new FormData();
    data.set("id", id);
    startTransition(async () => {
      const result = await setPrimaryMaterialSupplierOfferAction(data);
      if (!result.ok) {
        setError("Не вдалося призначити основного постачальника.");
        return;
      }
      setEditingId(null);
      reload();
      onPrimaryChanged?.();
    });
  }

  function removeOffer(id: string) {
    setError(null);
    const data = new FormData();
    data.set("id", id);
    startTransition(async () => {
      const result = await deleteMaterialSupplierOfferAction(data);
      if (!result.ok) {
        setError("Основну пропозицію не можна видалити — спочатку зробіть іншу основною.");
        return;
      }
      if (editingId === id) setEditingId(null);
      reload();
    });
  }

  return (
    <div
      className={
        embedded
          ? "space-y-3"
          : "space-y-3 rounded-[var(--radius-control)] border border-[var(--color-border)] p-3"
      }
    >
      {!embedded ? (
        <div>
          <h4 className="type-subsection inline-flex items-center gap-1.5">
            <IconClients size={14} />
            Постачальники та закупівля
          </h4>
        </div>
      ) : null}

      {pricingKind === "unit" && !(unitsPerPack != null && unitsPerPack > 0) ? (
        <p className="type-caption text-[var(--color-warning-text)]">
          Спочатку збережіть «Шт в упаковці» в картці матеріалу.
        </p>
      ) : null}

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <ul className="space-y-1.5">
        {offers.length === 0 ? (
          <li className="type-caption">
            Ще немає пропозицій — додайте основного постачальника з цінами нижче.
          </li>
        ) : (
          offers.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] bg-[var(--color-surface-subtle)] px-2.5 py-1.5 text-[13px]"
            >
              <span className="min-w-0">
                <span className="font-medium">{row.supplierName}</span>
                {row.isPrimary ? (
                  <span className="ml-2 rounded-[4px] bg-[var(--color-tint-sage)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-primary-800)]">
                    основний
                  </span>
                ) : (
                  <span className="type-caption ml-2">альтернатива</span>
                )}
                {row.purchaseHint != null ? (
                  <span className="type-caption ml-2 tabular">
                    {formatMoneyUah(row.purchaseHint)}
                    {pricingKind === "fabric" ? "/м" : ""}
                  </span>
                ) : null}
                {pricingKind === "fabric"
                  ? configuredSupplierDeliveryOptions({
                      deliveryType: row.deliveryType,
                      cargoUsdPerKg: row.cargoUsdPerKg,
                      npStandardUsdPerKg: row.npStandardUsdPerKg,
                      npVolumeUsdPerKg: row.npVolumeUsdPerKg,
                    }).map((opt) => (
                      <span key={opt.type} className="type-caption ml-2 tabular">
                        {opt.label} · {opt.rateUsdPerKg} $/кг
                      </span>
                    ))
                  : trimConfiguredDeliveryOptions({
                      deliveryType: row.deliveryType,
                      cargoUsdPerKg: row.cargoUsdPerKg,
                      npStandardUsdPerKg: row.npStandardUsdPerKg,
                      npVolumeUsdPerKg: row.npVolumeUsdPerKg,
                    }).map((opt) => (
                      <span key={opt.type} className="type-caption ml-2 tabular">
                        {opt.label} · {opt.rateUah} ₴/уп.
                      </span>
                    ))}
                {(row.availableColors?.length ?? 0) > 0 ? (
                  <span className="type-caption ml-2 inline-flex flex-wrap items-center gap-1">
                    {row.availableColors.slice(0, 6).map((label) => {
                      const swatch = swatchForColorLabel(label);
                      return (
                        <span
                          key={label}
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface)] px-1.5 py-0.5"
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
                          <span className="text-[11px]">{label}</span>
                        </span>
                      );
                    })}
                    {row.availableColors.length > 6 ? (
                      <span className="text-[11px]">+{row.availableColors.length - 6}</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="type-caption ml-2 text-[var(--color-warning-text)]">
                    без палітри
                  </span>
                )}
              </span>
              <span className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => openEdit(row)}
                >
                  Умови
                </Button>
                {!row.isPrimary ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => makePrimary(row.id)}
                    >
                      Зробити основним
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => removeOffer(row.id)}
                    >
                      Прибрати
                    </Button>
                  </>
                ) : null}
              </span>
            </li>
          ))
        )}
      </ul>

      {editingId != null ? (
        <div className="space-y-3 border-t border-[var(--color-divider)] pt-3">
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
            {editingId === "new"
              ? draft.asPrimary || offers.length === 0
                ? "Новий основний постачальник"
                : "Нова альтернатива"
              : draft.asPrimary
                ? "Умови основного (→ собівартість каталогу)"
                : "Умови альтернативи"}
          </p>

          <FormGroup label="Постачальник" icon={<IconClients size={14} />} columns={2} compact>
            <Select
              className="sm:col-span-2"
              label="Назва"
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
                if (editingId === "new") {
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
                }
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
                value={draft.supplierName}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, supplierName: event.target.value }))
                }
                placeholder="Зейджан"
                autoFocus
              />
            ) : null}
          </FormGroup>

          <FormGroup label="Палітра кольорів" columns={1} compact>
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
                      : "Спочатку «Шт в упаковці» на матеріалі"
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
                      resolveTrimPackDeliveryUah(trimDraftRates(draft))?.rateUah ?? null,
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
                      resolveTrimPackDeliveryUah(trimDraftRates(draft))?.rateUah ?? null,
                  })
                    ? String(
                        deriveTrimUnitPriceFromSupplier({
                          unitsPerPack,
                          purchasePackPrice: Number(draft.purchasePackPrice),
                          deliveryRates: trimDraftRates(draft),
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
                Активна собівартість: {formatMoneyUah(derived.purchasePrice)}/м
                {derived.pricingMode === "cut" ? " (до опт)" : ""}
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
                usdUahRate={usdUahRateInput}
                onUsdUahRateChange={(value) => {
                  setUsdUahRateInput(value);
                  const n = Number(String(value).replace(",", "."));
                  if (Number.isFinite(n) && n > 0) setUsdUahRate(n);
                }}
                draft={draft}
                onChange={(next) => {
                  setDraft((prev) => {
                    const merged = { ...prev, ...next };
                    if (!merged.priceKgUsd || merged.deliveryType !== "CARGO") return merged;
                    const cargo = merged.cargoUsdPerKg ? Number(merged.cargoUsdPerKg) : null;
                    const auto = deriveFabricPricing(
                      {
                        metersPerKg: metersPerKg ?? null,
                        priceKgUsd: Number(merged.priceKgUsd),
                        priceKgUsdVat: merged.priceKgUsdVat
                          ? Number(merged.priceKgUsdVat)
                          : null,
                      },
                      {
                        ...liveGlobals,
                        fabricCargoUsdPerKg:
                          cargo != null && cargo >= 0 ? cargo : liveGlobals.fabricCargoUsdPerKg,
                      },
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
                }}
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
            <Button type="button" size="sm" disabled={pending} onClick={saveDraft}>
              {pending ? "Збереження…" : "Зберегти умови"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setEditingId(null)}
            >
              Скасувати
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => openNew(offers.length === 0)}
          >
            {offers.length === 0 ? "Додати основного постачальника" : "Додати альтернативу"}
          </Button>
        </div>
      )}
    </div>
  );
}
