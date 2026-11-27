export const EGO_BACKUP_APP = "EGO Personal AI" as const;
export const EGO_BACKUP_VERSION = "1.0" as const;

export const BACKUP_COLLECTIONS = [
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

export type BackupCollection = (typeof BACKUP_COLLECTIONS)[number];

export interface EgoBackupPreview {
  exportedAt: string;
  ownerEmail: string | null;
  counts: Record<BackupCollection, number>;
  duplicateIds: string[];
  existingIdConflicts: Record<BackupCollection, number>;
  totalRecords: number;
  data: Record<string, unknown[]>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validates an EGO JSON backup without mutating any data.
 * Restore must still be performed by an atomic, owner-authorized backend operation.
 */
export function parseEgoBackupPreview(
  raw: string,
  currentData?: Partial<Record<BackupCollection, unknown[]>>,
  currentOwnerEmail?: string | null
): EgoBackupPreview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("File cadangan bukan JSON yang valid.");
  }

  if (!isRecord(parsed) || parsed.app !== EGO_BACKUP_APP) {
    throw new Error("File bukan cadangan resmi EGO Personal AI.");
  }
  if (parsed.version !== EGO_BACKUP_VERSION) {
    throw new Error("Versi cadangan tidak didukung. Tidak ada data yang diubah.");
  }
  if (
    typeof parsed.exported_at !== "string" ||
    !Number.isFinite(Date.parse(parsed.exported_at))
  ) {
    throw new Error("Waktu ekspor cadangan tidak valid.");
  }
  if (parsed.owner_email !== null && typeof parsed.owner_email !== "string") {
    throw new Error("Identitas Owner pada cadangan tidak valid.");
  }
  if (
    currentOwnerEmail &&
    typeof parsed.owner_email === "string" &&
    parsed.owner_email.toLowerCase() !== currentOwnerEmail.toLowerCase()
  ) {
    throw new Error("Cadangan berasal dari akun Owner yang berbeda.");
  }
  if (!isRecord(parsed.data)) {
    throw new Error("Bagian data cadangan tidak valid.");
  }

  const data: Record<string, unknown[]> = {};
  const counts = {} as Record<BackupCollection, number>;
  const existingIdConflicts = {} as Record<BackupCollection, number>;
  const duplicateIds: string[] = [];
  let totalRecords = 0;

  for (const collection of BACKUP_COLLECTIONS) {
    const rows = parsed.data[collection];
    if (!Array.isArray(rows)) {
      throw new Error(`Bagian "${collection}" hilang atau bukan daftar data.`);
    }
    const seen = new Set<string>();
    const existingIds = new Set(
      (currentData?.[collection] ?? [])
        .filter(isRecord)
        .map((row) => row.id)
        .filter((id): id is string => typeof id === "string")
    );
    let conflicts = 0;

    for (const [index, row] of rows.entries()) {
      if (!isRecord(row)) {
        throw new Error(`Baris ${index + 1} pada "${collection}" tidak valid.`);
      }
      if (typeof row.id !== "string" || row.id.trim().length === 0) {
        throw new Error(`ID baris ${index + 1} pada "${collection}" tidak valid.`);
      }
      if (seen.has(row.id)) duplicateIds.push(`${collection}:${row.id}`);
      seen.add(row.id);
      if (existingIds.has(row.id)) conflicts += 1;
    }

    data[collection] = rows;
    counts[collection] = rows.length;
    existingIdConflicts[collection] = conflicts;
    totalRecords += rows.length;
  }

  if (duplicateIds.length > 0) {
    throw new Error(
      `Cadangan mengandung ID ganda (${duplicateIds.length}). Pemulihan dibatalkan sebelum penulisan.`
    );
  }

  return {
    exportedAt: parsed.exported_at,
    ownerEmail: parsed.owner_email as string | null,
    counts,
    duplicateIds,
    existingIdConflicts,
    totalRecords,
    data,
  };
}
