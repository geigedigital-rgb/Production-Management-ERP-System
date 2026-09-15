"use client";

import { useMemo, type ReactNode } from "react";
import { SidePanel } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MaterialPricingToggles } from "@/components/composition/PricingToggles";
import { SupplierColorFields } from "@/components/catalog/SupplierColorFields";
import type { DraftMaterialRow } from "@/components/orders/ProductCatalogPanel";
import {
  draftMaterialMetersNeeded,
  draftMaterialNeedsColor,
  isPackagingSku,
  materialHasPricingControls,
  materialNeedsPriceModeChoice,
  resolveDraftMaterialPrice,
} from "@/lib/draft-composition";
import type { MaterialCostVatMode } from "@/lib/fabric-pricing";
import {
  colorsForSupplier,
  reconcileColorForSupplier,
} from "@/lib/supplier-colors";
import { cn, formatMoneyUah, formatUnit } from "@/lib/utils";

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function AttentionHeading({
  children,
  attention,
}: {
  children: ReactNode;
  attention?: boolean;
}) {
  return (
    <p
      className={cn(
        "type-group-label inline-flex items-center gap-1.5",
        attention && "text-[var(--color-warning-text)]",
      )}
    >
      {attention ? (
        <span
          className="flex size-3.5 shrink-0 items-center justify-center rounded-full border border-[var(--color-warning-text)]/45 bg-[var(--color-warning-bg)] text-[10px] font-bold leading-none text-[var(--color-warning-text)] animate-choice-pulse"
          aria-hidden
        >
          ?
        </span>
      ) : null}
      {children}
    </p>
  );
}

