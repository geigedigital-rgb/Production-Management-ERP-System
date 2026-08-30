"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SidePanel } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { SidePanelSkeleton } from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { formatMoneyUah, formatUnit } from "@/lib/utils";
import {
  getOrderMaterialDetailAction,
  updateOrderMaterialTermsAction,
} from "@/server/domains/orders/actions";

type MaterialDetail = NonNullable<
  Extract<Awaited<ReturnType<typeof getOrderMaterialDetailAction>>, { ok: true }>["detail"]
>;

type FabricPreview = NonNullable<MaterialDetail["catalogPreview"]>;
type VatMode = "NET" | "GROSS";

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function vatLabel(mode: VatMode) {
  return mode === "NET" ? "без ПДВ" : "з ПДВ";
}

function previewForSupplier(detail: MaterialDetail, supplierId: string): FabricPreview | null {
  if (!detail.isFabric) return null;
  if (supplierId) {
    return detail.offers.find((offer) => offer.supplierId === supplierId) ?? detail.catalogPreview;
  }
  return detail.catalogPreview;
}

function priceForVat(preview: FabricPreview, vat: VatMode) {
  return vat === "NET" ? preview.purchasePriceNet : preview.purchasePriceGross;
}

function deliveryFromCargo(
  kgNeeded: number | null | undefined,
  cargoUsdPerKg: number,
  usdUahRate: number,
) {
  if (kgNeeded == null || kgNeeded <= 0 || cargoUsdPerKg <= 0 || usdUahRate <= 0) return 0;
  return round1(kgNeeded * cargoUsdPerKg * usdUahRate);
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function lineQuantity(detail: MaterialDetail): number {
  if (!detail.quantitiesBySize) return detail.totalQuantity;
  if (detail.sizeCode) return detail.quantitiesBySize[detail.sizeCode] ?? 0;
  return detail.totalQuantity;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5 rounded-[var(--radius-control)] border border-[var(--color-border)] p-3">
      <h3 className="type-label">{title}</h3>
      {children}
    </section>
  );
}

