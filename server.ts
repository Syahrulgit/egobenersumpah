import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import "./server/loadEnv";
import express from "express";
import { WebSocketServer } from "ws";
import { parseNaturalCommand } from "./src/lib/command-parser";
import {
  advanceDueDate,
  computeAccountBalances,
  roundCurrency,
  todayISO,
} from "./src/lib/finance";
import type {
  Account,
  Asset,
  BudgetAlertLog,
  BudgetThresholdLevel,
  CategoryBudget,
  Debt,
  DebtPaymentFrequency,
  DebtPaymentLog,
  DebtType,
  FinancialHealthScoreSnapshot,
  FinancialReminder,
  FinancialReminderLog,
  OwnerCommand,
  OwnerPreferences,
  ParsedCommandDraft,
  RecurringBill,
  SavingsGoal,
  Transaction,
  WhatIfScenarioParams,
  WhatIfScenarioRecord,
  WhatIfSimulationResult,
} from "./src/types/ego";
import {
  budgetThresholdLabel,
  classifyBudgetThreshold,
  computeConfirmedExpensesByCategoryForMonth,
  isThresholdAlreadyNotified,
  normalizeBudgetCategoryKey,
} from "./src/lib/budgets";
import { normalizeDebt } from "./src/lib/debt-manager";
import {
  advanceReminderDueDate,
  buildSourceSyncReminders,
  normalizeReminderOffsets,
} from "./src/lib/reminders";
import {
  createAuthedSupabaseClient,
  isServerSupabaseConfigured,
  verifyOwnerToken,
} from "./server/authVerify";
import {
  attachLiveVoiceSession,
  classifyGeminiError,
  runFinancialAdvisor,
  runFinancialSearch,
  scanReceiptToDraft,
  synthesizeIndonesianTTS,
} from "./server/gemini";
import {
  OWNER_EMAIL_REGEX,
  assertSingleOwnerAvailable,
  createEmptyVault,
  createLoginRateLimiter,
  validateAccountInput,
  validateAssetInput,
  validateCategoryBudgetInput,
  validateChangePasswordInput,
  validateDebtInput,
  validateDebtPayment,
  validateFinancialReminderInput,
  validateOwnerEmailUpdateInput,
  validatePinFormat,
  validateRecurringBillInput,
  validateResetOwnerConfirmation,
  validateSavingsGoalInput,
  validateTransactionInvariants,
  validateWhatIfScenarioInput,
} from "./server/vaultRules";
import {
  clearAllSessions,
  createSession,
  hashPassword,
  loadVault,
  revokeSessionToken,
  rotateSessionsForOwner,
  saveVault,
  validateSessionToken,
  verifyPassword,
} from "./server/vaultStore";

const PORT =
  process.env.NODE_ENV === "production"
    ? Number(process.env.PORT) || 3000
    : 3000;
const loginRateLimiter = createLoginRateLimiter(5, 15 * 60 * 1000);
const passwordRateLimiter = createLoginRateLimiter(5, 15 * 60 * 1000);
const pinRateLimiter = createLoginRateLimiter(5, 15 * 60 * 1000);

function extractToken(req: express.Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [k, ...rest] = part.trim().split("=");
      if (k === "ego_session") {
        return decodeURIComponent(rest.join("="));
      }
    }
  }
  return undefined;
}

function isHttpsRequest(req: express.Request): boolean {
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  return req.secure || forwardedProto === "https";
}

function setSessionCookie(req: express.Request, res: express.Response, token: string): void {
  const https = isHttpsRequest(req);
  res.cookie("ego_session", token, {
    httpOnly: true,
    secure: https,
    sameSite: https ? "none" : "lax",
    partitioned: https,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(req: express.Request, res: express.Response): void {
  const https = isHttpsRequest(req);
  res.clearCookie("ego_session", {
    httpOnly: true,
    secure: https,
    sameSite: https ? "none" : "lax",
    partitioned: https,
    path: "/",
  });
}

function verifyMutationOrigin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }
  // Requests carrying explicit custom header or Bearer header cannot be forged by plain cross-site forms
  if (req.headers["x-requested-with"] === "EGO-Vault-SPA" || req.headers.authorization?.startsWith("Bearer ")) {
    next();
    return;
  }
  const origin = req.headers.origin;
  const expectedHost = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "")
    .split(",")[0]
    .trim();
  if (origin && expectedHost) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === expectedHost) {
        next();
        return;
      }
    } catch {
      // Invalid origin URL
    }
  }
  res.status(403).json({ error: "Asal permintaan tidak diizinkan." });
}

async function requireOwner(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  const token = extractToken(req);
  const verified = await verifyOwnerToken(token);
  if (!verified) {
    res.status(401).json({ error: "Autentikasi Owner diperlukan." });
    return;
  }
  (req as express.Request & { ownerId: string }).ownerId = verified.ownerId;
  next();
}

