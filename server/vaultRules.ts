import {
  OWNER_EMAIL_REGEX,
  validateAccountInput,
  validateAssetInput,
  validateCategoryBudgetInput,
  validateDebtInput,
  validateDebtPaymentInput,
  validateFinancialReminderInput,
  validateRecurringBillInput,
  validateSavingsGoalInput,
  validateTransactionPayload,
  validateWhatIfScenarioInput,
} from "../src/lib/vault-validation";
import type {
  Account,
  Asset,
  BudgetAlertLog,
  CategoryBudget,
  Debt,
  DebtPaymentLog,
  FinancialHealthScoreSnapshot,
  FinancialReminder,
  FinancialReminderLog,
  OwnerCommand,
  OwnerPreferences,
  OwnerUser,
  RecurringBill,
  SavingsGoal,
  Transaction,
  WhatIfScenarioRecord,
} from "../src/types/ego";

export {
  OWNER_EMAIL_REGEX,
  validateAccountInput,
  validateAssetInput,
  validateCategoryBudgetInput,
  validateDebtInput,
  validateFinancialReminderInput,
  validateRecurringBillInput,
  validateSavingsGoalInput,
  validateWhatIfScenarioInput,
};

export interface StoredOwner extends OwnerUser {
  password_hash: string;
  pin_hash?: string | null;
}

export interface VaultDatabase {
  owner: StoredOwner | null;
  preferences: OwnerPreferences;
  accounts: Account[];
  transactions: Transaction[];
  assets: Asset[];
  debts: Debt[];
  debt_payment_logs: DebtPaymentLog[];
  owner_commands: OwnerCommand[];
  recurring_bills: RecurringBill[];
  savings_goals: SavingsGoal[];
  financial_reminders: FinancialReminder[];
  financial_reminder_logs: FinancialReminderLog[];
  category_budgets: CategoryBudget[];
  budget_alert_logs: BudgetAlertLog[];
  whatif_scenarios: WhatIfScenarioRecord[];
  financial_health_scores: FinancialHealthScoreSnapshot[];
}

export const DEFAULT_PREFERENCES: OwnerPreferences = {
  date_format: "DD MMM YYYY",
  expense_alert_limit: 5_000_000,
};

export function createEmptyVault(): VaultDatabase {
  return {
    owner: null,
    preferences: { ...DEFAULT_PREFERENCES },
    accounts: [],
    transactions: [],
    assets: [],
    debts: [],
    debt_payment_logs: [],
    owner_commands: [],
    recurring_bills: [],
    savings_goals: [],
    financial_reminders: [],
    financial_reminder_logs: [],
    category_budgets: [],
    budget_alert_logs: [],
    whatif_scenarios: [],
    financial_health_scores: [],
  };
}

export function assertSingleOwnerAvailable(db: VaultDatabase): void {
  if (db.owner !== null) {
    throw new Error(
      "Sistem Single-Owner: Akun Owner sudah terdaftar. Pendaftaran kedua ditolak."
    );
  }
}

export interface ValidateTransactionInput {
  owner_id: string;
  transaction_type: Transaction["transaction_type"];
  source_account_id: string | null;
  destination_account_id: string | null;
  amount: number;
  status: Transaction["status"];
  owner_confirmed: boolean;
}

export function validateTransactionInvariants(
  input: ValidateTransactionInput,
  accounts: Account[]
): void {
  validateTransactionPayload(input);

  const ownsAccount = (id: string | null) =>
    id !== null && accounts.some((a) => a.id === id && a.owner_id === input.owner_id);

  if (input.transaction_type === "income") {
    if (!input.destination_account_id || !ownsAccount(input.destination_account_id)) {
      throw new Error("Pemasukan wajib memilih akun tujuan yang valid milik Owner.");
    }
  } else if (input.transaction_type === "expense") {
    if (!input.source_account_id || !ownsAccount(input.source_account_id)) {
      throw new Error("Pengeluaran wajib memilih akun sumber yang valid milik Owner.");
    }
  } else if (input.transaction_type === "transfer") {
    if (
      !input.source_account_id ||
      !input.destination_account_id ||
      !ownsAccount(input.source_account_id) ||
      !ownsAccount(input.destination_account_id)
    ) {
      throw new Error("Transfer wajib memilih akun sumber dan akun tujuan yang valid.");
    }
  }
}