function Segmented({
  options,
  value,
  disabled,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`rounded-[5px] px-2.5 py-1 text-[12px] font-medium ${
            value === option.value
              ? "bg-white text-[var(--color-text-primary)] shadow-sm"
              : "text-[var(--color-text-secondary)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function NumberField({
  label,
  value,
  placeholder,
  prefix,
  suffix,
  step = "0.01",
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  step?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <div className="inline-flex h-8 max-w-[180px] items-center overflow-hidden rounded-[6px] border border-[var(--color-border)] bg-white focus-within:border-[var(--color-primary-500)]">
        {prefix ? (
          <span className="shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2 text-[12px] font-medium text-[var(--color-text-secondary)]">
            {prefix}
          </span>
        ) : null}
        <input
          type="number"
          min={0}
          step={step}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-right text-[13px] tabular outline-none"
        />
        {suffix ? (
          <span className="shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2 text-[12px] text-[var(--color-text-tertiary)]">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

export function OrderMaterialDetailPanel({
  orderId,
  orderItemMaterialId,
  locked,
  onClose,
}: {
  orderId: string;
  orderItemMaterialId: string | null;
  locked: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<MaterialDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [vatMode, setVatMode] = useState<VatMode>("NET");
  const [cargoUsdPerKg, setCargoUsdPerKg] = useState("");
  const [usdUahRate, setUsdUahRate] = useState("");
  const [deliveryManual, setDeliveryManual] = useState(false);
  const [deliveryAmount, setDeliveryAmount] = useState("");

  useEffect(() => {
    if (!orderItemMaterialId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    startTransition(async () => {
      const result = await getOrderMaterialDetailAction(orderItemMaterialId);
      setLoading(false);
      if (!result.ok) {
        setError("Не вдалося завантажити матеріал.");
        return;
      }
      const loaded = result.detail;
      setDetail(loaded);
      setSupplierId(loaded.supplierId ?? "");
      if (loaded.isFabric && loaded.companyCostVatMode) {
        setVatMode(loaded.costVatOverride ?? loaded.companyCostVatMode);
      }
      setCargoUsdPerKg(
        loaded.cargoUsdPerKg != null ? String(loaded.cargoUsdPerKg) : "",
      );
      const hasRateOverride =
        loaded.defaultUsdUahRate != null &&
        Math.abs(loaded.usdUahRate - loaded.defaultUsdUahRate) > 0.0001;
      setUsdUahRate(hasRateOverride ? String(loaded.usdUahRate) : "");
      setDeliveryManual(loaded.fabricDeliveryManual);
      setDeliveryAmount(String(loaded.fabricDeliveryAmount));
    });
  }, [orderItemMaterialId]);

  const live = useMemo(() => {
    if (!detail?.isFabric) return null;
    const base = previewForSupplier(detail, supplierId);
    if (!base) return null;

    const metersNeeded = base.metersNeeded;
    const metersPerKg = detail.metersPerKg;
    const kgNeeded =
      metersPerKg != null && metersPerKg > 0 && metersNeeded > 0
        ? round1(metersNeeded / metersPerKg)
        : base.kgNeeded;

    const purchasePrice = priceForVat(base, vatMode);
    const cargoParsed = parseOptionalNumber(cargoUsdPerKg);
    const cargo =
      cargoParsed != null && cargoParsed >= 0
        ? cargoParsed
        : base.cargoUsdPerKg ?? detail.defaultCargoUsdPerKg;
    const rateParsed = parseOptionalNumber(usdUahRate);
    const rate =
      rateParsed != null && rateParsed > 0
        ? rateParsed
        : detail.defaultUsdUahRate ?? detail.usdUahRate;
    const deliveryComputed = deliveryFromCargo(kgNeeded, cargo, rate);
    const materialPartyCost = Math.round(purchasePrice * metersNeeded * 100) / 100;

    return {
      ...base,
      purchasePrice,
      cargo,
      rate,
      metersNeeded,
      kgNeeded,
      deliveryComputed,
      materialPartyCost,
      pricingModeLabel: base.pricingModeLabel,
    };
  }, [detail, supplierId, vatMode, cargoUsdPerKg, usdUahRate]);

  useEffect(() => {
    if (!live || deliveryManual) return;
    setDeliveryAmount(String(live.deliveryComputed));
  }, [live?.deliveryComputed, deliveryManual]);

  function handleSupplierChange(nextSupplierId: string) {
    setSupplierId(nextSupplierId);
    if (!detail?.isFabric) return;
    const preview = previewForSupplier(detail, nextSupplierId);
    if (preview?.cargoUsdPerKg != null) {
      setCargoUsdPerKg(String(preview.cargoUsdPerKg));
    }
  }

  function apply() {
    if (!detail) return;
    if (!detail.isFabric) {
      onClose();
      return;
    }
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("id", detail.id);
    formData.set("supplierId", supplierId);
    formData.set("cargoUsdPerKg", cargoUsdPerKg);
    formData.set("usdUahRate", usdUahRate);
    formData.set(
      "costVatOverride",
      vatMode === detail.companyCostVatMode ? "COMPANY" : vatMode,
    );
    formData.set("fabricDeliveryManual", deliveryManual ? "1" : "0");
    formData.set(
      "fabricDeliveryAmount",
      deliveryManual ? deliveryAmount : String(live?.deliveryComputed ?? detail.fabricDeliveryComputed),
    );
    startTransition(async () => {
      const result = await updateOrderMaterialTermsAction(formData);
      if (!result.ok) {
        setError("Не вдалося застосувати умови.");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const open = Boolean(orderItemMaterialId);

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={detail?.name ?? "Матеріал"}
      description="Закупівля, партія та доставка для цієї позиції"
      width="lg"
      footer={
        locked ? (
          <Button variant="ghost" onClick={onClose}>
            Закрити
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Скасувати
            </Button>
            <Button onClick={apply} loading={pending} disabled={pending || loading || !detail}>
              {pending ? "Збереження…" : "Застосувати до замовлення"}
            </Button>
          </>
        )
      }
    >
      {loading && !detail ? (
        <SidePanelSkeleton sections={3} />
      ) : error ? (
        <Banner tone="danger">{error}</Banner>
      ) : detail ? (
        <div className="space-y-4">
          {detail.isFabric && live ? (
            <>
              <Section title="Закупівля">
                {detail.offers.length > 0 ? (
                  <Select
                    label="Постачальник"
                    value={supplierId}
                    disabled={locked}
                    onChange={(event) => handleSupplierChange(event.target.value)}
                  >
                    <option value="">Каталог (основний)</option>
                    {detail.offers.map((offer) => (
                      <option key={offer.offerId} value={offer.supplierId}>
                        {offer.supplierName}
                        {offer.isPrimary ? " · основний" : ""}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="type-caption">
                    {detail.supplierName ?? "Постачальник не заданий у каталозі"}
                  </p>
                )}

                <div className="space-y-1.5">
                  <span className="block text-[11px] font-medium text-[var(--color-text-tertiary)]">
                    ПДВ у ціні постачальника
                  </span>
                  <Segmented
                    disabled={locked || pending}
                    value={vatMode}
                    onChange={(value) => setVatMode(value as VatMode)}
                    options={[
                      { value: "NET", label: "без ПДВ" },
                      { value: "GROSS", label: "з ПДВ" },
                    ]}
                  />
                  <p className="type-caption">
                    За замовчуванням у компанії: {vatLabel(detail.companyCostVatMode)}
                  </p>
                </div>

                <dl className="grid gap-2 text-[13px]">
                  <div>
                    <dt className="text-[var(--color-text-tertiary)]">₴/м (без доставки)</dt>
                    <dd className="tabular text-[15px] font-semibold">
                      {formatMoneyUah(live.purchasePrice)}
                      <span className="ml-1.5 text-[11px] font-normal text-[var(--color-text-tertiary)]">
                        · {vatLabel(vatMode)}
                      </span>
                      {live.pricingModeLabel ? (
                        <span className="ml-1.5 text-[11px] font-normal text-[var(--color-text-tertiary)]">
                          · {live.pricingModeLabel}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </dl>
              </Section>

              <Section title="Партія замовлення">
                <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="text-[var(--color-text-tertiary)]">Кількість виробів</dt>
                    <dd className="tabular font-medium">
                      {detail.totalQuantity} шт
                      {detail.sizeCode ? ` (${detail.sizeCode})` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-tertiary)]">Метраж партії</dt>
                    <dd className="tabular font-medium">{live.metersNeeded} м</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-tertiary)]">Вага партії</dt>
                    <dd className="tabular font-medium">
                      {live.kgNeeded != null ? `${live.kgNeeded} кг` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-tertiary)]">Вартість матеріалу</dt>
                    <dd className="tabular font-semibold">
                      {formatMoneyUah(live.materialPartyCost)}
                    </dd>
                  </div>
                </dl>
                <p className="type-caption">
                  {detail.consumption} {formatUnit(detail.unit)}/од. × (1 + {detail.waste}%) ×{" "}
                  {lineQuantity(detail)} шт = {live.metersNeeded} м
                </p>
              </Section>

              <Section title="Доставка">
                <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="text-[var(--color-text-tertiary)]">Розрахунок</dt>
                    <dd className="tabular font-semibold">
                      {formatMoneyUah(live.deliveryComputed)}
                      {deliveryManual ? (
                        <span className="ml-1.5 text-[11px] font-normal text-[var(--color-text-tertiary)]">
                          · довідково (cargo)
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-tertiary)]">У калькуляції</dt>
                    <dd className="tabular font-semibold">
                      {formatMoneyUah(
                        deliveryManual ? Number(deliveryAmount) || 0 : live.deliveryComputed,
                      )}
                      {deliveryManual ? " · вручну" : " · авто"}
                    </dd>
                  </div>
                </dl>

                {!locked ? (
                  <div className="space-y-3 border-t border-[var(--color-divider)] pt-3">
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-medium text-[var(--color-text-tertiary)]">
                        Як потрапляє в калькуляцію
                      </span>
                      <Segmented
                        disabled={pending}
                        value={deliveryManual ? "manual" : "auto"}
                        onChange={(value) => {
                          const manual = value === "manual";
                          setDeliveryManual(manual);
                          if (!manual && live) {
                            setDeliveryAmount(String(live.deliveryComputed));
                          }
                        }}
                        options={[
                          { value: "auto", label: "Авто (cargo × кг × курс)" },
                          { value: "manual", label: "Вручну (фіксована сума)" },
                        ]}
                      />
                    </div>

                    {deliveryManual ? (
                      <div className="space-y-2">
                        <NumberField
                          label="Сума доставки цієї тканини в калькуляції"
                          suffix="₴"
                          step="0.1"
                          value={deliveryAmount}
                          onChange={setDeliveryAmount}
                        />
                        <p className="type-caption">
                          Окремий рядок у блоці «Доставка», не входить у ₴/м тканини. Авто за
                          cargo було б {formatMoneyUah(live.deliveryComputed)} (
                          {live.kgNeeded ?? "—"} кг × ${live.cargo}/кг × {live.rate} ₴/$).
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-4">
                          <NumberField
                            label="Cargo"
                            prefix="$"
                            suffix="/кг"
                            value={cargoUsdPerKg}
                            placeholder={String(detail.defaultCargoUsdPerKg)}
                            onChange={setCargoUsdPerKg}
                          />
                          <NumberField
                            label="Курс"
                            suffix="₴/$"
                            step="0.01"
                            value={usdUahRate}
                            placeholder={String(detail.defaultUsdUahRate ?? detail.usdUahRate)}
                            onChange={setUsdUahRate}
                          />
                        </div>
                        <p className="type-caption">
                          {live.kgNeeded ?? "—"} кг × ${live.cargo}/кг × {live.rate} ₴/$ ={" "}
                          {formatMoneyUah(live.deliveryComputed)}. Зміни лише для цього
                          замовлення.
                        </p>
                      </>
                    )}
                  </div>
                ) : null}
              </Section>
            </>
          ) : detail && !detail.isFabric ? (
            <Section title="Матеріал">
              <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-[var(--color-text-tertiary)]">Ціна закупівлі</dt>
                  <dd className="tabular font-semibold">{formatMoneyUah(detail.purchasePrice)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-tertiary)]">Партія</dt>
                  <dd className="tabular font-medium">
                    {lineQuantity(detail)} шт · {formatMoneyUah(detail.materialPartyCost ?? 0)}
                  </dd>
                </div>
              </dl>
              <Banner tone="info">
                Для фурнітури та інших матеріалів доставка cargo не застосовується.
              </Banner>
            </Section>
          ) : null}
        </div>
      ) : null}
    </SidePanel>
  );
}
