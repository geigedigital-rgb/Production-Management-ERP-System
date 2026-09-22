"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SoftBusy } from "@/components/ui/SoftBusy";
import { cn } from "@/lib/utils";

export type ContactField = {
  key: string;
  label: string;
  value: string;
  kind?: "text" | "tel" | "email" | "textarea" | "number";
  placeholder?: string;
  required?: boolean;
  wide?: boolean;
};

/**
 * Compact editable contact card — white lift on canvas, tinted header,
 * field wells for contrast (not a flat fill).
 */
export function ContactCard({
  title,
  badge,
  meta,
  fields,
  href,
  disabled,
  onSave,
}: {
  title: string;
  badge?: React.ReactNode;
  meta?: React.ReactNode;
  fields: ContactField[];
  href?: string;
  disabled?: boolean;
  onSave: (values: Record<string, string>) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
  );
  const [error, setError] = useState<string | null>(null);

  const fieldSignature = fields.map((f) => `${f.key}=${f.value}`).join("\n");

  useEffect(() => {
    setDraft(Object.fromEntries(fields.map((f) => [f.key, f.value])));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldSignature]);

  const dirty = fields.some((f) => (draft[f.key] ?? "") !== (f.value ?? ""));

  function save() {
    if (disabled || !dirty) return;
    setError(null);
    startTransition(async () => {
      const result = await onSave(draft);
      if (!result.ok) {
        setError(result.error === "VALIDATION" ? "Перевірте поля." : "Не вдалося зберегти.");
        return;
      }
      router.refresh();
    });
  }

  function reset() {
    setDraft(Object.fromEntries(fields.map((f) => [f.key, f.value])));
    setError(null);
  }

  const inputClass = cn(
    "h-7 w-full rounded-[6px] border border-transparent bg-[var(--color-surface-subtle)] px-2",
    "text-[12.5px] leading-none text-[var(--color-text-primary)] outline-none transition-colors",
    "placeholder:text-[var(--color-text-quiet)]",
    "hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]",
    "focus:border-[var(--color-primary-500)] focus:bg-[var(--color-surface)] focus:shadow-[0_0_0_3px_var(--color-focus-ring)]",
    "disabled:opacity-55",
  );

  return (
    <SoftBusy busy={pending} className="min-w-0">
      <article
        className={cn(
          "relative overflow-hidden rounded-[var(--radius-surface)] border bg-[var(--color-surface)] shadow-[var(--shadow-card)]",
          dirty
            ? "border-[var(--color-primary-300)]"
            : "border-[var(--color-border-strong)]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 w-[3px]",
            dirty ? "bg-[var(--color-primary-500)]" : "bg-[var(--color-primary-300)]",
          )}
        />

        <header
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b py-1.5 pl-3.5 pr-2.5",
            dirty
              ? "border-[var(--color-primary-100)] bg-[var(--color-tint-sage)]"
              : "border-[var(--color-border)] bg-[var(--color-surface-tint)]",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {href ? (
              <Link
                href={href}
                className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)] hover:text-[var(--color-primary-700)]"
              >
                {title}
              </Link>
            ) : (
              <h3 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">
                {title}
              </h3>
            )}
            {meta != null && meta !== "" ? (
              <span className="shrink-0 rounded-[var(--radius-badge)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10.5px] font-medium tabular text-[var(--color-text-secondary)] shadow-[inset_0_0_0_1px_var(--color-border)]">
                {meta}
              </span>
            ) : null}
          </div>
          {badge}
        </header>

        <div className="grid gap-x-2 gap-y-1.5 px-2.5 py-2 pl-3.5 sm:grid-cols-2">
          {fields.map((field) => (
            <label
              key={field.key}
              className={cn("block min-w-0", field.wide && "sm:col-span-2")}
            >
              <span className="mb-0.5 block text-[11px] font-medium text-[var(--color-text-tertiary)]">
                {field.label}
                {field.required ? (
                  <span className="text-[var(--color-primary-500)]"> *</span>
                ) : null}
              </span>
              {field.kind === "textarea" ? (
                <textarea
                  rows={2}
                  disabled={disabled || pending}
                  className={cn(inputClass, "h-auto min-h-[2.25rem] resize-y py-1.5 leading-snug")}
                  value={draft[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))
                  }
                />
              ) : (
                <input
                  type={field.kind === "number" ? "number" : field.kind ?? "text"}
                  disabled={disabled || pending}
                  className={inputClass}
                  value={draft[field.key] ?? ""}
                  placeholder={field.placeholder}
                  required={field.required}
                  step={field.kind === "number" ? "any" : undefined}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))
                  }
                />
              )}
            </label>
          ))}
        </div>

        {(error || dirty) && !disabled ? (
          <footer className="flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2.5 py-1.5 pl-3.5">
            {error ? (
              <span className="type-caption text-[var(--color-danger-text)]">{error}</span>
            ) : (
              <span className="type-caption text-[var(--color-primary-700)]">Є зміни</span>
            )}
            <div className="ml-auto flex gap-1">
              {dirty ? (
                <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={reset}>
                  Скасувати
                </Button>
              ) : null}
              <Button type="button" size="sm" disabled={pending || !dirty || disabled} onClick={save}>
                {pending ? "…" : "Зберегти"}
              </Button>
            </div>
          </footer>
        ) : null}
      </article>
    </SoftBusy>
  );
}

export function ContactCardsGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{children}</div>
  );
}
