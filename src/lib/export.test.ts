import assert from "node:assert/strict";
import test from "node:test";
import { transactionsToCsv, vaultSnapshotToBackupJson } from "./export";
import type { Account, Transaction } from "../types/ego";

const sampleAccounts: Pick<Account, "id" | "account_name">[] = [
  { id: "acc-bca", account_name: "BCA Utama" },
  { id: "acc-gopay", account_name: "GoPay" },
];

const sampleTransactions: Transaction[] = [
  {
    id: "tx-1",
    owner_id: "owner-1",
    transaction_type: "expense",
    source_account_id: "acc-gopay",
    destination_account_id: null,
    amount: 45_000,
    transaction_date: "2026-11-24",
    category: "Makanan & Minuman",
    description: 'Kopi, "Pagi" Spesial',
    status: "posted",
    owner_confirmed: true,
    created_at: "2026-11-24T08:00:00Z",
  },
  {
    id: "tx-2",
    owner_id: "owner-1",
    transaction_type: "income",
    source_account_id: null,
    destination_account_id: "acc-bca",
    amount: 15_000_000,
    transaction_date: "2026-11-01",
    category: "Gaji & Pendapatan",
    description: "Gaji Bulanan",
    status: "posted",
    owner_confirmed: true,
    created_at: "2026-11-01T08:00:00Z",
  },
];

test("transactionsToCsv emits UTF-8 BOM, headers, and properly escaped Indonesian cells", () => {
  const csv = transactionsToCsv(sampleTransactions, sampleAccounts);
  assert.equal(csv.startsWith("\uFEFFTanggal,Jenis,Kategori,"), true);
  assert.match(csv, /2026-11-24,Pengeluaran,Makanan & Minuman,"Kopi, ""Pagi"" Spesial",GoPay,,45000,Terposting,Ya/);
  assert.match(csv, /2026-11-01,Pemasukan,Gaji & Pendapatan,Gaji Bulanan,,BCA Utama,15000000,Terposting,Ya/);
});

test("vaultSnapshotToBackupJson serializes complete structured vault backup", () => {
  const jsonStr = vaultSnapshotToBackupJson(
    {
      accounts: [],
      transactions: sampleTransactions,
      assets: [],
      debts: [],
      owner_commands: [],
      recurring_bills: [],
      savings_goals: [],
      financial_reminders: [],
      financial_reminder_logs: [],
      category_budgets: [],
      budget_alert_logs: [],
      preferences: {
        date_format: "DD MMM YYYY",
        expense_alert_limit: 5_000_000,
      },
    },
    "owner@ego.id",
    "2026-11-24T09:00:00.000Z"
  );
  const parsed = JSON.parse(jsonStr) as {
    app: string;
    version: string;
    owner_email: string;
    exported_at: string;
    data: { transactions: Transaction[] };
  };
  assert.equal(parsed.app, "EGO Personal AI");
  assert.equal(parsed.version, "1.0");
  assert.equal(parsed.owner_email, "owner@ego.id");
  assert.equal(parsed.data.transactions.length, 2);
});
