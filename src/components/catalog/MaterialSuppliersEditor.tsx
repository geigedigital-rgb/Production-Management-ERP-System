"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, FormGroup } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { IconClients, IconPurchaseKg } from "@/components/ui/Icons";
import {
  deleteMaterialSupplierOfferAction,
  listMaterialSupplierOffersAction,
  listSupplierNamesAction,
  setPrimaryMaterialSupplierOfferAction,
  upsertMaterialSupplierOfferAction,
} from "@/server/domains/catalog/actions";
import { deriveFabricPricing, type FabricPricingGlobals } from "@/lib/fabric-pricing";
import { formatMoneyUah } from "@/lib/utils";

type OfferRow = {
  id: string;
  isPrimary: boolean;
  supplierName: string;
  availableColors: string[];
  cargoUsdPerKg: number | null;
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
  cargoUsdPerKg: string;
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

const emptyDraft = (asPrimary: boolean, defaultCargo: number): OfferDraft => ({
  supplierName: "",
  cargoUsdPerKg: String(defaultCargo),
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

function draftFromOffer(row: OfferRow, defaultCargo: number): OfferDraft {
  return {
    supplierName: row.supplierName,
    cargoUsdPerKg: numStr(row.cargoUsdPerKg) || String(defaultCargo),
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

export function MaterialSuppliersEditor({
  materialId,
  metersPerKg,
  fabricGlobals,
  onPrimaryChanged,
}: {
  materialId: string;
  metersPerKg?: number | null;
  fabricGlobals: FabricPricingGlobals;
  onPrimaryChanged?: () => void;
}) {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [usdUahRate, setUsdUahRate] = useState(fabricGlobals.usdUahRate);
  const [defaultCargo, setDefaultCargo] = useState(fabricGlobals.fabricCargoUsdPerKg);
  const [knownSuppliers, setKnownSuppliers] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<OfferDraft>(() =>
    emptyDraft(true, fabricGlobals.fabricCargoUsdPerKg),
  );

  function reload() {
    startTransition(async () => {
      const [result, names] = await Promise.all([
        listMaterialSupplierOffersAction(materialId),
        listSupplierNamesAction().catch(() => [] as string[]),
      ]);
      if (!result.ok) return;
      setOffers(result.offers);
      setUsdUahRate(result.usdUahRate);
      setDefaultCargo(result.defaultCargoUsdPerKg);
      setKnownSuppliers(names);
      const primary = result.offers.find((row) => row.isPrimary);
      if (primary && editingId === null) {
        // keep closed until user opens
      }
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId]);

  const liveGlobals = useMemo<FabricPricingGlobals>(
    () => ({
      ...fabricGlobals,
      usdUahRate,
      fabricCargoUsdPerKg:
        Number(draft.cargoUsdPerKg) >= 0 ? Number(draft.cargoUsdPerKg) : defaultCargo,
    }),
    [fabricGlobals, usdUahRate, draft.cargoUsdPerKg, defaultCargo],
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

  function openEdit(row: OfferRow) {
    setError(null);
    setEditingId(row.id);
    setDraft(draftFromOffer(row, defaultCargo));
  }

  function openNew(asPrimary: boolean) {
    setError(null);
    setEditingId("new");
    setDraft(emptyDraft(asPrimary || offers.length === 0, defaultCargo));
  }

  function saveDraft() {
    setError(null);
    if (!draft.supplierName.trim()) {
      setError("Вкажіть постачальника.");
      return;
    }
    const data = new FormData();
    data.set("materialId", materialId);
    data.set("supplierNameUk", draft.supplierName.trim());
    data.set("isPrimary", draft.asPrimary || offers.length === 0 ? "1" : "0");
    if (draft.cargoUsdPerKg) data.set("cargoUsdPerKg", draft.cargoUsdPerKg);
    if (draft.priceKgUsd) data.set("priceKgUsd", draft.priceKgUsd);
    if (draft.priceKgUsdVat) data.set("priceKgUsdVat", draft.priceKgUsdVat);
    if (draft.priceMeterUahNoVat) data.set("priceMeterUahNoVat", draft.priceMeterUahNoVat);
    else if (derived.priceMeterUahNoVat != null) {
      data.set("priceMeterUahNoVat", String(derived.priceMeterUahNoVat));
    }
    if (draft.priceMeterUahVat) data.set("priceMeterUahVat", draft.priceMeterUahVat);
    else if (derived.priceMeterUahVat != null) {
      data.set("priceMeterUahVat", String(derived.priceMeterUahVat));
    }
    if (draft.priceMeterUahCutVat) data.set("priceMeterUahCutVat", draft.priceMeterUahCutVat);
    if (draft.minWholesaleMeters) data.set("minWholesaleMeters", draft.minWholesaleMeters);
    if (draft.wholesaleNote) data.set("wholesaleNote", draft.wholesaleNote);
    data.set("availableColors", draft.availableColors);
    if (metersPerKg != null) data.set("metersPerKg", String(metersPerKg));

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
    <div className="space-y-3 rounded-[var(--radius-control)] border border-[var(--color-border)] p-3">
      <div>
        <h4 className="type-subsection inline-flex items-center gap-1.5">
          <IconClients size={14} />
          Постачальники та закупівля
        </h4>
        <p className="type-caption mt-0.5">
          Собівартість у каталозі = умови <strong>основного</strong> постачальника. У кожного
          постачальника — своя палітра кольорів для продукту та замовлення.
        </p>
        <p className="type-caption mt-1 tabular">
          Курс ₴/$: {usdUahRate} · з налаштувань ціноутворення (не змінюється тут)
        </p>
      </div>

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
                    {formatMoneyUah(row.purchaseHint)}/м
                  </span>
                ) : null}
                {(row.availableColors?.length ?? 0) > 0 ? (
                  <span className="type-caption ml-2 block sm:inline">
                    кольори: {row.availableColors.slice(0, 4).join(", ")}
                    {row.availableColors.length > 4 ? "…" : ""}
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
                  setDraft((prev) => ({ ...prev, supplierName: prev.supplierName || "" }));
                  return;
                }
                setDraft((prev) => ({ ...prev, supplierName: value }));
              }}
            >
              <option value="">Оберіть…</option>
              {knownSuppliers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="__custom__">Інший / новий…</option>
            </Select>
            <Input
              label="Або введіть назву"
              value={draft.supplierName}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, supplierName: event.target.value }))
              }
              placeholder="Зейджан"
            />
          </FormGroup>

          <FormGroup label="Палітра кольорів" columns={1} compact>
            <Input
              label="Кольори цього постачальника"
              value={draft.availableColors}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, availableColors: event.target.value }))
              }
              placeholder="Чорний, Білий, Navy"
              hint="Через кому. У продукті й замовленні кольори зміняться після вибору цього постачальника."
            />
          </FormGroup>

          <FormGroup label="Закупівля" icon={<IconPurchaseKg size={14} />} columns={3} compact>
            <Input
              label="Карго $/кг"
              type="number"
              min={0}
              step="0.01"
              value={draft.cargoUsdPerKg}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((prev) => ({ ...prev, cargoUsdPerKg: value }));
                if (draft.priceKgUsd) {
                  const auto = deriveFabricPricing(
                    {
                      metersPerKg: metersPerKg ?? null,
                      priceKgUsd: Number(draft.priceKgUsd),
                      priceKgUsdVat: draft.priceKgUsdVat ? Number(draft.priceKgUsdVat) : null,
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
              hint={`База компанії: ${defaultCargo}`}
            />
            <Input
              label="$ / кг"
              type="number"
              min={0}
              step="0.01"
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
              label="$ / кг з ПДВ"
              type="number"
              min={0}
              step="0.01"
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
              label="₴/м без ПДВ (гурт)"
              type="number"
              min={0}
              step="0.1"
              value={draft.priceMeterUahNoVat}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, priceMeterUahNoVat: event.target.value }))
              }
              hint="Ціна після межі гурту · авто з $/кг"
            />
            <Input
              label="₴/м з ПДВ (гурт)"
              type="number"
              min={0}
              step="0.1"
              value={draft.priceMeterUahVat}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, priceMeterUahVat: event.target.value }))
              }
              hint="Ціна після межі гурту · з ПДВ"
            />
            <Input
              label="₴/м відріз"
              type="number"
              min={0}
              step="0.1"
              value={draft.priceMeterUahCutVat}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, priceMeterUahCutVat: event.target.value }))
              }
              hint="До межі гурту / малі тиражі"
            />
            <Input
              label="Межа витрати, м"
              type="number"
              min={0}
              step="0.1"
              value={draft.minWholesaleMeters}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, minWholesaleMeters: event.target.value }))
              }
              hint={
                draft.priceMeterUahCutVat
                  ? "≥ цієї витрати в замовленні → гурт"
                  : "Працює лише якщо задана ціна відрізу"
              }
            />
            <Input
              className="sm:col-span-2"
              label="Примітка гурту"
              value={draft.wholesaleNote}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, wholesaleNote: event.target.value }))
              }
            />
            {derived.purchasePrice > 0 ? (
              <p className="type-caption sm:col-span-3 tabular">
                Активна собівартість з цих умов: {formatMoneyUah(derived.purchasePrice)}/м
                {derived.pricingMode === "cut" ? " (відріз)" : ""}
                {draft.priceMeterUahCutVat && draft.minWholesaleMeters
                  ? ` · ≥ ${draft.minWholesaleMeters} м → гурт`
                  : !draft.priceMeterUahCutVat
                    ? " · лише гурт (межа не застосовується)"
                    : ""}
              </p>
            ) : null}
          </FormGroup>

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
