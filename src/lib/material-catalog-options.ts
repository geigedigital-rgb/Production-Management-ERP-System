/** Names for material dropdowns / table cells (offers first, then legacy supplierCode). */
export function materialSupplierNames(input: {
  supplierCode?: string | null;
  supplierOffers?: Array<{
    supplier?: { nameUk?: string | null } | null;
    supplierName?: string | null;
  } | null> | null;
}): string[] {
  const fromOffers = (input.supplierOffers ?? [])
    .map((offer) => {
      const name =
        offer?.supplier?.nameUk?.replace(/\s+/g, " ").trim() ||
        offer?.supplierName?.replace(/\s+/g, " ").trim() ||
        "";
      return name;
    })
    .filter(Boolean);
  if (fromOffers.length > 0) return [...new Set(fromOffers)];
  const legacy = input.supplierCode?.replace(/\s+/g, " ").trim();
  return legacy ? [legacy] : [];
}

/** Secondary line for material Select options: density · composition · suppliers. */
export function materialOptionDescription(
  densityGsm?: string | null,
  composition?: string | null,
  suppliers?: string | string[] | null,
): string | undefined {
  const supplierPart = Array.isArray(suppliers)
    ? suppliers
        .map((name) => name.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" · ")
    : suppliers?.replace(/\s+/g, " ").trim() || "";
  const parts = [
    densityGsm?.trim() ? `${densityGsm.trim()} г/м²` : null,
    composition?.trim() || null,
    supplierPart || null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}
