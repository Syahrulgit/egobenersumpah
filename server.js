// server.ts
import crypto3 from "node:crypto";
import fs3 from "node:fs";
import http from "node:http";
import path3 from "node:path";

// server/loadEnv.ts
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
function isPlaceholderEnvValue(value) {
  if (!value) return true;
  const trimmed = value.trim();
  return !trimmed || trimmed === "Xzx1@2@3xzX" || trimmed.startsWith("MY_");
}
function hydrateEnvFromDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  try {
    const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
    for (const [key, val] of Object.entries(parsed)) {
      if (isPlaceholderEnvValue(process.env[key]) && !isPlaceholderEnvValue(val)) {
        process.env[key] = val;
      }
    }
  } catch {
  }
}
hydrateEnvFromDotEnv();

// server.ts
import express from "express";
import { WebSocketServer } from "ws";

// src/lib/finance.ts
function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
function todayISO() {
  const now = /* @__PURE__ */ new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function isPostedConfirmed(tx) {
  return tx.status === "posted" && tx.owner_confirmed === true;
}
function computeAccountBalances(accounts, transactions) {
  const incoming = /* @__PURE__ */ new Map();
  const outgoing = /* @__PURE__ */ new Map();
  for (const tx of transactions) {
    if (!isPostedConfirmed(tx)) continue;
    const amt = Number(tx.amount) || 0;
    if (amt <= 0) continue;
    if (tx.destination_account_id) {
      incoming.set(
        tx.destination_account_id,
        roundCurrency((incoming.get(tx.destination_account_id) ?? 0) + amt)
      );
    }
    if (tx.source_account_id) {
      outgoing.set(
        tx.source_account_id,
        roundCurrency((outgoing.get(tx.source_account_id) ?? 0) + amt)
      );
    }
  }
  return accounts.map((acc) => {
    const inSum = incoming.get(acc.id) ?? 0;
    const outSum = outgoing.get(acc.id) ?? 0;
    const current_balance = roundCurrency((Number(acc.opening_balance) || 0) + inSum - outSum);
    return {
      ...acc,
      current_balance
    };
  });
}
function advanceDueDate(isoDate, frequency) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return todayISO();
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (frequency === "weekly") {
    const dt = new Date(Date.UTC(year, month - 1, day + 7));
    return dt.toISOString().slice(0, 10);
  }
  if (frequency === "yearly") {
    const targetYear2 = year + 1;
    const maxDay2 = new Date(Date.UTC(targetYear2, month, 0)).getUTCDate();
    const clampedDay2 = Math.min(day, maxDay2);
    return `${targetYear2}-${String(month).padStart(2, "0")}-${String(clampedDay2).padStart(2, "0")}`;
  }
  const zeroBasedMonth = month - 1 + 1;
  const targetYear = year + Math.floor(zeroBasedMonth / 12);
  const targetMonthIndex = (zeroBasedMonth % 12 + 12) % 12;
  const maxDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, maxDay);
  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

// src/lib/command-parser.ts
var INCOME_KEYWORDS = [
  "terima",
  "gaji",
  "pemasukan",
  "bonus",
  "dapat",
  "masuk",
  "dividen",
  "refund",
  "jual",
  "pendapatan",
  "thr",
  "honor"
];
var TRANSFER_KEYWORDS = [
  "transfer ke",
  "pindah saldo",
  "pindah dana",
  "tarik tunai",
  "setor tunai",
  "topup",
  "top up",
  "isi saldo",
  "kirim ke"
];
var EXPENSE_KEYWORDS = [
  "bayar",
  "beli",
  "jajan",
  "makan",
  "minum",
  "ngopi",
  "kopi",
  "ongkir",
  "cicilan",
  "tagihan",
  "keluar",
  "pengeluaran",
  "belanja",
  "sewa",
  "langganan"
];
var KNOWN_PROVIDERS = [
  "bca",
  "mandiri",
  "bri",
  "bni",
  "bsi",
  "cimb",
  "jago",
  "blu",
  "seabank",
  "gopay",
  "ovo",
  "dana",
  "shopeepay",
  "linkaja",
  "tunai",
  "cash",
  "dompet",
  "kas"
];
function parseNumericToken(rawNum, suffix) {
  const sfx = (suffix ?? "").toLowerCase();
  let cleaned = rawNum.trim();
  if (sfx) {
    if (cleaned.includes(".") && cleaned.includes(",")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (cleaned.includes(",")) {
      cleaned = cleaned.replace(",", ".");
    } else if (cleaned.includes(".")) {
      const parts = cleaned.split(".");
      if (parts.length === 2 && parts[1].length === 3) {
        cleaned = parts.join("");
      }
    }
    const base = Number.parseFloat(cleaned);
    if (!Number.isFinite(base) || base <= 0) return null;
    if (sfx === "rb" || sfx === "ribu" || sfx === "k") {
      return Math.round(base * 1e3);
    }
    if (sfx === "jt" || sfx === "juta") {
      return Math.round(base * 1e6);
    }
    if (sfx === "m" || sfx === "miliar" || sfx === "milyar") {
      return Math.round(base * 1e9);
    }
    return Math.round(base);
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "");
  } else if (/^\d{1,3}(,\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "");
  } else {
    cleaned = cleaned.replace(/,/g, ".");
  }
  const val = Number.parseFloat(cleaned);
  if (!Number.isFinite(val) || val <= 0) return null;
  return Math.round(val);
}
function extractAmountFromCommand(text) {
  const withUnitRegex = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta|miliar|milyar|m)\b/gi;
  const unitMatches = [...text.matchAll(withUnitRegex)];
  if (unitMatches.length > 0) {
    let best = null;
    for (const m of unitMatches) {
      const val = parseNumericToken(m[1], m[2]);
      if (val !== null && (best === null || val > best)) {
        best = val;
      }
    }
    if (best !== null) return best;
  }
  const rpRegex = /rp\.?\s*(\d+(?:[.,]\d{3})+|\d{4,})/gi;
  const rpMatch = rpRegex.exec(text);
  if (rpMatch) {
    return parseNumericToken(rpMatch[1]);
  }
  const plainDigitsRegex = /\b(\d{1,3}(?:[.,]\d{3})+|\d{4,})\b/g;
  const plainMatch = plainDigitsRegex.exec(text);
  if (plainMatch) {
    return parseNumericToken(plainMatch[1]);
  }
  return null;
}
function findBestAccountMatch(hintText, accounts) {
  const active = accounts.filter((a) => a.is_active);
  const pool = active.length > 0 ? active : accounts;
  if (pool.length === 0) return null;
  const lower = hintText.toLowerCase().trim();
  if (!lower) return null;
  const exact = pool.find((a) => a.account_name.toLowerCase() === lower);
  if (exact) return exact;
  const contains = pool.find(
    (a) => lower.includes(a.account_name.toLowerCase()) || a.account_name.toLowerCase().includes(lower)
  );
  if (contains) return contains;
  const tokens = lower.split(/\s+/).filter((t) => t.length >= 3);
  for (const tok of tokens) {
    const tokMatch = pool.find((a) => a.account_name.toLowerCase().includes(tok));
    if (tokMatch) return tokMatch;
  }
  if (/\b(tunai|cash|dompet|kas)\b/i.test(lower)) {
    return pool.find((a) => a.account_type === "cash") ?? null;
  }
  if (/\b(gopay|ovo|dana|shopeepay|linkaja|ewallet|e-wallet)\b/i.test(lower)) {
    return pool.find((a) => a.account_type === "ewallet") ?? null;
  }
  if (/\b(bca|mandiri|bri|bni|bsi|cimb|jago|blu|seabank|bank|rekening|tabungan)\b/i.test(lower)) {
    return pool.find((a) => a.account_type === "bank") ?? null;
  }
  return null;
}
function inferCategory(text, type) {
  const lower = text.toLowerCase();
  if (type === "transfer") return "Transfer Internal";
  if (type === "income") {
    if (/\b(gaji|honor|upah|thr)\b/.test(lower)) return "Gaji & Pendapatan";
    if (/\b(bonus|komisi|dividen|bunga)\b/.test(lower)) return "Bonus & Investasi";
    if (/\b(jual|penjualan|refund|cashback)\b/.test(lower)) return "Penjualan & Refund";
    return "Pemasukan Lainnya";
  }
  if (/\b(kopi|ngopi|makan|minum|sarapan|siang|malam|resto|kafe|warteg|jajan)\b/.test(lower)) {
    return "Makanan & Minuman";
  }
  if (/\b(emas|antam|saham|reksadana|obligasi|crypto|investasi)\b/.test(lower)) {
    return "Investasi & Aset";
  }
  if (/\b(bensin|grab|gojek|ojol|tol|parkir|kereta|pesawat|tiket|transport)\b/.test(lower)) {
    return "Transportasi";
  }
  if (/\b(listrik|pln|air|pdam|internet|wifi|pulsa|kuota|tagihan|bpjs)\b/.test(lower)) {
    return "Utilitas & Tagihan";
  }
  if (/\b(cicilan|utang|pinjaman|kredit|kartu kredit)\b/.test(lower)) {
    return "Utang & Cicilan";
  }
  if (/\b(belanja|baju|sepatu|tokopedia|shopee|supermarket|minimarket)\b/.test(lower)) {
    return "Belanja";
  }
  return "Pengeluaran Lainnya";
}
function extractAccountHints(text, accounts) {
  const lower = text.toLowerCase();
  const fromToMatch = /\bdari\s+([a-z0-9\s-]{2,28}?)\s+ke\s+([a-z0-9\s-]{2,28})/i.exec(lower);
  if (fromToMatch) {
    return {
      sourceHint: fromToMatch[1].trim(),
      destHint: fromToMatch[2].trim()
    };
  }
  const srcMatch = /\b(?:pakai|pake|via|lewat|menggunakan|dari)\s+([a-z0-9\s-]{2,28})/i.exec(lower);
  const dstMatch = /\b(?:ke|masuk ke|ke rekening|ke akun)\s+([a-z0-9\s-]{2,28})/i.exec(lower);
  let sourceHint = srcMatch ? srcMatch[1].trim() : null;
  let destHint = dstMatch ? dstMatch[1].trim() : null;
  if (!sourceHint && !destHint) {
    for (const acc of accounts) {
      if (lower.includes(acc.account_name.toLowerCase())) {
        sourceHint = acc.account_name;
        destHint = acc.account_name;
        break;
      }
    }
    if (!sourceHint) {
      for (const kw of KNOWN_PROVIDERS) {
        const rx = new RegExp(`\\b${kw}\\b`, "i");
        if (rx.test(lower)) {
          sourceHint = kw;
          destHint = kw;
          break;
        }
      }
    }
  }
  return { sourceHint, destHint };
}
function parseNaturalCommand(commandText, accounts = []) {
  const trimmed = commandText.trim();
  const lower = trimmed.toLowerCase();
  const warnings = [];
  let transactionType = "expense";
  const hasFromTo = /\bdari\s+.+\s+ke\s+/i.test(lower);
  const isTransferKw = TRANSFER_KEYWORDS.some((kw) => lower.includes(kw));
  const isIncomeKw = INCOME_KEYWORDS.some((kw) => new RegExp(`\\b${kw}\\b`, "i").test(lower));
  const isExpenseKw = EXPENSE_KEYWORDS.some((kw) => new RegExp(`\\b${kw}\\b`, "i").test(lower));
  if (hasFromTo || isTransferKw) {
    transactionType = "transfer";
  } else if (isIncomeKw && !isExpenseKw) {
    transactionType = "income";
  } else if (isIncomeKw && /\b(terima|gaji|pemasukan|bonus|dividen|refund)\b/i.test(lower)) {
    transactionType = "income";
  } else {
    transactionType = "expense";
  }
  const amount = extractAmountFromCommand(trimmed);
  if (amount === null) {
    warnings.push("Nominal belum terdeteksi. Mohon lengkapi atau koreksi nominal sebelum menyetujui.");
  }
  const { sourceHint, destHint } = extractAccountHints(trimmed, accounts);
  let sourceAccountId = null;
  let destinationAccountId = null;
  if (transactionType === "expense") {
    const hint = sourceHint ?? destHint ?? "";
    const matched = findBestAccountMatch(hint, accounts) ?? findBestAccountMatch(trimmed, accounts);
    sourceAccountId = matched?.id ?? null;
    if (!sourceAccountId) {
      warnings.push("Akun sumber dana belum cocok dengan daftar akun aktif Owner.");
    }
  } else if (transactionType === "income") {
    const hint = destHint ?? sourceHint ?? "";
    const matched = findBestAccountMatch(hint, accounts) ?? findBestAccountMatch(trimmed, accounts);
    destinationAccountId = matched?.id ?? null;
    if (!destinationAccountId) {
      warnings.push("Akun tujuan pemasukan belum cocok dengan daftar akun aktif Owner.");
    }
  } else {
    const srcMatch = sourceHint ? findBestAccountMatch(sourceHint, accounts) : null;
    const dstMatch = destHint ? findBestAccountMatch(destHint, accounts) : null;
    sourceAccountId = srcMatch?.id ?? null;
    destinationAccountId = dstMatch?.id ?? null;
    if (!sourceAccountId || !destinationAccountId || sourceAccountId === destinationAccountId) {
      warnings.push("Transfer membutuhkan akun sumber dan akun tujuan yang berbeda.");
    }
  }
  const category = inferCategory(trimmed, transactionType);
  const description = trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
  let confidence = "high";
  if (amount === null || warnings.length >= 2) {
    confidence = "low";
  } else if (warnings.length === 1) {
    confidence = "medium";
  }
  return {
    transaction_type: transactionType,
    amount,
    category,
    description,
    source_account_id: sourceAccountId,
    destination_account_id: destinationAccountId,
    source_hint: sourceHint,
    destination_hint: destHint,
    transaction_date: todayISO(),
    confidence,
    warnings
  };
}

