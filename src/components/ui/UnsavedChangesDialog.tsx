"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";

/** Confirm discard when closing a dirty form / panel. */
export function UnsavedChangesDialog({
  open,
  onStay,
  onDiscard,
  title = "Незбережені зміни",
  description = "Є незбережені зміни. Закрити без збереження?",
  pending = false,
}: {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
  title?: string;
  description?: string;
  pending?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={() => (pending ? undefined : onStay())}
      title={title}
      description={description}
      width="sm"
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onStay} disabled={pending}>
            Залишитись
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={onDiscard} disabled={pending}>
            Закрити без збереження
          </Button>
        </>
      }
    >
      <p className="type-caption text-[var(--color-text-secondary)]">
        Збережіть форму, або підтвердіть вихід без збереження.
      </p>
    </Modal>
  );
}
