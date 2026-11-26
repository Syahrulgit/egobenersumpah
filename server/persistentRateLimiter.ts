import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { withFileLock } from "./fileLock";
import type { LoginRateCheckResult, LoginRateLimiter } from "./vaultRules";

const DATA_DIR = path.resolve(process.cwd(), "data");


interface RateLimitEntry {
  count: number;
  windowStart: number;
}
type RateLimitStore = Record<string, RateLimitEntry>;

function storageKey(namespace: string, key: string): string {
  return crypto.createHash("sha256").update(`${namespace}\0${key}`, "utf8").digest("hex");
}

function readStore(rateLimitFile: string): RateLimitStore {
  let raw: string;
  try {
    raw = fs.readFileSync(rateLimitFile, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error("Penyimpanan pembatas percobaan tidak dapat dibaca. Login ditahan demi keamanan.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Penyimpanan pembatas percobaan rusak. Login ditahan demi keamanan.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Struktur pembatas percobaan tidak valid. Login ditahan demi keamanan.");
  }
  const store: RateLimitStore = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (
      !/^[0-9a-f]{64}$/.test(key) ||
      !value ||
      typeof value !== "object" ||
      !Number.isSafeInteger((value as RateLimitEntry).count) ||
      (value as RateLimitEntry).count < 1 ||
      !Number.isFinite((value as RateLimitEntry).windowStart)
    ) {
      throw new Error("Data pembatas percobaan tidak valid. Login ditahan demi keamanan.");
    }
    store[key] = value as RateLimitEntry;
  }
  return store;
}

function writeStore(rateLimitFile: string, store: RateLimitStore): void {
  fs.mkdirSync(path.dirname(rateLimitFile), { recursive: true, mode: 0o700 });
  const tmp = `${rateLimitFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(store), { encoding: "utf8", mode: 0o600, flag: "wx" });
    fs.renameSync(tmp, rateLimitFile);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

function evaluate(entry: RateLimitEntry | undefined, maxAttempts: number, windowMs: number, nowMs: number): LoginRateCheckResult {
  if (!entry || nowMs - entry.windowStart >= windowMs) {
    return { allowed: true, remainingAttempts: maxAttempts, retryAfterSeconds: 0 };
  }
  if (entry.count < maxAttempts) {
    return { allowed: true, remainingAttempts: maxAttempts - entry.count, retryAfterSeconds: 0 };
  }
  const retryAfterSeconds = Math.max(1, Math.ceil((entry.windowStart + windowMs - nowMs) / 1000));
  const waitMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return {
    allowed: false,
    remainingAttempts: 0,
    retryAfterSeconds,
    message: `Terlalu banyak percobaan gagal. Demi keamanan brankas, silakan tunggu sekitar ${waitMinutes} menit sebelum mencoba lagi.`,
  };
}

/**
 * Persistent local limiter. It survives process restarts and coordinates
 * processes sharing the same disk. For multi-host deployments use a shared
 * database-backed limiter instead of ephemeral container storage.
 */
export function createPersistentLoginRateLimiter(
  namespace: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000,
  storageDir = DATA_DIR
): LoginRateLimiter {
  const rateLimitFile = path.join(storageDir, "ego-rate-limits.json");
  const rateLimitLock = path.join(storageDir, "ego-rate-limits.lock");
  if (!/^[a-z-]{1,24}$/.test(namespace)) throw new Error("Namespace rate limit tidak valid.");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || !Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error("Konfigurasi rate limit tidak valid.");
  }

  return {
    check(key: string, nowMs = Date.now()): LoginRateCheckResult {
      const store = readStore(rateLimitFile);
      return evaluate(store[storageKey(namespace, key)], maxAttempts, windowMs, nowMs);
    },

    recordFailure(key: string, nowMs = Date.now()): LoginRateCheckResult {
      return withFileLock(rateLimitLock, () => {
        const store = readStore(rateLimitFile);
        for (const [hash, entry] of Object.entries(store)) {
          if (nowMs - entry.windowStart >= windowMs) delete store[hash];
        }
        const hash = storageKey(namespace, key);
        const existing = store[hash];
        store[hash] = existing
          ? { count: existing.count + 1, windowStart: existing.windowStart }
          : { count: 1, windowStart: nowMs };
        writeStore(rateLimitFile, store);
        return evaluate(store[hash], maxAttempts, windowMs, nowMs);
      });
    },

    reset(key: string): void {
      withFileLock(rateLimitLock, () => {
        const store = readStore(rateLimitFile);
        delete store[storageKey(namespace, key)];
        writeStore(rateLimitFile, store);
      });
    },
  };
}
