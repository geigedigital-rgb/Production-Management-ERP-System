"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { IconClients, IconOrders, IconProducts, IconSearch } from "@/components/ui/Icons";
import { SearchDropdownSkeleton } from "@/components/ui/Skeleton";
import { globalSearchAction, type SearchGroup } from "@/server/domains/search/actions";

const groupIcon = {
  orders: IconOrders,
  clients: IconClients,
  products: IconProducts,
} as const;

function SearchKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-px text-[10.5px] font-medium">
      {children}
    </kbd>
  );
}

export function GlobalSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  /** Query the current `groups` belong to, so stale results are never read as "nothing found". */
  const [resultQuery, setResultQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [, startTransition] = useTransition();

  const stale = query.trim() !== resultQuery;
  const flat = stale ? [] : groups.flatMap((group) => group.items);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function onChange(value: string) {
    setQuery(value);
    setActiveIndex(0);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setGroups([]);
      setResultQuery("");
      setOpen(false);
      return;
    }
    setOpen(true);
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const result = await globalSearchAction(value);
        setGroups(result);
        setResultQuery(value.trim());
      });
    }, 220);
  }

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setGroups([]);
    setResultQuery("");
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || flat.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % flat.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + flat.length) % flat.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = flat[activeIndex];
      if (target) go(target.href);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative max-w-md flex-1">
      <IconSearch
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
      />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => groups.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        type="search"
        placeholder="Пошук: замовлення, клієнт, виріб…"
        aria-label="Глобальний пошук"
        className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-14 text-[13.5px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-focus-ring)]"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-text-tertiary)] md:block">
        ⌘K
      </kbd>

      {open ? (
        <div className="anim-modal absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-float)]">
          {stale ? (
            <SearchDropdownSkeleton />
          ) : groups.length === 0 ? (
            <p className="px-3 py-4 text-[13px] text-[var(--color-text-tertiary)]">
              Нічого не знайдено за запитом «{query}»
            </p>
          ) : (
            <>
              <div className="max-h-[380px] overflow-y-auto py-1">
              {groups.map((group) => {
                const Icon = groupIcon[group.key];
                return (
                  <div key={group.key}>
                    <div className="type-group-label px-3 pb-1 pt-2">{group.label}</div>
                    {group.items.map((item) => {
                      const isActive = flat.indexOf(item) === activeIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setActiveIndex(flat.indexOf(item))}
                          onClick={() => go(item.href)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                            isActive ? "bg-[var(--color-tint-sage)]" : "hover:bg-[var(--color-surface-hover)]",
                          )}
                        >
                          <Icon size={16} className="text-[var(--color-text-tertiary)]" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium text-[var(--color-text-primary)]">
                              {item.title}
                            </span>
                            {item.subtitle ? (
                              <span className="type-caption block truncate">{item.subtitle}</span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              </div>
              <div className="type-caption flex items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-1.5">
                <span>
                  <SearchKey>↑</SearchKey> <SearchKey>↓</SearchKey> навігація
                </span>
                <span>
                  <SearchKey>Enter</SearchKey> відкрити
                </span>
                <span>
                  <SearchKey>Esc</SearchKey> закрити
                </span>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
