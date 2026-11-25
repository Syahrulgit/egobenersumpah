const PIN_LOCKED_STORAGE_KEY = "ego_pin_locked";
const PIN_AUTOLOCK_STORAGE_KEY = "ego_pin_autolock";
const PIN_SESSION_UNLOCKED_KEY = "ego_pin_unlocked_session";
const PIN_LOCK_CHANGE_EVENT = "ego-pin-lock-change";

function emitPinLockChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PIN_LOCK_CHANGE_EVENT));
  }
}

export function subscribePinLockChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PIN_LOCK_CHANGE_EVENT, listener);
  return () => window.removeEventListener(PIN_LOCK_CHANGE_EVENT, listener);
}

export function isPinLocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PIN_LOCKED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPinLocked(locked: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (locked) {
      window.localStorage.setItem(PIN_LOCKED_STORAGE_KEY, "1");
      window.sessionStorage.removeItem(PIN_SESSION_UNLOCKED_KEY);
    } else {
      window.localStorage.removeItem(PIN_LOCKED_STORAGE_KEY);
      window.sessionStorage.setItem(PIN_SESSION_UNLOCKED_KEY, "1");
    }
  } catch {
    // Ignore storage error
  }
  emitPinLockChange();
}

export function isAutoLockEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = window.localStorage.getItem(PIN_AUTOLOCK_STORAGE_KEY);
    return val !== "0";
  } catch {
    return true;
  }
}

export function setAutoLockEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PIN_AUTOLOCK_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Ignore storage error
  }
  emitPinLockChange();
}

export function isPinSessionUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PIN_SESSION_UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPinSessionUnlocked(): void {
  setPinLocked(false);
}

export function clearPinSessionState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PIN_LOCKED_STORAGE_KEY);
    window.sessionStorage.removeItem(PIN_SESSION_UNLOCKED_KEY);
  } catch {
    // Ignore storage error
  }
  emitPinLockChange();
}

export function shouldShowPinLockScreen(hasPin: boolean): boolean {
  if (!hasPin) return false;
  if (isPinLocked()) return true;
  if (isAutoLockEnabled() && !isPinSessionUnlocked()) return true;
  return false;
}

// WebCrypto PBKDF2-SHA256 helpers used for Supabase Cloud mode PIN verification
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function derivePinBits(pin: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function hashPinWebCrypto(pin: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const derivedHex = await derivePinBits(pin, salt);
  return `${bytesToHex(salt)}:${derivedHex}`;
}

export async function verifyPinWebCrypto(
  pin: string,
  storedHash: string
): Promise<boolean> {
  const [saltHex, expectedHex] = storedHash.split(":");
  if (!saltHex || !expectedHex) return false;
  const salt = hexToBytes(saltHex);
  const actualHex = await derivePinBits(pin, salt);
  if (actualHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) {
    diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}
