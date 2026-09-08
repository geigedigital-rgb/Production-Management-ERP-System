"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { updateProductSizesAction } from "@/server/domains/products/actions";

export function ProductSizesEditor({
  productId,
  selectedSizeIds,
  catalog,
  disabled,
}: {
  productId: string;
  selectedSizeIds: string[];
  catalog: Array<{ id: string; code: string; nameUk: string }>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(() => new Set(selectedSizeIds));
  const selectedKey = selectedSizeIds.slice().sort().join("|");
  const draftKey = useMemo(() => [...draft].sort().join("|"), [draft]);
  const dirty = draftKey !== selectedKey;

  function toggle(id: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    const formData = new FormData();
    formData.set("productId", productId);
    for (const id of draft) formData.append("sizeIds", id);
    startTransition(async () => {
      const result = await updateProductSizesAction(formData);
      if (!result.ok) return;
      router.refresh();
    });
  }

  function reset() {
    setDraft(new Set(selectedSizeIds));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {catalog.map((size) => {
          const active = draft.has(size.id);
          return (
            <button
              key={size.id}
              type="button"
              disabled={disabled || pending}
              onClick={() => toggle(size.id)}
              title={size.code !== size.nameUk ? size.code : undefined}
              className={cn(
                "rounded-[var(--radius-badge)] px-2 py-1 text-[12.5px] font-medium transition-colors",
                active
                  ? "bg-[var(--color-tint-sage)] text-[var(--color-primary-800)] ring-1 ring-[var(--color-border-strong)]"
                  : "bg-[var(--color-surface-subtle)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]",
                (disabled || pending) && "cursor-not-allowed opacity-60",
              )}
            >
              {size.nameUk}
            </button>
          );
        })}
      </div>
      {catalog.length === 0 ? (
        <p className="type-caption">У довіднику немає активних розмірів.</p>
      ) : (
        <p className="type-caption">
          Натисніть розмір, щоб додати або прибрати. XXL / 3XL / 4XL дають +15% матеріали та +20%
          операції в розрахунку.
        </p>
      )}
      {dirty ? (
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" disabled={pending || disabled} onClick={save}>
            {pending ? "Збереження…" : "Зберегти розміри"}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={reset}>
            Скасувати
          </Button>
        </div>
      ) : null}
    </div>
  );
}
