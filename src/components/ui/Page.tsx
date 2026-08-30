import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: string;
  description?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1 basis-[280px]">
        <h1 className="type-page-title">{title}</h1>
        {description ? <p className="type-body-secondary mt-1 max-w-2xl">{description}</p> : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            {title ? <h2 className="type-section-title">{title}</h2> : null}
            {description ? <p className="type-body-secondary mt-0.5">{description}</p> : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  size = "md",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const pad = size === "lg" ? "py-16" : size === "sm" ? "py-8" : "py-12";
  const ring = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-11 w-11" : "h-14 w-14";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 text-center",
        pad,
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-[var(--color-tint-sage)] text-[var(--color-primary-700)]",
            ring,
          )}
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">
          {title}
        </p>
        {description ? (
          <p className="type-body-secondary mx-auto max-w-sm text-[13px] leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  dot,
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "success" | "danger" | "warning" | "info";
  dot?: boolean;
  /** Native hover tooltip */
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-badge)] border px-2 py-0.5 text-[11.5px] font-medium",
        title && "cursor-help",
        tone === "neutral" &&
          "border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]",
        tone === "accent" &&
          "border-transparent bg-[var(--color-tint-sky)] text-[var(--color-info-text)]",
        tone === "success" &&
          "border-transparent bg-[var(--color-success-bg)] text-[var(--color-success-text)]",
        tone === "danger" &&
          "border-transparent bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]",
        tone === "warning" &&
          "border-transparent bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]",
        tone === "info" &&
          "border-transparent bg-[var(--color-info-bg)] text-[var(--color-info-text)]",
      )}
    >
      {dot ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-55" /> : null}
      {children}
    </span>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-[var(--color-divider)]", className)} />;
}
