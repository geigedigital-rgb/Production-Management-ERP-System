/** Secondary line for material Select options: density · composition. */
export function materialOptionDescription(
  densityGsm?: string | null,
  composition?: string | null,
): string | undefined {
  const parts = [
    densityGsm?.trim() ? `${densityGsm.trim()} г/м²` : null,
    composition?.trim() || null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}
