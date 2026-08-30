import Link from "next/link";
import { cn } from "@/lib/utils";
import { IconChevronRight } from "@/components/ui/Icons";
import { Hint } from "@/components/ui/Hint";
import type { UiHint, UiHintKey } from "@/lib/ui-hints";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav className={cn("flex flex-wrap items-center gap-1 text-[12.5px]", className)} aria-label="Навігація">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-primary-700)]"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-[var(--color-text-secondary)]" : "text-[var(--color-text-tertiary)]"}>
                {item.label}
              </span>
            )}
            {!isLast ? <IconChevronRight size={13} className="text-[var(--color-border-strong)]" /> : null}
          </span>
        );
      })}
    </nav>
  );
}

/**
 * Contextual action row under the object title (ref4 "Quick actions").
 * Keeps destructive/secondary operations out of the primary CTA area.
 */
export function QuickActions({
  children,
  className,
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {children}
    </div>
  );
}

export function QuickAction({
  icon,
  children,
  href,
  onClick,
  disabled,
  tone = "neutral",
  type = "button",
  hint,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
  type?: "button" | "submit";
  /** Prefer a key from `ui-hints.ts` so copy stays maintainable. */
  hint?: UiHintKey | UiHint;
}) {
  const classes = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2.5 text-[13px] font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-hover)]",
    tone === "danger" && "text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)]",
    disabled && "pointer-events-none opacity-45",
  );

  const control = href ? (
    <Link href={href} className={classes} tabIndex={disabled ? -1 : undefined} aria-disabled={disabled}>
      {icon}
      {children}
    </Link>
  ) : (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {icon}
      {children}
    </button>
  );

  if (!hint) return control;
  return (
    <Hint hint={hint} showTitle={false}>
      {control}
    </Hint>
  );
}

/** Header block used inside the object summary strip (ref3). */
export function HeaderBlock({
  title,
  icon,
  action,
  children,
  className,
}: {
  title?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            {icon}
            {title ? <h2 className="type-subsection">{title}</h2> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
