import { cn } from "@/lib/utils";
import { Hint } from "@/components/ui/Hint";
import { Spinner } from "@/components/ui/Skeleton";
import type { UiHint, UiHintKey } from "@/lib/ui-hints";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
  /** Prefer a key from `ui-hints.ts`. */
  hint?: UiHintKey | UiHint;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  hint,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const button = (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] font-[600] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-10 px-3.5 text-[13.5px]",
        size === "sm" && "gap-1 px-2 text-[12px]",
        variant === "primary" &&
          "bg-[var(--color-primary-600)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-700)]",
        variant === "secondary" &&
          "border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]",
        variant === "ghost" &&
          "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]",
        variant === "danger" &&
          "bg-[var(--color-danger-text)] text-[var(--color-on-primary)] hover:bg-[#991b1b]",
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size={size === "sm" ? "sm" : "md"} /> : null}
      {children}
    </button>
  );

  if (!hint) return button;
  return <Hint hint={hint}>{button}</Hint>;
}
