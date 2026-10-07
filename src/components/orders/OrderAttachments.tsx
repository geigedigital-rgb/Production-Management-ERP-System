"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Select } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/Page";
import { IconDecoration, IconPlus, IconTrash } from "@/components/ui/Icons";
import { formatDateUk } from "@/lib/utils";
import { deleteOrderFileAction, uploadOrderFileAction } from "@/server/domains/orders/actions";
import {
  itemNeedsArtworkFile,
  ORDER_FILE_ACCEPT,
  ORDER_FILE_MAX_COUNT,
  ORDER_FILE_MAX_MB,
  orderArtworkReady,
} from "@/lib/order-files";

export type OrderFileRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
  orderItemId?: string | null;
  orderItemNameUk?: string | null;
};

export type OrderArtworkItem = {
  id: string;
  nameUk: string;
  decorationsCount: number;
  decorationNames: string[];
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function uploadErrorMessage(error: string | undefined) {
  switch (error) {
    case "TOO_LARGE":
      return `Файл більший за ${ORDER_FILE_MAX_MB} МБ.`;
    case "TOO_MANY":
      return `У замовленні вже ${ORDER_FILE_MAX_COUNT} файлів — більше додавати не можна.`;
    case "TYPE":
      return "Підходять PDF, зображення, AI/EPS або ZIP.";
    case "ITEM_REQUIRED":
      return "Оберіть виріб (позицію), до якого належить макет.";
    case "ITEM":
      return "Обрана позиція не знайдена в замовленні.";
    case "ORDER_LOCKED":
      return "До цього замовлення файли вже не додаються.";
    default:
      return "Не вдалося завантажити файл. Перевірте сховище і спробуйте ще раз.";
  }
}

export function OrderAttachments({
  orderId,
  files,
  artworkItems = [],
  locked,
}: {
  orderId: string;
  files: OrderFileRow[];
  artworkItems?: OrderArtworkItem[];
  locked?: boolean;
}) {
  const router = useRouter();
  const artworkInputRef = useRef<HTMLInputElement>(null);
  const generalInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const decorated = useMemo(
    () => artworkItems.filter((item) => item.decorationsCount > 0),
    [artworkItems],
  );
  const defaultItemId = decorated.length === 1 ? decorated[0]!.id : "";
  const [artworkItemId, setArtworkItemId] = useState(defaultItemId);
  const selectedArtworkItemId = artworkItemId || defaultItemId;

  const artworkReady = orderArtworkReady(
    decorated.map((item) => ({ id: item.id, decorationsCount: item.decorationsCount })),
    files,
  );
  const hasLinkedFiles = files.some((file) => file.orderItemId);
  const unlinkedFiles = files.filter((file) => !file.orderItemId);
  const atLimit = files.length >= ORDER_FILE_MAX_COUNT;

  function upload(file: File | null, purpose: "artwork" | "general") {
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("file", file);
    formData.set("purpose", purpose);
    if (purpose === "artwork" && selectedArtworkItemId) {
      formData.set("orderItemId", selectedArtworkItemId);
    }
    startTransition(async () => {
      const result = await uploadOrderFileAction(formData);
      if (!result.ok) {
        setError(uploadErrorMessage(result.error));
        return;
      }
      if (artworkInputRef.current) artworkInputRef.current.value = "";
      if (generalInputRef.current) generalInputRef.current.value = "";
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
    <div className="space-y-4">
      {error ? <Banner tone="danger">{error}</Banner> : null}

      {decorated.length > 0 ? (
        <section className="overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-border)]">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 type-subsection">
                <IconDecoration size={15} />
                Нанесення — макети
              </p>
              <p className="type-caption mt-0.5">
                Без файлу макета передати в цех не можна. До {ORDER_FILE_MAX_MB} МБ · до{" "}
                {ORDER_FILE_MAX_COUNT} файлів на замовлення.
              </p>
            </div>
            <StatusBadge tone={artworkReady ? "success" : "warning"}>
              {artworkReady ? "Макети є" : "Потрібен файл"}
            </StatusBadge>
          </div>

          <ul className="divide-y divide-[var(--color-divider)]">
            {decorated.map((item) => {
              const needs = itemNeedsArtworkFile(
                { id: item.id, decorationsCount: item.decorationsCount },
                files,
              );
              const itemFiles = files.filter((file) => file.orderItemId === item.id);
              const legacyCover =
                !needs && itemFiles.length === 0 && unlinkedFiles.length > 0 && !hasLinkedFiles;
              return (
                <li key={item.id} className="px-3.5 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-[var(--color-text-primary)]">
                        {item.nameUk}
                      </p>
                      <p className="type-caption mt-0.5">
                        {item.decorationNames.length > 0
                          ? item.decorationNames.join(" · ")
                          : `${item.decorationsCount} нанесен.`}
                      </p>
                    </div>
                    <StatusBadge tone={needs ? "warning" : "success"}>
                      {needs
                        ? "Додайте файл"
                        : legacyCover
                          ? "Покрито загальним файлом"
                          : `${itemFiles.length} файл.`}
                    </StatusBadge>
                  </div>
                  {itemFiles.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {itemFiles.map((file) => (
                        <li key={file.id}>
                          <FileRow
                            file={file}
                            locked={locked}
                            pending={pending}
                            onRemove={() => remove(file.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : needs ? (
                    <p className="type-caption mt-2 text-[var(--color-warning-text)]">
                      Завантажте макет для цього виробу — інакше виробництво недоступне.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {locked || atLimit ? null : (
            <div className="flex flex-wrap items-end gap-2 border-t border-[var(--color-border)] px-3.5 py-3">
              {decorated.length > 1 ? (
                <div className="min-w-[12rem] flex-1">
                  <Select
                    label="Виріб для макета"
                    value={selectedArtworkItemId}
                    onChange={(event) => setArtworkItemId(event.target.value)}
                    options={[
                      { value: "", label: "Оберіть позицію…" },
                      ...decorated.map((item) => ({
                        value: item.id,
                        label: item.nameUk,
                      })),
                    ]}
                  />
                </div>
              ) : null}
              <input
                ref={artworkInputRef}
                type="file"
                className="sr-only"
                accept={ORDER_FILE_ACCEPT}
                onChange={(event) => {
                  upload(event.target.files?.[0] ?? null, "artwork");
                }}
              />
              <Button
                type="button"
                size="sm"
                loading={pending}
                disabled={pending || (decorated.length > 1 && !selectedArtworkItemId)}
                onClick={() => artworkInputRef.current?.click()}
              >
                <IconPlus size={14} />
                {pending ? "Завантаження…" : "Додати макет"}
              </Button>
            </div>
          )}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-border)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-3.5 py-2.5">
          <div>
            <p className="type-subsection">
              {decorated.length > 0 ? "Інші вкладення" : "Вкладення"}
            </p>
            <p className="type-caption mt-0.5">
              {decorated.length > 0
                ? "Лекала, підтвердження клієнта тощо"
                : `Макети, лекала, підтвердження · до ${ORDER_FILE_MAX_MB} МБ · до ${ORDER_FILE_MAX_COUNT} файлів`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="type-caption tabular">
              {files.length}/{ORDER_FILE_MAX_COUNT}
            </span>
            {locked || atLimit ? null : (
              <>
                <input
                  ref={generalInputRef}
                  type="file"
                  className="sr-only"
                  accept={ORDER_FILE_ACCEPT}
                  onChange={(event) => {
                    upload(event.target.files?.[0] ?? null, "general");
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={pending}
                  disabled={pending}
                  onClick={() => generalInputRef.current?.click()}
                >
                  <IconPlus size={14} />
                  {pending ? "Завантаження…" : "Додати файл"}
                </Button>
              </>
            )}
          </div>
        </div>

        {(() => {
          const list =
            decorated.length === 0
              ? files
              : hasLinkedFiles
                ? unlinkedFiles
                : [];
          if (list.length === 0) {
            return (
              <div className="px-4 py-6 text-center">
                <p className="text-[14px] font-semibold">
                  {decorated.length > 0 ? "Додаткових файлів немає" : "Файлів ще немає"}
                </p>
                {decorated.length === 0 ? (
                  <p className="type-body-secondary mx-auto mt-0.5 max-w-md">
                    Якщо зʼявиться нанесення — тут буде блок макетів і жовтий маркер на вкладці
                    «Документи».
                  </p>
                ) : null}
              </div>
            );
          }
          return (
            <ul>
              {list.map((file) => (
                <li
                  key={file.id}
                  className="border-b border-[var(--color-divider)] px-4 py-3 last:border-0"
                >
                  <FileRow
                    file={file}
                    locked={locked}
                    pending={pending}
                    onRemove={() => remove(file.id)}
                    showProduct
                  />
                </li>
              ))}
            </ul>
          );
        })()}
      </section>

      {decorated.length > 0 && !hasLinkedFiles && unlinkedFiles.length > 0 ? (
        <section className="overflow-hidden rounded-[var(--radius-surface)] border border-dashed border-[var(--color-border)]">
          <div className="px-3.5 py-2.5">
            <p className="type-caption mb-2">
              Файли без привʼязки до виробу (враховуються для передачі в цех)
            </p>
            <ul className="space-y-1.5">
              {unlinkedFiles.map((file) => (
                <li key={file.id}>
                  <FileRow
                    file={file}
                    locked={locked}
                    pending={pending}
                    onRemove={() => remove(file.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FileRow({
  file,
  locked,
  pending,
  onRemove,
  showProduct,
}: {
  file: OrderFileRow;
  locked?: boolean;
  pending: boolean;
  onRemove: () => void;
  showProduct?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
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
          {showProduct && file.orderItemNameUk ? ` · ${file.orderItemNameUk}` : ""}
        </p>
      </div>
      {locked ? null : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-label={`Видалити ${file.fileName}`}
          onClick={onRemove}
        >
          <IconTrash size={14} />
        </Button>
      )}
    </div>
  );
}
