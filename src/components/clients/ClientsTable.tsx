"use client";

import { useMemo } from "react";
import Link from "next/link";
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
import { IconChevronRight } from "@/components/ui/Icons";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { bulkArchiveClientsAction } from "@/server/domains/clients/actions";
import { cn } from "@/lib/utils";

export type ClientsTableRow = {
  id: string;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  ordersCount: number;
  lastOrder: { id: string; number: string; status: string } | null;
};

type SortKey = "company" | "contact" | "orders" | "lastOrder";

export function ClientsTable({
  rows,
  empty,
  canDelete = false,
}: {
  rows: ClientsTableRow[];
  empty: { title: string; description?: string; action?: React.ReactNode };
  canDelete?: boolean;
}) {
  const { sort, toggle } = useTableSort<SortKey>({ key: "company", direction: "asc" });
  const sorted = useMemo(
    () =>
      sortRows(rows, sort, {
        company: (row) => row.companyName,
        contact: (row) => row.phone || row.email || row.contactPerson,
        orders: (row) => row.ordersCount,
        lastOrder: (row) => row.lastOrder?.number,
      }),
    [rows, sort],
  );
  const ids = useMemo(() => sorted.map((row) => row.id), [sorted]);
  const selection = useRowSelection(ids);

  return (
    <div>
      <SelectionBar count={selection.selectedIds.length} onClear={selection.clear}>
        {selection.selectedIds.length === 1 ? (
          <OpenSelectedLink href={`/clients/${selection.selectedIds[0]}`} />
        ) : null}
        {canDelete ? (
          <BulkDeleteButton
            ids={selection.selectedIds}
            action={bulkArchiveClientsAction}
            title="Видалити клієнтів?"
            description="Обрані клієнти потраплять в архів і зникнуть зі списків для нових замовлень. Історія замовлень збережеться."
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
          <SortableTH columnKey="company" sort={sort} onSort={toggle}>
            Компанія
          </SortableTH>
          <SortableTH columnKey="contact" sort={sort} onSort={toggle}>
            Контакти
          </SortableTH>
          <SortableTH columnKey="lastOrder" sort={sort} onSort={toggle}>
            Останнє замовлення
          </SortableTH>
          <SortableTH columnKey="orders" sort={sort} onSort={toggle} align="right">
            Усього
          </SortableTH>
          <TH width="44px" stickyRight />
        </THead>
        <TBody>
          {sorted.length === 0 ? (
            <TableEmpty colSpan={6} title={empty.title} description={empty.description} action={empty.action} />
          ) : (
            sorted.map((client) => {
              const isSelected = selection.isSelected(client.id);
              return (
                <TR
                  key={client.id}
                  className={cn(
                    isSelected && "bg-[var(--color-tint-slate)] hover:bg-[var(--color-tint-slate)]",
                  )}
                >
                  <TD align="center">
                    <RowCheckbox
                      checked={isSelected}
                      onChange={() => selection.toggleOne(client.id)}
                      label={`Обрати ${client.companyName}`}
                    />
                  </TD>
                  <TD>
                    <CellStack
                      title={client.companyName}
                      subtitle={client.contactPerson || undefined}
                      href={`/clients/${client.id}`}
                      maxWidth="260px"
                    />
                  </TD>
                  <TD nowrap>
                    {client.phone || client.email ? (
                      <CellStack
                        title={
                          <span className="tabular font-normal">{client.phone || client.email}</span>
                        }
                        subtitle={client.phone && client.email ? client.email : undefined}
                        maxWidth="200px"
                      />
                    ) : (
                      <span className="text-[var(--color-text-tertiary)]">—</span>
                    )}
                  </TD>
                  <TD nowrap>
                    {client.lastOrder ? (
                      <Link
                        href={`/orders/${client.lastOrder.id}`}
                        className="inline-flex items-center gap-2 hover:text-[var(--color-primary-700)]"
                      >
                        <span className="tabular">{client.lastOrder.number}</span>
                        <OrderStatusBadge status={client.lastOrder.status} dot />
                      </Link>
                    ) : (
                      <span className="type-caption">ще немає замовлень</span>
                    )}
                  </TD>
                  <TD numeric className="font-medium text-[var(--color-text-primary)]">
                    {client.ordersCount}
                  </TD>
                  <TD align="center" stickyRight>
                    <Link
                      href={`/clients/${client.id}`}
                      aria-label={`Відкрити ${client.companyName}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-tint-slate)] hover:text-[var(--color-primary-700)]"
                    >
                      <IconChevronRight size={16} />
                    </Link>
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
