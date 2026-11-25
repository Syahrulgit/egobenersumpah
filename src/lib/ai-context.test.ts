import assert from "node:assert/strict";
import test from "node:test";
import { buildEgoAiContextDigest, formatContextBriefForPrompt } from "./ai-context.ts";
import type { AccountBalance, Transaction } from "../types/ego.ts";

test("buildEgoAiContextDigest separates verified actual data, forecast estimates, and missing indicators", () => {
  const accounts: AccountBalance[] = [
    {
      id: "acc-1",
      owner_id: "owner-1",
      account_name: "Mandiri",
      account_type: "bank",
      opening_balance: 12_000_000,
      current_balance: 12_000_000,
      currency: "IDR",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];
  const txs: Transaction[] = [
    {
      id: "tx-1",
      owner_id: "owner-1",
      transaction_type: "income",
      source_account_id: null,
      destination_account_id: "acc-1",
      amount: 10_000_000,
      transaction_date: "2026-11-01",
      category: "Gaji & Pendapatan",
      description: "Gaji",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-01T00:00:00Z",
    },
  ];

  const digest = buildEgoAiContextDigest({
    accounts,
    transactions: txs,
    assets: [],
    debts: [],
    recurringBills: [],
    financialReminders: [],
    savingsGoals: [],
    categoryBudgets: [],
    referenceDateISO: "2026-11-25",
  });

  assert.equal(digest.data_aktual.liquid_balance_idr, 12_000_000);
  assert.equal(digest.data_aktual.current_month_confirmed_income_idr, 10_000_000);
  assert.ok(digest.data_belum_lengkap.length > 0);

  const brief = formatContextBriefForPrompt(digest);
  assert.match(brief, /\[DATA AKTUAL TERVERIFIKASI OWNER\]/);
  assert.match(brief, /\[DATA ESTIMASI FORECAST\]/);
  assert.match(brief, /\[HASIL SIMULASI TERSEDIA\]/);
  assert.match(brief, /\[DATA BELUM LENGKAP \/ JANGAN DIKARANG\]/);
});
