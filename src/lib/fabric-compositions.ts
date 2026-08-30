/** Canonical fabric composition labels for select + CSV seed. */
export const FABRIC_COMPOSITIONS = [
  "100% бавовна",
  "100% поліестер",
  "20% бавовна 80% поліестер",
  "35% бавовна 65% поліестер",
  "65% бавовна 35% поліестер",
  "70% бавовна/30%пе",
  "71% пе 24% віскоза 5%еластан",
  "95% бавовна/5% еластан",
  "57% бавовна 40% поліестер 3% еластан",
  "62% пе 35%віскоза 3%еластан",
  "95% пе 5 еластан",
] as const;

export const COMPOSITION_OTHER = "__other__";

export function normalizeComposition(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.replace(/\s+/g, " ").trim();
  return trimmed || null;
}
