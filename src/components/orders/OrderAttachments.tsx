"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { IconPlus, IconTrash } from "@/components/ui/Icons";
import { formatDateUk } from "@/lib/utils";
import { deleteOrderFileAction, uploadOrderFileAction } from "@/server/domains/orders/actions";

export type OrderFileRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function OrderAttachments({
  orderId,
  files,
  locked,
}: {
  orderId: string;
  files: OrderFileRow[];
  locked?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File | null) {
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadOrderFileAction(formData);
      if (!result.ok) {
        setError(
          result.error === "TOO_LARGE"
            ? "Файл більший за 20 МБ."
            : result.error === "TYPE"
              ? "Підходять PDF, зображення, AI/EPS або ZIP."
              : result.error === "ORDER_LOCKED"
                ? "До цього замовлення файли вже не додаються."
                : "Не вдалося завантажити файл. Перевірте сховище і спробуйте ще раз.",
        );
        return;
      }
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }

  function remove(fileId: string) {
    if (!window.confirm("Прибрати цей файл із замовлення?")) return;
    setError(null);
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("fileId", fileId);
    startTransition(async () => {
      const result = await deleteOrderFileAction(formData);
      if (!result.ok) {
        setError(
          result.error === "ORDER_LOCKED"
            ? "Після передачі в цех файли не видаляються."
            : "Не вдалося видалити файл.",
        );
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-3.5 py-2.5">
        <div>
          <p className="type-subsection">Вкладення</p>
          <p className="type-caption mt-0.5">Макети нанесення, лекала, підтвердження від клієнта</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="type-caption tabular">{files.length}</span>
          {locked ? null : (
            <>
              <input
                ref={inputRef}
                type="file"
                className="sr-only"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.svg,.tif,.tiff,.ai,.eps,.zip"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  upload(file);
                }}
              />
              <Button
                type="button"
                size="sm"
                loading={pending}
                disabled={pending}
                onClick={() => inputRef.current?.click()}
              >
                <IconPlus size={14} />
                {pending ? "Завантаження…" : "Додати файл"}
              </Button>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div className="px-4 pt-3">
          <Banner tone="danger">{error}</Banner>
        </div>
      ) : null}

      {files.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-[14px] font-semibold">Файлів ще немає</p>
          <p className="type-body-secondary mx-auto mt-0.5 max-w-md">
            Якщо в замовленні є друк або вишивка — додайте макет тут, інакше передати в цех не
            вийде.
          </p>
        </div>
      ) : (
        <ul>
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center gap-3 border-b border-[var(--color-divider)] px-4 py-3 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-primary-700)] hover:underline"
                >
                  {file.fileName}
                </a>
                <p className="type-caption">
                  {formatBytes(file.sizeBytes)} · {formatDateUk(file.createdAt)}
                </p>
              </div>
              {locked ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  aria-label={`Видалити ${file.fileName}`}
                  onClick={() => remove(file.id)}
                >
                  <IconTrash size={14} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
