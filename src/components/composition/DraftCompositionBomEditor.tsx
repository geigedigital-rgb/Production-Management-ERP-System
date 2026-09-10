"use client";

import { useState, type ReactNode } from "react";
import { MaterialCreatePanel } from "@/app/(app)/settings/resources/MaterialCreateForm";
import { OperationCreatePanel } from "@/app/(app)/settings/operations/OperationCreateForm";
import { CopySizeSpec, SizeScopeTabs } from "@/components/catalog/SizeScopeTabs";
import { SizeBomScopeHint } from "@/components/catalog/SizeBomScopeHint";
import {
  effectiveOversizeConsumption,
  isOversizeCode,
  OVERSIZE_DEFAULT_COEFFS,
  oversizeUpliftCaption,
} from "@/lib/size-coeffs";
import {
  CompositionAddBar,
  DraftAddMaterialForm,
  DraftAddOperationForm,
  type DecorationCatalogOption,
  type MaterialCatalogOption,
  type OperationCatalogOption,
} from "@/components/composition/DraftCompositionForms";
import { IconMaterials, IconOperations, IconTrash } from "@/components/ui/Icons";
import {
  type DraftComposition,
  type DraftMaterialRow,
  type DraftOperationRow,
} from "@/components/orders/ProductCatalogPanel";
import {
  draftKey,
  draftMaterialChoiceSummary,
  draftMaterialMissingChoices,
  draftMaterialPricingChoiceHint,
  draftMaterialShowsColorSlot,
  draftMaterialRowPricingReady,
  materialHasPricingControls,
  materialUnitCost,
  operationUnitCost,
  pricingFieldsFromCatalogOption,
  resolveDraftMaterialPrice,
} from "@/lib/draft-composition";
import { DraftChoiceAttention } from "@/components/composition/DraftChoiceAttention";
import { DraftColorSlotMarker } from "@/components/composition/DraftColorSlotMarker";
import type { MaterialCostVatMode } from "@/lib/fabric-pricing";
import {
  CUT_RATES_TAB_HINT,
  isCutOperationName,
  summarizeCutOperationDisplay,
  type CutRateTier,
} from "@/lib/cut-rate";
import { operationMethodLabel } from "@/lib/operation-labels";
import {
  ALL_SIZES,
  attachDraftScope,
  customizedSizeCodes,
  draftConsumption,
  patchDraftConsumption,
  patchDraftScope,
  type SizeScope,
  visibleDraftRows,
} from "@/lib/size-bom";
import { formatMoneyUah, formatUnit, cn } from "@/lib/utils";
import {
  CellStack,
  Table,
  TableCard,
  TableEmpty,
  TableToolbar,
  TBody,
  TD,
  TFoot,
  TH,
  THead,
  TR,
} from "@/components/ui/Table";

import { DraftMaterialLinePanel } from "@/components/composition/DraftMaterialLinePanel";

