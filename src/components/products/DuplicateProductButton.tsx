"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Overlay";
import { duplicateProductAction } from "@/server/domains/products/actions";

export function DuplicateProductButton({
  productId,
  productNameUk,
}: {
  productId: string;
  productNameUk: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nameUk, setNameUk] = useState(`${productNameUk} (копія)`);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openModal() {
    setNameUk(`${productNameUk} (копія)`);
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
    formData.set("productId", productId);
    formData.set("nameUk", trimmed);
    startTransition(async () => {
      const result = await duplicateProductAction(formData);
      if (!result.ok) {
        setError(
          result.error === "NAME_REQUIRED"
            ? "Вкажіть назву копії"
            : result.error === "NOT_FOUND"
              ? "Виріб не знайдено"
              : "Не вдалося дублювати",
        );
        return;
      }
      setOpen(false);
      router.push(`/products/${result.productId}`);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={openModal}>
        Дублювати виріб
      </Button>
      <Modal
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        title="Дублювати виріб"
        description="Швидка копія з новою назвою: комплектація, крій і прайс. Далі можна змінити параметри в картці."
        width="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
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
