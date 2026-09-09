"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronDown } from "@/components/ui/Icons";
import { swatchForColorLabel, type SpecSwatch } from "@/lib/trim-colors";
import { cn } from "@/lib/utils";

function ColorDot({
  swatch,
  size = "md",
}: {
  swatch: SpecSwatch;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full ring-1 ring-black/12",
        size === "sm" ? "size-3.5" : "size-4",
        swatch.bordered && "border border-[var(--color-border-strong)]",
      )}
      style={{ backgroundColor: swatch.swatch }}
      aria-hidden
    />
  );
}

/**
 * Compact branded color dropdown: swatch + label in trigger and list.
 */
export function ColorSelect({
  value,
  options,
  onChange,
  disabled,
  placeholder = "Колір…",
  className,
  "aria-label": ariaLabel = "Колір",
}: {
  value: string | null | undefined;
  options: string[];
  onChange: (next: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const selected = value?.trim() || "";
  const selectedSwatch = selected ? swatchForColorLabel(selected) : null;

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const update = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const gutter = 8;
      const maxH = 280;
      const spaceBelow = window.innerHeight - rect.bottom - gutter;
      const spaceAbove = rect.top - gutter;
      const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
      const available = openUp ? spaceAbove : spaceBelow;
      setMenuStyle({
        position: "fixed",
        left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 200) - gutter),
        width: Math.min(Math.max(rect.width, 200), window.innerWidth - gutter * 2),
        zIndex: 230,
        maxHeight: Math.min(maxH, Math.max(available, 120)),
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: string | null) {
    onChange(next);
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={selected || placeholder}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={cn(
          "inline-flex h-7 w-full min-w-[7.5rem] max-w-[11rem] items-center gap-1.5 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 text-left text-[12px] outline-none transition-colors",
          "hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary-500)] focus:ring-1 focus:ring-[var(--color-primary-100)]",
          open && "border-[var(--color-primary-500)] ring-1 ring-[var(--color-primary-100)]",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {selectedSwatch ? (
          <ColorDot swatch={selectedSwatch} size="sm" />
        ) : (
          <span
            className="size-3.5 shrink-0 rounded-full border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)]"
            aria-hidden
          />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            selected
              ? "font-medium text-[var(--color-text-primary)]"
              : "text-[var(--color-text-tertiary)]",
          )}
        >
          {selected || placeholder}
        </span>
        <IconChevronDown
          size={14}
          className={cn(
            "shrink-0 text-[var(--color-text-tertiary)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open
        ? createPortal(
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              style={menuStyle}
              className="overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]"
            >
              <div className="border-b border-[var(--color-divider)] bg-[var(--color-tint-slate)] px-2.5 py-1.5">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.04em] text-[var(--color-text-quiet)]">
                  Палітра матеріалу
                </p>
              </div>
              <div className="max-h-[inherit] overflow-y-auto py-1">
                <button
                  type="button"
                  role="option"
                  aria-selected={!selected}
                  onClick={() => pick(null)}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] transition-colors",
                    !selected
                      ? "bg-[var(--color-tint-sage)] text-[var(--color-primary-800)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]",
                  )}
                >
                  <span className="size-4 shrink-0 rounded-full border border-dashed border-[var(--color-border-strong)]" />
                  <span className="flex-1">{placeholder}</span>
                </button>
                {options.map((label) => {
                  const swatch = swatchForColorLabel(label);
                  const active = selected.toLowerCase() === label.toLowerCase();
                  return (
                    <button
                      key={label}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pick(label)}
                      className={cn(
                        "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] transition-colors",
                        active
                          ? "bg-[var(--color-tint-sage)] text-[var(--color-primary-800)]"
                          : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]",
                      )}
                    >
                      <ColorDot swatch={swatch} />
                      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
                      {active ? (
                        <IconCheck size={14} className="shrink-0 text-[var(--color-primary-700)]" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
