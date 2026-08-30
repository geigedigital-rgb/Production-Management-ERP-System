"use client";

import { useSidebar } from "@/components/layout/SidebarContext";
import { IconChevronRight } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

/** Compact control in the topbar to reopen the rail when collapsed. */
export function SidebarExpandButton() {
  const { collapsed, overlayOpen, setPreferredCollapsed } = useSidebar();

  if (!collapsed) return null;

  return (
    <button
      type="button"
      onClick={() => setPreferredCollapsed(false)}
      disabled={overlayOpen}
      title={overlayOpen ? "Меню згорнуто, поки відкрита панель" : "Розгорнути меню"}
      aria-label="Розгорнути меню"
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]",
        overlayOpen && "cursor-default opacity-50",
      )}
    >
      <IconChevronRight size={16} />
    </button>
  );
}
