import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  createEmptyVault,
  type VaultDatabase,
} from "./vaultRules";

const DATA_DIR = path.resolve(process.cwd(), "data");
const VAULT_FILE = path.join(DATA_DIR, "ego-vault.json");

const VAULT_COLLECTIONS = [
  "accounts",
  "transactions",
  "assets",
  "debts",
  "debt_payment_logs",
  "owner_commands",
  "recurring_bills",
  "savings_goals",
  "financial_reminders",
  "financial_reminder_logs",
  "category_budgets",
  "budget_alert_logs",
  "whatif_scenarios",
  "financial_health_scores",
] as const;

export class VaultReadError extends Error {
  constructor(message = "Brankas EGO tidak dapat dibaca. Data tidak diubah; pulihkan file cadangan atau periksa file brankas.") {
    super(message);
    this.name = "VaultReadError";
  }
}

/** Parse and validate the persisted vault without silently replacing damaged data. */
export function parseVaultContent(raw: string): VaultDatabase {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new VaultReadError("File brankas EGO rusak atau bukan JSON yang valid. Data tidak diubah.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new VaultReadError("Struktur file brankas EGO tidak valid. Data tidak diubah.");
  }

  const candidate = parsed as Record<string, unknown>;
  if (candidate.owner !== undefined &&
      candidate.owner !== null &&
      (typeof candidate.owner !== "object" || Array.isArray(candidate.owner))) {
    throw new VaultReadError("Data Owner di dalam brankas tidak valid. Data tidak diubah.");
  }
  if (candidate.preferences !== undefined &&
      (!candidate.preferences || typeof candidate.preferences !== "object" || Array.isArray(candidate.preferences))) {
    throw new VaultReadError("Pengaturan brankas EGO tidak valid. Data tidak diubah.");
  }
  for (const key of VAULT_COLLECTIONS) {
    if (candidate[key] !== undefined && !Array.isArray(candidate[key])) {
      throw new VaultReadError(`Bagian ${key} di dalam brankas tidak valid. Data tidak diubah.`);
    }
  }

  const empty = createEmptyVault();
  return {
    ...empty,
    ...candidate,
    preferences: {
      ...empty.preferences,
      ...((candidate.preferences ?? {}) as Partial<VaultDatabase["preferences"]>),
    },
  } as VaultDatabase;
}

export function loadVault(): VaultDatabase {
  if (!fs.existsSync(VAULT_FILE)) {
    return createEmptyVault();
  }
  try {
    return parseVaultContent(fs.readFileSync(VAULT_FILE, "utf8"));
  } catch (error) {
    if (error instanceof VaultReadError) throw error;
    throw new VaultReadError();
  }
}

function writePrivateJsonFile(filePath: string, value: unknown): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
  const tmpFile = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(value, null, 2), {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    fs.renameSync(tmpFile, filePath);
  } catch (error) {
    try {
      fs.rmSync(tmpFile, { force: true });
    } catch {
      // Preserve the original write error.
    }
    throw error;
  }
}

export function saveVault(db: VaultDatabase): void {
  writePrivateJsonFile(VAULT_FILE, db);
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

// Session tokens are never written in plaintext after the first successful use.
// Legacy plaintext entries are upgraded in place to preserve active Owner sessions.
const SESSIONS_FILE = path.join(DATA_DIR, "ego-sessions.json");

interface SessionRecord {
  token_hash?: string;
  token?: string;
  owner_id: string;
  created_at: string;
}

export function parseSessionsContent(raw: string): SessionRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("File sesi EGO rusak. Login ditahan demi keamanan; file tidak dikosongkan.");
  }
  if (!Array.isArray(parsed) || parsed.some((item) =>
    !item ||
    typeof item !== "object" ||
    typeof item.owner_id !== "string" ||
    typeof item.created_at !== "string" ||
    (typeof item.token !== "string" && typeof item.token_hash !== "string")
  )) {
    throw new Error("Struktur file sesi EGO tidak valid. Login ditahan demi keamanan.");
  }
  return parsed as SessionRecord[];
}

function loadSessions(): SessionRecord[] {
  if (!fs.existsSync(SESSIONS_FILE)) return [];
  try {
    return parseSessionsContent(fs.readFileSync(SESSIONS_FILE, "utf8"));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("File sesi EGO")) throw error;
    if (error instanceof Error && error.message.startsWith("Struktur file sesi EGO")) throw error;
    throw new Error("File sesi EGO tidak dapat dibaca. Login ditahan demi keamanan; file tidak dikosongkan.");
  }
}

function saveSessions(sessions: SessionRecord[]): void {
  writePrivateJsonFile(SESSIONS_FILE, sessions);
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function matchesSessionToken(session: SessionRecord, token: string): boolean {
  if (session.token_hash) {
    const stored = Buffer.from(session.token_hash, "hex");
    const candidate = Buffer.from(hashSessionToken(token), "hex");
    return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
  }
  if (!session.token) return false;
  const stored = Buffer.from(session.token, "utf8");
  const candidate = Buffer.from(token, "utf8");
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}

function upgradeLegacySession(session: SessionRecord): SessionRecord {
  if (!session.token || session.token_hash) return session;
  return { owner_id: session.owner_id, created_at: session.created_at, token_hash: hashSessionToken(session.token) };
}

export function createSession(ownerId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const sessions = loadSessions();
  const otherOwners = sessions.filter((session) => session.owner_id !== ownerId);
  const ownerSessions = sessions.filter((session) => session.owner_id === ownerId).slice(-4);
  ownerSessions.push({
    token_hash: hashSessionToken(token),
    owner_id: ownerId,
    created_at: new Date().toISOString(),
  });
  saveSessions([...otherOwners, ...ownerSessions].map(upgradeLegacySession));
  return token;
}

export function validateSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const sessions = loadSessions();
  const found = sessions.find((session) => matchesSessionToken(session, token));
  if (!found) return null;

  if (found.token && !found.token_hash) {
    saveSessions(sessions.map((session) => session === found ? upgradeLegacySession(session) : session));
  }
  return found.owner_id;
}

export function revokeSessionToken(token: string | undefined): void {
  if (!token) return;
  const sessions = loadSessions().filter((session) => !matchesSessionToken(session, token));
  saveSessions(sessions.map(upgradeLegacySession));
}

export function rotateSessionsForOwner(ownerId: string, keepToken?: string): void {
  const sessions = loadSessions().filter(
    (session) => session.owner_id !== ownerId || (keepToken !== undefined && matchesSessionToken(session, keepToken))
  );
  saveSessions(sessions.map(upgradeLegacySession));
}

export function clearAllSessions(): void {
  saveSessions([]);
}
