"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { IconTrash } from "@/components/ui/Icons";
import { formatMoneyUah, formatUnit, cn } from "@/lib/utils";
import { CopySizeSpec, SizeScopeTabs } from "@/components/catalog/SizeScopeTabs";
import { SizeBomScopeHint } from "@/components/catalog/SizeBomScopeHint";
import { OversizeCoeffFields } from "@/components/catalog/OversizeCoeffFields";
import {
  effectiveOversizeConsumption,
  isOversizeCode,
  oversizeUpliftCaption,
  resolveOversizeUplift,
  type SizeCoeffRule,
} from "@/lib/size-coeffs";
import {
  ALL_SIZES,
  appliesToSize,
  consumptionForSize,
  customizedSizeCodes,
  wasteForSize,
  type SizeScope,
} from "@/lib/size-bom";
import {
  copyProductSizeSpecAction,
  removeProductDecorationAction,
  removeProductMaterialAction,
  removeProductOperationAction,
  updateProductDecorationSetupCostAction,
  updateProductMaterialConsumptionAction,
  updateProductMaterialWasteAction,
} from "@/server/domains/products/actions";
import {
  AddProductDecorationPanel,
  AddProductMaterialPanel,
  AddProductOperationPanel,
  ProductAddMaterialBar,
} from "@/app/(app)/products/[id]/ProductCompositionForms";
import { ProductOperationRateEditor } from "@/components/products/ProductOperationRateEditor";
import { useProductPreviewQty } from "@/components/products/ProductPreviewQtyContext";
import { ProductMaterialSupplierColorEditor } from "@/components/catalog/SupplierColorFields";
import {
  isCutOperationName,
  CUT_RATES_TAB_HINT,
  summarizeCutOperationDisplay,
  type CutRateTier,
} from "@/lib/cut-rate";

type SizeOpt = { id: string; code: string; nameUk: string };
type MaterialView = {
  id: string;
  name: string;
  unit: string;
  consumption: number;
  waste: number;
  price: number;
  sizeCodes: string[] | null;
  sizeConsumption: Record<string, number>;
  sizeWaste?: Record<string, number>;
  supplierId?: string | null;
  colorSnapshot?: string | null;
  supplierOffers?: Array<{
    supplierId: string;
    supplierName: string;
    isPrimary?: boolean;
    availableColors: string[];
  }>;
  materialAvailableColors?: string[];
};
type OperationView = {
  id: string;
  name: string;
  method: string;
  methodCode: string;
  unitCost: number;
  sizeCodes: string[] | null;
  rateTiers: Array<{ minQuantity: number; ratePerUnit: number }>;
  isCut?: boolean;
  cutDisplay?: {
    methodLabel: string;
    configured: boolean;
    minRate: number | null;
    maxRate: number | null;
    previewQty: number;
    previewRate: number | null;
  } | null;
  cutFallbackRate?: number;
};

type CutRateContext = {
  optimalQty: number | null;
  tiers: CutRateTier[];
};

function formatCutCostCell(row: OperationView, previewQty: number, cutRateContext?: CutRateContext) {
  if (!cutRateContext) {
    return { primary: "—", title: CUT_RATES_TAB_HINT };
  }

  const cut = summarizeCutOperationDisplay({
    optimalQty: cutRateContext.optimalQty,
    tiers: cutRateContext.tiers,
    fallbackRate: row.cutFallbackRate ?? 0,
    previewQty,
  });

  if (!cut.configured || cut.previewRate == null) {
    return { primary: "—", title: CUT_RATES_TAB_HINT };
  }

  const range =
    cut.minRate != null && cut.maxRate != null && cut.minRate !== cut.maxRate
      ? `${formatMoneyUah(cut.minRate)}–${formatMoneyUah(cut.maxRate)}`
      : null;

  return {
    primary: formatMoneyUah(cut.previewRate),
    secondary: range ? `діапазон ${range}` : `${previewQty} шт`,
    title: `${CUT_RATES_TAB_HINT}. При ${previewQty} шт — ${formatMoneyUah(cut.previewRate)}/шт`,
  };
}

