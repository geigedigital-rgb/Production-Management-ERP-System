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
import { formatMoneyUah, cn } from "@/lib/utils";
import { bulkArchiveOperationsAction } from "@/server/domains/catalog/actions";
import {
  OperationEditPanel,
  type OperationFormDefaults,
} from "@/app/(app)/settings/operations/OperationCreateForm";
import { operationMethodLabel } from "@/lib/operation-labels";

export type OperationsTableRow = {
  id: string;
  nameUk: string;
  method: string;
  baseRate: number | null;
  shiftCost: number | null;
  standardOutput: number | null;
  note: string;
  unitCostLabel: string;
  unitCostValue: number | null;
  rateTiers: Array<{ minQuantity: number; ratePerUnit: number }>;
};

type SortKey = "name" | "method" | "shiftCost" | "output" | "unitCost";

export function OperationsTable({
  rows,
  empty,
  canDelete = false,
  canEdit = false,
}: {
  rows: OperationsTableRow[];
  empty: { title: string; description?: string; action?: React.ReactNode };
  canDelete?: boolean;
  canEdit?: boolean;
}) {
  const { sort, toggle } = useTableSort<SortKey>({ key: "name", direction: "asc" });
  const sorted = useMemo(
    () =>
      sortRows(rows, sort, {
        name: (row) => row.nameUk,
        method: (row) => operationMethodLabel(row.method),
        shiftCost: (row) => row.shiftCost,
        output: (row) => row.standardOutput,
        unitCost: (row) => row.unitCostValue,
      }),
    [rows, sort],
  );
  const ids = useMemo(() => sorted.map((row) => row.id), [sorted]);
  const selection = useRowSelection(ids);
  const colSpan = canEdit ? 7 : 6;

  return (
    <div>
      <SelectionBar count={selection.selectedIds.length} onClear={selection.clear}>
        {canDelete ? (
          <BulkDeleteButton
            ids={selection.selectedIds}
            action={bulkArchiveOperationsAction}
            title="Видалити операції?"
            description="Обрані операції потраплять в архів і зникнуть з нових комплектацій."
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
            Назва
          </SortableTH>
          <SortableTH columnKey="method" sort={sort} onSort={toggle}>
            Метод
          </SortableTH>
          <SortableTH columnKey="shiftCost" sort={sort} onSort={toggle} align="right">
            Вартість зміни
          </SortableTH>
          <SortableTH columnKey="output" sort={sort} onSort={toggle} align="right">
            Норма / зміну
          </SortableTH>
          <SortableTH columnKey="unitCost" sort={sort} onSort={toggle} align="right">
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
              const editDefaults: OperationFormDefaults = {
                id: row.id,
                nameUk: row.nameUk,
                calculationMethod: row.method as OperationFormDefaults["calculationMethod"],
                baseRate: row.baseRate,
                shiftCost: row.shiftCost,
                standardOutputPerShift: row.standardOutput,
                note: row.note,
                rateTiers: row.rateTiers,
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
                    <CellStack title={row.nameUk} maxWidth="320px" />
                  </TD>
                  <TD nowrap className="text-[var(--color-text-secondary)]">
                    {operationMethodLabel(row.method)}
                  </TD>
                  <TD numeric className="text-[var(--color-text-secondary)]">
                    {row.shiftCost != null ? formatMoneyUah(row.shiftCost) : "—"}
                  </TD>
                  <TD numeric className="text-[var(--color-text-secondary)]">
                    {row.standardOutput != null ? row.standardOutput : "—"}
                  </TD>
                  <TD numeric className="font-medium">
                    {row.unitCostLabel}
                  </TD>
                  {canEdit ? (
                    <TD align="right" nowrap>
                      <OperationEditPanel operation={editDefaults} />
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
