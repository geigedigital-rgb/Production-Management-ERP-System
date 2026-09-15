"use client";

import { useSidebar } from "@/components/layout/SidebarContext";
import { IconChevronRight } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

/** Compact control in the topbar to reopen the rail when collapsed. */
export function SidebarExpandButton() {
  const { collapsed, overlayOpen, setPreferredCollapsed, expandDespiteOverlay } = useSidebar();

  if (!collapsed) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (overlayOpen) expandDespiteOverlay();
        else setPreferredCollapsed(false);
      }}
      title="Розгорнути меню"
      aria-label="Розгорнути меню"
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]",
        overlayOpen ? "px-2.5" : "w-8",
      )}
    >
      <IconChevronRight size={16} />
      {overlayOpen ? <span className="text-[12.5px] font-medium">Меню</span> : null}
    </button>
  );
}
