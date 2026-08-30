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
import { formatMoneyUah, formatUnit } from "@/lib/utils";
import { CopySizeSpec, SizeScopeTabs } from "@/components/catalog/SizeScopeTabs";
import {
  ALL_SIZES,
  appliesToSize,
  consumptionForSize,
  customizedSizeCodes,
  type SizeScope,
} from "@/lib/size-bom";
import {
  copyProductSizeSpecAction,
  removeProductDecorationAction,
  removeProductMaterialAction,
  removeProductOperationAction,
  updateProductMaterialConsumptionAction,
  updateProductMaterialWasteAction,
} from "@/server/domains/products/actions";
import {
  AddProductDecorationPanel,
  AddProductMaterialPanel,
  AddProductOperationPanel,
  ProductAddMaterialBar,
} from "@/app/(app)/products/[id]/ProductCompositionForms";

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
};
type OperationView = {
  id: string;
  name: string;
  method: string;
  unitCost: number;
  sizeCodes: string[] | null;
};

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
  decorationsSubtotal,
  materialOptions,
  operationOptions,
  decorationOptions,
  unitOptions,
}: {
  productId: string;
  sizes: SizeOpt[];
  materials: MaterialView[];
  operations: OperationView[];
  decorations: Array<{ id: string; name: string; setupCost: number; unitRate: number }>;
  materialsSubtotal: number;
  operationsSubtotal: number;
  decorationsSubtotal: number;
  materialOptions: Array<{ id: string; label: string }>;
  operationOptions: Array<{ id: string; label: string }>;
  decorationOptions: Array<{ id: string; label: string }>;
  unitOptions: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
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
              ) : sizes.length > 1 ? (
                <p className="type-caption">
                  Спільна специфіка еталона. Оберіть розмір, щоб задати іншу норму або інший склад.
                </p>
              ) : null}
            </div>
          }
          right={
            <AddProductMaterialPanel
              productId={productId}
              materials={materialOptions}
              units={unitOptions}
              sizeIds={sizeIdsForAdd}
              sizeLabel={sizeLabelForAdd}
            />
          }
        />
        <Table>
          <THead>
            <TH className="min-w-[12rem] w-[38%]">Матеріал</TH>
            <TH align="right">Норма / од.</TH>
            <TH align="right">Відходи</TH>
            <TH align="right">Ціна</TH>
            <TH align="right">Собівартість / од.</TH>
            <TH width="52px" />
          </THead>
          <TBody>
            {visibleMaterials.length === 0 ? (
              <TableEmpty
                colSpan={6}
                title={
                  sizeScope === ALL_SIZES
                    ? "Матеріалів ще немає"
                    : "Немає матеріалів для цього розміру"
                }
                description="Додайте з рядка нижче — без матеріалів собівартість не розрахується."
              />
            ) : (
              visibleMaterials.map((row) => {
                const consumption =
                  sizeScope === ALL_SIZES
                    ? row.consumption
                    : consumptionForSize(row.consumption, row.sizeConsumption, sizeScope);
                const mixed =
                  sizeScope === ALL_SIZES && Object.keys(row.sizeConsumption).length > 0;
                return (
                  <TR key={row.id}>
                    <TD title={row.name} className="min-w-[12rem] w-[38%] align-top">
                      <CellStack
                        title={row.name}
                        subtitle={
                          row.sizeCodes?.length
                            ? row.sizeCodes.join(" · ")
                            : mixed
                              ? "Базова норма; по розмірах є перевизначення"
                              : undefined
                        }
                        wrap
                      />
                      />
                    </TD>
                    <TD numeric>
                      <span className="inline-flex flex-col items-end gap-0.5">
                        <span className="inline-flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min={0}
                            step="0.0001"
                            defaultValue={consumption}
                            title={
                              mixed && sizeScope === ALL_SIZES
                                ? "Редагує базову норму. Перевизначення по розмірах лишаються."
                                : undefined
                            }
                            onBlur={(event) => {
                              const next = Math.max(0, Number(event.target.value) || 0);
                              if (next === consumption) return;
                              saveConsumption(row.id, next);
                            }}
                            className={inputClass + " w-[72px]"}
                          />
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
                    <TD numeric>
                      <span className="inline-flex items-center justify-end gap-0.5">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          defaultValue={row.waste}
                          onBlur={(event) => {
                            const next = Math.max(0, Number(event.target.value) || 0);
                            if (next === row.waste) return;
                            saveWaste(row.id, next);
                          }}
                          className={inputClass}
                        />
                        <span className="text-[12px] text-[var(--color-text-secondary)]">%</span>
                      </span>
                    </TD>
                    <TD numeric className="text-[var(--color-text-secondary)]">
                      {formatMoneyUah(row.price)}
                    </TD>
                    <TD numeric className="font-medium">
                      {formatMoneyUah(consumption * (1 + row.waste / 100) * row.price)}
                    </TD>
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
                  </TR>
                );
              })
            )}
          </TBody>
          {materials.length > 0 ? (
            <TFoot>
              <tr>
                <TD colSpan={4} className="text-[var(--color-text-secondary)]">
                  Матеріали разом / од.
                </TD>
                <TD numeric>{formatMoneyUah(materialsSubtotal)}</TD>
                <TD />
              </tr>
            </TFoot>
          ) : null}
        </Table>
        <ProductAddMaterialBar
          productId={productId}
          materials={materialOptions}
          units={unitOptions}
          sizeIds={sizeIdsForAdd}
          sizeLabel={sizeLabelForAdd}
        />
      </TableCard>

      <TableCard>
        <TableToolbar
          left={<span className="type-subsection">Операції</span>}
          right={
            <AddProductOperationPanel
              productId={productId}
              operations={operationOptions}
              sizeIds={sizeIdsForAdd}
              sizeLabel={sizeLabelForAdd}
            />
          }
        />
        <Table>
          <THead>
            <TH>Операція</TH>
            <TH>Метод</TH>
            <TH align="right">Вартість / од.</TH>
            <TH width="52px" />
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
              visibleOperations.map((row) => (
                <TR key={row.id}>
                  <TD className="font-medium">
                    {row.name}
                    {row.sizeCodes?.length ? (
                      <span className="type-caption ml-1.5">{row.sizeCodes.join(" · ")}</span>
                    ) : null}
                  </TD>
                  <TD className="text-[var(--color-text-secondary)]">{row.method}</TD>
                  <TD numeric className="font-medium">
                    {formatMoneyUah(row.unitCost)}
                  </TD>
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
                </TR>
              ))
            )}
          </TBody>
          {operations.length > 0 ? (
            <TFoot>
              <tr>
                <TD colSpan={2} className="text-[var(--color-text-secondary)]">
                  Операції разом / од.
                </TD>
                <TD numeric>{formatMoneyUah(operationsSubtotal)}</TD>
                <TD />
              </tr>
            </TFoot>
          ) : null}
        </Table>
      </TableCard>

      <TableCard>
        <TableToolbar
          left={<span className="type-subsection">Нанесення</span>}
          right={
            <AddProductDecorationPanel productId={productId} decorations={decorationOptions} />
          }
        />
        <Table>
          <THead>
            <TH>Метод</TH>
            <TH align="right">Приладка</TH>
            <TH align="right">Тариф / од.</TH>
            <TH width="52px" />
          </THead>
          <TBody>
            {decorations.length === 0 ? (
              <TableEmpty
                colSpan={4}
                title="Нанесення не використовується"
                description="Необовʼязковий блок — додайте, якщо виріб має друк або вишивку."
              />
            ) : (
              decorations.map((row) => (
                <TR key={row.id}>
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
                      disabled={pending}
                      onClick={() => removeDecoration(row.id)}
                      className="rounded-[var(--radius-control)] p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] disabled:opacity-50"
                    >
                      <IconTrash size={16} />
                    </button>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
          {decorations.length > 0 ? (
            <TFoot>
              <tr>
                <TD colSpan={2} className="text-[var(--color-text-secondary)]">
                  Нанесення разом / од.
                </TD>
                <TD numeric>{formatMoneyUah(decorationsSubtotal)}</TD>
                <TD />
              </tr>
            </TFoot>
          ) : null}
        </Table>
      </TableCard>
    </div>
  );
}
