/**
 * Color palettes live on MaterialSupplier offers.
 * Material.availableColors is a legacy fallback when an offer has no palette.
 */

import { mergeColorLists, normalizeColorLabel } from "@/lib/trim-colors";

export type SupplierColorOffer = {
  supplierId: string;
  isPrimary?: boolean;
  availableColors?: string[] | null;
};

export function colorsForSupplier(
  offers: SupplierColorOffer[],
  supplierId: string | null | undefined,
  materialFallback: string[] | null | undefined = [],
): string[] {
  if (supplierId) {
    const offer = offers.find((row) => row.supplierId === supplierId);
    if (offer) {
      const palette = mergeColorLists(offer.availableColors ?? []);
      if (palette.length > 0) return palette;
    }
  }
  const primary = offers.find((row) => row.isPrimary) ?? offers[0];
  if (primary) {
    const palette = mergeColorLists(primary.availableColors ?? []);
    if (palette.length > 0) return palette;
  }
  return mergeColorLists(materialFallback ?? []);
}

export function colorAllowedInPalette(
  color: string | null | undefined,
  palette: string[],
): boolean {
  const normalized = normalizeColorLabel(color);
  if (!normalized) return false;
  return palette.some((row) => normalizeColorLabel(row) === normalized);
}

/** Keep color if still valid; else first palette color; else null. */
export function reconcileColorForSupplier(input: {
  color: string | null | undefined;
  supplierId: string | null | undefined;
  offers: SupplierColorOffer[];
  materialFallback?: string[] | null;
}): string | null {
  const palette = colorsForSupplier(
    input.offers,
    input.supplierId,
    input.materialFallback,
  );
  if (colorAllowedInPalette(input.color, palette)) {
    return normalizeColorLabel(input.color);
  }
  return palette[0] ?? null;
}

export function defaultSupplierId(offers: SupplierColorOffer[]): string | null {
  return offers.find((row) => row.isPrimary)?.supplierId ?? offers[0]?.supplierId ?? null;
}
