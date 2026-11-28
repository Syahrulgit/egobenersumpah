import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
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

export function isPublicSupabaseKey(rawKey: string): boolean {
  const key = rawKey.trim();
  if (!key || key === "Xzx1@2@3xzX" || key.startsWith("MY_")) {
    return false;
  }
  if (key.startsWith("sb_secret_") || key.toLowerCase().includes("service_role")) {
    return false;
  }
  if (key.startsWith("sb_publishable_")) {
    return key.length >= 24;
  }
  const parts = key.split(".");
  if (parts.length === 3 && parts.every((part) => part.length > 0)) {
    try {
      const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
      const payload = JSON.parse(payloadJson) as { role?: unknown };
      if (!payload || typeof payload !== "object") {
        return false;
      }
      if (payload.role === "service_role") {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function readDotEnvSupabaseFallback(): { url?: string; key?: string } {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) return {};
    const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
    const url = normalizeSupabaseUrl(
      parsed.VITE_SUPABASE_URL || parsed.SUPABASE_URL || ""
    ) ?? undefined;
    const key = [
      parsed.VITE_SUPABASE_PUBLISHABLE_KEY,
      parsed.SUPABASE_PUBLISHABLE_KEY,
      parsed.VITE_SUPABASE_ANON_KEY,
      parsed.SUPABASE_ANON_KEY,
    ]
      .map((val) => (val ?? "").trim())
      .find((val) => isPublicSupabaseKey(val));
    return { url, key };
  } catch {
    return {};
  }
}

function getSupabaseCredentials(): { url: string; key: string } | null {
  const envUrl = normalizeSupabaseUrl(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ""
  );
  const candidates = [
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    process.env.SUPABASE_ANON_KEY,
  ];
  const envKey =
    candidates
      .map((val) => (val ?? "").trim())
      .find((val) => isPublicSupabaseKey(val)) ?? "";

  if (envUrl && envKey) {
    return { url: envUrl, key: envKey };
  }

  const dotEnvFallback = readDotEnvSupabaseFallback();
  const finalUrl = envUrl || dotEnvFallback.url || null;
  const finalKey = envKey || dotEnvFallback.key || "";

  if (!finalUrl || !finalKey) {
    return null;
  }
  return { url: finalUrl, key: finalKey };
}

export interface PublicSupabaseConfig {
  supabaseConfigured: boolean;
  url: string | null;
  publishableKey: string | null;
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const creds = getSupabaseCredentials();
  if (!creds) {
    return {
      supabaseConfigured: false,
      url: null,
      publishableKey: null,
    };
  }
  return {
    supabaseConfigured: true,
    url: creds.url,
    publishableKey: creds.key,
  };
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
