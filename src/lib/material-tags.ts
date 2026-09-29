/** Material color tags — quick visual marks in the catalog table. */

export const MATERIAL_TAG_COLORS = ["green", "blue", "amber", "rose", "slate"] as const;

export type MaterialTagColor = (typeof MATERIAL_TAG_COLORS)[number];

export function isMaterialTagColor(value: unknown): value is MaterialTagColor {
  return (
    typeof value === "string" &&
    (MATERIAL_TAG_COLORS as readonly string[]).includes(value)
  );
}

export function normalizeMaterialTagColor(
  value: unknown,
): MaterialTagColor | null {
  return isMaterialTagColor(value) ? value : null;
}

/** Soft fill + ring for pills / swatches. */
export const MATERIAL_TAG_STYLES: Record<
  MaterialTagColor,
  { swatch: string; ring: string; label: string }
> = {
  green: {
    swatch: "bg-[var(--color-primary-500)]",
    ring: "ring-[var(--color-primary-500)]",
    label: "Зелений",
  },
  blue: {
    swatch: "bg-[#3B82F6]",
    ring: "ring-[#3B82F6]",
    label: "Синій",
  },
  amber: {
    swatch: "bg-[#D97706]",
    ring: "ring-[#D97706]",
    label: "Бурштиновий",
  },
  rose: {
    swatch: "bg-[#E11D48]",
    ring: "ring-[#E11D48]",
    label: "Рожевий",
  },
  slate: {
    swatch: "bg-[#64748B]",
    ring: "ring-[#64748B]",
    label: "Сірий",
  },
};
