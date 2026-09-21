"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { SizeGuideHelpButton } from "@/components/size-charts/SizeGuideHelp";
import { cn } from "@/lib/utils";
import { updateProductSizesAction } from "@/server/domains/products/actions";

type CatalogSize = {
  id: string;
  code: string;
  nameUk: string;
  variantId: string;
  descriptionUk?: string | null;
};

type CatalogVariant = {
  id: string;
  nameUk: string;
  code: string;
};

export function ProductSizesEditor({
  productId,
  selectedSizeIds,
  selectedVariantId = null,
  variants,
  catalog,
  disabled,
}: {
  productId: string;
  selectedSizeIds: string[];
  selectedVariantId?: string | null;
  variants: CatalogVariant[];
  catalog: CatalogSize[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inferredVariantId =
    selectedVariantId ||
    catalog.find((size) => selectedSizeIds.includes(size.id))?.variantId ||
    variants[0]?.id ||
    "";
  const [variantId, setVariantId] = useState(inferredVariantId);
  /** Keep size picks per variant so switching away and back does not wipe them. */
  const [draftByVariant, setDraftByVariant] = useState<Record<string, string[]>>(() =>
    inferredVariantId ? { [inferredVariantId]: [...selectedSizeIds] } : {},
  );

  const draftIds = draftByVariant[variantId] ?? [];
  const draft = useMemo(() => new Set(draftIds), [draftIds]);

  const activeVariant = variants.find((row) => row.id === variantId) ?? null;

  const sizesForVariant = useMemo(
    () => catalog.filter((size) => size.variantId === variantId),
    [catalog, variantId],
  );

  const selectedKey = `${selectedVariantId ?? ""}|${selectedSizeIds.slice().sort().join("|")}`;
  const draftKey = `${variantId}|${[...draftIds].sort().join("|")}`;
  const dirty = draftKey !== selectedKey;

  function changeVariant(nextVariantId: string) {
    setVariantId(nextVariantId);
    setDraftByVariant((prev) => {
      if (prev[nextVariantId] !== undefined) return prev;
      if (nextVariantId === inferredVariantId) {
        return { ...prev, [nextVariantId]: [...selectedSizeIds] };
      }
      return { ...prev, [nextVariantId]: [] };
    });
  }

  function toggle(id: string) {
    setDraftByVariant((prev) => {
      const current = new Set(prev[variantId] ?? []);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      return { ...prev, [variantId]: [...current] };
    });
  }

  function save() {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("sizeChartVariantId", variantId);
    for (const id of draft) formData.append("sizeIds", id);
    startTransition(async () => {
      const result = await updateProductSizesAction(formData);
      if (!result.ok) return;
      router.refresh();
    });
  }

  function reset() {
    setVariantId(inferredVariantId);
    setDraftByVariant(
      inferredVariantId ? { [inferredVariantId]: [...selectedSizeIds] } : {},
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        {variants.length > 0 ? (
          <div className="min-w-[12rem] flex-1">
            <Select
              label="Варіант сітки"
              value={variantId}
              disabled={disabled || pending}
              onChange={(event) => changeVariant(event.target.value)}
            >
              {variants.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.nameUk}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        {activeVariant ? (
          <SizeGuideHelpButton
            variantCode={activeVariant.code}
            variantName={activeVariant.nameUk}
            className="mb-1 shrink-0"
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sizesForVariant.map((size) => {
          const active = draft.has(size.id);
          return (
            <button
              key={size.id}
              type="button"
              disabled={disabled || pending || !variantId}
              onClick={() => toggle(size.id)}
              title={size.descriptionUk || undefined}
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
      {sizesForVariant.length === 0 ? (
        <p className="type-caption">
          {variantId
            ? "У цьому варіанті немає активних розмірів — додайте в довіднику «Розмірна сітка»."
            : "Оберіть варіант сітки."}
        </p>
      ) : (
        <p className="type-caption">
          Це реальні розміри сітки. «Як підібрати розмір» — лише підказка з обхватами.
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
