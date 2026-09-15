"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, FormGroup } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { IconClients, IconPurchaseKg } from "@/components/ui/Icons";
import { SupplierPaletteEditor } from "@/components/catalog/SupplierPaletteEditor";
import { deriveFabricPricing, type FabricPricingGlobals } from "@/lib/fabric-pricing";
import {
  FABRIC_DELIVERY_TYPES,
  deliveryRateUsdPerKg,
  fabricDeliveryTypeLabel,
  normalizeFabricDeliveryType,
  type FabricDeliveryTypeCode,
} from "@/lib/fabric-delivery-types";
import { formatMoneyUah, cn } from "@/lib/utils";
import { swatchForColorLabel } from "@/lib/trim-colors";
import { getSupplierPaletteAction } from "@/server/domains/catalog/actions";

export type MaterialSupplierOfferDraft = {
  key: string;
  isPrimary: boolean;
  supplierName: string;
  deliveryType: FabricDeliveryTypeCode;
  cargoUsdPerKg: string;
  priceKgUsd: string;
  priceKgUsdVat: string;
  priceMeterUahNoVat: string;
  priceMeterUahVat: string;
  priceMeterUahCutVat: string;
  minWholesaleMeters: string;
  wholesaleNote: string;
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
    priceKgUsd: "",
    priceKgUsdVat: "",
    priceMeterUahNoVat: "",
    priceMeterUahVat: "",
    priceMeterUahCutVat: "",
    minWholesaleMeters: "",
    wholesaleNote: "",
    availableColors: "",
    asPrimary,
  };
}

function formFromOffer(row: MaterialSupplierOfferDraft): DraftForm {
  return {
    supplierName: row.supplierName,
    deliveryType: row.deliveryType,
    cargoUsdPerKg: row.cargoUsdPerKg,
    priceKgUsd: row.priceKgUsd,
    priceKgUsdVat: row.priceKgUsdVat,
    priceMeterUahNoVat: row.priceMeterUahNoVat,
    priceMeterUahVat: row.priceMeterUahVat,
    priceMeterUahCutVat: row.priceMeterUahCutVat,
    minWholesaleMeters: row.minWholesaleMeters,
    wholesaleNote: row.wholesaleNote,
    availableColors: row.availableColors,
    asPrimary: row.isPrimary,
  };
}

