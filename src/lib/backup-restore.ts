import type { AccountType, DateFormatPref, OwnerPreferences } from "../types/ego";
import { toDatabaseAccountType } from "./account-types";

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
  preferences: OwnerPreferences | null;
  ownerMetadataMismatch: boolean;
  financialSummary: {
    postedIncome: number;
    postedExpenses: number;
    netCashflow: number;
    outstandingDebt: number;
    assetValue: number;
  };
}

export interface EgoRestorePayload {
  app: typeof EGO_BACKUP_APP;
  version: typeof EGO_BACKUP_VERSION;
  exported_at: string;
  owner_email: string;
  data: Record<string, unknown[]>;
}

/** Build the database payload from a validated preview; no existing row is changed. */
export function createEgoRestorePayload(preview: EgoBackupPreview): EgoRestorePayload {
  if (!preview.ownerEmail) {
    throw new Error("Cadangan tidak mencantumkan identitas Owner.");
  }
  const safeData = Object.fromEntries(
    BACKUP_COLLECTIONS.map((collection) => [
      collection,
      preview.data[collection].map((row) => {
        if (!isRecord(row)) {
          throw new Error(`Baris pada koleksi "${collection}" tidak valid.`);
        }
        const safeRow = Object.fromEntries(
          Object.entries(row).filter(([key]) =>
            key !== "owner_id" && !(collection === "accounts" && key === "current_balance")
          )
        );
        if (collection === "accounts") {
          if (typeof safeRow.account_type !== "string") {
            throw new Error("Jenis akun pada cadangan tidak valid.");
          }
          safeRow.account_type = toDatabaseAccountType(safeRow.account_type as AccountType);
        }
        return safeRow;
      }),
    ])
  ) as Record<string, unknown[]>;
  return {
    app: EGO_BACKUP_APP,
    version: EGO_BACKUP_VERSION,
    exported_at: preview.exportedAt,
    owner_email: preview.ownerEmail,
    data: safeData,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validates an EGO JSON backup without mutating any data.
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
  const ownerMetadataMismatch = Boolean(
    currentOwnerEmail &&
    typeof parsed.owner_email === "string" &&
    parsed.owner_email.toLowerCase() !== currentOwnerEmail.toLowerCase()
  );
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
      if (typeof row.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id)) {
        throw new Error(`ID baris ${index + 1} pada "${collection}" harus berupa UUID yang valid.`);
      }
      for (const field of ["amount", "opening_balance", "current_balance", "original_amount", "outstanding_balance", "current_value", "quantity", "interest_rate", "interest_rate_annual", "monthly_fee", "installment_amount", "principal_paid", "interest_paid", "remaining_after", "target_amount", "current_amount"]) {
        if (field in row && row[field] !== null && (typeof row[field] !== "number" || !Number.isFinite(row[field]) || row[field] < 0)) {
          throw new Error(`Nilai ${field} pada baris ${index + 1} koleksi "${collection}" tidak valid.`);
        }
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

  let preferences: OwnerPreferences | null = null;
  if (isRecord(parsed.data.preferences)) {
    const dateFormat = parsed.data.preferences.date_format;
    const expenseAlertLimit = parsed.data.preferences.expense_alert_limit;
    if (
      (dateFormat !== "DD/MM/YYYY" && dateFormat !== "YYYY-MM-DD" && dateFormat !== "DD MMM YYYY") ||
      typeof expenseAlertLimit !== "number" ||
      !Number.isFinite(expenseAlertLimit) ||
      expenseAlertLimit < 0 ||
      expenseAlertLimit > 100_000_000
    ) {
      throw new Error("Preferensi Owner pada cadangan tidak valid.");
    }
    preferences = {
      date_format: dateFormat as DateFormatPref,
      expense_alert_limit: expenseAlertLimit,
    };
  }

  const sum = (rows: unknown[], field: string, predicate?: (row: Record<string, unknown>) => boolean) =>
    rows.reduce<number>((total, value) => {
      if (!isRecord(value) || (predicate && !predicate(value))) return total;
      const amount = value[field];
      return typeof amount === "number" && Number.isFinite(amount) ? total + amount : total;
    }, 0);
  const posted = (row: Record<string, unknown>) => row.status === "posted";
  const postedIncome = sum(data.transactions, "amount", (row) => posted(row) && row.transaction_type === "income");
  const postedExpenses = sum(data.transactions, "amount", (row) => posted(row) && row.transaction_type === "expense");
  const financialSummary = {
    postedIncome,
    postedExpenses,
    netCashflow: postedIncome - postedExpenses,
    outstandingDebt: sum(data.debts, "outstanding_balance"),
    assetValue: sum(data.assets, "current_value"),
  };

  return {
    exportedAt: parsed.exported_at,
    ownerEmail: parsed.owner_email as string | null,
    counts,
    duplicateIds,
    existingIdConflicts,
    totalRecords,
    data,
    preferences,
    ownerMetadataMismatch,
    financialSummary,
  };
}