// server/authVerify.ts
import { createClient } from "@supabase/supabase-js";

// server/vaultStore.ts
import crypto2 from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";

// src/lib/vault-validation.ts
var OWNER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var VALID_ACCOUNT_TYPES = /* @__PURE__ */ new Set(["cash", "bank", "ewallet"]);
var VALID_ASSET_TYPES = /* @__PURE__ */ new Set([
  "emas",
  "properti",
  "kendaraan",
  "investasi",
  "elektronik",
  "lainnya"
]);
var VALID_FREQUENCIES = /* @__PURE__ */ new Set([
  "weekly",
  "monthly",
  "yearly"
]);
function validateAccountInput(input) {
  if (!input.owner_confirmed) {
    throw new Error("Persetujuan eksplisit Owner wajib dicentang sebelum membuat akun.");
  }
  const name = input.account_name.trim();
  if (name.length < 1 || name.length > 80) {
    throw new Error("Nama akun wajib 1\u201380 karakter.");
  }
  if (!VALID_ACCOUNT_TYPES.has(input.account_type)) {
    throw new Error("Jenis akun tidak valid.");
  }
  if (!Number.isFinite(input.opening_balance) || input.opening_balance < 0) {
    throw new Error("Saldo awal harus berupa angka >= 0.");
  }
}
function validateTransactionPayload(input) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Nominal transaksi harus lebih besar dari Rp 0.");
  }
  if (input.status === "posted" && input.owner_confirmed !== true) {
    throw new Error(
      "Prinsip Brankas Mutlak: Transaksi berstatus posted wajib memiliki persetujuan eksplisit Owner."
    );
  }
  if (input.transaction_type === "income") {
    if (!input.destination_account_id) {
      throw new Error("Pemasukan wajib memilih akun tujuan yang valid milik Owner.");
    }
  } else if (input.transaction_type === "expense") {
    if (!input.source_account_id) {
      throw new Error("Pengeluaran wajib memilih akun sumber yang valid milik Owner.");
    }
  } else if (input.transaction_type === "transfer") {
    if (!input.source_account_id || !input.destination_account_id) {
      throw new Error("Transfer wajib memilih akun sumber dan akun tujuan yang valid.");
    }
    if (input.source_account_id === input.destination_account_id) {
      throw new Error("Akun sumber dan akun tujuan transfer tidak boleh sama.");
    }
  } else {
    throw new Error("Jenis transaksi tidak dikenali.");
  }
}
function validateAssetInput(input) {
  if (!input.owner_confirmed) {
    throw new Error("Persetujuan eksplisit Owner wajib dicentang sebelum mencatat aset.");
  }
  const name = input.asset_name.trim();
  if (name.length < 1 || name.length > 120) {
    throw new Error("Nama aset wajib diisi (maks 120 karakter).");
  }
  if (!VALID_ASSET_TYPES.has(input.asset_type)) {
    throw new Error("Kategori aset tidak valid.");
  }
  if (!Number.isFinite(input.current_value) || input.current_value < 0) {
    throw new Error("Nilai aset harus >= 0.");
  }
  if (input.quantity !== null && input.quantity !== void 0 && (!Number.isFinite(input.quantity) || input.quantity < 0)) {
    throw new Error("Kuantitas aset harus berupa angka >= 0.");
  }
}
function validateDebtInput(input) {
  if (!input.owner_confirmed) {
    throw new Error("Persetujuan eksplisit Owner wajib dicentang sebelum mencatat utang.");
  }
  const creditor = input.creditor.trim();
  if (creditor.length < 1 || creditor.length > 120) {
    throw new Error("Nama kreditur wajib diisi (maks 120 karakter).");
  }
  if (!Number.isFinite(input.original_amount) || input.original_amount <= 0) {
    throw new Error("Plafon awal utang harus lebih besar dari Rp 0.");
  }
  if (!Number.isFinite(input.outstanding_balance) || input.outstanding_balance < 0) {
    throw new Error("Sisa pokok utang tidak valid.");
  }
}
function validateDebtPaymentInput(debt, paymentAmount, sourceAccountId, ownerConfirmed) {
  if (!ownerConfirmed) {
    throw new Error(
      "Persetujuan eksplisit Owner wajib dicentang sebelum membayar utang."
    );
  }
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error("Nominal pembayaran utang harus lebih besar dari Rp 0.");
  }
  if (debt.status === "paid" || Number(debt.outstanding_balance) <= 0) {
    throw new Error("Utang ini sudah berstatus lunas.");
  }
  if (paymentAmount > Number(debt.outstanding_balance)) {
    throw new Error("Nominal pembayaran melebihi sisa pokok utang saat ini.");
  }
  if (!sourceAccountId) {
    throw new Error("Pilih akun sumber pembayaran utang.");
  }
}
function validateRecurringBillInput(input) {
  if (!input.owner_confirmed) {
    throw new Error(
      "Persetujuan eksplisit Owner wajib dicentang sebelum menyimpan jadwal rutin."
    );
  }
  if (!input.title || input.title.trim().length > 120) {
    throw new Error(
      "Nama tagihan atau pemasukan rutin wajib diisi (maks 120 karakter)."
    );
  }
  if (input.transaction_type !== "income" && input.transaction_type !== "expense") {
    throw new Error("Jenis transaksi rutin harus Pemasukan atau Pengeluaran.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Nominal tagihan rutin harus lebih besar dari Rp 0.");
  }
  if (!VALID_FREQUENCIES.has(input.frequency)) {
    throw new Error("Frekuensi jadwal rutin tidak valid.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.next_due_date)) {
    throw new Error("Tanggal jatuh tempo wajib diisi dalam format YYYY-MM-DD.");
  }
}
function validateSavingsGoalInput(input) {
  if (!input.owner_confirmed) {
    throw new Error(
      "Persetujuan eksplisit Owner wajib dicentang sebelum membuat target tabungan."
    );
  }
  if (!input.title || input.title.trim().length > 120) {
    throw new Error("Nama target tabungan wajib diisi (maks 120 karakter).");
  }
  if (input.goal_type !== "emergency_fund" && input.goal_type !== "savings_target") {
    throw new Error("Jenis target tidak valid.");
  }
  if (!Number.isFinite(input.target_amount) || input.target_amount <= 0) {
    throw new Error("Target dana harus lebih besar dari Rp 0.");
  }
  if (!Number.isFinite(input.current_amount) || input.current_amount < 0) {
    throw new Error("Dana terkumpul awal harus >= Rp 0.");
  }
}

// server/vaultRules.ts
var DEFAULT_PREFERENCES = {
  date_format: "DD MMM YYYY",
  expense_alert_limit: 5e6
};
function createEmptyVault() {
  return {
    owner: null,
    preferences: { ...DEFAULT_PREFERENCES },
    accounts: [],
    transactions: [],
    assets: [],
    debts: [],
    owner_commands: [],
    recurring_bills: [],
    savings_goals: []
  };
}
function assertSingleOwnerAvailable(db) {
  if (db.owner !== null) {
    throw new Error(
      "Sistem Single-Owner: Akun Owner sudah terdaftar. Pendaftaran kedua ditolak."
    );
  }
}
function validateTransactionInvariants(input, accounts) {
  validateTransactionPayload(input);
  const ownsAccount = (id) => id !== null && accounts.some((a) => a.id === id && a.owner_id === input.owner_id);
  if (input.transaction_type === "income") {
    if (!input.destination_account_id || !ownsAccount(input.destination_account_id)) {
      throw new Error("Pemasukan wajib memilih akun tujuan yang valid milik Owner.");
    }
  } else if (input.transaction_type === "expense") {
    if (!input.source_account_id || !ownsAccount(input.source_account_id)) {
      throw new Error("Pengeluaran wajib memilih akun sumber yang valid milik Owner.");
    }
  } else if (input.transaction_type === "transfer") {
    if (!input.source_account_id || !input.destination_account_id || !ownsAccount(input.source_account_id) || !ownsAccount(input.destination_account_id)) {
      throw new Error("Transfer wajib memilih akun sumber dan akun tujuan yang valid.");
    }
  }
}
function validateDebtPayment(debt, paymentAmount, sourceAccountId, ownerConfirmed) {
  validateDebtPaymentInput(debt, paymentAmount, sourceAccountId, ownerConfirmed);
}
function createLoginRateLimiter(maxAttempts = 5, windowMs = 15 * 60 * 1e3) {
  const attempts = /* @__PURE__ */ new Map();
  function getActiveEntry(key, nowMs) {
    const entry = attempts.get(key);
    if (!entry) return null;
    if (nowMs - entry.windowStart >= windowMs) {
      attempts.delete(key);
      return null;
    }
    return entry;
  }
  return {
    check(key, nowMs = Date.now()) {
      const entry = getActiveEntry(key, nowMs);
      if (!entry || entry.count < maxAttempts) {
        return {
          allowed: true,
          remainingAttempts: maxAttempts - (entry?.count ?? 0),
          retryAfterSeconds: 0
        };
      }
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((entry.windowStart + windowMs - nowMs) / 1e3)
      );
      const waitMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds,
        message: `Terlalu banyak percobaan masuk gagal. Demi keamanan brankas, silakan tunggu sekitar ${waitMinutes} menit sebelum mencoba lagi.`
      };
    },
    recordFailure(key, nowMs = Date.now()) {
      const existing = getActiveEntry(key, nowMs);
      const next = existing ? { count: existing.count + 1, windowStart: existing.windowStart } : { count: 1, windowStart: nowMs };
      attempts.set(key, next);
      return this.check(key, nowMs);
    },
    reset(key) {
      attempts.delete(key);
    }
  };
}
function validateChangePasswordInput(input) {
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
function validatePinFormat(pin) {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("PIN cepat wajib terdiri dari tepat 6 digit angka.");
  }
}
function validateOwnerEmailUpdateInput(input) {
  const email = input.email.trim().toLowerCase();
  const fullName = input.full_name.trim();
  if (!email || !OWNER_EMAIL_REGEX.test(email)) {
    throw new Error("Format email Owner tidak valid.");
  }
  if (fullName.length < 1 || fullName.length > 80) {
    throw new Error("Nama panggilan Owner wajib 1\u201380 karakter.");
  }
  if (!input.current_password) {
    throw new Error("Kata sandi saat ini wajib diisi untuk mengubah email Owner.");
  }
  return { email, full_name: fullName };
}
function validateResetOwnerConfirmation(input) {
  if (!input.confirmed) {
    throw new Error(
      "Centang persetujuan bahwa seluruh data brankas lokal akan dikosongkan."
    );
  }
  if (input.confirmation_text.trim().toUpperCase() !== "HAPUS") {
    throw new Error('Ketik kata "HAPUS" untuk mengonfirmasi penghapusan akun Owner.');
  }
}

