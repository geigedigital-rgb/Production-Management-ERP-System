"use client";

import { useMemo } from "react";
import { StatusBadge } from "@/components/ui/Page";
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
import { BulkDeleteButton, OpenSelectedLink } from "@/components/ui/BulkDeleteButton";
import { cn, formatAmount } from "@/lib/utils";
import { bulkArchiveProductsAction } from "@/server/domains/products/actions";

export type ProductsTableRow = {
  id: string;
  nameUk: string;
  internalCode: string | null;
  isBaseModel?: boolean;
  materialsCount: number;
  operationsCount: number;
  decorationsCount: number;
  ready: boolean;
  prices: Array<number | null>;
  priceTiers: number[];
};

type SortKey = "name" | "composition" | "status" | "price";

export function ProductsTable({
  rows,
  empty,
  canDelete = false,
}: {
  rows: ProductsTableRow[];
  empty: { title: string; description?: string; action?: React.ReactNode };
  canDelete?: boolean;
}) {
  const priceTiers = rows[0]?.priceTiers ?? [50, 100, 500];
  const { sort, toggle } = useTableSort<SortKey>({ key: "name", direction: "asc" });
  const sorted = useMemo(
    () =>
      sortRows(rows, sort, {
        name: (row) => row.nameUk,
        composition: (row) => row.materialsCount + row.operationsCount,
        status: (row) => (row.ready ? 1 : 0),
        price: (row) => row.prices[1] ?? row.prices[0] ?? 0,
      }),
    [rows, sort],
  );
  const ids = useMemo(() => sorted.map((row) => row.id), [sorted]);
  const selection = useRowSelection(ids);

  return (
    <div>
      <SelectionBar count={selection.selectedIds.length} onClear={selection.clear}>
        {selection.selectedIds.length === 1 ? (
          <OpenSelectedLink href={`/products/${selection.selectedIds[0]}`} />
        ) : null}
        {canDelete ? (
          <BulkDeleteButton
            ids={selection.selectedIds}
            action={bulkArchiveProductsAction}
            title="Видалити вироби?"
            description="Обрані вироби потраплять в архів і зникнуть з каталогу для нових замовлень. Зафіксовані версії в замовленнях не зміняться."
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
            Виріб
          </SortableTH>
          <SortableTH columnKey="composition" sort={sort} onSort={toggle}>
            Комплектація
          </SortableTH>
          <SortableTH columnKey="price" sort={sort} onSort={toggle} align="right">
            <span className="block">Розрахунковий прайс, ₴</span>
            <span className="mt-0.5 flex justify-end gap-4 font-normal normal-case tracking-normal">
              {priceTiers.map((qty) => (
                <span key={qty} className="tabular w-[76px] text-right">
                  {qty} шт
                </span>
              ))}
            </span>
          </SortableTH>
          <SortableTH columnKey="status" sort={sort} onSort={toggle} stickyRight>
            Стан
          </SortableTH>
        </THead>
        <TBody>
          {sorted.length === 0 ? (
            <TableEmpty colSpan={5} title={empty.title} description={empty.description} action={empty.action} />
          ) : (
            sorted.map((product) => {
              const isSelected = selection.isSelected(product.id);
              return (
                <TR
                  key={product.id}
                  className={cn(
                    isSelected && "bg-[var(--color-tint-slate)] hover:bg-[var(--color-tint-slate)]",
                  )}
                >
                  <TD align="center">
                    <RowCheckbox
                      checked={isSelected}
                      onChange={() => selection.toggleOne(product.id)}
                      label={`Обрати ${product.nameUk}`}
                    />
                  </TD>
                  <TD>
                    <CellStack
                      title={product.nameUk}
                      subtitle={
                        <>
                          {product.isBaseModel ? (
                            <span className="text-[var(--color-primary-700)]">Базова модель</span>
                          ) : null}
                          {product.isBaseModel && product.internalCode ? " · " : null}
                          {product.internalCode ?? undefined}
                        </>
                      }
                      href={`/products/${product.id}`}
                      maxWidth="260px"
                    />
                  </TD>
                  <TD nowrap className="text-[var(--color-text-secondary)]">
                    {product.materialsCount} мат. · {product.operationsCount} оп. ·{" "}
                    {product.decorationsCount} нанес.
                  </TD>
                  <TD nowrap>
                    <div className="flex justify-end gap-4">
                      {product.prices.map((price, index) => (
                        <span
                          key={priceTiers[index]}
                          className={cn(
                            "tabular w-[76px] text-right",
                            !product.ready && "text-[var(--color-text-tertiary)]",
                            index === 1 && "font-medium",
                          )}
                        >
                          {product.ready && price != null ? formatAmount(Number(price)) : "—"}
                        </span>
                      ))}
                    </div>
                  </TD>
                  <TD nowrap stickyRight>
                    <StatusBadge dot tone={product.ready ? "success" : "warning"}>
                      {product.ready ? "Готовий" : "Комплектація"}
                    </StatusBadge>
                  </TD>
                </TR>
              );
            })
          )}
        </TBody>
      </Table>
    </div>
  );
}
