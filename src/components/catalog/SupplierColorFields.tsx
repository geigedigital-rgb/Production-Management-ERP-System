"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Field";
import { ColorSelect } from "@/components/ui/ColorSelect";
import { SpecColorPicker } from "@/components/composition/SpecColorPicker";
import {
  colorsForSupplier,
  reconcileColorForSupplier,
} from "@/lib/supplier-colors";
import { swatchForColorLabel } from "@/lib/trim-colors";
import { cn } from "@/lib/utils";

export type SupplierColorOfferOption = {
  supplierId: string;
  supplierName: string;
  isPrimary?: boolean;
  availableColors: string[];
};

/**
 * Supplier first, then color from that supplier's palette.
 * Used on product BOM and order material detail.
 */
export function SupplierColorFields({
  supplierId,
  color,
  offers,
  materialFallbackColors = [],
  disabled,
  onSupplierChange,
  onColorChange,
  compact,
}: {
  supplierId: string | null | undefined;
  color: string | null | undefined;
  offers: SupplierColorOfferOption[];
  materialFallbackColors?: string[];
  disabled?: boolean;
  onSupplierChange: (supplierId: string | null) => void;
  onColorChange: (color: string | null) => void;
  compact?: boolean;
}) {
  const offerRows = useMemo(
    () =>
      offers.map((row) => ({
        supplierId: row.supplierId,
        isPrimary: row.isPrimary,
        availableColors: row.availableColors,
      })),
    [offers],
  );

  const palette = useMemo(
    () => colorsForSupplier(offerRows, supplierId, materialFallbackColors),
    [offerRows, supplierId, materialFallbackColors],
  );

  function changeSupplier(next: string | null) {
    onSupplierChange(next);
  }

  if (offers.length === 0 && palette.length === 0) {
    return (
      <p className="type-caption text-[var(--color-text-quiet)]">
        Немає палітри — додайте кольори в умовах постачальника матеріалу.
      </p>
    );
  }

  if (compact) {
    const nativeSelectClass =
      "h-7 min-w-0 max-w-full rounded-[6px] border border-[var(--color-border)] bg-white px-1.5 text-[12px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary-500)] disabled:opacity-60";

    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {offers.length > 0 ? (
          <select
            className={cn(nativeSelectClass, "max-w-[11rem] flex-1 basis-[8.5rem]")}
            value={supplierId ?? ""}
            disabled={disabled}
            aria-label="Постачальник"
            title="Постачальник"
            onChange={(event) => changeSupplier(event.target.value || null)}
          >
            <option value="">Постачальник…</option>
            {offers.map((offer) => (
              <option key={offer.supplierId} value={offer.supplierId}>
                {offer.supplierName}
                {offer.isPrimary ? " · осн." : ""}
              </option>
            ))}
          </select>
        ) : null}

        {supplierId || offers.length === 0 ? (
          palette.length === 0 ? (
            <span className="text-[11px] text-[var(--color-warning-text)]">
              Немає кольорів
            </span>
          ) : (
            <ColorSelect
              value={color}
              options={palette}
              disabled={disabled}
              onChange={onColorChange}
              className="flex-1 basis-[7.5rem]"
            />
          )
        ) : (
          <span className="text-[11px] text-[var(--color-text-quiet)]">
            оберіть постачальника
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {offers.length > 0 ? (
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-[var(--color-text-tertiary)]">
            Постачальник
          </span>
          <Select
            size="sm"
            value={supplierId ?? ""}
            disabled={disabled}
            onChange={(event) => changeSupplier(event.target.value || null)}
          >
            <option value="">Оберіть постачальника…</option>
            {offers.map((offer) => (
              <option key={offer.supplierId} value={offer.supplierId}>
                {offer.supplierName}
                {offer.isPrimary ? " · основний" : ""}
              </option>
            ))}
          </Select>
        </label>
      ) : null}

      {supplierId || offers.length === 0 ? (
        <div>
          <span className="mb-1 block text-[11px] font-medium text-[var(--color-text-tertiary)]">
            Колір
          </span>
          {palette.length === 0 ? (
            <p className="type-caption text-[var(--color-warning-text)]">
              У цього постачальника ще немає кольорів у палітрі.
            </p>
          ) : (
            <SpecColorPicker
              value={color}
              onChange={onColorChange}
              materialColors={palette}
              hint="Палітра залежить від обраного постачальника"
            />
          )}
        </div>
      ) : (
        <p className="type-caption">
          Спочатку оберіть постачальника — зʼявиться його палітра.
        </p>
      )}
    </div>
  );
}

export function ProductMaterialSupplierColorEditor({
  productId,
  productMaterialId,
  supplierId,
  color,
  offers,
  materialFallbackColors,
  readOnly,
}: {
  productId: string;
  productMaterialId: string;
  supplierId: string | null;
  color: string | null;
  offers: SupplierColorOfferOption[];
  materialFallbackColors?: string[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function save(next: { supplierId?: string | null; colorSnapshot?: string | null }) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("id", productMaterialId);
    if (next.supplierId !== undefined) {
      formData.set("supplierId", next.supplierId ?? "");
    }
    if (next.colorSnapshot !== undefined) {
      formData.set("colorSnapshot", next.colorSnapshot ?? "");
    }
    startTransition(async () => {
      const { updateProductMaterialSupplierColorAction } = await import(
        "@/server/domains/products/actions"
      );
      await updateProductMaterialSupplierColorAction(formData);
      router.refresh();
    });
  }

  if (readOnly) {
    const supplierName =
      offers.find((row) => row.supplierId === supplierId)?.supplierName ?? null;
    const parts = [supplierName, color].filter(Boolean);
    if (parts.length === 0) return null;
    const swatch = color?.trim() ? swatchForColorLabel(color) : null;
    return (
      <p className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-[var(--color-text-quiet)]">
        {swatch ? (
          <span
            className={cn(
              "size-3 shrink-0 rounded-full ring-1 ring-black/15",
              swatch.bordered && "border border-[var(--color-border-strong)]",
            )}
            style={{ backgroundColor: swatch.swatch }}
            aria-hidden
          />
        ) : null}
        <span className="truncate">{parts.join(" · ")}</span>
      </p>
    );
  }

  return (
    <SupplierColorFields
      supplierId={supplierId}
      color={color}
      offers={offers}
      materialFallbackColors={materialFallbackColors}
      disabled={pending}
      compact
      onSupplierChange={(next) => {
        const reconciled = reconcileColorForSupplier({
          color,
          supplierId: next,
          offers: offers.map((row) => ({
            supplierId: row.supplierId,
            isPrimary: row.isPrimary,
            availableColors: row.availableColors,
          })),
          materialFallback: materialFallbackColors,
        });
        save({ supplierId: next, colorSnapshot: reconciled });
      }}
      onColorChange={(next) => save({ colorSnapshot: next })}
    />
  );
}
