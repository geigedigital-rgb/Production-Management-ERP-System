"use client";

import { useMemo } from "react";
import { SidePanel } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MaterialPricingToggles } from "@/components/composition/PricingToggles";
import { SpecColorPicker } from "@/components/composition/SpecColorPicker";
import type { DraftMaterialRow } from "@/components/orders/ProductCatalogPanel";
import {
  draftMaterialMetersNeeded,
  draftMaterialNeedsColor,
  isPackagingSku,
  isTrimLikeMaterial,
  materialHasPricingControls,
  materialNeedsPriceModeChoice,
  resolveDraftMaterialPrice,
} from "@/lib/draft-composition";
import type { MaterialCostVatMode } from "@/lib/fabric-pricing";
import { formatMoneyUah, formatUnit } from "@/lib/utils";
import { updateMaterialAvailableColorsAction } from "@/server/domains/catalog/actions";

function round1(value: number) {
  return Math.round(value * 10) / 10;
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
  const pricing = showPricing
    ? resolveDraftMaterialPrice(row, quantitiesBySize, companyCostMode)
    : null;
  const priceCaption =
    pricing?.hint ||
    (showPricing && !vatChosen
      ? "оберіть ПДВ"
      : showPricing && needsPriceMode && !row.priceMode
        ? "оберіть режим ціни"
        : "");
  const isTrim = isTrimLikeMaterial(row);
  const showColorPicker = draftMaterialNeedsColor(row);
  const isFabric = row.materialType === "FABRIC";

  const materialId = row.materialId;

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

  function persistPalette(next: string[]) {
    onChange({ availableColors: next });
    onCatalogColorsChange?.(materialId, next);
    void updateMaterialAvailableColorsAction(materialId, next);
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
        <section className="space-y-1.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
          <p className="type-caption">Поточна ціна в калькуляції</p>
          <p className="text-[16px] font-semibold tabular-nums">{formatMoneyUah(row.price)}</p>
          <p className="type-caption">
            за {formatUnit(row.unit)}
            {priceCaption ? ` · ${priceCaption}` : ""}
            {pricingModeLabel ? ` · ${pricingModeLabel}` : ""}
          </p>
        </section>

        {showPricing ? (
          <section className="space-y-2">
            <p className="type-group-label">Закупівельна ціна</p>
            <p className="type-caption">
              Оберіть ПДВ і режим ціни вручну — значення не підставляються автоматично.
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

        {isFabric ? (
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

        {isFabric ? (
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
            <p className="type-group-label">Колір для специфікації</p>
            <SpecColorPicker
              value={row.lineColor}
              onChange={(next) => onChange({ lineColor: next })}
              materialColors={row.availableColors ?? []}
              onMaterialColorsChange={persistPalette}
              hint={
                isTrim
                  ? "Кольори цієї фурнітури. Можна додати або прибрати з палітри SKU; у специфікації обирається один."
                  : "Оберіть колір для специфікації. Палітра зберігається в картці матеріалу."
              }
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
