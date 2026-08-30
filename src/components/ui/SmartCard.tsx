import { cn } from "@/lib/utils";

/**
 * Dense operational card: title, meta, optional status, actions.
 * No nested card-in-card — border only when it frames an interaction.
 */
export function SmartCard({
  title,
  subtitle,
  meta,
  status,
  actions,
  children,
  className,
  muted,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]",
        muted && "border-dashed bg-[var(--color-surface-subtle)] shadow-none",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="type-subsection truncate">{title}</h3>
            {status}
          </div>
          {subtitle ? <p className="type-caption mt-0.5">{subtitle}</p> : null}
          {meta ? <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? (
        <div className="border-t border-[var(--color-divider)] px-4 py-3">{children}</div>
      ) : null}
    </div>
  );
}

export function SmartCardMeta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="type-caption">
      <span className="text-[var(--color-text-tertiary)]">{label}: </span>
      <span className="text-[var(--color-text-secondary)]">{value}</span>
    </span>
  );
}
