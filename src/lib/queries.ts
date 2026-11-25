import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { advanceDueDate, computeAccountBalances, roundCurrency, todayISO } from "./finance";
import {
  clearPinSessionState,
  hashPinWebCrypto,
  markPinSessionUnlocked,
  verifyPinWebCrypto,
} from "./pin-lock";
import { isSupabaseConfigured, supabase } from "./supabase";
import {
  budgetThresholdLabel,
  isThresholdAlreadyNotified,
  normalizeBudgetCategoryKey,
} from "./budgets";
import {
  advanceReminderDueDate,
  buildSourceSyncReminders,
  normalizeReminderOffsets,
} from "./reminders";
import { normalizeDebt } from "./debt-manager";
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
} from "./vault-validation";
import type {
  Account,
  AccountBalance,
  AccountType,
  AiAdvisorResponse,
  Asset,
  AssetType,
  BudgetAlertLog,
  BudgetThresholdLevel,
  CategoryBudget,
  DateFormatPref,
  Debt,
  DebtPaymentFrequency,
  DebtPaymentLog,
  DebtType,
  FinancialHealthScoreSnapshot,
  FinancialReminder,
  FinancialReminderLog,
  GoalStatus,
  GoalType,
  OwnerCommand,
  OwnerPreferences,
  OwnerUser,
  ParsedCommandDraft,
  RecurringBill,
  RecurringFrequency,
  ReminderCategory,
  ReminderFrequency,
  SavingsGoal,
  SearchSource,
  Transaction,
  TransactionType,
  WhatIfScenarioParams,
  WhatIfScenarioRecord,
  WhatIfSimulationResult,
} from "../types/ego";

const PREFS_STORAGE_KEY = "ego_owner_preferences";

// Held strictly in JS memory rather than localStorage; HttpOnly cookie maintains persistence across page reloads.
let memorySessionToken: string | null = null;

export function setMemorySessionToken(token: string | null): void {
  memorySessionToken = token;
}

export async function getActiveBearerToken(): Promise<string | null> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
  return memorySessionToken;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getActiveBearerToken();
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("X-Requested-With", "EGO-Vault-SPA");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    code?: string;
  };
  if (!res.ok) {
    throw new ApiError(
      data.error || `Permintaan gagal (${res.status}).`,
      res.status,
      data.code
    );
  }
  return data;
}

export interface AuthStatusResponse {
  hasOwner: boolean;
  authenticated: boolean;
  hasPin: boolean;
  owner: OwnerUser | null;
  mode: "supabase" | "local";
}

export interface VaultSnapshot {
  accounts: AccountBalance[];
  transactions: Transaction[];
  assets: Asset[];
  debts: Debt[];
  debt_payment_logs?: DebtPaymentLog[];
  owner_commands: OwnerCommand[];
  recurring_bills: RecurringBill[];
  savings_goals: SavingsGoal[];
  financial_reminders: FinancialReminder[];
  financial_reminder_logs: FinancialReminderLog[];
  remindersTableReady?: boolean;
  category_budgets: CategoryBudget[];
  budget_alert_logs: BudgetAlertLog[];
  budgetsTableReady?: boolean;
  whatif_scenarios?: WhatIfScenarioRecord[];
  financial_health_scores?: FinancialHealthScoreSnapshot[];
  ecosystemTablesReady?: boolean;
  preferences: OwnerPreferences;
}

function isMissingSupabaseTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  );
}

function isMissingSupabaseColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    msg.includes("could not find the") ||
    (msg.includes("column") && msg.includes("does not exist"))
  );
}

function formatSupabaseTableWriteError(err: { code?: string; message?: string }): Error {
  if (isMissingSupabaseTableError(err)) {
    return new Error(
      "Tabel ekosistem baru belum tersedia di Supabase. Jalankan skrip migrasi pada docs/ego-supabase-complete-migration.sql di SQL Editor Supabase Anda."
    );
  }
  return new Error(err.message || "Gagal menyimpan data ke Supabase.");
}

export const egoKeys = {
  auth: ["ego", "auth"] as const,
  vault: ["ego", "vault"] as const,
  health: ["ego", "health"] as const,
};

export function useHealthStatus() {
  return useQuery({
    queryKey: egoKeys.health,
    queryFn: () =>
      apiFetch<{ ok: boolean; mode: "supabase" | "local"; supabaseConfigured: boolean }>(
        "/api/health"
      ),
    staleTime: 30_000,
  });
}

export async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    return {
      hasOwner: Boolean(user),
      authenticated: Boolean(user),
      hasPin: Boolean(user?.user_metadata?.ego_pin_hash),
      owner: user
        ? {
            id: user.id,
            email: user.email ?? "owner@ego.local",
            full_name:
              (user.user_metadata?.full_name as string | undefined) || "Owner Utama",
            created_at: user.created_at,
          }
        : null,
      mode: "supabase",
    };
  }

  const res = await apiFetch<{
    hasOwner: boolean;
    authenticated: boolean;
    hasPin?: boolean;
    owner: OwnerUser | null;
  }>("/api/auth/status");

  return {
    hasOwner: res.hasOwner,
    authenticated: res.authenticated,
    hasPin: Boolean(res.hasPin),
    owner: res.owner,
    mode: "local",
  };
}

