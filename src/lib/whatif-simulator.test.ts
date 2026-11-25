import assert from "node:assert/strict";
import test from "node:test";
import {
  computeAmortizedMonthlyPayment,
  runWhatIfSimulation,
} from "./whatif-simulator.ts";
import type {
  AccountBalance,
  Asset,
  CategoryBudget,
  Debt,
  FinancialReminder,
  RecurringBill,
  SavingsGoal,
  Transaction,
} from "../types/ego.ts";

const accounts: AccountBalance[] = [
  {
    id: "acc-bca",
    owner_id: "owner-1",
    account_name: "BCA",
    account_type: "bank",
    opening_balance: 20_000_000,
    current_balance: 20_000_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const txs: Transaction[] = [
  {
    id: "tx-in",
    owner_id: "owner-1",
    transaction_type: "income",
    source_account_id: null,
    destination_account_id: "acc-bca",
    amount: 12_000_000,
    transaction_date: "2026-11-01",
    category: "Gaji & Pendapatan",
    description: "Gaji",
    status: "posted",
    owner_confirmed: true,
    created_at: "2026-11-01T00:00:00Z",
  },
  {
    id: "tx-out",
    owner_id: "owner-1",
    transaction_type: "expense",
    source_account_id: "acc-bca",
    destination_account_id: null,
    amount: 6_000_000,
    transaction_date: "2026-11-05",
    category: "Makanan & Minuman",
    description: "Biaya hidup",
    status: "posted",
    owner_confirmed: true,
    created_at: "2026-11-05T00:00:00Z",
  },
];

const emptyAssets: Asset[] = [];
const emptyDebts: Debt[] = [];
const sampleBills: RecurringBill[] = [
  {
    id: "bill-salary",
    owner_id: "owner-1",
    title: "Gaji Bulanan",
    transaction_type: "income",
    category: "Gaji & Pendapatan",
    amount: 12_000_000,
    frequency: "monthly",
    next_due_date: "2026-12-01",
    account_id: "acc-bca",
    is_active: true,
    last_queued_date: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
  },
];
const emptyReminders: FinancialReminder[] = [];
const emptyGoals: SavingsGoal[] = [];
const emptyBudgets: CategoryBudget[] = [];

test("computeAmortizedMonthlyPayment handles 0% and positive annual interest rates cleanly", () => {
  assert.equal(computeAmortizedMonthlyPayment(12_000_000, 12, 0), 1_000_000);
  const withInterest = computeAmortizedMonthlyPayment(12_000_000, 12, 12);
  assert.ok(withInterest > 1_000_000 && withInterest < 1_100_000);
});

test("runWhatIfSimulation evaluates affordable cash purchase as aman and excessive cash purchase as berisiko without mutating inputs", () => {
  const safeRes = runWhatIfSimulation({
    params: {
      scenario_type: "cash_purchase",
      title: "Beli Monitor",
      amount: 3_000_000,
      tenor_months: 1,
      annual_interest_pct: 0,
      monthly_delta: 0,
    },
    accounts,
    transactions: txs,
    assets: emptyAssets,
    debts: emptyDebts,
    recurringBills: sampleBills,
    financialReminders: emptyReminders,
    savingsGoals: emptyGoals,
    categoryBudgets: emptyBudgets,
    referenceDateISO: "2026-11-25",
  });

  assert.equal(safeRes.beforeBalance, 20_000_000);
  assert.equal(safeRes.afterImmediateBalance, 17_000_000);
  assert.equal(safeRes.riskLevel, "aman");
  assert.equal(accounts[0].current_balance, 20_000_000);

  const riskyRes = runWhatIfSimulation({
    params: {
      scenario_type: "cash_purchase",
      title: "Beli Mobil Tunai",
      amount: 25_000_000,
      tenor_months: 1,
      annual_interest_pct: 0,
      monthly_delta: 0,
    },
    accounts,
    transactions: txs,
    assets: emptyAssets,
    debts: emptyDebts,
    recurringBills: sampleBills,
    financialReminders: emptyReminders,
    savingsGoals: emptyGoals,
    categoryBudgets: emptyBudgets,
    referenceDateISO: "2026-11-25",
  });

  assert.equal(riskyRes.riskLevel, "berisiko");
  assert.equal(riskyRes.afterImmediateBalance, -5_000_000);
});

test("runWhatIfSimulation compares Conservative, Normal, and Optimistic variants properly", () => {
  const res = runWhatIfSimulation({
    params: {
      scenario_type: "installment_purchase",
      title: "Cicilan Laptop",
      amount: 12_000_000,
      tenor_months: 12,
      annual_interest_pct: 12,
      monthly_delta: 0,
    },
    accounts,
    transactions: txs,
    assets: emptyAssets,
    debts: emptyDebts,
    recurringBills: sampleBills,
    financialReminders: emptyReminders,
    savingsGoals: emptyGoals,
    categoryBudgets: emptyBudgets,
    referenceDateISO: "2026-11-25",
  });

  assert.ok(res.variants.conservative.projectedBalance90d < res.variants.normal.projectedBalance90d);
  assert.ok(res.variants.normal.projectedBalance90d < res.variants.optimistic.projectedBalance90d);
  assert.equal(res.debtAfter, 12_000_000);
});
