"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SoftBusy } from "@/components/ui/SoftBusy";
import { updateProductIdentityAction } from "@/server/domains/products/actions";
import { cn } from "@/lib/utils";

const fieldShell =
  "w-full min-w-0 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--color-text-quiet)] focus:border-[var(--color-primary-400)] focus:ring-1 focus:ring-[var(--color-focus-ring)] disabled:opacity-60";

/**
 * Inline title / code / description — soft structured fields, no heavy card/modal.
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
              !disabled &&
                "cursor-text rounded-[6px] transition-colors hover:bg-[var(--color-surface-subtle)]",
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
            !disabled &&
              "cursor-text rounded-[6px] transition-colors hover:bg-[var(--color-surface-subtle)]",
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
      <div className="min-w-0 w-full max-w-3xl flex-1 space-y-3">
        <label className="block space-y-1">
          <span className="type-label">Назва</span>
          <input
            ref={nameRef}
            value={name}
            disabled={pending}
            aria-label="Назва виробу"
            placeholder="Назва виробу"
            className={cn(
              fieldShell,
              "type-page-title h-auto px-2.5 py-1.5 text-[var(--color-text-primary)]",
            )}
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
        </label>

        <div className="grid gap-3 sm:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)]">
          <label className="block space-y-1">
            <span className="type-label">Внутрішній код</span>
            <input
              value={code}
              disabled={pending}
              aria-label="Внутрішній код"
              placeholder="Необовʼязково"
              className={cn(fieldShell, "h-9 px-2.5 text-[13.5px] text-[var(--color-text-primary)]")}
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
          </label>

          <label className="block space-y-1">
            <span className="type-label">Опис</span>
            <textarea
              value={desc}
              disabled={pending}
              aria-label="Опис"
              placeholder="Короткий опис для каталогу"
              rows={2}
              className={cn(
                fieldShell,
                "min-h-[2.5rem] resize-y px-2.5 py-2 text-[13.5px] leading-snug text-[var(--color-text-primary)]",
              )}
              onChange={(event) => setDesc(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancel();
                }
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  save();
                }
              }}
            />
          </label>
        </div>

        {error ? <p className="type-caption text-[var(--color-danger-text)]">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" loading={pending} onClick={save}>
            Зберегти
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={cancel}>
            Скасувати
          </Button>
          <span className="type-caption text-[var(--color-text-quiet)]">
            Enter — зберегти · Esc — скасувати
          </span>
        </div>
      </div>
    </SoftBusy>
  );
}
