/** Prefix for demo/seed records so they are easy to spot next to real CRM catalog. */
export const TEST_MARKER = "[ТЕСТ]";

export function withTestMarker(name: string) {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (!trimmed) return TEST_MARKER;
  if (trimmed.startsWith(TEST_MARKER)) return trimmed;
  return `${TEST_MARKER} ${trimmed}`;
}

export function withoutTestMarker(name: string) {
  return name.replace(/^\[ТЕСТ\]\s*/u, "").trim();
}

export function testNameVariants(name: string) {
  const base = withoutTestMarker(name);
  const marked = withTestMarker(base);
  return [...new Set([base, marked, name.trim()].filter(Boolean))];
}