export async function fetchVaultSnapshot(): Promise<VaultSnapshot> {
  if (isSupabaseConfigured && supabase) {
    const [
      accRes,
      txRes,
      assetRes,
      debtRes,
      debtLogRes,
      cmdRes,
      recRes,
      goalRes,
      remRes,
      logRes,
      budRes,
      budLogRes,
      whatIfRes,
      healthRes,
    ] = await Promise.all([
      supabase.from("accounts").select("*").order("created_at", { ascending: true }),
      supabase
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("assets").select("*").order("created_at", { ascending: false }),
      supabase.from("debts").select("*").order("created_at", { ascending: false }),
      supabase
        .from("debt_payment_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("owner_commands").select("*").order("created_at", { ascending: false }),
      supabase.from("recurring_bills").select("*").order("next_due_date", { ascending: true }),
      supabase.from("savings_goals").select("*").order("created_at", { ascending: false }),
      supabase.from("financial_reminders").select("*").order("due_date", { ascending: true }),
      supabase
        .from("financial_reminder_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("category_budgets")
        .select("*")
        .order("period_month", { ascending: false })
        .order("category", { ascending: true }),
      supabase
        .from("budget_alert_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150),
      supabase
        .from("whatif_scenarios")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("financial_health_scores")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    if (accRes.error) throw new Error(accRes.error.message);
    if (txRes.error) throw new Error(txRes.error.message);
    if (assetRes.error) throw new Error(assetRes.error.message);
    if (debtRes.error) throw new Error(debtRes.error.message);
    if (debtLogRes.error && !isMissingSupabaseTableError(debtLogRes.error)) {
      throw new Error(debtLogRes.error.message);
    }
    if (cmdRes.error) throw new Error(cmdRes.error.message);
    if (recRes.error && !isMissingSupabaseTableError(recRes.error)) {
      throw new Error(recRes.error.message);
    }
    if (goalRes.error && !isMissingSupabaseTableError(goalRes.error)) {
      throw new Error(goalRes.error.message);
    }
    if (remRes.error && !isMissingSupabaseTableError(remRes.error)) {
      throw new Error(remRes.error.message);
    }
    if (logRes.error && !isMissingSupabaseTableError(logRes.error)) {
      throw new Error(logRes.error.message);
    }
    if (budRes.error && !isMissingSupabaseTableError(budRes.error)) {
      throw new Error(budRes.error.message);
    }
    if (budLogRes.error && !isMissingSupabaseTableError(budLogRes.error)) {
      throw new Error(budLogRes.error.message);
    }
    if (whatIfRes.error && !isMissingSupabaseTableError(whatIfRes.error)) {
      throw new Error(whatIfRes.error.message);
    }
    if (healthRes.error && !isMissingSupabaseTableError(healthRes.error)) {
      throw new Error(healthRes.error.message);
    }

    const accounts = (accRes.data ?? []) as Account[];
    const transactions = (txRes.data ?? []) as Transaction[];
    let prefs: OwnerPreferences = {
      date_format: "DD MMM YYYY",
      expense_alert_limit: 5_000_000,
    };
    try {
      const saved = window.localStorage.getItem(PREFS_STORAGE_KEY);
      if (saved) prefs = { ...prefs, ...(JSON.parse(saved) as Partial<OwnerPreferences>) };
    } catch {
      // Ignore
    }

    const remindersTableReady =
      !isMissingSupabaseTableError(remRes.error) &&
      !isMissingSupabaseTableError(logRes.error);
    const budgetsTableReady =
      !isMissingSupabaseTableError(budRes.error) &&
      !isMissingSupabaseTableError(budLogRes.error);
    const ecosystemTablesReady =
      !isMissingSupabaseTableError(debtLogRes.error) &&
      !isMissingSupabaseTableError(whatIfRes.error) &&
      !isMissingSupabaseTableError(healthRes.error);

    return {
      accounts: computeAccountBalances(accounts, transactions),
      transactions,
      assets: (assetRes.data ?? []) as Asset[],
      debts: ((debtRes.data ?? []) as Debt[]).map(normalizeDebt),
      debt_payment_logs: debtLogRes.error
        ? []
        : ((debtLogRes.data ?? []) as DebtPaymentLog[]),
      owner_commands: (cmdRes.data ?? []) as OwnerCommand[],
      recurring_bills: recRes.error ? [] : ((recRes.data ?? []) as RecurringBill[]),
      savings_goals: goalRes.error ? [] : ((goalRes.data ?? []) as SavingsGoal[]),
      financial_reminders: remRes.error ? [] : ((remRes.data ?? []) as FinancialReminder[]),
      financial_reminder_logs: logRes.error
        ? []
        : ((logRes.data ?? []) as FinancialReminderLog[]),
      remindersTableReady,
      category_budgets: budRes.error ? [] : ((budRes.data ?? []) as CategoryBudget[]),
      budget_alert_logs: budLogRes.error ? [] : ((budLogRes.data ?? []) as BudgetAlertLog[]),
      budgetsTableReady,
      whatif_scenarios: whatIfRes.error
        ? []
        : ((whatIfRes.data ?? []) as WhatIfScenarioRecord[]),
      financial_health_scores: healthRes.error
        ? []
        : ((healthRes.data ?? []) as FinancialHealthScoreSnapshot[]),
      ecosystemTablesReady,
      preferences: prefs,
    };
  }

  return apiFetch<VaultSnapshot>("/api/vault/snapshot");
}

export function useAuthStatus() {
  return useQuery({
    queryKey: egoKeys.auth,
    queryFn: fetchAuthStatus,
    staleTime: 10_000,
  });
}

export function useVaultSnapshot(enabled = true) {
  return useQuery({
    queryKey: egoKeys.vault,
    queryFn: fetchVaultSnapshot,
    enabled,
  });
}

function formatSupabaseAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Email atau kata sandi Owner tidak sesuai.";
  }
  if (lower.includes("email not confirmed")) {
    return "Email Owner belum dikonfirmasi. Buka tautan verifikasi di kotak masuk atau folder spam email Anda.";
  }
  if (lower.includes("user already registered")) {
    return "Email ini sudah terdaftar. Silakan pindah ke tab Masuk Owner.";
  }
  if (lower.includes("single-owner")) {
    return "Sistem Single-Owner: Akun Owner sudah terdaftar di Supabase. Silakan masuk dengan akun pertama.";
  }
  return message;
}

export function useRegisterOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string; full_name: string }) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: input.email.trim(),
          password: input.password,
          options: { data: { full_name: input.full_name.trim() || "Owner Utama" } },
        });
        if (error) throw new Error(formatSupabaseAuthError(error.message));
        return {
          needsEmailConfirmation: Boolean(data.user && !data.session),
          user: data.user,
          session: data.session,
        };
      }
      const res = await apiFetch<{ token: string; owner: OwnerUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setMemorySessionToken(res.token);
      return {
        needsEmailConfirmation: false,
        owner: res.owner,
      };
    },
    onSuccess: async (res) => {
      if (!res.needsEmailConfirmation) {
        markPinSessionUnlocked();
      }
      await qc.invalidateQueries({ queryKey: egoKeys.auth });
    },
  });
}

export function useLoginOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: input.email.trim(),
          password: input.password,
        });
        if (error) throw new Error(formatSupabaseAuthError(error.message));
        return data;
      }
      const res = await apiFetch<{ token: string; owner: OwnerUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setMemorySessionToken(res.token);
      return res;
    },
    onSuccess: async () => {
      markPinSessionUnlocked();
      await qc.invalidateQueries({ queryKey: egoKeys.auth });
    },
  });
}

export function useLogoutOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      } else {
        await apiFetch("/api/auth/logout", { method: "POST" });
        setMemorySessionToken(null);
      }
    },
    onSuccess: () => {
      clearPinSessionState();
      qc.clear();
    },
  });
}

export function useResetLocalOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { confirmed: boolean; confirmation_text: string }) => {
      if (isSupabaseConfigured && supabase) {
        throw new Error(
          "Reset akun lokal hanya tersedia pada mode Brankas Server Lokal."
        );
      }
      const res = await apiFetch<{ ok: boolean; hasOwner: boolean }>(
        "/api/auth/reset-owner",
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      );
      setMemorySessionToken(null);
      return res;
    },
    onSuccess: async () => {
      clearPinSessionState();
      qc.removeQueries({ queryKey: egoKeys.vault });
      await qc.invalidateQueries({ queryKey: egoKeys.auth });
    },
  });
}

export function useUpdateOwnerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      full_name: string;
      current_password: string;
    }) => {
      const email = input.email.trim().toLowerCase();
      const fullName = input.full_name.trim();
      if (!email || !OWNER_EMAIL_REGEX.test(email)) {
        throw new Error("Format email Owner tidak valid.");
      }
      if (fullName.length < 1 || fullName.length > 80) {
        throw new Error("Nama panggilan Owner wajib 1–80 karakter.");
      }
      if (!input.current_password) {
        throw new Error("Kata sandi saat ini wajib diisi untuk verifikasi.");
      }

      if (isSupabaseConfigured && supabase) {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const currentEmail = userData.user?.email;
        if (userErr || !currentEmail) {
          throw new Error("Sesi Owner tidak ditemukan. Silakan masuk ulang.");
        }
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email: currentEmail,
          password: input.current_password,
        });
        if (verifyErr) {
          throw new Error("Kata sandi saat ini tidak sesuai.");
        }
        const emailChanged = email !== currentEmail.toLowerCase();
        const updatePayload: { email?: string; data: { full_name: string } } = {
          data: { full_name: fullName },
        };
        if (emailChanged) {
          updatePayload.email = email;
        }
        const { error: updateErr } = await supabase.auth.updateUser(updatePayload);
        if (updateErr) {
          throw new Error(updateErr.message || "Gagal memperbarui profil Owner.");
        }
        return { ok: true, emailChanged };
      }

      const res = await apiFetch<{ ok: boolean; owner: OwnerUser }>("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          email,
          full_name: fullName,
          current_password: input.current_password,
        }),
      });
      return { ...res, emailChanged: false };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.auth });
    },
  });
}

export function useDeleteLocalOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { current_password: string; confirmed: boolean }) => {
      if (isSupabaseConfigured && supabase) {
        throw new Error(
          "Penghapusan akun otomatis hanya tersedia pada mode Brankas Server Lokal."
        );
      }
      const res = await apiFetch<{ ok: boolean; hasOwner: boolean }>(
        "/api/auth/owner",
        {
          method: "DELETE",
          body: JSON.stringify(input),
        }
      );
      setMemorySessionToken(null);
      return res;
    },
    onSuccess: () => {
      clearPinSessionState();
      qc.clear();
    },
  });
}

