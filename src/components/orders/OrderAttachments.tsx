"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Select } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/Page";
import { IconDecoration, IconPlus, IconTrash } from "@/components/ui/Icons";
import { cn, formatDateUk } from "@/lib/utils";
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

function hasFileDrag(event: React.DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
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
  const [artworkDragging, setArtworkDragging] = useState(false);
  const [generalDragging, setGeneralDragging] = useState(false);
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
  const canUpload = !locked && !atLimit;

  function uploadFiles(fileList: FileList | File[] | null, purpose: "artwork" | "general") {
    const selected = fileList ? Array.from(fileList) : [];
    if (selected.length === 0) return;
    if (purpose === "artwork" && decorated.length > 1 && !selectedArtworkItemId) {
      setError(uploadErrorMessage("ITEM_REQUIRED"));
      return;
    }
    setError(null);
    startTransition(async () => {
      let remaining = ORDER_FILE_MAX_COUNT - files.length;
      for (const file of selected) {
        if (remaining <= 0) {
          setError(uploadErrorMessage("TOO_MANY"));
          break;
        }
        const formData = new FormData();
        formData.set("orderId", orderId);
        formData.set("file", file);
        formData.set("purpose", purpose);
        if (purpose === "artwork" && selectedArtworkItemId) {
          formData.set("orderItemId", selectedArtworkItemId);
        }
        const result = await uploadOrderFileAction(formData);
        if (!result.ok) {
          setError(uploadErrorMessage(result.error));
          break;
        }
        remaining -= 1;
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

  function makeDropHandlers(
    purpose: "artwork" | "general",
    setDragging: (value: boolean) => void,
  ) {
    return {
      onDragEnter(event: React.DragEvent) {
        if (!canUpload || !hasFileDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setDragging(true);
      },
      onDragOver(event: React.DragEvent) {
        if (!canUpload || !hasFileDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
        setDragging(true);
      },
      onDragLeave(event: React.DragEvent) {
        if (!canUpload) return;
        event.preventDefault();
        event.stopPropagation();
        const next = event.relatedTarget as Node | null;
        if (next && event.currentTarget.contains(next)) return;
        setDragging(false);
      },
      onDrop(event: React.DragEvent) {
        if (!canUpload) return;
        event.preventDefault();
        event.stopPropagation();
        setDragging(false);
        uploadFiles(event.dataTransfer.files, purpose);
      },
    };
  }

  const generalList =
    decorated.length === 0 ? files : hasLinkedFiles ? unlinkedFiles : [];

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

          {canUpload ? (
            <div
              className={cn(
                "border-t border-[var(--color-border)] px-3.5 py-3 transition-colors",
                artworkDragging && "bg-[var(--color-primary-50)]",
              )}
              {...makeDropHandlers("artwork", setArtworkDragging)}
            >
              <div className="flex flex-wrap items-end gap-2">
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
                  multiple
                  onChange={(event) => {
                    uploadFiles(event.target.files, "artwork");
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
              <p className="type-caption mt-2">
                {artworkDragging
                  ? "Відпустіть файл, щоб завантажити макет"
                  : "Або перетягніть файл макета в цю зону"}
              </p>
            </div>
          ) : null}
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
          <span className="type-caption tabular">
            {files.length}/{ORDER_FILE_MAX_COUNT}
          </span>
        </div>

        {generalList.length > 0 ? (
          <ul>
            {generalList.map((file) => (
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
        ) : (
          <div className="px-4 py-5 text-center">
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
        )}

        {canUpload ? (
          <div
            className={cn(
              "border-t border-dashed border-[var(--color-border)] px-4 py-5 text-center transition-colors",
              generalDragging
                ? "border-[var(--color-primary-600)] bg-[var(--color-primary-50)]"
                : "bg-[var(--color-surface-subtle)]",
            )}
            {...makeDropHandlers("general", setGeneralDragging)}
          >
            <input
              ref={generalInputRef}
              type="file"
              className="sr-only"
              accept={ORDER_FILE_ACCEPT}
              multiple
              onChange={(event) => {
                uploadFiles(event.target.files, "general");
              }}
            />
            <p className="type-body-secondary mb-3">
              {generalDragging
                ? "Відпустіть файл, щоб завантажити"
                : "Перетягніть файл сюди або натисніть кнопку"}
            </p>
            <Button
              type="button"
              size="sm"
              loading={pending}
              disabled={pending}
              onClick={() => generalInputRef.current?.click()}
            >
              <IconPlus size={14} />
              {pending ? "Завантаження…" : "Додати файл"}
            </Button>
          </div>
        ) : null}
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
