import { cn } from "@/lib/utils";

type ModulePlaceholderProps = {
  children?: React.ReactNode;
  className?: string;
  /** Short name of the future module */
  title: string;
  /** What the user will get when it ships — always shown in full */
  description: string;
  label?: string;
  /**
   * `panel` — full block with blurred preview behind (min height).
   * `notice` — compact in-flow card, no blur (for toolbars / list rows).
   */
  variant?: "panel" | "notice";
};

/**
 * Placeholder for unfinished modules.
 * Descriptions always render in the document flow (or a fixed overlay card tall
 * enough to fit) so they are never clipped by a tiny parent.
 */
export function ModulePlaceholder({
  children,
  className,
  title,
  description,
  label = "Модуль ще не готовий",
  variant = "panel",
}: ModulePlaceholderProps) {
  if (variant === "notice") {
    return (
      <div
        className={cn(
          "rounded-[var(--radius-control)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-3.5 py-3",
          className,
        )}
      >
        <p className="text-[10.5px] font-medium tracking-[0.06em] text-[var(--color-text-quiet)] uppercase">
          {label}
        </p>
        <p className="mt-1 text-[13.5px] font-semibold leading-snug text-[var(--color-text-primary)]">
          {title}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
          {description}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex min-h-[220px] flex-col overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children ? (
        <div
          className="pointer-events-none absolute inset-0 select-none overflow-hidden opacity-40 blur-[4px]"
          aria-hidden
        >
          {children}
        </div>
      ) : null}

      <div className="relative z-[1] flex flex-1 items-center justify-center p-5">
        <div className="w-full max-w-[360px] rounded-[var(--radius-surface)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3.5 text-center shadow-[var(--shadow-float)]">
          <p className="text-[10.5px] font-medium tracking-[0.06em] text-[var(--color-text-quiet)] uppercase">
            {label}
          </p>
          <p className="mt-1.5 text-[14px] font-semibold leading-snug text-[var(--color-text-primary)]">
            {title}
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