let supabasePinFailures = { count: 0, lockedUntilMs: 0 };

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: {
      current_password: string;
      new_password: string;
    }) => {
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

      if (isSupabaseConfigured && supabase) {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const email = userData.user?.email;
        if (userErr || !email) {
          throw new Error("Sesi Owner tidak ditemukan. Silakan masuk ulang.");
        }
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email,
          password: input.current_password,
        });
        if (verifyErr) {
          throw new Error("Kata sandi saat ini tidak sesuai.");
        }
        const { error: updateErr } = await supabase.auth.updateUser({
          password: input.new_password,
        });
        if (updateErr) {
          throw new Error(updateErr.message || "Gagal memperbarui kata sandi.");
        }
        return { ok: true };
      }

      return apiFetch<{ ok: boolean }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
  });
}

export function useSetupPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { current_password: string; pin: string }) => {
      if (!input.current_password) {
        throw new Error("Kata sandi Owner saat ini wajib diisi untuk verifikasi.");
      }
      if (!/^\d{6}$/.test(input.pin)) {
        throw new Error("PIN cepat wajib terdiri dari tepat 6 digit angka.");
      }

      if (isSupabaseConfigured && supabase) {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const email = userData.user?.email;
        if (userErr || !email) {
          throw new Error("Sesi Owner tidak ditemukan. Silakan masuk ulang.");
        }
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email,
          password: input.current_password,
        });
        if (verifyErr) {
          throw new Error("Kata sandi Owner tidak sesuai.");
        }
        const pinHash = await hashPinWebCrypto(input.pin);
        const { error: updateErr } = await supabase.auth.updateUser({
          data: { ego_pin_hash: pinHash },
        });
        if (updateErr) {
          throw new Error(updateErr.message || "Gagal menyimpan kunci PIN.");
        }
        supabasePinFailures = { count: 0, lockedUntilMs: 0 };
        return { ok: true, hasPin: true };
      }

      return apiFetch<{ ok: boolean; hasPin: boolean }>("/api/auth/pin/setup", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      markPinSessionUnlocked();
      await qc.invalidateQueries({ queryKey: egoKeys.auth });
    },
  });
}

