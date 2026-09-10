"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  IconCheckCircle,
  IconDecoration,
  IconGarment,
  IconMaterials,
  IconOperations,
  IconProducts,
  IconSearch,
} from "@/components/ui/Icons";

export type ProductCompositionTemplate = {
  materials: Array<{
    materialId: string;
    name: string;
    unit: string;
    consumption: number;
    waste: number;
    price: number;
    sizeCodes?: string[] | null;
    sizeConsumption?: Record<string, number>;
    /** Optional catalog pricing context for order draft toggles. */
    materialType?: string | null;
    priceMeterUahNoVat?: number | null;
    priceMeterUahVat?: number | null;
    priceMeterUahCutVat?: number | null;
    metersPerRoll?: number | null;
    minWholesaleMeters?: number | null;
    /** NET = без ПДВ, GROSS = з ПДВ у собівартості цієї лінії. */
    costVatMode?: "NET" | "GROSS" | null;
    /** auto = за метражем; cut/wholesale = примусово. */
    priceMode?: "auto" | "cut" | "wholesale" | null;
    /** Order-spec color / attribute (not a separate catalog SKU). */
    lineColor?: string | null;
    /** Palette from Material.availableColors for this line. */
    availableColors?: string[];
    /** User confirmed row in the side panel (order draft only). */
    specReviewed?: boolean;
    /** Fabric delivery / cargo overrides for this draft line. */
    metersPerKg?: number | null;
    cargoUsdPerKg?: number | null;
    usdUahRate?: number | null;
    fabricDeliveryManual?: boolean;
    fabricDeliveryAmount?: number | null;
    wholesaleNote?: string | null;
  }>;
  operations: Array<{
    operationId: string;
    name: string;
    method: string;
    unitRate: number | null;
    shiftCost: number | null;
    standardOutput: number | null;
    sizeCodes?: string[] | null;
    rateTiers?: Array<{ minQuantity: number; ratePerUnit: number }>;
  }>;
  decorations: Array<{
    decorationMethodId: string;
    name: string;
    setupCost: number;
    unitRate: number;
  }>;
};

export type DraftMaterialRow = ProductCompositionTemplate["materials"][number] & { key: string };
export type DraftOperationRow = ProductCompositionTemplate["operations"][number] & { key: string };
export type DraftDecorationRow = ProductCompositionTemplate["decorations"][number] & {
  key: string;
};

export type DraftComposition = {
  materials: DraftMaterialRow[];
  operations: DraftOperationRow[];
  decorations: DraftDecorationRow[];
};

export type CatalogProduct = {
  id: string;
  label: string;
  nameUk?: string;
  internalCode?: string | null;
  imageUrl?: string | null;
  materialsCount: number;
  operationsCount: number;
  decorationsCount?: number;
  sizes: Array<{ code: string; nameUk: string }>;
  priceTiers: Array<{ qty: number; price: number }>;
  composition: ProductCompositionTemplate;
};

function isReady(product: CatalogProduct) {
  return product.materialsCount > 0 && product.operationsCount > 0;
}

function ProductThumb({
  imageUrl,
  label,
  active,
  size = "md",
}: {
  imageUrl?: string | null;
  label: string;
  active?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const initial = label.trim().charAt(0).toUpperCase() || "В";
  const box = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-14 w-14";
  const iconSize = size === "lg" ? 22 : size === "sm" ? 14 : 18;
  const radius = size === "sm" ? "rounded-[6px]" : "rounded-[8px]";

  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden border bg-[var(--color-tint-slate)]",
        box,
        radius,
        active ? "border-[var(--color-primary-300)]" : "border-[var(--color-border)]",
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="64px"
          className="object-cover"
          unoptimized={imageUrl.startsWith("/uploads/") || imageUrl.includes("supabase.co")}
        />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center text-[var(--color-text-tertiary)]">
          <IconProducts size={iconSize} />
          {size !== "sm" ? (
            <span className="text-[10px] font-semibold tracking-wide">{initial}</span>
          ) : null}
        </span>
      )}
    </span>
  );
}

export { ProductThumb };

/** Icon + count only; meaning in native tooltip on hover. */
function MetaStat({
  icon,
  value,
  title,
}: {
  icon: ReactNode;
  value: ReactNode;
  title: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-0.5 text-[10.5px] tabular leading-none text-[var(--color-text-secondary)]"
    >
      <span className="text-[var(--color-text-tertiary)]">{icon}</span>
      {value}
    </span>
  );
}

/**
 * Narrow right-rail catalog: compact mini-cards with thumbnail + icon meta.
 * Selecting a product opens composition review on the left workspace.
 */
