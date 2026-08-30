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
import { bulkArchiveDecorationsAction } from "@/server/domains/catalog/actions";
import {
  DecorationEditPanel,
  type DecorationFormDefaults,
} from "@/app/(app)/settings/applications/DecorationCreateForm";

export type DecorationsTableRow = {
  id: string;
  nameUk: string;
  calculationUnit: string;
  unitLabel: string;
  setupCost: number;
  unitRate: number;
  note: string;
};

type SortKey = "name" | "unit" | "setup" | "rate" | "batch";

export function DecorationsTable({
  rows,
  empty,
  canDelete = false,
  canEdit = false,
}: {
  rows: DecorationsTableRow[];
  empty: { title: string; description?: string; action?: React.ReactNode };
  canDelete?: boolean;
  canEdit?: boolean;
}) {
  const { sort, toggle } = useTableSort<SortKey>({ key: "name", direction: "asc" });
  const sorted = useMemo(
    () =>
      sortRows(rows, sort, {
        name: (row) => row.nameUk,
        unit: (row) => row.unitLabel,
        setup: (row) => row.setupCost,
        rate: (row) => row.unitRate,
        batch: (row) => row.setupCost + row.unitRate * 100,
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
            action={bulkArchiveDecorationsAction}
            title="Видалити методи нанесення?"
            description="Обрані методи потраплять в архів і зникнуть з нових комплектацій."
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
            Метод
          </SortableTH>
          <SortableTH columnKey="unit" sort={sort} onSort={toggle}>
            Розрахунок за
          </SortableTH>
          <SortableTH columnKey="setup" sort={sort} onSort={toggle} align="right">
            Приладка
          </SortableTH>
          <SortableTH columnKey="rate" sort={sort} onSort={toggle} align="right">
            Тариф / од.
          </SortableTH>
          <SortableTH columnKey="batch" sort={sort} onSort={toggle} align="right">
            На 100 од.
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
              const editDefaults: DecorationFormDefaults = {
                id: row.id,
                nameUk: row.nameUk,
                calculationUnit: row.calculationUnit,
                setupCost: row.setupCost,
                unitRate: row.unitRate,
                note: row.note,
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
                    <CellStack title={row.nameUk} maxWidth="240px" />
                  </TD>
                  <TD nowrap className="text-[var(--color-text-secondary)]">
                    {row.unitLabel}
                  </TD>
                  <TD numeric>{formatMoneyUah(row.setupCost)}</TD>
                  <TD numeric>{formatMoneyUah(row.unitRate)}</TD>
                  <TD numeric className="font-medium text-[var(--color-text-primary)]">
                    {formatMoneyUah(row.setupCost + row.unitRate * 100)}
                  </TD>
                  {canEdit ? (
                    <TD align="right" nowrap>
                      <DecorationEditPanel decoration={editDefaults} />
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
