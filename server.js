// server.ts
import crypto4 from "node:crypto";
import fs5 from "node:fs";
import http from "node:http";
import path5 from "node:path";

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

// src/lib/transaction-idempotency.ts
var TRANSACTION_REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidTransactionRequestId(value) {
  return typeof value === "string" && TRANSACTION_REQUEST_ID_PATTERN.test(value);
}
function isSameConfirmedTransactionRequest(existing, requested) {
  return Boolean(
    existing && requested.status === "posted" && requested.owner_confirmed === true && existing.transaction_type === requested.transaction_type && existing.source_account_id === requested.source_account_id && existing.destination_account_id === requested.destination_account_id && Number(existing.amount) === requested.amount && existing.transaction_date === requested.transaction_date && existing.category === requested.category && existing.description === requested.description && existing.status === "posted" && existing.owner_confirmed === true
  );
}

// src/lib/debt-payment-idempotency.ts
function isSameDebtPaymentRequest(log, transaction, request) {
  return Boolean(
    log && transaction && log.request_id === request.request_id && log.debt_id === request.debt_id && Number(log.amount) === request.amount && (log.notes ?? null) === (request.notes ?? null) && transaction.transaction_type === "expense" && transaction.source_account_id === request.source_account_id && Number(transaction.amount) === request.amount && transaction.category === "Utang & Cicilan" && transaction.status === "posted" && transaction.owner_confirmed === true
  );
}

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

// src/lib/reminders.ts
function advanceReminderDueDate(dueDateISO, frequency) {
  if (frequency === "once") {
    return dueDateISO.slice(0, 10);
  }
  return advanceDueDate(dueDateISO, frequency);
}
function buildReminderDedupeKey(kind, sourceId) {
  return `${kind}:${sourceId}`;
}
function normalizeReminderOffsets(offsets, customDaysBefore) {
  const set = /* @__PURE__ */ new Set();
  for (const val of offsets) {
    if (Number.isInteger(val) && val >= 0 && val <= 90) {
      set.add(val);
    }
  }
  if (customDaysBefore !== null && customDaysBefore !== void 0 && Number.isInteger(customDaysBefore) && customDaysBefore >= 0 && customDaysBefore <= 90) {
    set.add(customDaysBefore);
  }
  return Array.from(set).sort((a, b) => b - a);
}
function buildSourceSyncReminders(bills, debts, existingReminders, ownerId) {
  const existingKeys = /* @__PURE__ */ new Set();
  for (const r of existingReminders) {
    if (r.dedupe_key) existingKeys.add(r.dedupe_key);
    if (r.linked_bill_id) existingKeys.add(buildReminderDedupeKey("bill", r.linked_bill_id));
    if (r.linked_debt_id) existingKeys.add(buildReminderDedupeKey("debt", r.linked_debt_id));
  }
  const payloads = [];
  for (const bill of bills) {
    if (!bill.is_active) continue;
    const dedupeKey = buildReminderDedupeKey("bill", bill.id);
    if (existingKeys.has(dedupeKey)) continue;
    existingKeys.add(dedupeKey);
    payloads.push({
      owner_id: ownerId,
      title: bill.title,
      reminder_type: bill.transaction_type === "income" ? "pemasukan_rutin" : "tagihan_bulanan",
      transaction_type: bill.transaction_type,
      amount: bill.amount,
      due_date: bill.next_due_date.slice(0, 10),
      reminder_time: "08:00",
      frequency: bill.frequency,
      remind_offsets: [7, 3, 1, 0],
      custom_days_before: null,
      is_active: true,
      is_read: false,
      read_at: null,
      last_notified_key: null,
      last_notified_at: null,
      linked_account_id: bill.account_id,
      linked_goal_id: null,
      linked_debt_id: null,
      linked_bill_id: bill.id,
      dedupe_key: dedupeKey,
      notes: bill.notes
    });
  }
  for (const debt of debts) {
    if (debt.status !== "active" || debt.outstanding_balance <= 0 || !debt.due_date) {
      continue;
    }
    const dedupeKey = buildReminderDedupeKey("debt", debt.id);
    if (existingKeys.has(dedupeKey)) continue;
    existingKeys.add(dedupeKey);
    payloads.push({
      owner_id: ownerId,
      title: `Cicilan ${debt.creditor}`,
      reminder_type: "cicilan_utang",
      transaction_type: "expense",
      amount: debt.outstanding_balance,
      due_date: debt.due_date.slice(0, 10),
      reminder_time: "08:00",
      frequency: "monthly",
      remind_offsets: [7, 3, 1, 0],
      custom_days_before: null,
      is_active: true,
      is_read: false,
      read_at: null,
      last_notified_key: null,
      last_notified_at: null,
      linked_account_id: null,
      linked_goal_id: null,
      linked_debt_id: debt.id,
      linked_bill_id: null,
      dedupe_key: dedupeKey,
      notes: debt.description
    });
  }
  return payloads;
}

// src/lib/budgets.ts
function normalizeBudgetCategoryKey(category) {
  const cleaned = (category ?? "").trim().toLowerCase();
  return cleaned || "umum";
}
function classifyBudgetThreshold(spentAmount, limitAmount) {
  const safeSpent = Math.max(0, Number.isFinite(spentAmount) ? spentAmount : 0);
  const safeLimit = Math.max(0, Number.isFinite(limitAmount) ? limitAmount : 0);
  if (safeLimit <= 0) {
    return {
      usagePct: 0,
      crossedThreshold: null,
      severity: "safe",
      label: "Aman",
      shortLabel: "Aman"
    };
  }
  const rawRatioPct = safeSpent / safeLimit * 100;
  const usagePct = Math.round((rawRatioPct + Number.EPSILON) * 10) / 10;
  if (safeSpent > safeLimit + 1e-3) {
    return {
      usagePct,
      crossedThreshold: 101,
      severity: "exceeded_over",
      label: "Anggaran terlampaui",
      shortLabel: ">100% Terlampaui"
    };
  }
  if (safeSpent >= safeLimit - 1e-3) {
    return {
      usagePct: Math.max(100, usagePct),
      crossedThreshold: 100,
      severity: "reached_100",
      label: "Anggaran tercapai (100%)",
      shortLabel: "100% Tercapai"
    };
  }
  if (rawRatioPct >= 90) {
    return {
      usagePct,
      crossedThreshold: 90,
      severity: "high_90",
      label: "Peringatan tinggi (\u2265 90%)",
      shortLabel: "\u226590% Kritis"
    };
  }
  if (rawRatioPct >= 75) {
    return {
      usagePct,
      crossedThreshold: 75,
      severity: "warning_75",
      label: "Mulai mendekati batas (\u2265 75%)",
      shortLabel: "\u226575% Mendekati"
    };
  }
  if (rawRatioPct >= 50) {
    return {
      usagePct,
      crossedThreshold: 50,
      severity: "info_50",
      label: "Informasi penggunaan (\u2265 50%)",
      shortLabel: "\u226550% Terpakai"
    };
  }
  return {
    usagePct,
    crossedThreshold: null,
    severity: "safe",
    label: "Dalam batas aman",
    shortLabel: "Aman"
  };
}
function budgetThresholdLabel(level) {
  switch (level) {
    case 50:
      return "50% \u2014 Informasi Penggunaan";
    case 75:
      return "75% \u2014 Mulai Mendekati Batas";
    case 90:
      return "90% \u2014 Peringatan Tinggi";
    case 100:
      return "100% \u2014 Anggaran Tercapai";
    case 101:
      return ">100% \u2014 Anggaran Terlampaui";
  }
}
function isThresholdAlreadyNotified(budget, periodMonth, threshold, alertLogs) {
  if (budget.last_alert_period === periodMonth && budget.last_alert_threshold !== null && budget.last_alert_threshold >= threshold) {
    return true;
  }
  return alertLogs.some(
    (log) => log.budget_id === budget.id && log.period_month === periodMonth && log.event_type === "threshold_crossed" && log.threshold_level >= threshold
  );
}
function computeConfirmedExpensesByCategoryForMonth(transactions, periodMonth) {
  const byCategoryKey = /* @__PURE__ */ new Map();
  let totalConfirmedExpense = 0;
  let confirmedTxCount = 0;
  for (const tx of transactions) {
    if (!isPostedConfirmed(tx)) continue;
    if (tx.transaction_type !== "expense") continue;
    if (!tx.transaction_date.slice(0, 7).startsWith(periodMonth)) continue;
    const amt = Number(tx.amount) || 0;
    if (amt <= 0) continue;
    const rawCat = (tx.category ?? "").trim() || "Umum";
    const key = normalizeBudgetCategoryKey(rawCat);
    const existing = byCategoryKey.get(key) ?? {
      displayCategory: rawCat,
      total: 0,
      count: 0
    };
    existing.total = roundCurrency(existing.total + amt);
    existing.count += 1;
    byCategoryKey.set(key, existing);
    totalConfirmedExpense = roundCurrency(totalConfirmedExpense + amt);
    confirmedTxCount += 1;
  }
  return { byCategoryKey, totalConfirmedExpense, confirmedTxCount };
}