const inputClass =
  "h-7 w-[64px] rounded-[6px] border border-[var(--color-border)] bg-white px-1.5 text-right text-[12.5px] tabular outline-none focus:border-[var(--color-primary-500)]";

export function ProductSizeBom({
  productId,
  sizes,
  materials,
  operations,
  decorations,
  materialsSubtotal,
  operationsSubtotal,
  hasCutOperation = false,
  decorationSetupTotal = 0,
  decorationUnitRateTotal = 0,
  materialOptions,
  operationOptions,
  decorationOptions,
  unitOptions,
  cutRateContext,
  hideCosts = false,
  readOnly = false,
  sizeRules = [],
}: {
  productId: string;
  sizes: SizeOpt[];
  materials: MaterialView[];
  operations: OperationView[];
  decorations: Array<{ id: string; name: string; setupCost: number; unitRate: number }>;
  materialsSubtotal: number;
  operationsSubtotal: number;
  hasCutOperation?: boolean;
  decorationSetupTotal?: number;
  decorationUnitRateTotal?: number;
  materialOptions: Array<{ id: string; label: string; unit?: string; composition?: string | null }>;
  operationOptions: Array<{ id: string; label: string }>;
  decorationOptions: Array<{ id: string; label: string }>;
  unitOptions: Array<{ id: string; label: string }>;
  cutRateContext?: CutRateContext;
  hideCosts?: boolean;
  readOnly?: boolean;
  sizeRules?: SizeCoeffRule[];
}) {
  const router = useRouter();
  const previewQty = useProductPreviewQty();
  const [pending, startTransition] = useTransition();
  const [sizeScope, setSizeScope] = useState<SizeScope>(ALL_SIZES);
  const sizeRefs = sizes.map((size) => ({ code: size.code, nameUk: size.nameUk }));
  const activeSize = sizes.find((size) => size.code === sizeScope);
  const sizeIdsForAdd = sizeScope === ALL_SIZES || !activeSize ? [] : [activeSize.id];
  const sizeLabelForAdd =
    sizeScope === ALL_SIZES || !activeSize ? undefined : activeSize.nameUk;

  const visibleMaterials =
    sizeScope === ALL_SIZES
      ? materials
      : materials.filter((row) => appliesToSize(row.sizeCodes, sizeScope));
  const visibleOperations =
    sizeScope === ALL_SIZES
      ? operations
      : operations.filter((row) => appliesToSize(row.sizeCodes, sizeScope));
  const customized = customizedSizeCodes({
    allCodes: sizes.map((size) => size.code),
    materials,
    operations,
  });
  const hasOversizeSizes = sizes.some((size) => isOversizeCode(size.code));
  const scopeIsOversize = isOversizeCode(sizeScope);
  const oversizeUplift = resolveOversizeUplift(sizeRules);
  const materialPct = Math.round((oversizeUplift.materialCoeff - 1) * 100);
  const operationPct = Math.round((oversizeUplift.operationCoeff - 1) * 100);

  function saveConsumption(id: string, consumption: number) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("id", id);
    formData.set("consumptionPerUnit", String(consumption));
    if (activeSize) formData.set("sizeId", activeSize.id);
    startTransition(async () => {
      await updateProductMaterialConsumptionAction(formData);
      router.refresh();
    });
  }

  function saveWaste(id: string, waste: number) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("id", id);
    formData.set("wastePercent", String(waste));
    if (activeSize) formData.set("sizeId", activeSize.id);
    startTransition(async () => {
      await updateProductMaterialWasteAction(formData);
      router.refresh();
    });
  }

  function removeMaterial(id: string) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("id", id);
    if (activeSize) formData.set("sizeId", activeSize.id);
    startTransition(async () => {
      await removeProductMaterialAction(formData);
      router.refresh();
    });
  }

  function removeOperation(id: string) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("id", id);
    if (activeSize) formData.set("sizeId", activeSize.id);
    startTransition(async () => {
      await removeProductOperationAction(formData);
      router.refresh();
    });
  }

  function removeDecoration(id: string) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("id", id);
    startTransition(async () => {
      await removeProductDecorationAction(formData);
      router.refresh();
    });
  }

  function saveDecorationSetupCost(id: string, setupCost: number) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("id", id);
    formData.set("setupCost", String(setupCost));
    startTransition(async () => {
      await updateProductDecorationSetupCostAction(formData);
      router.refresh();
    });
  }

  function copySpecTo(toCodes: string[]) {
    if (!activeSize) return;
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("fromSizeId", activeSize.id);
    for (const code of toCodes) {
      const size = sizes.find((row) => row.code === code);
      if (size) formData.append("toSizeId", size.id);
    }
    startTransition(async () => {
      await copyProductSizeSpecAction(formData);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <TableCard>
        <TableToolbar
          left={
            <div className="flex min-w-0 flex-col gap-2">
              <span className="type-subsection">Матеріали</span>
              <SizeScopeTabs
                sizes={sizeRefs}
                value={sizeScope}
                onChange={setSizeScope}
                customized={customized}
              />
              {sizeScope !== ALL_SIZES ? (
                <CopySizeSpec from={sizeScope} sizes={sizeRefs} onCopy={copySpecTo} disabled={pending} />
              ) : null}
              {sizes.length > 1 ? (
                <SizeBomScopeHint
                  sizeScope={sizeScope}
                  hasOversizeSizes={hasOversizeSizes}
                  materialPct={materialPct}
                  operationPct={operationPct}
                />
              ) : null}
            </div>
          }
          right={
            <div className="flex flex-col items-end gap-2">
              {hasOversizeSizes ? (
                <OversizeCoeffFields
                  materialPct={materialPct}
                  operationPct={operationPct}
                  disabled={readOnly || pending}
                  className="ml-auto"
                />
              ) : null}
              {!readOnly ? (
                <AddProductMaterialPanel
                  productId={productId}
                  materials={materialOptions}
                  units={unitOptions}
                  sizeIds={sizeIdsForAdd}
                  sizeLabel={sizeLabelForAdd}
                />
              ) : null}
            </div>
          }
        />
        <Table>
          <THead>
            <TH className="min-w-[12rem] w-[38%]">Матеріал</TH>
            <TH align="right">Норма / виріб</TH>
            {!hideCosts ? <TH align="right">Відходи</TH> : null}
            {!hideCosts ? <TH align="right">Ціна</TH> : null}
            {!hideCosts ? <TH align="right">Собівартість / од.</TH> : null}
            {!readOnly ? <TH width="52px" /> : null}
          </THead>
          <TBody>
            {visibleMaterials.length === 0 ? (
              <TableEmpty
                colSpan={2 + (hideCosts ? 0 : 3) + (readOnly ? 0 : 1)}
                title={
                  sizeScope === ALL_SIZES
                    ? "Матеріалів ще немає"
                    : "Немає матеріалів для цього розміру"
                }
                description={
                  hideCosts
                    ? "Склад матеріалів для цього виробу."
                    : "Додайте з рядка нижче — без матеріалів собівартість не розрахується."
                }
              />
            ) : (
              visibleMaterials.map((row) => {
                const hasSizeNorm =
                  sizeScope !== ALL_SIZES && row.sizeConsumption[sizeScope] != null;
                const baseConsumption =
                  sizeScope === ALL_SIZES
                    ? row.consumption
                    : consumptionForSize(row.consumption, row.sizeConsumption, sizeScope);
                const displayConsumption =
                  scopeIsOversize && !hasSizeNorm
                    ? effectiveOversizeConsumption(
                        row.consumption,
                        oversizeUplift.materialCoeff,
                      )
                    : baseConsumption;
                const waste =
                  sizeScope === ALL_SIZES
                    ? row.waste
                    : wasteForSize(row.waste, row.sizeWaste, sizeScope);
                const mixed =
                  sizeScope === ALL_SIZES &&
                  (Object.keys(row.sizeConsumption).length > 0 ||
                    Object.keys(row.sizeWaste ?? {}).length > 0);
                const unitCost =
                  displayConsumption * (1 + waste / 100) * row.price;
                const autoFromBase = scopeIsOversize && !hasSizeNorm;
                return (
                  <TR key={row.id}>
                    <TD title={row.name} className="min-w-[12rem] w-[38%] align-top">
                      <div className="space-y-1">
                        <CellStack
                          title={row.name}
                          subtitle={
                            [
                              row.sizeCodes?.length
                                ? row.sizeCodes.join(" · ")
                                : mixed
                                  ? "Базова норма; по розмірах є перевизначення"
                                  : hasOversizeSizes && sizeScope === ALL_SIZES
                                    ? oversizeUpliftCaption(sizeRules)
                                    : autoFromBase
                                      ? `авто +${materialPct}% від бази ${row.consumption}`
                                      : scopeIsOversize && hasSizeNorm
                                        ? "своя норма для розміру"
                                        : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || undefined
                          }
                          wrap
                        />
                        {(row.supplierOffers?.length ?? 0) > 0 ||
                        (row.materialAvailableColors?.length ?? 0) > 0 ? (
                          <ProductMaterialSupplierColorEditor
                            productId={productId}
                            productMaterialId={row.id}
                            supplierId={row.supplierId ?? null}
                            color={row.colorSnapshot ?? null}
                            offers={row.supplierOffers ?? []}
                            materialFallbackColors={row.materialAvailableColors}
                            readOnly={readOnly}
                          />
                        ) : null}
                      </div>
                    </TD>
                    <TD numeric>
                      <span className="inline-flex flex-col items-end gap-0.5">
                        <span className="inline-flex items-center justify-end gap-1">
                          {readOnly ? (
                            <span className="tabular">{displayConsumption}</span>
                          ) : (
                            <input
                              key={`${row.id}-${sizeScope}-consumption-${materialPct}`}
                              type="number"
                              min={0}
                              step="0.0001"
                              defaultValue={displayConsumption}
                              title={
                                mixed && sizeScope === ALL_SIZES
                                  ? "Редагує базову норму. Перевизначення по розмірах лишаються."
                                  : autoFromBase
                                    ? `Авто з бази × +${materialPct}%. Змініть — збережеться як своя норма розміру.`
                                    : undefined
                              }
                              onBlur={(event) => {
                                const next = Math.max(0, Number(event.target.value) || 0);
                                if (next === displayConsumption) return;
                                saveConsumption(row.id, next);
                              }}
                              className={inputClass + " w-[72px]"}
                            />
                          )}
                          <span className="text-[12px] text-[var(--color-text-secondary)]">
                            {formatUnit(row.unit)}
                          </span>
                        </span>
                        {mixed && sizeScope === ALL_SIZES ? (
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            базова
                          </span>
                        ) : null}
                      </span>
                    </TD>
                    {!hideCosts ? (
                      <TD numeric>
                        <span className="inline-flex flex-col items-end gap-0.5">
                          <span className="inline-flex items-center justify-end gap-0.5">
                            {readOnly ? (
                              <span>{waste}%</span>
                            ) : (
                              <>
                                <input
                                  key={`${row.id}-${sizeScope}-waste`}
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  defaultValue={waste}
                                  title={
                                    mixed && sizeScope === ALL_SIZES
                                      ? "Редагує базові відходи. Перевизначення по розмірах лишаються."
                                      : undefined
                                  }
                                  onBlur={(event) => {
                                    const next = Math.max(0, Number(event.target.value) || 0);
                                    if (next === waste) return;
                                    saveWaste(row.id, next);
                                  }}
                                  className={inputClass}
                                />
                                <span className="text-[12px] text-[var(--color-text-secondary)]">%</span>
                              </>
                            )}
                          </span>
                          {mixed && sizeScope === ALL_SIZES ? (
                            <span className="text-[10px] text-[var(--color-text-tertiary)]">
                              баз.
                            </span>
                          ) : null}
                        </span>
                      </TD>
                    ) : null}
                    {!hideCosts ? (
                      <TD numeric className="text-[var(--color-text-secondary)]">
                        {formatMoneyUah(row.price)}
                      </TD>
                    ) : null}
                    {!hideCosts ? (
                      <TD numeric className="font-medium">
                        {formatMoneyUah(unitCost)}
                      </TD>
                    ) : null}
                    {!readOnly ? (
                      <TD align="center">
                        <button
                          type="button"
                          aria-label={`Прибрати ${row.name}`}
                          onClick={() => removeMaterial(row.id)}
                          className="rounded-[var(--radius-control)] p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                        >
                          <IconTrash size={16} />
                        </button>
                      </TD>
                    ) : null}
                  </TR>
                );
              })
            )}
          </TBody>
          {materials.length > 0 && !hideCosts ? (
            <TFoot>
              <tr>
                <TD colSpan={4} className="text-[var(--color-text-secondary)]">
                  Матеріали разом / од.
                </TD>
                <TD numeric>{formatMoneyUah(materialsSubtotal)}</TD>
                {!readOnly ? <TD /> : null}
              </tr>
            </TFoot>
          ) : null}
        </Table>
        {!readOnly ? (
          <ProductAddMaterialBar
            productId={productId}
            materials={materialOptions}
            units={unitOptions}
            sizeIds={sizeIdsForAdd}
            sizeLabel={sizeLabelForAdd}
          />
        ) : null}
      </TableCard>

      <TableCard>
        <TableToolbar
          left={<span className="type-subsection">Операції</span>}
          right={
            !readOnly ? (
              <AddProductOperationPanel
                productId={productId}
                operations={operationOptions}
                sizeIds={sizeIdsForAdd}
                sizeLabel={sizeLabelForAdd}
              />
            ) : null
          }
        />
        <Table>
          <THead>
            <TH>Операція</TH>
            <TH>Метод</TH>
            {!hideCosts ? <TH align="right">Вартість / од.</TH> : null}
            {!readOnly ? <TH width="52px" /> : null}
          </THead>
          <TBody>
            {visibleOperations.length === 0 ? (
              <TableEmpty
                colSpan={4}
                title={
                  sizeScope === ALL_SIZES ? "Операцій ще немає" : "Немає операцій для цього розміру"
                }
                description="Додайте технологічні операції, щоб врахувати роботу у собівартості."
              />
            ) : (
              visibleOperations.map((row) => {
                const cutCell = row.isCut ? formatCutCostCell(row, previewQty, cutRateContext) : null;
                return (
                <TR key={row.id}>
                  <TD className="min-w-0">
                    <CellStack
                      title={row.name}
                      subtitle={
                        row.sizeCodes?.length ? row.sizeCodes.join(" · ") : undefined
                      }
                      maxWidth="100%"
                    />
                  </TD>
                  <TD className="min-w-0">
                    {row.isCut && cutCell?.secondary ? (
                      <div className="min-w-0">
                        <div className="text-[13px] text-[var(--color-text-secondary)]">{row.method}</div>
                        <div className="mt-0.5 break-words text-[12px] text-[var(--color-text-quiet)]">
                          {cutCell.secondary}
                        </div>
                      </div>
                    ) : (
                      <span className="block truncate text-[var(--color-text-secondary)]" title={row.method}>
                        {row.method}
                      </span>
                    )}
                  </TD>
                  {!hideCosts ? (
                    <TD
                      numeric={!row.isCut}
                      align={row.isCut ? "right" : undefined}
                      className={cn("font-medium", row.isCut && "!whitespace-normal")}
                      title={cutCell?.title}
                    >
                      {cutCell ? cutCell.primary : formatMoneyUah(row.unitCost)}
                    </TD>
                  ) : null}
                  {!readOnly ? (
                    <TD align="center">
                      <button
                        type="button"
                        aria-label={`Прибрати ${row.name}`}
                        onClick={() => removeOperation(row.id)}
                        className="rounded-[var(--radius-control)] p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                      >
                        <IconTrash size={16} />
                      </button>
                    </TD>
                  ) : null}
                </TR>
                );
              })
            )}
          </TBody>
          {operations.length > 0 && !hideCosts ? (
            <TFoot>
              <tr>
                <TD colSpan={2} className="text-[var(--color-text-secondary)]">
                  {hasCutOperation ? "Операції без крою / од." : "Операції разом / од."}
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
                      const cutRow = operations.find((row) => row.isCut);
                      if (!cutRow || !cutRateContext) return "—";
                      const cell = formatCutCostCell(cutRow, previewQty, cutRateContext);
                      return cell.primary;
                    })()}
                  </TD>
                  <TD />
                </tr>
              ) : null}
            </TFoot>
          ) : null}
        </Table>
      </TableCard>

      {!hideCosts && !readOnly
        ? operations
            .filter(
              (row) =>
                row.methodCode === "QUANTITY_TIER" && !isCutOperationName(row.name),
            )
            .map((row) => (
              <ProductOperationRateEditor
                key={`tiers-${row.id}`}
                productId={productId}
                productOperationId={row.id}
                operationName={row.name}
                tiers={row.rateTiers}
              />
            ))
        : null}

      <TableCard>
        <TableToolbar
          left={<span className="type-subsection">Нанесення</span>}
          right={
            !readOnly ? (
              <AddProductDecorationPanel productId={productId} decorations={decorationOptions} />
            ) : null
          }
        />
        <Table className="table-fixed">
          <THead>
            <TH>Метод</TH>
            {!hideCosts ? (
              <TH align="right" width="96px" title="Один раз на всю партію">
                Приладка
              </TH>
            ) : null}
            {!hideCosts ? (
              <TH align="right" width="80px" title="За кожну одиницю">
                ₴/шт
              </TH>
            ) : null}
            {!readOnly ? <TH width="52px" /> : null}
          </THead>
          <TBody>
            {decorations.length === 0 ? (
              <TableEmpty
                colSpan={1 + (hideCosts ? 0 : 2) + (readOnly ? 0 : 1)}
                title="Нанесення не використовується"
                description="Додайте друк або вишивку, якщо потрібно."
              />
            ) : (
              decorations.map((row) => (
                <TR key={row.id}>
                  <TD className="min-w-0">
                    <CellStack title={row.name} maxWidth="100%" />
                  </TD>
                  {!hideCosts ? (
                    <TD numeric nowrap>
                      {readOnly ? (
                        <span className="text-[var(--color-text-secondary)]">
                          {formatMoneyUah(row.setupCost)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-end gap-0.5">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            defaultValue={row.setupCost}
                            key={`${row.id}-${row.setupCost}`}
                            onBlur={(event) => {
                              const next = Math.max(0, Number(event.target.value) || 0);
                              if (next === row.setupCost) return;
                              saveDecorationSetupCost(row.id, next);
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") return;
                              event.currentTarget.blur();
                            }}
                            className={inputClass + " w-[72px]"}
                            aria-label={`Приладка ${row.name}`}
                          />
                          <span className="text-[12px] text-[var(--color-text-secondary)]">₴</span>
                        </span>
                      )}
                    </TD>
                  ) : null}
                  {!hideCosts ? (
                    <TD numeric nowrap className="font-medium">
                      {formatMoneyUah(row.unitRate)}
                    </TD>
                  ) : null}
                  {!readOnly ? (
                    <TD align="center">
                      <button
                        type="button"
                        aria-label={`Прибрати ${row.name}`}
                        disabled={pending}
                        onClick={() => removeDecoration(row.id)}
                        className="rounded-[var(--radius-control)] p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] disabled:opacity-50"
                      >
                        <IconTrash size={16} />
                      </button>
                    </TD>
                  ) : null}
                </TR>
              ))
            )}
          </TBody>
          {decorations.length > 0 && !hideCosts ? (
            <TFoot>
              <tr>
                <TD className="min-w-0 truncate text-[var(--color-text-secondary)]">Разом</TD>
                <TD numeric>{formatMoneyUah(decorationSetupTotal)}</TD>
                <TD numeric>{formatMoneyUah(decorationUnitRateTotal)}</TD>
                {!readOnly ? <TD /> : null}
              </tr>
            </TFoot>
          ) : null}
        </Table>
      </TableCard>
    </div>
  );
}
