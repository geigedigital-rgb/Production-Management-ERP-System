"use client";

import { useState, type ReactNode } from "react";
import { MaterialCreatePanel } from "@/app/(app)/settings/resources/MaterialCreateForm";
import { OperationCreatePanel } from "@/app/(app)/settings/operations/OperationCreateForm";
import { DecorationCreatePanel } from "@/app/(app)/settings/applications/DecorationCreateForm";
import { CopySizeSpec, SizeScopeTabs } from "@/components/catalog/SizeScopeTabs";
import {
  CompositionAddBar,
  DraftAddDecorationForm,
  DraftAddMaterialForm,
  DraftAddOperationForm,
  type DecorationCatalogOption,
  type MaterialCatalogOption,
  type OperationCatalogOption,
} from "@/components/composition/DraftCompositionForms";
import { IconDecoration, IconMaterials, IconOperations, IconTrash } from "@/components/ui/Icons";
import {
  type DraftComposition,
  type DraftDecorationRow,
  type DraftMaterialRow,
  type DraftOperationRow,
} from "@/components/orders/ProductCatalogPanel";
import {
  decorationBatchCost,
  draftKey,
  materialHasPricingControls,
  materialUnitCost,
  operationUnitCost,
  pricingFieldsFromCatalogOption,
  resolveDraftMaterialPrice,
} from "@/lib/draft-composition";
import type { MaterialCostVatMode } from "@/lib/fabric-pricing";
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
import { formatMoneyUah, formatUnit } from "@/lib/utils";
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

import { MaterialPricingToggles } from "@/components/composition/PricingToggles";

