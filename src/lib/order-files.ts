/** Internal limits for order attachments (artwork / documents). */
export const ORDER_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const ORDER_FILE_MAX_COUNT = 20;

export const ORDER_FILE_MAX_MB = ORDER_FILE_MAX_BYTES / (1024 * 1024);

export const ORDER_FILE_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.svg,.tif,.tiff,.ai,.eps,.zip";

export const ORDER_FILE_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
  "tif",
  "tiff",
  "ai",
  "eps",
  "zip",
]);

export function orderFileAllowed(file: { name: string; type: string }) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ORDER_FILE_EXTENSIONS.has(ext)) return true;
  return (
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    file.type === "application/zip" ||
    file.type === "application/postscript"
  );
}

export type ArtworkItemFacts = {
  id: string;
  decorationsCount: number;
};

export type ArtworkFileFacts = {
  orderItemId?: string | null;
};

/**
 * Artwork gate for production:
 * - no decorations → ok
 * - only unlinked files (legacy) → ok if any file exists
 * - otherwise every decorated line needs ≥1 file linked to it
 */
export function orderArtworkReady(
  items: ArtworkItemFacts[],
  files: ArtworkFileFacts[],
): boolean {
  const decorated = items.filter((item) => item.decorationsCount > 0);
  if (decorated.length === 0) return true;
  if (files.length === 0) return false;

  const linked = files.filter((file) => file.orderItemId);
  const unlinked = files.filter((file) => !file.orderItemId);
  if (linked.length === 0 && unlinked.length > 0) return true;

  return decorated.every((item) =>
    files.some((file) => file.orderItemId === item.id),
  );
}

export function itemNeedsArtworkFile(
  item: ArtworkItemFacts,
  files: ArtworkFileFacts[],
): boolean {
  if (item.decorationsCount <= 0) return false;
  if (files.some((file) => file.orderItemId === item.id)) return false;
  // Legacy unlinked files cover the whole order.
  const hasLinked = files.some((file) => file.orderItemId);
  if (!hasLinked && files.length > 0) return false;
  return true;
}
