"use client";

import { useId, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select, FormGroup } from "@/components/ui/Field";
import { CreatePanel } from "@/components/ui/CreatePanel";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { SidePanel } from "@/components/ui/Overlay";
import { SidePanelSkeleton } from "@/components/ui/Skeleton";
import {
  IconCalc,
  IconFabricKind,
  IconFormTitle,
  IconMeterPrice,
  IconNote,
  IconParams,
  IconPurchaseKg,
  IconSpec,
} from "@/components/ui/Icons";
import {
  createMaterialAction,
  getMaterialForEditAction,
  listCompositionNamesAction,
  listSupplierNamesAction,
  updateMaterialAction,
} from "@/server/domains/catalog/actions";
import { MaterialSuppliersEditor } from "@/components/catalog/MaterialSuppliersEditor";
import { FABRIC_COMPOSITIONS, COMPOSITION_OTHER } from "@/lib/fabric-compositions";
import { FABRIC_KINDS, FABRIC_KIND_OTHER, normalizeFabricKind } from "@/lib/fabric-kinds";
import {
  deriveFabricPricing,
  linearMeterPriceFromSquareMeter,
  metersPerKgFromDensityWidth,
  resolveFabricUnitMode,
  squareMeterPriceFromLinearMeter,
  DEFAULT_FABRIC_PRICING_GLOBALS,
  type FabricPricingGlobals,
  type FabricUnitMode,
} from "@/lib/fabric-pricing";
import {
  FABRIC_DELIVERY_TYPES,
  deliveryRateUsdPerKg,
  fabricDeliveryTypeLabel,
  normalizeFabricDeliveryType,
  type FabricDeliveryTypeCode,
} from "@/lib/fabric-delivery-types";
import { formatMoneyUah } from "@/lib/utils";

type UnitOption = { id: string; label: string; code?: string };

function resolveUnitCode(unit: UnitOption | undefined): string {
  if (!unit) return "m";
  if (unit.code?.trim()) return unit.code.trim().toLowerCase();
  const fromLabel = unit.label.match(/\(([a-z0-9]+)\)\s*$/i);
  if (fromLabel) return fromLabel[1].toLowerCase();
  const label = unit.label.toLowerCase();
  if (label.includes("кг") || label.includes("kg")) return "kg";
  if (label.includes("м²") || label.includes("m2") || label.includes("м2")) return "m2";
  if (label.includes("боб") || label.includes("cone")) return "cone";
  if (label.includes("шт") || label.includes("pcs")) return "pcs";
  return "m";
}

function fabricUnitHint(mode: FabricUnitMode): string {
  switch (mode) {
    case "kg":
      return "Купівля в кг → обовʼязкові щільність і ширина; м.п./кг рахується автоматично. У складі виробу витрата все одно в м.п.";
    case "m2":
      return "Купівля в м² → ₴/м.п. = ₴/м² × ширина(м). У складі виробу норма лишається в метрах погонних.";
    case "pcs":
      return "Од. виміру «шт»: собівартість і норма в складі — у штуках. Доставка/м.п. для тканин не застосовуються.";
    case "cone":
      return "Од. виміру «бобіна»: собівартість і норма в складі — за бобіну. Для рулонної тканини краще м.п. або кг.";
    default:
      return "Купівля в м.п. · собівартість з ₴/м. м.п./кг потрібне лише для логістики (кг) і авто метражу рулону.";
  }
}

export type MaterialFormDefaults = {
  id: string;
  nameUk: string;
  type: string;
  unitOfMeasureId: string;
  purchasePrice: number;
  defaultWastePercent: number;
  supplierCode: string;
  colorOrAttribute: string;
  note: string;
  densityGsm?: string;
  composition?: string;
  metersPerKg?: number | null;
  priceKgUsd?: number | null;
  priceKgUsdCargo?: number | null;
  priceKgUsdVat?: number | null;
  priceMeterUahNoVat?: number | null;
  priceMeterUahVat?: number | null;
  priceMeterUahCutVat?: number | null;
  fabricKindUk?: string;
  widthCm?: string;
  wholesaleNote?: string;
  rollWeightKg?: number | null;
  metersPerRoll?: number | null;
  minWholesaleMeters?: number | null;
  costVatOverride?: "NET" | "GROSS" | null;
  deliveryType?: FabricDeliveryTypeCode | null;
};

function numStr(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "";
  return String(value);
}

function resolveCompositionSelect(composition: string | undefined, known: string[]) {
  const trimmed = composition?.replace(/\s+/g, " ").trim() ?? "";
  if (!trimmed) return { select: "", other: "" };
  const match = known.find((item) => item.toLowerCase() === trimmed.toLowerCase());
  if (match) return { select: match, other: "" };
  return { select: COMPOSITION_OTHER, other: trimmed };
}

function resolveFabricKindSelect(kind: string | undefined) {
  const normalized = normalizeFabricKind(kind) ?? "";
  if (!normalized) return { select: "", other: "" };
  if ((FABRIC_KINDS as readonly string[]).includes(normalized)) {
    return { select: normalized, other: "" };
  }
  return { select: FABRIC_KIND_OTHER, other: normalized };
}

const SUPPLIER_OTHER = "__other__";

