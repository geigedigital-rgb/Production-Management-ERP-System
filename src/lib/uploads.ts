import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "heic", "heif"]);
const SUPABASE_UPLOAD_TIMEOUT_MS = 8_000;

export function isImageUpload(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXT.has(ext);
}

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName) return fromName;
  const fromType = file.type.split("/")[1]?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return fromType || "jpg";
}

async function uploadToLocal(folder: string, file: File, buffer: Buffer): Promise<string> {
  const ext = extensionFor(file);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const relativeDir = path.join("uploads", folder);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, fileName), buffer);
  return `/${relativeDir.replaceAll("\\", "/")}/${fileName}`;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function trySupabaseUpload(
  storageKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<string | null> {
  // Anon key usually cannot write to Storage (RLS). Skip unless service role is set.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const { getSupabaseAdmin, UPLOADS_BUCKET } = await import("@/lib/supabase/client");
  const supabase = getSupabaseAdmin();
  const uploadResult = await withTimeout(
    supabase.storage.from(UPLOADS_BUCKET).upload(storageKey, buffer, {
      contentType,
      upsert: false,
    }),
    SUPABASE_UPLOAD_TIMEOUT_MS,
    "Supabase upload",
  );
  if (uploadResult.error) {
    console.warn("[upload] supabase product image failed:", uploadResult.error.message);
    return null;
  }
  const { data } = supabase.storage.from(UPLOADS_BUCKET).getPublicUrl(storageKey);
  return data.publicUrl || null;
}

/**
 * Store an image for product cards / create flow.
 * Uses Supabase when SUPABASE_SERVICE_ROLE_KEY is set; otherwise local public/uploads.
 */
export async function storeProductImage(file: File): Promise<
  { ok: true; url: string } | { ok: false; error: "UPLOAD"; message: string }
> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extensionFor(file);
  const storageKey = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const contentType = file.type.startsWith("image/")
    ? file.type
    : `image/${ext === "jpg" ? "jpeg" : ext}`;

  try {
    const remoteUrl = await trySupabaseUpload(storageKey, buffer, contentType);
    if (remoteUrl) return { ok: true, url: remoteUrl };
  } catch (error) {
    console.warn(
      "[upload] supabase unavailable, using local uploads:",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    const url = await uploadToLocal("products", file, buffer);
    return { ok: true, url };
  } catch (error) {
    return {
      ok: false,
      error: "UPLOAD",
      message: error instanceof Error ? error.message : "Local upload failed",
    };
  }
}
