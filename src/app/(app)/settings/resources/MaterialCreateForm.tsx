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
  IconClients,
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
  type FabricPricingGlobals,
} from "@/lib/fabric-pricing";

type UnitOption = { id: string; label: string };

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
}: {
  units: UnitOption[];
  defaults?: MaterialFormDefaults;
  fabricGlobals: FabricPricingGlobals;
  suppliers?: string[];
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
  const [priceKgUsd, setPriceKgUsd] = useState(numStr(defaults?.priceKgUsd));
  const [priceKgUsdVat, setPriceKgUsdVat] = useState(numStr(defaults?.priceKgUsdVat));
  const [priceMeterNoVat, setPriceMeterNoVat] = useState(numStr(defaults?.priceMeterUahNoVat));
  const [priceMeterVat, setPriceMeterVat] = useState(numStr(defaults?.priceMeterUahVat));
  const [priceMeterCutVat, setPriceMeterCutVat] = useState(numStr(defaults?.priceMeterUahCutVat));
  const [minWholesaleMeters, setMinWholesaleMeters] = useState(
    numStr(defaults?.minWholesaleMeters),
  );
  const [rollWeightKg, setRollWeightKg] = useState(numStr(defaults?.rollWeightKg));
  const [wholesaleNote, setWholesaleNote] = useState(defaults?.wholesaleNote ?? "");
  const [note, setNote] = useState(defaults?.note ?? "");
  const [costOverride, setCostOverride] = useState(defaults?.costVatOverride ?? "");
  const [usdUahRate, setUsdUahRate] = useState(String(fabricGlobals.usdUahRate));
  const [fabricCargoUsdPerKg, setFabricCargoUsdPerKg] = useState(
    String(fabricGlobals.fabricCargoUsdPerKg),
  );

  const [purchasePrice, setPurchasePrice] = useState(String(defaults?.purchasePrice ?? 0));

  const liveGlobals = useMemo<FabricPricingGlobals>(
    () => ({
      ...fabricGlobals,
      usdUahRate: Number(usdUahRate) > 0 ? Number(usdUahRate) : fabricGlobals.usdUahRate,
      fabricCargoUsdPerKg:
        Number(fabricCargoUsdPerKg) >= 0
          ? Number(fabricCargoUsdPerKg)
          : fabricGlobals.fabricCargoUsdPerKg,
    }),
    [fabricGlobals, usdUahRate, fabricCargoUsdPerKg],
  );

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
          rollWeightKg: rollWeightKg ? Number(rollWeightKg) : null,
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
      minWholesaleMeters,
      costOverride,
      liveGlobals,
    ],
  );

  function recalcMeterPrices(next: {
    usdUahRate?: string;
    fabricCargoUsdPerKg?: string;
    metersPerKg?: string;
    priceKgUsd?: string;
    priceKgUsdVat?: string;
  }) {
    const globals: FabricPricingGlobals = {
      ...fabricGlobals,
      usdUahRate:
        Number(next.usdUahRate ?? usdUahRate) > 0
          ? Number(next.usdUahRate ?? usdUahRate)
          : fabricGlobals.usdUahRate,
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
    type === "FABRIC" && derived.purchasePrice > 0
      ? String(derived.purchasePrice)
      : purchasePrice;

  const policyLabel =
    liveGlobals.materialCostVatMode === "GROSS" ? "GROSS" : "NET";

  return (
    <div className="space-y-4">
      {defaults ? <input type="hidden" name="id" value={defaults.id} /> : null}

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
          defaultValue={defaults?.unitOfMeasureId ?? units[0]?.id}
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
          label={type === "FABRIC" ? "Собівартість, ₴ (авто)" : "Собівартість, ₴"}
          type="number"
          step="0.01"
          min="0"
          required
          value={purchaseDisplay}
          readOnly={type === "FABRIC"}
          tabIndex={type === "FABRIC" ? -1 : undefined}
          onChange={
            type === "FABRIC" ? undefined : (event) => setPurchasePrice(event.target.value)
          }
          hint={
            type === "FABRIC"
              ? derived.costMode === "NET"
                ? "Без ПДВ"
                : "З ПДВ"
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
            <Input
              name="densityGsm"
              label="Щільність"
              placeholder="170"
              value={densityGsm}
              onChange={(event) => setDensityGsm(event.target.value)}
            />
            <Input
              name="widthCm"
              label="Ширина, см"
              value={widthCm}
              onChange={(event) => setWidthCm(event.target.value)}
            />
            <Input
              name="metersPerKg"
              label="м.п. / кг"
              type="number"
              step="0.01"
              min="0"
              value={metersPerKg}
              onChange={(event) => {
                const value = event.target.value;
                setMetersPerKg(value);
                recalcMeterPrices({ metersPerKg: value });
              }}
            />
            <Input
              name="rollWeightKg"
              label="Вага рул., кг"
              type="number"
              step="0.01"
              min="0"
              value={rollWeightKg}
              onChange={(event) => setRollWeightKg(event.target.value)}
            />
            <Input
              label="м.п. / рул. (авто)"
              value={derived.metersPerRoll ?? ""}
              readOnly
              tabIndex={-1}
            />
            <input type="hidden" name="metersPerRoll" value={derived.metersPerRoll ?? ""} />
            <Input
              name="minWholesaleMeters"
              label="Мін. м для гурту"
              type="number"
              step="0.1"
              min="0"
              value={minWholesaleMeters}
              onChange={(event) => setMinWholesaleMeters(event.target.value)}
              hint="Порожньо = метраж рулону"
            />
          </FormGroup>

          <FormGroup label="Закупівля" icon={<IconPurchaseKg size={14} />} columns={3} compact>
            <Input
              name="usdUahRate"
              label="Курс ₴/$"
              type="number"
              step="0.01"
              min="0.01"
              value={usdUahRate}
              onChange={(event) => {
                const value = event.target.value;
                setUsdUahRate(value);
                recalcMeterPrices({ usdUahRate: value });
              }}
            />
            <Input
              name="fabricCargoUsdPerKg"
              label="Карго $/кг"
              type="number"
              step="0.01"
              min="0"
              value={fabricCargoUsdPerKg}
              onChange={(event) => {
                const value = event.target.value;
                setFabricCargoUsdPerKg(value);
                recalcMeterPrices({ fabricCargoUsdPerKg: value });
              }}
            />
            <Input
              name="priceKgUsd"
              label="$ / кг"
              type="number"
              step="0.01"
              min="0"
              value={priceKgUsd}
              onChange={(event) => {
                const value = event.target.value;
                setPriceKgUsd(value);
                recalcMeterPrices({ priceKgUsd: value });
              }}
            />
            <Input
              label="Тариф доставки $/кг (довідник)"
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

          <FormGroup label="Ціна за м.п." icon={<IconMeterPrice size={14} />} columns={3} compact>
            <Input
              name="priceMeterUahNoVat"
              label="₴ без ПДВ"
              type="number"
              step="0.1"
              min="0"
              value={priceMeterNoVat}
              onChange={(event) => setPriceMeterNoVat(event.target.value)}
              hint="Авто, можна змінити"
            />
            <Input
              name="priceMeterUahVat"
              label="₴ з ПДВ"
              type="number"
              step="0.1"
              min="0"
              value={priceMeterVat}
              onChange={(event) => setPriceMeterVat(event.target.value)}
              hint="Авто, можна змінити"
            />
            <Input
              name="priceMeterUahCutVat"
              label="₴ нарізка (відріз)"
              type="number"
              step="0.1"
              min="0"
              value={priceMeterCutVat}
              onChange={(event) => setPriceMeterCutVat(event.target.value)}
              hint="Для каталогу / малих тиражів"
            />
            {derived.pricingMode === "cut" ? (
              <p className="type-caption sm:col-span-3">
                Активна собівартість каталогу: ціна на відріз ({derived.purchasePrice} ₴/м) —
                консервативно для базових моделей.
              </p>
            ) : null}
            <Select
              className="sm:col-span-2 lg:col-span-2"
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

          <FormGroup label="Постачання" icon={<IconClients size={14} />} columns={2} compact>
            <div className="space-y-2">
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
              name="wholesaleNote"
              label="Гурт"
              value={wholesaleNote}
              onChange={(event) => setWholesaleNote(event.target.value)}
            />
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
  fabricGlobals = { usdUahRate: 45, fabricCargoUsdPerKg: 1.7, materialCostVatMode: "NET" },
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
      description="Тканини — з курсом, карго і цінами з/без ПДВ. Фурнітура — звичайна закупівельна ціна."
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
  fabricGlobals = { usdUahRate: 45, fabricCargoUsdPerKg: 1.7, materialCostVatMode: "NET" },
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
        description="Після збереження активна собівартість оновиться за політикою ПДВ."
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
                key={`${loaded.id}-${loaded.densityGsm}-${loaded.metersPerKg}`}
                units={units}
                defaults={loaded}
                fabricGlobals={globals}
                suppliers={suppliers}
              />
              {loaded.type === "FABRIC" ? (
                <MaterialSuppliersEditor materialId={loaded.id} />
              ) : null}
            </>
          )}
        </form>
      </SidePanel>
    </>
  );
}

