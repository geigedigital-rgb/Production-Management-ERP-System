import Link from "next/link";
import { cn } from "@/lib/utils";

export type TabItem = {
  key: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
  count?: number;
  disabled?: boolean;
};

/** Segmented pill tabs (ref3): used for switching context inside one object. */
export function SegmentedTabs({
  items,
  active,
  className,
}: {
  items: TabItem[];
  active: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-1",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.key === active;
        const content = (
          <>
            {item.icon}
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span
                className={cn(
                  "tabular rounded-full px-1.5 text-[11px] font-semibold",
                  isActive
                    ? "bg-[var(--color-tint-sage)] text-[var(--color-primary-800)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text-tertiary)]",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </>
        );

        const classes = cn(
          "inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition-colors",
          isActive
            ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[0_1px_2px_rgba(18,31,24,0.08)]"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
          item.disabled && "cursor-not-allowed opacity-45",
        );

        if (item.disabled) {
          return (
            <span key={item.key} className={classes} aria-disabled>
              {content}
            </span>
          );
        }

        return (
          <Link key={item.key} href={item.href} className={classes} aria-current={isActive ? "page" : undefined}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}

/** Underlined sub-navigation for list views (ref1). */
export function ViewTabs({
  items,
  active,
  className,
}: {
  items: TabItem[];
  active: string;
  className?: string;
}) {
  return (
    <nav className={cn("flex flex-wrap items-center gap-4 border-b border-[var(--color-border)]", className)}>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-0.5 pb-2 text-[13.5px] font-semibold transition-colors",
              isActive
                ? "border-[var(--color-primary-600)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
            )}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span className="tabular text-[11.5px] font-semibold text-[var(--color-text-tertiary)]">
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
