import { cn } from "@/lib/utils";
import { controlClass, FieldShell } from "@/components/ui/Field";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  /** Extra classes for the input element itself; `className` lays out the field in a grid. */
  inputClassName?: string;
};

export function Input({
  className,
  inputClassName,
  label,
  error,
  hint,
  required,
  id,
  readOnly,
  ...props
}: InputProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={className}>
      <input
        id={id ?? props.name}
        required={required}
        readOnly={readOnly}
        className={cn(
          controlClass,
          error && "border-[var(--color-danger-text)] focus:ring-[var(--color-danger-text)]",
          readOnly &&
            "cursor-default border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] focus:border-[var(--color-border)] focus:ring-0",
          inputClassName,
        )}
        {...props}
      />
    </FieldShell>
  );
}
