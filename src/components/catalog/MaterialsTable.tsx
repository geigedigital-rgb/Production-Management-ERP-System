"use client";

import { useMemo } from "react";
import {
  CellStack,
  Table,
  TableEmpty,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/Table";
import {
  RowCheckbox,
  SelectionBar,
  SortableTH,
  sortRows,
  useRowSelection,
  useTableSort,
} from "@/components/ui/table-interactions";
import { BulkDeleteButton } from "@/components/ui/BulkDeleteButton";
import { formatDateTimeUk, formatMoneyUah, cn } from "@/lib/utils";
import { bulkArchiveMaterialsAction } from "@/server/domains/catalog/actions";
import {
  MaterialEditPanel,
  type MaterialFormDefaults,
} from "@/app/(app)/settings/resources/MaterialCreateForm";
import {
  resolveCostMode,
  resolveMaterialCostPrice,
  type FabricPricingGlobals,
} from "@/lib/fabric-pricing";
import { MaterialTagDot } from "@/components/catalog/MaterialTagPicker";
import { normalizeMaterialTagColor } from "@/lib/material-tags";
import {
  MaterialDeleteIconButton,
  MaterialDuplicateIconButton,
} from "@/components/catalog/MaterialRowActions";

export type MaterialsTableRow = {
  id: string;
  nameUk: string;
  type: string;
  unitCode: string;
  unitOfMeasureId: string;
  purchasePrice: number;
  waste: number;
  supplierCode: string;
  /** Names from supplierOffers (+ legacy supplierCode fallback). */
  supplierNames: string[];
  colorOrAttribute: string;
  note: string;
  referenceUrls?: string[];
  updatedAt?: string | null;
  details: string;
  tagColor?: string | null;
  densityGsm?: string;
  composition?: string;
  metersPerKg?: number | null;
  priceKgUsd?: number | null;
  priceKgUsdCargo?: number | null;
  priceKgUsdVat?: number | null;
  priceMeterUahNoVat?: number | null;
  priceMeterUahVat?: number | null;
  priceMeterUahCutVat?: number | null;
  fabricKindUk?: string;
  widthCm?: string;
  wholesaleNote?: string;
  rollWeightKg?: number | null;
  metersPerRoll?: number | null;
  minWholesaleMeters?: number | null;
  costVatOverride?: "NET" | "GROSS" | null;
};

type SortKey = "name" | "density" | "composition" | "suppliers" | "price" | "updated";

function formatDensity(value?: string) {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return /г\/м/i.test(trimmed) ? trimmed : `${trimmed} г/м²`;
}

function formatSuppliers(names: string[]) {
  if (names.length === 0) return null;
  if (names.length <= 2) return names.join(" · ");
  return `${names[0]} · ${names[1]} +${names.length - 2}`;
}

/** List price = базова; never retail (priceMeterUahCutVat) when tier pricing exists. */
function materialListBasePrice(
  row: MaterialsTableRow,
  fabricGlobals?: FabricPricingGlobals,
): number {
  const cut = Number(row.priceMeterUahCutVat);
  const hasRetail = Number.isFinite(cut) && cut > 0;
  if (!hasRetail) return row.purchasePrice;

  const mode = resolveCostMode(
    fabricGlobals?.materialCostVatMode ?? "NET",
    row.costVatOverride ?? null,
  );
  const base = resolveMaterialCostPrice({
    mode,
    priceMeterUahNoVat: row.priceMeterUahNoVat,
    priceMeterUahVat: row.priceMeterUahVat,
    fallbackPurchasePrice: 0,
  });
  if (base > 0) return base;
  // purchasePrice is often = cut in catalog — only use it if it clearly isn't retail
  if (row.purchasePrice > 0 && Math.abs(row.purchasePrice - cut) > 0.009) {
    return row.purchasePrice;
  }
  return 0;
}

export function MaterialsTable({
  rows,
  units,
  suppliers = [],
  fabricGlobals,
  empty,
  canDelete = false,
  canEdit = false,
}: {
  rows: MaterialsTableRow[];
  units: Array<{ id: string; label: string; code?: string }>;
  suppliers?: string[];
  fabricGlobals?: FabricPricingGlobals;
  empty: { title: string; description?: string; action?: React.ReactNode };
  canDelete?: boolean;
  canEdit?: boolean;
}) {
  const { sort, toggle } = useTableSort<SortKey>({ key: "name", direction: "asc" });
  const sorted = useMemo(
    () =>
      sortRows(rows, sort, {
        name: (row) => row.nameUk,
        density: (row) => {
          const n = Number(String(row.densityGsm ?? "").replace(",", "."));
          return Number.isFinite(n) && n > 0 ? n : null;
        },
        composition: (row) => row.composition?.trim() || null,
        suppliers: (row) => row.supplierNames.join(" ") || row.supplierCode,
        price: (row) => materialListBasePrice(row, fabricGlobals),
        updated: (row) => (row.updatedAt ? new Date(row.updatedAt).getTime() : null),
      }),
    [rows, sort, fabricGlobals],
  );
  const ids = useMemo(() => sorted.map((row) => row.id), [sorted]);
  const selection = useRowSelection(ids);
  const colSpan = canEdit || canDelete ? 8 : 7;

  return (
    <div>
      <SelectionBar count={selection.selectedIds.length} onClear={selection.clear}>
        {canDelete ? (
          <BulkDeleteButton
            ids={selection.selectedIds}
            action={bulkArchiveMaterialsAction}
            title="Видалити матеріали?"
            description="Обрані матеріали потраплять в архів і зникнуть з нових комплектацій. Зафіксовані версії замовлень не зміняться."
            onDone={selection.clear}
          />
        ) : null}
      </SelectionBar>

      <Table>
        <THead>
          <TH width="40px" align="center">
            <RowCheckbox
              checked={selection.allSelected}
              indeterminate={selection.someSelected}
              onChange={selection.toggleAll}
              label="Обрати всі"
            />
          </TH>
          <SortableTH columnKey="name" sort={sort} onSort={toggle} className="min-w-[14rem] w-[26%]">
            Назва
          </SortableTH>
          <SortableTH columnKey="density" sort={sort} onSort={toggle} align="right">
            Щільність
          </SortableTH>
          <SortableTH columnKey="composition" sort={sort} onSort={toggle} className="min-w-[7rem]">
            Склад
          </SortableTH>
          <SortableTH columnKey="suppliers" sort={sort} onSort={toggle} className="min-w-[8rem]">
            Постачальник
          </SortableTH>
          <SortableTH columnKey="price" sort={sort} onSort={toggle} align="right">
            Ціна
          </SortableTH>
          <SortableTH columnKey="updated" sort={sort} onSort={toggle} align="right" className="min-w-[7rem]">
            Змінено
          </SortableTH>
          {canEdit || canDelete ? (
            <TH width="96px" align="right">
              <span className="sr-only">Дії</span>
            </TH>
          ) : null}
        </THead>
        <TBody>
          {sorted.length === 0 ? (
            <TableEmpty colSpan={colSpan} title={empty.title} description={empty.description} action={empty.action} />
          ) : (
            sorted.map((row) => {
              const isSelected = selection.isSelected(row.id);
              const densityLabel = formatDensity(row.densityGsm);
              const suppliersLabel = formatSuppliers(row.supplierNames);
              const composition = row.composition?.replace(/\s+/g, " ").trim() || null;
              const editDefaults: MaterialFormDefaults = {
                id: row.id,
                nameUk: row.nameUk,
                type: row.type,
                unitOfMeasureId: row.unitOfMeasureId,
                purchasePrice: row.purchasePrice,
                defaultWastePercent: row.waste,
                supplierCode: row.supplierCode,
                colorOrAttribute: row.colorOrAttribute,
                note: row.note,
                referenceUrls: row.referenceUrls ?? [],
                updatedAt: row.updatedAt,
                tagColor: row.tagColor,
                densityGsm: row.densityGsm,
                composition: row.composition,
                metersPerKg: row.metersPerKg,
                priceKgUsd: row.priceKgUsd,
                priceKgUsdCargo: row.priceKgUsdCargo,
                priceKgUsdVat: row.priceKgUsdVat,
                priceMeterUahNoVat: row.priceMeterUahNoVat,
                priceMeterUahVat: row.priceMeterUahVat,
                priceMeterUahCutVat: row.priceMeterUahCutVat,
                fabricKindUk: row.fabricKindUk,
                widthCm: row.widthCm,
                wholesaleNote: row.wholesaleNote,
                rollWeightKg: row.rollWeightKg,
                metersPerRoll: row.metersPerRoll,
                minWholesaleMeters: row.minWholesaleMeters,
                costVatOverride: row.costVatOverride,
              };
              const tag = normalizeMaterialTagColor(row.tagColor);
              return (
                <TR
                  key={row.id}
                  className={cn(
                    isSelected && "bg-[var(--color-tint-slate)] hover:bg-[var(--color-tint-slate)]",
                  )}
                >
                  <TD align="center">
                    <RowCheckbox
                      checked={isSelected}
                      onChange={() => selection.toggleOne(row.id)}
                      label={`Обрати ${row.nameUk}`}
                    />
                  </TD>
                  <TD className="min-w-[14rem]">
                    <div className="flex items-start gap-2.5">
                      {tag ? (
                        <MaterialTagDot color={tag} />
                      ) : (
                        <span className="mt-0.5 inline-flex size-3 shrink-0" aria-hidden />
                      )}
                      {canEdit ? (
                        <MaterialEditPanel
                          units={units}
                          suppliers={suppliers}
                          material={editDefaults}
                          fabricGlobals={fabricGlobals}
                          trigger={({ open }) => (
                            <button
                              type="button"
                              onClick={open}
                              className="min-w-0 text-left"
                            >
                              <span className="block text-[13.5px] font-medium text-[var(--color-text-primary)] underline-offset-2 hover:underline">
                                {row.nameUk}
                              </span>
                              {row.details ? (
                                <span className="mt-0.5 block text-[12px] text-[var(--color-text-tertiary)]">
                                  {row.details}
                                </span>
                              ) : null}
                            </button>
                          )}
                        />
                      ) : (
                        <CellStack title={row.nameUk} subtitle={row.details || undefined} wrap />
                      )}
                    </div>
                  </TD>
                  <TD numeric nowrap className="text-[var(--color-text-secondary)]">
                    {densityLabel ?? <span className="text-[var(--color-text-tertiary)]">—</span>}
                  </TD>
                  <TD className="max-w-[10rem] text-[var(--color-text-secondary)]">
                    {composition ? (
                      <span className="line-clamp-2" title={composition}>
                        {composition}
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-tertiary)]">—</span>
                    )}
                  </TD>
                  <TD className="max-w-[12rem] text-[var(--color-text-secondary)]">
                    {suppliersLabel ? (
                      <span className="line-clamp-2" title={row.supplierNames.join(", ")}>
                        {suppliersLabel}
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-tertiary)]">—</span>
                    )}
                  </TD>
                  <TD numeric className="font-medium">
                    {formatMoneyUah(materialListBasePrice(row, fabricGlobals))}
                  </TD>
                  <TD numeric nowrap className="text-[12px] text-[var(--color-text-tertiary)]">
                    {formatDateTimeUk(row.updatedAt)}
                  </TD>
                  {canEdit || canDelete ? (
                    <TD align="right" nowrap>
                      <div className="inline-flex items-center justify-end gap-0.5">
                        {canEdit ? (
                          <MaterialDuplicateIconButton
                            materialId={row.id}
                            materialName={row.nameUk}
                          />
                        ) : null}
                        {canDelete ? (
                          <MaterialDeleteIconButton
                            materialId={row.id}
                            materialName={row.nameUk}
                          />
                        ) : null}
                      </div>
                    </TD>
                  ) : null}
                </TR>
              );
            })
          )}
        </TBody>
      </Table>
    </div>
  );
}
