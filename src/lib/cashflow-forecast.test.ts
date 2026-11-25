import assert from "node:assert/strict";
import test from "node:test";
import { computeCashflowForecast } from "./cashflow-forecast.ts";
import type {
  AccountBalance,
  Debt,
  FinancialReminder,
  RecurringBill,
  Transaction,
} from "../types/ego.ts";

const sampleAccounts: AccountBalance[] = [
  {
    id: "acc-1",
    owner_id: "owner-1",
    account_name: "BCA Utama",
    account_type: "bank",
    opening_balance: 5_000_000,
    current_balance: 5_000_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const sampleBills: RecurringBill[] = [
  {
    id: "bill-gaji",
    owner_id: "owner-1",
    title: "Gaji Bulanan",
    transaction_type: "income",
    amount: 10_000_000,
    category: "Gaji & Pendapatan",
    account_id: "acc-1",
    frequency: "monthly",
    next_due_date: "2026-12-01",
    is_active: true,
    notes: null,
    last_queued_date: null,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "bill-kos",
    owner_id: "owner-1",
    title: "Sewa Rumah",
    transaction_type: "expense",
    amount: 3_500_000,
    category: "Tempat Tinggal",
    account_id: "acc-1",
    frequency: "monthly",
    next_due_date: "2026-11-28",
    is_active: true,
    notes: null,
    last_queued_date: null,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const sampleDebts: Debt[] = [
  {
    id: "debt-1",
    owner_id: "owner-1",
    creditor: "Kredit Motor",
    debt_type: "kendaraan",
    original_amount: 12_000_000,
    outstanding_balance: 6_000_000,
    interest_rate_annual: 12,
    monthly_fee: 0,
    installment_amount: 1_000_000,
    payment_frequency: "monthly",
    due_date: "2026-11-29",
    status: "active",
    description: null,
    created_at: "2026-01-01T00:00:00Z",
  },
];

test("computeCashflowForecast prevents double counting linked bill/debt reminders and separates scheduled vs estimated", () => {
  const linkedReminders: FinancialReminder[] = [
    {
      id: "rem-linked-bill",
      owner_id: "owner-1",
      title: "Tagihan: Sewa Rumah",
      reminder_type: "tagihan_bulanan",
      transaction_type: "expense",
      amount: 3_500_000,
      due_date: "2026-11-28",
      reminder_time: "08:00",
      frequency: "monthly",
      remind_offsets: [3, 1, 0],
      custom_days_before: null,
      is_active: true,
      is_read: false,
      read_at: null,
      last_notified_key: null,
      last_notified_at: null,
      linked_account_id: "acc-1",
      linked_goal_id: null,
      linked_debt_id: null,
      linked_bill_id: "bill-kos",
      dedupe_key: "bill:bill-kos",
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "rem-linked-debt",
      owner_id: "owner-1",
      title: "Cicilan: Kredit Motor",
      reminder_type: "cicilan_utang",
      transaction_type: "expense",
      amount: 1_000_000,
      due_date: "2026-11-29",
      reminder_time: "08:00",
      frequency: "monthly",
      remind_offsets: [3, 1, 0],
      custom_days_before: null,
      is_active: true,
      is_read: false,
      read_at: null,
      last_notified_key: null,
      last_notified_at: null,
      linked_account_id: "acc-1",
      linked_goal_id: null,
      linked_debt_id: "debt-1",
      linked_bill_id: null,
      dedupe_key: "debt:debt-1",
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  const txs: Transaction[] = [
    {
      id: "tx-confirmed",
      owner_id: "owner-1",
      transaction_type: "expense",
      source_account_id: "acc-1",
      destination_account_id: null,
      amount: 3_000_000,
      transaction_date: "2026-11-10",
      category: "Makanan & Minuman",
      description: "Belanja bulanan",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-10T00:00:00Z",
    },
    {
      id: "tx-draft-ignored",
      owner_id: "owner-1",
      transaction_type: "expense",
      source_account_id: "acc-1",
      destination_account_id: null,
      amount: 50_000_000,
      transaction_date: "2026-11-20",
      category: "Belanja",
      description: "Draf belum disetujui",
      status: "pending",
      owner_confirmed: false,
      created_at: "2026-11-20T00:00:00Z",
    },
  ];

  const forecast = computeCashflowForecast({
    accounts: sampleAccounts,
    transactions: txs,
    recurringBills: sampleBills,
    financialReminders: linkedReminders,
    debts: sampleDebts,
    horizonDays: 30,
    referenceDateISO: "2026-11-25",
  });

  // Scheduled income: Gaji 10jt; Scheduled expense: Kos 3.5jt + Motor 1jt = 4.5jt (linked reminders NOT double-counted!)
  assert.equal(forecast.scheduledIncome, 10_000_000);
  assert.equal(forecast.scheduledExpense, 4_500_000);
  // Estimated expense: 3jt / 30 days * 30 days = 3jt (draft 50jt ignored!)
  assert.equal(forecast.estimatedExpense, 3_000_000);
  assert.equal(forecast.endingBalance, 7_500_000);
});

test("computeCashflowForecast detects deficit-risk days when expenses push projected balance below zero", () => {
  const lowAccounts: AccountBalance[] = [
    { ...sampleAccounts[0], opening_balance: 1_000_000, current_balance: 1_000_000 },
  ];
  const forecast = computeCashflowForecast({
    accounts: lowAccounts,
    transactions: [],
    recurringBills: [sampleBills[1]], // 3.5jt on 2026-11-28
    financialReminders: [],
    debts: [],
    horizonDays: 7,
    referenceDateISO: "2026-11-25",
  });

  assert.ok(forecast.deficitDaysCount > 0);
  assert.equal(forecast.firstDeficitDateISO, "2026-11-28");
  assert.equal(forecast.lowestBalance, -2_500_000);
});
