"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SoftBusy } from "@/components/ui/SoftBusy";
import { updateProductIdentityAction } from "@/server/domains/products/actions";
import { cn } from "@/lib/utils";

/** Soft inline highlight — same rhythm as view mode, no boxed form. */
const titleEdit =
  "type-page-title w-full min-w-0 border-0 border-b border-transparent bg-transparent px-0 py-0 text-[var(--color-text-primary)] outline-none transition-[border-color,background-color] placeholder:text-[var(--color-text-quiet)] focus:border-[var(--color-primary-400)] focus:bg-[color-mix(in_srgb,var(--color-primary-50)_45%,transparent)]";

const lineEdit =
  "min-w-0 border-0 border-b border-transparent bg-transparent px-0 py-0 text-[13px] leading-[19px] text-[var(--color-text-secondary)] outline-none transition-[border-color,background-color] placeholder:text-[var(--color-text-quiet)] focus:border-[var(--color-primary-300)] focus:bg-[color-mix(in_srgb,var(--color-primary-50)_35%,transparent)] disabled:opacity-60";

/**
 * Inline identity edit keeps the page header layout; fields gently highlight in place.
 */
export function ProductIdentityEditor({
  productId,
  nameUk,
  internalCode,
  description,
  disabled,
}: {
  productId: string;
  nameUk: string;
  internalCode: string | null;
  description: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(nameUk);
  const [code, setCode] = useState(internalCode ?? "");
  const [desc, setDesc] = useState(description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (editing) return;
    setName(nameUk);
    setCode(internalCode ?? "");
    setDesc(description ?? "");
  }, [nameUk, internalCode, description, editing]);

  useEffect(() => {
    if (!editing) return;
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [editing]);

  function cancel() {
    setName(nameUk);
    setCode(internalCode ?? "");
    setDesc(description ?? "");
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("nameUk", name);
    formData.set("internalCode", code);
    formData.set("description", desc);
    startTransition(async () => {
      const result = await updateProductIdentityAction(formData);
      if (!result.ok) {
        setError(
          result.error === "DUPLICATE_CODE"
            ? "Такий внутрішній код уже зайнятий"
            : result.error === "DUPLICATE_NAME"
              ? "Виріб з такою назвою вже є"
              : "Перевірте назву виробу",
        );
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1
            className={cn(
              "type-page-title min-w-0",
              !disabled && "cursor-text hover:underline hover:decoration-[var(--color-primary-300)]",
            )}
            title={disabled ? undefined : "Натисніть, щоб змінити"}
            onClick={() => {
              if (!disabled) setEditing(true);
            }}
          >
            {nameUk}
          </h1>
          {!disabled ? (
            <button
              type="button"
              className="type-caption shrink-0 text-[var(--color-text-quiet)] hover:text-[var(--color-primary-700)]"
              onClick={() => setEditing(true)}
            >
              Редагувати
            </button>
          ) : null}
        </div>
        <p
          className={cn(
            "type-body-secondary mt-1.5 max-w-3xl",
            !disabled && "cursor-text hover:underline hover:decoration-[var(--color-border-strong)]",
          )}
          title={disabled ? undefined : "Натисніть, щоб змінити код або опис"}
          onClick={() => {
            if (!disabled) setEditing(true);
          }}
        >
          <span className="text-[var(--color-text-tertiary)]">
            {internalCode ? `Код ${internalCode}` : "Без внутрішнього коду"}
          </span>
          {description ? (
            <>
              <span className="mx-1.5 text-[var(--color-text-quiet)]">·</span>
              <span>{description}</span>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  return (
    <SoftBusy busy={pending} tone="inline" label="Збереження…">
      <div className="min-w-0 w-full max-w-3xl flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <input
            ref={nameRef}
            value={name}
            disabled={pending}
            aria-label="Назва виробу"
            placeholder="Назва виробу"
            className={cn(titleEdit, "flex-1 basis-[12rem]")}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancel();
              }
            }}
          />
          <span className="flex shrink-0 items-center gap-2 type-caption">
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="font-medium text-[var(--color-primary-700)] hover:underline disabled:opacity-50"
            >
              {pending ? "…" : "Зберегти"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={cancel}
              className="text-[var(--color-text-quiet)] hover:text-[var(--color-text-secondary)] disabled:opacity-50"
            >
              Скасувати
            </button>
          </span>
        </div>

        <div className="mt-1.5 flex max-w-3xl flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="shrink-0 text-[13px] leading-[19px] text-[var(--color-text-tertiary)]">
            Код
          </span>
          <input
            value={code}
            disabled={pending}
            aria-label="Внутрішній код"
            placeholder="—"
            className={cn(lineEdit, "w-[7.5rem]")}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancel();
              }
            }}
          />
          <span className="text-[13px] leading-[19px] text-[var(--color-text-quiet)]">·</span>
          <input
            value={desc}
            disabled={pending}
            aria-label="Опис"
            placeholder="Опис"
            className={cn(lineEdit, "min-w-[12rem] flex-1")}
            onChange={(event) => setDesc(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancel();
              }
            }}
          />
        </div>

        {error ? (
          <p className="type-caption mt-1 text-[var(--color-danger-text)]">{error}</p>
        ) : (
          <p className="type-caption mt-1 text-[var(--color-text-quiet)]">
            Enter — зберегти · Esc — скасувати
          </p>
        )}
      </div>
    </SoftBusy>
  );
}
