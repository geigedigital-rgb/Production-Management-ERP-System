import { cn } from "@/lib/utils";

export type DescriptionItem = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Stacks label above value — for addresses and notes that would wrap raggedly when right-aligned. */
  multiline?: boolean;
};

/** Label / value rows with dividers (ref4 contact information pattern). */
export function DescriptionList({
  items,
  columns = 1,
  className,
}: {
  items: DescriptionItem[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl className={cn(columns === 2 ? "grid gap-x-8 sm:grid-cols-2" : "block", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "border-b border-[var(--color-divider)] py-2 last:border-0",
            item.multiline ? "block" : "flex items-baseline justify-between gap-4",
          )}
        >
          <dt className="shrink-0 text-[13px] text-[var(--color-text-secondary)]">{item.label}</dt>
          <dd
            className={cn(
              "min-w-0 text-[13.5px] font-medium text-[var(--color-text-primary)]",
              item.multiline ? "mt-0.5 leading-relaxed" : "text-right",
            )}
          >
            {item.value}
            {item.hint ? <span className="type-caption block font-normal">{item.hint}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Compact metric block used in object headers (ref3 price panel). */
export function Stat({
  label,
  value,
  delta,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="type-caption leading-tight">{label}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
        <span
          className={cn(
            "tabular whitespace-nowrap text-[18px] font-semibold leading-tight",
            tone === "accent" && "text-[var(--color-primary-700)]",
            tone === "success" && "text-[var(--color-success-text)]",
            tone === "warning" && "text-[var(--color-warning-text)]",
            tone === "danger" && "text-[var(--color-danger-text)]",
          )}
        >
          {value}
        </span>
        {delta ? (
          <span
            className={cn(
              "tabular rounded-[var(--radius-badge)] px-1.5 py-0.5 text-[11.5px] font-semibold",
              tone === "danger"
                ? "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]"
                : tone === "warning"
                  ? "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]"
                  : "bg-[var(--color-success-bg)] text-[var(--color-success-text)]",
            )}
          >
            {delta}
          </span>
        ) : null}
      </p>
      {hint ? <p className="type-caption mt-0.5 leading-tight">{hint}</p> : null}
    </div>
  );
}
