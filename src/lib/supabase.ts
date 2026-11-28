import { createClient, type SupabaseClient, type Subscription } from "@supabase/supabase-js";
import {
  initRecoveryStateFromLocation,
  setPasswordRecoveryActive,
} from "./auth-recovery";

export interface PublicSupabaseConfigResponse {
  supabaseConfigured?: boolean;
  url?: string | null;
  publishableKey?: string | null;
}

const rawViteUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const rawViteKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ??
  "";

function normalizeSupabaseUrl(value: string | null | undefined): string | null {
  const clean = (value ?? "").trim();
  if (!clean || clean.startsWith("MY_")) return null;
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function isPublicSupabaseKey(value: string | null | undefined): boolean {
  const key = (value ?? "").trim();
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
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = atob(base64);
      const payload = JSON.parse(json) as { role?: unknown };
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

function resolveViteFallbackConfig(): { url: string; key: string } | null {
  const cleanUrl = normalizeSupabaseUrl(rawViteUrl);
  if (!cleanUrl || !isPublicSupabaseKey(rawViteKey)) {
    return null;
  }
  return { url: cleanUrl, key: rawViteKey };
}

let activeConfig: { url: string; key: string } | null = null;
let recoverySubscription: Subscription | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;
const changeListeners = new Set<() => void>();

function notifySupabaseChange(): void {
  for (const listener of changeListeners) {
    try {
      listener();
    } catch {
      // Ignore subscriber error
    }
  }
}

function attachRecoveryListener(client: SupabaseClient): void {
  if (recoverySubscription) {
    recoverySubscription.unsubscribe();
    recoverySubscription = null;
  }
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      setPasswordRecoveryActive(true);
    } else if (event === "SIGNED_OUT") {
      setPasswordRecoveryActive(false);
    }
  });
  recoverySubscription = subscription;
}

function buildSupabaseClient(url: string, key: string): SupabaseClient | null {
  try {
    const client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    attachRecoveryListener(client);
    return client;
  } catch {
    return null;
  }
}

// Capture recovery intent from URL hash/query before createClient processes & clears URL tokens.
initRecoveryStateFromLocation();

const initialFallback = resolveViteFallbackConfig();
export let supabase: SupabaseClient | null = initialFallback
  ? buildSupabaseClient(initialFallback.url, initialFallback.key)
  : null;
if (supabase && initialFallback) {
  activeConfig = initialFallback;
}
export let isSupabaseConfigured: boolean = supabase !== null;

function applyResolvedConfig(url: string, key: string): SupabaseClient | null {
  if (
    activeConfig &&
    activeConfig.url === url &&
    activeConfig.key === key &&
    supabase !== null
  ) {
    return supabase;
  }
  const nextClient = buildSupabaseClient(url, key);
  if (!nextClient) {
    return supabase;
  }
  supabase = nextClient;
  isSupabaseConfigured = true;
  activeConfig = { url, key };
  notifySupabaseChange();
  return supabase;
}

export async function initializeSupabase(): Promise<SupabaseClient | null> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    if (typeof window === "undefined" || typeof fetch !== "function") {
      return supabase;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch("/api/public-config", {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (response.ok) {
        const data = (await response.json()) as PublicSupabaseConfigResponse;
        const cleanUrl = normalizeSupabaseUrl(data.url);
        const cleanKey = (data.publishableKey ?? "").trim();

        if (data.supabaseConfigured && cleanUrl && isPublicSupabaseKey(cleanKey)) {
          return applyResolvedConfig(cleanUrl, cleanKey);
        }
      }
    } catch {
      // Endpoint unavailable or timed out: retain Vite environment fallback.
    } finally {
      window.clearTimeout(timeoutId);
    }

    const fallback = resolveViteFallbackConfig();
    if (fallback && !supabase) {
      return applyResolvedConfig(fallback.url, fallback.key);
    }
    return supabase;
  })();

  return initPromise;
}

export function subscribeSupabaseChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}