// server/vaultStore.ts
var DATA_DIR = path2.resolve(process.cwd(), "data");
var VAULT_FILE = path2.join(DATA_DIR, "ego-vault.json");
function loadVault() {
  if (!fs2.existsSync(VAULT_FILE)) {
    return createEmptyVault();
  }
  try {
    const raw = fs2.readFileSync(VAULT_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...createEmptyVault(),
      ...parsed,
      preferences: {
        ...createEmptyVault().preferences,
        ...parsed.preferences ?? {}
      }
    };
  } catch {
    return createEmptyVault();
  }
}
function saveVault(db) {
  if (!fs2.existsSync(DATA_DIR)) {
    fs2.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${VAULT_FILE}.tmp`;
  fs2.writeFileSync(tmpFile, JSON.stringify(db, null, 2), "utf8");
  fs2.renameSync(tmpFile, VAULT_FILE);
}
function hashPassword(password) {
  const salt = crypto2.randomBytes(16).toString("hex");
  const derived = crypto2.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPassword(password, storedHash) {
  const [salt, originalHex] = storedHash.split(":");
  if (!salt || !originalHex) return false;
  const derived = crypto2.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, "hex");
  if (derived.length !== original.length) return false;
  return crypto2.timingSafeEqual(derived, original);
}
var SESSIONS_FILE = path2.join(DATA_DIR, "ego-sessions.json");
function loadSessions() {
  if (!fs2.existsSync(SESSIONS_FILE)) return [];
  try {
    return JSON.parse(fs2.readFileSync(SESSIONS_FILE, "utf8"));
  } catch {
    return [];
  }
}
function saveSessions(sessions) {
  if (!fs2.existsSync(DATA_DIR)) {
    fs2.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs2.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf8");
}
function createSession(ownerId) {
  const token = crypto2.randomBytes(32).toString("hex");
  const sessions = loadSessions().filter((s) => s.owner_id === ownerId).slice(-4);
  sessions.push({ token, owner_id: ownerId, created_at: (/* @__PURE__ */ new Date()).toISOString() });
  saveSessions(sessions);
  return token;
}
function validateSessionToken(token) {
  if (!token) return null;
  const sessions = loadSessions();
  const found = sessions.find((s) => s.token === token);
  return found ? found.owner_id : null;
}
function revokeSessionToken(token) {
  if (!token) return;
  const sessions = loadSessions().filter((s) => s.token !== token);
  saveSessions(sessions);
}
function rotateSessionsForOwner(ownerId, keepToken) {
  const sessions = loadSessions().filter(
    (s) => s.owner_id !== ownerId || keepToken !== void 0 && s.token === keepToken
  );
  saveSessions(sessions);
}
function clearAllSessions() {
  saveSessions([]);
}

// server/authVerify.ts
var cachedSupabaseVerifier;
function normalizeSupabaseUrl(raw) {
  const url = raw.trim();
  if (!url || url.startsWith("MY_")) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}
function getSupabaseCredentials() {
  const url = normalizeSupabaseUrl(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ""
  );
  const key = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
  if (!url || !key || key === "Xzx1@2@3xzX" || key.startsWith("MY_")) {
    return null;
  }
  return { url, key };
}
function isServerSupabaseConfigured() {
  return getSupabaseCredentials() !== null;
}
function getSupabaseVerifier() {
  if (cachedSupabaseVerifier !== void 0) {
    return cachedSupabaseVerifier;
  }
  const creds = getSupabaseCredentials();
  if (!creds) {
    cachedSupabaseVerifier = null;
    return null;
  }
  cachedSupabaseVerifier = createClient(creds.url, creds.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  return cachedSupabaseVerifier;
}
function createAuthedSupabaseClient(token) {
  const cleanToken = token.trim();
  if (!cleanToken) return null;
  const creds = getSupabaseCredentials();
  if (!creds) return null;
  return createClient(creds.url, creds.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${cleanToken}`
      }
    }
  });
}
async function verifyOwnerToken(token) {
  if (!token) return null;
  const supabaseVerifier = getSupabaseVerifier();
  if (supabaseVerifier) {
    try {
      const { data, error } = await supabaseVerifier.auth.getUser(token);
      if (!error && data.user?.id) {
        return { ownerId: data.user.id, mode: "supabase" };
      }
    } catch {
    }
  }
  const localOwnerId = validateSessionToken(token);
  const db = loadVault();
  if (localOwnerId && db.owner && db.owner.id === localOwnerId) {
    return { ownerId: localOwnerId, mode: "local" };
  }
  return null;
}