async function startServer(): Promise<void> {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "6mb" }));
  app.use("/api", verifyMutationOrigin);

  app.get("/api/health", (_req, res) => {
    const supabaseConfigured = isServerSupabaseConfigured();
    res.json({
      ok: true,
      mode: supabaseConfigured ? "supabase" : "local",
      supabaseConfigured,
      timestamp: new Date().toISOString(),
    });
  });

  // =========================================================
  // AUTH ROUTES (SINGLE-OWNER GUARD)
  // =========================================================
  app.get("/api/auth/status", (req, res) => {
    const db = loadVault();
    const token = extractToken(req);
    const sessionOwnerId = validateSessionToken(token);
    const authenticated =
      Boolean(sessionOwnerId && db.owner && db.owner.id === sessionOwnerId);

    res.json({
      hasOwner: db.owner !== null,
      authenticated,
      hasPin: authenticated ? Boolean(db.owner?.pin_hash) : false,
      owner: authenticated && db.owner
        ? {
            id: db.owner.id,
            email: db.owner.email,
            full_name: db.owner.full_name,
            created_at: db.owner.created_at,
          }
        : null,
    });
  });

  app.post("/api/auth/register", (req, res) => {
    try {
      const db = loadVault();
      assertSingleOwnerAvailable(db);

      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const password = String(req.body?.password ?? "");
      const fullName = String(req.body?.full_name ?? "Owner Utama").trim() || "Owner Utama";

      if (!email || !OWNER_EMAIL_REGEX.test(email)) {
        res.status(400).json({ error: "Format email Owner tidak valid." });
        return;
      }
      if (fullName.length < 1 || fullName.length > 80) {
        res.status(400).json({ error: "Nama panggilan Owner wajib 1–80 karakter." });
        return;
      }
      if (password.length < 6 || password.length > 128) {
        res.status(400).json({ error: "Kata sandi wajib 6–128 karakter." });
        return;
      }

      const ownerId = crypto.randomUUID();
      db.owner = {
        id: ownerId,
        email,
        full_name: fullName,
        password_hash: hashPassword(password),
        created_at: new Date().toISOString(),
      };
      saveVault(db);

      const clientKey = req.ip || "local-owner";
      loginRateLimiter.reset(clientKey);
      const token = createSession(ownerId);
      setSessionCookie(req, res, token);
      res.status(201).json({
        token,
        owner: {
          id: db.owner.id,
          email: db.owner.email,
          full_name: db.owner.full_name,
          created_at: db.owner.created_at,
        },
      });
    } catch (err) {
      res.status(403).json({
        error: err instanceof Error ? err.message : "Registrasi Owner ditolak.",
      });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const clientKey = req.ip || "local-owner";
    const rateCheck = loginRateLimiter.check(clientKey);
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: rateCheck.message,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      });
      return;
    }

    const db = loadVault();
    if (!db.owner) {
      res.status(404).json({
        error: "Belum ada akun Owner terdaftar. Silakan registrasi Owner perdana.",
      });
      return;
    }

    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (
      email !== db.owner.email ||
      !verifyPassword(password, db.owner.password_hash)
    ) {
      const failure = loginRateLimiter.recordFailure(clientKey);
      res.status(failure.allowed ? 401 : 429).json({
        error: failure.allowed
          ? `Email atau kata sandi Owner tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.`
          : failure.message,
        remainingAttempts: failure.remainingAttempts,
        retryAfterSeconds: failure.retryAfterSeconds,
      });
      return;
    }

    loginRateLimiter.reset(clientKey);
    const token = createSession(db.owner.id);
    setSessionCookie(req, res, token);
    res.json({
      token,
      owner: {
        id: db.owner.id,
        email: db.owner.email,
        full_name: db.owner.full_name,
        created_at: db.owner.created_at,
      },
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = extractToken(req);
    revokeSessionToken(token);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.post("/api/auth/reset-owner", (req, res) => {
    try {
      const db = loadVault();
      if (!db.owner) {
        clearAllSessions();
        clearSessionCookie(req, res);
        loginRateLimiter.reset(req.ip || "local-owner");
        res.json({ ok: true, hasOwner: false });
        return;
      }

      validateResetOwnerConfirmation({
        confirmed: req.body?.confirmed === true,
        confirmation_text: String(req.body?.confirmation_text ?? ""),
      });

      const previousOwnerId = db.owner.id;
      const clientKey = req.ip || "local-owner";

      saveVault(createEmptyVault());
      clearAllSessions();
      clearSessionCookie(req, res);
      loginRateLimiter.reset(clientKey);
      passwordRateLimiter.reset(`${previousOwnerId}:${clientKey}`);
      pinRateLimiter.reset(`${previousOwnerId}:${clientKey}`);

      res.json({ ok: true, hasOwner: false });
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : "Gagal menghapus akun Owner lokal.",
      });
    }
  });

  app.patch("/api/auth/profile", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        });
        return;
      }

      const normalized = validateOwnerEmailUpdateInput({
        email: String(req.body?.email ?? ""),
        full_name: String(req.body?.full_name ?? ""),
        current_password: String(req.body?.current_password ?? ""),
      });

      const db = loadVault();
      if (!db.owner || db.owner.id !== ownerId) {
        res.status(404).json({ error: "Akun Owner tidak ditemukan." });
        return;
      }

      if (!verifyPassword(String(req.body?.current_password ?? ""), db.owner.password_hash)) {
        const failure = passwordRateLimiter.recordFailure(clientKey);
        res.status(failure.allowed ? 401 : 429).json({
          error: failure.allowed
            ? `Kata sandi saat ini tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.`
            : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds,
        });
        return;
      }

      passwordRateLimiter.reset(clientKey);
      db.owner.email = normalized.email;
      db.owner.full_name = normalized.full_name;
      saveVault(db);

      res.json({
        ok: true,
        owner: {
          id: db.owner.id,
          email: db.owner.email,
          full_name: db.owner.full_name,
          created_at: db.owner.created_at,
        },
      });
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : "Gagal memperbarui identitas Owner.",
      });
    }
  });

  app.delete("/api/auth/owner", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        });
        return;
      }

      if (req.body?.confirmed !== true) {
        res.status(400).json({
          error: "Centang konfirmasi penghapusan akun Owner terlebih dahulu.",
        });
        return;
      }

      const currentPassword = String(req.body?.current_password ?? "");
      if (!currentPassword) {
        res.status(400).json({
          error: "Masukkan kata sandi Owner saat ini untuk verifikasi.",
        });
        return;
      }

      const db = loadVault();
      if (!db.owner || db.owner.id !== ownerId) {
        res.status(404).json({ error: "Akun Owner tidak ditemukan." });
        return;
      }

      if (!verifyPassword(currentPassword, db.owner.password_hash)) {
        const failure = passwordRateLimiter.recordFailure(clientKey);
        res.status(failure.allowed ? 401 : 429).json({
          error: failure.allowed
            ? `Kata sandi Owner tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.`
            : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds,
        });
        return;
      }

      saveVault(createEmptyVault());
      clearAllSessions();
      clearSessionCookie(req, res);
      loginRateLimiter.reset(req.ip || "local-owner");
      passwordRateLimiter.reset(clientKey);
      pinRateLimiter.reset(clientKey);

      res.json({ ok: true, hasOwner: false });
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : "Gagal menghapus akun Owner.",
      });
    }
  });

  app.post("/api/auth/change-password", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        });
        return;
      }

      const currentPassword = String(req.body?.current_password ?? "");
      const newPassword = String(req.body?.new_password ?? "");
      validateChangePasswordInput({
        current_password: currentPassword,
        new_password: newPassword,
      });

      const db = loadVault();
      if (!db.owner || db.owner.id !== ownerId) {
        res.status(404).json({ error: "Akun Owner tidak ditemukan." });
        return;
      }

      if (!verifyPassword(currentPassword, db.owner.password_hash)) {
        const failure = passwordRateLimiter.recordFailure(clientKey);
        res.status(failure.allowed ? 401 : 429).json({
          error: failure.allowed
            ? `Kata sandi saat ini tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.`
            : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds,
        });
        return;
      }

      passwordRateLimiter.reset(clientKey);
      db.owner.password_hash = hashPassword(newPassword);
      saveVault(db);

      const currentToken = extractToken(req);
      rotateSessionsForOwner(ownerId, currentToken);

      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal mengganti kata sandi.",
      });
    }
  });

  app.post("/api/auth/pin/setup", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        });
        return;
      }

      const currentPassword = String(req.body?.current_password ?? "");
      const pin = String(req.body?.pin ?? "").trim();
      validatePinFormat(pin);

      const db = loadVault();
      if (!db.owner || db.owner.id !== ownerId) {
        res.status(404).json({ error: "Akun Owner tidak ditemukan." });
        return;
      }

      if (!verifyPassword(currentPassword, db.owner.password_hash)) {
        const failure = passwordRateLimiter.recordFailure(clientKey);
        res.status(failure.allowed ? 401 : 429).json({
          error: failure.allowed
            ? `Kata sandi Owner tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.`
            : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds,
        });
        return;
      }

      passwordRateLimiter.reset(clientKey);
      pinRateLimiter.reset(clientKey);
      db.owner.pin_hash = hashPassword(pin);
      saveVault(db);

      res.json({ ok: true, hasPin: true });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal mengaktifkan kunci PIN.",
      });
    }
  });

  app.post("/api/auth/pin/verify", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = pinRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        });
        return;
      }

      const pin = String(req.body?.pin ?? "").trim();
      validatePinFormat(pin);

      const db = loadVault();
      if (!db.owner || db.owner.id !== ownerId || !db.owner.pin_hash) {
        res.status(400).json({ error: "Kunci PIN belum diaktifkan untuk akun ini." });
        return;
      }

      if (!verifyPassword(pin, db.owner.pin_hash)) {
        const failure = pinRateLimiter.recordFailure(clientKey);
        res.status(failure.allowed ? 401 : 429).json({
          error: failure.allowed
            ? `PIN 6 digit tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.`
            : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds,
        });
        return;
      }

      pinRateLimiter.reset(clientKey);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Verifikasi PIN gagal.",
      });
    }
  });

  app.post("/api/auth/pin/disable", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        });
        return;
      }

      const currentPassword = String(req.body?.current_password ?? "");
      const db = loadVault();
      if (!db.owner || db.owner.id !== ownerId) {
        res.status(404).json({ error: "Akun Owner tidak ditemukan." });
        return;
      }

      if (!verifyPassword(currentPassword, db.owner.password_hash)) {
        const failure = passwordRateLimiter.recordFailure(clientKey);
        res.status(failure.allowed ? 401 : 429).json({
          error: failure.allowed
            ? `Kata sandi Owner tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.`
            : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds,
        });
        return;
      }

      passwordRateLimiter.reset(clientKey);
      pinRateLimiter.reset(clientKey);
      db.owner.pin_hash = null;
      saveVault(db);

      res.json({ ok: true, hasPin: false });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menonaktifkan kunci PIN.",
      });
    }
  });

  // =========================================================
  // VAULT DATA & MUTATION ROUTES (OWNER-ONLY)
  // =========================================================
  app.get("/api/vault/snapshot", requireOwner, (_req, res) => {
    const db = loadVault();
    const accountBalances = computeAccountBalances(db.accounts, db.transactions);
    res.json({
      accounts: accountBalances,
      transactions: [...db.transactions].sort((a, b) =>
        b.transaction_date === a.transaction_date
          ? b.created_at.localeCompare(a.created_at)
          : b.transaction_date.localeCompare(a.transaction_date)
      ),
      assets: [...db.assets].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      debts: [...db.debts]
        .map(normalizeDebt)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      debt_payment_logs: [...(db.debt_payment_logs ?? [])]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 200),
      owner_commands: [...db.owner_commands].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      ),
      recurring_bills: [...(db.recurring_bills ?? [])].sort((a, b) =>
        a.next_due_date.localeCompare(b.next_due_date)
      ),
      savings_goals: [...(db.savings_goals ?? [])].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      ),
      financial_reminders: [...(db.financial_reminders ?? [])].sort((a, b) =>
        a.due_date.localeCompare(b.due_date)
      ),
      financial_reminder_logs: [...(db.financial_reminder_logs ?? [])]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 120),
      remindersTableReady: true,
      category_budgets: [...(db.category_budgets ?? [])].sort((a, b) =>
        a.period_month === b.period_month
          ? a.category.localeCompare(b.category, "id")
          : b.period_month.localeCompare(a.period_month)
      ),
      budget_alert_logs: [...(db.budget_alert_logs ?? [])]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 150),
      budgetsTableReady: true,
      whatif_scenarios: [...(db.whatif_scenarios ?? [])]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 60),
      financial_health_scores: [...(db.financial_health_scores ?? [])]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 60),
      ecosystemTablesReady: true,
      preferences: db.preferences,
    });
  });

  app.post("/api/accounts", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      const accountName = String(req.body?.account_name ?? "").trim();
      const accountType = String(req.body?.account_type ?? "") as Account["account_type"];
      const openingBalance = Number(req.body?.opening_balance ?? 0);

      validateAccountInput({
        account_name: accountName,
        account_type: accountType,
        opening_balance: openingBalance,
        owner_confirmed: ownerConfirmed,
      });

      const db = loadVault();
      const newAccount: Account = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        account_name: accountName,
        account_type: accountType,
        opening_balance: roundCurrency(openingBalance),
        currency: "IDR",
        is_active: true,
        created_at: new Date().toISOString(),
      };
      db.accounts.push(newAccount);
      saveVault(db);
      res.status(201).json(newAccount);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal membuat akun.",
      });
    }
  });

  app.patch("/api/accounts/:id/archive", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    if (typeof req.body?.is_active !== "boolean") {
      res.status(400).json({ error: "Status aktif akun wajib berupa boolean." });
      return;
    }
    const db = loadVault();
    const acc = db.accounts.find((a) => a.id === req.params.id && a.owner_id === ownerId);
    if (!acc) {
      res.status(404).json({ error: "Akun tidak ditemukan." });
      return;
    }
    acc.is_active = req.body.is_active;
    saveVault(db);
    res.json(acc);
  });

  app.post("/api/transactions", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const db = loadVault();

      const txType = req.body?.transaction_type as Transaction["transaction_type"];
      const sourceId = req.body?.source_account_id ? String(req.body.source_account_id) : null;
      const destId = req.body?.destination_account_id
        ? String(req.body.destination_account_id)
        : null;
      const amount = Number(req.body?.amount ?? 0);
      const txDate = String(req.body?.transaction_date ?? todayISO()).slice(0, 10);
      const category = req.body?.category ? String(req.body.category).trim() : null;
      const description = req.body?.description ? String(req.body.description).trim() : null;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      const status: Transaction["status"] = ownerConfirmed ? "posted" : "pending";

      validateTransactionInvariants(
        {
          owner_id: ownerId,
          transaction_type: txType,
          source_account_id: sourceId,
          destination_account_id: destId,
          amount,
          status,
          owner_confirmed: ownerConfirmed,
        },
        db.accounts
      );

      const newTx: Transaction = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        transaction_type: txType,
        source_account_id: txType === "income" ? null : sourceId,
        destination_account_id: txType === "expense" ? null : destId,
        amount: roundCurrency(amount),
        transaction_date: txDate || todayISO(),
        category,
        description,
        status,
        owner_confirmed: ownerConfirmed,
        created_at: new Date().toISOString(),
      };

      db.transactions.unshift(newTx);
      saveVault(db);
      res.status(201).json(newTx);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal mencatat transaksi.",
      });
    }
  });

  app.patch("/api/transactions/:id/cancel", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    const tx = db.transactions.find((t) => t.id === req.params.id && t.owner_id === ownerId);
    if (!tx) {
      res.status(404).json({ error: "Transaksi tidak ditemukan." });
      return;
    }
    if (tx.status === "cancelled") {
      res.status(400).json({ error: "Transaksi ini sudah dibatalkan sebelumnya." });
      return;
    }
    tx.status = "cancelled";
    saveVault(db);
    res.json(tx);
  });

  app.post("/api/assets", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      const assetName = String(req.body?.asset_name ?? "").trim();
      const assetType = String(req.body?.asset_type ?? "lainnya") as Asset["asset_type"];
      const currentValue = Number(req.body?.current_value ?? 0);
      const rawQuantity =
        req.body?.quantity !== undefined && req.body?.quantity !== null && req.body?.quantity !== ""
          ? Number(req.body.quantity)
          : null;
      const unit = req.body?.unit ? String(req.body.unit).trim() : null;
      const notes = req.body?.notes ? String(req.body.notes).trim() : null;

      validateAssetInput({
        asset_name: assetName,
        asset_type: assetType,
        current_value: currentValue,
        quantity: rawQuantity,
        owner_confirmed: ownerConfirmed,
      });

      const db = loadVault();
      const asset: Asset = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        asset_name: assetName,
        asset_type: assetType,
        current_value: roundCurrency(currentValue),
        quantity: rawQuantity,
        unit,
        notes,
        created_at: new Date().toISOString(),
      };
      db.assets.unshift(asset);
      saveVault(db);
      res.status(201).json(asset);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal mencatat aset.",
      });
    }
  });

  app.patch("/api/assets/:id", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    if (req.body?.owner_confirmed !== true) {
      res.status(400).json({
        error: "Persetujuan eksplisit Owner wajib dicentang sebelum memperbarui nilai aset.",
      });
      return;
    }
    const currentValue = Number(req.body?.current_value ?? NaN);
    if (!Number.isFinite(currentValue) || currentValue < 0) {
      res.status(400).json({ error: "Nilai taksiran baru tidak valid." });
      return;
    }

    const db = loadVault();
    const asset = db.assets.find((a) => a.id === req.params.id && a.owner_id === ownerId);
    if (!asset) {
      res.status(404).json({ error: "Aset tidak ditemukan." });
      return;
    }
    asset.current_value = roundCurrency(currentValue);
    if (req.body?.notes !== undefined) {
      asset.notes = req.body.notes ? String(req.body.notes).trim() : null;
    }
    saveVault(db);
    res.json(asset);
  });

  app.post("/api/debts", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      const creditor = String(req.body?.creditor ?? "").trim();
      const debtType = String(req.body?.debt_type ?? "lainnya") as DebtType;
      const originalAmount = Number(req.body?.original_amount ?? 0);
      const outstandingBalance =
        req.body?.outstanding_balance !== undefined
          ? Number(req.body.outstanding_balance)
          : originalAmount;
      const interestRateAnnual =
        req.body?.interest_rate_annual !== undefined
          ? Number(req.body.interest_rate_annual)
          : 0;
      const monthlyFee =
        req.body?.monthly_fee !== undefined ? Number(req.body.monthly_fee) : 0;
      const installmentAmount =
        req.body?.installment_amount !== undefined
          ? Number(req.body.installment_amount)
          : 0;
      const paymentFrequency = String(
        req.body?.payment_frequency ?? "monthly"
      ) as DebtPaymentFrequency;
      const dueDate = req.body?.due_date ? String(req.body.due_date).slice(0, 10) : null;
      const description = req.body?.description ? String(req.body.description).trim() : null;

      validateDebtInput({
        creditor,
        debt_type: debtType,
        original_amount: originalAmount,
        outstanding_balance: outstandingBalance,
        interest_rate_annual: interestRateAnnual,
        monthly_fee: monthlyFee,
        installment_amount: installmentAmount,
        payment_frequency: paymentFrequency,
        owner_confirmed: ownerConfirmed,
      });

      const db = loadVault();
      const debt: Debt = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        creditor,
        debt_type: debtType,
        original_amount: roundCurrency(originalAmount),
        outstanding_balance: roundCurrency(outstandingBalance),
        interest_rate_annual: Math.max(0, Number(interestRateAnnual) || 0),
        monthly_fee: roundCurrency(monthlyFee),
        installment_amount: roundCurrency(installmentAmount),
        payment_frequency: paymentFrequency,
        due_date: dueDate,
        status: outstandingBalance === 0 ? "paid" : "active",
        description,
        created_at: new Date().toISOString(),
      };
      db.debts.unshift(debt);
      saveVault(db);
      res.status(201).json(debt);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal mencatat utang.",
      });
    }
  });

  app.patch("/api/debts/:id", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      const db = loadVault();
      const idx = db.debts.findIndex(
        (d) => d.id === req.params.id && d.owner_id === ownerId
      );
      if (idx === -1) {
        res.status(404).json({ error: "Data utang tidak ditemukan." });
        return;
      }
      const current = normalizeDebt(db.debts[idx]);
      const creditor =
        req.body?.creditor !== undefined
          ? String(req.body.creditor).trim()
          : current.creditor;
      const debtType = (
        req.body?.debt_type !== undefined
          ? String(req.body.debt_type)
          : current.debt_type
      ) as DebtType;
      const interestRateAnnual =
        req.body?.interest_rate_annual !== undefined
          ? Number(req.body.interest_rate_annual)
          : current.interest_rate_annual;
      const monthlyFee =
        req.body?.monthly_fee !== undefined
          ? Number(req.body.monthly_fee)
          : current.monthly_fee;
      const installmentAmount =
        req.body?.installment_amount !== undefined
          ? Number(req.body.installment_amount)
          : current.installment_amount;
      const paymentFrequency = (
        req.body?.payment_frequency !== undefined
          ? String(req.body.payment_frequency)
          : current.payment_frequency
      ) as DebtPaymentFrequency;
      const dueDate =
        req.body?.due_date !== undefined
          ? req.body.due_date
            ? String(req.body.due_date).slice(0, 10)
            : null
          : current.due_date;
      const description =
        req.body?.description !== undefined
          ? req.body.description
            ? String(req.body.description).trim()
            : null
          : current.description;

      validateDebtInput({
        creditor,
        debt_type: debtType,
        original_amount: current.original_amount,
        outstanding_balance: current.outstanding_balance,
        interest_rate_annual: interestRateAnnual,
        monthly_fee: monthlyFee,
        installment_amount: installmentAmount,
        payment_frequency: paymentFrequency,
        owner_confirmed: ownerConfirmed,
      });

      const updated: Debt = {
        ...current,
        creditor,
        debt_type: debtType,
        interest_rate_annual: Math.max(0, Number(interestRateAnnual) || 0),
        monthly_fee: roundCurrency(monthlyFee),
        installment_amount: roundCurrency(installmentAmount),
        payment_frequency: paymentFrequency,
        due_date: dueDate,
        description,
      };
      db.debts[idx] = updated;
      saveVault(db);
      res.json(updated);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal memperbarui data utang.",
      });
    }
  });

  app.post("/api/debts/:id/pay", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const db = loadVault();
      db.debt_payment_logs ??= [];
      const debt = db.debts.find((d) => d.id === req.params.id && d.owner_id === ownerId);
      if (!debt) {
        res.status(404).json({ error: "Data utang tidak ditemukan." });
        return;
      }

      const paymentAmount = Number(req.body?.amount ?? 0);
      const sourceAccountId = String(req.body?.source_account_id ?? "");
      const ownerConfirmed = req.body?.owner_confirmed === true;
      const notes = req.body?.notes ? String(req.body.notes).trim() : null;

      validateDebtPayment(debt, paymentAmount, sourceAccountId, ownerConfirmed);
      validateTransactionInvariants(
        {
          owner_id: ownerId,
          transaction_type: "expense",
          source_account_id: sourceAccountId,
          destination_account_id: null,
          amount: paymentAmount,
          status: "posted",
          owner_confirmed: ownerConfirmed,
        },
        db.accounts
      );

      const newBalance = roundCurrency(debt.outstanding_balance - paymentAmount);
      debt.outstanding_balance = Math.max(0, newBalance);
      if (debt.outstanding_balance === 0) {
        debt.status = "paid";
      }

      const nowIso = new Date().toISOString();
      const payDate = todayISO();
      const tx: Transaction = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        transaction_type: "expense",
        source_account_id: sourceAccountId,
        destination_account_id: null,
        amount: roundCurrency(paymentAmount),
        transaction_date: payDate,
        category: "Utang & Cicilan",
        description: `Pembayaran utang ke ${debt.creditor}`,
        status: "posted",
        owner_confirmed: true,
        created_at: nowIso,
      };

      const log: DebtPaymentLog = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        debt_id: debt.id,
        transaction_id: tx.id,
        amount: roundCurrency(paymentAmount),
        principal_paid: roundCurrency(paymentAmount),
        interest_paid: 0,
        remaining_after: debt.outstanding_balance,
        notes,
        created_at: nowIso,
      };

      db.transactions.unshift(tx);
      db.debt_payment_logs.unshift(log);
      saveVault(db);
      res.json({ debt: normalizeDebt(debt), transaction: tx, log });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal memproses pembayaran utang.",
      });
    }
  });

  // =========================================================
  // OWNER CONTROL QUEUE ROUTES (/owner)
  // =========================================================
  app.post("/api/commands", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const commandText = String(req.body?.command_text ?? "").trim();
    if (commandText.length < 1 || commandText.length > 500) {
      res.status(400).json({ error: "Perintah harus berisi 1–500 karakter." });
      return;
    }

    const db = loadVault();
    const rawDraft = req.body?.parsed_draft as ParsedCommandDraft | undefined;
    const parsedDraft: ParsedCommandDraft =
      rawDraft &&
      typeof rawDraft === "object" &&
      ["income", "expense", "transfer"].includes(rawDraft.transaction_type)
        ? {
            transaction_type: rawDraft.transaction_type,
            amount:
              typeof rawDraft.amount === "number" && Number.isFinite(rawDraft.amount) && rawDraft.amount > 0
                ? roundCurrency(rawDraft.amount)
                : null,
            category: String(rawDraft.category || "Lainnya").trim(),
            description: String(rawDraft.description || commandText).trim().slice(0, 140),
            source_account_id: rawDraft.source_account_id ? String(rawDraft.source_account_id) : null,
            destination_account_id: rawDraft.destination_account_id
              ? String(rawDraft.destination_account_id)
              : null,
            source_hint: rawDraft.source_hint ? String(rawDraft.source_hint) : null,
            destination_hint: rawDraft.destination_hint ? String(rawDraft.destination_hint) : null,
            transaction_date: /^\d{4}-\d{2}-\d{2}$/.test(String(rawDraft.transaction_date ?? ""))
              ? String(rawDraft.transaction_date)
              : todayISO(),
            confidence: ["high", "medium", "low"].includes(rawDraft.confidence)
              ? rawDraft.confidence
              : "medium",
            warnings: Array.isArray(rawDraft.warnings)
              ? rawDraft.warnings.map((w) => String(w))
              : [],
          }
        : parseNaturalCommand(commandText, db.accounts);

    const cmd: OwnerCommand = {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      command_text: commandText,
      status: "pending",
      parsed_draft: parsedDraft,
      created_at: new Date().toISOString(),
    };
    db.owner_commands.unshift(cmd);
    saveVault(db);
    res.status(201).json(cmd);
  });

  app.post("/api/commands/:id/approve", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const db = loadVault();
      const cmd = db.owner_commands.find(
        (c) => c.id === req.params.id && c.owner_id === ownerId
      );
      if (!cmd) {
        res.status(404).json({ error: "Perintah tidak ditemukan." });
        return;
      }
      if (cmd.status !== "pending") {
        res.status(400).json({ error: "Perintah ini sudah diproses sebelumnya." });
        return;
      }
      if (req.body?.owner_confirmed !== true) {
        res.status(400).json({
          error:
            "Prinsip Brankas Mutlak: Persetujuan eksplisit Owner wajib dicentang sebelum mengeksekusi draf.",
        });
        return;
      }

      const override = req.body?.draft ?? cmd.parsed_draft;
      if (!override) {
        res.status(400).json({ error: "Draf transaksi tidak tersedia." });
        return;
      }

      const txType = override.transaction_type as Transaction["transaction_type"];
      const amount = Number(override.amount ?? 0);
      const sourceId = override.source_account_id ? String(override.source_account_id) : null;
      const destId = override.destination_account_id
        ? String(override.destination_account_id)
        : null;
      const txDate = String(override.transaction_date ?? todayISO()).slice(0, 10);
      const category = String(override.category ?? "Lainnya").trim();
      const description = String(override.description ?? cmd.command_text).trim();

      validateTransactionInvariants(
        {
          owner_id: ownerId,
          transaction_type: txType,
          source_account_id: sourceId,
          destination_account_id: destId,
          amount,
          status: "posted",
          owner_confirmed: true,
        },
        db.accounts
      );

      const tx: Transaction = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        transaction_type: txType,
        source_account_id: txType === "income" ? null : sourceId,
        destination_account_id: txType === "expense" ? null : destId,
        amount: roundCurrency(amount),
        transaction_date: txDate || todayISO(),
        category,
        description,
        status: "posted",
        owner_confirmed: true,
        created_at: new Date().toISOString(),
      };

      cmd.status = "processed";
      cmd.parsed_draft = {
        ...(cmd.parsed_draft ?? override),
        transaction_type: txType,
        amount: roundCurrency(amount),
        source_account_id: tx.source_account_id,
        destination_account_id: tx.destination_account_id,
        category,
        description,
        transaction_date: tx.transaction_date,
      };
      db.transactions.unshift(tx);
      saveVault(db);

      res.json({ command: cmd, transaction: tx });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menyetujui perintah.",
      });
    }
  });

  app.post("/api/commands/:id/reject", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    const cmd = db.owner_commands.find(
      (c) => c.id === req.params.id && c.owner_id === ownerId
    );
    if (!cmd) {
      res.status(404).json({ error: "Perintah tidak ditemukan." });
      return;
    }
    if (cmd.status !== "pending") {
      res.status(400).json({ error: "Perintah ini sudah diproses sebelumnya." });
      return;
    }
    cmd.status = "rejected";
    saveVault(db);
    res.json({ command: cmd });
  });

  // =========================================================
  // SETTINGS & PREFERENCES
  // =========================================================
  app.patch("/api/preferences", requireOwner, (req, res) => {
    const db = loadVault();
    const dateFormat = req.body?.date_format as OwnerPreferences["date_format"] | undefined;
    const expenseLimit = req.body?.expense_alert_limit;

    if (dateFormat !== undefined) {
      if (!["DD/MM/YYYY", "YYYY-MM-DD", "DD MMM YYYY"].includes(dateFormat)) {
        res.status(400).json({ error: "Format tanggal tidak valid." });
        return;
      }
      db.preferences.date_format = dateFormat;
    }
    if (expenseLimit !== undefined) {
      const parsed = Number(expenseLimit);
      if (!Number.isFinite(parsed) || parsed < 0) {
        res.status(400).json({ error: "Batas peringatan pengeluaran harus >= Rp 0." });
        return;
      }
      db.preferences.expense_alert_limit = roundCurrency(parsed);
    }
    saveVault(db);
    res.json(db.preferences);
  });

  // =========================================================
  // GEMINI SERVER ROUTES (SEARCH GROUNDING & TTS)
  // =========================================================
  app.post("/api/ai/search", requireOwner, async (req, res) => {
    try {
      const query = String(req.body?.query ?? "").trim();
      if (!query) {
        res.status(400).json({ error: "Pertanyaan riset keuangan wajib diisi." });
        return;
      }
      const result = await runFinancialSearch(query);
      res.json(result);
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.statusCode).json({
        error: classified.message,
        code: classified.code,
      });
    }
  });

  app.post("/api/ai/tts", requireOwner, async (req, res) => {
    try {
      const text = String(req.body?.text ?? "").trim();
      if (!text) {
        res.status(400).json({ error: "Teks untuk dibacakan tidak boleh kosong." });
        return;
      }
      const style = req.body?.style ? String(req.body.style) : undefined;
      const result = await synthesizeIndonesianTTS(text, style);
      res.json(result);
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.statusCode).json({
        error: classified.message,
        code: classified.code,
      });
    }
  });

  app.post("/api/ai/scan-receipt", requireOwner, async (req, res) => {
    try {
      const imageBase64 = String(req.body?.imageBase64 ?? "");
      const mimeType = String(req.body?.mimeType ?? "image/jpeg");
      if (!imageBase64.trim()) {
        res.status(400).json({ error: "Foto struk wajib diunggah sebelum dianalisis." });
        return;
      }

      const providedAccounts = Array.isArray(req.body?.accounts)
        ? (req.body.accounts as Account[])
        : null;
      let accounts = providedAccounts ?? [];
      if (accounts.length === 0) {
        const token = extractToken(req);
        const authedSupabase = token ? createAuthedSupabaseClient(token) : null;
        if (authedSupabase) {
          const { data } = await authedSupabase.from("accounts").select("*");
          accounts = (data ?? []) as Account[];
        }
        if (accounts.length === 0) {
          accounts = loadVault().accounts;
        }
      }

      const result = await scanReceiptToDraft(imageBase64, mimeType, accounts);
      res.json(result);
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.statusCode).json({
        error: classified.message,
        code: classified.code,
      });
    }
  });

  app.post("/api/ai/advisor", requireOwner, async (req, res) => {
    try {
      const question = String(req.body?.question ?? "").trim();
      const contextBrief = String(req.body?.contextBrief ?? "").trim();
      const missingIndicators = Array.isArray(req.body?.missingIndicators)
        ? req.body.missingIndicators.map((x: unknown) => String(x))
        : [];
      if (!question || question.length > 600) {
        res.status(400).json({
          error: "Pertanyaan konsultasi wajib diisi (maks 600 karakter).",
        });
        return;
      }
      if (!contextBrief) {
        res.status(400).json({
          error: "Konteks finansial terverifikasi belum tersedia untuk dianalisis.",
        });
        return;
      }
      const result = await runFinancialAdvisor(
        question,
        contextBrief,
        missingIndicators
      );
      res.json(result);
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.statusCode).json({
        error: classified.message,
        code: classified.code,
      });
    }
  });

  // =========================================================
  // RECURRING BILLS & REMINDERS ROUTES (/rencana)
  // =========================================================
  app.post("/api/recurring", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const title = String(req.body?.title ?? "").trim();
      const txType = String(req.body?.transaction_type ?? "expense") as "income" | "expense";
      const amount = Number(req.body?.amount ?? 0);
      const category = String(req.body?.category ?? "Utilitas & Tagihan").trim() || "Utilitas & Tagihan";
      const accountId = req.body?.account_id ? String(req.body.account_id) : null;
      const frequency = String(req.body?.frequency ?? "monthly") as RecurringBill["frequency"];
      const nextDueDate = String(req.body?.next_due_date ?? todayISO()).slice(0, 10);
      const notes = req.body?.notes ? String(req.body.notes).trim() : null;
      const ownerConfirmed = req.body?.owner_confirmed === true;

      validateRecurringBillInput({
        title,
        transaction_type: txType,
        amount,
        frequency,
        next_due_date: nextDueDate,
        owner_confirmed: ownerConfirmed,
      });

      const db = loadVault();
      const bill: RecurringBill = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        title,
        transaction_type: txType,
        amount: roundCurrency(amount),
        category,
        account_id: accountId,
        frequency,
        next_due_date: nextDueDate,
        last_queued_date: null,
        is_active: true,
        notes,
        created_at: new Date().toISOString(),
      };
      db.recurring_bills.push(bill);
      saveVault(db);
      res.status(201).json(bill);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menyimpan jadwal rutin.",
      });
    }
  });

  app.patch("/api/recurring/:id", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    const bill = db.recurring_bills.find(
      (b) => b.id === req.params.id && b.owner_id === ownerId
    );
    if (!bill) {
      res.status(404).json({ error: "Jadwal rutin tidak ditemukan." });
      return;
    }
    if (req.body?.is_active !== undefined) {
      bill.is_active = Boolean(req.body.is_active);
    }
    saveVault(db);
    res.json(bill);
  });

  app.post("/api/recurring/:id/queue", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    const bill = db.recurring_bills.find(
      (b) => b.id === req.params.id && b.owner_id === ownerId
    );
    if (!bill) {
      res.status(404).json({ error: "Jadwal rutin tidak ditemukan." });
      return;
    }

    const accountExists =
      bill.account_id !== null &&
      db.accounts.some((a) => a.id === bill.account_id && a.owner_id === ownerId);
    const resolvedAccountId = accountExists ? bill.account_id : null;

    const warnings: string[] = [];
    if (!resolvedAccountId) {
      warnings.push(
        bill.transaction_type === "income"
          ? "Pilih akun tujuan pemasukan sebelum menyetujui."
          : "Pilih akun sumber dana sebelum menyetujui."
      );
    }

    const draft: ParsedCommandDraft = {
      transaction_type: bill.transaction_type,
      amount: bill.amount,
      category: bill.category,
      description: `${bill.title} (Tagihan Rutin ${bill.next_due_date})`,
      source_account_id: bill.transaction_type === "expense" ? resolvedAccountId : null,
      destination_account_id: bill.transaction_type === "income" ? resolvedAccountId : null,
      source_hint: null,
      destination_hint: null,
      transaction_date: todayISO(),
      confidence: resolvedAccountId ? "high" : "medium",
      warnings,
    };

    const cmd: OwnerCommand = {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      command_text: `[Tagihan Rutin] ${bill.title} · Rp ${bill.amount.toLocaleString("id-ID")} (Jatuh tempo ${bill.next_due_date})`,
      status: "pending",
      parsed_draft: draft,
      created_at: new Date().toISOString(),
    };

    // Vault invariant: only insert pending OwnerCommand; never mutate balances here
    db.owner_commands.unshift(cmd);
    bill.last_queued_date = bill.next_due_date;
    bill.next_due_date = advanceDueDate(bill.next_due_date, bill.frequency);
    saveVault(db);

    res.status(201).json({ command: cmd, bill });
  });

  app.delete("/api/recurring/:id", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    const before = db.recurring_bills.length;
    db.recurring_bills = db.recurring_bills.filter(
      (b) => !(b.id === req.params.id && b.owner_id === ownerId)
    );
    if (db.recurring_bills.length === before) {
      res.status(404).json({ error: "Jadwal rutin tidak ditemukan." });
      return;
    }
    saveVault(db);
    res.json({ ok: true });
  });

  // =========================================================
  // SAVINGS GOALS & EMERGENCY FUND ROUTES (/rencana)
  // =========================================================
  app.post("/api/goals", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const title = String(req.body?.title ?? "").trim();
      const goalType = String(req.body?.goal_type ?? "savings_target") as SavingsGoal["goal_type"];
      const targetAmount = Number(req.body?.target_amount ?? 0);
      const currentAmount = Number(req.body?.current_amount ?? 0);
      const linkedAccountId = req.body?.linked_account_id
        ? String(req.body.linked_account_id)
        : null;
      const targetDate = req.body?.target_date ? String(req.body.target_date).slice(0, 10) : null;
      const notes = req.body?.notes ? String(req.body.notes).trim() : null;
      const ownerConfirmed = req.body?.owner_confirmed === true;

      validateSavingsGoalInput({
        title,
        goal_type: goalType,
        target_amount: targetAmount,
        current_amount: currentAmount,
        owner_confirmed: ownerConfirmed,
      });

      const db = loadVault();
      const goal: SavingsGoal = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        title,
        goal_type: goalType,
        target_amount: roundCurrency(targetAmount),
        current_amount: linkedAccountId ? 0 : roundCurrency(currentAmount),
        linked_account_id: linkedAccountId,
        target_date: targetDate,
        status:
          !linkedAccountId && currentAmount >= targetAmount ? "completed" : "active",
        notes,
        created_at: new Date().toISOString(),
      };
      db.savings_goals.unshift(goal);
      saveVault(db);
      res.status(201).json(goal);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menyimpan target tabungan.",
      });
    }
  });

  app.patch("/api/goals/:id", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    const goal = db.savings_goals.find(
      (g) => g.id === req.params.id && g.owner_id === ownerId
    );
    if (!goal) {
      res.status(404).json({ error: "Target tabungan tidak ditemukan." });
      return;
    }

    if (req.body?.current_amount !== undefined) {
      if (req.body?.owner_confirmed !== true) {
        res.status(400).json({
          error: "Persetujuan eksplisit Owner wajib dicentang saat mengubah progres dana.",
        });
        return;
      }
      const nextAmount = Number(req.body.current_amount);
      if (!Number.isFinite(nextAmount) || nextAmount < 0) {
        res.status(400).json({ error: "Nominal progres tabungan harus >= Rp 0." });
        return;
      }
      goal.current_amount = roundCurrency(nextAmount);
      if (goal.current_amount >= goal.target_amount) {
        goal.status = "completed";
      }
    }

    if (req.body?.status === "active" || req.body?.status === "completed") {
      goal.status = req.body.status;
    }

    saveVault(db);
    res.json(goal);
  });

  app.delete("/api/goals/:id", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    const before = db.savings_goals.length;
    db.savings_goals = db.savings_goals.filter(
      (g) => !(g.id === req.params.id && g.owner_id === ownerId)
    );
    if (db.savings_goals.length === before) {
      res.status(404).json({ error: "Target tabungan tidak ditemukan." });
      return;
    }
    saveVault(db);
    res.json({ ok: true });
  });

  // =========================================================
  // FINANCIAL REMINDERS ROUTES (/pengingat)
  // =========================================================
  app.post("/api/reminders", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const title = String(req.body?.title ?? "").trim();
      const reminderType = String(req.body?.reminder_type ?? "tagihan_bulanan") as FinancialReminder["reminder_type"];
      const transactionType = String(req.body?.transaction_type ?? "expense") as FinancialReminder["transaction_type"];
      const amount = Number(req.body?.amount ?? 0);
      const dueDate = String(req.body?.due_date ?? todayISO()).slice(0, 10);
      const reminderTime = String(req.body?.reminder_time ?? "08:00").slice(0, 5);
      const frequency = String(req.body?.frequency ?? "monthly") as FinancialReminder["frequency"];
      const rawOffsets = Array.isArray(req.body?.remind_offsets)
        ? req.body.remind_offsets.map((n: unknown) => Number(n))
        : [7, 3, 1, 0];
      const customDaysBefore =
        req.body?.custom_days_before !== undefined &&
        req.body?.custom_days_before !== null &&
        req.body?.custom_days_before !== ""
          ? Number(req.body.custom_days_before)
          : null;
      const ownerConfirmed = req.body?.owner_confirmed === true;

      validateFinancialReminderInput({
        title,
        reminder_type: reminderType,
        transaction_type: transactionType,
        amount,
        due_date: dueDate,
        reminder_time: reminderTime,
        frequency,
        remind_offsets: rawOffsets,
        custom_days_before: customDaysBefore,
        owner_confirmed: ownerConfirmed,
      });

      const db = loadVault();
      db.financial_reminders ??= [];
      db.financial_reminder_logs ??= [];

      const dedupeKey = req.body?.dedupe_key ? String(req.body.dedupe_key).trim() : null;
      if (
        dedupeKey &&
        db.financial_reminders.some(
          (r) => r.owner_id === ownerId && r.dedupe_key === dedupeKey
        )
      ) {
        res.status(409).json({
          error: "Pengingat untuk jadwal atau sumber yang sama sudah terdaftar.",
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const reminder: FinancialReminder = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        title,
        reminder_type: reminderType,
        transaction_type: transactionType,
        amount: roundCurrency(amount),
        due_date: dueDate,
        reminder_time: reminderTime,
        frequency,
        remind_offsets: normalizeReminderOffsets(rawOffsets, null),
        custom_days_before: customDaysBefore,
        is_active: true,
        is_read: false,
        read_at: null,
        last_notified_key: null,
        last_notified_at: null,
        linked_account_id: req.body?.linked_account_id ? String(req.body.linked_account_id) : null,
        linked_goal_id: req.body?.linked_goal_id ? String(req.body.linked_goal_id) : null,
        linked_debt_id: req.body?.linked_debt_id ? String(req.body.linked_debt_id) : null,
        linked_bill_id: req.body?.linked_bill_id ? String(req.body.linked_bill_id) : null,
        dedupe_key: dedupeKey,
        notes: req.body?.notes ? String(req.body.notes).trim() : null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      db.financial_reminders.push(reminder);
      saveVault(db);
      res.status(201).json(reminder);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menyimpan pengingat keuangan.",
      });
    }
  });

  app.patch("/api/reminders/:id", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const db = loadVault();
      db.financial_reminders ??= [];
      db.financial_reminder_logs ??= [];

      const reminder = db.financial_reminders.find(
        (r) => r.id === req.params.id && r.owner_id === ownerId
      );
      if (!reminder) {
        res.status(404).json({ error: "Pengingat tidak ditemukan." });
        return;
      }

      const nowIso = new Date().toISOString();
      const logsToAdd: FinancialReminderLog[] = [];

      if (
        req.body?.title !== undefined ||
        req.body?.due_date !== undefined ||
        req.body?.reminder_time !== undefined ||
        req.body?.amount !== undefined ||
        req.body?.remind_offsets !== undefined ||
        req.body?.frequency !== undefined ||
        req.body?.reminder_type !== undefined
      ) {
        const nextTitle =
          req.body?.title !== undefined ? String(req.body.title).trim() : reminder.title;
        const nextType = (req.body?.reminder_type ??
          reminder.reminder_type) as FinancialReminder["reminder_type"];
        const nextTxType = (req.body?.transaction_type ??
          reminder.transaction_type) as FinancialReminder["transaction_type"];
        const nextAmount =
          req.body?.amount !== undefined ? Number(req.body.amount) : reminder.amount;
        const nextDue =
          req.body?.due_date !== undefined
            ? String(req.body.due_date).slice(0, 10)
            : reminder.due_date;
        const nextTime =
          req.body?.reminder_time !== undefined
            ? String(req.body.reminder_time).slice(0, 5)
            : reminder.reminder_time;
        const nextFreq = (req.body?.frequency ??
          reminder.frequency) as FinancialReminder["frequency"];
        const nextOffsets = Array.isArray(req.body?.remind_offsets)
          ? req.body.remind_offsets.map((n: unknown) => Number(n))
          : reminder.remind_offsets;
        const nextCustom =
          req.body?.custom_days_before !== undefined
            ? req.body.custom_days_before === null || req.body.custom_days_before === ""
              ? null
              : Number(req.body.custom_days_before)
            : reminder.custom_days_before;

        validateFinancialReminderInput({
          title: nextTitle,
          reminder_type: nextType,
          transaction_type: nextTxType,
          amount: nextAmount,
          due_date: nextDue,
          reminder_time: nextTime,
          frequency: nextFreq,
          remind_offsets: nextOffsets,
          custom_days_before: nextCustom,
          owner_confirmed: true,
        });

        const dueChanged = nextDue !== reminder.due_date;
        reminder.title = nextTitle;
        reminder.reminder_type = nextType;
        reminder.transaction_type = nextTxType;
        reminder.amount = roundCurrency(nextAmount);
        reminder.due_date = nextDue;
        reminder.reminder_time = nextTime;
        reminder.frequency = nextFreq;
        reminder.remind_offsets = normalizeReminderOffsets(nextOffsets, null);
        reminder.custom_days_before = nextCustom;
        if (req.body?.linked_account_id !== undefined) {
          reminder.linked_account_id = req.body.linked_account_id
            ? String(req.body.linked_account_id)
            : null;
        }
        if (req.body?.notes !== undefined) {
          reminder.notes = req.body.notes ? String(req.body.notes).trim() : null;
        }
        if (dueChanged) {
          reminder.last_notified_key = null;
          reminder.is_read = false;
          reminder.read_at = null;
          logsToAdd.push({
            id: crypto.randomUUID(),
            owner_id: ownerId,
            reminder_id: reminder.id,
            reminder_title: reminder.title,
            event_type: "rescheduled",
            trigger_offset: null,
            scheduled_for: reminder.due_date,
            notes: `Dijadwalkan ulang ke ${reminder.due_date}`,
            created_at: nowIso,
          });
        }
      }

      if (typeof req.body?.is_active === "boolean" && req.body.is_active !== reminder.is_active) {
        reminder.is_active = req.body.is_active;
        logsToAdd.push({
          id: crypto.randomUUID(),
          owner_id: ownerId,
          reminder_id: reminder.id,
          reminder_title: reminder.title,
          event_type: reminder.is_active ? "resumed" : "paused",
          trigger_offset: null,
          scheduled_for: reminder.due_date,
          notes: reminder.is_active ? "Pengingat diaktifkan kembali" : "Pengingat dinonaktifkan",
          created_at: nowIso,
        });
      }

      if (typeof req.body?.is_read === "boolean" && req.body.is_read !== reminder.is_read) {
        reminder.is_read = req.body.is_read;
        reminder.read_at = reminder.is_read ? nowIso : null;
        if (reminder.is_read) {
          logsToAdd.push({
            id: crypto.randomUUID(),
            owner_id: ownerId,
            reminder_id: reminder.id,
            reminder_title: reminder.title,
            event_type: "read",
            trigger_offset: null,
            scheduled_for: reminder.due_date,
            notes: "Ditandai sudah dibaca oleh Owner",
            created_at: nowIso,
          });
        }
      }

      reminder.updated_at = nowIso;
      if (logsToAdd.length > 0) {
        db.financial_reminder_logs.unshift(...logsToAdd);
      }
      saveVault(db);
      res.json(reminder);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal memperbarui pengingat.",
      });
    }
  });

  app.post("/api/reminders/mark-all-read", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    db.financial_reminders ??= [];
    db.financial_reminder_logs ??= [];
    const nowIso = new Date().toISOString();
    let updated = 0;

    for (const r of db.financial_reminders) {
      if (r.owner_id === ownerId && r.is_active && !r.is_read) {
        r.is_read = true;
        r.read_at = nowIso;
        r.updated_at = nowIso;
        updated += 1;
      }
    }

    if (updated > 0) {
      db.financial_reminder_logs.unshift({
        id: crypto.randomUUID(),
        owner_id: ownerId,
        reminder_id: null,
        reminder_title: `${updated} pengingat aktif`,
        event_type: "read",
        trigger_offset: null,
        scheduled_for: todayISO(),
        notes: "Semua pengingat aktif ditandai sudah dibaca",
        created_at: nowIso,
      });
      saveVault(db);
    }

    res.json({ ok: true, updated });
  });

  app.post("/api/reminders/:id/log-trigger", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const notificationKey = String(req.body?.notification_key ?? "").trim();
    const triggerOffset =
      typeof req.body?.trigger_offset === "number" ? req.body.trigger_offset : null;
    if (!notificationKey) {
      res.status(400).json({ error: "notification_key wajib diisi." });
      return;
    }

    const db = loadVault();
    db.financial_reminders ??= [];
    db.financial_reminder_logs ??= [];
    const reminder = db.financial_reminders.find(
      (r) => r.id === req.params.id && r.owner_id === ownerId
    );
    if (!reminder) {
      res.status(404).json({ error: "Pengingat tidak ditemukan." });
      return;
    }
    if (reminder.last_notified_key === notificationKey) {
      res.json({ reminder, deduped: true });
      return;
    }

    const nowIso = new Date().toISOString();
    reminder.last_notified_key = notificationKey;
    reminder.last_notified_at = nowIso;
    reminder.updated_at = nowIso;

    db.financial_reminder_logs.unshift({
      id: crypto.randomUUID(),
      owner_id: ownerId,
      reminder_id: reminder.id,
      reminder_title: reminder.title,
      event_type: "triggered",
      trigger_offset: triggerOffset,
      scheduled_for: reminder.due_date,
      notes:
        triggerOffset === -1
          ? `Pengingat keterlambatan ditampilkan (${reminder.due_date})`
          : `Pengingat H-${triggerOffset ?? 0} ditampilkan pada ${reminder.reminder_time}`,
      created_at: nowIso,
    });

    saveVault(db);
    res.json({ reminder, deduped: false });
  });

  app.post("/api/reminders/:id/queue-draft", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    if (req.body?.owner_confirmed !== true) {
      res.status(400).json({
        error:
          "Persetujuan eksplisit Owner wajib dicentang sebelum mengirim draf ke antrean transaksi.",
      });
      return;
    }

    const db = loadVault();
    db.financial_reminders ??= [];
    db.financial_reminder_logs ??= [];
    const reminder = db.financial_reminders.find(
      (r) => r.id === req.params.id && r.owner_id === ownerId
    );
    if (!reminder) {
      res.status(404).json({ error: "Pengingat tidak ditemukan." });
      return;
    }

    const validAccountId =
      reminder.linked_account_id &&
      db.accounts.some((a) => a.id === reminder.linked_account_id && a.owner_id === ownerId)
        ? reminder.linked_account_id
        : null;

    const warnings: string[] = [];
    if (reminder.transaction_type === "transfer") {
      warnings.push("Pilih akun sumber dan akun tujuan transfer sebelum menyetujui.");
    } else if (!validAccountId) {
      warnings.push(
        reminder.transaction_type === "income"
          ? "Pilih akun tujuan pemasukan sebelum menyetujui."
          : "Pilih akun sumber dana sebelum menyetujui."
      );
    }

    const draft: ParsedCommandDraft = {
      transaction_type: reminder.transaction_type,
      amount: reminder.amount > 0 ? reminder.amount : null,
      category:
        reminder.reminder_type === "cicilan_utang"
          ? "Utang & Cicilan"
          : reminder.reminder_type === "tanggal_gajian" ||
              reminder.reminder_type === "pemasukan_rutin"
            ? "Gaji & Pendapatan"
            : reminder.reminder_type === "setoran_tabungan" ||
                reminder.reminder_type === "target_keuangan"
              ? "Transfer Internal"
              : "Utilitas & Tagihan",
      description: `${reminder.title} (Pengingat ${reminder.due_date})`,
      source_account_id: reminder.transaction_type === "expense" ? validAccountId : null,
      destination_account_id:
        reminder.transaction_type === "income" || reminder.transaction_type === "transfer"
          ? validAccountId
          : null,
      source_hint: null,
      destination_hint: null,
      transaction_date: todayISO(),
      confidence: validAccountId && reminder.amount > 0 ? "high" : "medium",
      warnings,
    };

    const cmd: OwnerCommand = {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      command_text: `[Pengingat] ${reminder.title} · Rp ${reminder.amount.toLocaleString("id-ID")} (Jatuh tempo ${reminder.due_date})`,
      status: "pending",
      parsed_draft: draft,
      created_at: new Date().toISOString(),
    };

    // Strict invariant: NEVER alter account balances or post transactions here
    db.owner_commands.unshift(cmd);

    const nowIso = new Date().toISOString();
    reminder.is_read = true;
    reminder.read_at = nowIso;
    if (reminder.frequency !== "once" && req.body?.advance_cycle !== false) {
      reminder.due_date = advanceReminderDueDate(reminder.due_date, reminder.frequency);
      reminder.last_notified_key = null;
    }
    reminder.updated_at = nowIso;

    db.financial_reminder_logs.unshift({
      id: crypto.randomUUID(),
      owner_id: ownerId,
      reminder_id: reminder.id,
      reminder_title: reminder.title,
      event_type: "draft_queued",
      trigger_offset: null,
      scheduled_for: reminder.due_date,
      notes: "Draf dikirim ke Owner Control; saldo menunggu konfirmasi Owner.",
      created_at: nowIso,
    });

    saveVault(db);
    res.status(201).json({ command: cmd, reminder });
  });

  app.post("/api/reminders/sync-sources", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    db.financial_reminders ??= [];
    const payloads = buildSourceSyncReminders(
      db.recurring_bills ?? [],
      db.debts ?? [],
      db.financial_reminders,
      ownerId
    );
    const nowIso = new Date().toISOString();
    const created: FinancialReminder[] = payloads.map((p) => ({
      ...p,
      id: crypto.randomUUID(),
      created_at: nowIso,
      updated_at: nowIso,
    }));
    if (created.length > 0) {
      db.financial_reminders.push(...created);
      saveVault(db);
    }
    res.json({ createdCount: created.length, created });
  });

  app.delete("/api/reminders/:id", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    db.financial_reminders ??= [];
    const before = db.financial_reminders.length;
    db.financial_reminders = db.financial_reminders.filter(
      (r) => !(r.id === req.params.id && r.owner_id === ownerId)
    );
    if (db.financial_reminders.length === before) {
      res.status(404).json({ error: "Pengingat tidak ditemukan." });
      return;
    }
    saveVault(db);
    res.json({ ok: true });
  });

  // =========================================================
  // SMART BUDGET MONITOR ROUTES (OWNER-ONLY)
  // =========================================================
  app.post("/api/budgets", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const category = String(req.body?.category ?? "").trim();
      const periodMonth = String(req.body?.period_month ?? todayISO().slice(0, 7)).trim();
      const limitAmount = roundCurrency(Number(req.body?.limit_amount ?? 0));
      const notes = req.body?.notes ? String(req.body.notes).trim().slice(0, 240) : null;
      const isActive = typeof req.body?.is_active === "boolean" ? req.body.is_active : true;
      const ownerConfirmed = req.body?.owner_confirmed === true;

      validateCategoryBudgetInput({
        category,
        period_month: periodMonth,
        limit_amount: limitAmount,
        owner_confirmed: ownerConfirmed,
      });

      const db = loadVault();
      db.category_budgets ??= [];
      db.budget_alert_logs ??= [];

      const catKey = normalizeBudgetCategoryKey(category);
      const duplicate = db.category_budgets.some(
        (b) =>
          b.owner_id === ownerId &&
          b.period_month === periodMonth &&
          normalizeBudgetCategoryKey(b.category) === catKey
      );
      if (duplicate) {
        res.status(409).json({
          error: `Anggaran kategori "${category}" untuk periode ${periodMonth} sudah tersedia.`,
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const created: CategoryBudget = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        category,
        period_month: periodMonth,
        limit_amount: limitAmount,
        is_active: isActive,
        last_alert_threshold: null,
        last_alert_period: null,
        notes,
        created_at: nowIso,
        updated_at: nowIso,
      };
      db.category_budgets.push(created);

      const { byCategoryKey } = computeConfirmedExpensesByCategoryForMonth(
        db.transactions,
        periodMonth
      );
      const spent = byCategoryKey.get(catKey)?.total ?? 0;
      const cls = classifyBudgetThreshold(spent, limitAmount);

      db.budget_alert_logs.unshift({
        id: crypto.randomUUID(),
        owner_id: ownerId,
        budget_id: created.id,
        category: created.category,
        period_month: created.period_month,
        threshold_level: 0,
        spent_amount: spent,
        limit_amount: limitAmount,
        usage_pct: cls.usagePct,
        event_type: "created",
        notes: `Anggaran dibuat sebesar Rp ${limitAmount.toLocaleString("id-ID")}`,
        created_at: nowIso,
      });

      saveVault(db);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal membuat anggaran kategori.",
      });
    }
  });

  app.patch("/api/budgets/:id", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const db = loadVault();
      db.category_budgets ??= [];
      db.budget_alert_logs ??= [];

      const budget = db.category_budgets.find(
        (b) => b.id === req.params.id && b.owner_id === ownerId
      );
      if (!budget) {
        res.status(404).json({ error: "Anggaran kategori tidak ditemukan." });
        return;
      }

      const hasEditField =
        req.body?.category !== undefined ||
        req.body?.period_month !== undefined ||
        req.body?.limit_amount !== undefined ||
        req.body?.notes !== undefined;

      const nextCategory =
        req.body?.category !== undefined
          ? String(req.body.category ?? "").trim()
          : budget.category;
      const nextPeriod =
        req.body?.period_month !== undefined
          ? String(req.body.period_month ?? "").trim()
          : budget.period_month;
      const nextLimit =
        req.body?.limit_amount !== undefined
          ? roundCurrency(Number(req.body.limit_amount ?? 0))
          : budget.limit_amount;
      const nextNotes =
        req.body?.notes !== undefined
          ? req.body.notes
            ? String(req.body.notes).trim().slice(0, 240)
            : null
          : budget.notes;

      if (hasEditField) {
        validateCategoryBudgetInput({
          category: nextCategory,
          period_month: nextPeriod,
          limit_amount: nextLimit,
          owner_confirmed: req.body?.owner_confirmed === true,
        });

        const catKey = normalizeBudgetCategoryKey(nextCategory);
        const duplicate = db.category_budgets.some(
          (b) =>
            b.id !== budget.id &&
            b.owner_id === ownerId &&
            b.period_month === nextPeriod &&
            normalizeBudgetCategoryKey(b.category) === catKey
        );
        if (duplicate) {
          res.status(409).json({
            error: `Anggaran kategori "${nextCategory}" untuk periode ${nextPeriod} sudah tersedia.`,
          });
          return;
        }
      }

      const nowIso = new Date().toISOString();
      const { byCategoryKey } = computeConfirmedExpensesByCategoryForMonth(
        db.transactions,
        nextPeriod
      );
      const spent = byCategoryKey.get(normalizeBudgetCategoryKey(nextCategory))?.total ?? 0;
      const cls = classifyBudgetThreshold(spent, nextLimit);

      if (hasEditField) {
        const periodChanged = nextPeriod !== budget.period_month;
        budget.category = nextCategory;
        budget.period_month = nextPeriod;
        budget.limit_amount = nextLimit;
        budget.notes = nextNotes;
        if (periodChanged) {
          budget.last_alert_threshold = null;
          budget.last_alert_period = null;
        }
        db.budget_alert_logs.unshift({
          id: crypto.randomUUID(),
          owner_id: ownerId,
          budget_id: budget.id,
          category: budget.category,
          period_month: budget.period_month,
          threshold_level: 0,
          spent_amount: spent,
          limit_amount: budget.limit_amount,
          usage_pct: cls.usagePct,
          event_type: "updated",
          notes: `Batas anggaran diperbarui menjadi Rp ${budget.limit_amount.toLocaleString("id-ID")}`,
          created_at: nowIso,
        });
      }

      if (typeof req.body?.is_active === "boolean" && req.body.is_active !== budget.is_active) {
        budget.is_active = req.body.is_active;
        db.budget_alert_logs.unshift({
          id: crypto.randomUUID(),
          owner_id: ownerId,
          budget_id: budget.id,
          category: budget.category,
          period_month: budget.period_month,
          threshold_level: 0,
          spent_amount: spent,
          limit_amount: budget.limit_amount,
          usage_pct: cls.usagePct,
          event_type: budget.is_active ? "resumed" : "paused",
          notes: budget.is_active
            ? "Pemantauan anggaran diaktifkan kembali"
            : "Pemantauan anggaran dinonaktifkan sementara",
          created_at: nowIso,
        });
      }

      budget.updated_at = nowIso;
      saveVault(db);
      res.json(budget);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal memperbarui anggaran.",
      });
    }
  });

  app.post("/api/budgets/:id/log-alert", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const periodMonth = String(req.body?.period_month ?? "").trim();
    const thresholdLevel = Number(req.body?.threshold_level ?? 0) as BudgetThresholdLevel;
    const spentAmount = Math.max(0, roundCurrency(Number(req.body?.spent_amount ?? 0)));
    const usagePct = Math.max(0, Number(req.body?.usage_pct ?? 0));

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)) {
      res.status(400).json({ error: "Format period_month tidak valid." });
      return;
    }
    if (![50, 75, 90, 100, 101].includes(thresholdLevel)) {
      res.status(400).json({ error: "Ambang peringatan anggaran tidak valid." });
      return;
    }

    const db = loadVault();
    db.category_budgets ??= [];
    db.budget_alert_logs ??= [];

    const budget = db.category_budgets.find(
      (b) => b.id === req.params.id && b.owner_id === ownerId
    );
    if (!budget) {
      res.status(404).json({ error: "Anggaran kategori tidak ditemukan." });
      return;
    }

    if (
      isThresholdAlreadyNotified(
        budget,
        periodMonth,
        thresholdLevel,
        db.budget_alert_logs
      )
    ) {
      res.json({ budget, deduped: true });
      return;
    }

    const nowIso = new Date().toISOString();
    budget.last_alert_threshold = thresholdLevel;
    budget.last_alert_period = periodMonth;
    budget.updated_at = nowIso;

    const logEntry: BudgetAlertLog = {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      budget_id: budget.id,
      category: budget.category,
      period_month: periodMonth,
      threshold_level: thresholdLevel,
      spent_amount: spentAmount,
      limit_amount: budget.limit_amount,
      usage_pct: Math.round(usagePct * 10) / 10,
      event_type: "threshold_crossed",
      notes: `${budgetThresholdLabel(thresholdLevel)} (${usagePct.toFixed(1)}%)`,
      created_at: nowIso,
    };
    db.budget_alert_logs.unshift(logEntry);
    saveVault(db);
    res.json({ budget, log: logEntry, deduped: false });
  });

  app.post("/api/budgets/copy-month", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    if (req.body?.owner_confirmed !== true) {
      res.status(400).json({
        error: "Konfirmasi Owner diperlukan untuk menyalin anggaran bulan sebelumnya.",
      });
      return;
    }
    const fromMonth = String(req.body?.from_month ?? "").trim();
    const toMonth = String(req.body?.to_month ?? "").trim();
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(fromMonth) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(toMonth) ||
      fromMonth === toMonth
    ) {
      res.status(400).json({ error: "Periode asal dan tujuan tidak valid." });
      return;
    }

    const db = loadVault();
    db.category_budgets ??= [];
    db.budget_alert_logs ??= [];

    const existingKeys = new Set(
      db.category_budgets
        .filter((b) => b.owner_id === ownerId && b.period_month === toMonth)
        .map((b) => normalizeBudgetCategoryKey(b.category))
    );
    const sources = db.category_budgets.filter(
      (b) =>
        b.owner_id === ownerId &&
        b.period_month === fromMonth &&
        b.is_active &&
        !existingKeys.has(normalizeBudgetCategoryKey(b.category))
    );

    const nowIso = new Date().toISOString();
    const created: CategoryBudget[] = [];
    for (const src of sources) {
      const next: CategoryBudget = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        category: src.category,
        period_month: toMonth,
        limit_amount: src.limit_amount,
        is_active: true,
        last_alert_threshold: null,
        last_alert_period: null,
        notes: src.notes,
        created_at: nowIso,
        updated_at: nowIso,
      };
      created.push(next);
      db.category_budgets.push(next);
      db.budget_alert_logs.unshift({
        id: crypto.randomUUID(),
        owner_id: ownerId,
        budget_id: next.id,
        category: next.category,
        period_month: toMonth,
        threshold_level: 0,
        spent_amount: 0,
        limit_amount: next.limit_amount,
        usage_pct: 0,
        event_type: "created",
        notes: `Disalin dari periode ${fromMonth}`,
        created_at: nowIso,
      });
    }

    if (created.length > 0) {
      saveVault(db);
    }
    res.json({ copiedCount: created.length, created });
  });

  app.delete("/api/budgets/:id", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    db.category_budgets ??= [];
    const before = db.category_budgets.length;
    db.category_budgets = db.category_budgets.filter(
      (b) => !(b.id === req.params.id && b.owner_id === ownerId)
    );
    if (db.category_budgets.length === before) {
      res.status(404).json({ error: "Anggaran kategori tidak ditemukan." });
      return;
    }
    saveVault(db);
    res.json({ ok: true });
  });

  // =========================================================
  // WHAT-IF SCENARIOS & FINANCIAL HEALTH SCORE ROUTES
  // =========================================================
  app.post("/api/whatif-scenarios", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const params = req.body?.params as WhatIfScenarioParams | undefined;
      const resultSummary = req.body?.result_summary as
        | WhatIfSimulationResult
        | undefined;
      if (!params || !resultSummary) {
        res.status(400).json({ error: "Payload simulasi What-If tidak lengkap." });
        return;
      }

      validateWhatIfScenarioInput({
        title: String(params.title ?? ""),
        scenario_type: String(params.scenario_type ?? ""),
        amount: Number(params.amount ?? 0),
        tenor_months: Number(params.tenor_months ?? 1),
        annual_interest_pct: Number(params.annual_interest_pct ?? 0),
      });

      const db = loadVault();
      db.whatif_scenarios ??= [];
      const record: WhatIfScenarioRecord = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        title: params.title.trim(),
        scenario_type: params.scenario_type,
        params,
        result_summary: resultSummary,
        risk_level: resultSummary.riskLevel,
        created_at: new Date().toISOString(),
      };
      db.whatif_scenarios.unshift(record);
      saveVault(db);
      res.status(201).json(record);
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : "Gagal menyimpan skenario What-If.",
      });
    }
  });

  app.delete("/api/whatif-scenarios/:id", requireOwner, (req, res) => {
    const ownerId = (req as express.Request & { ownerId: string }).ownerId;
    const db = loadVault();
    db.whatif_scenarios ??= [];
    const before = db.whatif_scenarios.length;
    db.whatif_scenarios = db.whatif_scenarios.filter(
      (s) => !(s.id === req.params.id && s.owner_id === ownerId)
    );
    if (db.whatif_scenarios.length === before) {
      res.status(404).json({ error: "Skenario What-If tidak ditemukan." });
      return;
    }
    saveVault(db);
    res.json({ ok: true });
  });

  app.post("/api/health-scores", requireOwner, (req, res) => {
    try {
      const ownerId = (req as express.Request & { ownerId: string }).ownerId;
      const totalScore =
        req.body?.total_score === null || req.body?.total_score === undefined
          ? null
          : Number(req.body.total_score);
      const grade = String(req.body?.grade ?? "Belum Cukup Data");
      const periodMonth = String(req.body?.period_month ?? todayISO().slice(0, 7)).slice(0, 7);
      const availableWeightRaw = Number(req.body?.available_weight ?? 0);
      const snapshot: FinancialHealthScoreSnapshot = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        period_month: /^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)
          ? periodMonth
          : todayISO().slice(0, 7),
        total_score:
          totalScore !== null && Number.isFinite(totalScore)
            ? Math.max(0, Math.min(100, Math.round(totalScore)))
            : null,
        grade: grade as FinancialHealthScoreSnapshot["grade"],
        available_weight: Number.isFinite(availableWeightRaw)
          ? Math.max(0, Math.min(100, Math.round(availableWeightRaw)))
          : 0,
        is_data_incomplete: req.body?.is_data_incomplete === true,
        components: Array.isArray(req.body?.components) ? req.body.components : [],
        created_at: new Date().toISOString(),
      };

      const db = loadVault();
      db.financial_health_scores ??= [];
      db.financial_health_scores.unshift(snapshot);
      saveVault(db);
      res.status(201).json(snapshot);
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : "Gagal menyimpan snapshot Health Score.",
      });
    }
  });

  // =========================================================
  // HTTP + WEBSOCKET + VITE MIDDLEWARE / STATIC DIST
  // =========================================================
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  const distDir = path.resolve(process.cwd(), "dist");
  const isProd = process.env.NODE_ENV === "production" && fs.existsSync(distDir);

  httpServer.on("upgrade", (req, socket, head) => {
    try {
      const host = req.headers.host || `127.0.0.1:${PORT}`;
      const url = new URL(req.url ?? "/", `http://${host}`);
      if (url.pathname === "/ws/live") {
        wss.handleUpgrade(req, socket, head, (ws) => {
          const tokenFromQuery = url.searchParams.get("token") ?? undefined;
          let tokenFromCookie: string | undefined;
          const cookieHeader = req.headers.cookie;
          if (cookieHeader) {
            for (const part of cookieHeader.split(";")) {
              const [k, ...rest] = part.trim().split("=");
              if (k === "ego_session") {
                tokenFromCookie = decodeURIComponent(rest.join("="));
              }
            }
          }
          void attachLiveVoiceSession(ws, tokenFromQuery || tokenFromCookie);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  let viteServer: { close: () => Promise<void> } | null = null;

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const hmrDisabled = process.env.DISABLE_HMR === "true";
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: "spa",
    });
    viteServer = vite;
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  const shutdown = () => {
    wss.close();
    httpServer.close(() => {
      if (viteServer) {
        void viteServer.close().finally(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`EGO Personal AI berjalan pada http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Gagal menjalankan server EGO Personal AI:", err);
  process.exit(1);
});
