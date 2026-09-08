/**
 * Trim / fabric color helpers for catalog + order specs.
 * Prefer MaterialSupplier.availableColors (per supplier); Material.availableColors is legacy fallback.
 */

export type SpecSwatch = {
  label: string;
  swatch: string;
  bordered?: boolean;
};

/** Canonical labels + swatches used in order UI. */
export const TRIM_COLOR_SWATCHES: SpecSwatch[] = [
  { label: "Чорний", swatch: "#1C1C1C" },
  { label: "Білий", swatch: "#F7F7F5", bordered: true },
  { label: "Navy", swatch: "#1B3A5C" },
  { label: "Сірий", swatch: "#6B7280" },
  { label: "Меланж", swatch: "#A8AEB6", bordered: true },
  { label: "Бежевий", swatch: "#D4C4A8", bordered: true },
  { label: "Хакі", swatch: "#6B6E3F" },
  { label: "Червоний", swatch: "#B42318" },
  { label: "Бордо", swatch: "#6E1F2A" },
  { label: "Синій", swatch: "#2563EB" },
  { label: "Зелений", swatch: "#2F6B4F" },
  { label: "Коричневий", swatch: "#6B4423" },
  { label: "Нікель", swatch: "#C0C5CE", bordered: true },
  { label: "Срібло", swatch: "#D8DCE3", bordered: true },
  { label: "Прозорий", swatch: "#E8F4FC", bordered: true },
];

const COLOR_ALIASES: Record<string, string> = {
  чорний: "Чорний",
  чорна: "Чорний",
  чорне: "Чорний",
  чорні: "Чорний",
  black: "Чорний",
  білий: "Білий",
  біла: "Білий",
  біле: "Білий",
  білі: "Білий",
  white: "Білий",
  navy: "Navy",
  нейві: "Navy",
  сірий: "Сірий",
  сіра: "Сірий",
  сіре: "Сірий",
  gray: "Сірий",
  grey: "Сірий",
  меланж: "Меланж",
  бежевий: "Бежевий",
  бежева: "Бежевий",
  хакі: "Хакі",
  khaki: "Хакі",
  червоний: "Червоний",
  червона: "Червоний",
  бордо: "Бордо",
  синій: "Синій",
  синя: "Синій",
  зелений: "Зелений",
  зелена: "Зелений",
  коричневий: "Коричневий",
  коричнева: "Коричневий",
  нікель: "Нікель",
  nickel: "Нікель",
  срібло: "Срібло",
  срібний: "Срібло",
  срібла: "Срібло",
  silver: "Срібло",
  прозорий: "Прозорий",
  прозора: "Прозорий",
  transparent: "Прозорий",
};

export function normalizeColorLabel(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed === "-" || trimmed === "х" || trimmed === "x") return null;
  const alias = COLOR_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  // Title-case Ukrainian / Latin free text
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Split CSV cells like «біла/чорна», «чорний, білий». */
export function splitColorLabels(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const parts = raw
    .split(/[/|,;]+/)
    .map((part) => normalizeColorLabel(part))
    .filter((part): part is string => Boolean(part));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out;
}

export function mergeColorLists(...lists: Array<string[] | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list ?? []) {
      const label = normalizeColorLabel(raw);
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(label);
    }
  }
  return out;
}

export function swatchForColorLabel(label: string): SpecSwatch {
  const canonical = normalizeColorLabel(label) ?? label;
  const known = TRIM_COLOR_SWATCHES.find(
    (row) => row.label.toLowerCase() === canonical.toLowerCase(),
  );
  if (known) return { ...known, label: canonical };
  // Stable pastel from label hash for unknown custom colors
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) hash = (hash * 31 + canonical.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return {
    label: canonical,
    swatch: `hsl(${hue} 28% 62%)`,
    bordered: true,
  };
}

/** Detect trailing color token in a joined catalog name. */
export function extractTrailingColorFromName(nameUk: string): {
  baseName: string;
  color: string | null;
} {
  const parts = nameUk
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return { baseName: nameUk.trim(), color: null };
  const last = parts[parts.length - 1]!;
  // Skip size-like tokens
  if (/^\d/.test(last) || /см|мм|мп|yd|мкр/i.test(last)) {
    return { baseName: nameUk.trim(), color: null };
  }
  const colors = splitColorLabels(last);
  if (colors.length === 0) return { baseName: nameUk.trim(), color: null };
  // Only treat as color if alias matched or looks like a color word
  const rawLower = last.toLowerCase();
  const isKnown =
    Boolean(COLOR_ALIASES[rawLower]) ||
    rawLower.includes("/") ||
    TRIM_COLOR_SWATCHES.some((row) => row.label.toLowerCase() === colors[0]!.toLowerCase());
  if (!isKnown && !/нікель|срібл|прозор|чорн|біл|синь|зелен|беж|хакі|navy|melange/i.test(last)) {
    return { baseName: nameUk.trim(), color: null };
  }
  return {
    baseName: parts.slice(0, -1).join(" · "),
    color: colors.length === 1 ? colors[0]! : null,
  };
}

/** When last segment is «біла/чорна», return all colors and base without that segment. */
export function peelColorsFromJoinedName(nameUk: string): {
  baseName: string;
  colors: string[];
} {
  const parts = nameUk
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return { baseName: nameUk.trim(), colors: [] };
  const last = parts[parts.length - 1]!;
  const colors = splitColorLabels(last);
  if (colors.length === 0) return { baseName: nameUk.trim(), colors: [] };
  const rawLower = last.toLowerCase();
  const looksLikeColor =
    colors.length > 1 ||
    Boolean(COLOR_ALIASES[rawLower]) ||
    /нікель|срібл|прозор|чорн|біл|синь|зелен|беж|хакі|navy|melange/i.test(last);
  if (!looksLikeColor) return { baseName: nameUk.trim(), colors: [] };
  return { baseName: parts.slice(0, -1).join(" · "), colors };
}
