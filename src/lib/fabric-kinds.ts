/** Canonical «Тип тканини» labels from CRM fabric catalog. */
export const FABRIC_KINDS = ["Трикотаж", "Саржеві", "Плащовка"] as const;

export type FabricKind = (typeof FABRIC_KINDS)[number];

export const FABRIC_KIND_OTHER = "__other__";

/** Normalize CSV / free-text values to a canonical label when possible. */
export function normalizeFabricKind(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("трикотаж")) return "Трикотаж";
  if (lower.startsWith("сарж")) return "Саржеві";
  if (lower.startsWith("плащов") || lower.startsWith("плащів")) return "Плащовка";

  return trimmed;
}
