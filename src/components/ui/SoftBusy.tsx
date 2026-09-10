import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/Skeleton";

/**
 * Soft busy overlay for a block (table footer bar, calculator, panel).
 * Keeps layout stable — light dim + tiny spinner chip.
 */
export function SoftBusy({
  busy,
  children,
  className,
  label = "Збереження…",
  tone = "block",
}: {
  busy: boolean;
  children: React.ReactNode;
  className?: string;
  label?: string;
  /** `block` = overlay chip; `inline` = opacity only (for tight controls). */
  tone?: "block" | "inline";
}) {
  return (
    <div
      className={cn(
        "relative transition-[opacity,filter] duration-200 ease-out",
        busy && tone === "inline" && "pointer-events-none opacity-55",
        className,
      )}
      aria-busy={busy || undefined}
    >
      <div
        className={cn(
          "transition-opacity duration-200",
          busy && tone === "block" && "pointer-events-none opacity-50",
        )}
      >
        {children}
      </div>
      {busy && tone === "block" ? (
        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center rounded-[inherit]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-2.5 py-1 text-[11.5px] text-[var(--color-text-secondary)] shadow-[var(--shadow-soft)] backdrop-blur-[2px]">
            <Spinner size="sm" />
            {label}
          </span>
        </div>
      ) : null}
      {busy && tone === "inline" ? (
        <span className="pointer-events-none absolute right-1 top-1/2 z-[2] -translate-y-1/2">
          <Spinner size="sm" className="text-[var(--color-text-quiet)]" />
        </span>
      ) : null}
    </div>
  );
}

/** Soft highlight for a table row while its action is in flight. */
export function busyRowClass(busy: boolean): string | undefined {
  if (!busy) return undefined;
  return "bg-[color-mix(in_srgb,var(--color-primary-50)_55%,transparent)] opacity-75 transition-[opacity,background-color] duration-200";
}

/** Tiny spinner next to a row title. */
export function RowBusyMark({ busy }: { busy: boolean }) {
  if (!busy) return null;
  return (
    <Spinner
      size="sm"
      className="ml-1.5 inline-block align-middle text-[var(--color-text-quiet)]"
    />
  );
}