// server/gemini.ts
import {
  GoogleGenAI,
  Modality,
  Type
} from "@google/genai";
var GeminiApiError = class extends Error {
  constructor(message, statusCode = 500, code = "AI_ERROR") {
    super(message);
    this.name = "GeminiApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
};
function classifyGeminiError(err) {
  if (err instanceof GeminiApiError) return err;
  const rawMsg = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err ?? "");
  const numericStatus = typeof err === "object" && err !== null && "status" in err ? Number(err.status) : NaN;
  const lower = rawMsg.toLowerCase();
  if (numericStatus === 429 || lower.includes("resource_exhausted") || lower.includes("exceeded your current quota") || lower.includes('"code":429') || lower.includes("rate limit")) {
    return new GeminiApiError(
      "Kuota atau batas permintaan Gemini API saat ini telah penuh. Anda tetap dapat memakai alternatif lokal di layar ini, menunggu reset kuota, atau memeriksa paket billing di Google AI Studio.",
      429,
      "QUOTA_EXCEEDED"
    );
  }
  if (numericStatus === 403 || numericStatus === 401 || lower.includes("permission_denied") || lower.includes("api_key_invalid") || lower.includes("api key not valid")) {
    return new GeminiApiError(
      "Kunci Gemini API tidak valid atau tidak memiliki izin akses. Periksa pengaturan GEMINI_API_KEY di panel Secrets.",
      numericStatus === 400 || lower.includes("api_key_invalid") ? 400 : 403,
      "AUTH_ERROR"
    );
  }
  if (numericStatus === 404 || lower.includes("not_found")) {
    return new GeminiApiError(
      "Model Gemini yang diminta tidak tersedia untuk proyek ini.",
      404,
      "MODEL_NOT_FOUND"
    );
  }
  if (rawMsg.startsWith("{") && rawMsg.includes('"error"')) {
    return new GeminiApiError(
      "Layanan Gemini AI sedang mengalami gangguan sementara. Silakan coba lagi atau gunakan mode alternatif lokal.",
      502,
      "AI_ERROR"
    );
  }
  return new GeminiApiError(
    rawMsg || "Terjadi gangguan saat menghubungi layanan Gemini AI.",
    500,
    "AI_ERROR"
  );
}
async function withGeminiRetryAndFallback(models, runner, retryDelayMs = 850) {
  let lastError = null;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await runner(model);
      } catch (err) {
        const classified = classifyGeminiError(err);
        lastError = classified;
        if (classified.code === "AUTH_ERROR") {
          throw classified;
        }
        const isRetryable = classified.code === "QUOTA_EXCEEDED" || classified.statusCode >= 500;
        if (attempt === 0 && isRetryable && retryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }
        break;
      }
    }
  }
  throw lastError ?? new GeminiApiError("Gagal memproses permintaan Gemini AI.", 500, "AI_ERROR");
}
function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || isPlaceholderEnvValue(apiKey)) {
    throw new GeminiApiError(
      "GEMINI_API_KEY belum tersedia di environment server. Silakan periksa panel Secrets.",
      403,
      "AUTH_ERROR"
    );
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
var searchCache = /* @__PURE__ */ new Map();
var SEARCH_CACHE_TTL_MS = 10 * 60 * 1e3;
async function runFinancialSearch(query) {
  const cacheKey = query.trim().toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  const ai = getAIClient();
  const response = await withGeminiRetryAndFallback(
    ["gemini-4-hydrogen", "gemini-3.1-flash-lite"],
    (model) => ai.models.generateContent({
      model,
      contents: query,
      config: {
        systemInstruction: "Anda adalah EGO Personal AI, asisten riset keuangan pribadi berbahasa Indonesia formal dan ringkas. Gunakan hasil pencarian Google Search terkini untuk memberikan data akurat (kurs mata uang, harga emas Antam, suku bunga BI, inflasi, atau berita ekonomi). Sertakan tanggal/konteks waktu bila tersedia. Jangan mengarang angka.",
        tools: [{ googleSearch: {} }]
      }
    })
  );
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = [];
  const seen = /* @__PURE__ */ new Set();
  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    const title = chunk.web?.title;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      sources.push({
        uri,
        title: title || uri
      });
    }
  }
  const result = {
    answer: response.text ?? "Tidak ada ringkasan yang dapat ditampilkan.",
    sources
  };
  searchCache.set(cacheKey, {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    result
  });
  return result;
}
async function scanReceiptToDraft(imageBase64, mimeType, accounts) {
  const ai = getAIClient();
  const allowedMimes = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
  const safeMime = allowedMimes.has(mimeType) ? mimeType : "image/jpeg";
  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "").trim();
  if (!cleanBase64) {
    throw new Error("Data gambar struk tidak valid atau kosong.");
  }
  const activeAccountNames = accounts.filter((a) => a.is_active).map((a) => `${a.account_name} (${a.account_type})`).join(", ");
  const today = todayISO();
  const response = await withGeminiRetryAndFallback(
    ["gemini-4-hydrogen", "gemini-3.1-flash-lite"],
    (model) => ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: safeMime,
                data: cleanBase64
              }
            },
            {
              text: `Analisis foto struk/nota/bukti transfer Indonesia ini dan ekstrak rincian transaksi utamanya. Tanggal hari ini adalah ${today}. Akun aktif milik Owner: ${activeAccountNames || "belum ada akun"}. Pastikan nominal menggunakan angka bulat Rupiah (tanpa pemisah ribuan), tanggal dalam format YYYY-MM-DD, dan isi warning jika ada bagian struk yang buram atau metode bayar tidak tertulis.`
            }
          ]
        }
      ],
      config: {
        systemInstruction: "Anda adalah ekstraktor struk transaksi keuangan pribadi Indonesia. Keluarkan JSON terstruktur yang akurat dari foto struk belanja, nota restoran, tagihan listrik/internet, atau bukti transfer bank/QRIS. Pilih kategori yang paling tepat: Makanan & Minuman, Transportasi, Utilitas & Tagihan, Belanja, Investasi & Aset, Kesehatan, Hiburan, Utang & Cicilan, Transfer Internal, Gaji & Pendapatan, atau Pengeluaran Lainnya.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transaction_type: {
              type: Type.STRING,
              enum: ["expense", "income", "transfer"]
            },
            amount: {
              type: Type.NUMBER,
              description: "Total akhir yang dibayarkan atau diterima dalam Rupiah."
            },
            transaction_date: {
              type: Type.STRING,
              description: "Tanggal transaksi format YYYY-MM-DD."
            },
            category: {
              type: Type.STRING
            },
            merchant: {
              type: Type.STRING,
              description: "Nama toko, merchant, atau pihak transaksi."
            },
            description: {
              type: Type.STRING,
              description: "Ringkasan singkat isi transaksi dalam bahasa Indonesia."
            },
            account_hint: {
              type: Type.STRING,
              description: "Nama metode pembayaran/bank/e-wallet yang terlihat di struk (misal BCA, Mandiri, GoPay, QRIS, Tunai) atau string kosong jika tidak terlihat."
            },
            warnings: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: [
            "transaction_type",
            "amount",
            "transaction_date",
            "category",
            "merchant",
            "description",
            "account_hint",
            "warnings"
          ]
        }
      }
    })
  );
  const rawJson = response.text?.trim();
  if (!rawJson) {
    throw new Error("Gemini tidak mengembalikan hasil pembacaan struk.");
  }
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("Format respons analisis struk tidak dapat dibaca.");
  }
  const txType = ["expense", "income", "transfer"].includes(parsed.transaction_type) ? parsed.transaction_type : "expense";
  const amount = Number.isFinite(parsed.amount) && parsed.amount > 0 ? Math.round(parsed.amount) : null;
  const txDate = /^\d{4}-\d{2}-\d{2}$/.test(parsed.transaction_date ?? "") ? parsed.transaction_date : today;
  const accountHint = (parsed.account_hint ?? "").trim();
  const matchedAcc = accountHint ? findBestAccountMatch(accountHint, accounts) : null;
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.filter((w) => typeof w === "string" && w.trim().length > 0) : [];
  let sourceAccountId = null;
  let destinationAccountId = null;
  if (txType === "expense") {
    sourceAccountId = matchedAcc?.id ?? null;
    if (!sourceAccountId) {
      warnings.push("Pilih akun sumber dana sebelum menyetujui draf struk ini.");
    }
  } else if (txType === "income") {
    destinationAccountId = matchedAcc?.id ?? null;
    if (!destinationAccountId) {
      warnings.push("Pilih akun tujuan dana sebelum menyetujui draf struk ini.");
    }
  } else {
    sourceAccountId = matchedAcc?.id ?? null;
    warnings.push("Periksa akun sumber dan tujuan transfer dari bukti ini.");
  }
  if (amount === null) {
    warnings.push("Nominal total struk belum terbaca jelas. Mohon isi manual.");
  }
  const merchant = (parsed.merchant ?? "").trim() || "Merchant Struk";
  const description = (parsed.description ?? "").trim() || `Struk ${merchant}`;
  const category = (parsed.category ?? "").trim() || "Belanja";
  const commandText = `[Scan Struk] ${merchant} \xB7 ${description}${amount ? ` \xB7 Rp ${amount.toLocaleString("id-ID")}` : ""}`;
  const draft = {
    transaction_type: txType,
    amount,
    category,
    description: `${merchant} \u2014 ${description}`.slice(0, 140),
    source_account_id: sourceAccountId,
    destination_account_id: destinationAccountId,
    source_hint: txType !== "income" ? accountHint || null : null,
    destination_hint: txType !== "expense" ? accountHint || null : null,
    transaction_date: txDate,
    confidence: amount === null || warnings.length >= 2 ? "low" : warnings.length === 1 ? "medium" : "high",
    warnings
  };
  return {
    commandText,
    draft,
    merchant
  };
}
async function synthesizeIndonesianTTS(text, style) {
  const ai = getAIClient();
  const cleanText = text.trim().slice(0, 2500);
  if (!cleanText) {
    throw new Error("Teks untuk dibacakan tidak boleh kosong.");
  }
  const response = await withGeminiRetryAndFallback(
    ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"],
    (model) => ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: cleanText,
              speechMetadata: {
                style: style || "Jelas, tenang, formal, ringkas, seperti asisten keuangan pribadi Indonesia profesional."
              }
            }
          ]
        }
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" }
          }
        }
      }
    })
  );
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Model TTS tidak mengembalikan data audio.");
  }
  return {
    audioBase64: base64Audio,
    mimeType: "audio/wav"
  };
}
var createDraftProposalTool = {
  name: "buat_draf_mutasi",
  description: "Membuat draf mutasi transaksi keuangan ke Antrean Persetujuan Owner (status pending, belum memotong atau menambah saldo sampai Owner menyetujui di layar).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command_text: {
        type: Type.STRING,
        description: "Ringkasan perintah bahasa alami transaksi, misalnya 'bayar kopi 25rb pakai gopay' atau 'terima gaji 15jt ke bca'."
      }
    },
    required: ["command_text"]
  }
};
async function attachLiveVoiceSession(clientWs, sessionToken) {
  const verified = await verifyOwnerToken(sessionToken);
  if (!verified) {
    clientWs.send(
      JSON.stringify({
        error: "Sesi Owner tidak valid. Silakan masuk kembali terlebih dahulu."
      })
    );
    clientWs.close();
    return;
  }
  const ownerId = verified.ownerId;
  let ai;
  try {
    ai = getAIClient();
  } catch (err) {
    clientWs.send(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Konfigurasi Gemini belum siap."
      })
    );
    clientWs.close();
    return;
  }
  const authedSupabase = verified.mode === "supabase" && sessionToken ? createAuthedSupabaseClient(sessionToken) : null;
  let initialAccounts = [];
  if (authedSupabase) {
    const { data } = await authedSupabase.from("accounts").select("*").eq("is_active", true);
    initialAccounts = data ?? [];
  } else {
    initialAccounts = loadVault().accounts.filter((a) => a.is_active);
  }
  const accountList = initialAccounts.map((a) => `${a.account_name} (${a.account_type})`).join(", ");
  let session = null;
  let closed = false;
  try {
    session = await ai.live.connect({
      model: "gemini-3.8-live",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: [createDraftProposalTool] }],
        systemInstruction: `Anda adalah EGO Personal AI, asisten keuangan pribadi untuk satu Owner tunggal berbahasa Indonesia formal dan ringkas. Akun aktif Owner saat ini: ${accountList || "belum ada akun"}. ATURAN BRANKAS MUTLAK: Anda hanya boleh membuat DRAF ke Antrean Persetujuan menggunakan alat buat_draf_mutasi; Anda TIDAK PERNAH bisa langsung memotong atau memindahkan saldo tanpa persetujuan manual Owner di layar. Selalu konfirmasi secara lisan bahwa draf telah dikirim ke Antrean Persetujuan untuk ditinjau Owner.`
      },
      callbacks: {
        onopen: () => {
          if (!closed && clientWs.readyState === 1) {
            clientWs.send(JSON.stringify({ status: "connected" }));
          }
        },
        onmessage: (message) => {
          if (closed || clientWs.readyState !== 1) return;
          const content = message.serverContent;
          if (content?.inputTranscription?.text) {
            clientWs.send(
              JSON.stringify({ inputTranscript: content.inputTranscription.text })
            );
          }
          if (content?.outputTranscription?.text) {
            clientWs.send(
              JSON.stringify({ outputTranscript: content.outputTranscription.text })
            );
          }
          if (content?.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
          for (const part of content?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
            }
          }
          for (const call of message.toolCall?.functionCalls ?? []) {
            if (call.name === "buat_draf_mutasi") {
              const commandText = String(
                call.args?.command_text ?? ""
              ).trim().slice(0, 500);
              if (commandText) {
                void (async () => {
                  try {
                    let savedCmd;
                    if (authedSupabase) {
                      const { data: accRows } = await authedSupabase.from("accounts").select("*");
                      const currentAccounts = accRows ?? initialAccounts;
                      const draft = parseNaturalCommand(commandText, currentAccounts);
                      const { data: inserted, error: insertErr } = await authedSupabase.from("owner_commands").insert({
                        command_text: commandText,
                        status: "pending",
                        parsed_draft: draft
                      }).select("*").single();
                      if (insertErr || !inserted) {
                        throw new Error(
                          insertErr?.message || "Gagal menyimpan draf suara ke Supabase."
                        );
                      }
                      savedCmd = inserted;
                    } else {
                      const currentDb = loadVault();
                      const draft = parseNaturalCommand(commandText, currentDb.accounts);
                      savedCmd = {
                        id: crypto.randomUUID(),
                        owner_id: ownerId,
                        command_text: commandText,
                        status: "pending",
                        parsed_draft: draft,
                        created_at: (/* @__PURE__ */ new Date()).toISOString()
                      };
                      currentDb.owner_commands.unshift(savedCmd);
                      saveVault(currentDb);
                    }
                    if (!closed && clientWs.readyState === 1) {
                      clientWs.send(JSON.stringify({ draftCreated: savedCmd }));
                    }
                    session?.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: {
                            ok: true,
                            message: "Draf berhasil masuk ke Antrean Persetujuan (status pending). Saldo belum berubah sampai Owner menyetujui."
                          }
                        }
                      ]
                    });
                  } catch (toolErr) {
                    session?.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: {
                            ok: false,
                            message: toolErr instanceof Error ? toolErr.message : "Gagal mengirim draf suara ke antrean."
                          }
                        }
                      ]
                    });
                  }
                })();
              }
            }
          }
        },
        onerror: (err) => {
          if (!closed && clientWs.readyState === 1) {
            const classified = classifyGeminiError(err);
            clientWs.send(JSON.stringify({ error: classified.message }));
          }
        },
        onclose: () => {
          if (!closed && clientWs.readyState === 1) {
            clientWs.send(JSON.stringify({ status: "closed" }));
          }
        }
      }
    });
  } catch (err) {
    if (clientWs.readyState === 1) {
      const classified = classifyGeminiError(err);
      clientWs.send(JSON.stringify({ error: classified.message }));
      clientWs.close();
    }
    return;
  }
  clientWs.on("message", (raw) => {
    if (closed || !session) return;
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.audio) {
        session.sendRealtimeInput({
          audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" }
        });
      }
      if (msg.text) {
        session.sendRealtimeInput({ text: msg.text });
      }
    } catch {
    }
  });
  clientWs.on("close", () => {
    closed = true;
    try {
      session?.close();
    } catch {
    }
  });
}

