"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Overlay";
import { IconCopy, IconTrash } from "@/components/ui/Icons";
import {
  archiveMaterialAction,
  duplicateMaterialAction,
} from "@/server/domains/catalog/actions";

export function MaterialDeleteIconButton({
  materialId,
  materialName,
}: {
  materialId: string;
  materialName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
        aria-label={`Видалити ${materialName}`}
        title="Видалити"
        onClick={() => setOpen(true)}
      >
        <IconTrash size={15} />
      </button>
      <Modal
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        title="Видалити матеріал?"
        description="Матеріал потрапить в архів і зникне з нових комплектацій. Зафіксовані версії замовлень не зміняться."
        width="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Скасувати
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await archiveMaterialAction(materialId);
                  if (result.ok) {
                    setOpen(false);
                    router.refresh();
                  }
                });
              }}
            >
              {pending ? "Видалення…" : "Видалити"}
            </Button>
          </>
        }
      >
        <p className="type-body font-medium">{materialName}</p>
      </Modal>
    </>
  );
}

export function MaterialDuplicateIconButton({
  materialId,
  materialName,
}: {
  materialId: string;
  materialName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nameUk, setNameUk] = useState(`${materialName} (копія)`);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openModal() {
    setNameUk(`${materialName} (копія)`);
    setError(null);
    setOpen(true);
  }

  function confirm() {
    const trimmed = nameUk.replace(/\s+/g, " ").trim();
    if (!trimmed) {
      setError("Вкажіть назву копії");
      return;
    }
    const formData = new FormData();
    formData.set("materialId", materialId);
    formData.set("nameUk", trimmed);
    startTransition(async () => {
      const result = await duplicateMaterialAction(formData);
      if (!result.ok) {
        setError(
          result.error === "NAME_REQUIRED"
            ? "Вкажіть назву копії"
            : result.error === "NOT_FOUND"
              ? "Матеріал не знайдено"
              : "Не вдалося дублювати",
        );
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
        aria-label={`Дублювати ${materialName}`}
        title="Дублювати"
        onClick={openModal}
      >
        <IconCopy size={15} />
      </button>
      <Modal
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        title="Дублювати матеріал"
        description="Копія з тими самими параметрами, цінами та умовами постачальників."
        width="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Скасувати
            </Button>
            <Button size="sm" onClick={confirm} disabled={pending}>
              {pending ? "Копіювання…" : "Створити копію"}
            </Button>
          </>
        }
      >
        <Input
          label="Нова назва"
          required
          autoFocus
          value={nameUk}
          error={error ?? undefined}
          onChange={(event) => {
            setNameUk(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              confirm();
            }
          }}
        />
      </Modal>
    </>
  );
}