export function DraftCompositionBomEditor({
  composition,
  onCompositionChange,
  sizes,
  materialOptions = [],
  operationOptions = [],
  decorationOptions = [],
  unitOptions = [],
  onMaterialCatalogAdd,
  onMaterialCatalogColorsChange,
  onOperationCatalogAdd,
  onDecorationCatalogAdd,
  quantitiesBySize,
  quantityHint = 100,
  showSubtotals = true,
  scopeHint,
  enableLinePricingControls = false,
  companyCostMode = "NET",
  cutRatePreview,
  cutRateHint = CUT_RATES_TAB_HINT,
  fabricGlobals,
}: {
  composition: DraftComposition;
  onCompositionChange: (next: DraftComposition) => void;
  sizes: Array<{ code: string; nameUk: string }>;
  materialOptions?: MaterialCatalogOption[];
  operationOptions?: OperationCatalogOption[];
  decorationOptions?: DecorationCatalogOption[];
  unitOptions?: Array<{ id: string; label: string }>;
  onMaterialCatalogAdd?: (option: MaterialCatalogOption) => void;
  onMaterialCatalogColorsChange?: (materialId: string, colors: string[]) => void;
  onOperationCatalogAdd?: (option: OperationCatalogOption) => void;
  onDecorationCatalogAdd?: (option: DecorationCatalogOption) => void;
  quantitiesBySize?: Record<string, number>;
  quantityHint?: number;
  showSubtotals?: boolean;
  scopeHint?: ReactNode | ((sizeScope: SizeScope) => ReactNode);
  /** Order draft: per-row ПДВ / гурт·відріз toggles with live price. */
  enableLinePricingControls?: boolean;
  companyCostMode?: MaterialCostVatMode;
  cutRatePreview?: { optimalQty?: number | null; tiers: CutRateTier[] };
  cutRateHint?: string;
  fabricGlobals?: { usdUahRate: number; fabricCargoUsdPerKg: number };
}) {
  const [sizeScope, setSizeScope] = useState<SizeScope>(ALL_SIZES);
  const [selectedMaterialKey, setSelectedMaterialKey] = useState<string | null>(null);
  const sizeCodes = sizes.map((size) => size.code);
  const totalQty = quantitiesBySize
    ? sizes.reduce((sum, size) => sum + (quantitiesBySize[size.code] || 0), 0)
    : 0;
  const controlQty = totalQty > 0 ? totalQty : quantityHint;
  const visibleMaterials = visibleDraftRows(composition.materials, sizeScope);
  const visibleOperations = visibleDraftRows(composition.operations, sizeScope);
  const customized = customizedSizeCodes({
    allCodes: sizeCodes,
    materials: composition.materials,
    operations: composition.operations,
  });
  const hasOversizeSizes = sizes.some((size) => isOversizeCode(size.code));
  const scopeIsOversize = isOversizeCode(sizeScope);
  const resolvedScopeHint =
    typeof scopeHint === "function" ? scopeHint(sizeScope) : scopeHint;
  const selectedMaterial =
    composition.materials.find((row) => row.key === selectedMaterialKey) ?? null;

  const materialsSubtotal =
    quantitiesBySize && totalQty > 0
      ? sizes.reduce((sum, size) => {
          const qty = quantitiesBySize[size.code] || 0;
          if (qty <= 0) return sum;
          return (
            sum +
            visibleDraftRows(composition.materials, size.code).reduce((inner, row) => {
              const consumption = draftConsumption(row, size.code);
              return inner + consumption * (1 + row.waste / 100) * row.price * qty;
            }, 0)
          );
        }, 0)
      : composition.materials.reduce((sum, row) => sum + materialUnitCost(row), 0) * controlQty;
  const operationsSubtotal =
    composition.operations
      .filter((row) => !isCutOperationName(row.name))
      .reduce((sum, row) => sum + operationUnitCost(row, controlQty), 0) * controlQty;
  const hasCutOperation = composition.operations.some((row) => isCutOperationName(row.name));

  function withResolvedPrice(row: DraftMaterialRow): DraftMaterialRow {
    if (!enableLinePricingControls || !materialHasPricingControls(row)) return row;
    if (!draftMaterialRowPricingReady(row)) {
      if (!row.costVatMode) return row;
      const { purchasePrice } = resolveDraftMaterialPrice(row, quantitiesBySize, companyCostMode);
      return Math.abs(purchasePrice - row.price) < 0.0001 ? row : { ...row, price: purchasePrice };
    }
    const { purchasePrice } = resolveDraftMaterialPrice(row, quantitiesBySize, companyCostMode);
    return { ...row, price: purchasePrice };
  }

  function removeMaterial(key: string) {
    onCompositionChange({
      ...composition,
      materials: composition.materials
        .map((row) => (row.key === key ? patchDraftScope(row, sizeScope, sizeCodes) : row))
        .filter((row): row is DraftMaterialRow => Boolean(row)),
    });
  }

  function removeOperation(key: string) {
    onCompositionChange({
      ...composition,
      operations: composition.operations
        .map((row) => (row.key === key ? patchDraftScope(row, sizeScope, sizeCodes) : row))
        .filter((row): row is DraftOperationRow => Boolean(row)),
    });
  }

  function updateMaterial(key: string, patch: Partial<DraftMaterialRow>) {
    const target = composition.materials.find((row) => row.key === key);
    onCompositionChange({
      ...composition,
      materials: composition.materials.map((row) => {
        if (row.key === key) return withResolvedPrice({ ...row, ...patch });
        if (
          patch.availableColors &&
          target &&
          row.materialId === target.materialId
        ) {
          return { ...row, availableColors: patch.availableColors };
        }
        return row;
      }),
    });
  }

  function addMaterial(row: DraftMaterialRow) {
    onCompositionChange({
      ...composition,
      materials: [...composition.materials, attachDraftScope(withResolvedPrice(row), sizeScope)],
    });
  }

  function addOperation(row: DraftOperationRow) {
    onCompositionChange({
      ...composition,
      operations: [...composition.operations, attachDraftScope(row, sizeScope)],
    });
  }

  function copySpecTo(toCodes: string[]) {
    onCompositionChange({
      ...composition,
      materials: composition.materials.map((row) => {
        if (!visibleDraftRows([row], sizeScope).length || sizeScope === ALL_SIZES) return row;
        const consumption = draftConsumption(row, sizeScope);
        const current = row.sizeCodes?.length ? [...row.sizeCodes] : null;
        const nextCodes = current ? [...new Set([...current, ...toCodes])] : row.sizeCodes;
        const sizeConsumption = { ...row.sizeConsumption };
        for (const code of toCodes) sizeConsumption[code] = consumption;
        sizeConsumption[sizeScope] = consumption;
        return withResolvedPrice({ ...row, sizeCodes: nextCodes, sizeConsumption });
      }),
      operations: composition.operations.map((row) => {
        if (!visibleDraftRows([row], sizeScope).length || sizeScope === ALL_SIZES) return row;
        if (!row.sizeCodes?.length) return row;
        return { ...row, sizeCodes: [...new Set([...row.sizeCodes, ...toCodes])] };
      }),
    });
  }

  return (
    <div className="space-y-3">
      <TableCard>
        <TableToolbar
          left={
            <div className="flex min-w-0 flex-col gap-2">
              <span className="type-subsection">Матеріали</span>
              {sizes.length > 1 ? (
                <>
                  <SizeScopeTabs
                    sizes={sizes}
                    value={sizeScope}
                    onChange={setSizeScope}
                    customized={customized}
                  />
                  {sizes.length > 1 ? (
                    <SizeBomScopeHint sizeScope={sizeScope} hasOversizeSizes={hasOversizeSizes} />
                  ) : null}
                  {resolvedScopeHint}
                  {sizeScope !== ALL_SIZES ? (
                    <CopySizeSpec from={sizeScope} sizes={sizes} onCopy={copySpecTo} />
                  ) : null}
                </>
              ) : (
                resolvedScopeHint
              )}
            </div>
          }
        />
        <Table>
          <THead>
            <TH className="min-w-[12rem] w-[38%]">Матеріал</TH>
            <TH align="right">Норма / од.</TH>
            <TH align="right">Відходи</TH>
            <TH align="right">Ціна</TH>
            <TH align="right">Собівартість / од.</TH>
            <TH width="44px" />
          </THead>
          <TBody>
            {visibleMaterials.length === 0 ? (
              <TableEmpty
                colSpan={6}
                icon={<IconMaterials size={22} />}
                title={sizeScope === ALL_SIZES ? "Матеріалів ще немає" : "Немає матеріалів для цього розміру"}
                description="Додайте з рядка нижче або створіть новий матеріал."
              />
            ) : (
              visibleMaterials.map((row) => {
                const consumption = draftConsumption(row, sizeScope);
                const mixed =
                  sizeScope === ALL_SIZES && Object.keys(row.sizeConsumption ?? {}).length > 0;
                const showPricing =
                  enableLinePricingControls && materialHasPricingControls(row);
                const pricing = showPricing
                  ? resolveDraftMaterialPrice(row, quantitiesBySize, companyCostMode)
                  : null;
                const choiceSummary = draftMaterialChoiceSummary(row, companyCostMode, {
                  includePricing: showPricing,
                });
                const sizeSubtitle = row.sizeCodes?.length
                  ? row.sizeCodes.join(" · ")
                  : mixed
                    ? "Норма різна по розмірах"
                    : hasOversizeSizes
                      ? oversizeUpliftCaption()
                      : null;
                const subtitle = [sizeSubtitle, choiceSummary].filter(Boolean).join(" · ") || undefined;
                const isSelected = selectedMaterialKey === row.key;
                const showColorSlot = draftMaterialShowsColorSlot(row, {
                  enableLinePricingControls,
                });
                const missingChoices = draftMaterialMissingChoices(row, {
                  enableLinePricingControls,
                  companyCostMode,
                });
                const needsAttention = missingChoices.length > 0;
                const attentionTitle = needsAttention
                  ? `Потрібно: ${missingChoices.join(", ")}`
                  : undefined;
                const pricingChoiceHint = draftMaterialPricingChoiceHint(row, {
                  enableLinePricingControls,
                });
                const showMarker = showColorSlot || needsAttention;
                const baseUnitCost = consumption * (1 + row.waste / 100) * row.price;
                const displayUnitCost = scopeIsOversize
                  ? baseUnitCost * OVERSIZE_DEFAULT_COEFFS.materialCoeff
                  : baseUnitCost;
                const oversizeNorm =
                  hasOversizeSizes || scopeIsOversize
                    ? effectiveOversizeConsumption(consumption)
                    : null;
                return (
                  <TR
                    key={row.key}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected
                        ? "bg-[var(--color-tint-sage)]/50"
                        : "hover:bg-[var(--color-surface-hover)]",
                    )}
                    onClick={() => setSelectedMaterialKey(row.key)}
                  >
                    <TD title={row.name} className="min-w-[12rem] w-[38%] align-top">
                      <div className="flex items-start gap-2">
                        {showMarker ? (
                          <DraftColorSlotMarker
                            value={row.lineColor}
                            attention={needsAttention}
                            attentionTitle={attentionTitle}
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <CellStack title={row.name} subtitle={subtitle} wrap />
                          <DraftChoiceAttention hint={pricingChoiceHint} />
                        </div>
                      </div>
                    </TD>
                    <TD align="right" onClick={(event) => event.stopPropagation()}>
                      <span className="inline-flex flex-col items-end gap-0.5">
                        <span className="inline-flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min={0}
                            step="0.0001"
                            value={consumption}
                            onChange={(event) =>
                              updateMaterial(
                                row.key,
                                patchDraftConsumption(
                                  row,
                                  sizeScope,
                                  Math.max(0, Number(event.target.value) || 0),
                                ),
                              )
                            }
                            className="h-7 w-[72px] rounded-[6px] border border-[var(--color-border)] bg-white px-1.5 text-right text-[12.5px] tabular outline-none focus:border-[var(--color-primary-500)]"
                          />
                          <span className="text-[12px] text-[var(--color-text-secondary)]">
                            {formatUnit(row.unit)}
                          </span>
                        </span>
                        {oversizeNorm != null ? (
                          <span className="text-[10px] text-[var(--color-text-quiet)]">
                            3XL+ ≈ {oversizeNorm} {formatUnit(row.unit)}
                          </span>
                        ) : null}
                      </span>
                    </TD>
                    <TD align="right" onClick={(event) => event.stopPropagation()}>
                      <span className="inline-flex items-center justify-end gap-0.5">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.waste}
                          onChange={(event) =>
                            updateMaterial(row.key, {
                              waste: Math.max(0, Number(event.target.value) || 0),
                            })
                          }
                          className="h-7 w-[56px] rounded-[6px] border border-[var(--color-border)] bg-white px-1.5 text-right text-[12.5px] tabular outline-none focus:border-[var(--color-primary-500)]"
                        />
                        <span className="text-[12px] text-[var(--color-text-secondary)]">%</span>
                      </span>
                    </TD>
                    <TD numeric className="text-[var(--color-text-secondary)]">
                      <div>{formatMoneyUah(row.price)}</div>
                      {pricing?.hint ? (
                        <div className="mt-0.5 text-[10px] font-normal leading-tight text-[var(--color-text-tertiary)]">
                          {pricing.hint}
                        </div>
                      ) : null}
                    </TD>
                    <TD numeric className="font-medium">
                      <span className="inline-flex flex-col items-end gap-0.5">
                        <span>{formatMoneyUah(displayUnitCost)}</span>
                        {scopeIsOversize ? (
                          <span className="text-[10px] font-normal text-[var(--color-text-quiet)]">
                            база {formatMoneyUah(baseUnitCost)}
                          </span>
                        ) : null}
                      </span>
                    </TD>
                    <TD align="center" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={`Прибрати ${row.name}`}
                        onClick={() => {
                          if (selectedMaterialKey === row.key) setSelectedMaterialKey(null);
                          removeMaterial(row.key);
                        }}
                        className="rounded-[var(--radius-control)] p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                      >
                        <IconTrash size={15} />
                      </button>
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
          {showSubtotals && composition.materials.length > 0 ? (
            <TFoot>
              <tr>
                <TD colSpan={4} className="text-[var(--color-text-secondary)]">
                  Матеріали разом на {controlQty} шт
                  {totalQty <= 0 ? " (орієнтир)" : ""}
                </TD>
                <TD numeric>{formatMoneyUah(materialsSubtotal)}</TD>
                <TD />
              </tr>
            </TFoot>
          ) : null}
        </Table>
        <CompositionAddBar
          createAction={
            <MaterialCreatePanel
              units={unitOptions}
              variant="ghost"
              size="sm"
              triggerLabel="Новий матеріал"
              onCreated={(result) => {
                const created = result.material as
                  | {
                      id: string;
                      nameUk: string;
                      unit: string;
                      price: number;
                      defaultWaste: number;
                      materialType?: string | null;
                      priceMeterUahNoVat?: number | null;
                      priceMeterUahVat?: number | null;
                      priceMeterUahCutVat?: number | null;
                      metersPerRoll?: number | null;
                      minWholesaleMeters?: number | null;
                      costVatOverride?: "NET" | "GROSS" | null;
                      availableColors?: string[];
                    }
                  | undefined;
                if (!created) return;
                const option: MaterialCatalogOption = {
                  id: created.id,
                  label: `${created.nameUk} (${created.unit})`,
                  name: created.nameUk,
                  unit: created.unit,
                  price: created.price,
                  defaultWaste: created.defaultWaste,
                  materialType: created.materialType,
                  priceMeterUahNoVat: created.priceMeterUahNoVat,
                  priceMeterUahVat: created.priceMeterUahVat,
                  priceMeterUahCutVat: created.priceMeterUahCutVat,
                  metersPerRoll: created.metersPerRoll,
                  minWholesaleMeters: created.minWholesaleMeters,
                  costVatOverride: created.costVatOverride,
                  availableColors: created.availableColors ?? [],
                };
                onMaterialCatalogAdd?.(option);
                addMaterial({
                  key: draftKey(),
                  materialId: option.id,
                  name: option.name ?? option.label,
                  unit: option.unit,
                  consumption: 1,
                  waste: option.defaultWaste,
                  ...pricingFieldsFromCatalogOption(option, companyCostMode, {
                    deferUserChoices: enableLinePricingControls,
                  }),
                });
              }}
            />
          }
        >
          <DraftAddMaterialForm
            options={materialOptions}
            onAdd={addMaterial}
            compact
            companyCostMode={companyCostMode}
            enablePricingControls={enableLinePricingControls}
            quantitiesBySize={quantitiesBySize}
          />
        </CompositionAddBar>
      </TableCard>

      <TableCard>
        <TableToolbar left={<span className="type-subsection">Операції</span>} />
        <Table>
          <THead>
            <TH>Операція</TH>
            <TH>Метод</TH>
            <TH align="right">Вартість / од.</TH>
            <TH width="44px" />
          </THead>
          <TBody>
            {visibleOperations.length === 0 ? (
              <TableEmpty
                colSpan={4}
                icon={<IconOperations size={22} />}
                title={sizeScope === ALL_SIZES ? "Операцій ще немає" : "Немає операцій для цього розміру"}
                description="Додайте з рядка нижче або створіть нову операцію."
              />
            ) : (
              visibleOperations.map((row) => {
                const isCut = isCutOperationName(row.name);
                const cutDisplay =
                  isCut && cutRatePreview
                    ? summarizeCutOperationDisplay({
                        optimalQty: cutRatePreview.optimalQty,
                        tiers: cutRatePreview.tiers,
                        fallbackRate: row.unitRate ?? 0,
                        previewQty: controlQty,
                      })
                    : null;
                const cutRange =
                  cutDisplay?.minRate != null &&
                  cutDisplay.maxRate != null &&
                  cutDisplay.minRate !== cutDisplay.maxRate
                    ? `діапазон ${formatMoneyUah(cutDisplay.minRate)}–${formatMoneyUah(cutDisplay.maxRate)}`
                    : cutDisplay?.previewRate != null
                      ? `${cutDisplay.previewQty} шт`
                      : null;
                return (
                <TR key={row.key}>
                  <TD className="font-medium">{row.name}</TD>
                  <TD className="min-w-0">
                    {isCut && cutRange ? (
                      <div className="min-w-0">
                        <div className="text-[13px] text-[var(--color-text-secondary)]">
                          {cutDisplay?.methodLabel ?? "Крій за тиражем"}
                        </div>
                        <div className="mt-0.5 break-words text-[12px] text-[var(--color-text-quiet)]">
                          {cutRange}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[var(--color-text-secondary)]">
                        {isCut ? cutDisplay?.methodLabel ?? "Крій за тиражем" : operationMethodLabel(row.method)}
                      </span>
                    )}
                  </TD>
                  <TD
                    numeric={!isCut}
                    align={isCut ? "right" : undefined}
                    className={cn("font-medium", isCut && "!whitespace-normal")}
                    title={isCut ? cutRateHint : undefined}
                  >
                    {isCut ? (
                      cutDisplay?.configured && cutDisplay.previewRate != null
                        ? formatMoneyUah(cutDisplay.previewRate)
                        : "—"
                    ) : (
                      formatMoneyUah(operationUnitCost(row, controlQty))
                    )}
                  </TD>
                  <TD align="center">
                    <button
                      type="button"
                      aria-label={`Прибрати ${row.name}`}
                      onClick={() => removeOperation(row.key)}
                      className="rounded-[var(--radius-control)] p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                    >
                      <IconTrash size={15} />
                    </button>
                  </TD>
                </TR>
                );
              })
            )}
          </TBody>
          {showSubtotals && composition.operations.length > 0 ? (
            <TFoot>
              <tr>
                <TD colSpan={2} className="text-[var(--color-text-secondary)]">
                  {hasCutOperation ? "Операції без крою" : "Операції разом"} на {controlQty} шт
                  {totalQty <= 0 ? " (орієнтир)" : ""}
                </TD>
                <TD numeric>{formatMoneyUah(operationsSubtotal)}</TD>
                <TD />
              </tr>
              {hasCutOperation ? (
                <tr>
                  <TD colSpan={2} className="text-[var(--color-text-secondary)]">
                    Крій
                  </TD>
                  <TD numeric className="font-medium">
                    {(() => {
                      const cutRow = composition.operations.find((row) => isCutOperationName(row.name));
                      if (!cutRow || !cutRatePreview) return "—";
                      const cut = summarizeCutOperationDisplay({
                        optimalQty: cutRatePreview.optimalQty,
                        tiers: cutRatePreview.tiers,
                        fallbackRate: cutRow.unitRate ?? 0,
                        previewQty: controlQty,
                      });
                      return cut.previewRate != null ? formatMoneyUah(cut.previewRate) : "—";
                    })()}
                  </TD>
                  <TD />
                </tr>
              ) : null}
            </TFoot>
          ) : null}
        </Table>
        <CompositionAddBar
          createAction={
            <OperationCreatePanel
              variant="ghost"
              size="sm"
              triggerLabel="Нова операція"
              onCreated={(result) => {
                const created = result.operation as
                  | {
                      id: string;
                      nameUk: string;
                      method: string;
                      unitRate: number | null;
                      shiftCost: number | null;
                      standardOutput: number | null;
                      rateTiers?: Array<{ minQuantity: number; ratePerUnit: number }>;
                    }
                  | undefined;
                if (!created) return;
                const option: OperationCatalogOption = {
                  id: created.id,
                  label: created.nameUk,
                  method: created.method,
                  unitRate: created.unitRate,
                  shiftCost: created.shiftCost,
                  standardOutput: created.standardOutput,
                  rateTiers: created.rateTiers,
                };
                onOperationCatalogAdd?.(option);
                addOperation({
                  key: draftKey(),
                  operationId: option.id,
                  name: option.label,
                  method: option.method,
                  unitRate: option.unitRate,
                  shiftCost: option.shiftCost,
                  standardOutput: option.standardOutput,
                  rateTiers: option.rateTiers,
                });
              }}
            />
          }
        >
          <DraftAddOperationForm options={operationOptions} onAdd={addOperation} compact />
        </CompositionAddBar>
      </TableCard>

      <p className="type-caption rounded-[10px] border border-dashed border-[var(--color-border)] px-3 py-2.5">
        Нанесення додається пізніше в замовленні (шовкотрафарет за тиражем і кольорами). У базовому
        виробі його немає.
      </p>

      <DraftMaterialLinePanel
        open={Boolean(selectedMaterial)}
        row={selectedMaterial}
        onClose={() => setSelectedMaterialKey(null)}
        onChange={(patch) => {
          if (!selectedMaterialKey) return;
          updateMaterial(selectedMaterialKey, patch);
        }}
        onCatalogColorsChange={onMaterialCatalogColorsChange}
        quantitiesBySize={quantitiesBySize}
        companyCostMode={companyCostMode}
        enablePricingControls={enableLinePricingControls}
        fabricGlobals={fabricGlobals}
      />
    </div>
  );
}