export function ProductCatalogPanel({
  products,
  selectedId,
  onSelect,
  headerAction,
}: {
  products: CatalogProduct[];
  selectedId: string;
  onSelect: (id: string) => void;
  headerAction?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "draft">("all");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products
      .filter((product) => {
        const haystack = [product.label, product.nameUk, product.internalCode]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matchesTerm = term ? haystack.includes(term) : true;
        const ready = isReady(product);
        const matchesFilter = filter === "all" ? true : filter === "ready" ? ready : !ready;
        return matchesTerm && matchesFilter;
      })
      .sort((left, right) => {
        const readyLeft = isReady(left) ? 0 : 1;
        const readyRight = isReady(right) ? 0 : 1;
        if (readyLeft !== readyRight) return readyLeft - readyRight;
        const nameLeft = left.nameUk ?? left.label;
        const nameRight = right.nameUk ?? right.label;
        return nameLeft.localeCompare(nameRight, "uk", { numeric: true, sensitivity: "base" });
      });
  }, [products, query, filter]);

  return (
    <div className="overflow-hidden rounded-[var(--radius-surface)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-1.5 border-b border-[var(--color-border)] px-2 py-1.5">
        <div className="min-w-0">
          <h2 className="truncate text-[12.5px] font-semibold leading-tight">Каталог</h2>
          <p className="type-caption truncate text-[10.5px]">Оберіть еталон</p>
        </div>
        {headerAction}
      </div>

      <div className="space-y-1 border-b border-[var(--color-border)] px-1.5 py-1.5">
        <div className="relative">
          <IconSearch
            size={12}
            className="pointer-events-none absolute top-1/2 left-1.5 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Назва або код"
            className="h-7 w-full rounded-[5px] border border-[var(--color-border)] bg-[var(--color-surface)] pr-1.5 pl-6 text-[11.5px] outline-none focus:border-[var(--color-primary-500)]"
          />
        </div>
        <div className="flex flex-wrap gap-0.5">
          {(
            [
              { key: "all", label: "Усі" },
              { key: "ready", label: "Готові" },
              { key: "draft", label: "Чернетки" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "h-5 rounded-full px-1.5 text-[10.5px] font-medium transition-colors",
                filter === item.key
                  ? "bg-[var(--color-tint-slate)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="max-h-[min(640px,calc(100vh-260px))] space-y-1 overflow-y-auto p-1.5">
        {filtered.length === 0 ? (
          <li className="px-2 py-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-tint-sage)] text-[var(--color-primary-700)]">
                <IconGarment size={18} />
              </div>
              <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                {products.length === 0 ? "Каталог порожній" : "Нічого не знайдено"}
              </p>
              <p className="text-[11px] leading-snug text-[var(--color-text-tertiary)]">
                {products.length === 0
                  ? "Створіть виріб — він стане еталоном для замовлень."
                  : "Спробуйте інший запит або фільтр."}
              </p>
            </div>
          </li>
        ) : (
          filtered.map((product) => {
            const ready = isReady(product);
            const active = product.id === selectedId;
            const title = product.nameUk ?? product.label;
            const code = product.internalCode;

            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => onSelect(product.id)}
                  className={cn(
                    "flex w-full gap-1.5 rounded-[7px] border p-1.5 text-left transition-colors",
                    active
                      ? "border-[var(--color-primary-300)] bg-[var(--color-tint-slate)] ring-1 ring-[var(--color-primary-200)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]",
                  )}
                >
                  <ProductThumb
                    imageUrl={product.imageUrl}
                    label={title}
                    active={active}
                    size="sm"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-1">
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[11.5px] font-semibold leading-snug text-[var(--color-text-primary)]">
                          {title}
                        </span>
                        {code ? (
                          <span className="mt-0.5 block text-[10px] tabular text-[var(--color-text-tertiary)]">
                            {code}
                          </span>
                        ) : null}
                      </span>
                      <span
                        title={
                          ready
                            ? "Готовий до розрахунку: є матеріали й операції"
                            : "Неповний склад: бракує матеріалів або операцій"
                        }
                        className={cn(
                          "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                          ready
                            ? "bg-[var(--color-success-text)]"
                            : "bg-[var(--color-warning-text)]",
                        )}
                        aria-label={ready ? "Готовий" : "Неповний склад"}
                      />
                      {active ? (
                        <IconCheckCircle
                          size={12}
                          className="mt-0.5 text-[var(--color-primary-600)]"
                        />
                      ) : null}
                    </span>

                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <MetaStat
                        title="Матеріали в комплектації"
                        icon={<IconMaterials size={11} />}
                        value={product.materialsCount}
                      />
                      <MetaStat
                        title="Операції в комплектації"
                        icon={<IconOperations size={11} />}
                        value={product.operationsCount}
                      />
                      <MetaStat
                        title="Методи нанесення в комплектації"
                        icon={<IconDecoration size={11} />}
                        value={product.decorationsCount ?? 0}
                      />
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
