"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconChevronDown } from "@/components/ui/Icons";
import { TH } from "@/components/ui/Table";

export type SortDirection = "asc" | "desc";

export type SortState<K extends string = string> = {
  key: K;
  direction: SortDirection;
} | null;

export function useTableSort<K extends string>(initial: SortState<K> = null) {
  const [sort, setSort] = useState<SortState<K>>(initial);

  function toggle(key: K) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key, direction: "asc" };
    });
  }

  return { sort, toggle, setSort };
}

export function compareValues(a: unknown, b: unknown, direction: SortDirection): number {
  const mul = direction === "asc" ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1 * mul;
  if (b == null) return -1 * mul;

  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * mul;
  }

  const aTime = a instanceof Date ? a.getTime() : typeof a === "string" && !Number.isNaN(Date.parse(a)) && /^\d{4}-\d{2}/.test(a) ? Date.parse(a) : null;
  const bTime = b instanceof Date ? b.getTime() : typeof b === "string" && !Number.isNaN(Date.parse(b)) && /^\d{4}-\d{2}/.test(b) ? Date.parse(b) : null;
  if (aTime != null && bTime != null && !Number.isNaN(aTime) && !Number.isNaN(bTime)) {
    return (aTime - bTime) * mul;
  }

  return String(a).localeCompare(String(b), "uk", { numeric: true, sensitivity: "base" }) * mul;
}

export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  accessors: Record<K, (row: T) => unknown>,
  secondary?: { key: K; direction?: SortDirection },
): T[] {
  if (!sort) return rows;
  const accessor = accessors[sort.key];
  if (!accessor) return rows;
  const secondaryAccessor = secondary ? accessors[secondary.key] : null;
  return [...rows].sort((left, right) => {
    const primary = compareValues(accessor(left), accessor(right), sort.direction);
    if (primary !== 0 || !secondary || !secondaryAccessor) return primary;
    return compareValues(
      secondaryAccessor(left),
      secondaryAccessor(right),
      secondary.direction ?? "asc",
    );
  });
}

export function useRowSelection(ids: string[]) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const selectedIds = useMemo(
    () => ids.filter((id) => selected[id]),
    [ids, selected],
  );
  const allSelected = ids.length > 0 && selectedIds.length === ids.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) {
      setSelected({});
      return;
    }
    setSelected(Object.fromEntries(ids.map((id) => [id, true])));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }

  function clear() {
    setSelected({});
  }

  function isSelected(id: string) {
    return Boolean(selected[id]);
  }

  return {
    selectedIds,
    allSelected,
    someSelected,
    toggleAll,
    toggleOne,
    clear,
    isSelected,
  };
}

export function SortableTH<K extends string>({
  columnKey,
  sort,
  onSort,
  children,
  align = "left",
  width,
  stickyRight,
  className,
  title,
}: {
  columnKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  children: ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  stickyRight?: boolean;
  className?: string;
  title?: string;
}) {
  const active = sort?.key === columnKey;
  const direction = active ? sort.direction : null;

  return (
    <TH align={align} width={width} stickyRight={stickyRight} className={className} title={title}>
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        title={title}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-[4px] transition-colors hover:text-[var(--color-text-primary)]",
          align === "right" && "ml-auto flex-row-reverse",
          align === "center" && "mx-auto",
          active ? "text-[var(--color-text-primary)]" : "text-inherit",
        )}
      >
        <span className="truncate">{children}</span>
        <IconChevronDown
          size={12}
          className={cn(
            "shrink-0 opacity-40 transition-transform",
            active && "opacity-100",
            direction === "asc" && "rotate-180",
          )}
        />
      </button>
    </TH>
  );
}

export function RowCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(node) => {
        if (node) node.indeterminate = Boolean(indeterminate);
      }}
      onChange={onChange}
      className="h-3.5 w-3.5 accent-[var(--color-text-primary)]"
    />
  );
}

export function SelectionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children?: ReactNode;
}) {
  if (count <= 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-tint-slate)] px-3.5 py-2">
      <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
        Обрано {count}
      </span>
      <button
        type="button"
        className="text-[12.5px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        onClick={onClear}
      >
        Скинути
      </button>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
