import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase URL or anon key is not configured");
  }

  return createClient(url, key);
}

export const UPLOADS_BUCKET = "uploads";

export function publicUploadUrl(storageKey: string) {
  const supabase = getSupabaseAdmin();
  return supabase.storage.from(UPLOADS_BUCKET).getPublicUrl(storageKey).data.publicUrl;
}
