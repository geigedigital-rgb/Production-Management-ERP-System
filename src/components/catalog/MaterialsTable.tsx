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
  costVatOverride?: "NET" | "GROSS" | null;
};

type SortKey = "name" | "type" | "unit" | "price" | "waste" | "cost";

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
  units: Array<{ id: string; label: string }>;
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
        price: (row) => row.purchasePrice,
        waste: (row) => row.waste,
        cost: (row) => row.purchasePrice * (1 + row.waste / 100),
      }),
    [rows, sort],
  );
  const ids = useMemo(() => sorted.map((row) => row.id), [sorted]);
  const selection = useRowSelection(ids);
  const colSpan = canEdit ? 8 : 7;

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
          <SortableTH columnKey="name" sort={sort} onSort={toggle}>
            Матеріал
          </SortableTH>
          <SortableTH columnKey="type" sort={sort} onSort={toggle}>
            Тип
          </SortableTH>
          <SortableTH columnKey="unit" sort={sort} onSort={toggle} align="center">
            Од.
          </SortableTH>
          <SortableTH columnKey="price" sort={sort} onSort={toggle} align="right">
            Ціна закупівлі
          </SortableTH>
          <SortableTH columnKey="waste" sort={sort} onSort={toggle} align="right">
            Відходи
          </SortableTH>
          <SortableTH columnKey="cost" sort={sort} onSort={toggle} align="right">
            Собівартість / од.
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
                  <TD>
                    <CellStack title={row.nameUk} subtitle={row.details || undefined} maxWidth="300px" />
                  </TD>
                  <TD nowrap className="text-[var(--color-text-secondary)]">
                    {typeLabels[row.type] ?? row.type}
                  </TD>
                  <TD align="center" nowrap>
                    {formatUnit(row.unitCode)}
                  </TD>
                  <TD numeric className="font-medium">
                    {formatMoneyUah(row.purchasePrice)}
                  </TD>
                  <TD numeric className="text-[var(--color-text-secondary)]">
                    {row.waste}%
                  </TD>
                  <TD numeric title="Ціна закупівлі з урахуванням відходів">
                    {formatMoneyUah(row.purchasePrice * (1 + row.waste / 100))}
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
