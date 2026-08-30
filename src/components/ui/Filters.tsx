"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { IconClose, IconSearch } from "@/components/ui/Icons";
import { Spinner } from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Select";

function useParamWriter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page");
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return { setParam, searchParams, pending };
}

export function SearchField({
  paramKey = "q",
  placeholder = "Пошук",
  className,
}: {
  paramKey?: string;
  placeholder?: string;
  className?: string;
}) {
  const { setParam, searchParams, pending } = useParamWriter();
  const initial = searchParams.get(paramKey) ?? "";
  const [value, setValue] = useState(initial);
  const [syncedInitial, setSyncedInitial] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (syncedInitial !== initial) {
    setSyncedInitial(initial);
    setValue(initial);
  }

  const push = (next: string) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParam(paramKey, next.trim() || null), 300);
  };

  return (
    <div className={cn("relative", className)}>
      {pending ? (
        <Spinner
          size="sm"
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--color-text-tertiary)]"
        />
      ) : (
        <IconSearch
          size={15}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--color-text-tertiary)]"
        />
      )}
      <input
        value={value}
        onChange={(event) => push(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "h-8 w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] pr-8 pl-8 text-[13px] text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-focus-ring)]",
          pending && "opacity-80",
        )}
      />
      {value ? (
        <button
          type="button"
          aria-label="Очистити пошук"
          onClick={() => {
            setValue("");
            setParam(paramKey, null);
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          <IconClose size={14} />
        </button>
      ) : null}
    </div>
  );
}

export type FilterOption = { value: string; label: string; count?: number };

/** Inline chip filter — readable at a glance; soft tint when active (no white-on-green). */
export function FilterChips({
  paramKey,
  options,
  allLabel = "Усі",
}: {
  paramKey: string;
  options: FilterOption[];
  allLabel?: string;
}) {
  const { setParam, searchParams } = useParamWriter();
  const current = searchParams.get(paramKey);

  const visible = options.filter((option) => option.count !== 0 || current === option.value);
  const items: FilterOption[] = [{ value: "", label: allLabel }, ...visible];

  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((option) => {
        const isActive = option.value ? current === option.value : !current;
        return (
          <button
            key={option.value || "__all"}
            type="button"
            onClick={() => setParam(paramKey, option.value || null)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors",
              isActive
                ? "border-[var(--color-primary-200)] bg-[var(--color-tint-sage)] text-[var(--color-primary-800)]"
                : "border-transparent bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]",
            )}
          >
            {option.label}
            {typeof option.count === "number" ? (
              <span
                className={cn(
                  "tabular text-[11px]",
                  isActive ? "text-[var(--color-primary-700)]" : "text-[var(--color-text-tertiary)]",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function FilterSelect({
  paramKey,
  options,
  placeholder,
}: {
  paramKey: string;
  options: FilterOption[];
  placeholder: string;
}) {
  const { setParam, searchParams } = useParamWriter();
  const current = searchParams.get(paramKey) ?? "";

  return (
    <Select
      size="sm"
      value={current}
      onChange={(event) => setParam(paramKey, event.target.value || null)}
      placeholder={placeholder}
      className="w-auto min-w-[160px]"
      selectClassName={
        current
          ? "border-[var(--color-primary-300)] bg-[var(--color-tint-sage)] text-[var(--color-primary-800)]"
          : undefined
      }
      options={[
        { value: "", label: placeholder },
        ...options.map((option) => ({ value: option.value, label: option.label })),
      ]}
    />
  );
}

export function ResetFilters({ keys }: { keys: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = keys.filter((key) => searchParams.get(key));

  if (active.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const params = new URLSearchParams(searchParams.toString());
        keys.forEach((key) => params.delete(key));
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }}
      className="inline-flex h-7 items-center gap-1 rounded-full border border-transparent px-2 text-[12.5px] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]"
    >
      <IconClose size={13} />
      Скинути ({active.length})
    </button>
  );
}
