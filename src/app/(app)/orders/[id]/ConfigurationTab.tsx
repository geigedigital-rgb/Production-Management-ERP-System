"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { Modal } from "@/components/ui/Overlay";
import { MaterialCreatePanel } from "@/app/(app)/settings/resources/MaterialCreateForm";
import { OperationCreatePanel } from "@/app/(app)/settings/operations/OperationCreateForm";
import { DecorationCreatePanel } from "@/app/(app)/settings/applications/DecorationCreateForm";
import { SizeRun } from "@/components/orders/SizeRun";
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
import { IconPlus, IconTrash, IconMaterials, IconOperations, IconDecoration } from "@/components/ui/Icons";
import { OrderMaterialDetailPanel } from "@/components/orders/OrderMaterialDetailPanel";
import { cn, formatMoneyUah } from "@/lib/utils";
import {
  addOrderDecorationAction,
  addOrderMaterialAction,
  addOrderOperationAction,
  copyOrderSizeSpecAction,
  removeOrderDecorationAction,
  removeOrderMaterialAction,
  removeOrderOperationAction,
  updateOrderDecorationAction,
  updateOrderMaterialConsumptionAction,
  updateOrderSizesAction,
} from "@/server/domains/orders/actions";
import { CopySizeSpec, SizeScopeTabs } from "@/components/catalog/SizeScopeTabs";
import { SizeBomScopeHint } from "@/components/catalog/SizeBomScopeHint";
import {
  effectiveOversizeConsumption,
  isOversizeCode,
  OVERSIZE_DEFAULT_COEFFS,
  oversizeUpliftCaption,
} from "@/lib/size-coeffs";
import {
  ALL_SIZES,
  customizedSizeCodes,
  linesForSize,
  type SizeScope,
} from "@/lib/size-bom";
import { operationMethodLabel } from "@/lib/operation-labels";
import { OrderFixedCostError, OrderSewerCountControl } from "@/components/orders/OrderSewerCountControl";
import { FIXED_COST_LINE_NAME_UK } from "@/lib/fixed-costs";
import type { FixedCostAllocation, FixedCostValidationError } from "@/lib/fixed-costs";

export type MaterialRow = {
  id: string;
  name: string;
  unit: string;
  consumption: number;
  waste: number;
  price: number;
  unitCost: number;
  totalCost: number;
  sizeCode: string | null;
  groupKey: string;
  pricingHint?: string | null;
  supplierName?: string | null;
  isFabric?: boolean;
};

export type FabricDeliveryRow = {
  id: string;
  name: string;
  sizeCode: string | null;
  amount: number;
  manual: boolean;
  cargoUsdPerKg: number;
  usdUahRate: number;
  kgNeeded: number | null;
};

export type OperationRow = {
  id: string;
  name: string;
  method: string;
  unitCost: number;
  totalCost: number;
  sizeCode: string | null;
  groupKey: string;
};

export type DecorationRow = {
  id: string;
  name: string;
  setupCost: number;
  unitRate: number;
  totalCost: number;
};

type SizeRow = { id: string; sizeCode: string; sizeNameUk: string; quantity: number };

