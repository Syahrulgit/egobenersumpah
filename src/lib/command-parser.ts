import type { Account, ParsedCommandDraft, TransactionType } from "../types/ego";
import { todayISO } from "./finance";

const INCOME_KEYWORDS = [
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
  "honor",
];

const TRANSFER_KEYWORDS = [
  "transfer ke",
  "pindah saldo",
  "pindah dana",
  "tarik tunai",
  "setor tunai",
  "topup",
  "top up",
  "isi saldo",
  "kirim ke",
];

const EXPENSE_KEYWORDS = [
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
  "langganan",
];

const KNOWN_PROVIDERS = [
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
  "kas",
];

function parseNumericToken(rawNum: string, suffix?: string): number | null {
  const sfx = (suffix ?? "").toLowerCase();
  let cleaned = rawNum.trim();

  if (sfx) {
    // With multiplier suffix like 1.4jt, 1,5jt, 25rb, 500k
    if (cleaned.includes(".") && cleaned.includes(",")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (cleaned.includes(",")) {
      cleaned = cleaned.replace(",", ".");
    } else if (cleaned.includes(".")) {
      // If e.g. 1.500 -> thousand separator, whereas 1.4 -> decimal
      const parts = cleaned.split(".");
      if (parts.length === 2 && parts[1].length === 3) {
        cleaned = parts.join("");
      }
    }
    const base = Number.parseFloat(cleaned);
    if (!Number.isFinite(base) || base <= 0) return null;

    if (sfx === "rb" || sfx === "ribu" || sfx === "k") {
      return Math.round(base * 1_000);
    }
    if (sfx === "jt" || sfx === "juta") {
      return Math.round(base * 1_000_000);
    }
    if (sfx === "m" || sfx === "miliar" || sfx === "milyar") {
      return Math.round(base * 1_000_000_000);
    }
    return Math.round(base);
  }

  // Without suffix: treat dots as thousand separators if grouped in 3 digits (e.g. 1.500.000)
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

export function extractAmountFromCommand(text: string): number | null {
  // Prioritize numbers with explicit currency / Indonesian unit suffixes
  const withUnitRegex =
    /(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta|miliar|milyar|m)\b/gi;
  const unitMatches = [...text.matchAll(withUnitRegex)];
  if (unitMatches.length > 0) {
    // Pick the largest plausible financial amount if multiple numbers exist (e.g. "beli emas 1 gram 1.4jt")
    let best: number | null = null;
    for (const m of unitMatches) {
      const val = parseNumericToken(m[1], m[2]);
      if (val !== null && (best === null || val > best)) {
        best = val;
      }
    }
    if (best !== null) return best;
  }

  // Fallback: explicit Rp prefix or multi-digit number >= 1000
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

export function findBestAccountMatch(
  hintText: string,
  accounts: Account[]
): Account | null {
  const active = accounts.filter((a) => a.is_active);
  const pool = active.length > 0 ? active : accounts;
  if (pool.length === 0) return null;

  const lower = hintText.toLowerCase().trim();
  if (!lower) return null;

  // 1. Exact or substring match on account_name
  const exact = pool.find((a) => a.account_name.toLowerCase() === lower);
  if (exact) return exact;

  const contains = pool.find(
    (a) =>
      lower.includes(a.account_name.toLowerCase()) ||
      a.account_name.toLowerCase().includes(lower)
  );
  if (contains) return contains;

  // 2. Token overlap (e.g. "tabungan mandiri" matches "Bank Mandiri")
  const tokens = lower.split(/\s+/).filter((t) => t.length >= 3);
  for (const tok of tokens) {
    const tokMatch = pool.find((a) => a.account_name.toLowerCase().includes(tok));
    if (tokMatch) return tokMatch;
  }

  // 3. Fallback by account_type keywords
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

function inferCategory(text: string, type: TransactionType): string {
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

function extractAccountHints(text: string, accounts: Account[]): {
  sourceHint: string | null;
  destHint: string | null;
} {
  const lower = text.toLowerCase();

  // Check explicit "dari X ke Y" pattern
  const fromToMatch = /\bdari\s+([a-z0-9\s-]{2,28}?)\s+ke\s+([a-z0-9\s-]{2,28})/i.exec(lower);
  if (fromToMatch) {
    return {
      sourceHint: fromToMatch[1].trim(),
      destHint: fromToMatch[2].trim(),
    };
  }

  // Check "pakai X" / "via X" / "dari X"
  const srcMatch = /\b(?:pakai|pake|via|lewat|menggunakan|dari)\s+([a-z0-9\s-]{2,28})/i.exec(lower);
  const dstMatch = /\b(?:ke|masuk ke|ke rekening|ke akun)\s+([a-z0-9\s-]{2,28})/i.exec(lower);

  let sourceHint = srcMatch ? srcMatch[1].trim() : null;
  let destHint = dstMatch ? dstMatch[1].trim() : null;

  // Also scan known account names or provider keywords anywhere in text
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

export function parseNaturalCommand(
  commandText: string,
  accounts: Account[] = []
): ParsedCommandDraft {
  const trimmed = commandText.trim();
  const lower = trimmed.toLowerCase();
  const warnings: string[] = [];

  // 1. Determine transaction_type
  let transactionType: TransactionType = "expense";
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

  // 2. Extract amount
  const amount = extractAmountFromCommand(trimmed);
  if (amount === null) {
    warnings.push("Nominal belum terdeteksi. Mohon lengkapi atau koreksi nominal sebelum menyetujui.");
  }

  // 3. Extract & resolve accounts
  const { sourceHint, destHint } = extractAccountHints(trimmed, accounts);
  let sourceAccountId: string | null = null;
  let destinationAccountId: string | null = null;

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
    // transfer
    const srcMatch = sourceHint ? findBestAccountMatch(sourceHint, accounts) : null;
    const dstMatch = destHint ? findBestAccountMatch(destHint, accounts) : null;
    sourceAccountId = srcMatch?.id ?? null;
    destinationAccountId = dstMatch?.id ?? null;
    if (!sourceAccountId || !destinationAccountId || sourceAccountId === destinationAccountId) {
      warnings.push("Transfer membutuhkan akun sumber dan akun tujuan yang berbeda.");
    }
  }

  // 4. Category & clean description
  const category = inferCategory(trimmed, transactionType);
  const description = trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;

  // 5. Confidence
  let confidence: ParsedCommandDraft["confidence"] = "high";
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
    warnings,
  };
}
