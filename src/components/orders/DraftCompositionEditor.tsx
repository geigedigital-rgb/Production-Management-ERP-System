"use client";

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
import { syncDraftMaterialPrices } from "@/lib/draft-composition";
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
  onOperationCatalogAdd,
  onDecorationCatalogAdd,
  onQuantitiesChange,
  onCommentChange,
  onCompositionChange,
  onCancel,
  onConfirm,
  confirmDisabled,
  companyCostMode = "NET",
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
  onOperationCatalogAdd?: (option: OperationCatalogOption) => void;
  onDecorationCatalogAdd?: (option: DecorationCatalogOption) => void;
  onQuantitiesChange: (code: string, quantity: number) => void;
  onCommentChange: (value: string) => void;
  onCompositionChange: (next: DraftComposition) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  companyCostMode?: MaterialCostVatMode;
}) {
  const sizes = product.sizes.length
    ? product.sizes
    : [{ code: "ONE", nameUk: "Без розміру" }];
  const ready = composition.materials.length > 0 && composition.operations.length > 0;
  const materialsChanged =
    composition.materials.length !== product.composition.materials.length ||
    composition.operations.length !== product.composition.operations.length ||
    composition.decorations.length !== product.composition.decorations.length;

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
              <StatusBadge tone={ready ? "success" : "warning"} dot>
                {ready ? "Готовий" : "Потрібен склад"}
              </StatusBadge>
            </div>
            <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
              {product.nameUk ?? product.label}
            </p>
            {product.internalCode ? (
              <p className="type-caption mt-0.5 tabular">{product.internalCode}</p>
            ) : null}
            <p className="type-caption mt-1 text-[var(--color-text-tertiary)]">
              Еталон не змінюється
              {materialsChanged ? " · склад уже відрізняється" : ""} · додавайте рядки в таблицях
              нижче
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
        sizes={sizes}
        materialOptions={materialOptions}
        operationOptions={operationOptions}
        decorationOptions={decorationOptions}
        unitOptions={unitOptions}
        onMaterialCatalogAdd={onMaterialCatalogAdd}
        onOperationCatalogAdd={onOperationCatalogAdd}
        onDecorationCatalogAdd={onDecorationCatalogAdd}
        quantitiesBySize={quantities}
        enableLinePricingControls
        companyCostMode={companyCostMode}
      />

      <div className="sticky bottom-14 z-10 space-y-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="shrink-0 text-[11px] font-medium text-[var(--color-text-tertiary)]">
            К-сть
          </span>
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
            <span className="type-caption text-[var(--color-warning-text)]">вкажіть кількість</span>
          ) : null}
        </div>
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