// server.ts
var PORT = process.env.NODE_ENV === "production" ? Number(process.env.PORT) || 3e3 : 3e3;
var loginRateLimiter = createLoginRateLimiter(5, 15 * 60 * 1e3);
var passwordRateLimiter = createLoginRateLimiter(5, 15 * 60 * 1e3);
var pinRateLimiter = createLoginRateLimiter(5, 15 * 60 * 1e3);
function extractToken(req) {
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
  return void 0;
}
function isHttpsRequest(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  return req.secure || forwardedProto === "https";
}
function setSessionCookie(req, res, token) {
  const https = isHttpsRequest(req);
  res.cookie("ego_session", token, {
    httpOnly: true,
    secure: https,
    sameSite: https ? "none" : "lax",
    partitioned: https,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1e3
  });
}
function clearSessionCookie(req, res) {
  const https = isHttpsRequest(req);
  res.clearCookie("ego_session", {
    httpOnly: true,
    secure: https,
    sameSite: https ? "none" : "lax",
    partitioned: https,
    path: "/"
  });
}
function verifyMutationOrigin(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }
  if (req.headers["x-requested-with"] === "EGO-Vault-SPA" || req.headers.authorization?.startsWith("Bearer ")) {
    next();
    return;
  }
  const origin = req.headers.origin;
  const expectedHost = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").split(",")[0].trim();
  if (origin && expectedHost) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === expectedHost) {
        next();
        return;
      }
    } catch {
    }
  }
  res.status(403).json({ error: "Asal permintaan tidak diizinkan." });
}
async function requireOwner(req, res, next) {
  const token = extractToken(req);
  const verified = await verifyOwnerToken(token);
  if (!verified) {
    res.status(401).json({ error: "Autentikasi Owner diperlukan." });
    return;
  }
  req.ownerId = verified.ownerId;
  next();
}
async function startServer() {
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
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get("/api/auth/status", (req, res) => {
    const db = loadVault();
    const token = extractToken(req);
    const sessionOwnerId = validateSessionToken(token);
    const authenticated = Boolean(sessionOwnerId && db.owner && db.owner.id === sessionOwnerId);
    res.json({
      hasOwner: db.owner !== null,
      authenticated,
      hasPin: authenticated ? Boolean(db.owner?.pin_hash) : false,
      owner: authenticated && db.owner ? {
        id: db.owner.id,
        email: db.owner.email,
        full_name: db.owner.full_name,
        created_at: db.owner.created_at
      } : null
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
        res.status(400).json({ error: "Nama panggilan Owner wajib 1\u201380 karakter." });
        return;
      }
      if (password.length < 6 || password.length > 128) {
        res.status(400).json({ error: "Kata sandi wajib 6\u2013128 karakter." });
        return;
      }
      const ownerId = crypto3.randomUUID();
      db.owner = {
        id: ownerId,
        email,
        full_name: fullName,
        password_hash: hashPassword(password),
        created_at: (/* @__PURE__ */ new Date()).toISOString()
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
          created_at: db.owner.created_at
        }
      });
    } catch (err) {
      res.status(403).json({
        error: err instanceof Error ? err.message : "Registrasi Owner ditolak."
      });
    }
  });
  app.post("/api/auth/login", (req, res) => {
    const clientKey = req.ip || "local-owner";
    const rateCheck = loginRateLimiter.check(clientKey);
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: rateCheck.message,
        retryAfterSeconds: rateCheck.retryAfterSeconds
      });
      return;
    }
    const db = loadVault();
    if (!db.owner) {
      res.status(404).json({
        error: "Belum ada akun Owner terdaftar. Silakan registrasi Owner perdana."
      });
      return;
    }
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (email !== db.owner.email || !verifyPassword(password, db.owner.password_hash)) {
      const failure = loginRateLimiter.recordFailure(clientKey);
      res.status(failure.allowed ? 401 : 429).json({
        error: failure.allowed ? `Email atau kata sandi Owner tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.` : failure.message,
        remainingAttempts: failure.remainingAttempts,
        retryAfterSeconds: failure.retryAfterSeconds
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
        created_at: db.owner.created_at
      }
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
        confirmation_text: String(req.body?.confirmation_text ?? "")
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
        error: err instanceof Error ? err.message : "Gagal menghapus akun Owner lokal."
      });
    }
  });
  app.patch("/api/auth/profile", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds
        });
        return;
      }
      const normalized = validateOwnerEmailUpdateInput({
        email: String(req.body?.email ?? ""),
        full_name: String(req.body?.full_name ?? ""),
        current_password: String(req.body?.current_password ?? "")
      });
      const db = loadVault();
      if (!db.owner || db.owner.id !== ownerId) {
        res.status(404).json({ error: "Akun Owner tidak ditemukan." });
        return;
      }
      if (!verifyPassword(String(req.body?.current_password ?? ""), db.owner.password_hash)) {
        const failure = passwordRateLimiter.recordFailure(clientKey);
        res.status(failure.allowed ? 401 : 429).json({
          error: failure.allowed ? `Kata sandi saat ini tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.` : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds
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
          created_at: db.owner.created_at
        }
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal memperbarui identitas Owner."
      });
    }
  });
  app.delete("/api/auth/owner", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds
        });
        return;
      }
      if (req.body?.confirmed !== true) {
        res.status(400).json({
          error: "Centang konfirmasi penghapusan akun Owner terlebih dahulu."
        });
        return;
      }
      const currentPassword = String(req.body?.current_password ?? "");
      if (!currentPassword) {
        res.status(400).json({
          error: "Masukkan kata sandi Owner saat ini untuk verifikasi."
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
          error: failure.allowed ? `Kata sandi Owner tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.` : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds
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
        error: err instanceof Error ? err.message : "Gagal menghapus akun Owner."
      });
    }
  });
  app.post("/api/auth/change-password", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds
        });
        return;
      }
      const currentPassword = String(req.body?.current_password ?? "");
      const newPassword = String(req.body?.new_password ?? "");
      validateChangePasswordInput({
        current_password: currentPassword,
        new_password: newPassword
      });
      const db = loadVault();
      if (!db.owner || db.owner.id !== ownerId) {
        res.status(404).json({ error: "Akun Owner tidak ditemukan." });
        return;
      }
      if (!verifyPassword(currentPassword, db.owner.password_hash)) {
        const failure = passwordRateLimiter.recordFailure(clientKey);
        res.status(failure.allowed ? 401 : 429).json({
          error: failure.allowed ? `Kata sandi saat ini tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.` : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds
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
        error: err instanceof Error ? err.message : "Gagal mengganti kata sandi."
      });
    }
  });
  app.post("/api/auth/pin/setup", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds
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
          error: failure.allowed ? `Kata sandi Owner tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.` : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds
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
        error: err instanceof Error ? err.message : "Gagal mengaktifkan kunci PIN."
      });
    }
  });
  app.post("/api/auth/pin/verify", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = pinRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds
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
          error: failure.allowed ? `PIN 6 digit tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.` : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds
        });
        return;
      }
      pinRateLimiter.reset(clientKey);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Verifikasi PIN gagal."
      });
    }
  });
  app.post("/api/auth/pin/disable", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
      const clientKey = `${ownerId}:${req.ip || "local-owner"}`;
      const rateCheck = passwordRateLimiter.check(clientKey);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: rateCheck.message,
          retryAfterSeconds: rateCheck.retryAfterSeconds
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
          error: failure.allowed ? `Kata sandi Owner tidak sesuai. Sisa percobaan: ${failure.remainingAttempts}.` : failure.message,
          remainingAttempts: failure.remainingAttempts,
          retryAfterSeconds: failure.retryAfterSeconds
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
        error: err instanceof Error ? err.message : "Gagal menonaktifkan kunci PIN."
      });
    }
  });
  app.get("/api/vault/snapshot", requireOwner, (_req, res) => {
    const db = loadVault();
    const accountBalances = computeAccountBalances(db.accounts, db.transactions);
    res.json({
      accounts: accountBalances,
      transactions: [...db.transactions].sort(
        (a, b) => b.transaction_date === a.transaction_date ? b.created_at.localeCompare(a.created_at) : b.transaction_date.localeCompare(a.transaction_date)
      ),
      assets: [...db.assets].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      debts: [...db.debts].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      owner_commands: [...db.owner_commands].sort(
        (a, b) => b.created_at.localeCompare(a.created_at)
      ),
      recurring_bills: [...db.recurring_bills ?? []].sort(
        (a, b) => a.next_due_date.localeCompare(b.next_due_date)
      ),
      savings_goals: [...db.savings_goals ?? []].sort(
        (a, b) => b.created_at.localeCompare(a.created_at)
      ),
      preferences: db.preferences
    });
  });
  app.post("/api/accounts", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      const accountName = String(req.body?.account_name ?? "").trim();
      const accountType = String(req.body?.account_type ?? "");
      const openingBalance = Number(req.body?.opening_balance ?? 0);
      validateAccountInput({
        account_name: accountName,
        account_type: accountType,
        opening_balance: openingBalance,
        owner_confirmed: ownerConfirmed
      });
      const db = loadVault();
      const newAccount = {
        id: crypto3.randomUUID(),
        owner_id: ownerId,
        account_name: accountName,
        account_type: accountType,
        opening_balance: roundCurrency(openingBalance),
        currency: "IDR",
        is_active: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.accounts.push(newAccount);
      saveVault(db);
      res.status(201).json(newAccount);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal membuat akun."
      });
    }
  });
  app.patch("/api/accounts/:id/archive", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
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
      const ownerId = req.ownerId;
      const db = loadVault();
      const txType = req.body?.transaction_type;
      const sourceId = req.body?.source_account_id ? String(req.body.source_account_id) : null;
      const destId = req.body?.destination_account_id ? String(req.body.destination_account_id) : null;
      const amount = Number(req.body?.amount ?? 0);
      const txDate = String(req.body?.transaction_date ?? todayISO()).slice(0, 10);
      const category = req.body?.category ? String(req.body.category).trim() : null;
      const description = req.body?.description ? String(req.body.description).trim() : null;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      const status = ownerConfirmed ? "posted" : "pending";
      validateTransactionInvariants(
        {
          owner_id: ownerId,
          transaction_type: txType,
          source_account_id: sourceId,
          destination_account_id: destId,
          amount,
          status,
          owner_confirmed: ownerConfirmed
        },
        db.accounts
      );
      const newTx = {
        id: crypto3.randomUUID(),
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
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.transactions.unshift(newTx);
      saveVault(db);
      res.status(201).json(newTx);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal mencatat transaksi."
      });
    }
  });
  app.patch("/api/transactions/:id/cancel", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
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
      const ownerId = req.ownerId;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      const assetName = String(req.body?.asset_name ?? "").trim();
      const assetType = String(req.body?.asset_type ?? "lainnya");
      const currentValue = Number(req.body?.current_value ?? 0);
      const rawQuantity = req.body?.quantity !== void 0 && req.body?.quantity !== null && req.body?.quantity !== "" ? Number(req.body.quantity) : null;
      const unit = req.body?.unit ? String(req.body.unit).trim() : null;
      const notes = req.body?.notes ? String(req.body.notes).trim() : null;
      validateAssetInput({
        asset_name: assetName,
        asset_type: assetType,
        current_value: currentValue,
        quantity: rawQuantity,
        owner_confirmed: ownerConfirmed
      });
      const db = loadVault();
      const asset = {
        id: crypto3.randomUUID(),
        owner_id: ownerId,
        asset_name: assetName,
        asset_type: assetType,
        current_value: roundCurrency(currentValue),
        quantity: rawQuantity,
        unit,
        notes,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.assets.unshift(asset);
      saveVault(db);
      res.status(201).json(asset);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal mencatat aset."
      });
    }
  });
  app.patch("/api/assets/:id", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
    if (req.body?.owner_confirmed !== true) {
      res.status(400).json({
        error: "Persetujuan eksplisit Owner wajib dicentang sebelum memperbarui nilai aset."
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
    if (req.body?.notes !== void 0) {
      asset.notes = req.body.notes ? String(req.body.notes).trim() : null;
    }
    saveVault(db);
    res.json(asset);
  });
  app.post("/api/debts", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      const creditor = String(req.body?.creditor ?? "").trim();
      const originalAmount = Number(req.body?.original_amount ?? 0);
      const outstandingBalance = req.body?.outstanding_balance !== void 0 ? Number(req.body.outstanding_balance) : originalAmount;
      const dueDate = req.body?.due_date ? String(req.body.due_date).slice(0, 10) : null;
      const description = req.body?.description ? String(req.body.description).trim() : null;
      validateDebtInput({
        creditor,
        original_amount: originalAmount,
        outstanding_balance: outstandingBalance,
        owner_confirmed: ownerConfirmed
      });
      const db = loadVault();
      const debt = {
        id: crypto3.randomUUID(),
        owner_id: ownerId,
        creditor,
        original_amount: roundCurrency(originalAmount),
        outstanding_balance: roundCurrency(outstandingBalance),
        due_date: dueDate,
        status: outstandingBalance === 0 ? "paid" : "active",
        description,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.debts.unshift(debt);
      saveVault(db);
      res.status(201).json(debt);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal mencatat utang."
      });
    }
  });
  app.post("/api/debts/:id/pay", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
      const db = loadVault();
      const debt = db.debts.find((d) => d.id === req.params.id && d.owner_id === ownerId);
      if (!debt) {
        res.status(404).json({ error: "Data utang tidak ditemukan." });
        return;
      }
      const paymentAmount = Number(req.body?.amount ?? 0);
      const sourceAccountId = String(req.body?.source_account_id ?? "");
      const ownerConfirmed = req.body?.owner_confirmed === true;
      validateDebtPayment(debt, paymentAmount, sourceAccountId, ownerConfirmed);
      validateTransactionInvariants(
        {
          owner_id: ownerId,
          transaction_type: "expense",
          source_account_id: sourceAccountId,
          destination_account_id: null,
          amount: paymentAmount,
          status: "posted",
          owner_confirmed: ownerConfirmed
        },
        db.accounts
      );
      const newBalance = roundCurrency(debt.outstanding_balance - paymentAmount);
      debt.outstanding_balance = Math.max(0, newBalance);
      if (debt.outstanding_balance === 0) {
        debt.status = "paid";
      }
      const tx = {
        id: crypto3.randomUUID(),
        owner_id: ownerId,
        transaction_type: "expense",
        source_account_id: sourceAccountId,
        destination_account_id: null,
        amount: roundCurrency(paymentAmount),
        transaction_date: todayISO(),
        category: "Utang & Cicilan",
        description: `Pembayaran utang ke ${debt.creditor}`,
        status: "posted",
        owner_confirmed: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.transactions.unshift(tx);
      saveVault(db);
      res.json({ debt, transaction: tx });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal memproses pembayaran utang."
      });
    }
  });
  app.post("/api/commands", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
    const commandText = String(req.body?.command_text ?? "").trim();
    if (commandText.length < 1 || commandText.length > 500) {
      res.status(400).json({ error: "Perintah harus berisi 1\u2013500 karakter." });
      return;
    }
    const db = loadVault();
    const rawDraft = req.body?.parsed_draft;
    const parsedDraft = rawDraft && typeof rawDraft === "object" && ["income", "expense", "transfer"].includes(rawDraft.transaction_type) ? {
      transaction_type: rawDraft.transaction_type,
      amount: typeof rawDraft.amount === "number" && Number.isFinite(rawDraft.amount) && rawDraft.amount > 0 ? roundCurrency(rawDraft.amount) : null,
      category: String(rawDraft.category || "Lainnya").trim(),
      description: String(rawDraft.description || commandText).trim().slice(0, 140),
      source_account_id: rawDraft.source_account_id ? String(rawDraft.source_account_id) : null,
      destination_account_id: rawDraft.destination_account_id ? String(rawDraft.destination_account_id) : null,
      source_hint: rawDraft.source_hint ? String(rawDraft.source_hint) : null,
      destination_hint: rawDraft.destination_hint ? String(rawDraft.destination_hint) : null,
      transaction_date: /^\d{4}-\d{2}-\d{2}$/.test(String(rawDraft.transaction_date ?? "")) ? String(rawDraft.transaction_date) : todayISO(),
      confidence: ["high", "medium", "low"].includes(rawDraft.confidence) ? rawDraft.confidence : "medium",
      warnings: Array.isArray(rawDraft.warnings) ? rawDraft.warnings.map((w) => String(w)) : []
    } : parseNaturalCommand(commandText, db.accounts);
    const cmd = {
      id: crypto3.randomUUID(),
      owner_id: ownerId,
      command_text: commandText,
      status: "pending",
      parsed_draft: parsedDraft,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.owner_commands.unshift(cmd);
    saveVault(db);
    res.status(201).json(cmd);
  });
  app.post("/api/commands/:id/approve", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
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
          error: "Prinsip Brankas Mutlak: Persetujuan eksplisit Owner wajib dicentang sebelum mengeksekusi draf."
        });
        return;
      }
      const override = req.body?.draft ?? cmd.parsed_draft;
      if (!override) {
        res.status(400).json({ error: "Draf transaksi tidak tersedia." });
        return;
      }
      const txType = override.transaction_type;
      const amount = Number(override.amount ?? 0);
      const sourceId = override.source_account_id ? String(override.source_account_id) : null;
      const destId = override.destination_account_id ? String(override.destination_account_id) : null;
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
          owner_confirmed: true
        },
        db.accounts
      );
      const tx = {
        id: crypto3.randomUUID(),
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
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      cmd.status = "processed";
      cmd.parsed_draft = {
        ...cmd.parsed_draft ?? override,
        transaction_type: txType,
        amount: roundCurrency(amount),
        source_account_id: tx.source_account_id,
        destination_account_id: tx.destination_account_id,
        category,
        description,
        transaction_date: tx.transaction_date
      };
      db.transactions.unshift(tx);
      saveVault(db);
      res.json({ command: cmd, transaction: tx });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menyetujui perintah."
      });
    }
  });
  app.post("/api/commands/:id/reject", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
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
  app.patch("/api/preferences", requireOwner, (req, res) => {
    const db = loadVault();
    const dateFormat = req.body?.date_format;
    const expenseLimit = req.body?.expense_alert_limit;
    if (dateFormat !== void 0) {
      if (!["DD/MM/YYYY", "YYYY-MM-DD", "DD MMM YYYY"].includes(dateFormat)) {
        res.status(400).json({ error: "Format tanggal tidak valid." });
        return;
      }
      db.preferences.date_format = dateFormat;
    }
    if (expenseLimit !== void 0) {
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
        code: classified.code
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
      const style = req.body?.style ? String(req.body.style) : void 0;
      const result = await synthesizeIndonesianTTS(text, style);
      res.json(result);
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.statusCode).json({
        error: classified.message,
        code: classified.code
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
      const providedAccounts = Array.isArray(req.body?.accounts) ? req.body.accounts : null;
      let accounts = providedAccounts ?? [];
      if (accounts.length === 0) {
        const token = extractToken(req);
        const authedSupabase = token ? createAuthedSupabaseClient(token) : null;
        if (authedSupabase) {
          const { data } = await authedSupabase.from("accounts").select("*");
          accounts = data ?? [];
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
        code: classified.code
      });
    }
  });
  app.post("/api/recurring", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
      const title = String(req.body?.title ?? "").trim();
      const txType = String(req.body?.transaction_type ?? "expense");
      const amount = Number(req.body?.amount ?? 0);
      const category = String(req.body?.category ?? "Utilitas & Tagihan").trim() || "Utilitas & Tagihan";
      const accountId = req.body?.account_id ? String(req.body.account_id) : null;
      const frequency = String(req.body?.frequency ?? "monthly");
      const nextDueDate = String(req.body?.next_due_date ?? todayISO()).slice(0, 10);
      const notes = req.body?.notes ? String(req.body.notes).trim() : null;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      validateRecurringBillInput({
        title,
        transaction_type: txType,
        amount,
        frequency,
        next_due_date: nextDueDate,
        owner_confirmed: ownerConfirmed
      });
      const db = loadVault();
      const bill = {
        id: crypto3.randomUUID(),
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
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.recurring_bills.push(bill);
      saveVault(db);
      res.status(201).json(bill);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menyimpan jadwal rutin."
      });
    }
  });
  app.patch("/api/recurring/:id", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
    const db = loadVault();
    const bill = db.recurring_bills.find(
      (b) => b.id === req.params.id && b.owner_id === ownerId
    );
    if (!bill) {
      res.status(404).json({ error: "Jadwal rutin tidak ditemukan." });
      return;
    }
    if (req.body?.is_active !== void 0) {
      bill.is_active = Boolean(req.body.is_active);
    }
    saveVault(db);
    res.json(bill);
  });
  app.post("/api/recurring/:id/queue", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
    const db = loadVault();
    const bill = db.recurring_bills.find(
      (b) => b.id === req.params.id && b.owner_id === ownerId
    );
    if (!bill) {
      res.status(404).json({ error: "Jadwal rutin tidak ditemukan." });
      return;
    }
    const accountExists = bill.account_id !== null && db.accounts.some((a) => a.id === bill.account_id && a.owner_id === ownerId);
    const resolvedAccountId = accountExists ? bill.account_id : null;
    const warnings = [];
    if (!resolvedAccountId) {
      warnings.push(
        bill.transaction_type === "income" ? "Pilih akun tujuan pemasukan sebelum menyetujui." : "Pilih akun sumber dana sebelum menyetujui."
      );
    }
    const draft = {
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
      warnings
    };
    const cmd = {
      id: crypto3.randomUUID(),
      owner_id: ownerId,
      command_text: `[Tagihan Rutin] ${bill.title} \xB7 Rp ${bill.amount.toLocaleString("id-ID")} (Jatuh tempo ${bill.next_due_date})`,
      status: "pending",
      parsed_draft: draft,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.owner_commands.unshift(cmd);
    bill.last_queued_date = bill.next_due_date;
    bill.next_due_date = advanceDueDate(bill.next_due_date, bill.frequency);
    saveVault(db);
    res.status(201).json({ command: cmd, bill });
  });
  app.delete("/api/recurring/:id", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
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
  app.post("/api/goals", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
      const title = String(req.body?.title ?? "").trim();
      const goalType = String(req.body?.goal_type ?? "savings_target");
      const targetAmount = Number(req.body?.target_amount ?? 0);
      const currentAmount = Number(req.body?.current_amount ?? 0);
      const linkedAccountId = req.body?.linked_account_id ? String(req.body.linked_account_id) : null;
      const targetDate = req.body?.target_date ? String(req.body.target_date).slice(0, 10) : null;
      const notes = req.body?.notes ? String(req.body.notes).trim() : null;
      const ownerConfirmed = req.body?.owner_confirmed === true;
      validateSavingsGoalInput({
        title,
        goal_type: goalType,
        target_amount: targetAmount,
        current_amount: currentAmount,
        owner_confirmed: ownerConfirmed
      });
      const db = loadVault();
      const goal = {
        id: crypto3.randomUUID(),
        owner_id: ownerId,
        title,
        goal_type: goalType,
        target_amount: roundCurrency(targetAmount),
        current_amount: linkedAccountId ? 0 : roundCurrency(currentAmount),
        linked_account_id: linkedAccountId,
        target_date: targetDate,
        status: !linkedAccountId && currentAmount >= targetAmount ? "completed" : "active",
        notes,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.savings_goals.unshift(goal);
      saveVault(db);
      res.status(201).json(goal);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menyimpan target tabungan."
      });
    }
  });
  app.patch("/api/goals/:id", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
    const db = loadVault();
    const goal = db.savings_goals.find(
      (g) => g.id === req.params.id && g.owner_id === ownerId
    );
    if (!goal) {
      res.status(404).json({ error: "Target tabungan tidak ditemukan." });
      return;
    }
    if (req.body?.current_amount !== void 0) {
      if (req.body?.owner_confirmed !== true) {
        res.status(400).json({
          error: "Persetujuan eksplisit Owner wajib dicentang saat mengubah progres dana."
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
    const ownerId = req.ownerId;
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
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const distDir = path3.resolve(process.cwd(), "dist");
  const isProd = process.env.NODE_ENV === "production" && fs3.existsSync(distDir);
  httpServer.on("upgrade", (req, socket, head) => {
    try {
      const host = req.headers.host || `127.0.0.1:${PORT}`;
      const url = new URL(req.url ?? "/", `http://${host}`);
      if (url.pathname === "/ws/live") {
        wss.handleUpgrade(req, socket, head, (ws) => {
          const tokenFromQuery = url.searchParams.get("token") ?? void 0;
          let tokenFromCookie;
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
  let viteServer = null;
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const hmrDisabled = process.env.DISABLE_HMR === "true";
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr: hmrDisabled ? false : { server: httpServer }
      },
      appType: "spa"
    });
    viteServer = vite;
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path3.join(distDir, "index.html"));
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
    setTimeout(() => process.exit(0), 2e3).unref();
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
