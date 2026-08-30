import { cn } from "@/lib/utils";
import { IconAlert, IconCheckCircle, IconInfo } from "@/components/ui/Icons";

const toneStyles = {
  info: {
    wrapper: "border-[var(--color-info-bg)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]",
    Icon: IconInfo,
  },
  success: {
    wrapper: "border-[var(--color-success-bg)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]",
    Icon: IconCheckCircle,
  },
  warning: {
    wrapper: "border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]",
    Icon: IconAlert,
  },
  danger: {
    wrapper: "border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]",
    Icon: IconAlert,
  },
} as const;

export function Banner({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof toneStyles;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const { wrapper, Icon } = toneStyles[tone];

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-[var(--radius-control)] border px-3 py-2.5 text-[13px]",
        wrapper,
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon size={16} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