export function DraftMaterialLinePanel({
  open,
  row,
  onClose,
  onChange,
  onCatalogColorsChange,
  quantitiesBySize,
  companyCostMode,
  enablePricingControls,
  fabricGlobals,
}: {
  open: boolean;
  row: DraftMaterialRow | null;
  onClose: () => void;
  onChange: (patch: Partial<DraftMaterialRow>) => void;
  /** Sync palette back to material catalog (other lines / future picks). */
  onCatalogColorsChange?: (materialId: string, colors: string[]) => void;
  quantitiesBySize?: Record<string, number>;
  companyCostMode: MaterialCostVatMode;
  enablePricingControls: boolean;
  fabricGlobals?: { usdUahRate: number; fabricCargoUsdPerKg: number };
}) {
  const metersNeeded = useMemo(() => {
    if (!row || !quantitiesBySize) return 0;
    return draftMaterialMetersNeeded(row, quantitiesBySize);
  }, [row, quantitiesBySize]);

  if (!row) return null;

  const showPricing = enablePricingControls && materialHasPricingControls(row);
  const hasCut = row.priceMeterUahCutVat != null && row.priceMeterUahCutVat > 0;
  const vatChosen = row.costVatMode != null;
  const needsPriceMode = materialNeedsPriceModeChoice(row);
  const priceModeMissing = needsPriceMode && !row.priceMode;
  const pricing = showPricing
    ? resolveDraftMaterialPrice(row, quantitiesBySize, companyCostMode)
    : null;
  const priceCaption =
    pricing?.hint ||
    (showPricing && !vatChosen
      ? "оберіть ПДВ"
      : showPricing && priceModeMissing
        ? "оберіть режим ціни"
        : "");
  const showColorPicker = enablePricingControls && draftMaterialNeedsColor(row);
  const isFabric = row.materialType === "FABRIC";
  const offers = row.supplierOffers ?? [];
  const supplierMissing = showColorPicker && offers.length > 0 && !row.supplierId;
  const colorMissing =
    showColorPicker &&
    !row.lineColor?.trim() &&
    (offers.length === 0 || Boolean(row.supplierId));

  const wholesaleThreshold = hasCut
    ? row.minWholesaleMeters != null && row.minWholesaleMeters > 0
      ? row.minWholesaleMeters
      : row.metersPerRoll != null && row.metersPerRoll > 0
        ? row.metersPerRoll
        : null
    : null;
  const isWholesale =
    !hasCut || (wholesaleThreshold != null && metersNeeded >= wholesaleThreshold);
  const pricingModeLabel = !hasCut
    ? "гурт"
    : pricing?.pricingMode === "wholesale" || isWholesale
      ? "гурт"
      : pricing?.pricingMode === "cut"
        ? "відріз"
        : pricing?.pricingMode === "standard"
          ? "стандарт"
          : null;

  const cargo =
    row.cargoUsdPerKg != null && row.cargoUsdPerKg >= 0
      ? row.cargoUsdPerKg
      : (fabricGlobals?.fabricCargoUsdPerKg ?? 0);
  const rate =
    row.usdUahRate != null && row.usdUahRate > 0
      ? row.usdUahRate
      : (fabricGlobals?.usdUahRate ?? 0);
  const metersPerKg = row.metersPerKg != null && row.metersPerKg > 0 ? row.metersPerKg : null;
  const kgNeeded =
    metersPerKg != null && metersNeeded > 0
      ? round1(metersNeeded / metersPerKg)
      : null;
  const deliveryAuto =
    kgNeeded != null && cargo > 0 && rate > 0 ? round1(kgNeeded * cargo * rate) : 0;
  const deliveryManual = Boolean(row.fabricDeliveryManual);
  const deliveryInCalc = deliveryManual
    ? Math.max(0, Number(row.fabricDeliveryAmount) || 0)
    : deliveryAuto;

  function changeSupplier(next: string | null) {
    const color = reconcileColorForSupplier({
      color: row.lineColor,
      supplierId: next,
      offers,
      materialFallback: row.availableColors,
    });
    // Choosing supplier clears color if not in the new palette — user must confirm color.
    const palette = colorsForSupplier(offers, next, row.availableColors);
    const keep =
      color && row.lineColor && color.toLowerCase() === row.lineColor.trim().toLowerCase()
        ? color
        : null;
    onChange({
      supplierId: next,
      lineColor: keep,
      availableColors: palette.length > 0 ? palette : row.availableColors,
    });
    if (palette.length > 0) onCatalogColorsChange?.(row.materialId, palette);
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={row.name}
      description="Параметри позиції для цієї специфікації замовлення"
      width="md"
      elevated
      footer={
        <Button type="button" onClick={onClose}>
          Готово
        </Button>
      }
    >
      <div className="space-y-5">
        {enablePricingControls ? (
        <section className="space-y-1.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
          <p className="type-caption">Поточна ціна в калькуляції</p>
          <p className="text-[16px] font-semibold tabular-nums">{formatMoneyUah(row.price)}</p>
          <p className="type-caption">
            за {formatUnit(row.unit)}
            {priceCaption ? ` · ${priceCaption}` : ""}
            {pricingModeLabel ? ` · ${pricingModeLabel}` : ""}
          </p>
        </section>
        ) : (
        <p className="type-caption rounded-[var(--radius-control)] border border-dashed border-[var(--color-border)] px-3 py-2">
          Ціна, ПДВ, доставка і колір постачальника виставляються в замовленні після створення
          (доступ адміна).
        </p>
        )}

        {showPricing ? (
          <section className="space-y-2">
            <AttentionHeading attention={!vatChosen || priceModeMissing}>
              Закупівельна ціна
            </AttentionHeading>
            <p className="type-caption">
              {!vatChosen
                ? "Оберіть ПДВ — без цього ціна в калькуляції не зафіксована."
                : priceModeMissing
                  ? "Оберіть режим ціни (авто / відріз / гурт)."
                  : "ПДВ і режим ціни для цієї позиції."}
            </p>
            <MaterialPricingToggles
              costVatMode={row.costVatMode}
              priceMode={row.priceMode}
              hasCut={hasCut}
              onCostVatMode={(mode) => onChange({ costVatMode: mode })}
              onPriceMode={(mode) => onChange({ priceMode: mode })}
            />
          </section>
        ) : null}

        {enablePricingControls && isFabric ? (
          <section className="space-y-2">
            <p className="type-group-label">Гурт / партія</p>
            <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-[var(--color-text-tertiary)]">Витрата зараз</dt>
                <dd className="tabular font-medium">{round1(metersNeeded)} м</dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-tertiary)]">Межа гурту</dt>
                <dd className="tabular font-medium">
                  {wholesaleThreshold != null ? `${wholesaleThreshold} м` : "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[var(--color-text-tertiary)]">Режим</dt>
                <dd className="font-medium">
                  {isWholesale ? "Гурт (опт)" : "Відріз / стандарт"}
                  {row.wholesaleNote ? (
                    <span className="type-caption ml-1.5">· {row.wholesaleNote}</span>
                  ) : null}
                </dd>
              </div>
            </dl>
            {!hasCut ? (
              <p className="type-caption">
                У каталозі лише гуртова ціна — межа витрати не застосовується.
              </p>
            ) : wholesaleThreshold != null ? (
              <p className="type-caption">
                {isWholesale
                  ? `Витрата ≥ ${wholesaleThreshold} м — застосовується гуртова ціна й доставка за партією.`
                  : `До гурту ще ${round1(Math.max(0, wholesaleThreshold - metersNeeded))} м.`}
              </p>
            ) : null}
          </section>
        ) : null}

        {enablePricingControls && isFabric ? (
          <section className="space-y-2">
            <p className="type-group-label">Доставка</p>
            <p className="type-caption">
              Окремий рядок у калькуляції (не входить у ₴/м). Впливає на кінцеву ціну.
            </p>
            <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-[var(--color-text-tertiary)]">Вага партії</dt>
                <dd className="tabular font-medium">
                  {kgNeeded != null ? `${kgNeeded} кг` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-tertiary)]">У калькуляції</dt>
                <dd className="tabular font-semibold">
                  {formatMoneyUah(deliveryInCalc)}
                  {deliveryManual ? " · вручну" : " · авто"}
                </dd>
              </div>
            </dl>
            <div className="inline-flex rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-0.5">
              <button
                type="button"
                onClick={() =>
                  onChange({
                    fabricDeliveryManual: false,
                    fabricDeliveryAmount: deliveryAuto,
                    cargoUsdPerKg: cargo,
                    usdUahRate: rate,
                  })
                }
                className={`rounded-[5px] px-2.5 py-1 text-[12px] font-medium ${
                  !deliveryManual
                    ? "bg-white text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                Авто (cargo)
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    fabricDeliveryManual: true,
                    fabricDeliveryAmount: deliveryInCalc || deliveryAuto,
                  })
                }
                className={`rounded-[5px] px-2.5 py-1 text-[12px] font-medium ${
                  deliveryManual
                    ? "bg-white text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                Вручну
              </button>
            </div>
            {deliveryManual ? (
              <Input
                label="Сума доставки, ₴"
                type="number"
                min={0}
                step="0.1"
                value={row.fabricDeliveryAmount != null ? String(row.fabricDeliveryAmount) : ""}
                onChange={(event) =>
                  onChange({
                    fabricDeliveryManual: true,
                    fabricDeliveryAmount: Math.max(0, Number(event.target.value) || 0),
                  })
                }
                hint={`Авто було б ${formatMoneyUah(deliveryAuto)}`}
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  label="Cargo $/кг"
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.cargoUsdPerKg != null ? String(row.cargoUsdPerKg) : String(cargo)}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    onChange({
                      cargoUsdPerKg: Number.isFinite(next) ? next : null,
                      fabricDeliveryManual: false,
                    });
                  }}
                  hint={
                    fabricGlobals
                      ? `База: ${fabricGlobals.fabricCargoUsdPerKg}`
                      : undefined
                  }
                />
                <Input
                  label="Курс ₴/$"
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.usdUahRate != null ? String(row.usdUahRate) : String(rate)}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    onChange({
                      usdUahRate: Number.isFinite(next) && next > 0 ? next : null,
                      fabricDeliveryManual: false,
                    });
                  }}
                  hint={fabricGlobals ? `База: ${fabricGlobals.usdUahRate}` : undefined}
                />
              </div>
            )}
            {!deliveryManual && kgNeeded != null ? (
              <p className="type-caption tabular">
                {kgNeeded} кг × ${cargo}/кг × {rate} ₴/$ = {formatMoneyUah(deliveryAuto)}
              </p>
            ) : null}
          </section>
        ) : null}

        {showColorPicker ? (
          <section className="space-y-2">
            <AttentionHeading attention={supplierMissing || colorMissing}>
              Постачальник і колір
            </AttentionHeading>
            <p className="type-caption">
              {supplierMissing
                ? "Спочатку оберіть постачальника — палітра кольорів залежить від нього."
                : colorMissing
                  ? "Оберіть колір з палітри обраного постачальника."
                  : "Палітра береться з умов постачальника в картці матеріалу."}
            </p>
            <SupplierColorFields
              supplierId={row.supplierId}
              color={row.lineColor}
              offers={offers}
              materialFallbackColors={row.availableColors ?? []}
              onSupplierChange={changeSupplier}
              onColorChange={(next) => onChange({ lineColor: next })}
            />
          </section>
        ) : isPackagingSku(row) ? (
          <p className="type-caption text-[var(--color-text-tertiary)]">
            Для пакування колір у специфікації не вказується.
          </p>
        ) : null}

        <section className="space-y-1 type-caption text-[var(--color-text-tertiary)]">
          <p>Норма й відходи редагуються прямо в таблиці.</p>
          <p>
            Базова норма: {row.consumption} {formatUnit(row.unit)} · відходи {row.waste}%
          </p>
        </section>
      </div>
    </SidePanel>
  );
}