function newKey() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function MaterialSupplierDraftsEditor({
  offers,
  onChange,
  metersPerKg,
  fabricGlobals,
  knownSuppliers,
  defaultDeliveryType = "CARGO",
  onEditingChange,
}: {
  offers: MaterialSupplierOfferDraft[];
  onChange: (next: MaterialSupplierOfferDraft[]) => void;
  metersPerKg?: number | null;
  fabricGlobals: FabricPricingGlobals;
  knownSuppliers: string[];
  defaultDeliveryType?: FabricDeliveryTypeCode;
  onEditingChange: (editing: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<DraftForm>(() =>
    emptyForm(true, defaultDeliveryType, fabricGlobals),
  );

  const liveGlobals = useMemo<FabricPricingGlobals>(
    () => ({
      ...fabricGlobals,
      fabricCargoUsdPerKg:
        Number(draft.cargoUsdPerKg) >= 0
          ? Number(draft.cargoUsdPerKg)
          : fabricGlobals.fabricCargoUsdPerKg,
    }),
    [fabricGlobals, draft.cargoUsdPerKg],
  );

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
    setDraft(emptyForm(asPrimary || offers.length === 0, defaultDeliveryType, fabricGlobals));
    setEditing("new");
  }

  function openEdit(row: MaterialSupplierOfferDraft) {
    setError(null);
    setDraft(formFromOffer(row));
    setEditing(row.key);
  }

  function applyDeliveryType(code: FabricDeliveryTypeCode) {
    const rate = deliveryRateUsdPerKg(code, fabricGlobals);
    setDraft((prev) => {
      const nextCargo = String(rate);
      const next = { ...prev, deliveryType: code, cargoUsdPerKg: nextCargo };
      if (!prev.priceKgUsd) return next;
      const auto = deriveFabricPricing(
        {
          metersPerKg: metersPerKg ?? null,
          priceKgUsd: Number(prev.priceKgUsd),
          priceKgUsdVat: prev.priceKgUsdVat ? Number(prev.priceKgUsdVat) : null,
        },
        { ...fabricGlobals, fabricCargoUsdPerKg: rate },
      );
      return {
        ...next,
        priceMeterUahNoVat:
          auto.priceMeterUahNoVat != null
            ? String(auto.priceMeterUahNoVat)
            : prev.priceMeterUahNoVat,
        priceMeterUahVat:
          auto.priceMeterUahVat != null ? String(auto.priceMeterUahVat) : prev.priceMeterUahVat,
      };
    });
  }

  function saveDraft() {
    setError(null);
    if (!draft.supplierName.trim()) {
      setError("Вкажіть постачальника.");
      return;
    }
    const cut = draft.priceMeterUahCutVat.trim();
    const threshold = draft.minWholesaleMeters.trim();
    const cutValue = cut ? Number(cut) : 0;
    const hasCut = cutValue > 0;
    if (threshold && !hasCut) {
      setError("Межу гурту можна задати лише разом із ціною відрізу.");
      return;
    }
    if (hasCut && (!threshold || Number(threshold) <= 0)) {
      setError("Якщо є відріз — вкажіть межу гурту (м).");
      return;
    }

    const wantPrimary = draft.asPrimary || offers.length === 0;
    const row: MaterialSupplierOfferDraft = {
      key: editingKey === "new" || editingKey == null ? newKey() : editingKey,
      isPrimary: wantPrimary,
      supplierName: draft.supplierName.trim(),
      deliveryType: draft.deliveryType,
      cargoUsdPerKg: draft.cargoUsdPerKg,
      priceKgUsd: draft.priceKgUsd,
      priceKgUsdVat: draft.priceKgUsdVat,
      priceMeterUahNoVat:
        draft.priceMeterUahNoVat ||
        (derived.priceMeterUahNoVat != null ? String(derived.priceMeterUahNoVat) : ""),
      priceMeterUahVat:
        draft.priceMeterUahVat ||
        (derived.priceMeterUahVat != null ? String(derived.priceMeterUahVat) : ""),
      priceMeterUahCutVat: hasCut ? cut : "",
      minWholesaleMeters: hasCut ? threshold : "",
      wholesaleNote: draft.wholesaleNote,
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
                    {fabricDeliveryTypeLabel(row.deliveryType)}
                    {row.cargoUsdPerKg ? ` · ${row.cargoUsdPerKg} $/кг` : ""}
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

          <FormGroup label="Доставка і закупівля" icon={<IconPurchaseKg size={14} />} columns={3} compact>
            <Select
              label="Тип доставки"
              required
              value={draft.deliveryType}
              onChange={(event) =>
                applyDeliveryType(normalizeFabricDeliveryType(event.target.value))
              }
            >
              {FABRIC_DELIVERY_TYPES.map((code) => (
                <option key={code} value={code}>
                  {fabricDeliveryTypeLabel(code)}
                </option>
              ))}
            </Select>
            <Input
              label="Тариф"
              type="number"
              min={0}
              step="0.01"
              suffix="$/кг"
              value={draft.cargoUsdPerKg}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((prev) => ({ ...prev, cargoUsdPerKg: value }));
                if (draft.priceKgUsd) {
                  const auto = deriveFabricPricing(
                    {
                      metersPerKg: metersPerKg ?? null,
                      priceKgUsd: Number(draft.priceKgUsd),
                      priceKgUsdVat: draft.priceKgUsdVat
                        ? Number(draft.priceKgUsdVat)
                        : null,
                    },
                    {
                      ...liveGlobals,
                      fabricCargoUsdPerKg:
                        Number(value) >= 0 ? Number(value) : liveGlobals.fabricCargoUsdPerKg,
                    },
                  );
                  if (auto.priceMeterUahNoVat != null) {
                    setDraft((prev) => ({
                      ...prev,
                      cargoUsdPerKg: value,
                      priceMeterUahNoVat: String(auto.priceMeterUahNoVat),
                      priceMeterUahVat:
                        auto.priceMeterUahVat != null
                          ? String(auto.priceMeterUahVat)
                          : prev.priceMeterUahVat,
                    }));
                  }
                }
              }}
            />
            <Input
              label="Ціна"
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
                    priceKgUsdVat: draft.priceKgUsdVat ? Number(draft.priceKgUsdVat) : null,
                  },
                  liveGlobals,
                );
                setDraft((prev) => ({
                  ...prev,
                  priceKgUsd: value,
                  priceMeterUahNoVat:
                    auto.priceMeterUahNoVat != null
                      ? String(auto.priceMeterUahNoVat)
                      : prev.priceMeterUahNoVat,
                  priceMeterUahVat:
                    auto.priceMeterUahVat != null
                      ? String(auto.priceMeterUahVat)
                      : prev.priceMeterUahVat,
                }));
              }}
            />
            <Input
              label="Ціна з ПДВ"
              type="number"
              min={0}
              step="0.01"
              suffix="$/кг"
              value={draft.priceKgUsdVat}
              onChange={(event) => {
                const value = event.target.value;
                const auto = deriveFabricPricing(
                  {
                    metersPerKg: metersPerKg ?? null,
                    priceKgUsd: draft.priceKgUsd ? Number(draft.priceKgUsd) : null,
                    priceKgUsdVat: value ? Number(value) : null,
                  },
                  liveGlobals,
                );
                setDraft((prev) => ({
                  ...prev,
                  priceKgUsdVat: value,
                  priceMeterUahVat:
                    auto.priceMeterUahVat != null
                      ? String(auto.priceMeterUahVat)
                      : prev.priceMeterUahVat,
                }));
              }}
            />
            <Input
              label="Гурт без ПДВ"
              type="number"
              min={0}
              step="0.1"
              suffix="₴/м"
              value={draft.priceMeterUahNoVat}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, priceMeterUahNoVat: event.target.value }))
              }
            />
            <Input
              label="Гурт з ПДВ"
              type="number"
              min={0}
              step="0.1"
              suffix="₴/м"
              value={draft.priceMeterUahVat}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, priceMeterUahVat: event.target.value }))
              }
            />
            <Input
              label="Відріз"
              type="number"
              min={0}
              step="0.1"
              suffix="₴/м"
              optional
              value={draft.priceMeterUahCutVat}
              onChange={(event) => {
                const value = event.target.value;
                const hasCut = value.trim() !== "" && Number(value) > 0;
                setDraft((prev) => ({
                  ...prev,
                  priceMeterUahCutVat: value,
                  minWholesaleMeters: hasCut ? prev.minWholesaleMeters : "",
                }));
              }}
              hint="Порожньо = лише гурт"
            />
            {draft.priceMeterUahCutVat.trim() !== "" &&
            Number(draft.priceMeterUahCutVat) > 0 ? (
              <Input
                label="Межа гурту"
                type="number"
                min={0}
                step="0.1"
                suffix="м"
                required
                value={draft.minWholesaleMeters}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, minWholesaleMeters: event.target.value }))
                }
                hint="≥ м у замовленні → гурт"
              />
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
              <p className="type-caption sm:col-span-3 tabular">
                Собівартість: {formatMoneyUah(derived.purchasePrice)}/м
                {draft.priceMeterUahCutVat.trim() &&
                Number(draft.priceMeterUahCutVat) > 0 &&
                draft.minWholesaleMeters
                  ? ` · ≥ ${draft.minWholesaleMeters} м → гурт`
                  : " · лише гурт"}
              </p>
            ) : null}
          </FormGroup>

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