// src/lib/debt-manager.ts
function normalizeDebt(debt) {
  return {
    ...debt,
    debt_type: debt.debt_type ?? "lainnya",
    interest_rate_annual: Math.max(0, Number(debt.interest_rate_annual ?? 0) || 0),
    monthly_fee: Math.max(0, Number(debt.monthly_fee ?? 0) || 0),
    installment_amount: Math.max(0, Number(debt.installment_amount ?? 0) || 0),
    payment_frequency: debt.payment_frequency ?? "monthly"
  };
}

// server/authVerify.ts
import { createClient } from "@supabase/supabase-js";

// server/vaultStore.ts
import crypto2 from "node:crypto";

// server/fileLock.ts
import fs2 from "node:fs";
import path2 from "node:path";
function withFileLock(lockPath, operation, timeoutMs = 5e3, staleMs = 6e4) {
  const parent = path2.dirname(lockPath);
  fs2.mkdirSync(parent, { recursive: true, mode: 448 });
  const startedAt = Date.now();
  const waitCell = new Int32Array(new SharedArrayBuffer(4));
  let acquired = false;
  while (!acquired) {
    try {
      fs2.mkdirSync(lockPath, { mode: 448 });
      acquired = true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        const ageMs = Date.now() - fs2.statSync(lockPath).mtimeMs;
        if (ageMs > staleMs) {
          fs2.rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch (statError) {
        if (statError.code === "ENOENT") continue;
        throw statError;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error("Brankas sedang digunakan proses lain. Silakan coba kembali.");
      }
      Atomics.wait(waitCell, 0, 0, 10);
    }
  }
  try {
    return operation();
  } finally {
    fs2.rmSync(lockPath, { recursive: true, force: true });
  }
}

// server/vaultStore.ts
import fs3 from "node:fs";
import path3 from "node:path";

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
var VALID_DEBT_TYPES = /* @__PURE__ */ new Set([
  "kpr",
  "kendaraan",
  "kartu_kredit",
  "pinjaman_pribadi",
  "paylater",
  "usaha",
  "lainnya"
]);
var VALID_DEBT_FREQUENCIES = /* @__PURE__ */ new Set([
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly"
]);
var VALID_WHATIF_TYPES = /* @__PURE__ */ new Set([
  "cash_purchase",
  "installment_purchase",
  "new_loan",
  "accelerated_debt_payoff",
  "income_change",
  "living_cost_change",
  "savings_boost",
  "goal_milestone"
]);
var VALID_FREQUENCIES = /* @__PURE__ */ new Set([
  "weekly",
  "monthly",
  "yearly"
]);
var VALID_REMINDER_CATEGORIES = /* @__PURE__ */ new Set([
  "tagihan_bulanan",
  "cicilan_utang",
  "jatuh_tempo",
  "tanggal_gajian",
  "setoran_tabungan",
  "target_keuangan",
  "pemasukan_rutin"
]);
var VALID_REMINDER_FREQUENCIES = /* @__PURE__ */ new Set([
  "once",
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
  if (input.debt_type !== void 0 && !VALID_DEBT_TYPES.has(input.debt_type)) {
    throw new Error("Jenis utang tidak valid.");
  }
  if (!Number.isFinite(input.original_amount) || input.original_amount <= 0) {
    throw new Error("Plafon awal utang harus lebih besar dari Rp 0.");
  }
  if (!Number.isFinite(input.outstanding_balance) || input.outstanding_balance < 0) {
    throw new Error("Sisa pokok utang tidak valid.");
  }
  if (input.interest_rate_annual !== void 0 && (!Number.isFinite(input.interest_rate_annual) || input.interest_rate_annual < 0 || input.interest_rate_annual > 300)) {
    throw new Error("Bunga tahunan harus antara 0% hingga 300%.");
  }
  if (input.monthly_fee !== void 0 && (!Number.isFinite(input.monthly_fee) || input.monthly_fee < 0)) {
    throw new Error("Biaya administrasi bulanan harus >= Rp 0.");
  }
  if (input.installment_amount !== void 0 && (!Number.isFinite(input.installment_amount) || input.installment_amount < 0)) {
    throw new Error("Nominal cicilan rutin harus >= Rp 0.");
  }
  if (input.payment_frequency !== void 0 && !VALID_DEBT_FREQUENCIES.has(input.payment_frequency)) {
    throw new Error("Frekuensi cicilan utang tidak valid.");
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
function validateFinancialReminderInput(input) {
  if (!input.owner_confirmed) {
    throw new Error(
      "Persetujuan eksplisit Owner wajib dicentang sebelum menyimpan pengingat keuangan."
    );
  }
  const title = (input.title ?? "").trim();
  if (title.length < 1 || title.length > 140) {
    throw new Error("Judul pengingat wajib diisi (1\u2013140 karakter).");
  }
  if (!VALID_REMINDER_CATEGORIES.has(input.reminder_type)) {
    throw new Error("Jenis pengingat keuangan tidak valid.");
  }
  if (input.transaction_type !== "income" && input.transaction_type !== "expense" && input.transaction_type !== "transfer") {
    throw new Error("Tipe arus kas pengingat tidak valid.");
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Nominal pengingat harus berupa angka >= Rp 0.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test((input.due_date ?? "").slice(0, 10))) {
    throw new Error("Tanggal jatuh tempo wajib dalam format YYYY-MM-DD.");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.reminder_time ?? "")) {
    throw new Error("Waktu pengingat wajib dalam format JJ:MM (contoh 08:00).");
  }
  if (!VALID_REMINDER_FREQUENCIES.has(input.frequency)) {
    throw new Error("Frekuensi pengingat tidak valid.");
  }
  if (!Array.isArray(input.remind_offsets)) {
    throw new Error("Daftar jadwal pengingat (H-7/H-3/H-1/H-0) tidak valid.");
  }
  for (const offset of input.remind_offsets) {
    if (!Number.isInteger(offset) || offset < 0 || offset > 90) {
      throw new Error("Offset pengingat harus bilangan bulat antara 0 hingga 90 hari.");
    }
  }
  if (input.custom_days_before !== null && input.custom_days_before !== void 0 && (!Number.isInteger(input.custom_days_before) || input.custom_days_before < 0 || input.custom_days_before > 90)) {
    throw new Error("Pengingat khusus (H-n) harus antara 0 hingga 90 hari.");
  }
  const hasCustom = input.custom_days_before !== null && input.custom_days_before !== void 0;
  if (input.remind_offsets.length === 0 && !hasCustom) {
    throw new Error(
      "Pilih minimal satu waktu pengingat (H-7, H-3, H-1, H-0, atau hari khusus)."
    );
  }
}
function validateCategoryBudgetInput(input) {
  if (!input.owner_confirmed) {
    throw new Error(
      "Persetujuan eksplisit Owner wajib dicentang sebelum menyimpan anggaran kategori."
    );
  }
  const category = (input.category ?? "").trim();
  if (category.length < 1 || category.length > 80) {
    throw new Error("Kategori anggaran wajib diisi (1\u201380 karakter).");
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test((input.period_month ?? "").trim())) {
    throw new Error("Periode anggaran wajib dalam format YYYY-MM (contoh 2026-11).");
  }
  if (!Number.isFinite(input.limit_amount) || input.limit_amount <= 0) {
    throw new Error("Batas anggaran harus lebih besar dari Rp 0.");
  }
}
function validateWhatIfScenarioInput(input) {
  const title = (input.title ?? "").trim();
  if (title.length < 1 || title.length > 140) {
    throw new Error("Nama skenario What-If wajib diisi (1\u2013140 karakter).");
  }
  if (!VALID_WHATIF_TYPES.has(input.scenario_type)) {
    throw new Error("Jenis skenario simulasi What-If tidak valid.");
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Nominal simulasi tidak valid.");
  }
  if (!Number.isInteger(input.tenor_months) || input.tenor_months < 1 || input.tenor_months > 360) {
    throw new Error("Tenor simulasi harus antara 1 hingga 360 bulan.");
  }
  if (!Number.isFinite(input.annual_interest_pct) || input.annual_interest_pct < 0 || input.annual_interest_pct > 200) {
    throw new Error("Bunga tahunan simulasi harus antara 0% hingga 200%.");
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
    debt_payment_logs: [],
    owner_commands: [],
    recurring_bills: [],
    savings_goals: [],
    financial_reminders: [],
    financial_reminder_logs: [],
    category_budgets: [],
    budget_alert_logs: [],
    whatif_scenarios: [],
    financial_health_scores: []
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
var DATA_DIR = path3.resolve(process.cwd(), "data");
var VAULT_FILE = path3.join(DATA_DIR, "ego-vault.json");
var VAULT_MUTATION_LOCK = path3.join(DATA_DIR, "ego-vault-mutation.lock");
function withVaultMutationLock(operation) {
  return withFileLock(VAULT_MUTATION_LOCK, operation);
}
var VAULT_COLLECTIONS = [
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
  "financial_health_scores"
];
var VaultReadError = class extends Error {
  constructor(message = "Brankas EGO tidak dapat dibaca. Data tidak diubah; pulihkan file cadangan atau periksa file brankas.") {
    super(message);
    this.name = "VaultReadError";
  }
};
function parseVaultContent(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new VaultReadError("File brankas EGO rusak atau bukan JSON yang valid. Data tidak diubah.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new VaultReadError("Struktur file brankas EGO tidak valid. Data tidak diubah.");
  }
  const candidate = parsed;
  if (candidate.owner !== void 0 && candidate.owner !== null && (typeof candidate.owner !== "object" || Array.isArray(candidate.owner))) {
    throw new VaultReadError("Data Owner di dalam brankas tidak valid. Data tidak diubah.");
  }
  if (candidate.preferences !== void 0 && (!candidate.preferences || typeof candidate.preferences !== "object" || Array.isArray(candidate.preferences))) {
    throw new VaultReadError("Pengaturan brankas EGO tidak valid. Data tidak diubah.");
  }
  for (const key of VAULT_COLLECTIONS) {
    if (candidate[key] !== void 0 && !Array.isArray(candidate[key])) {
      throw new VaultReadError(`Bagian ${key} di dalam brankas tidak valid. Data tidak diubah.`);
    }
  }
  const empty = createEmptyVault();
  return {
    ...empty,
    ...candidate,
    preferences: {
      ...empty.preferences,
      ...candidate.preferences ?? {}
    }
  };
}
function loadVault() {
  if (!fs3.existsSync(VAULT_FILE)) {
    return createEmptyVault();
  }
  try {
    return parseVaultContent(fs3.readFileSync(VAULT_FILE, "utf8"));
  } catch (error) {
    if (error instanceof VaultReadError) throw error;
    throw new VaultReadError();
  }
}
function writePrivateJsonFile(filePath, value) {
  if (!fs3.existsSync(DATA_DIR)) {
    fs3.mkdirSync(DATA_DIR, { recursive: true, mode: 448 });
  }
  const tmpFile = `${filePath}.${process.pid}.${crypto2.randomUUID()}.tmp`;
  try {
    fs3.writeFileSync(tmpFile, JSON.stringify(value, null, 2), {
      encoding: "utf8",
      mode: 384,
      flag: "wx"
    });
    fs3.renameSync(tmpFile, filePath);
  } catch (error) {
    try {
      fs3.rmSync(tmpFile, { force: true });
    } catch {
    }
    throw error;
  }
}
function saveVault(db) {
  writePrivateJsonFile(VAULT_FILE, db);
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
var SESSIONS_FILE = path3.join(DATA_DIR, "ego-sessions.json");
function parseSessionsContent(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("File sesi EGO rusak. Login ditahan demi keamanan; file tidak dikosongkan.");
  }
  if (!Array.isArray(parsed) || parsed.some(
    (item) => !item || typeof item !== "object" || typeof item.owner_id !== "string" || typeof item.created_at !== "string" || typeof item.token !== "string" && typeof item.token_hash !== "string"
  )) {
    throw new Error("Struktur file sesi EGO tidak valid. Login ditahan demi keamanan.");
  }
  return parsed;
}
function loadSessions() {
  if (!fs3.existsSync(SESSIONS_FILE)) return [];
  try {
    return parseSessionsContent(fs3.readFileSync(SESSIONS_FILE, "utf8"));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("File sesi EGO")) throw error;
    if (error instanceof Error && error.message.startsWith("Struktur file sesi EGO")) throw error;
    throw new Error("File sesi EGO tidak dapat dibaca. Login ditahan demi keamanan; file tidak dikosongkan.");
  }
}
function saveSessions(sessions) {
  writePrivateJsonFile(SESSIONS_FILE, sessions);
}
function hashSessionToken(token) {
  return crypto2.createHash("sha256").update(token, "utf8").digest("hex");
}
function matchesSessionToken(session, token) {
  if (session.token_hash) {
    const stored2 = Buffer.from(session.token_hash, "hex");
    const candidate2 = Buffer.from(hashSessionToken(token), "hex");
    return stored2.length === candidate2.length && crypto2.timingSafeEqual(stored2, candidate2);
  }
  if (!session.token) return false;
  const stored = Buffer.from(session.token, "utf8");
  const candidate = Buffer.from(token, "utf8");
  return stored.length === candidate.length && crypto2.timingSafeEqual(stored, candidate);
}
function upgradeLegacySession(session) {
  if (!session.token || session.token_hash) return session;
  return { owner_id: session.owner_id, created_at: session.created_at, token_hash: hashSessionToken(session.token) };
}
function createSession(ownerId) {
  const token = crypto2.randomBytes(32).toString("hex");
  const sessions = loadSessions();
  const otherOwners = sessions.filter((session) => session.owner_id !== ownerId);
  const ownerSessions = sessions.filter((session) => session.owner_id === ownerId).slice(-4);
  ownerSessions.push({
    token_hash: hashSessionToken(token),
    owner_id: ownerId,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  saveSessions([...otherOwners, ...ownerSessions].map(upgradeLegacySession));
  return token;
}
function validateSessionToken(token) {
  if (!token) return null;
  const sessions = loadSessions();
  const found = sessions.find((session) => matchesSessionToken(session, token));
  if (!found) return null;
  if (found.token && !found.token_hash) {
    saveSessions(sessions.map((session) => session === found ? upgradeLegacySession(session) : session));
  }
  return found.owner_id;
}
function revokeSessionToken(token) {
  if (!token) return;
  const sessions = loadSessions().filter((session) => !matchesSessionToken(session, token));
  saveSessions(sessions.map(upgradeLegacySession));
}
function rotateSessionsForOwner(ownerId, keepToken) {
  const sessions = loadSessions().filter(
    (session) => session.owner_id !== ownerId || keepToken !== void 0 && matchesSessionToken(session, keepToken)
  );
  saveSessions(sessions.map(upgradeLegacySession));
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
async function runFinancialAdvisor(question, contextBrief, missingIndicators = []) {
  const cleanQuestion = question.trim().slice(0, 600);
  if (!cleanQuestion) {
    throw new Error("Pertanyaan konsultasi keuangan wajib diisi.");
  }
  const cleanBrief = contextBrief.trim().slice(0, 12e3);
  if (!cleanBrief) {
    throw new Error("Ringkasan konteks keuangan Owner belum tersedia.");
  }
  const ai = getAIClient();
  let usedModel = "gemini-4-hydrogen";
  const response = await withGeminiRetryAndFallback(
    ["gemini-4-hydrogen", "gemini-3.1-flash-lite"],
    (model) => {
      usedModel = model;
      return ai.models.generateContent({
        model,
        contents: `PERTANYAAN OWNER:
${cleanQuestion}

KONTEKS BRANKAS OWNER (TERSTRUKTUR):
${cleanBrief}`,
        config: {
          systemInstruction: "Anda adalah EGO AI Core, Penasihat Keuangan Pribadi (CFO Pribadi) untuk satu Owner tunggal dalam bahasa Indonesia formal, presisi, dan objektif. ATURAN KETAT: (1) Anda wajib memisahkan secara tegas antara Data Aktual terverifikasi, Data Estimasi proyeksi, Hasil Simulasi, dan Rekomendasi AI pada field JSON masing-masing. (2) JANGAN PERNAH mengarang, menebak, atau menginterpolasi angka yang tidak tertulis pada konteks. Jika sebuah metrik bertuliskan belum tersedia/kosong, nyatakan kekurangannya secara eksplisit pada peringatan_data. (3) Tegaskan bahwa perubahan saldo atau transaksi aktual hanya boleh terjadi setelah persetujuan eksplisit Owner.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ringkasan: {
                type: Type.STRING,
                description: "Ringkasan eksekutif 1-3 kalimat menjawab langsung pertanyaan Owner secara akurat."
              },
              data_aktual: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Poin-poin angka dan fakta terverifikasi dari data aktual (saldo, utang, anggaran, skor kesehatan)."
              },
              data_estimasi: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Poin proyeksi cashflow 30/90 hari, risiko defisit, dan asumsi estimasi variabel."
              },
              hasil_simulasi: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Temuan dari simulasi strategi utang, target tabungan, atau skenario What-If yang relevan."
              },
              rekomendasi_ai: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Langkah tindakan konkret dan terukur yang disarankan untuk Owner tanpa mutasi otomatis."
              },
              peringatan_data: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Daftar keterbatasan atau data yang belum lengkap agar Owner memahami konteks keputusan."
              }
            },
            required: [
              "ringkasan",
              "data_aktual",
              "data_estimasi",
              "hasil_simulasi",
              "rekomendasi_ai",
              "peringatan_data"
            ]
          }
        }
      });
    }
  );
  const rawJson = response.text?.trim();
  if (!rawJson) {
    throw new Error("EGO AI Core tidak mengembalikan analisis terstruktur.");
  }
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("Format respons EGO AI Core tidak valid.");
  }
  const normalizeList = (arr) => Array.isArray(arr) ? arr.map((item) => typeof item === "string" ? item.trim() : "").filter((item) => item.length > 0) : [];
  return {
    question: cleanQuestion,
    ringkasan: typeof parsed.ringkasan === "string" && parsed.ringkasan.trim() ? parsed.ringkasan.trim() : "Analisis keuangan selesai disusun berdasarkan data brankas Anda.",
    data_aktual: normalizeList(parsed.data_aktual),
    data_estimasi: normalizeList(parsed.data_estimasi),
    hasil_simulasi: normalizeList(parsed.hasil_simulasi),
    rekomendasi_ai: normalizeList(parsed.rekomendasi_ai),
    peringatan_data: Array.from(
      /* @__PURE__ */ new Set([
        ...normalizeList(parsed.peringatan_data),
        ...missingIndicators.filter((m) => m.trim().length > 0)
      ])
    ),
    model_used: usedModel,
    generated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
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

// server/persistentRateLimiter.ts
import crypto3 from "node:crypto";
import fs4 from "node:fs";
import path4 from "node:path";
var DATA_DIR2 = path4.resolve(process.cwd(), "data");
function storageKey(namespace, key) {
  return crypto3.createHash("sha256").update(`${namespace}\0${key}`, "utf8").digest("hex");
}
function readStore(rateLimitFile) {
  let raw;
  try {
    raw = fs4.readFileSync(rateLimitFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw new Error("Penyimpanan pembatas percobaan tidak dapat dibaca. Login ditahan demi keamanan.");
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Penyimpanan pembatas percobaan rusak. Login ditahan demi keamanan.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Struktur pembatas percobaan tidak valid. Login ditahan demi keamanan.");
  }
  const store = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!/^[0-9a-f]{64}$/.test(key) || !value || typeof value !== "object" || !Number.isSafeInteger(value.count) || value.count < 1 || !Number.isFinite(value.windowStart)) {
      throw new Error("Data pembatas percobaan tidak valid. Login ditahan demi keamanan.");
    }
    store[key] = value;
  }
  return store;
}
function writeStore(rateLimitFile, store) {
  fs4.mkdirSync(path4.dirname(rateLimitFile), { recursive: true, mode: 448 });
  const tmp = `${rateLimitFile}.${process.pid}.${crypto3.randomUUID()}.tmp`;
  try {
    fs4.writeFileSync(tmp, JSON.stringify(store), { encoding: "utf8", mode: 384, flag: "wx" });
    fs4.renameSync(tmp, rateLimitFile);
  } catch (error) {
    fs4.rmSync(tmp, { force: true });
    throw error;
  }
}
function evaluate(entry, maxAttempts, windowMs, nowMs) {
  if (!entry || nowMs - entry.windowStart >= windowMs) {
    return { allowed: true, remainingAttempts: maxAttempts, retryAfterSeconds: 0 };
  }
  if (entry.count < maxAttempts) {
    return { allowed: true, remainingAttempts: maxAttempts - entry.count, retryAfterSeconds: 0 };
  }
  const retryAfterSeconds = Math.max(1, Math.ceil((entry.windowStart + windowMs - nowMs) / 1e3));
  const waitMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return {
    allowed: false,
    remainingAttempts: 0,
    retryAfterSeconds,
    message: `Terlalu banyak percobaan gagal. Demi keamanan brankas, silakan tunggu sekitar ${waitMinutes} menit sebelum mencoba lagi.`
  };
}
function createPersistentLoginRateLimiter(namespace, maxAttempts = 5, windowMs = 15 * 60 * 1e3, storageDir = DATA_DIR2) {
  const rateLimitFile = path4.join(storageDir, "ego-rate-limits.json");
  const rateLimitLock = path4.join(storageDir, "ego-rate-limits.lock");
  if (!/^[a-z-]{1,24}$/.test(namespace)) throw new Error("Namespace rate limit tidak valid.");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || !Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error("Konfigurasi rate limit tidak valid.");
  }
  return {
    check(key, nowMs = Date.now()) {
      const store = readStore(rateLimitFile);
      return evaluate(store[storageKey(namespace, key)], maxAttempts, windowMs, nowMs);
    },
    attempt(key, nowMs = Date.now()) {
      return withFileLock(rateLimitLock, () => {
        const store = readStore(rateLimitFile);
        for (const [hash2, entry] of Object.entries(store)) {
          if (nowMs - entry.windowStart >= windowMs) delete store[hash2];
        }
        const hash = storageKey(namespace, key);
        const existing = store[hash];
        if (existing && existing.count >= maxAttempts) {
          return evaluate(existing, maxAttempts, windowMs, nowMs);
        }
        const next = existing ? { count: existing.count + 1, windowStart: existing.windowStart } : { count: 1, windowStart: nowMs };
        store[hash] = next;
        writeStore(rateLimitFile, store);
        return {
          allowed: true,
          remainingAttempts: Math.max(0, maxAttempts - next.count),
          retryAfterSeconds: 0
        };
      });
    },
    recordFailure(key, nowMs = Date.now()) {
      return withFileLock(rateLimitLock, () => {
        const store = readStore(rateLimitFile);
        for (const [hash2, entry] of Object.entries(store)) {
          if (nowMs - entry.windowStart >= windowMs) delete store[hash2];
        }
        const hash = storageKey(namespace, key);
        const existing = store[hash];
        store[hash] = existing ? { count: existing.count + 1, windowStart: existing.windowStart } : { count: 1, windowStart: nowMs };
        writeStore(rateLimitFile, store);
        return evaluate(store[hash], maxAttempts, windowMs, nowMs);
      });
    },
    reset(key) {
      withFileLock(rateLimitLock, () => {
        const store = readStore(rateLimitFile);
        delete store[storageKey(namespace, key)];
        writeStore(rateLimitFile, store);
      });
    }
  };
}

