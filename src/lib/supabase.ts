import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const rawKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ??
  "";

function normalizeSupabaseUrl(value: string): string | null {
  if (!value || value.startsWith("MY_")) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function createSafeSupabaseClient(): SupabaseClient | null {
  const cleanUrl = normalizeSupabaseUrl(rawUrl);
  if (
    !cleanUrl ||
    !rawKey ||
    rawKey === "Xzx1@2@3xzX" ||
    rawKey.startsWith("MY_")
  ) {
    return null;
  }
  try {
    return createClient(cleanUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch {
    return null;
  }
}

export const supabase: SupabaseClient | null = createSafeSupabaseClient();
export const isSupabaseConfigured = supabase !== null;