function resolveSupplierSelect(supplier: string | undefined, known: string[]) {
  const trimmed = supplier?.replace(/\s+/g, " ").trim() ?? "";
  if (!trimmed) return { select: "", other: "" };
  if (known.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
    const match = known.find((item) => item.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
    return { select: match, other: "" };
  }
  return { select: SUPPLIER_OTHER, other: trimmed };
}

function MaterialFields({
  units,
  defaults,
  fabricGlobals,
  suppliers = [],
  managePricingSeparately = false,
}: {
  units: UnitOption[];
  defaults?: MaterialFormDefaults;
  fabricGlobals: FabricPricingGlobals;
  suppliers?: string[];
  /** Edit fabric: prices live in MaterialSuppliersEditor, not in this form. */
  managePricingSeparately?: boolean;
}) {
  const initialKind = resolveFabricKindSelect(defaults?.fabricKindUk);
  const [catalogCompositions, setCatalogCompositions] = useState<string[]>([
    ...FABRIC_COMPOSITIONS,
  ]);
  const [catalogSuppliers, setCatalogSuppliers] = useState(suppliers);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([listSupplierNamesAction(), listCompositionNamesAction()])
      .then(([supplierNames, compositionNames]) => {
        if (cancelled) return;
        setCatalogSuppliers((prev) => {
          const set = new Set([...prev, ...suppliers, ...supplierNames]);
          return [...set].sort((a, b) => a.localeCompare(b, "uk"));
        });
        setCatalogCompositions(() => {
          const set = new Set<string>([...FABRIC_COMPOSITIONS, ...compositionNames]);
          const current = defaults?.composition?.replace(/\s+/g, " ").trim();
          if (current) set.add(current);
          return [...set].sort((a, b) => a.localeCompare(b, "uk"));
        });
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogSuppliers(suppliers);
          setCatalogCompositions([...FABRIC_COMPOSITIONS]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [suppliers, defaults?.composition]);

  const knownSuppliers = useMemo(() => {
    const set = new Set(
      catalogSuppliers.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean),
    );
    const current = defaults?.supplierCode?.replace(/\s+/g, " ").trim();
    if (current) set.add(current);
    return [...set].sort((a, b) => a.localeCompare(b, "uk"));
  }, [catalogSuppliers, defaults?.supplierCode]);

  const knownCompositions = useMemo(() => {
    const set = new Set(
      catalogCompositions.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean),
    );
    const current = defaults?.composition?.replace(/\s+/g, " ").trim();
    if (current) set.add(current);
    return [...set].sort((a, b) => a.localeCompare(b, "uk"));
  }, [catalogCompositions, defaults?.composition]);

  const initialSupplier = resolveSupplierSelect(defaults?.supplierCode, knownSuppliers);
  const [type, setType] = useState(defaults?.type ?? "FABRIC");
  const [unitOfMeasureId, setUnitOfMeasureId] = useState(
    defaults?.unitOfMeasureId ?? units[0]?.id ?? "",
  );
  const [compositionSelect, setCompositionSelect] = useState(() =>
    resolveCompositionSelect(defaults?.composition, [
      ...FABRIC_COMPOSITIONS,
      ...(defaults?.composition ? [defaults.composition] : []),
    ]).select,
  );
  const [compositionOther, setCompositionOther] = useState(() =>
    resolveCompositionSelect(defaults?.composition, [
      ...FABRIC_COMPOSITIONS,
      ...(defaults?.composition ? [defaults.composition] : []),
    ]).other,
  );
  const [fabricKindSelect, setFabricKindSelect] = useState(initialKind.select);
  const [fabricKindOther, setFabricKindOther] = useState(initialKind.other);
  const [supplierSelect, setSupplierSelect] = useState(initialSupplier.select);
  const [supplierOther, setSupplierOther] = useState(initialSupplier.other);

  const [densityGsm, setDensityGsm] = useState(defaults?.densityGsm ?? "");
  const [widthCm, setWidthCm] = useState(defaults?.widthCm ?? "");
  const [metersPerKg, setMetersPerKg] = useState(numStr(defaults?.metersPerKg));
  const [metersPerKgManual, setMetersPerKgManual] = useState(
    () => defaults?.metersPerKg != null && Number(defaults.metersPerKg) > 0,
  );
  const [priceKgUsd, setPriceKgUsd] = useState(numStr(defaults?.priceKgUsd));
  const [priceKgUsdVat, setPriceKgUsdVat] = useState(numStr(defaults?.priceKgUsdVat));
  const [priceMeterNoVat, setPriceMeterNoVat] = useState(numStr(defaults?.priceMeterUahNoVat));
  const [priceMeterVat, setPriceMeterVat] = useState(numStr(defaults?.priceMeterUahVat));
  const [priceMeterCutVat, setPriceMeterCutVat] = useState(numStr(defaults?.priceMeterUahCutVat));
  const [priceM2NoVat, setPriceM2NoVat] = useState(() =>
    numStr(
      squareMeterPriceFromLinearMeter(defaults?.priceMeterUahNoVat, defaults?.widthCm),
    ),
  );
  const [priceM2Vat, setPriceM2Vat] = useState(() =>
    numStr(squareMeterPriceFromLinearMeter(defaults?.priceMeterUahVat, defaults?.widthCm)),
  );
  const [minWholesaleMeters, setMinWholesaleMeters] = useState(
    numStr(defaults?.minWholesaleMeters),
  );
  const [rollWeightKg, setRollWeightKg] = useState(numStr(defaults?.rollWeightKg));
  const [metersPerRollManual, setMetersPerRollManual] = useState(
    numStr(defaults?.metersPerRoll),
  );
  /** Fixed roll length (e.g. 50 m) — skips weight × м.п./кг auto. */
  const [rollLengthFixed, setRollLengthFixed] = useState(() => {
    const hasManualRoll =
      defaults?.metersPerRoll != null && Number(defaults.metersPerRoll) > 0;
    const hasWeight = defaults?.rollWeightKg != null && Number(defaults.rollWeightKg) > 0;
    return hasManualRoll && !hasWeight;
  });
  const [wholesaleNote, setWholesaleNote] = useState(defaults?.wholesaleNote ?? "");
  const [note, setNote] = useState(defaults?.note ?? "");
  const [costOverride, setCostOverride] = useState(defaults?.costVatOverride ?? "");
  const [deliveryType, setDeliveryType] = useState<FabricDeliveryTypeCode>(
    normalizeFabricDeliveryType(defaults?.deliveryType),
  );
  const [fabricCargoUsdPerKg, setFabricCargoUsdPerKg] = useState(() =>
    String(
      deliveryRateUsdPerKg(normalizeFabricDeliveryType(defaults?.deliveryType), fabricGlobals),
    ),
  );

  const [purchasePrice, setPurchasePrice] = useState(String(defaults?.purchasePrice ?? 0));

  const selectedUnit = units.find((unit) => unit.id === unitOfMeasureId) ?? units[0];
  const fabricUnitMode = resolveFabricUnitMode(resolveUnitCode(selectedUnit));
  const fabricMeterPricing =
    type === "FABRIC" && (fabricUnitMode === "m" || fabricUnitMode === "kg" || fabricUnitMode === "m2");
  const fabricEachPricing =
    type === "FABRIC" && (fabricUnitMode === "pcs" || fabricUnitMode === "cone");
  const pricingInline = fabricMeterPricing && !managePricingSeparately;
  const showRollParams = type === "FABRIC" && fabricMeterPricing;
  /** Density + width drive м.п./кг when buying in kg. */
  const densityWidthRequired = type === "FABRIC" && fabricUnitMode === "kg";
  /** Show density/width only when they drive a calc (kg → м.п./кг, m2 → ₴/м). */
  const showDensityField = type === "FABRIC" && fabricUnitMode === "kg";
  const showWidthField =
    type === "FABRIC" && (fabricUnitMode === "kg" || fabricUnitMode === "m2");
  const widthRequiredForM2 = type === "FABRIC" && fabricUnitMode === "m2";
  /** м.п./кг: required+auto for kg; optional logistics for m/m2. */
  const showMetersPerKg = type === "FABRIC" && fabricMeterPricing;
  const metersPerKgRequired = type === "FABRIC" && fabricUnitMode === "kg";
  const metersPerKgAutoOnly = type === "FABRIC" && fabricUnitMode === "kg";
  const autoMetersPerKg = metersPerKgFromDensityWidth(densityGsm, widthCm);
  const effectiveMetersPerRoll = rollLengthFixed
    ? metersPerRollManual
      ? Number(metersPerRollManual)
      : null
    : null;
  const metersPerRollReady = Boolean(
    !rollLengthFixed &&
      metersPerKg &&
      Number(metersPerKg) > 0 &&
      rollWeightKg &&
      Number(rollWeightKg) > 0,
  );

  const liveGlobals = useMemo<FabricPricingGlobals>(
    () => ({
      ...fabricGlobals,
      fabricCargoUsdPerKg:
        Number(fabricCargoUsdPerKg) >= 0
          ? Number(fabricCargoUsdPerKg)
          : deliveryRateUsdPerKg(deliveryType, fabricGlobals),
    }),
    [fabricGlobals, fabricCargoUsdPerKg, deliveryType],
  );

  function applyDeliveryType(nextType: FabricDeliveryTypeCode) {
    setDeliveryType(nextType);
    const rate = deliveryRateUsdPerKg(nextType, fabricGlobals);
    setFabricCargoUsdPerKg(String(rate));
    recalcMeterPrices({ fabricCargoUsdPerKg: String(rate) });
  }

  const derived = useMemo(
    () =>
      deriveFabricPricing(
        {
          metersPerKg: metersPerKg ? Number(metersPerKg) : null,
          priceKgUsd: priceKgUsd ? Number(priceKgUsd) : null,
          priceKgUsdVat: priceKgUsdVat ? Number(priceKgUsdVat) : null,
          priceMeterUahNoVat: priceMeterNoVat ? Number(priceMeterNoVat) : null,
          priceMeterUahVat: priceMeterVat ? Number(priceMeterVat) : null,
          priceMeterUahCutVat: priceMeterCutVat ? Number(priceMeterCutVat) : null,
          rollWeightKg: rollLengthFixed ? null : rollWeightKg ? Number(rollWeightKg) : null,
          metersPerRoll: effectiveMetersPerRoll,
          minWholesaleMeters: minWholesaleMeters ? Number(minWholesaleMeters) : null,
          costVatOverride: costOverride === "NET" || costOverride === "GROSS" ? costOverride : null,
        },
        liveGlobals,
      ),
    [
      metersPerKg,
      priceKgUsd,
      priceKgUsdVat,
      priceMeterNoVat,
      priceMeterVat,
      priceMeterCutVat,
      rollWeightKg,
      rollLengthFixed,
      effectiveMetersPerRoll,
      minWholesaleMeters,
      costOverride,
      liveGlobals,
    ],
  );

  function applyMetersPerKg(value: string, opts?: { fromAuto?: boolean }) {
    setMetersPerKg(value);
    if (opts?.fromAuto) {
      setMetersPerKgManual(false);
    } else {
      setMetersPerKgManual(Boolean(value.trim()));
    }
    if (pricingInline) recalcMeterPrices({ metersPerKg: value });
  }

  function syncMetersPerKgFromDensity(
    nextDensity: string,
    nextWidth: string,
    force = false,
  ) {
    const auto = metersPerKgFromDensityWidth(nextDensity, nextWidth);
    if (auto == null) return;
    // kg mode: always keep auto in sync; other modes: only if not manually overridden
    if (metersPerKgAutoOnly) {
      applyMetersPerKg(String(auto), { fromAuto: true });
      return;
    }
    if (!force && metersPerKgManual && metersPerKg.trim()) return;
    applyMetersPerKg(String(auto), { fromAuto: true });
  }

  function applyM2Prices(next: {
    priceM2NoVat?: string;
    priceM2Vat?: string;
    widthCm?: string;
  }) {
    const width = next.widthCm ?? widthCm;
    const noVatRaw = next.priceM2NoVat ?? priceM2NoVat;
    const vatRaw = next.priceM2Vat ?? priceM2Vat;
    if (next.priceM2NoVat != null) setPriceM2NoVat(next.priceM2NoVat);
    if (next.priceM2Vat != null) setPriceM2Vat(next.priceM2Vat);
    const linearNoVat = linearMeterPriceFromSquareMeter(
      noVatRaw ? Number(noVatRaw) : null,
      width,
    );
    const linearVat = linearMeterPriceFromSquareMeter(vatRaw ? Number(vatRaw) : null, width);
    if (linearNoVat != null) setPriceMeterNoVat(String(linearNoVat));
    if (linearVat != null) setPriceMeterVat(String(linearVat));
  }

  function recalcMeterPrices(next: {
    fabricCargoUsdPerKg?: string;
    metersPerKg?: string;
    priceKgUsd?: string;
    priceKgUsdVat?: string;
  }) {
    const globals: FabricPricingGlobals = {
      ...fabricGlobals,
      fabricCargoUsdPerKg:
        Number(next.fabricCargoUsdPerKg ?? fabricCargoUsdPerKg) >= 0
          ? Number(next.fabricCargoUsdPerKg ?? fabricCargoUsdPerKg)
          : fabricGlobals.fabricCargoUsdPerKg,
    };
    const auto = deriveFabricPricing(
      {
        metersPerKg: (next.metersPerKg ?? metersPerKg)
          ? Number(next.metersPerKg ?? metersPerKg)
          : null,
        priceKgUsd: (next.priceKgUsd ?? priceKgUsd)
          ? Number(next.priceKgUsd ?? priceKgUsd)
          : null,
        priceKgUsdVat: (next.priceKgUsdVat ?? priceKgUsdVat)
          ? Number(next.priceKgUsdVat ?? priceKgUsdVat)
          : null,
        priceMeterUahNoVat: null,
        priceMeterUahVat: null,
        rollWeightKg: rollWeightKg ? Number(rollWeightKg) : null,
        costVatOverride: costOverride === "NET" || costOverride === "GROSS" ? costOverride : null,
      },
      globals,
    );
    if (auto.priceMeterUahNoVat != null) setPriceMeterNoVat(String(auto.priceMeterUahNoVat));
    if (auto.priceMeterUahVat != null) setPriceMeterVat(String(auto.priceMeterUahVat));
  }

  const compositionValue =
    compositionSelect === COMPOSITION_OTHER ? compositionOther : compositionSelect;
  const fabricKindValue =
    fabricKindSelect === FABRIC_KIND_OTHER ? fabricKindOther : fabricKindSelect;
  const supplierValue =
    supplierSelect === SUPPLIER_OTHER ? supplierOther.trim() : supplierSelect;

  const purchaseDisplay =
    type === "FABRIC"
      ? fabricEachPricing
        ? purchasePrice
        : managePricingSeparately
          ? String(defaults?.purchasePrice ?? purchasePrice)
          : derived.purchasePrice > 0
            ? String(derived.purchasePrice)
            : purchasePrice
      : purchasePrice;

  const policyLabel =
    liveGlobals.materialCostVatMode === "GROSS" ? "GROSS" : "NET";
  const purchaseReadOnly = type === "FABRIC" && !fabricEachPricing;

  return (
    <div className="space-y-4">
      {defaults ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {managePricingSeparately ? (
        <input type="hidden" name="pricingManagedSeparately" value="1" />
      ) : null}

      <FormGroup label="Основне" icon={<IconFormTitle size={14} />} columns={2} compact>
        <Input
          className="sm:col-span-2"
          name="nameUk"
          label="Назва"
          required
          autoFocus={!defaults}
          placeholder="Кулір 30/1"
          defaultValue={defaults?.nameUk}
        />
        <Select
          name="type"
          label="Тип"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="FABRIC">Тканина</option>
          <option value="OTHER_MATERIAL">Інший матеріал</option>
          <option value="TRIM">Фурнітура</option>
        </Select>
        <Select
          name="unitOfMeasureId"
          label="Од. виміру"
          required
          value={unitOfMeasureId}
          onChange={(event) => setUnitOfMeasureId(event.target.value)}
          hint={type === "FABRIC" ? fabricUnitHint(fabricUnitMode) : undefined}
        >
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.label}
            </option>
          ))}
        </Select>
      </FormGroup>

      <FormGroup label="У розрахунку" icon={<IconCalc size={14} />} columns={2} compact>
        <Input
          name="purchasePrice"
          label={
            fabricEachPricing
              ? fabricUnitMode === "cone"
                ? "Собівартість, ₴/бобіна"
                : "Собівартість, ₴/шт"
              : type === "FABRIC"
                ? "Собівартість, ₴/м.п. (авто)"
                : "Собівартість, ₴"
          }
          type="number"
          step="0.01"
          min="0"
          required
          value={purchaseDisplay}
          readOnly={purchaseReadOnly}
          tabIndex={purchaseReadOnly ? -1 : undefined}
          onChange={
            purchaseReadOnly ? undefined : (event) => setPurchasePrice(event.target.value)
          }
          hint={
            type === "FABRIC"
              ? fabricEachPricing
                ? "Норма в складі виробу — в цій же одиниці"
                : managePricingSeparately
                  ? "З умов основного постачальника нижче"
                  : derived.costMode === "NET"
                    ? "Без ПДВ · для калькуляції завжди ₴/м.п."
                    : "З ПДВ · для калькуляції завжди ₴/м.п."
              : undefined
          }
        />
        <Input
          name="defaultWastePercent"
          label="Відходи, %"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaults?.defaultWastePercent ?? 0}
        />
      </FormGroup>

      {type === "FABRIC" ? (
        <>
          <FormGroup label="Тканина" icon={<IconFabricKind size={14} />} columns={2} compact>
            <div className="space-y-2">
              <Select
                label="Тип тканини"
                value={fabricKindSelect}
                onChange={(event) => setFabricKindSelect(event.target.value)}
              >
                <option value="">Оберіть…</option>
                {FABRIC_KINDS.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
                <option value={FABRIC_KIND_OTHER}>Інше…</option>
              </Select>
              <input type="hidden" name="fabricKindUk" value={fabricKindValue} />
              {fabricKindSelect === FABRIC_KIND_OTHER ? (
                <Input
                  label="Свій тип"
                  value={fabricKindOther}
                  onChange={(event) => setFabricKindOther(event.target.value)}
                  placeholder="Наприклад фліс"
                />
              ) : null}
            </div>
            <div className="space-y-2">
              <Select
                label="Склад"
                value={compositionSelect}
                onChange={(event) => setCompositionSelect(event.target.value)}
              >
                <option value="">Оберіть…</option>
                {knownCompositions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
                <option value={COMPOSITION_OTHER}>Додати новий…</option>
              </Select>
              <input type="hidden" name="composition" value={compositionValue} />
              {compositionSelect === COMPOSITION_OTHER ? (
                <Input
                  label="Новий склад"
                  value={compositionOther}
                  onChange={(event) => setCompositionOther(event.target.value)}
                  placeholder="80% бавовна 20% еластан"
                />
              ) : null}
            </div>
          </FormGroup>

          <FormGroup label="Параметри" icon={<IconParams size={14} />} columns={3} compact>
            {showDensityField ? (
              <Input
                name="densityGsm"
                label="Щільність, г/м²"
                placeholder="170"
                value={densityGsm}
                required={densityWidthRequired}
                onChange={(event) => {
                  const value = event.target.value;
                  setDensityGsm(value);
                  syncMetersPerKgFromDensity(value, widthCm, densityWidthRequired);
                }}
                hint={
                  densityWidthRequired
                    ? "Обовʼязково · разом із шириною дає м.п./кг"
                    : autoMetersPerKg != null
                      ? `→ ${autoMetersPerKg} м.п./кг`
                      : undefined
                }
              />
            ) : (
              <input type="hidden" name="densityGsm" value={densityGsm} />
            )}
            {showWidthField ? (
              <Input
                name="widthCm"
                label="Ширина, см"
                value={widthCm}
                required={densityWidthRequired || widthRequiredForM2}
                onChange={(event) => {
                  const value = event.target.value;
                  setWidthCm(value);
                  syncMetersPerKgFromDensity(densityGsm, value, densityWidthRequired);
                  if (fabricUnitMode === "m2") applyM2Prices({ widthCm: value });
                }}
                hint={
                  densityWidthRequired
                    ? "Обовʼязково для авто м.п./кг"
                    : widthRequiredForM2
                      ? "Потрібна для переводу м² → м.п."
                      : "Довідково"
                }
              />
            ) : (
              <input type="hidden" name="widthCm" value={widthCm} />
            )}
            {showMetersPerKg ? (
              <Input
                name="metersPerKg"
                label="м.п. / кг"
                type="number"
                step="0.01"
                min="0"
                value={metersPerKg}
                required={metersPerKgRequired}
                readOnly={metersPerKgAutoOnly}
                tabIndex={metersPerKgAutoOnly ? -1 : undefined}
                onChange={
                  metersPerKgAutoOnly
                    ? undefined
                    : (event) => applyMetersPerKg(event.target.value)
                }
                hint={
                  metersPerKgAutoOnly
                    ? autoMetersPerKg != null
                      ? "Авто: 100 000 ÷ (щільність × ширина)"
                      : "Заповніть щільність і ширину"
                    : "Опційно · для доставки (кг) і авто метражу рулону"
                }
              />
            ) : (
              <input type="hidden" name="metersPerKg" value={metersPerKg} />
            )}
            {showRollParams ? (
              <>
                <Select
                  label="Метраж рулону"
                  value={rollLengthFixed ? "fixed" : "auto"}
                  onChange={(event) => {
                    const fixed = event.target.value === "fixed";
                    setRollLengthFixed(fixed);
                    if (fixed) {
                      const current =
                        derived.metersPerRoll != null
                          ? String(derived.metersPerRoll)
                          : metersPerRollManual;
                      setMetersPerRollManual(current);
                    }
                  }}
                  hint={
                    rollLengthFixed
                      ? "Фіксована довжина (напр. 50 м) — без ваги/GSM"
                      : "Авто з ваги рулону × м.п./кг"
                  }
                >
                  <option value="auto">З ваги (авто)</option>
                  <option value="fixed">Фіксована довжина</option>
                </Select>
                {rollLengthFixed ? (
                  <>
                    <Input
                      name="metersPerRoll"
                      label="м.п. / рул."
                      type="number"
                      step="0.1"
                      min="0"
                      value={metersPerRollManual}
                      onChange={(event) => setMetersPerRollManual(event.target.value)}
                      hint="Вручну, наприклад 50"
                    />
                    <input type="hidden" name="rollWeightKg" value="" />
                  </>
                ) : (
                  <>
                    <Input
                      name="rollWeightKg"
                      label="Вага рул., кг"
                      type="number"
                      step="0.01"
                      min="0"
                      value={rollWeightKg}
                      onChange={(event) => setRollWeightKg(event.target.value)}
                      hint="Разом з м.п./кг → м.п./рул."
                    />
                    <Input
                      label="м.п. / рул. (авто)"
                      value={derived.metersPerRoll ?? ""}
                      readOnly
                      tabIndex={-1}
                      hint={
                        metersPerRollReady
                          ? "вага рул. × м.п./кг"
                          : "Потрібні вага рулона і м.п./кг"
                      }
                    />
                    <input
                      type="hidden"
                      name="metersPerRoll"
                      value={derived.metersPerRoll ?? ""}
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <input type="hidden" name="rollWeightKg" value={rollWeightKg} />
                <input
                  type="hidden"
                  name="metersPerRoll"
                  value={
                    rollLengthFixed
                      ? metersPerRollManual
                      : (derived.metersPerRoll ?? "")
                  }
                />
              </>
            )}
          </FormGroup>

          {/* Delivery + purchase live together so tariff is not orphaned in «Параметри». */}
          {pricingInline || managePricingSeparately ? (
            <FormGroup
              label={managePricingSeparately ? "Доставка" : "Постачальники та закупівля"}
              icon={<IconPurchaseKg size={14} />}
              columns={3}
              compact
            >
              <p className="type-caption sm:col-span-3">
                {managePricingSeparately
                  ? "Тип доставки матеріалу. Тариф $/кг можна змінити — збережеться в «Ціноутворення». Override на постачальника — у блоці нижче."
                  : "Тип доставки задає тариф $/кг для логістики. Ціни можна змінити тут — збережуться в «Ціноутворення» для цього типу."}
              </p>
              <Select
                name="deliveryType"
                label="Тип доставки"
                value={deliveryType}
                onChange={(event) =>
                  applyDeliveryType(normalizeFabricDeliveryType(event.target.value))
                }
              >
                {FABRIC_DELIVERY_TYPES.map((code) => (
                  <option key={code} value={code}>
                    {fabricDeliveryTypeLabel(code)} —{" "}
                    {deliveryRateUsdPerKg(code, fabricGlobals)} $/кг
                  </option>
                ))}
              </Select>
              <Input
                name="fabricCargoUsdPerKg"
                label="Доставка $/кг"
                type="number"
                step="0.01"
                min="0"
                value={fabricCargoUsdPerKg}
                onChange={(event) => {
                  const value = event.target.value;
                  setFabricCargoUsdPerKg(value);
                  if (pricingInline) recalcMeterPrices({ fabricCargoUsdPerKg: value });
                }}
                hint={`Тариф «${fabricDeliveryTypeLabel(deliveryType)}» · можна змінити`}
              />
              <input type="hidden" name="usdUahRate" value={fabricGlobals.usdUahRate} />
            </FormGroup>
          ) : null}

          {pricingInline ? (
            <>
              {fabricUnitMode === "kg" || fabricUnitMode === "m" ? (
                <FormGroup
                  label={
                    fabricUnitMode === "kg"
                      ? "Ціни закупки в кг"
                      : "Ціни $/кг (опційно)"
                  }
                  icon={<IconPurchaseKg size={14} />}
                  columns={3}
                  compact
                >
                  <p className="type-caption sm:col-span-3">
                    {fabricUnitMode === "kg"
                      ? `Ціна за кг + м.п./кг → ₴/м.п. Курс ₴/$: ${fabricGlobals.usdUahRate}.`
                      : `Якщо постачальник дає $/кг — заповніть тут. Інакше достатньо ₴/м нижче. Курс: ${fabricGlobals.usdUahRate}.`}
                  </p>
                  <div className="space-y-2 sm:col-span-3 lg:col-span-2">
                    <Select
                      label="Постачальник"
                      value={supplierSelect}
                      onChange={(event) => setSupplierSelect(event.target.value)}
                    >
                      <option value="">Оберіть…</option>
                      {knownSuppliers.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value={SUPPLIER_OTHER}>Додати нового…</option>
                    </Select>
                    <input type="hidden" name="supplierCode" value={supplierValue} />
                    {supplierSelect === SUPPLIER_OTHER ? (
                      <Input
                        label="Назва постачальника"
                        value={supplierOther}
                        onChange={(event) => setSupplierOther(event.target.value)}
                        placeholder="Наприклад Зейджан"
                      />
                    ) : null}
                  </div>
                  <Input
                    name="priceKgUsd"
                    label="$ / кг"
                    type="number"
                    step="0.01"
                    min="0"
                    required={fabricUnitMode === "kg"}
                    value={priceKgUsd}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPriceKgUsd(value);
                      recalcMeterPrices({ priceKgUsd: value });
                    }}
                  />
                  <Input
                    label="$ / кг з доставкою (довідково)"
                    value={derived.priceKgUsdCargo ?? ""}
                    readOnly
                    tabIndex={-1}
                  />
                  <input type="hidden" name="priceKgUsdCargo" value={derived.priceKgUsdCargo ?? ""} />
                  <Input
                    name="priceKgUsdVat"
                    label="$ / кг з ПДВ"
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceKgUsdVat}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPriceKgUsdVat(value);
                      recalcMeterPrices({ priceKgUsdVat: value });
                    }}
                  />
                </FormGroup>
              ) : null}

              {fabricUnitMode === "m2" ? (
                <FormGroup
                  label="Ціни закупки в м²"
                  icon={<IconPurchaseKg size={14} />}
                  columns={3}
                  compact
                >
                  <p className="type-caption sm:col-span-3">
                    ₴/м.п. = ₴/м² × (ширина см ÷ 100). Курс ₴/$: {fabricGlobals.usdUahRate}.
                  </p>
                  <div className="space-y-2 sm:col-span-3 lg:col-span-2">
                    <Select
                      label="Постачальник"
                      value={supplierSelect}
                      onChange={(event) => setSupplierSelect(event.target.value)}
                    >
                      <option value="">Оберіть…</option>
                      {knownSuppliers.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value={SUPPLIER_OTHER}>Додати нового…</option>
                    </Select>
                    <input type="hidden" name="supplierCode" value={supplierValue} />
                    {supplierSelect === SUPPLIER_OTHER ? (
                      <Input
                        label="Назва постачальника"
                        value={supplierOther}
                        onChange={(event) => setSupplierOther(event.target.value)}
                        placeholder="Наприклад Зейджан"
                      />
                    ) : null}
                  </div>
                  <Input
                    label="₴/м² без ПДВ"
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={priceM2NoVat}
                    onChange={(event) => applyM2Prices({ priceM2NoVat: event.target.value })}
                  />
                  <Input
                    label="₴/м² з ПДВ"
                    type="number"
                    step="0.1"
                    min="0"
                    value={priceM2Vat}
                    onChange={(event) => applyM2Prices({ priceM2Vat: event.target.value })}
                  />
                  <input type="hidden" name="priceKgUsd" value={priceKgUsd} />
                  <input type="hidden" name="priceKgUsdVat" value={priceKgUsdVat} />
                  <input type="hidden" name="priceKgUsdCargo" value={derived.priceKgUsdCargo ?? ""} />
                </FormGroup>
              ) : null}

              <FormGroup
                label={
                  fabricUnitMode === "m2"
                    ? "Ціна за м.п. (з м²) і гурт"
                    : fabricUnitMode === "kg"
                      ? "Ціна за м.п. (з кг) і гурт"
                      : "Ціна за м.п. і гурт"
                }
                icon={<IconMeterPrice size={14} />}
                columns={3}
                compact
              >
                <Input
                  name="priceMeterUahNoVat"
                  label="₴/м без ПДВ (гурт)"
                  type="number"
                  step="0.1"
                  min="0"
                  required={fabricUnitMode === "m" || fabricUnitMode === "m2"}
                  value={priceMeterNoVat}
                  readOnly={fabricUnitMode === "kg" || fabricUnitMode === "m2"}
                  tabIndex={fabricUnitMode === "kg" || fabricUnitMode === "m2" ? -1 : undefined}
                  onChange={
                    fabricUnitMode === "kg" || fabricUnitMode === "m2"
                      ? undefined
                      : (event) => setPriceMeterNoVat(event.target.value)
                  }
                  hint={
                    fabricUnitMode === "kg"
                      ? "Авто з $/кг ÷ м.п./кг"
                      : fabricUnitMode === "m2"
                        ? "Авто з ₴/м² × ширина"
                        : "Ціна після межі гурту"
                  }
                />
                <Input
                  name="priceMeterUahVat"
                  label="₴/м з ПДВ (гурт)"
                  type="number"
                  step="0.1"
                  min="0"
                  value={priceMeterVat}
                  readOnly={fabricUnitMode === "kg" || fabricUnitMode === "m2"}
                  tabIndex={fabricUnitMode === "kg" || fabricUnitMode === "m2" ? -1 : undefined}
                  onChange={
                    fabricUnitMode === "kg" || fabricUnitMode === "m2"
                      ? undefined
                      : (event) => setPriceMeterVat(event.target.value)
                  }
                  hint={
                    fabricUnitMode === "kg" || fabricUnitMode === "m2"
                      ? "Авто"
                      : "Ціна після межі гурту · з ПДВ"
                  }
                />
                <Input
                  name="priceMeterUahCutVat"
                  label="₴/м відріз"
                  type="number"
                  step="0.1"
                  min="0"
                  value={priceMeterCutVat}
                  onChange={(event) => setPriceMeterCutVat(event.target.value)}
                  hint="До межі гурту / малі тиражі"
                />
                <Input
                  name="minWholesaleMeters"
                  label="Межа витрати, м"
                  type="number"
                  step="0.1"
                  min="0"
                  value={minWholesaleMeters}
                  onChange={(event) => setMinWholesaleMeters(event.target.value)}
                  hint="Порожньо = метраж рулону · ≥ межі → гурт"
                />
                <Input
                  name="wholesaleNote"
                  label="Примітка гурту"
                  value={wholesaleNote}
                  onChange={(event) => setWholesaleNote(event.target.value)}
                  className="sm:col-span-2"
                />
                {derived.purchasePrice > 0 ? (
                  <p className="type-caption sm:col-span-3 tabular">
                    Активна собівартість з цих умов: {formatMoneyUah(derived.purchasePrice)}/м
                    {derived.pricingMode === "cut" ? " (відріз)" : ""}
                    {minWholesaleMeters ? ` · ≥ ${minWholesaleMeters} м → гурт` : ""}
                  </p>
                ) : null}
              </FormGroup>
            </>
          ) : (
            <input type="hidden" name="supplierCode" value={defaults?.supplierCode ?? ""} />
          )}

          {fabricEachPricing && !managePricingSeparately ? (
            <FormGroup label="Постачальник" icon={<IconPurchaseKg size={14} />} columns={2} compact>
              <div className="space-y-2 sm:col-span-2">
                <Select
                  label="Постачальник"
                  value={supplierSelect}
                  onChange={(event) => setSupplierSelect(event.target.value)}
                >
                  <option value="">Оберіть…</option>
                  {knownSuppliers.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  <option value={SUPPLIER_OTHER}>Додати нового…</option>
                </Select>
                <input type="hidden" name="supplierCode" value={supplierValue} />
                {supplierSelect === SUPPLIER_OTHER ? (
                  <Input
                    label="Назва постачальника"
                    value={supplierOther}
                    onChange={(event) => setSupplierOther(event.target.value)}
                    placeholder="Наприклад Зейджан"
                  />
                ) : null}
              </div>
            </FormGroup>
          ) : null}

          <FormGroup label="ПДВ" icon={<IconCalc size={14} />} columns={1} compact>
            <Select
              name="costVatOverride"
              label="ПДВ у собівартості"
              value={costOverride}
              onChange={(event) => setCostOverride(event.target.value)}
            >
              <option value="">{`Як у налаштуваннях (${policyLabel})`}</option>
              <option value="NET">Завжди без ПДВ</option>
              <option value="GROSS">Завжди з ПДВ</option>
            </Select>
          </FormGroup>
          <input type="hidden" name="colorOrAttribute" value={defaults?.colorOrAttribute ?? ""} />
        </>
      ) : (
        <FormGroup label="Ідентифікація" icon={<IconSpec size={14} />} columns={2} compact>
          <Input
            name="supplierCode"
            label="Код / артикул"
            placeholder="Необовʼязково"
            defaultValue={defaults?.supplierCode}
          />
          <Input
            name="colorOrAttribute"
            label="Колір / характеристика"
            placeholder="Необовʼязково"
            defaultValue={defaults?.colorOrAttribute}
          />
        </FormGroup>
      )}

      <FormGroup label="Примітка" icon={<IconNote size={14} />} columns={1} compact>
        <Input
          name="note"
          label="Коментар"
          placeholder="Умови постачання, обмеження"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </FormGroup>
    </div>
  );
}