export function ConfigurationTab({
  orderId,
  itemId,
  locked,
  productName,
  comment,
  sizes,
  materials,
  operations,
  decorations,
  materialOptions,
  operationOptions,
  decorationOptions,
  unitOptions,
  materialsSubtotal,
  operationsSubtotal,
  decorationsSubtotal,
  corridorHint,
  hideCosts = false,
  canCreateCatalog = false,
  companySewerCount = 0,
  sewerCountOverride = null,
  fixedCostAllocation = null,
  fixedCostError = null,
  canEditFixedCosts = false,
}: {
  orderId: string;
  itemId: string;
  locked: boolean;
  productName: string;
  comment?: string | null;
  sizes: SizeRow[];
  materials: MaterialRow[];
  operations: OperationRow[];
  decorations: DecorationRow[];
  materialOptions: Array<{ id: string; label: string; composition?: string | null }>;
  operationOptions: Array<{ id: string; label: string }>;
  decorationOptions: Array<{ id: string; label: string }>;
  unitOptions: Array<{ id: string; label: string }>;
  materialsSubtotal: number;
  operationsSubtotal: number;
  decorationsSubtotal: number;
  corridorHint?: { title: string; detail: string } | null;
  hideCosts?: boolean;
  canCreateCatalog?: boolean;
  companySewerCount?: number;
  sewerCountOverride?: number | null;
  fixedCostAllocation?: FixedCostAllocation | null;
  fixedCostError?: FixedCostValidationError | null;
  canEditFixedCosts?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(sizes.map((size) => [size.sizeCode, size.quantity])),
  );
  const [removeTarget, setRemoveTarget] = useState<{
    kind: "material" | "operation" | "decoration";
    id: string;
    name: string;
  } | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [sizeScope, setSizeScope] = useState<SizeScope>(ALL_SIZES);

  const dirty = sizes.some((size) => (quantities[size.sizeCode] ?? 0) !== size.quantity);
  const totalQuantity = sizes.reduce((sum, size) => sum + (quantities[size.sizeCode] ?? 0), 0);
  const decorationSetupTotal = decorations.reduce((sum, row) => sum + row.setupCost, 0);
  const decorationUnitRateTotal = decorations.reduce((sum, row) => sum + row.unitRate, 0);
  const sizeRefs = sizes.map((size) => ({ code: size.sizeCode, nameUk: size.sizeNameUk }));
  const visibleMaterials =
    sizeScope === ALL_SIZES ? materials : linesForSize(materials, sizeScope);
  const visibleOperations =
    sizeScope === ALL_SIZES ? operations : linesForSize(operations, sizeScope);
  const customized = customizedSizeCodes({
    allCodes: sizes.map((size) => size.sizeCode),
    materials: materials.map((row) => ({
      sizeCodes: row.sizeCode ? [row.sizeCode] : null,
    })),
    operations: operations.map((row) => ({
      sizeCodes: row.sizeCode ? [row.sizeCode] : null,
    })),
  });
  const hasOversizeSizes = sizes.some((size) => isOversizeCode(size.sizeCode));
  const scopeIsOversize = isOversizeCode(sizeScope);
  const hasOversizeQty = sizes.some(
    (size) => isOversizeCode(size.sizeCode) && (quantities[size.sizeCode] ?? 0) > 0,
  );

  function saveMaterialConsumption(id: string, consumption: number) {
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("id", id);
    formData.set("consumptionPerUnit", String(consumption));
    formData.set("sizeCode", sizeScope);
    startTransition(async () => {
      await updateOrderMaterialConsumptionAction(formData);
      router.refresh();
    });
  }

  function saveDecorationRates(id: string, setupCost: number, unitRate: number) {
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("id", id);
    formData.set("setupCost", String(setupCost));
    formData.set("unitRate", String(unitRate));
    startTransition(async () => {
      await updateOrderDecorationAction(formData);
      router.refresh();
    });
  }

  function copySpecTo(toCodes: string[]) {
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("orderItemId", itemId);
    formData.set("fromSizeCode", sizeScope);
    for (const code of toCodes) formData.append("toSizeCode", code);
    startTransition(async () => {
      await copyOrderSizeSpecAction(formData);
      router.refresh();
    });
  }

  function saveSizes() {
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("orderItemId", itemId);
    sizes.forEach((size) => {
      formData.append("sizeCode", size.sizeCode);
      formData.append("sizeNameUk", size.sizeNameUk);
      formData.append("sizeQty", String(quantities[size.sizeCode] ?? 0));
    });
    startTransition(async () => {
      await updateOrderSizesAction(formData);
      router.refresh();
    });
  }

  function confirmRemove() {
    if (!removeTarget) return;
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("id", removeTarget.id);
    formData.set("sizeCode", sizeScope);
    const action =
      removeTarget.kind === "material"
        ? removeOrderMaterialAction
        : removeTarget.kind === "operation"
          ? removeOrderOperationAction
          : removeOrderDecorationAction;
    startTransition(async () => {
      await action(formData);
      setRemoveTarget(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {locked ? (
        <Banner tone="info" title="Замовлення передано у виробництво">
          Комплектація зафіксована. Зміни — через нову пропозицію калькуляції.
        </Banner>
      ) : corridorHint ? (
        <Banner tone="info" title={corridorHint.title}>
          {corridorHint.detail}
        </Banner>
      ) : null}

      <div className="rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold text-[var(--color-text-primary)]">
              {productName}
            </p>
            <p className="type-caption">
              {totalQuantity} шт · {materials.length} мат. · {operations.length} оп. ·{" "}
              {decorations.length} нанес.
              {locked ? " · зафіксовано" : ""}
            </p>
          </div>
          {!locked && dirty ? (
            <Button size="sm" onClick={saveSizes} disabled={pending}>
              {pending ? "…" : "Зберегти к-сть"}
            </Button>
          ) : null}
        </div>
        <div className="px-3 py-2.5">
          {sizes.length === 0 ? (
            <p className="type-caption">Розміри не задані.</p>
          ) : (
            <SizeRun
              sizes={sizes.map((size) => ({ code: size.sizeCode, nameUk: size.sizeNameUk }))}
              quantities={quantities}
              disabled={locked}
              quiet
              onChange={(code, quantity) =>
                setQuantities((prev) => ({ ...prev, [code]: quantity }))
              }
            />
          )}
          {dirty && !locked ? (
            <p className="type-caption mt-2 text-[var(--color-warning-text)]">
              К-сть змінено — збережіть, щоб перерахувати калькуляцію.
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-0.5">
        <SizeScopeTabs
          sizes={sizeRefs}
          value={sizeScope}
          onChange={setSizeScope}
          customized={customized}
        />
        {sizes.length > 1 ? (
          <SizeBomScopeHint sizeScope={sizeScope} hasOversizeSizes={hasOversizeSizes} compact />
        ) : null}
        {sizeScope !== ALL_SIZES && !locked ? (
          <CopySizeSpec from={sizeScope} sizes={sizeRefs} onCopy={copySpecTo} disabled={pending} />
        ) : null}
      </div>

      <TableCard>
        <TableToolbar
          left={
            <span className="type-subsection">
              Матеріали
              <span className="type-caption ml-1.5 font-normal">{visibleMaterials.length}</span>
            </span>
          }
        />
        <Table>
          <THead>
            <TH className="min-w-[10rem]">Назва</TH>
            <TH align="right">Норма</TH>
            {!hideCosts ? <TH align="right">%</TH> : null}
            {!hideCosts ? <TH align="right">₴</TH> : null}
            {!hideCosts ? <TH align="right">/од.</TH> : null}
            {!locked ? <TH width="40px" /> : null}
          </THead>
          <TBody>
            {visibleMaterials.length === 0 ? (
              <TableEmpty
                colSpan={(hideCosts ? 2 : 5) + (locked ? 0 : 1)}
                icon={<IconMaterials size={20} />}
                title={sizeScope === ALL_SIZES ? "Порожньо" : `Немає для ${sizeScope}`}
                description="Додайте рядок знизу."
              />
            ) : (
              visibleMaterials.map((row) => {
                const baseUnitCost = row.unitCost;
                const displayUnitCost = scopeIsOversize
                  ? baseUnitCost * OVERSIZE_DEFAULT_COEFFS.materialCoeff
                  : baseUnitCost;
                const oversizeNorm =
                  hasOversizeSizes || scopeIsOversize
                    ? effectiveOversizeConsumption(row.consumption)
                    : null;
                return (
                  <TR
                    key={row.id}
                    className={cn(
                      !hideCosts &&
                        row.isFabric !== false &&
                        "cursor-pointer hover:bg-[var(--color-surface-subtle)]",
                      selectedMaterialId === row.id && "bg-[var(--color-primary-50)]/40",
                    )}
                    onClick={() => {
                      if (hideCosts) return;
                      setSelectedMaterialId(row.id);
                    }}
                  >
                    <TD title={row.name} className="min-w-[10rem] py-1.5 align-middle">
                      <CellStack
                        title={row.name}
                        subtitle={
                          [
                            row.sizeCode ? `Лише ${row.sizeCode}` : null,
                            !hideCosts && row.supplierName ? row.supplierName : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || undefined
                        }
                        wrap
                      />
                    </TD>
                    <TD numeric className="py-1.5">
                      {locked ? (
                        <span className="inline-flex flex-col items-end gap-0.5">
                          <span>
                            {row.consumption} {row.unit}
                          </span>
                          {oversizeNorm != null ? (
                            <span className="text-[10px] text-[var(--color-text-quiet)]">
                              XXL+ ≈ {oversizeNorm}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min={0}
                            step="0.0001"
                            defaultValue={row.consumption}
                            onBlur={(event) => {
                              const next = Math.max(0, Number(event.target.value) || 0);
                              if (next === row.consumption) return;
                              saveMaterialConsumption(row.id, next);
                            }}
                            onClick={(event) => event.stopPropagation()}
                            className="h-7 w-[64px] rounded-[6px] border border-[var(--color-border)] bg-white px-1 text-right text-[12.5px] tabular outline-none focus:border-[var(--color-primary-500)]"
                          />
                          <span className="w-7 text-left text-[11px] text-[var(--color-text-secondary)]">
                            {row.unit}
                          </span>
                        </span>
                      )}
                    </TD>
                    {!hideCosts ? (
                      <TD numeric className="py-1.5 text-[var(--color-text-secondary)]">
                        {row.waste}
                      </TD>
                    ) : null}
                    {!hideCosts ? (
                      <TD numeric className="py-1.5 text-[var(--color-text-secondary)]">
                        {formatMoneyUah(row.price)}
                      </TD>
                    ) : null}
                    {!hideCosts ? (
                      <TD numeric className="py-1.5 font-medium">
                        {formatMoneyUah(displayUnitCost)}
                      </TD>
                    ) : null}
                    {!locked ? (
                      <TD align="center" className="py-1.5">
                        <button
                          type="button"
                          aria-label={`Прибрати ${row.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setRemoveTarget({ kind: "material", id: row.id, name: row.name });
                          }}
                          className="rounded-[var(--radius-control)] p-1 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                        >
                          <IconTrash size={15} />
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
                  Разом на {totalQuantity} шт
                </TD>
                <TD numeric>{formatMoneyUah(materialsSubtotal)}</TD>
                {!locked ? <TD /> : null}
              </tr>
            </TFoot>
          ) : null}
        </Table>
        {!locked ? (
          <InlineAddOrderMaterial
            orderId={orderId}
            itemId={itemId}
            materials={materialOptions}
            units={unitOptions}
            sizeCode={sizeScope}
            hideCosts={hideCosts}
            canCreateCatalog={canCreateCatalog}
          />
        ) : null}
      </TableCard>

      <TableCard>
        <TableToolbar
          left={
            <span className="type-subsection">
              Операції
              <span className="type-caption ml-1.5 font-normal">{visibleOperations.length}</span>
            </span>
          }
        />
        <Table>
          <THead>
            <TH>Назва</TH>
            <TH>Метод</TH>
            {!hideCosts ? <TH align="right">/од.</TH> : null}
            {!locked ? <TH width="40px" /> : null}
          </THead>
          <TBody>
            {visibleOperations.length === 0 ? (
              <TableEmpty
                colSpan={(hideCosts ? 2 : 3) + (locked ? 0 : 1)}
                icon={<IconOperations size={20} />}
                title={sizeScope === ALL_SIZES ? "Порожньо" : `Немає для ${sizeScope}`}
                description="Додайте рядок знизу."
              />
            ) : (
              visibleOperations.map((row) => (
                <TR key={row.id}>
                  <TD className="py-1.5 font-medium">
                    {row.name}
                    {row.sizeCode ? (
                      <span className="type-caption ml-1.5">лише {row.sizeCode}</span>
                    ) : null}
                  </TD>
                  <TD className="py-1.5 text-[var(--color-text-secondary)]">
                    {operationMethodLabel(row.method)}
                  </TD>
                  {!hideCosts ? (
                    <TD numeric className="py-1.5 font-medium">
                      {formatMoneyUah(row.unitCost)}
                    </TD>
                  ) : null}
                  {!locked ? (
                    <TD align="center" className="py-1.5">
                      <button
                        type="button"
                        aria-label={`Прибрати ${row.name}`}
                        onClick={() =>
                          setRemoveTarget({ kind: "operation", id: row.id, name: row.name })
                        }
                        className="rounded-[var(--radius-control)] p-1 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                      >
                        <IconTrash size={15} />
                      </button>
                    </TD>
                  ) : null}
                </TR>
              ))
            )}
          </TBody>
          {operations.length > 0 && !hideCosts ? (
            <TFoot>
              <tr>
                <TD colSpan={2} className="text-[var(--color-text-secondary)]">
                  Разом на {totalQuantity} шт
                </TD>
                <TD numeric>{formatMoneyUah(operationsSubtotal)}</TD>
                {!locked ? <TD /> : null}
              </tr>
            </TFoot>
          ) : null}
        </Table>
        {!locked ? (
          <InlineAddOrderOperation
            orderId={orderId}
            itemId={itemId}
            operations={operationOptions}
            sizeCode={sizeScope}
            canCreateCatalog={canCreateCatalog}
          />
        ) : null}
      </TableCard>

      <TableCard>
        <TableToolbar
          left={
            <span className="type-subsection">
              {FIXED_COST_LINE_NAME_UK}
            </span>
          }
          right={
            <OrderSewerCountControl
              orderId={orderId}
              orderItemId={itemId}
              companySewerCount={companySewerCount}
              sewerCountOverride={sewerCountOverride}
              locked={locked || !canEditFixedCosts}
            />
          }
        />
        <Table>
          <THead>
            <TH>Назва</TH>
            <TH>Метод</TH>
            {!hideCosts ? <TH align="right">/од.</TH> : null}
            {!locked ? <TH width="40px" /> : null}
          </THead>
          <TBody>
            {!hideCosts && fixedCostAllocation && fixedCostAllocation.fixedCostTotal > 0 ? (
              <TR>
                <TD className="py-1.5 font-medium">{FIXED_COST_LINE_NAME_UK}</TD>
                <TD className="py-1.5 text-[var(--color-text-secondary)]">
                  Коеф. {fixedCostAllocation.metrics.coefficient.toFixed(1)}
                </TD>
                <TD numeric className="py-1.5 font-medium">
                  {formatMoneyUah(fixedCostAllocation.fixedCostPerUnit)}
                </TD>
                {!locked ? <TD /> : null}
              </TR>
            ) : (
              <TR muted>
                <TD colSpan={(hideCosts ? 2 : 3) + (locked ? 0 : 1)} className="py-1.5">
                  {fixedCostError ? (
                    <OrderFixedCostError error={fixedCostError} />
                  ) : (
                    <span className="type-caption">Немає «Пошив» — ПВ = 0.</span>
                  )}
                </TD>
              </TR>
            )}
          </TBody>
          {!hideCosts && fixedCostAllocation && fixedCostAllocation.fixedCostTotal > 0 ? (
            <TFoot>
              <tr>
                <TD colSpan={2} className="text-[var(--color-text-secondary)]">
                  Разом на {totalQuantity} шт
                </TD>
                <TD numeric>{formatMoneyUah(fixedCostAllocation.fixedCostTotal)}</TD>
                {!locked ? <TD /> : null}
              </tr>
            </TFoot>
          ) : null}
        </Table>
      </TableCard>

      <TableCard>
        <TableToolbar
          left={
            <span className="type-subsection">
              Нанесення
              <span className="type-caption ml-1.5 font-normal">{decorations.length}</span>
            </span>
          }
        />
        <Table className="table-fixed">
          <THead>
            <TH>Метод</TH>
            {!hideCosts ? (
              <TH align="right" width="88px" title="Один раз на партію">
                Приладка
              </TH>
            ) : null}
            {!hideCosts ? (
              <TH align="right" width="72px" title="За одиницю">
                /шт
              </TH>
            ) : null}
            {!locked ? <TH width="40px" /> : null}
          </THead>
          <TBody>
            {decorations.length === 0 ? (
              <TableEmpty
                colSpan={locked ? 3 : 4}
                icon={<IconDecoration size={20} />}
                title="Без нанесення"
                description="Додайте друк/вишивку знизу за потреби."
              />
            ) : (
              decorations.map((row) => (
                <TR key={row.id}>
                  <TD className="min-w-0 py-1.5">
                    <CellStack title={row.name} maxWidth="100%" />
                  </TD>
                  {!hideCosts ? (
                    <TD numeric className="py-1.5">
                      {locked ? (
                        <span className="text-[var(--color-text-secondary)]">
                          {formatMoneyUah(row.setupCost)}
                        </span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          defaultValue={row.setupCost}
                          disabled={pending}
                          onBlur={(event) => {
                            const next = Math.max(0, Number(event.target.value) || 0);
                            if (next === row.setupCost) return;
                            saveDecorationRates(row.id, next, row.unitRate);
                          }}
                          className="h-7 w-[72px] rounded-[6px] border border-[var(--color-border)] bg-white px-1 text-right text-[12.5px] tabular outline-none focus:border-[var(--color-primary-500)]"
                          title="Приладка (разово на партію)"
                        />
                      )}
                    </TD>
                  ) : null}
                  {!hideCosts ? (
                    <TD numeric className="py-1.5">
                      {locked ? (
                        <span className="font-medium">{formatMoneyUah(row.unitRate)}</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          defaultValue={row.unitRate}
                          disabled={pending}
                          onBlur={(event) => {
                            const next = Math.max(0, Number(event.target.value) || 0);
                            if (next === row.unitRate) return;
                            saveDecorationRates(row.id, row.setupCost, next);
                          }}
                          className="h-7 w-[64px] rounded-[6px] border border-[var(--color-border)] bg-white px-1 text-right text-[12.5px] tabular outline-none focus:border-[var(--color-primary-500)]"
                          title="Ставка за виріб"
                        />
                      )}
                    </TD>
                  ) : null}
                  {!locked ? (
                    <TD align="center" className="py-1.5">
                      <button
                        type="button"
                        aria-label={`Прибрати ${row.name}`}
                        onClick={() =>
                          setRemoveTarget({ kind: "decoration", id: row.id, name: row.name })
                        }
                        className="rounded-[var(--radius-control)] p-1 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                      >
                        <IconTrash size={15} />
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
                <TD
                  className="min-w-0 truncate text-[var(--color-text-secondary)]"
                  title={`На ${totalQuantity} шт: ${formatMoneyUah(decorationsSubtotal)}`}
                >
                  Разом
                </TD>
                <TD numeric>{formatMoneyUah(decorationSetupTotal)}</TD>
                <TD numeric>{formatMoneyUah(decorationUnitRateTotal)}</TD>
                {!locked ? <TD /> : null}
              </tr>
            </TFoot>
          ) : null}
        </Table>
        {!locked ? (
          <InlineAddOrderDecoration
            orderId={orderId}
            itemId={itemId}
            decorations={decorationOptions}
            canCreateCatalog={canCreateCatalog}
          />
        ) : null}
      </TableCard>

      <Modal
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title="Прибрати рядок?"
        description="Еталон виробу не зміниться"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)} disabled={pending}>
              Скасувати
            </Button>
            <Button variant="danger" onClick={confirmRemove} disabled={pending}>
              {pending ? "…" : "Прибрати"}
            </Button>
          </>
        }
      >
        <p className="type-body">{removeTarget?.name} — собівартість перерахується одразу.</p>
      </Modal>

      <OrderMaterialDetailPanel
        orderId={orderId}
        orderItemMaterialId={selectedMaterialId}
        locked={locked}
        onClose={() => setSelectedMaterialId(null)}
      />
    </div>
  );
}

function InlineAddOrderMaterial({
  orderId,
  itemId,
  materials,
  units,
  sizeCode,
  hideCosts = false,
  canCreateCatalog = false,
}: {
  orderId: string;
  itemId: string;
  materials: Array<{ id: string; label: string; composition?: string | null }>;
  units: Array<{ id: string; label: string }>;
  sizeCode: string;
  hideCosts?: boolean;
  canCreateCatalog?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [materialId, setMaterialId] = useState("");
  const [consumption, setConsumption] = useState("1");
  const [waste, setWaste] = useState("");

  function submit(nextMaterialId = materialId) {
    if (!nextMaterialId) return;
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("orderItemId", itemId);
    formData.set("materialId", nextMaterialId);
    formData.set("consumptionPerUnit", consumption || "1");
    formData.set("wastePercent", hideCosts ? "" : waste);
    formData.set("sizeCode", sizeCode);
    startTransition(async () => {
      await addOrderMaterialAction(formData);
      setMaterialId("");
      setConsumption("1");
      setWaste("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-divider)] bg-[var(--color-surface-subtle)] px-3 py-2">
      <Select
        size="sm"
        className="min-w-[160px] flex-1"
        value={materialId}
        onChange={(event) => setMaterialId(event.target.value)}
        aria-label="Матеріал з каталогу"
      >
        <option value="">+ матеріал…</option>
        {materials.map((row) => (
          <option
            key={row.id}
            value={row.id}
            data-description={row.composition?.trim() || undefined}
          >
            {row.label}
          </option>
        ))}
      </Select>
      <input
        type="number"
        min={0}
        step="0.0001"
        value={consumption}
        onChange={(event) => setConsumption(event.target.value)}
        aria-label="Норма"
        title="Норма"
        className="h-8 w-[68px] rounded-[6px] border border-[var(--color-border)] bg-white px-1.5 text-right text-[12.5px] tabular outline-none focus:border-[var(--color-primary-500)]"
      />
      {!hideCosts ? (
        <input
          type="number"
          min={0}
          step="0.01"
          value={waste}
          placeholder="%"
          title="Відходи %"
          aria-label="Відходи %"
          onChange={(event) => setWaste(event.target.value)}
          className="h-8 w-[56px] rounded-[6px] border border-[var(--color-border)] bg-white px-1.5 text-right text-[12.5px] tabular outline-none placeholder:text-[11px] focus:border-[var(--color-primary-500)]"
        />
      ) : null}
      <Button
        type="button"
        size="sm"
        disabled={!materialId || pending}
        onClick={() => submit()}
        className="inline-flex items-center gap-1"
      >
        <IconPlus size={14} />
        {pending ? "…" : "Додати"}
      </Button>
      {canCreateCatalog ? (
        <MaterialCreatePanel
          units={units}
          variant="ghost"
          size="sm"
          triggerLabel="Новий"
          onCreated={(result) => {
            const id = typeof result.materialId === "string" ? result.materialId : null;
            if (id) submit(id);
          }}
        />
      ) : null}
    </div>
  );
}

function InlineAddOrderOperation({
  orderId,
  itemId,
  operations,
  sizeCode,
  canCreateCatalog = false,
}: {
  orderId: string;
  itemId: string;
  operations: Array<{ id: string; label: string }>;
  sizeCode: string;
  canCreateCatalog?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [operationId, setOperationId] = useState("");

  function submit(nextId = operationId) {
    if (!nextId) return;
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("orderItemId", itemId);
    formData.set("operationId", nextId);
    formData.set("sizeCode", sizeCode);
    startTransition(async () => {
      await addOrderOperationAction(formData);
      setOperationId("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-divider)] bg-[var(--color-surface-subtle)] px-3 py-2">
      <Select
        size="sm"
        className="min-w-[180px] flex-1"
        value={operationId}
        onChange={(event) => setOperationId(event.target.value)}
        aria-label="Операція з каталогу"
      >
        <option value="">+ операція…</option>
        {operations.map((row) => (
          <option key={row.id} value={row.id}>
            {row.label}
          </option>
        ))}
      </Select>
      <Button
        type="button"
        size="sm"
        disabled={!operationId || pending}
        onClick={() => submit()}
        className="inline-flex items-center gap-1"
      >
        <IconPlus size={14} />
        {pending ? "…" : "Додати"}
      </Button>
      {canCreateCatalog ? (
        <OperationCreatePanel
          variant="ghost"
          size="sm"
          triggerLabel="Нова"
          onCreated={(result) => {
            const id = typeof result.operationId === "string" ? result.operationId : null;
            if (id) submit(id);
          }}
        />
      ) : null}
    </div>
  );
}

function InlineAddOrderDecoration({
  orderId,
  itemId,
  decorations,
  canCreateCatalog = false,
}: {
  orderId: string;
  itemId: string;
  decorations: Array<{ id: string; label: string }>;
  canCreateCatalog?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [decorationId, setDecorationId] = useState("");

  function submit(nextId = decorationId) {
    if (!nextId) return;
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("orderItemId", itemId);
    formData.set("decorationMethodId", nextId);
    startTransition(async () => {
      await addOrderDecorationAction(formData);
      setDecorationId("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-divider)] bg-[var(--color-surface-subtle)] px-3 py-2">
      <Select
        size="sm"
        className="min-w-[180px] flex-1"
        value={decorationId}
        onChange={(event) => setDecorationId(event.target.value)}
        aria-label="Нанесення з каталогу"
      >
        <option value="">+ нанесення…</option>
        {decorations.map((row) => (
          <option key={row.id} value={row.id}>
            {row.label}
          </option>
        ))}
      </Select>
      <Button
        type="button"
        size="sm"
        disabled={!decorationId || pending}
        onClick={() => submit()}
        className="inline-flex items-center gap-1"
      >
        <IconPlus size={14} />
        {pending ? "…" : "Додати"}
      </Button>
      {canCreateCatalog ? (
        <DecorationCreatePanel
          variant="ghost"
          size="sm"
          triggerLabel="Нове"
          onCreated={(result) => {
            const id = typeof result.decorationId === "string" ? result.decorationId : null;
            if (id) submit(id);
          }}
        />
      ) : null}
    </div>
  );
}