export function validateDebtPayment(
  debt: Debt,
  paymentAmount: number,
  sourceAccountId: string,
  ownerConfirmed: boolean
): void {
  validateDebtPaymentInput(debt, paymentAmount, sourceAccountId, ownerConfirmed);
}

export interface LoginRateCheckResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
  message?: string;
}

export interface LoginRateLimiter {
  check: (key: string, nowMs?: number) => LoginRateCheckResult;
  recordFailure: (key: string, nowMs?: number) => LoginRateCheckResult;
  reset: (key: string) => void;
}

export function createLoginRateLimiter(
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000
): LoginRateLimiter {
  const attempts = new Map<string, { count: number; windowStart: number }>();

  function getActiveEntry(key: string, nowMs: number) {
    const entry = attempts.get(key);
    if (!entry) return null;
    if (nowMs - entry.windowStart >= windowMs) {
      attempts.delete(key);
      return null;
    }
    return entry;
  }

  return {
    check(key: string, nowMs = Date.now()): LoginRateCheckResult {
      const entry = getActiveEntry(key, nowMs);
      if (!entry || entry.count < maxAttempts) {
        return {
          allowed: true,
          remainingAttempts: maxAttempts - (entry?.count ?? 0),
          retryAfterSeconds: 0,
        };
      }
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((entry.windowStart + windowMs - nowMs) / 1000)
      );
      const waitMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds,
        message: `Terlalu banyak percobaan masuk gagal. Demi keamanan brankas, silakan tunggu sekitar ${waitMinutes} menit sebelum mencoba lagi.`,
      };
    },

    recordFailure(key: string, nowMs = Date.now()): LoginRateCheckResult {
      const existing = getActiveEntry(key, nowMs);
      const next = existing
        ? { count: existing.count + 1, windowStart: existing.windowStart }
        : { count: 1, windowStart: nowMs };
      attempts.set(key, next);
      return this.check(key, nowMs);
    },

    reset(key: string): void {
      attempts.delete(key);
    },
  };
}

// Recurring bill and savings goal validators are re-exported from src/lib/vault-validation.ts

export function validateChangePasswordInput(input: {
  current_password: string;
  new_password: string;
}): void {
  if (!input.current_password) {
    throw new Error("Kata sandi saat ini wajib diisi.");
  }
  if (!input.new_password || input.new_password.length < 6) {
    throw new Error("Kata sandi baru minimal 6 karakter.");
  }
  if (input.new_password.length > 128) {
    throw new Error("Kata sandi baru maksimal 128 karakter.");
  }
  if (input.new_password === input.current_password) {
    throw new Error("Kata sandi baru harus berbeda dari kata sandi saat ini.");
  }
}

export function validatePinFormat(pin: string): void {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("PIN cepat wajib terdiri dari tepat 6 digit angka.");
  }
}

export function validateOwnerEmailUpdateInput(input: {
  email: string;
  full_name: string;
  current_password: string;
}): { email: string; full_name: string } {
  const email = input.email.trim().toLowerCase();
  const fullName = input.full_name.trim();

  if (!email || !OWNER_EMAIL_REGEX.test(email)) {
    throw new Error("Format email Owner tidak valid.");
  }
  if (fullName.length < 1 || fullName.length > 80) {
    throw new Error("Nama panggilan Owner wajib 1–80 karakter.");
  }
  if (!input.current_password) {
    throw new Error("Kata sandi saat ini wajib diisi untuk mengubah email Owner.");
  }
  return { email, full_name: fullName };
}

export function validateResetOwnerConfirmation(input: {
  confirmed: boolean;
  confirmation_text: string;
}): void {
  if (!input.confirmed) {
    throw new Error(
      "Centang persetujuan bahwa seluruh data brankas lokal akan dikosongkan."
    );
  }
  if (input.confirmation_text.trim().toUpperCase() !== "HAPUS") {
    throw new Error('Ketik kata "HAPUS" untuk mengonfirmasi penghapusan akun Owner.');
  }
}

