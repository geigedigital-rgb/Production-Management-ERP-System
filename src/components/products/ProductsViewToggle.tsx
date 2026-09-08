"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconGrid, IconRows } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

export type ProductsViewMode = "table" | "cards";

export function ProductsViewToggle({
  value,
}: {
  value: ProductsViewMode;
}) {
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
    <div
      role="group"
      aria-label="Вигляд каталогу"
      className={cn(
        "inline-flex h-8 items-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-0.5",
        pending && "opacity-80",
      )}
    >
      <button
        type="button"
        aria-pressed={value === "table"}
        title="Таблиця"
        onClick={() => setView("table")}
        className={cn(
          "inline-flex h-7 w-8 items-center justify-center rounded-[5px] transition-colors",
          value === "table"
            ? "bg-[var(--color-tint-slate)] text-[var(--color-text-primary)] shadow-sm"
            : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]",
        )}
      >
        <IconRows size={15} />
      </button>
      <button
        type="button"
        aria-pressed={value === "cards"}
        title="Картки"
        onClick={() => setView("cards")}
        className={cn(
          "inline-flex h-7 w-8 items-center justify-center rounded-[5px] transition-colors",
          value === "cards"
            ? "bg-[var(--color-tint-slate)] text-[var(--color-text-primary)] shadow-sm"
            : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]",
        )}
      >
        <IconGrid size={15} />
      </button>
    </div>
  );
}