export function MaterialCreatePanel({
  units,
  suppliers = [],
  variant = "primary",
  size = "md",
  triggerLabel = "Новий матеріал",
  fabricGlobals = DEFAULT_FABRIC_PRICING_GLOBALS,
  onCreated,
}: {
  units: UnitOption[];
  suppliers?: string[];
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  triggerLabel?: string;
  fabricGlobals?: FabricPricingGlobals;
  onCreated?: (result: Record<string, unknown>) => void;
}) {
  return (
    <CreatePanel
      title="Новий матеріал"
      description="Одиниця виміру задає шлях закупівлі (м.п. / кг / м² / шт / бобіна). Для тканини калькуляція в складі йде в м.п., крім шт і бобіни."
      triggerLabel={triggerLabel}
      submitLabel="Створити"
      action={createMaterialAction}
      variant={variant}
      size={size}
      width="lg"
      onCreated={onCreated}
    >
      <MaterialFields units={units} fabricGlobals={fabricGlobals} suppliers={suppliers} />
    </CreatePanel>
  );
}

export function MaterialEditPanel({
  material,
  units,
  suppliers = [],
  fabricGlobals = DEFAULT_FABRIC_PRICING_GLOBALS,
}: {
  material: MaterialFormDefaults;
  units: UnitOption[];
  suppliers?: string[];
  fabricGlobals?: FabricPricingGlobals;
}) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<MaterialFormDefaults | null>(null);
  const [globals, setGlobals] = useState(fabricGlobals);

  async function openEditor() {
    setOpen(true);
    setError(null);
    setLoading(true);
    setLoaded(null);
    try {
      const result = await getMaterialForEditAction(material.id);
      if (!result.ok || !("material" in result)) {
        setError("Не вдалося завантажити матеріал з бази.");
        return;
      }
      setLoaded(result.material);
      setGlobals(result.fabricGlobals);
    } catch {
      setError("Не вдалося завантажити матеріал з бази.");
    } finally {
      setLoading(false);
    }
  }

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateMaterialAction(formData);
      if (!result.ok) {
        setError("Перевірте обовʼязкові поля — запис не збережено.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => void openEditor()}>
        Змінити
      </Button>

      <SidePanel
        open={open}
        onClose={() => {
          if (pending || loading) return;
          setOpen(false);
        }}
        title="Змінити матеріал"
        description="Параметри тканини зберігаються кнопкою «Зберегти». Ціни закупівлі — у блоці постачальників (окремо)."
        width="lg"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending || loading}
            >
              Скасувати
            </Button>
            <Button type="submit" form={formId} loading={pending} disabled={pending || loading || !loaded}>
              {pending ? "Збереження…" : "Зберегти"}
            </Button>
          </>
        }
      >
        <form id={formId} action={submit} className="space-y-4">
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {loading || !loaded ? (
            <SidePanelSkeleton sections={4} />
          ) : (
            <>
              <MaterialFields
                key={`${loaded.id}-${loaded.densityGsm}-${loaded.metersPerKg}-${loaded.purchasePrice}`}
                units={units}
                defaults={loaded}
                fabricGlobals={globals}
                suppliers={suppliers}
                managePricingSeparately={loaded.type === "FABRIC"}
              />
              {loaded.type === "FABRIC" ? (
                <MaterialSuppliersEditor
                  materialId={loaded.id}
                  metersPerKg={loaded.metersPerKg}
                  fabricGlobals={globals}
                  onPrimaryChanged={() => {
                    void (async () => {
                      const result = await getMaterialForEditAction(loaded.id);
                      if (result.ok && "material" in result) {
                        setLoaded(result.material);
                        setGlobals(result.fabricGlobals);
                      }
                      router.refresh();
                    })();
                  }}
                />
              ) : null}
            </>
          )}
        </form>
      </SidePanel>
    </>
  );
}

