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
import { formatMoneyUah, formatUnit, cn } from "@/lib/utils";
import { bulkArchiveMaterialsAction } from "@/server/domains/catalog/actions";
import {
  MaterialEditPanel,
  type MaterialFormDefaults,
} from "@/app/(app)/settings/resources/MaterialCreateForm";
import type { FabricPricingGlobals } from "@/lib/fabric-pricing";

const typeLabels: Record<string, string> = {
  FABRIC: "Тканина",
  OTHER_MATERIAL: "Інший матеріал",
  TRIM: "Фурнітура",
};

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
  details: string;
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

type SortKey = "name" | "type" | "unit" | "suppliers" | "density" | "composition" | "price";

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
        type: (row) => typeLabels[row.type] ?? row.type,
        unit: (row) => row.unitCode,
        suppliers: (row) => row.supplierNames.join(" ") || row.supplierCode,
        density: (row) => {
          const n = Number(String(row.densityGsm ?? "").replace(",", "."));
          return Number.isFinite(n) && n > 0 ? n : null;
        },
        composition: (row) => row.composition?.trim() || null,
        price: (row) => row.purchasePrice,
      }),
    [rows, sort],
  );
  const ids = useMemo(() => sorted.map((row) => row.id), [sorted]);
  const selection = useRowSelection(ids);
  const colSpan = canEdit ? 9 : 8;

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
          <SortableTH columnKey="name" sort={sort} onSort={toggle} className="min-w-[14rem] w-[28%]">
            Матеріал
          </SortableTH>
          <SortableTH columnKey="type" sort={sort} onSort={toggle}>
            Тип
          </SortableTH>
          <SortableTH columnKey="unit" sort={sort} onSort={toggle} align="center" width="3rem">
            Од.
          </SortableTH>
          <SortableTH columnKey="suppliers" sort={sort} onSort={toggle} className="min-w-[8rem]">
            Постачальники
          </SortableTH>
          <SortableTH columnKey="density" sort={sort} onSort={toggle} align="right">
            Щільність
          </SortableTH>
          <SortableTH columnKey="composition" sort={sort} onSort={toggle} className="min-w-[7rem]">
            Склад
          </SortableTH>
          <SortableTH columnKey="price" sort={sort} onSort={toggle} align="right">
            Ціна
          </SortableTH>
          {canEdit ? (
            <TH width="88px" align="right">
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
                    <CellStack title={row.nameUk} subtitle={row.details || undefined} wrap />
                  </TD>
                  <TD nowrap className="text-[var(--color-text-secondary)]">
                    {typeLabels[row.type] ?? row.type}
                  </TD>
                  <TD align="center" nowrap className="w-[3rem] type-mono text-[12px] tabular-nums text-[var(--color-text-secondary)]">
                    {formatUnit(row.unitCode)}
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
                  <TD numeric className="font-medium">
                    {formatMoneyUah(row.purchasePrice)}
                  </TD>
                  {canEdit ? (
                    <TD align="right" nowrap>
                      <MaterialEditPanel
                        units={units}
                        suppliers={suppliers}
                        material={editDefaults}
                        fabricGlobals={fabricGlobals}
                      />
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
