"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Page";
import { SizeRun } from "@/components/orders/SizeRun";
import {
  ProductThumb,
  type CatalogProduct,
  type DraftComposition,
} from "@/components/orders/ProductCatalogPanel";
import { DraftCompositionBomEditor } from "@/components/composition/DraftCompositionBomEditor";
import {
  type DecorationCatalogOption,
  type MaterialCatalogOption,
  type OperationCatalogOption,
} from "@/components/composition/DraftCompositionForms";
import { syncDraftMaterialPrices, compositionMissingMaterialChoices } from "@/lib/draft-composition";
import type { MaterialCostVatMode } from "@/lib/fabric-pricing";

export {
  DraftAddDecorationForm,
  DraftAddMaterialForm,
  DraftAddOperationForm,
  type DecorationCatalogOption,
  type MaterialCatalogOption,
  type OperationCatalogOption,
} from "@/components/composition/DraftCompositionForms";

export { cloneComposition, materialUnitCost } from "@/lib/draft-composition";

const TOTAL_SIZE = { code: "ONE", nameUk: "Тираж (орієнтовно)" };

/**
 * Left-workspace: review/edit product composition before adding the line to the order list.
 * Edits stay on the order draft — catalog product is never mutated.
 */
export function DraftCompositionEditor({
  product,
  composition,
  quantities,
  comment,
  editing,
  materialOptions = [],
  operationOptions = [],
  decorationOptions = [],
  unitOptions = [],
  onMaterialCatalogAdd,
  onMaterialCatalogColorsChange,
  onOperationCatalogAdd,
  onDecorationCatalogAdd,
  onQuantitiesChange,
  onCommentChange,
  onCompositionChange,
  onCancel,
  onConfirm,
  confirmDisabled,
  companyCostMode = "NET",
  fabricGlobals,
}: {
  product: CatalogProduct;
  composition: DraftComposition;
  quantities: Record<string, number>;
  comment: string;
  editing?: boolean;
  materialOptions?: MaterialCatalogOption[];
  operationOptions?: OperationCatalogOption[];
  decorationOptions?: DecorationCatalogOption[];
  unitOptions?: Array<{ id: string; label: string }>;
  onMaterialCatalogAdd?: (option: MaterialCatalogOption) => void;
  onMaterialCatalogColorsChange?: (materialId: string, colors: string[]) => void;
  onOperationCatalogAdd?: (option: OperationCatalogOption) => void;
  onDecorationCatalogAdd?: (option: DecorationCatalogOption) => void;
  onQuantitiesChange: (code: string, quantity: number) => void;
  onCommentChange: (value: string) => void;
  onCompositionChange: (next: DraftComposition) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  companyCostMode?: MaterialCostVatMode;
  fabricGlobals?: { usdUahRate: number; fabricCargoUsdPerKg: number };
}) {
  const productSizes = product.sizes.length
    ? product.sizes
    : [{ code: "ONE", nameUk: "Без розміру" }];
  const hasRealSizes = product.sizes.length > 0;
  const startsAsTotal =
    !hasRealSizes ||
    ((quantities.ONE ?? 0) > 0 &&
      productSizes.every((size) => size.code === "ONE" || !(quantities[size.code] > 0)));
  const [qtyMode, setQtyMode] = useState<"bySize" | "total">(
    hasRealSizes && !startsAsTotal ? "bySize" : "total",
  );

  const sizes = qtyMode === "total" ? [TOTAL_SIZE] : productSizes;
  const compositionReady = composition.materials.length > 0 && composition.operations.length > 0;
  const incompleteMaterials = compositionMissingMaterialChoices(composition, {
    enableLinePricingControls: true,
    companyCostMode,
  });
  const choicesComplete = incompleteMaterials.length === 0;
  const compositionReadyLabel = !compositionReady
    ? "Потрібен склад"
    : !choicesComplete
      ? `Потрібен вибір · ${incompleteMaterials.length}`
      : null;

  function applyQtyMode(next: "bySize" | "total") {
    if (next === qtyMode) return;
    setQtyMode(next);
    if (next === "total") {
      const total = productSizes.reduce((sum, size) => sum + (quantities[size.code] || 0), 0);
      const fromOne = quantities.ONE || 0;
      const value = total > 0 ? total : fromOne;
      for (const size of productSizes) {
        if (size.code !== "ONE") onQuantitiesChange(size.code, 0);
      }
      onQuantitiesChange("ONE", value);
      onCompositionChange(
        syncDraftMaterialPrices(composition, { ONE: value }, companyCostMode),
      );
      return;
    }
    const total = quantities.ONE || 0;
    onQuantitiesChange("ONE", 0);
    if (productSizes.length === 1) {
      onQuantitiesChange(productSizes[0]!.code, total);
      onCompositionChange(
        syncDraftMaterialPrices(
          composition,
          { [productSizes[0]!.code]: total },
          companyCostMode,
        ),
      );
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2 rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 shadow-[var(--shadow-card)]">
        <div className="flex min-w-0 flex-1 gap-3">
          <ProductThumb
            imageUrl={product.imageUrl}
            label={product.nameUk ?? product.label}
            active
            size="lg"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="type-subsection truncate">
                {editing ? "Редагування складу" : "Склад позиції"}
              </h3>
              {compositionReadyLabel ? (
                <StatusBadge tone="warning" dot>
                  {compositionReadyLabel}
                </StatusBadge>
              ) : null}
            </div>
            <p className="type-caption mt-0.5 truncate">
              {product.nameUk ?? product.label}
              {!choicesComplete
                ? " · оберіть колір і ПДВ у рядках з маркером"
                : " · додавайте рядки в таблицях нижче"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Скасувати
          </Button>
          <Button type="button" size="sm" disabled={confirmDisabled} onClick={onConfirm}>
            {editing ? "Зберегти в список" : "Погодити і додати"}
          </Button>
        </div>
      </div>

      <DraftCompositionBomEditor
        composition={composition}
        onCompositionChange={onCompositionChange}
        sizes={productSizes}
        materialOptions={materialOptions}
        operationOptions={operationOptions}
        decorationOptions={decorationOptions}
        unitOptions={unitOptions}
        onMaterialCatalogAdd={onMaterialCatalogAdd}
        onMaterialCatalogColorsChange={onMaterialCatalogColorsChange}
        onOperationCatalogAdd={onOperationCatalogAdd}
        onDecorationCatalogAdd={onDecorationCatalogAdd}
        quantitiesBySize={quantities}
        enableLinePricingControls
        companyCostMode={companyCostMode}
        fabricGlobals={fabricGlobals}
      />

      <div className="sticky bottom-14 z-10 space-y-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="shrink-0 text-[11px] font-medium text-[var(--color-text-tertiary)]">
            К-сть
          </span>
          {hasRealSizes ? (
            <div className="inline-flex rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-0.5">
              <button
                type="button"
                onClick={() => applyQtyMode("total")}
                className={`rounded-[5px] px-2 py-0.5 text-[11px] font-medium ${
                  qtyMode === "total"
                    ? "bg-white text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                Загальний тираж
              </button>
              <button
                type="button"
                onClick={() => applyQtyMode("bySize")}
                className={`rounded-[5px] px-2 py-0.5 text-[11px] font-medium ${
                  qtyMode === "bySize"
                    ? "bg-white text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                По розмірах
              </button>
            </div>
          ) : null}
          <SizeRun
            sizes={sizes}
            quantities={quantities}
            quiet
            onChange={(code, quantity) => {
              onQuantitiesChange(code, quantity);
              const nextQty = { ...quantities, [code]: quantity };
              onCompositionChange(
                syncDraftMaterialPrices(composition, nextQty, companyCostMode),
              );
            }}
          />
          {confirmDisabled ? (
            <span className="type-caption text-[var(--color-text-tertiary)]">
              {incompleteMaterials.length > 0
                ? `${incompleteMaterials.length} без параметрів`
                : "вкажіть кількість"}
            </span>
          ) : null}
        </div>
        {qtyMode === "total" && hasRealSizes ? (
          <p className="type-caption text-[var(--color-text-tertiary)]">
            Орієнтовний розрахунок без розкладки по розмірах. Точну сітку задайте пізніше у
            комплектації замовлення.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-divider)] pt-2">
          <input
            type="text"
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Коментар (необовʼязково)"
            className="h-8 min-w-[160px] flex-1 rounded-[6px] border border-[var(--color-border)] bg-transparent px-2.5 text-[12.5px] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-primary-500)]"
          />
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Скасувати
          </Button>
          <Button type="button" size="sm" disabled={confirmDisabled} onClick={onConfirm}>
            {editing ? "Зберегти в список" : "Погодити і додати"}
          </Button>
        </div>
      </div>
    </div>
  );
}
