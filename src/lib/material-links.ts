/** Normalize pasted URLs for storage + clickable display. */

export function normalizeMaterialUrl(raw: string): string | null {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parseMaterialUrlsJson(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const normalized = normalizeMaterialUrl(item);
      if (normalized && !out.includes(normalized)) out.push(normalized);
    }
    return out;
  } catch {
    return [];
  }
}

export function materialLinkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return host || url;
  } catch {
    return url;
  }
}