// server.ts
var PORT = process.env.NODE_ENV === "production" ? Number(process.env.PORT) || 3e3 : 3e3;
var loginRateLimiter = createPersistentLoginRateLimiter("login", 5, 15 * 60 * 1e3);
var passwordRateLimiter = createPersistentLoginRateLimiter("password", 5, 15 * 60 * 1e3);
var pinRateLimiter = createPersistentLoginRateLimiter("pin", 5, 15 * 60 * 1e3);
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
  app.get("/api/auth/status", async (req, res) => {
    const token = extractToken(req);
    if (isServerSupabaseConfigured()) {
      const client = token ? createAuthedSupabaseClient(token) : null;
      if (!client || !token) {
        res.json({
          hasOwner: null,
          authenticated: false,
          hasPin: false,
          owner: null,
          mode: "supabase"
        });
        return;
      }
      try {
        const { data, error } = await client.auth.getUser(token);
        const user = !error ? data.user : null;
        res.json({
          // Whether an Owner exists globally cannot be determined safely
          // from the public client without a dedicated server-side RPC.
          hasOwner: user ? true : null,
          authenticated: Boolean(user),
          hasPin: Boolean(user?.user_metadata?.ego_pin_hash),
          owner: user ? {
            id: user.id,
            email: user.email ?? null,
            full_name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "Owner Utama",
            created_at: user.created_at
          } : null,
          mode: "supabase"
        });
      } catch {
        res.json({
          hasOwner: null,
          authenticated: false,
          hasPin: false,
          owner: null,
          mode: "supabase"
        });
      }
      return;
    }
    const db = loadVault();
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
      } : null,
      mode: "local"
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
      const ownerId = crypto4.randomUUID();
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
    const rateCheck = loginRateLimiter.attempt(clientKey);
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
      res.status(401).json({
        error: `Email atau kata sandi Owner tidak sesuai. Sisa percobaan: ${rateCheck.remainingAttempts}.`,
        remainingAttempts: rateCheck.remainingAttempts,
        retryAfterSeconds: 0
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
      const rateCheck = passwordRateLimiter.attempt(clientKey);
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
        res.status(401).json({
          error: `Kata sandi saat ini tidak sesuai. Sisa percobaan: ${rateCheck.remainingAttempts}.`,
          remainingAttempts: rateCheck.remainingAttempts,
          retryAfterSeconds: 0
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
      const rateCheck = passwordRateLimiter.attempt(clientKey);
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
        res.status(401).json({
          error: `Kata sandi Owner tidak sesuai. Sisa percobaan: ${rateCheck.remainingAttempts}.`,
          remainingAttempts: rateCheck.remainingAttempts,
          retryAfterSeconds: 0
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
      const rateCheck = passwordRateLimiter.attempt(clientKey);
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
        res.status(401).json({
          error: `Kata sandi saat ini tidak sesuai. Sisa percobaan: ${rateCheck.remainingAttempts}.`,
          remainingAttempts: rateCheck.remainingAttempts,
          retryAfterSeconds: 0
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
      const rateCheck = passwordRateLimiter.attempt(clientKey);
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
        res.status(401).json({
          error: `Kata sandi Owner tidak sesuai. Sisa percobaan: ${rateCheck.remainingAttempts}.`,
          remainingAttempts: rateCheck.remainingAttempts,
          retryAfterSeconds: 0
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
      const rateCheck = pinRateLimiter.attempt(clientKey);
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
        res.status(401).json({
          error: `PIN 6 digit tidak sesuai. Sisa percobaan: ${rateCheck.remainingAttempts}.`,
          remainingAttempts: rateCheck.remainingAttempts,
          retryAfterSeconds: 0
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
      const rateCheck = passwordRateLimiter.attempt(clientKey);
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
        res.status(401).json({
          error: `Kata sandi Owner tidak sesuai. Sisa percobaan: ${rateCheck.remainingAttempts}.`,
          remainingAttempts: rateCheck.remainingAttempts,
          retryAfterSeconds: 0
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
      debts: [...db.debts].map(normalizeDebt).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      debt_payment_logs: [...db.debt_payment_logs ?? []].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 200),
      owner_commands: [...db.owner_commands].sort(
        (a, b) => b.created_at.localeCompare(a.created_at)
      ),
      recurring_bills: [...db.recurring_bills ?? []].sort(
        (a, b) => a.next_due_date.localeCompare(b.next_due_date)
      ),
      savings_goals: [...db.savings_goals ?? []].sort(
        (a, b) => b.created_at.localeCompare(a.created_at)
      ),
      financial_reminders: [...db.financial_reminders ?? []].sort(
        (a, b) => a.due_date.localeCompare(b.due_date)
      ),
      financial_reminder_logs: [...db.financial_reminder_logs ?? []].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 120),
      remindersTableReady: true,
      category_budgets: [...db.category_budgets ?? []].sort(
        (a, b) => a.period_month === b.period_month ? a.category.localeCompare(b.category, "id") : b.period_month.localeCompare(a.period_month)
      ),
      budget_alert_logs: [...db.budget_alert_logs ?? []].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 150),
      budgetsTableReady: true,
      whatif_scenarios: [...db.whatif_scenarios ?? []].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60),
      financial_health_scores: [...db.financial_health_scores ?? []].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60),
      ecosystemTablesReady: true,
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
        id: crypto4.randomUUID(),
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
      if (!ownerConfirmed) {
        throw new Error("Persetujuan eksplisit Owner wajib dicentang sebelum transaksi dicatat.");
      }
      const status = "posted";
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
      const requestId = req.body?.id;
      if (!isValidTransactionRequestId(requestId)) {
        throw new Error("ID permintaan transaksi wajib berupa UUID yang valid.");
      }
      const newTx = {
        id: requestId,
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
      const existing = db.transactions.find((tx) => tx.id === requestId);
      if (existing) {
        if (existing.owner_id !== ownerId) {
          throw new Error("ID transaksi tidak dapat digunakan.");
        }
        const isSameRequest = isSameConfirmedTransactionRequest(existing, newTx);
        if (!isSameRequest) {
          throw new Error(
            "ID transaksi sudah digunakan untuk data berbeda. Transaksi tidak diulang."
          );
        }
        res.status(200).json(existing);
        return;
      }
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
        id: crypto4.randomUUID(),
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
    withVaultMutationLock(() => {
      try {
        const ownerId = req.ownerId;
        const ownerConfirmed = req.body?.owner_confirmed === true;
        const creditor = String(req.body?.creditor ?? "").trim();
        const debtType = String(req.body?.debt_type ?? "lainnya");
        const originalAmount = Number(req.body?.original_amount ?? 0);
        const outstandingBalance = req.body?.outstanding_balance !== void 0 ? Number(req.body.outstanding_balance) : originalAmount;
        const interestRateAnnual = req.body?.interest_rate_annual !== void 0 ? Number(req.body.interest_rate_annual) : 0;
        const monthlyFee = req.body?.monthly_fee !== void 0 ? Number(req.body.monthly_fee) : 0;
        const installmentAmount = req.body?.installment_amount !== void 0 ? Number(req.body.installment_amount) : 0;
        const paymentFrequency = String(
          req.body?.payment_frequency ?? "monthly"
        );
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
          owner_confirmed: ownerConfirmed
        });
        const db = loadVault();
        const debt = {
          id: crypto4.randomUUID(),
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
  });
  app.patch("/api/debts/:id", requireOwner, (req, res) => {
    withVaultMutationLock(() => {
      try {
        const ownerId = req.ownerId;
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
        const creditor = req.body?.creditor !== void 0 ? String(req.body.creditor).trim() : current.creditor;
        const debtType = req.body?.debt_type !== void 0 ? String(req.body.debt_type) : current.debt_type;
        const interestRateAnnual = req.body?.interest_rate_annual !== void 0 ? Number(req.body.interest_rate_annual) : current.interest_rate_annual;
        const monthlyFee = req.body?.monthly_fee !== void 0 ? Number(req.body.monthly_fee) : current.monthly_fee;
        const installmentAmount = req.body?.installment_amount !== void 0 ? Number(req.body.installment_amount) : current.installment_amount;
        const paymentFrequency = req.body?.payment_frequency !== void 0 ? String(req.body.payment_frequency) : current.payment_frequency;
        const dueDate = req.body?.due_date !== void 0 ? req.body.due_date ? String(req.body.due_date).slice(0, 10) : null : current.due_date;
        const description = req.body?.description !== void 0 ? req.body.description ? String(req.body.description).trim() : null : current.description;
        validateDebtInput({
          creditor,
          debt_type: debtType,
          original_amount: current.original_amount,
          outstanding_balance: current.outstanding_balance,
          interest_rate_annual: interestRateAnnual,
          monthly_fee: monthlyFee,
          installment_amount: installmentAmount,
          payment_frequency: paymentFrequency,
          owner_confirmed: ownerConfirmed
        });
        const updated = {
          ...current,
          creditor,
          debt_type: debtType,
          interest_rate_annual: Math.max(0, Number(interestRateAnnual) || 0),
          monthly_fee: roundCurrency(monthlyFee),
          installment_amount: roundCurrency(installmentAmount),
          payment_frequency: paymentFrequency,
          due_date: dueDate,
          description
        };
        db.debts[idx] = updated;
        saveVault(db);
        res.json(updated);
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : "Gagal memperbarui data utang."
        });
      }
    });
  });
  app.post("/api/debts/:id/pay", requireOwner, (req, res) => {
    withVaultMutationLock(() => {
      try {
        const ownerId = req.ownerId;
        const db = loadVault();
        db.debt_payment_logs ??= [];
        const requestId = req.body?.request_id;
        if (!isValidTransactionRequestId(requestId)) {
          res.status(400).json({ error: "ID permintaan pembayaran wajib berupa UUID yang valid." });
          return;
        }
        const debt = db.debts.find((d) => d.id === req.params.id && d.owner_id === ownerId);
        if (!debt) {
          res.status(404).json({ error: "Data utang tidak ditemukan." });
          return;
        }
        const paymentAmount = roundCurrency(Number(req.body?.amount ?? 0));
        const sourceAccountId = String(req.body?.source_account_id ?? "");
        const ownerConfirmed = req.body?.owner_confirmed === true;
        const notes = req.body?.notes ? String(req.body.notes).trim() : null;
        if (!ownerConfirmed) {
          throw new Error("Persetujuan eksplisit Owner wajib dicentang.");
        }
        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
          throw new Error("Nominal pembayaran harus lebih dari Rp 0.");
        }
        const requestIdentity = {
          request_id: requestId,
          debt_id: req.params.id,
          amount: paymentAmount,
          source_account_id: sourceAccountId,
          notes
        };
        const existingLog = db.debt_payment_logs.find(
          (item) => item.owner_id === ownerId && item.request_id === requestId
        );
        if (existingLog) {
          const existingTx = db.transactions.find(
            (item) => item.id === existingLog.transaction_id && item.owner_id === ownerId
          );
          if (!isSameDebtPaymentRequest(existingLog, existingTx, requestIdentity)) {
            res.status(409).json({
              error: "ID pembayaran sudah digunakan untuk rincian berbeda. Pembayaran tidak diulang."
            });
            return;
          }
          res.json({ debt: normalizeDebt(debt), transaction: existingTx, log: existingLog, replayed: true });
          return;
        }
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
        const remaining = Math.max(0, newBalance);
        const nowIso = (/* @__PURE__ */ new Date()).toISOString();
        const tx = {
          id: crypto4.randomUUID(),
          owner_id: ownerId,
          transaction_type: "expense",
          source_account_id: sourceAccountId,
          destination_account_id: null,
          amount: paymentAmount,
          transaction_date: todayISO(),
          category: "Utang & Cicilan",
          description: `Pembayaran utang ke ${debt.creditor}`,
          status: "posted",
          owner_confirmed: true,
          created_at: nowIso
        };
        const log = {
          id: crypto4.randomUUID(),
          owner_id: ownerId,
          debt_id: debt.id,
          transaction_id: tx.id,
          request_id: requestId,
          amount: paymentAmount,
          principal_paid: paymentAmount,
          interest_paid: 0,
          remaining_after: remaining,
          notes,
          created_at: nowIso
        };
        debt.outstanding_balance = remaining;
        debt.status = remaining === 0 ? "paid" : "active";
        db.transactions.unshift(tx);
        db.debt_payment_logs.unshift(log);
        saveVault(db);
        res.json({ debt: normalizeDebt(debt), transaction: tx, log, replayed: false });
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : "Gagal memproses pembayaran utang."
        });
      }
    });
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
      id: crypto4.randomUUID(),
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
      if (req.body?.owner_confirmed !== true) {
        res.status(400).json({
          error: "Prinsip Brankas Mutlak: Persetujuan eksplisit Owner wajib dicentang sebelum mengeksekusi draf."
        });
        return;
      }
      if (cmd.status !== "pending" && cmd.status !== "processed") {
        res.status(400).json({ error: "Perintah ini sudah diproses sebelumnya." });
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
        id: cmd.id,
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
      const existingTx = db.transactions.find((item) => item.id === cmd.id);
      if (existingTx && !isSameConfirmedTransactionRequest(existingTx, tx)) {
        res.status(409).json({
          error: "ID transaksi sudah digunakan untuk data berbeda. Transaksi tidak diulang."
        });
        return;
      }
      if (cmd.status === "processed") {
        if (!existingTx) {
          res.status(409).json({
            error: "Perintah sudah diproses, tetapi transaksi tidak ditemukan untuk diverifikasi."
          });
          return;
        }
        res.json({ command: cmd, transaction: existingTx });
        return;
      }
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
      if (!existingTx) {
        db.transactions.unshift(tx);
      }
      saveVault(db);
      res.json({ command: cmd, transaction: existingTx ?? tx });
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
  app.post("/api/ai/advisor", requireOwner, async (req, res) => {
    try {
      const question = String(req.body?.question ?? "").trim();
      const contextBrief = String(req.body?.contextBrief ?? "").trim();
      const missingIndicators = Array.isArray(req.body?.missingIndicators) ? req.body.missingIndicators.map((x) => String(x)) : [];
      if (!question || question.length > 600) {
        res.status(400).json({
          error: "Pertanyaan konsultasi wajib diisi (maks 600 karakter)."
        });
        return;
      }
      if (!contextBrief) {
        res.status(400).json({
          error: "Konteks finansial terverifikasi belum tersedia untuk dianalisis."
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
        id: crypto4.randomUUID(),
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
      id: crypto4.randomUUID(),
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
        id: crypto4.randomUUID(),
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
  app.post("/api/reminders", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
      const title = String(req.body?.title ?? "").trim();
      const reminderType = String(req.body?.reminder_type ?? "tagihan_bulanan");
      const transactionType = String(req.body?.transaction_type ?? "expense");
      const amount = Number(req.body?.amount ?? 0);
      const dueDate = String(req.body?.due_date ?? todayISO()).slice(0, 10);
      const reminderTime = String(req.body?.reminder_time ?? "08:00").slice(0, 5);
      const frequency = String(req.body?.frequency ?? "monthly");
      const rawOffsets = Array.isArray(req.body?.remind_offsets) ? req.body.remind_offsets.map((n) => Number(n)) : [7, 3, 1, 0];
      const customDaysBefore = req.body?.custom_days_before !== void 0 && req.body?.custom_days_before !== null && req.body?.custom_days_before !== "" ? Number(req.body.custom_days_before) : null;
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
        owner_confirmed: ownerConfirmed
      });
      const db = loadVault();
      db.financial_reminders ??= [];
      db.financial_reminder_logs ??= [];
      const dedupeKey = req.body?.dedupe_key ? String(req.body.dedupe_key).trim() : null;
      if (dedupeKey && db.financial_reminders.some(
        (r) => r.owner_id === ownerId && r.dedupe_key === dedupeKey
      )) {
        res.status(409).json({
          error: "Pengingat untuk jadwal atau sumber yang sama sudah terdaftar."
        });
        return;
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const reminder = {
        id: crypto4.randomUUID(),
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
        updated_at: nowIso
      };
      db.financial_reminders.push(reminder);
      saveVault(db);
      res.status(201).json(reminder);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menyimpan pengingat keuangan."
      });
    }
  });
  app.patch("/api/reminders/:id", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
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
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const logsToAdd = [];
      if (req.body?.title !== void 0 || req.body?.due_date !== void 0 || req.body?.reminder_time !== void 0 || req.body?.amount !== void 0 || req.body?.remind_offsets !== void 0 || req.body?.frequency !== void 0 || req.body?.reminder_type !== void 0) {
        const nextTitle = req.body?.title !== void 0 ? String(req.body.title).trim() : reminder.title;
        const nextType = req.body?.reminder_type ?? reminder.reminder_type;
        const nextTxType = req.body?.transaction_type ?? reminder.transaction_type;
        const nextAmount = req.body?.amount !== void 0 ? Number(req.body.amount) : reminder.amount;
        const nextDue = req.body?.due_date !== void 0 ? String(req.body.due_date).slice(0, 10) : reminder.due_date;
        const nextTime = req.body?.reminder_time !== void 0 ? String(req.body.reminder_time).slice(0, 5) : reminder.reminder_time;
        const nextFreq = req.body?.frequency ?? reminder.frequency;
        const nextOffsets = Array.isArray(req.body?.remind_offsets) ? req.body.remind_offsets.map((n) => Number(n)) : reminder.remind_offsets;
        const nextCustom = req.body?.custom_days_before !== void 0 ? req.body.custom_days_before === null || req.body.custom_days_before === "" ? null : Number(req.body.custom_days_before) : reminder.custom_days_before;
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
          owner_confirmed: true
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
        if (req.body?.linked_account_id !== void 0) {
          reminder.linked_account_id = req.body.linked_account_id ? String(req.body.linked_account_id) : null;
        }
        if (req.body?.notes !== void 0) {
          reminder.notes = req.body.notes ? String(req.body.notes).trim() : null;
        }
        if (dueChanged) {
          reminder.last_notified_key = null;
          reminder.is_read = false;
          reminder.read_at = null;
          logsToAdd.push({
            id: crypto4.randomUUID(),
            owner_id: ownerId,
            reminder_id: reminder.id,
            reminder_title: reminder.title,
            event_type: "rescheduled",
            trigger_offset: null,
            scheduled_for: reminder.due_date,
            notes: `Dijadwalkan ulang ke ${reminder.due_date}`,
            created_at: nowIso
          });
        }
      }
      if (typeof req.body?.is_active === "boolean" && req.body.is_active !== reminder.is_active) {
        reminder.is_active = req.body.is_active;
        logsToAdd.push({
          id: crypto4.randomUUID(),
          owner_id: ownerId,
          reminder_id: reminder.id,
          reminder_title: reminder.title,
          event_type: reminder.is_active ? "resumed" : "paused",
          trigger_offset: null,
          scheduled_for: reminder.due_date,
          notes: reminder.is_active ? "Pengingat diaktifkan kembali" : "Pengingat dinonaktifkan",
          created_at: nowIso
        });
      }
      if (typeof req.body?.is_read === "boolean" && req.body.is_read !== reminder.is_read) {
        reminder.is_read = req.body.is_read;
        reminder.read_at = reminder.is_read ? nowIso : null;
        if (reminder.is_read) {
          logsToAdd.push({
            id: crypto4.randomUUID(),
            owner_id: ownerId,
            reminder_id: reminder.id,
            reminder_title: reminder.title,
            event_type: "read",
            trigger_offset: null,
            scheduled_for: reminder.due_date,
            notes: "Ditandai sudah dibaca oleh Owner",
            created_at: nowIso
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
        error: err instanceof Error ? err.message : "Gagal memperbarui pengingat."
      });
    }
  });
  app.post("/api/reminders/mark-all-read", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
    const db = loadVault();
    db.financial_reminders ??= [];
    db.financial_reminder_logs ??= [];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
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
        id: crypto4.randomUUID(),
        owner_id: ownerId,
        reminder_id: null,
        reminder_title: `${updated} pengingat aktif`,
        event_type: "read",
        trigger_offset: null,
        scheduled_for: todayISO(),
        notes: "Semua pengingat aktif ditandai sudah dibaca",
        created_at: nowIso
      });
      saveVault(db);
    }
    res.json({ ok: true, updated });
  });
  app.post("/api/reminders/:id/log-trigger", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
    const notificationKey = String(req.body?.notification_key ?? "").trim();
    const triggerOffset = typeof req.body?.trigger_offset === "number" ? req.body.trigger_offset : null;
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
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    reminder.last_notified_key = notificationKey;
    reminder.last_notified_at = nowIso;
    reminder.updated_at = nowIso;
    db.financial_reminder_logs.unshift({
      id: crypto4.randomUUID(),
      owner_id: ownerId,
      reminder_id: reminder.id,
      reminder_title: reminder.title,
      event_type: "triggered",
      trigger_offset: triggerOffset,
      scheduled_for: reminder.due_date,
      notes: triggerOffset === -1 ? `Pengingat keterlambatan ditampilkan (${reminder.due_date})` : `Pengingat H-${triggerOffset ?? 0} ditampilkan pada ${reminder.reminder_time}`,
      created_at: nowIso
    });
    saveVault(db);
    res.json({ reminder, deduped: false });
  });
  app.post("/api/reminders/:id/queue-draft", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
    if (req.body?.owner_confirmed !== true) {
      res.status(400).json({
        error: "Persetujuan eksplisit Owner wajib dicentang sebelum mengirim draf ke antrean transaksi."
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
    const validAccountId = reminder.linked_account_id && db.accounts.some((a) => a.id === reminder.linked_account_id && a.owner_id === ownerId) ? reminder.linked_account_id : null;
    const warnings = [];
    if (reminder.transaction_type === "transfer") {
      warnings.push("Pilih akun sumber dan akun tujuan transfer sebelum menyetujui.");
    } else if (!validAccountId) {
      warnings.push(
        reminder.transaction_type === "income" ? "Pilih akun tujuan pemasukan sebelum menyetujui." : "Pilih akun sumber dana sebelum menyetujui."
      );
    }
    const draft = {
      transaction_type: reminder.transaction_type,
      amount: reminder.amount > 0 ? reminder.amount : null,
      category: reminder.reminder_type === "cicilan_utang" ? "Utang & Cicilan" : reminder.reminder_type === "tanggal_gajian" || reminder.reminder_type === "pemasukan_rutin" ? "Gaji & Pendapatan" : reminder.reminder_type === "setoran_tabungan" || reminder.reminder_type === "target_keuangan" ? "Transfer Internal" : "Utilitas & Tagihan",
      description: `${reminder.title} (Pengingat ${reminder.due_date})`,
      source_account_id: reminder.transaction_type === "expense" ? validAccountId : null,
      destination_account_id: reminder.transaction_type === "income" || reminder.transaction_type === "transfer" ? validAccountId : null,
      source_hint: null,
      destination_hint: null,
      transaction_date: todayISO(),
      confidence: validAccountId && reminder.amount > 0 ? "high" : "medium",
      warnings
    };
    const cmd = {
      id: crypto4.randomUUID(),
      owner_id: ownerId,
      command_text: `[Pengingat] ${reminder.title} \xB7 Rp ${reminder.amount.toLocaleString("id-ID")} (Jatuh tempo ${reminder.due_date})`,
      status: "pending",
      parsed_draft: draft,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.owner_commands.unshift(cmd);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    reminder.is_read = true;
    reminder.read_at = nowIso;
    if (reminder.frequency !== "once" && req.body?.advance_cycle !== false) {
      reminder.due_date = advanceReminderDueDate(reminder.due_date, reminder.frequency);
      reminder.last_notified_key = null;
    }
    reminder.updated_at = nowIso;
    db.financial_reminder_logs.unshift({
      id: crypto4.randomUUID(),
      owner_id: ownerId,
      reminder_id: reminder.id,
      reminder_title: reminder.title,
      event_type: "draft_queued",
      trigger_offset: null,
      scheduled_for: reminder.due_date,
      notes: "Draf dikirim ke Owner Control; saldo menunggu konfirmasi Owner.",
      created_at: nowIso
    });
    saveVault(db);
    res.status(201).json({ command: cmd, reminder });
  });
  app.post("/api/reminders/sync-sources", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
    const db = loadVault();
    db.financial_reminders ??= [];
    const payloads = buildSourceSyncReminders(
      db.recurring_bills ?? [],
      db.debts ?? [],
      db.financial_reminders,
      ownerId
    );
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const created = payloads.map((p) => ({
      ...p,
      id: crypto4.randomUUID(),
      created_at: nowIso,
      updated_at: nowIso
    }));
    if (created.length > 0) {
      db.financial_reminders.push(...created);
      saveVault(db);
    }
    res.json({ createdCount: created.length, created });
  });
  app.delete("/api/reminders/:id", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
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
  app.post("/api/budgets", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
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
        owner_confirmed: ownerConfirmed
      });
      const db = loadVault();
      db.category_budgets ??= [];
      db.budget_alert_logs ??= [];
      const catKey = normalizeBudgetCategoryKey(category);
      const duplicate = db.category_budgets.some(
        (b) => b.owner_id === ownerId && b.period_month === periodMonth && normalizeBudgetCategoryKey(b.category) === catKey
      );
      if (duplicate) {
        res.status(409).json({
          error: `Anggaran kategori "${category}" untuk periode ${periodMonth} sudah tersedia.`
        });
        return;
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const created = {
        id: crypto4.randomUUID(),
        owner_id: ownerId,
        category,
        period_month: periodMonth,
        limit_amount: limitAmount,
        is_active: isActive,
        last_alert_threshold: null,
        last_alert_period: null,
        notes,
        created_at: nowIso,
        updated_at: nowIso
      };
      db.category_budgets.push(created);
      const { byCategoryKey } = computeConfirmedExpensesByCategoryForMonth(
        db.transactions,
        periodMonth
      );
      const spent = byCategoryKey.get(catKey)?.total ?? 0;
      const cls = classifyBudgetThreshold(spent, limitAmount);
      db.budget_alert_logs.unshift({
        id: crypto4.randomUUID(),
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
        created_at: nowIso
      });
      saveVault(db);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal membuat anggaran kategori."
      });
    }
  });
  app.patch("/api/budgets/:id", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
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
      const hasEditField = req.body?.category !== void 0 || req.body?.period_month !== void 0 || req.body?.limit_amount !== void 0 || req.body?.notes !== void 0;
      const nextCategory = req.body?.category !== void 0 ? String(req.body.category ?? "").trim() : budget.category;
      const nextPeriod = req.body?.period_month !== void 0 ? String(req.body.period_month ?? "").trim() : budget.period_month;
      const nextLimit = req.body?.limit_amount !== void 0 ? roundCurrency(Number(req.body.limit_amount ?? 0)) : budget.limit_amount;
      const nextNotes = req.body?.notes !== void 0 ? req.body.notes ? String(req.body.notes).trim().slice(0, 240) : null : budget.notes;
      if (hasEditField) {
        validateCategoryBudgetInput({
          category: nextCategory,
          period_month: nextPeriod,
          limit_amount: nextLimit,
          owner_confirmed: req.body?.owner_confirmed === true
        });
        const catKey = normalizeBudgetCategoryKey(nextCategory);
        const duplicate = db.category_budgets.some(
          (b) => b.id !== budget.id && b.owner_id === ownerId && b.period_month === nextPeriod && normalizeBudgetCategoryKey(b.category) === catKey
        );
        if (duplicate) {
          res.status(409).json({
            error: `Anggaran kategori "${nextCategory}" untuk periode ${nextPeriod} sudah tersedia.`
          });
          return;
        }
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
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
          id: crypto4.randomUUID(),
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
          created_at: nowIso
        });
      }
      if (typeof req.body?.is_active === "boolean" && req.body.is_active !== budget.is_active) {
        budget.is_active = req.body.is_active;
        db.budget_alert_logs.unshift({
          id: crypto4.randomUUID(),
          owner_id: ownerId,
          budget_id: budget.id,
          category: budget.category,
          period_month: budget.period_month,
          threshold_level: 0,
          spent_amount: spent,
          limit_amount: budget.limit_amount,
          usage_pct: cls.usagePct,
          event_type: budget.is_active ? "resumed" : "paused",
          notes: budget.is_active ? "Pemantauan anggaran diaktifkan kembali" : "Pemantauan anggaran dinonaktifkan sementara",
          created_at: nowIso
        });
      }
      budget.updated_at = nowIso;
      saveVault(db);
      res.json(budget);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal memperbarui anggaran."
      });
    }
  });
  app.post("/api/budgets/:id/log-alert", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
    const periodMonth = String(req.body?.period_month ?? "").trim();
    const thresholdLevel = Number(req.body?.threshold_level ?? 0);
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
    if (isThresholdAlreadyNotified(
      budget,
      periodMonth,
      thresholdLevel,
      db.budget_alert_logs
    )) {
      res.json({ budget, deduped: true });
      return;
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    budget.last_alert_threshold = thresholdLevel;
    budget.last_alert_period = periodMonth;
    budget.updated_at = nowIso;
    const logEntry = {
      id: crypto4.randomUUID(),
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
      created_at: nowIso
    };
    db.budget_alert_logs.unshift(logEntry);
    saveVault(db);
    res.json({ budget, log: logEntry, deduped: false });
  });
  app.post("/api/budgets/copy-month", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
    if (req.body?.owner_confirmed !== true) {
      res.status(400).json({
        error: "Konfirmasi Owner diperlukan untuk menyalin anggaran bulan sebelumnya."
      });
      return;
    }
    const fromMonth = String(req.body?.from_month ?? "").trim();
    const toMonth = String(req.body?.to_month ?? "").trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(fromMonth) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(toMonth) || fromMonth === toMonth) {
      res.status(400).json({ error: "Periode asal dan tujuan tidak valid." });
      return;
    }
    const db = loadVault();
    db.category_budgets ??= [];
    db.budget_alert_logs ??= [];
    const existingKeys = new Set(
      db.category_budgets.filter((b) => b.owner_id === ownerId && b.period_month === toMonth).map((b) => normalizeBudgetCategoryKey(b.category))
    );
    const sources = db.category_budgets.filter(
      (b) => b.owner_id === ownerId && b.period_month === fromMonth && b.is_active && !existingKeys.has(normalizeBudgetCategoryKey(b.category))
    );
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const created = [];
    for (const src of sources) {
      const next = {
        id: crypto4.randomUUID(),
        owner_id: ownerId,
        category: src.category,
        period_month: toMonth,
        limit_amount: src.limit_amount,
        is_active: true,
        last_alert_threshold: null,
        last_alert_period: null,
        notes: src.notes,
        created_at: nowIso,
        updated_at: nowIso
      };
      created.push(next);
      db.category_budgets.push(next);
      db.budget_alert_logs.unshift({
        id: crypto4.randomUUID(),
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
        created_at: nowIso
      });
    }
    if (created.length > 0) {
      saveVault(db);
    }
    res.json({ copiedCount: created.length, created });
  });
  app.delete("/api/budgets/:id", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
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
  app.post("/api/whatif-scenarios", requireOwner, (req, res) => {
    try {
      const ownerId = req.ownerId;
      const params = req.body?.params;
      const resultSummary = req.body?.result_summary;
      if (!params || !resultSummary) {
        res.status(400).json({ error: "Payload simulasi What-If tidak lengkap." });
        return;
      }
      validateWhatIfScenarioInput({
        title: String(params.title ?? ""),
        scenario_type: String(params.scenario_type ?? ""),
        amount: Number(params.amount ?? 0),
        tenor_months: Number(params.tenor_months ?? 1),
        annual_interest_pct: Number(params.annual_interest_pct ?? 0)
      });
      const db = loadVault();
      db.whatif_scenarios ??= [];
      const record = {
        id: crypto4.randomUUID(),
        owner_id: ownerId,
        title: params.title.trim(),
        scenario_type: params.scenario_type,
        params,
        result_summary: resultSummary,
        risk_level: resultSummary.riskLevel,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.whatif_scenarios.unshift(record);
      saveVault(db);
      res.status(201).json(record);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menyimpan skenario What-If."
      });
    }
  });
  app.delete("/api/whatif-scenarios/:id", requireOwner, (req, res) => {
    const ownerId = req.ownerId;
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
      const ownerId = req.ownerId;
      const totalScore = req.body?.total_score === null || req.body?.total_score === void 0 ? null : Number(req.body.total_score);
      const grade = String(req.body?.grade ?? "Belum Cukup Data");
      const periodMonth = String(req.body?.period_month ?? todayISO().slice(0, 7)).slice(0, 7);
      const availableWeightRaw = Number(req.body?.available_weight ?? 0);
      const snapshot = {
        id: crypto4.randomUUID(),
        owner_id: ownerId,
        period_month: /^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth) ? periodMonth : todayISO().slice(0, 7),
        total_score: totalScore !== null && Number.isFinite(totalScore) ? Math.max(0, Math.min(100, Math.round(totalScore))) : null,
        grade,
        available_weight: Number.isFinite(availableWeightRaw) ? Math.max(0, Math.min(100, Math.round(availableWeightRaw))) : 0,
        is_data_incomplete: req.body?.is_data_incomplete === true,
        components: Array.isArray(req.body?.components) ? req.body.components : [],
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const db = loadVault();
      db.financial_health_scores ??= [];
      db.financial_health_scores.unshift(snapshot);
      saveVault(db);
      res.status(201).json(snapshot);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Gagal menyimpan snapshot Health Score."
      });
    }
  });
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const distDir = path5.resolve(process.cwd(), "dist");
  const isProd = process.env.NODE_ENV === "production" && fs5.existsSync(distDir);
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
      res.sendFile(path5.join(distDir, "index.html"));
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
