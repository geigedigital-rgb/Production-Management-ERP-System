"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";

/**
 * Confirm + run a bulk soft-delete (archive / cancel / deactivate) server action.
 */
export function BulkDeleteButton({
  ids,
  action,
  label = "Видалити",
  title,
  description,
  disabled,
  onDone,
}: {
  ids: string[];
  action: (formData: FormData) => Promise<{ ok: boolean; count?: number; error?: string }>;
  label?: string;
  title: string;
  description: string;
  disabled?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    const formData = new FormData();
    ids.forEach((id) => formData.append("ids", id));
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setOpen(false);
        onDone?.();
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="sm"
        disabled={disabled || ids.length === 0}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        title={title}
        description={description}
        width="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Скасувати
            </Button>
            <Button variant="danger" size="sm" onClick={confirm} disabled={pending}>
              {pending ? "Видалення…" : label}
            </Button>
          </>
        }
      >
        <p className="type-body">
          Обрано записів: <span className="font-semibold tabular">{ids.length}</span>
        </p>
      </Modal>
    </>
  );
}

export function OpenSelectedLink({
  href,
  children = "Відкрити",
}: {
  href: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex h-7 items-center rounded-[6px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2.5 text-[12.5px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
    >
      {children}
    </a>
  );
}
