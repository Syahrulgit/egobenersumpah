import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadVault, validateSessionToken } from "./vaultStore";

let cachedSupabaseVerifier: SupabaseClient | null | undefined;

function normalizeSupabaseUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url || url.startsWith("MY_")) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function getSupabaseCredentials(): { url: string; key: string } | null {
  const url = normalizeSupabaseUrl(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ""
  );
  const key = (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();

  if (!url || !key || key === "Xzx1@2@3xzX" || key.startsWith("MY_")) {
    return null;
  }
  return { url, key };
}

export function isServerSupabaseConfigured(): boolean {
  return getSupabaseCredentials() !== null;
}

function getSupabaseVerifier(): SupabaseClient | null {
  if (cachedSupabaseVerifier !== undefined) {
    return cachedSupabaseVerifier;
  }
  const creds = getSupabaseCredentials();
  if (!creds) {
    cachedSupabaseVerifier = null;
    return null;
  }

  cachedSupabaseVerifier = createClient(creds.url, creds.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedSupabaseVerifier;
}

export function createAuthedSupabaseClient(token: string): SupabaseClient | null {
  const cleanToken = token.trim();
  if (!cleanToken) return null;
  const creds = getSupabaseCredentials();
  if (!creds) return null;

  return createClient(creds.url, creds.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
      },
    },
  });
}

export async function verifyOwnerToken(
  token: string | undefined
): Promise<{ ownerId: string; mode: "supabase" | "local" } | null> {
  if (!token) return null;

  const supabaseVerifier = getSupabaseVerifier();
  if (supabaseVerifier) {
    try {
      const { data, error } = await supabaseVerifier.auth.getUser(token);
      if (!error && data.user?.id) {
        return { ownerId: data.user.id, mode: "supabase" };
      }
    } catch {
      // Fall through to local check if token is a local session token
    }
  }

  const localOwnerId = validateSessionToken(token);
  const db = loadVault();
  if (localOwnerId && db.owner && db.owner.id === localOwnerId) {
    return { ownerId: localOwnerId, mode: "local" };
  }
  return null;
}
