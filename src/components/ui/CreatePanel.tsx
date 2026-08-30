"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { SidePanel } from "@/components/ui/Overlay";
import { IconCheckCircle, IconPlus } from "@/components/ui/Icons";
import type { UiHint, UiHintKey } from "@/lib/ui-hints";

type ActionResult = {
  ok: boolean;
  error?: string;
  hasDuplicates?: boolean;
} & Record<string, unknown>;

type Props = {
  title: string;
  description?: string;
  triggerLabel: string;
  submitLabel?: string;
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  onCreated?: (result: ActionResult) => void;
  width?: "md" | "lg" | "xl" | "2xl";
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  disabledHint?: string;
  hint?: UiHintKey | UiHint;
  /** Open the panel immediately — used when this is the next corridor door. */
  defaultOpen?: boolean;
  /** Replace default + button (e.g. pencil icon for edit). */
  trigger?: React.ReactNode;
  showPlusIcon?: boolean;
};

/**
 * Inline create/edit flow: add or change a catalog record without leaving the screen.
 * Opens a side panel, submits a server action, then refreshes surrounding data.
 */
export function CreatePanel({
  title,
  description,
  triggerLabel,
  submitLabel = "Зберегти",
  action,
  children,
  onCreated,
  width = "md",
  variant = "primary",
  size = "md",
  disabled,
  disabledHint,
  hint,
  defaultOpen = false,
  trigger,
  showPlusIcon = true,
}: Props) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "warning"; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError("Перевірте обовʼязкові поля — запис не збережено.");
        return;
      }
      setOpen(false);
      setToast(
        result.hasDuplicates
          ? { tone: "warning", text: "Збережено. У каталозі є схожі записи — перевірте дублікати." }
          : { tone: "success", text: `${title}: запис збережено.` },
      );
      onCreated?.(result);
      router.refresh();
    });
  }

  return (
    <>
      {trigger ? (
        <span
          role="button"
          tabIndex={disabled ? -1 : 0}
          className={disabled ? "pointer-events-none opacity-40" : "inline-flex"}
          title={disabled ? disabledHint : triggerLabel}
          onClick={() => !disabled && setOpen(true)}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          {trigger}
        </span>
      ) : (
        <Button
          variant={variant}
          size={size}
          onClick={() => setOpen(true)}
          disabled={disabled}
          title={disabled ? disabledHint : undefined}
          hint={disabled ? undefined : hint}
        >
          {showPlusIcon ? <IconPlus size={16} /> : null}
          {triggerLabel}
        </Button>
      )}

      <SidePanel
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        title={title}
        description={description}
        width={width}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Скасувати
            </Button>
            <Button type="submit" form={formId} loading={pending} disabled={pending}>
              {pending ? "Збереження…" : submitLabel}
            </Button>
          </>
        }
      >
        <form key={open ? "open" : "closed"} id={formId} action={submit} className="space-y-4">
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {children}
        </form>
      </SidePanel>

      {toast ? <Toast tone={toast.tone} text={toast.text} /> : null}
    </>
  );
}

function Toast({ tone, text }: { tone: "success" | "warning"; text: string }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="anim-modal fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[13px] shadow-[var(--shadow-panel)]">
      <IconCheckCircle
        size={16}
        className={
          tone === "success"
            ? "mt-0.5 text-[var(--color-success-text)]"
            : "mt-0.5 text-[var(--color-warning-text)]"
        }
      />
      <span className="text-[var(--color-text-primary)]">{text}</span>
    </div>,
    document.body,
  );
}
