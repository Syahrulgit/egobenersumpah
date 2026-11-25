import assert from "node:assert/strict";
import test from "node:test";
import { computeFinancialHealthScore } from "./health-score.ts";
import type {
  AccountBalance,
  Asset,
  CategoryBudget,
  Debt,
  SavingsGoal,
  Transaction,
} from "../types/ego.ts";

test("computeFinancialHealthScore never defaults missing data to 0 and normalizes available component weights", () => {
  const accounts: AccountBalance[] = [
    {
      id: "acc-1",
      owner_id: "owner-1",
      account_name: "BCA",
      account_type: "bank",
      opening_balance: 10_000_000,
      current_balance: 10_000_000,
      currency: "IDR",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];
  // Only account exists, no transactions/budgets/goals/debts
  const res = computeFinancialHealthScore({
    accounts,
    transactions: [],
    assets: [],
    debts: [],
    categoryBudgets: [],
    savingsGoals: [],
    referenceDateISO: "2026-11-25",
  });

  assert.equal(res.isDataIncomplete, true);
  assert.ok(res.missingIndicators.length >= 5);
  assert.equal(res.availableWeight, 15); // Only debt_to_asset_ratio is available (0 debt vs 10jt cash -> 100)
  assert.equal(res.totalScore, 100);
  const cashflowComp = res.components.find((c) => c.key === "cashflow_stability");
  assert.equal(cashflowComp?.available, false);
  assert.equal(cashflowComp?.score, null);
});

test("computeFinancialHealthScore computes all 7 components when full data is present", () => {
  const accounts: AccountBalance[] = [
    {
      id: "acc-1",
      owner_id: "owner-1",
      account_name: "BCA",
      account_type: "bank",
      opening_balance: 30_000_000,
      current_balance: 30_000_000,
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
      destination_account_id: "acc-1",
      amount: 15_000_000,
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
      source_account_id: "acc-1",
      destination_account_id: null,
      amount: 5_000_000,
      transaction_date: "2026-11-10",
      category: "Makanan & Minuman",
      description: "Makan",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-10T00:00:00Z",
    },
  ];
  const assets: Asset[] = [
    {
      id: "a-1",
      owner_id: "owner-1",
      asset_name: "Emas",
      asset_type: "emas",
      current_value: 20_000_000,
      quantity: 10,
      unit: "gram",
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];
  const debts: Debt[] = [
    {
      id: "d-1",
      owner_id: "owner-1",
      creditor: "Bank",
      debt_type: "pinjaman_pribadi",
      original_amount: 5_000_000,
      outstanding_balance: 3_000_000,
      interest_rate_annual: 10,
      monthly_fee: 0,
      installment_amount: 500_000,
      payment_frequency: "monthly",
      due_date: "2026-12-01",
      status: "active",
      description: null,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];
  const budgets: CategoryBudget[] = [
    {
      id: "b-1",
      owner_id: "owner-1",
      category: "Makanan & Minuman",
      period_month: "2026-11",
      limit_amount: 7_500_000,
      is_active: true,
      last_alert_threshold: null,
      last_alert_period: null,
      notes: null,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    },
  ];
  const goals: SavingsGoal[] = [
    {
      id: "g-1",
      owner_id: "owner-1",
      title: "Dana Darurat",
      goal_type: "emergency_fund",
      target_amount: 30_000_000,
      current_amount: 24_000_000,
      target_date: null,
      linked_account_id: null,
      notes: null,
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
    },
  ];

  const res = computeFinancialHealthScore({
    accounts,
    transactions: txs,
    assets,
    debts,
    categoryBudgets: budgets,
    savingsGoals: goals,
    referenceDateISO: "2026-11-25",
  });

  assert.equal(res.isDataIncomplete, false);
  assert.equal(res.availableWeight, 100);
  assert.ok(res.totalScore !== null && res.totalScore >= 80);
  assert.ok(["Prima", "Sehat"].includes(res.grade));
});

test("computeFinancialHealthScore returns null score when vault is completely empty", () => {
  const res = computeFinancialHealthScore({
    accounts: [],
    transactions: [],
    assets: [],
    debts: [],
    categoryBudgets: [],
    savingsGoals: [],
    referenceDateISO: "2026-11-25",
  });
  assert.equal(res.totalScore, null);
  assert.equal(res.grade, "Belum Cukup Data");
});
