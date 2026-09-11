"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconGrid, IconRows } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

export type ProductsViewMode = "table" | "cards";

/**
 * Labeled view switch: «Таблиця» / «Картки» — always with text, not icon-only.
 */
export function ProductsViewToggle({ value }: { value: ProductsViewMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setView = useCallback(
    (next: ProductsViewMode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "table") params.delete("view");
      else params.set("view", "cards");
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <span className="text-[12.5px] font-medium text-[var(--color-text-secondary)]">
        Вигляд:
      </span>
      <div
        role="group"
        aria-label="Вигляд каталогу"
        className={cn(
          "inline-flex items-center gap-1 rounded-[10px] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] p-1",
          pending && "opacity-80",
        )}
      >
        <button
          type="button"
          aria-pressed={value === "table"}
          onClick={() => setView("table")}
          className={cn(
            "inline-flex h-9 min-w-[7.5rem] items-center justify-center gap-2 rounded-[8px] px-3.5 text-[13.5px] font-semibold transition-colors",
            value === "table"
              ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--color-border)]"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]/80 hover:text-[var(--color-text-primary)]",
          )}
        >
          <IconRows
            size={16}
            className={
              value === "table"
                ? "text-[var(--color-primary-700)]"
                : "text-[var(--color-text-quiet)]"
            }
          />
          Таблиця
        </button>
        <button
          type="button"
          aria-pressed={value === "cards"}
          onClick={() => setView("cards")}
          className={cn(
            "inline-flex h-9 min-w-[7.5rem] items-center justify-center gap-2 rounded-[8px] px-3.5 text-[13.5px] font-semibold transition-colors",
            value === "cards"
              ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--color-border)]"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]/80 hover:text-[var(--color-text-primary)]",
          )}
        >
          <IconGrid
            size={16}
            className={
              value === "cards"
                ? "text-[var(--color-primary-700)]"
                : "text-[var(--color-text-quiet)]"
            }
          />
          Картки
        </button>
      </div>
    </div>
  );
}