export function useVerifyPin() {
  return useMutation({
    mutationFn: async (pin: string) => {
      if (!/^\d{6}$/.test(pin)) {
        throw new Error("Masukkan 6 digit angka PIN.");
      }

      if (isSupabaseConfigured && supabase) {
        const now = Date.now();
        if (supabasePinFailures.lockedUntilMs > now) {
          const waitMin = Math.max(
            1,
            Math.ceil((supabasePinFailures.lockedUntilMs - now) / 60000)
          );
          throw new Error(
            `Terlalu banyak percobaan PIN gagal. Tunggu sekitar ${waitMin} menit atau masuk dengan kata sandi lengkap.`
          );
        }

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const storedHash = userData.user?.user_metadata?.ego_pin_hash as
          | string
          | undefined;
        if (userErr || !storedHash) {
          throw new Error("Kunci PIN belum aktif pada akun ini.");
        }

        const valid = await verifyPinWebCrypto(pin, storedHash);
        if (!valid) {
          const nextCount = supabasePinFailures.count + 1;
          if (nextCount >= 5) {
            supabasePinFailures = {
              count: nextCount,
              lockedUntilMs: now + 15 * 60 * 1000,
            };
            throw new Error(
              "Terlalu banyak percobaan PIN gagal. Silakan tunggu 15 menit atau masuk dengan kata sandi lengkap."
            );
          }
          supabasePinFailures = { count: nextCount, lockedUntilMs: 0 };
          throw new Error(
            `PIN 6 digit tidak sesuai. Sisa percobaan: ${5 - nextCount}.`
          );
        }

        supabasePinFailures = { count: 0, lockedUntilMs: 0 };
        return { ok: true };
      }

      return apiFetch<{ ok: boolean }>("/api/auth/pin/verify", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
    },
    onSuccess: () => {
      markPinSessionUnlocked();
    },
  });
}

export function useDisablePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (currentPassword: string) => {
      if (!currentPassword) {
        throw new Error("Kata sandi Owner saat ini wajib diisi.");
      }

      if (isSupabaseConfigured && supabase) {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const email = userData.user?.email;
        if (userErr || !email) {
          throw new Error("Sesi Owner tidak ditemukan. Silakan masuk ulang.");
        }
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (verifyErr) {
          throw new Error("Kata sandi Owner tidak sesuai.");
        }
        const { error: updateErr } = await supabase.auth.updateUser({
          data: { ego_pin_hash: null },
        });
        if (updateErr) {
          throw new Error(updateErr.message || "Gagal menonaktifkan kunci PIN.");
        }
        supabasePinFailures = { count: 0, lockedUntilMs: 0 };
        return { ok: true, hasPin: false };
      }

      return apiFetch<{ ok: boolean; hasPin: boolean }>("/api/auth/pin/disable", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword }),
      });
    },
    onSuccess: async () => {
      clearPinSessionState();
      await qc.invalidateQueries({ queryKey: egoKeys.auth });
    },
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      account_name: string;
      account_type: AccountType;
      opening_balance: number;
      owner_confirmed: boolean;
    }) => {
      validateAccountInput(input);
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("accounts").insert({
          account_name: input.account_name.trim(),
          account_type: input.account_type,
          opening_balance: roundCurrency(input.opening_balance),
        });
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch("/api/accounts", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useToggleAccountActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; is_active: boolean }) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("accounts")
          .update({ is_active: input.is_active })
          .eq("id", input.id);
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch(`/api/accounts/${input.id}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: input.is_active }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      transaction_type: TransactionType;
      source_account_id: string | null;
      destination_account_id: string | null;
      amount: number;
      transaction_date: string;
      category: string;
      description: string;
      owner_confirmed: boolean;
    }) => {
      const normalized = {
        ...input,
        source_account_id:
          input.transaction_type === "income" ? null : input.source_account_id,
        destination_account_id:
          input.transaction_type === "expense" ? null : input.destination_account_id,
        amount: roundCurrency(input.amount),
        transaction_date: (input.transaction_date || todayISO()).slice(0, 10),
        category: input.category.trim() || "Umum",
        description: input.description.trim(),
      };
      validateTransactionPayload({
        transaction_type: normalized.transaction_type,
        source_account_id: normalized.source_account_id,
        destination_account_id: normalized.destination_account_id,
        amount: normalized.amount,
        status: "posted",
        owner_confirmed: normalized.owner_confirmed,
      });

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("transactions").insert({
          ...normalized,
          status: "posted",
        });
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch("/api/transactions", {
        method: "POST",
        body: JSON.stringify(normalized),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useCancelTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("transactions")
          .update({ status: "cancelled" })
          .eq("id", id);
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch(`/api/transactions/${id}/cancel`, { method: "PATCH" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      asset_name: string;
      asset_type: AssetType;
      current_value: number;
      quantity: number | null;
      unit: string | null;
      notes: string | null;
      owner_confirmed: boolean;
    }) => {
      validateAssetInput(input);
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("assets").insert({
          asset_name: input.asset_name.trim(),
          asset_type: input.asset_type,
          current_value: roundCurrency(input.current_value),
          quantity: input.quantity,
          unit: input.unit?.trim() || null,
          notes: input.notes?.trim() || null,
        });
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch("/api/assets", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useUpdateAssetValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      current_value: number;
      notes?: string | null;
      owner_confirmed: boolean;
    }) => {
      if (!input.owner_confirmed) {
        throw new Error("Persetujuan eksplisit Owner wajib dicentang.");
      }
      if (!Number.isFinite(input.current_value) || input.current_value < 0) {
        throw new Error("Nilai taksiran aset harus >= Rp 0.");
      }
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("assets")
          .update({
            current_value: roundCurrency(input.current_value),
            notes: input.notes ?? null,
          })
          .eq("id", input.id);
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch(`/api/assets/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useCreateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      creditor: string;
      debt_type?: DebtType;
      original_amount: number;
      outstanding_balance: number;
      interest_rate_annual?: number;
      monthly_fee?: number;
      installment_amount?: number;
      payment_frequency?: DebtPaymentFrequency;
      due_date: string | null;
      description: string | null;
      owner_confirmed: boolean;
    }) => {
      validateDebtInput(input);
      if (isSupabaseConfigured && supabase) {
        const cleanOutstanding = roundCurrency(input.outstanding_balance);
        const debtType = input.debt_type ?? "lainnya";
        const rate = Math.max(0, Number(input.interest_rate_annual ?? 0) || 0);
        const monthlyFee = roundCurrency(input.monthly_fee ?? 0);
        const installment = roundCurrency(input.installment_amount ?? 0);
        const freq = input.payment_frequency ?? "monthly";

        const baseRow = {
          creditor: input.creditor.trim(),
          original_amount: roundCurrency(input.original_amount),
          outstanding_balance: cleanOutstanding,
          due_date: input.due_date || null,
          description: input.description?.trim() || null,
          status: cleanOutstanding === 0 ? "paid" : "active",
        };
        const fullRow = {
          ...baseRow,
          debt_type: debtType,
          interest_rate_annual: rate,
          monthly_fee: monthlyFee,
          installment_amount: installment,
          payment_frequency: freq,
        };

        const { error } = await supabase.from("debts").insert(fullRow);
        if (error) {
          if (isMissingSupabaseColumnError(error)) {
            const hasCustomMeta =
              debtType !== "lainnya" ||
              rate > 0 ||
              monthlyFee > 0 ||
              installment > 0 ||
              freq !== "monthly";
            if (!hasCustomMeta) {
              const { error: fallbackErr } = await supabase.from("debts").insert(baseRow);
              if (!fallbackErr) return;
              throw new Error(fallbackErr.message);
            }
            throw new Error(
              "Kolom metadata utang (bunga/cicilan/jenis) belum tersedia di Supabase. Jalankan docs/ego-supabase-complete-migration.sql terlebih dahulu."
            );
          }
          throw new Error(error.message);
        }
        return;
      }
      return apiFetch("/api/debts", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useUpdateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      creditor: string;
      debt_type: DebtType;
      original_amount: number;
      outstanding_balance: number;
      interest_rate_annual: number;
      monthly_fee: number;
      installment_amount: number;
      payment_frequency: DebtPaymentFrequency;
      due_date: string | null;
      description: string | null;
      owner_confirmed: boolean;
    }) => {
      validateDebtInput(input);
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("debts")
          .update({
            creditor: input.creditor.trim(),
            debt_type: input.debt_type,
            interest_rate_annual: Math.max(0, Number(input.interest_rate_annual) || 0),
            monthly_fee: roundCurrency(input.monthly_fee),
            installment_amount: roundCurrency(input.installment_amount),
            payment_frequency: input.payment_frequency,
            due_date: input.due_date || null,
            description: input.description?.trim() || null,
          })
          .eq("id", input.id);
        if (error) {
          if (isMissingSupabaseColumnError(error)) {
            throw new Error(
              "Kolom metadata utang belum tersedia di Supabase. Jalankan docs/ego-supabase-complete-migration.sql terlebih dahulu."
            );
          }
          throw new Error(error.message);
        }
        return;
      }
      return apiFetch(`/api/debts/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function usePayDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      debt_id: string;
      amount: number;
      source_account_id: string;
      owner_confirmed: boolean;
      notes?: string | null;
    }) => {
      if (!input.owner_confirmed) {
        throw new Error("Persetujuan eksplisit Owner wajib dicentang.");
      }
      if (isSupabaseConfigured && supabase) {
        const { data: debt, error: getErr } = await supabase
          .from("debts")
          .select("*")
          .eq("id", input.debt_id)
          .single();
        if (getErr || !debt) throw new Error(getErr?.message || "Utang tidak ditemukan.");

        const paymentAmount = roundCurrency(input.amount);
        validateDebtPaymentInput(
          {
            status: String(debt.status ?? "active"),
            outstanding_balance: Number(debt.outstanding_balance ?? 0),
          },
          paymentAmount,
          input.source_account_id,
          input.owner_confirmed
        );

        const remaining = Math.max(
          0,
          roundCurrency(Number(debt.outstanding_balance) - paymentAmount)
        );
        const payDate = todayISO();
        const { data: insertedTx, error: txErr } = await supabase
          .from("transactions")
          .insert({
            transaction_type: "expense",
            source_account_id: input.source_account_id,
            destination_account_id: null,
            amount: paymentAmount,
            transaction_date: payDate,
            category: "Utang & Cicilan",
            description: `Pembayaran utang ke ${debt.creditor}`,
            status: "posted",
            owner_confirmed: true,
          })
          .select("id")
          .single();
        if (txErr || !insertedTx) {
          throw new Error(txErr?.message || "Gagal mencatat transaksi pembayaran utang.");
        }

        const { error: updErr } = await supabase
          .from("debts")
          .update({
            outstanding_balance: remaining,
            status: remaining === 0 ? "paid" : "active",
          })
          .eq("id", input.debt_id);
        if (updErr) {
          await supabase.from("transactions").delete().eq("id", insertedTx.id);
          throw new Error(updErr.message);
        }

        const { error: logErr } = await supabase.from("debt_payment_logs").insert({
          debt_id: input.debt_id,
          transaction_id: insertedTx.id,
          amount: paymentAmount,
          principal_paid: paymentAmount,
          interest_paid: 0,
          remaining_after: remaining,
          notes: input.notes?.trim() || null,
        });
        if (logErr && !isMissingSupabaseTableError(logErr)) {
          // Non-fatal so core payment transaction stays consistent; log error ignored only if table not migrated
          console.warn("debt_payment_logs insert warning:", logErr.message);
        }
        return;
      }

      return apiFetch(`/api/debts/${input.debt_id}/pay`, {
        method: "POST",
        body: JSON.stringify({
          amount: input.amount,
          source_account_id: input.source_account_id,
          owner_confirmed: input.owner_confirmed,
          notes: input.notes ?? null,
        }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useQueueCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { command_text: string; parsed_draft?: ParsedCommandDraft }) => {
      const cleanText = input.command_text.trim();
      if (cleanText.length < 1 || cleanText.length > 500) {
        throw new Error("Perintah harus berisi 1–500 karakter.");
      }
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("owner_commands").insert({
          command_text: cleanText,
          status: "pending",
          parsed_draft: input.parsed_draft ?? null,
        });
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch<OwnerCommand>("/api/commands", {
        method: "POST",
        body: JSON.stringify({
          command_text: cleanText,
          parsed_draft: input.parsed_draft,
        }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useApproveCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      draft: ParsedCommandDraft;
      owner_confirmed: boolean;
    }) => {
      if (!input.owner_confirmed) {
        throw new Error("Persetujuan eksplisit Owner wajib dicentang.");
      }
      const amount = roundCurrency(Number(input.draft.amount ?? 0));
      const txType = input.draft.transaction_type;
      const sourceId =
        txType === "income" ? null : input.draft.source_account_id || null;
      const destId =
        txType === "expense" ? null : input.draft.destination_account_id || null;

      validateTransactionPayload({
        transaction_type: txType,
        source_account_id: sourceId,
        destination_account_id: destId,
        amount,
        status: "posted",
        owner_confirmed: input.owner_confirmed,
      });

      if (isSupabaseConfigured && supabase) {
        const { data: existingCmd, error: cmdFetchErr } = await supabase
          .from("owner_commands")
          .select("id, status")
          .eq("id", input.id)
          .single();
        if (cmdFetchErr || !existingCmd) {
          throw new Error(cmdFetchErr?.message || "Perintah tidak ditemukan.");
        }
        if (existingCmd.status !== "pending") {
          throw new Error("Perintah ini sudah diproses sebelumnya.");
        }

        const cleanDraft: ParsedCommandDraft = {
          ...input.draft,
          amount,
          source_account_id: sourceId,
          destination_account_id: destId,
          transaction_date: (input.draft.transaction_date || todayISO()).slice(0, 10),
          category: (input.draft.category || "Lainnya").trim(),
          description: (input.draft.description || "Transaksi Owner").trim(),
        };

        const { data: insertedTx, error: txErr } = await supabase
          .from("transactions")
          .insert({
            transaction_type: cleanDraft.transaction_type,
            source_account_id: cleanDraft.source_account_id,
            destination_account_id: cleanDraft.destination_account_id,
            amount: cleanDraft.amount,
            transaction_date: cleanDraft.transaction_date,
            category: cleanDraft.category,
            description: cleanDraft.description,
            status: "posted",
            owner_confirmed: true,
          })
          .select("id")
          .single();
        if (txErr || !insertedTx) {
          throw new Error(txErr?.message || "Gagal memposting transaksi draf.");
        }

        const { error: cmdErr } = await supabase
          .from("owner_commands")
          .update({ status: "processed", parsed_draft: cleanDraft })
          .eq("id", input.id)
          .eq("status", "pending");
        if (cmdErr) {
          await supabase.from("transactions").delete().eq("id", insertedTx.id);
          throw new Error(cmdErr.message);
        }
        return;
      }

      return apiFetch(`/api/commands/${input.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          draft: input.draft,
          owner_confirmed: input.owner_confirmed,
        }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useRejectCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("owner_commands")
          .update({ status: "rejected" })
          .eq("id", id);
        if (error) throw new Error(error.message);
        return;
      }
      return apiFetch(`/api/commands/${id}/reject`, { method: "POST" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      date_format: DateFormatPref;
      expense_alert_limit: number;
    }) => {
      if (isSupabaseConfigured) {
        window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(input));
        return input;
      }
      return apiFetch<OwnerPreferences>("/api/preferences", {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useFinancialSearch() {
  return useMutation({
    mutationFn: async (query: string) => {
      return apiFetch<{ answer: string; sources: SearchSource[] }>("/api/ai/search", {
        method: "POST",
        body: JSON.stringify({ query }),
      });
    },
  });
}

export function useScanReceipt() {
  return useMutation({
    mutationFn: async (input: {
      imageBase64: string;
      mimeType: string;
      accounts?: Account[];
    }) => {
      return apiFetch<{
        commandText: string;
        draft: ParsedCommandDraft;
        merchant: string;
      }>("/api/ai/scan-receipt", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
  });
}

export function useCreateRecurringBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      transaction_type: "income" | "expense";
      amount: number;
      category: string;
      account_id: string | null;
      frequency: RecurringFrequency;
      next_due_date: string;
      notes: string | null;
      owner_confirmed: boolean;
    }) => {
      validateRecurringBillInput(input);
      if (isSupabaseConfigured && supabase) {
        const { owner_confirmed: _oc, ...payload } = input;
        const { error } = await supabase.from("recurring_bills").insert({
          ...payload,
          title: payload.title.trim(),
          amount: roundCurrency(payload.amount),
          category: payload.category.trim() || "Utilitas & Tagihan",
          notes: payload.notes?.trim() || null,
          is_active: true,
        });
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch<RecurringBill>("/api/recurring", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useToggleRecurringBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; is_active: boolean }) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("recurring_bills")
          .update({ is_active: input.is_active })
          .eq("id", input.id);
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch<RecurringBill>(`/api/recurring/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: input.is_active }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useQueueRecurringBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bill: RecurringBill) => {
      if (isSupabaseConfigured && supabase) {
        const draft: ParsedCommandDraft = {
          transaction_type: bill.transaction_type,
          amount: bill.amount,
          category: bill.category,
          description: `${bill.title} (Tagihan Rutin ${bill.next_due_date})`,
          source_account_id: bill.transaction_type === "expense" ? bill.account_id : null,
          destination_account_id: bill.transaction_type === "income" ? bill.account_id : null,
          source_hint: null,
          destination_hint: null,
          transaction_date: todayISO(),
          confidence: bill.account_id ? "high" : "medium",
          warnings: bill.account_id
            ? []
            : [
                bill.transaction_type === "income"
                  ? "Pilih akun tujuan pemasukan sebelum menyetujui."
                  : "Pilih akun sumber dana sebelum menyetujui.",
              ],
        };

        const { data: insertedCmd, error: cmdErr } = await supabase
          .from("owner_commands")
          .insert({
            command_text: `[Tagihan Rutin] ${bill.title} · Rp ${bill.amount.toLocaleString("id-ID")} (Jatuh tempo ${bill.next_due_date})`,
            status: "pending",
            parsed_draft: draft,
          })
          .select("id")
          .single();
        if (cmdErr || !insertedCmd) {
          throw new Error(cmdErr?.message || "Gagal mengajukan tagihan rutin ke antrean.");
        }

        const nextDue = advanceDueDate(bill.next_due_date, bill.frequency);
        const { error: updErr } = await supabase
          .from("recurring_bills")
          .update({
            last_queued_date: bill.next_due_date,
            next_due_date: nextDue,
          })
          .eq("id", bill.id);
        if (updErr) {
          await supabase.from("owner_commands").delete().eq("id", insertedCmd.id);
          throw formatSupabaseTableWriteError(updErr);
        }
        return;
      }

      return apiFetch<{ command: OwnerCommand; bill: RecurringBill }>(
        `/api/recurring/${bill.id}/queue`,
        { method: "POST" }
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useDeleteRecurringBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("recurring_bills").delete().eq("id", id);
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch(`/api/recurring/${id}`, { method: "DELETE" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useCreateSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      goal_type: GoalType;
      target_amount: number;
      current_amount: number;
      linked_account_id: string | null;
      target_date: string | null;
      notes: string | null;
      owner_confirmed: boolean;
    }) => {
      validateSavingsGoalInput(input);
      if (isSupabaseConfigured && supabase) {
        const { owner_confirmed: _oc, ...payload } = input;
        const cleanCurrent = payload.linked_account_id
          ? 0
          : roundCurrency(payload.current_amount);
        const cleanTarget = roundCurrency(payload.target_amount);
        const { error } = await supabase.from("savings_goals").insert({
          ...payload,
          title: payload.title.trim(),
          target_amount: cleanTarget,
          current_amount: cleanCurrent,
          notes: payload.notes?.trim() || null,
          status:
            !payload.linked_account_id && cleanCurrent >= cleanTarget
              ? "completed"
              : "active",
        });
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch<SavingsGoal>("/api/goals", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useUpdateGoalProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      current_amount?: number;
      status?: GoalStatus;
      owner_confirmed?: boolean;
      target_amount?: number;
    }) => {
      if (input.current_amount !== undefined) {
        if (!input.owner_confirmed) {
          throw new Error("Persetujuan eksplisit Owner wajib dicentang.");
        }
        if (!Number.isFinite(input.current_amount) || input.current_amount < 0) {
          throw new Error("Nominal progres tabungan harus >= Rp 0.");
        }
      }
      if (isSupabaseConfigured && supabase) {
        const updates: Record<string, unknown> = {};
        if (input.current_amount !== undefined) {
          const cleanAmount = roundCurrency(input.current_amount);
          updates.current_amount = cleanAmount;
          if (
            input.target_amount !== undefined &&
            cleanAmount >= input.target_amount
          ) {
            updates.status = "completed";
          }
        }
        if (input.status) {
          updates.status = input.status;
        }
        const { error } = await supabase
          .from("savings_goals")
          .update(updates)
          .eq("id", input.id);
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch<SavingsGoal>(`/api/goals/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          current_amount: input.current_amount,
          status: input.status,
          owner_confirmed: input.owner_confirmed,
        }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useDeleteSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("savings_goals").delete().eq("id", id);
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch(`/api/goals/${id}`, { method: "DELETE" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export async function requestSpeechAudio(text: string, style?: string): Promise<string> {
  const res = await apiFetch<{ audioBase64: string; mimeType: string }>("/api/ai/tts", {
    method: "POST",
    body: JSON.stringify({ text, style }),
  });
  return `data:${res.mimeType};base64,${res.audioBase64}`;
}

export interface CreateReminderInput {
  title: string;
  reminder_type: ReminderCategory;
  transaction_type: TransactionType;
  amount: number;
  due_date: string;
  reminder_time: string;
  frequency: ReminderFrequency;
  remind_offsets: number[];
  custom_days_before: number | null;
  linked_account_id?: string | null;
  linked_goal_id?: string | null;
  linked_debt_id?: string | null;
  linked_bill_id?: string | null;
  dedupe_key?: string | null;
  notes?: string | null;
  owner_confirmed: boolean;
}

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateReminderInput) => {
      validateFinancialReminderInput(input);
      if (isSupabaseConfigured && supabase) {
        const cleanOffsets = normalizeReminderOffsets(input.remind_offsets, null);
        if (input.dedupe_key) {
          const { data: existing } = await supabase
            .from("financial_reminders")
            .select("id")
            .eq("dedupe_key", input.dedupe_key)
            .maybeSingle();
          if (existing) {
            throw new Error("Pengingat untuk jadwal atau sumber yang sama sudah terdaftar.");
          }
        }
        const { error } = await supabase.from("financial_reminders").insert({
          title: input.title.trim(),
          reminder_type: input.reminder_type,
          transaction_type: input.transaction_type,
          amount: roundCurrency(input.amount),
          due_date: input.due_date.slice(0, 10),
          reminder_time: input.reminder_time.slice(0, 5),
          frequency: input.frequency,
          remind_offsets: cleanOffsets,
          custom_days_before: input.custom_days_before,
          is_active: true,
          is_read: false,
          linked_account_id: input.linked_account_id ?? null,
          linked_goal_id: input.linked_goal_id ?? null,
          linked_debt_id: input.linked_debt_id ?? null,
          linked_bill_id: input.linked_bill_id ?? null,
          dedupe_key: input.dedupe_key ?? null,
          notes: input.notes?.trim() || null,
        });
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch<FinancialReminder>("/api/reminders", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useUpdateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      reminder_type?: ReminderCategory;
      transaction_type?: TransactionType;
      amount?: number;
      due_date?: string;
      reminder_time?: string;
      frequency?: ReminderFrequency;
      remind_offsets?: number[];
      custom_days_before?: number | null;
      linked_account_id?: string | null;
      notes?: string | null;
      is_active?: boolean;
      is_read?: boolean;
      reminderTitleForLog?: string;
      scheduledForLog?: string;
    }) => {
      if (isSupabaseConfigured && supabase) {
        const updates: Record<string, unknown> = {};
        if (input.title !== undefined) updates.title = input.title.trim();
        if (input.reminder_type !== undefined) updates.reminder_type = input.reminder_type;
        if (input.transaction_type !== undefined) updates.transaction_type = input.transaction_type;
        if (input.amount !== undefined) updates.amount = roundCurrency(input.amount);
        if (input.due_date !== undefined) {
          updates.due_date = input.due_date.slice(0, 10);
          updates.last_notified_key = null;
          updates.is_read = false;
          updates.read_at = null;
        }
        if (input.reminder_time !== undefined) updates.reminder_time = input.reminder_time.slice(0, 5);
        if (input.frequency !== undefined) updates.frequency = input.frequency;
        if (input.remind_offsets !== undefined) {
          updates.remind_offsets = normalizeReminderOffsets(input.remind_offsets, null);
        }
        if (input.custom_days_before !== undefined) {
          updates.custom_days_before = input.custom_days_before;
        }
        if (input.linked_account_id !== undefined) {
          updates.linked_account_id = input.linked_account_id;
        }
        if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;
        if (typeof input.is_active === "boolean") updates.is_active = input.is_active;
        if (typeof input.is_read === "boolean") {
          updates.is_read = input.is_read;
          updates.read_at = input.is_read ? new Date().toISOString() : null;
        }

        const { error } = await supabase
          .from("financial_reminders")
          .update(updates)
          .eq("id", input.id);
        if (error) throw formatSupabaseTableWriteError(error);

        const title = input.title ?? input.reminderTitleForLog ?? "Pengingat Keuangan";
        if (typeof input.is_active === "boolean") {
          await supabase.from("financial_reminder_logs").insert({
            reminder_id: input.id,
            reminder_title: title,
            event_type: input.is_active ? "resumed" : "paused",
            scheduled_for: input.scheduledForLog ?? null,
            notes: input.is_active ? "Pengingat diaktifkan kembali" : "Pengingat dinonaktifkan",
          });
        } else if (input.is_read === true) {
          await supabase.from("financial_reminder_logs").insert({
            reminder_id: input.id,
            reminder_title: title,
            event_type: "read",
            scheduled_for: input.scheduledForLog ?? null,
            notes: "Ditandai sudah dibaca oleh Owner",
          });
        }
        return;
      }

      return apiFetch<FinancialReminder>(`/api/reminders/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useMarkReminderRead() {
  const updateReminder = useUpdateReminder();
  return useMutation({
    mutationFn: async (input: { reminder: FinancialReminder; is_read: boolean }) => {
      return updateReminder.mutateAsync({
        id: input.reminder.id,
        is_read: input.is_read,
        reminderTitleForLog: input.reminder.title,
        scheduledForLog: input.reminder.due_date,
      });
    },
  });
}

export function useMarkAllRemindersRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (isSupabaseConfigured && supabase) {
        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from("financial_reminders")
          .update({ is_read: true, read_at: nowIso })
          .eq("is_active", true)
          .eq("is_read", false);
        if (error) throw formatSupabaseTableWriteError(error);
        return { ok: true };
      }
      return apiFetch<{ ok: boolean; updated: number }>("/api/reminders/mark-all-read", {
        method: "POST",
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useQueueReminderDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      reminder: FinancialReminder;
      owner_confirmed: boolean;
      advance_cycle?: boolean;
    }) => {
      if (!input.owner_confirmed) {
        throw new Error(
          "Persetujuan eksplisit Owner wajib dicentang sebelum mengirim draf ke antrean."
        );
      }

      if (isSupabaseConfigured && supabase) {
        const r = input.reminder;
        const warnings: string[] = [];
        if (r.transaction_type === "transfer") {
          warnings.push("Pilih akun sumber dan akun tujuan transfer sebelum menyetujui.");
        } else if (!r.linked_account_id) {
          warnings.push(
            r.transaction_type === "income"
              ? "Pilih akun tujuan pemasukan sebelum menyetujui."
              : "Pilih akun sumber dana sebelum menyetujui."
          );
        }

        const draft: ParsedCommandDraft = {
          transaction_type: r.transaction_type,
          amount: r.amount > 0 ? r.amount : null,
          category:
            r.reminder_type === "cicilan_utang"
              ? "Utang & Cicilan"
              : r.reminder_type === "tanggal_gajian" ||
                  r.reminder_type === "pemasukan_rutin"
                ? "Gaji & Pendapatan"
                : r.reminder_type === "setoran_tabungan" ||
                    r.reminder_type === "target_keuangan"
                  ? "Transfer Internal"
                  : "Utilitas & Tagihan",
          description: `${r.title} (Pengingat ${r.due_date})`,
          source_account_id: r.transaction_type === "expense" ? r.linked_account_id : null,
          destination_account_id:
            r.transaction_type === "income" || r.transaction_type === "transfer"
              ? r.linked_account_id
              : null,
          source_hint: null,
          destination_hint: null,
          transaction_date: todayISO(),
          confidence: r.linked_account_id && r.amount > 0 ? "high" : "medium",
          warnings,
        };

        const { data: insertedCmd, error: cmdErr } = await supabase
          .from("owner_commands")
          .insert({
            command_text: `[Pengingat] ${r.title} · Rp ${r.amount.toLocaleString("id-ID")} (Jatuh tempo ${r.due_date})`,
            status: "pending",
            parsed_draft: draft,
          })
          .select("id")
          .single();

        if (cmdErr || !insertedCmd) {
          throw new Error(cmdErr?.message || "Gagal mengajukan draf ke Owner Control.");
        }

        const updates: Record<string, unknown> = {
          is_read: true,
          read_at: new Date().toISOString(),
        };
        let nextDue = r.due_date;
        if (r.frequency !== "once" && input.advance_cycle !== false) {
          nextDue = advanceReminderDueDate(r.due_date, r.frequency);
          updates.due_date = nextDue;
          updates.last_notified_key = null;
        }

        const { error: remErr } = await supabase
          .from("financial_reminders")
          .update(updates)
          .eq("id", r.id);
        if (remErr) {
          await supabase.from("owner_commands").delete().eq("id", insertedCmd.id);
          throw formatSupabaseTableWriteError(remErr);
        }

        await supabase.from("financial_reminder_logs").insert({
          reminder_id: r.id,
          reminder_title: r.title,
          event_type: "draft_queued",
          scheduled_for: nextDue,
          notes: "Draf dikirim ke Owner Control; saldo menunggu konfirmasi Owner.",
        });
        return;
      }

      return apiFetch<{ command: OwnerCommand; reminder: FinancialReminder }>(
        `/api/reminders/${input.reminder.id}/queue-draft`,
        {
          method: "POST",
          body: JSON.stringify({
            owner_confirmed: input.owner_confirmed,
            advance_cycle: input.advance_cycle,
          }),
        }
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useSyncRemindersFromSources() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      bills: RecurringBill[];
      debts: Debt[];
      existingReminders: FinancialReminder[];
    }) => {
      if (isSupabaseConfigured && supabase) {
        const { data: userData } = await supabase.auth.getUser();
        const ownerId = userData.user?.id;
        if (!ownerId) throw new Error("Sesi Owner tidak ditemukan.");
        const payloads = buildSourceSyncReminders(
          input.bills,
          input.debts,
          input.existingReminders,
          ownerId
        );
        if (payloads.length === 0) return { createdCount: 0 };
        const rows = payloads.map(({ owner_id: _oid, ...rest }) => rest);
        const { error } = await supabase.from("financial_reminders").insert(rows);
        if (error) throw formatSupabaseTableWriteError(error);
        return { createdCount: rows.length };
      }

      return apiFetch<{ createdCount: number }>("/api/reminders/sync-sources", {
        method: "POST",
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useRecordReminderTriggered() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      reminder: FinancialReminder;
      notification_key: string;
      trigger_offset: number | null;
    }) => {
      if (input.reminder.last_notified_key === input.notification_key) {
        return { deduped: true };
      }
      if (isSupabaseConfigured && supabase) {
        const nowIso = new Date().toISOString();
        const { error: updErr } = await supabase
          .from("financial_reminders")
          .update({
            last_notified_key: input.notification_key,
            last_notified_at: nowIso,
          })
          .eq("id", input.reminder.id);
        if (updErr) throw formatSupabaseTableWriteError(updErr);

        await supabase.from("financial_reminder_logs").insert({
          reminder_id: input.reminder.id,
          reminder_title: input.reminder.title,
          event_type: "triggered",
          trigger_offset: input.trigger_offset,
          scheduled_for: input.reminder.due_date,
          notes:
            input.trigger_offset === -1
              ? `Pengingat keterlambatan ditampilkan (${input.reminder.due_date})`
              : `Pengingat H-${input.trigger_offset ?? 0} ditampilkan pada ${input.reminder.reminder_time}`,
        });
        return { deduped: false };
      }

      return apiFetch<{ deduped: boolean }>(
        `/api/reminders/${input.reminder.id}/log-trigger`,
        {
          method: "POST",
          body: JSON.stringify({
            notification_key: input.notification_key,
            trigger_offset: input.trigger_offset,
          }),
        }
      );
    },
    onSuccess: async (res) => {
      if (!res?.deduped) {
        await qc.invalidateQueries({ queryKey: egoKeys.vault });
      }
    },
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("financial_reminders").delete().eq("id", id);
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch(`/api/reminders/${id}`, { method: "DELETE" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

// =========================================================
// SMART BUDGET MONITOR MUTATIONS
// =========================================================
export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      category: string;
      period_month: string;
      limit_amount: number;
      is_active?: boolean;
      notes?: string;
      owner_confirmed: boolean;
    }) => {
      const normalized = {
        category: input.category.trim(),
        period_month: input.period_month.trim(),
        limit_amount: roundCurrency(input.limit_amount),
        is_active: input.is_active ?? true,
        notes: input.notes?.trim() ? input.notes.trim().slice(0, 240) : null,
      };
      validateCategoryBudgetInput({
        category: normalized.category,
        period_month: normalized.period_month,
        limit_amount: normalized.limit_amount,
        owner_confirmed: input.owner_confirmed,
      });

      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from("category_budgets")
          .insert({
            category: normalized.category,
            period_month: normalized.period_month,
            limit_amount: normalized.limit_amount,
            is_active: normalized.is_active,
            notes: normalized.notes,
          })
          .select("*")
          .single();
        if (error) {
          if (error.code === "23505") {
            throw new Error(
              `Anggaran kategori "${normalized.category}" untuk periode ${normalized.period_month} sudah tersedia.`
            );
          }
          throw formatSupabaseTableWriteError(error);
        }

        if (data) {
          await supabase.from("budget_alert_logs").insert({
            budget_id: data.id,
            category: normalized.category,
            period_month: normalized.period_month,
            threshold_level: 0,
            spent_amount: 0,
            limit_amount: normalized.limit_amount,
            usage_pct: 0,
            event_type: "created",
            notes: `Anggaran dibuat sebesar Rp ${normalized.limit_amount.toLocaleString("id-ID")}`,
          });
        }
        return data as CategoryBudget;
      }

      return apiFetch<CategoryBudget>("/api/budgets", {
        method: "POST",
        body: JSON.stringify({
          ...normalized,
          owner_confirmed: input.owner_confirmed,
        }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      category?: string;
      period_month?: string;
      limit_amount?: number;
      is_active?: boolean;
      notes?: string | null;
      owner_confirmed?: boolean;
      previousPeriodMonth?: string;
      budgetCategoryForLog?: string;
      budgetLimitForLog?: number;
    }) => {
      const hasEditField =
        input.category !== undefined ||
        input.period_month !== undefined ||
        input.limit_amount !== undefined ||
        input.notes !== undefined;

      if (hasEditField) {
        validateCategoryBudgetInput({
          category: (input.category ?? input.budgetCategoryForLog ?? "").trim(),
          period_month: (input.period_month ?? input.previousPeriodMonth ?? "").trim(),
          limit_amount: roundCurrency(
            input.limit_amount ?? input.budgetLimitForLog ?? 0
          ),
          owner_confirmed: input.owner_confirmed === true,
        });
      }

      if (isSupabaseConfigured && supabase) {
        const updates: Record<string, unknown> = {};
        if (input.category !== undefined) updates.category = input.category.trim();
        if (input.period_month !== undefined) {
          updates.period_month = input.period_month.trim();
          if (
            input.previousPeriodMonth &&
            input.period_month.trim() !== input.previousPeriodMonth
          ) {
            updates.last_alert_threshold = null;
            updates.last_alert_period = null;
          }
        }
        if (input.limit_amount !== undefined) {
          updates.limit_amount = roundCurrency(input.limit_amount);
        }
        if (input.notes !== undefined) {
          updates.notes = input.notes?.trim() ? input.notes.trim().slice(0, 240) : null;
        }
        if (typeof input.is_active === "boolean") {
          updates.is_active = input.is_active;
        }

        const { data, error } = await supabase
          .from("category_budgets")
          .update(updates)
          .eq("id", input.id)
          .select("*")
          .single();

        if (error) {
          if (error.code === "23505") {
            throw new Error(
              "Anggaran untuk kategori dan periode bulan tersebut sudah ada."
            );
          }
          throw formatSupabaseTableWriteError(error);
        }

        if (data) {
          const cat = (data as CategoryBudget).category;
          const period = (data as CategoryBudget).period_month;
          const limit = Number((data as CategoryBudget).limit_amount) || 1;
          if (typeof input.is_active === "boolean" && !hasEditField) {
            await supabase.from("budget_alert_logs").insert({
              budget_id: input.id,
              category: cat,
              period_month: period,
              threshold_level: 0,
              spent_amount: 0,
              limit_amount: limit,
              usage_pct: 0,
              event_type: input.is_active ? "resumed" : "paused",
              notes: input.is_active
                ? "Pemantauan anggaran diaktifkan kembali"
                : "Pemantauan anggaran dinonaktifkan sementara",
            });
          } else if (hasEditField) {
            await supabase.from("budget_alert_logs").insert({
              budget_id: input.id,
              category: cat,
              period_month: period,
              threshold_level: 0,
              spent_amount: 0,
              limit_amount: limit,
              usage_pct: 0,
              event_type: "updated",
              notes: `Batas anggaran diperbarui menjadi Rp ${limit.toLocaleString("id-ID")}`,
            });
          }
        }
        return data as CategoryBudget;
      }

      return apiFetch<CategoryBudget>(`/api/budgets/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("category_budgets").delete().eq("id", id);
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch(`/api/budgets/${id}`, { method: "DELETE" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useCopyMonthBudgets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      from_month: string;
      to_month: string;
      sourceBudgets: CategoryBudget[];
      existingTargetBudgets: CategoryBudget[];
      owner_confirmed: boolean;
    }) => {
      if (!input.owner_confirmed) {
        throw new Error(
          "Konfirmasi Owner diperlukan untuk menyalin anggaran bulan sebelumnya."
        );
      }

      if (isSupabaseConfigured && supabase) {
        const existingKeys = new Set(
          input.existingTargetBudgets.map((b) => normalizeBudgetCategoryKey(b.category))
        );
        const candidates = input.sourceBudgets.filter(
          (b) =>
            b.period_month === input.from_month &&
            b.is_active &&
            !existingKeys.has(normalizeBudgetCategoryKey(b.category))
        );
        if (candidates.length === 0) return { copiedCount: 0 };

        const rows = candidates.map((src) => ({
          category: src.category,
          period_month: input.to_month,
          limit_amount: roundCurrency(src.limit_amount),
          is_active: true,
          notes: src.notes ?? null,
        }));
        const { data, error } = await supabase
          .from("category_budgets")
          .insert(rows)
          .select("*");
        if (error) throw formatSupabaseTableWriteError(error);

        const inserted = (data ?? []) as CategoryBudget[];
        if (inserted.length > 0) {
          await supabase.from("budget_alert_logs").insert(
            inserted.map((b) => ({
              budget_id: b.id,
              category: b.category,
              period_month: b.period_month,
              threshold_level: 0,
              spent_amount: 0,
              limit_amount: b.limit_amount,
              usage_pct: 0,
              event_type: "created",
              notes: `Disalin dari periode ${input.from_month}`,
            }))
          );
        }
        return { copiedCount: inserted.length };
      }

      return apiFetch<{ copiedCount: number }>("/api/budgets/copy-month", {
        method: "POST",
        body: JSON.stringify({
          from_month: input.from_month,
          to_month: input.to_month,
          owner_confirmed: input.owner_confirmed,
        }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useRecordBudgetAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      budget: CategoryBudget;
      period_month: string;
      threshold_level: BudgetThresholdLevel;
      spent_amount: number;
      usage_pct: number;
      existingLogs: BudgetAlertLog[];
    }) => {
      if (
        isThresholdAlreadyNotified(
          input.budget,
          input.period_month,
          input.threshold_level,
          input.existingLogs
        )
      ) {
        return { deduped: true };
      }

      if (isSupabaseConfigured && supabase) {
        const { error: updErr } = await supabase
          .from("category_budgets")
          .update({
            last_alert_threshold: input.threshold_level,
            last_alert_period: input.period_month,
          })
          .eq("id", input.budget.id);
        if (updErr) throw formatSupabaseTableWriteError(updErr);

        const { error: logErr } = await supabase.from("budget_alert_logs").insert({
          budget_id: input.budget.id,
          category: input.budget.category,
          period_month: input.period_month,
          threshold_level: input.threshold_level,
          spent_amount: roundCurrency(input.spent_amount),
          limit_amount: roundCurrency(input.budget.limit_amount),
          usage_pct: Math.round(input.usage_pct * 10) / 10,
          event_type: "threshold_crossed",
          notes: `${budgetThresholdLabel(input.threshold_level)} (${input.usage_pct.toFixed(1)}%)`,
        });

        // 23505 = partial unique index hit; already logged for this threshold & period
        if (logErr && logErr.code !== "23505") {
          throw formatSupabaseTableWriteError(logErr);
        }
        return { deduped: logErr?.code === "23505" };
      }

      return apiFetch<{ deduped: boolean }>(
        `/api/budgets/${input.budget.id}/log-alert`,
        {
          method: "POST",
          body: JSON.stringify({
            period_month: input.period_month,
            threshold_level: input.threshold_level,
            spent_amount: input.spent_amount,
            usage_pct: input.usage_pct,
          }),
        }
      );
    },
    onSuccess: async (res) => {
      if (!res?.deduped) {
        await qc.invalidateQueries({ queryKey: egoKeys.vault });
      }
    },
  });
}

export function useSaveWhatIfScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      params: WhatIfScenarioParams;
      result_summary: WhatIfSimulationResult;
    }) => {
      validateWhatIfScenarioInput({
        title: input.params.title,
        scenario_type: input.params.scenario_type,
        amount: input.params.amount,
        tenor_months: input.params.tenor_months,
        annual_interest_pct: input.params.annual_interest_pct,
      });

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("whatif_scenarios").insert({
          title: input.params.title.trim(),
          scenario_type: input.params.scenario_type,
          params: input.params,
          result_summary: input.result_summary,
          risk_level: input.result_summary.riskLevel,
        });
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }

      return apiFetch<WhatIfScenarioRecord>("/api/whatif-scenarios", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useDeleteWhatIfScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("whatif_scenarios").delete().eq("id", id);
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch(`/api/whatif-scenarios/${id}`, { method: "DELETE" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useSaveHealthScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      period_month: string;
      total_score: number | null;
      grade: FinancialHealthScoreSnapshot["grade"];
      available_weight: number;
      is_data_incomplete: boolean;
      components: FinancialHealthScoreSnapshot["components"];
    }) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("financial_health_scores").insert({
          period_month: input.period_month,
          total_score: input.total_score,
          grade: input.grade,
          available_weight: input.available_weight,
          is_data_incomplete: input.is_data_incomplete,
          components: input.components,
        });
        if (error) throw formatSupabaseTableWriteError(error);
        return;
      }
      return apiFetch<FinancialHealthScoreSnapshot>("/api/health-scores", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: egoKeys.vault });
    },
  });
}

export function useFinancialAdvisor() {
  return useMutation({
    mutationFn: async (input: {
      question: string;
      contextBrief: string;
      missingIndicators?: string[];
    }) => {
      return apiFetch<AiAdvisorResponse>("/api/ai/advisor", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
  });
}