export function DraftCompositionBomEditor({
  composition,
  onCompositionChange,
  sizes,
  materialOptions = [],
  operationOptions = [],
  decorationOptions = [],
  unitOptions = [],
  onMaterialCatalogAdd,
  onOperationCatalogAdd,
  onDecorationCatalogAdd,
  quantitiesBySize,
  quantityHint = 100,
  showSubtotals = true,
  scopeHint,
  enableLinePricingControls = false,
  companyCostMode = "NET",
}: {
  composition: DraftComposition;
  onCompositionChange: (next: DraftComposition) => void;
  sizes: Array<{ code: string; nameUk: string }>;
  materialOptions?: MaterialCatalogOption[];
  operationOptions?: OperationCatalogOption[];
  decorationOptions?: DecorationCatalogOption[];
  unitOptions?: Array<{ id: string; label: string }>;
  onMaterialCatalogAdd?: (option: MaterialCatalogOption) => void;
  onOperationCatalogAdd?: (option: OperationCatalogOption) => void;
  onDecorationCatalogAdd?: (option: DecorationCatalogOption) => void;
  quantitiesBySize?: Record<string, number>;
  quantityHint?: number;
  showSubtotals?: boolean;
  scopeHint?: ReactNode | ((sizeScope: SizeScope) => ReactNode);
  /** Order draft: per-row ПДВ / гурт·відріз toggles with live price. */
  enableLinePricingControls?: boolean;
  companyCostMode?: MaterialCostVatMode;
}) {
  const [sizeScope, setSizeScope] = useState<SizeScope>(ALL_SIZES);
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
  const resolvedScopeHint =
    typeof scopeHint === "function" ? scopeHint(sizeScope) : scopeHint;

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
    composition.operations.reduce((sum, row) => sum + operationUnitCost(row), 0) * controlQty;
  const decorationsSubtotal = composition.decorations.reduce(
    (sum, row) => sum + decorationBatchCost(row, controlQty),
    0,
  );

  function withResolvedPrice(row: DraftMaterialRow): DraftMaterialRow {
    if (!enableLinePricingControls || !materialHasPricingControls(row)) return row;
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

  function removeDecoration(key: string) {
    onCompositionChange({
      ...composition,
      decorations: composition.decorations.filter((row) => row.key !== key),
    });
  }

  function updateMaterial(key: string, patch: Partial<DraftMaterialRow>) {
    onCompositionChange({
      ...composition,
      materials: composition.materials.map((row) =>
        row.key === key ? withResolvedPrice({ ...row, ...patch }) : row,
      ),
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

  function addDecoration(row: DraftDecorationRow) {
    onCompositionChange({
      ...composition,
      decorations: [...composition.decorations, row],
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
                  {resolvedScopeHint}
                  {sizeScope !== ALL_SIZES ? (
                    <CopySizeSpec from={sizeScope} sizes={sizes} onCopy={copySpecTo} />
                  ) : (
                    <p className="type-caption">
                      Спільна специфіка. Оберіть розмір, щоб змінити норму лише для нього.
                    </p>
                  )}
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
                const hasCut =
                  row.priceMeterUahCutVat != null && row.priceMeterUahCutVat > 0;
                const pricing = showPricing
                  ? resolveDraftMaterialPrice(row, quantitiesBySize, companyCostMode)
                  : null;
                const vatMode = (row.costVatMode ?? companyCostMode) as MaterialCostVatMode;
                const priceMode = row.priceMode ?? "auto";
                return (
                  <TR key={row.key}>
                    <TD title={row.name} className="min-w-[12rem] w-[38%] align-top">
                      <CellStack
                        title={row.name}
                        subtitle={
                          row.sizeCodes?.length
                            ? row.sizeCodes.join(" · ")
                            : mixed
                              ? "Норма різна по розмірах"
                              : undefined
                        }
                        wrap
                      />
                      {showPricing ? (
                        <div className="mt-1.5">
                          <MaterialPricingToggles
                            costVatMode={vatMode}
                            priceMode={priceMode}
                            hasCut={hasCut}
                            onCostVatMode={(mode) => updateMaterial(row.key, { costVatMode: mode })}
                            onPriceMode={(mode) => updateMaterial(row.key, { priceMode: mode })}
                          />
                        </div>
                      ) : null}
                    </TD>
                    <TD align="right">
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
                    </TD>
                    <TD align="right">
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
                      {pricing ? (
                        <div className="mt-0.5 text-[10px] font-normal leading-tight text-[var(--color-text-tertiary)]">
                          {pricing.hint}
                        </div>
                      ) : null}
                    </TD>
                    <TD numeric className="font-medium">
                      {formatMoneyUah(consumption * (1 + row.waste / 100) * row.price)}
                    </TD>
                    <TD align="center">
                      <button
                        type="button"
                        aria-label={`Прибрати ${row.name}`}
                        onClick={() => removeMaterial(row.key)}
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
                };
                onMaterialCatalogAdd?.(option);
                addMaterial({
                  key: draftKey(),
                  materialId: option.id,
                  name: option.name ?? option.label,
                  unit: option.unit,
                  consumption: 1,
                  waste: option.defaultWaste,
                  ...pricingFieldsFromCatalogOption(option, companyCostMode),
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
              visibleOperations.map((row) => (
                <TR key={row.key}>
                  <TD className="font-medium">{row.name}</TD>
                  <TD className="text-[var(--color-text-secondary)]">
                    {operationMethodLabel(row.method)}
                  </TD>
                  <TD numeric className="font-medium">
                    {formatMoneyUah(operationUnitCost(row))}
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
              ))
            )}
          </TBody>
          {showSubtotals && composition.operations.length > 0 ? (
            <TFoot>
              <tr>
                <TD colSpan={2} className="text-[var(--color-text-secondary)]">
                  Операції разом на {controlQty} шт
                  {totalQty <= 0 ? " (орієнтир)" : ""}
                </TD>
                <TD numeric>{formatMoneyUah(operationsSubtotal)}</TD>
                <TD />
              </tr>
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
                });
              }}
            />
          }
        >
          <DraftAddOperationForm options={operationOptions} onAdd={addOperation} compact />
        </CompositionAddBar>
      </TableCard>

      <TableCard>
        <TableToolbar left={<span className="type-subsection">Нанесення</span>} />
        <Table>
          <THead>
            <TH>Метод</TH>
            <TH align="right">Приладка</TH>
            <TH align="right">Тариф / од.</TH>
            <TH width="44px" />
          </THead>
          <TBody>
            {composition.decorations.length === 0 ? (
              <TableEmpty
                colSpan={4}
                icon={<IconDecoration size={22} />}
                title="Нанесення не використовується"
                description="Необовʼязково — додайте з рядка нижче, якщо потрібен друк або вишивка."
              />
            ) : (
              composition.decorations.map((row) => (
                <TR key={row.key}>
                  <TD className="font-medium">{row.name}</TD>
                  <TD numeric className="text-[var(--color-text-secondary)]">
                    {formatMoneyUah(row.setupCost)}
                  </TD>
                  <TD numeric className="font-medium">
                    {formatMoneyUah(row.unitRate)}
                  </TD>
                  <TD align="center">
                    <button
                      type="button"
                      aria-label={`Прибрати ${row.name}`}
                      onClick={() => removeDecoration(row.key)}
                      className="rounded-[var(--radius-control)] p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                    >
                      <IconTrash size={15} />
                    </button>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
          {showSubtotals && composition.decorations.length > 0 ? (
            <TFoot>
              <tr>
                <TD colSpan={2} className="text-[var(--color-text-secondary)]">
                  Нанесення разом на {controlQty} шт
                  {totalQty <= 0 ? " (орієнтир)" : ""}
                </TD>
                <TD numeric>{formatMoneyUah(decorationsSubtotal)}</TD>
                <TD />
              </tr>
            </TFoot>
          ) : null}
        </Table>
        <CompositionAddBar
          createAction={
            <DecorationCreatePanel
              variant="ghost"
              size="sm"
              triggerLabel="Нове нанесення"
              onCreated={(result) => {
                const created = result.decoration as
                  | {
                      id: string;
                      nameUk: string;
                      setupCost: number;
                      unitRate: number;
                    }
                  | undefined;
                if (!created) return;
                const option: DecorationCatalogOption = {
                  id: created.id,
                  label: created.nameUk,
                  setupCost: created.setupCost,
                  unitRate: created.unitRate,
                };
                onDecorationCatalogAdd?.(option);
                addDecoration({
                  key: draftKey(),
                  decorationMethodId: option.id,
                  name: option.label,
                  setupCost: option.setupCost,
                  unitRate: option.unitRate,
                });
              }}
            />
          }
        >
          <DraftAddDecorationForm options={decorationOptions} onAdd={addDecoration} compact />
        </CompositionAddBar>
      </TableCard>
    </div>
  );
}
