import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  createEmptyVault,
  type VaultDatabase,
} from "./vaultRules";

const DATA_DIR = path.resolve(process.cwd(), "data");
const VAULT_FILE = path.join(DATA_DIR, "ego-vault.json");

export function loadVault(): VaultDatabase {
  if (!fs.existsSync(VAULT_FILE)) {
    return createEmptyVault();
  }
  try {
    const raw = fs.readFileSync(VAULT_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<VaultDatabase>;
    return {
      ...createEmptyVault(),
      ...parsed,
      preferences: {
        ...createEmptyVault().preferences,
        ...(parsed.preferences ?? {}),
      },
    };
  } catch {
    return createEmptyVault();
  }
}

export function saveVault(db: VaultDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${VAULT_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmpFile, VAULT_FILE);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHex] = storedHash.split(":");
  if (!salt || !originalHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, "hex");
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

// In-memory session map persisted in a lightweight sessions file so dev restarts keep sessions valid
const SESSIONS_FILE = path.join(DATA_DIR, "ego-sessions.json");

interface SessionRecord {
  token: string;
  owner_id: string;
  created_at: string;
}

function loadSessions(): SessionRecord[] {
  if (!fs.existsSync(SESSIONS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8")) as SessionRecord[];
  } catch {
    return [];
  }
}

function saveSessions(sessions: SessionRecord[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf8");
}

export function createSession(ownerId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const sessions = loadSessions().filter((s) => s.owner_id === ownerId).slice(-4);
  sessions.push({ token, owner_id: ownerId, created_at: new Date().toISOString() });
  saveSessions(sessions);
  return token;
}

export function validateSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const sessions = loadSessions();
  const found = sessions.find((s) => s.token === token);
  return found ? found.owner_id : null;
}

export function revokeSessionToken(token: string | undefined): void {
  if (!token) return;
  const sessions = loadSessions().filter((s) => s.token !== token);
  saveSessions(sessions);
}

export function rotateSessionsForOwner(ownerId: string, keepToken?: string): void {
  const sessions = loadSessions().filter(
    (s) => s.owner_id !== ownerId || (keepToken !== undefined && s.token === keepToken)
  );
  saveSessions(sessions);
}

export function clearAllSessions(): void {
  saveSessions([]);
}

