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
import { BulkDeleteButton } from "@/components/ui/BulkDeleteButton";
import { formatDateUk, cn } from "@/lib/utils";
import { bulkDeactivateUsersAction } from "@/server/domains/users/actions";
import { UserAccessPanel, type UserAccessRow } from "@/components/settings/UserAccessPanel";

const roleLabels: Record<string, string> = {
  ADMINISTRATOR: "Адміністратор",
  MANAGER: "Менеджер",
};

export type UsersTableRow = UserAccessRow & {
  isActive: boolean;
  createdAt: string;
};

type SortKey = "name" | "role" | "status" | "created";

export function UsersTable({
  rows,
  canManage = false,
}: {
  rows: UsersTableRow[];
  canManage?: boolean;
}) {
  const { sort, toggle } = useTableSort<SortKey>({ key: "name", direction: "asc" });
  const sorted = useMemo(
    () =>
      sortRows(rows, sort, {
        name: (row) => row.name,
        role: (row) => roleLabels[row.role] ?? row.role,
        status: (row) => (row.isActive ? 1 : 0),
        created: (row) => row.createdAt,
      }),
    [rows, sort],
  );
  const ids = useMemo(
    () => sorted.filter((row) => !row.isSelf).map((row) => row.id),
    [sorted],
  );
  const selection = useRowSelection(ids);
  const selectableSorted = sorted.filter((row) => !row.isSelf);

  return (
    <div>
      <SelectionBar count={selection.selectedIds.length} onClear={selection.clear}>
        {canManage ? (
          <BulkDeleteButton
            ids={selection.selectedIds}
            action={bulkDeactivateUsersAction}
            title="Деактивувати користувачів?"
            description="Обрані облікові записи буде вимкнено. Власний акаунт видалити не можна."
            onDone={selection.clear}
          />
        ) : null}
      </SelectionBar>

      <Table>
        <THead>
          <TH width="40px" align="center">
            <RowCheckbox
              checked={
                selectableSorted.length > 0 &&
                selection.selectedIds.length === selectableSorted.length
              }
              indeterminate={selection.someSelected}
              onChange={selection.toggleAll}
              label="Обрати всі"
            />
          </TH>
          <SortableTH columnKey="name" sort={sort} onSort={toggle}>
            Користувач
          </SortableTH>
          <SortableTH columnKey="role" sort={sort} onSort={toggle}>
            Роль
          </SortableTH>
          <SortableTH columnKey="status" sort={sort} onSort={toggle}>
            Стан
          </SortableTH>
          <SortableTH columnKey="created" sort={sort} onSort={toggle} align="right">
            Створено
          </SortableTH>
          <TH width="120px" align="right">
            Дії
          </TH>
        </THead>
        <TBody>
          {sorted.length === 0 ? (
            <TableEmpty colSpan={6} title="Користувачів не знайдено" />
          ) : (
            sorted.map((user) => {
              const isSelected = selection.isSelected(user.id);
              return (
                <TR
                  key={user.id}
                  className={cn(
                    isSelected && "bg-[var(--color-tint-slate)] hover:bg-[var(--color-tint-slate)]",
                  )}
                >
                  <TD align="center">
                    {user.isSelf ? (
                      <span className="inline-block h-3.5 w-3.5" />
                    ) : (
                      <RowCheckbox
                        checked={isSelected}
                        onChange={() => selection.toggleOne(user.id)}
                        label={`Обрати ${user.name}`}
                      />
                    )}
                  </TD>
                  <TD>
                    <CellStack
                      title={
                        <span className="inline-flex items-center gap-2">
                          {user.name}
                          {user.isSelf ? (
                            <span className="type-caption rounded-full bg-[var(--color-surface-subtle)] px-1.5 py-px">
                              це ви
                            </span>
                          ) : null}
                        </span>
                      }
                      subtitle={user.email}
                      maxWidth="320px"
                    />
                  </TD>
                  <TD nowrap className="text-[var(--color-text-secondary)]">
                    {roleLabels[user.role] ?? user.role}
                  </TD>
                  <TD nowrap>
                    <StatusBadge dot tone={user.isActive ? "success" : "neutral"}>
                      {user.isActive ? "Активний" : "Вимкнено"}
                    </StatusBadge>
                  </TD>
                  <TD numeric className="text-[var(--color-text-secondary)]">
                    {formatDateUk(user.createdAt)}
                  </TD>
                  <TD align="right" nowrap>
                    <UserAccessPanel user={user} canManage={canManage} />
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
