import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyBudgetThreshold,
  evaluateBudgetsForMonth,
  formatPeriodMonthID,
  shiftPeriodMonth,
  summarizeBudgetMonth,
} from "./budgets";
import type { BudgetAlertLog, CategoryBudget, Transaction } from "../types/ego";

function makeTx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? "tx-1",
    owner_id: "owner-1",
    transaction_type: partial.transaction_type ?? "expense",
    source_account_id: partial.source_account_id ?? "acc-1",
    destination_account_id: partial.destination_account_id ?? null,
    amount: partial.amount ?? 100_000,
    transaction_date: partial.transaction_date ?? "2026-11-15",
    category: partial.category ?? "Makanan & Minuman",
    description: partial.description ?? "Belanja makan",
    status: partial.status ?? "posted",
    owner_confirmed: partial.owner_confirmed ?? true,
    created_at: partial.created_at ?? "2026-11-15T10:00:00Z",
  };
}

function makeBudget(partial: Partial<CategoryBudget>): CategoryBudget {
  return {
    id: partial.id ?? "bud-1",
    owner_id: "owner-1",
    category: partial.category ?? "Makanan & Minuman",
    period_month: partial.period_month ?? "2026-11",
    limit_amount: partial.limit_amount ?? 1_000_000,
    is_active: partial.is_active ?? true,
    last_alert_threshold: partial.last_alert_threshold ?? null,
    last_alert_period: partial.last_alert_period ?? null,
    notes: partial.notes ?? null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
  };
}

test("classifyBudgetThreshold handles 50%, 75%, 90%, 100%, and >100% levels accurately", () => {
  assert.equal(classifyBudgetThreshold(499_999, 1_000_000).crossedThreshold, null);
  assert.equal(classifyBudgetThreshold(500_000, 1_000_000).crossedThreshold, 50);
  assert.equal(classifyBudgetThreshold(749_000, 1_000_000).crossedThreshold, 50);
  assert.equal(classifyBudgetThreshold(750_000, 1_000_000).crossedThreshold, 75);
  assert.equal(classifyBudgetThreshold(900_000, 1_000_000).crossedThreshold, 90);
  assert.equal(classifyBudgetThreshold(1_000_000, 1_000_000).crossedThreshold, 100);
  assert.equal(classifyBudgetThreshold(1_000_000, 1_000_000).severity, "reached_100");
  assert.equal(classifyBudgetThreshold(1_150_000, 1_000_000).crossedThreshold, 101);
  assert.equal(classifyBudgetThreshold(1_150_000, 1_000_000).severity, "exceeded_over");
});

test("evaluateBudgetsForMonth strictly sums only confirmed posted expenses in matching period", () => {
  const budgets = [
    makeBudget({ id: "b1", category: "Makanan & Minuman", period_month: "2026-11", limit_amount: 1_000_000 }),
    makeBudget({ id: "b2", category: "Makanan & Minuman", period_month: "2026-10", limit_amount: 2_000_000 }),
  ];

  const txs = [
    // Valid confirmed expense in Nov 2026 (case-insensitive category match)
    makeTx({ id: "t1", amount: 600_000, category: "makanan & minuman", transaction_date: "2026-11-05" }),
    // Draft / pending MUST BE IGNORED
    makeTx({ id: "t2", amount: 500_000, status: "pending", owner_confirmed: false, transaction_date: "2026-11-06" }),
    // Posted without owner_confirmed MUST BE IGNORED
    makeTx({ id: "t3", amount: 500_000, status: "posted", owner_confirmed: false, transaction_date: "2026-11-07" }),
    // Cancelled MUST BE IGNORED
    makeTx({ id: "t4", amount: 500_000, status: "cancelled", owner_confirmed: true, transaction_date: "2026-11-08" }),
    // Income & transfer MUST BE IGNORED
    makeTx({ id: "t5", transaction_type: "income", source_account_id: null, destination_account_id: "acc-1", amount: 5_000_000, transaction_date: "2026-11-09" }),
    makeTx({ id: "t6", transaction_type: "transfer", destination_account_id: "acc-2", amount: 400_000, transaction_date: "2026-11-10" }),
    // Different month MUST NOT affect 2026-11
    makeTx({ id: "t7", amount: 1_500_000, transaction_date: "2026-10-20" }),
  ];

  const nov = evaluateBudgetsForMonth(budgets, txs, "2026-11");
  assert.equal(nov.length, 1);
  assert.equal(nov[0].spentAmount, 600_000);
  assert.equal(nov[0].remainingAmount, 400_000);
  assert.equal(nov[0].usagePct, 60);
  assert.equal(nov[0].crossedThreshold, 50);
  assert.equal(nov[0].pendingAlertThreshold, 50);

  const oct = evaluateBudgetsForMonth(budgets, txs, "2026-10");
  assert.equal(oct.length, 1);
  assert.equal(oct[0].spentAmount, 1_500_000);
  assert.equal(oct[0].usagePct, 75);
  assert.equal(oct[0].crossedThreshold, 75);
});

test("duplicate threshold notifications are suppressed in same period while allowing higher thresholds", () => {
  const budget = makeBudget({
    id: "b1",
    limit_amount: 1_000_000,
    period_month: "2026-11",
    last_alert_threshold: 75,
    last_alert_period: "2026-11",
  });

  // Still at 80% -> threshold 75 already notified -> pendingAlertThreshold must be null
  const at80 = evaluateBudgetsForMonth([budget], [makeTx({ amount: 800_000 })], "2026-11");
  assert.equal(at80[0].crossedThreshold, 75);
  assert.equal(at80[0].pendingAlertThreshold, null);

  // Rises to 92% -> threshold 90 > last_alert_threshold 75 -> should fire 90
  const at92 = evaluateBudgetsForMonth([budget], [makeTx({ amount: 920_000 })], "2026-11");
  assert.equal(at92[0].crossedThreshold, 90);
  assert.equal(at92[0].pendingAlertThreshold, 90);

  // If alertLogs already recorded 90 in 2026-11, suppress even if budget row hasn't refreshed
  const logs: BudgetAlertLog[] = [
    {
      id: "log-1",
      owner_id: "owner-1",
      budget_id: "b1",
      category: "Makanan & Minuman",
      period_month: "2026-11",
      threshold_level: 90,
      spent_amount: 920_000,
      limit_amount: 1_000_000,
      usage_pct: 92,
      event_type: "threshold_crossed",
      notes: null,
      created_at: "2026-11-16T00:00:00Z",
    },
  ];
  const dedupedByLog = evaluateBudgetsForMonth([budget], [makeTx({ amount: 920_000 })], "2026-11", logs);
  assert.equal(dedupedByLog[0].pendingAlertThreshold, null);

  // Same threshold in a DIFFERENT period_month is NOT suppressed
  const decBudget = makeBudget({
    id: "b-dec",
    period_month: "2026-12",
    last_alert_threshold: 90,
    last_alert_period: "2026-11",
  });
  const dec = evaluateBudgetsForMonth(
    [decBudget],
    [makeTx({ amount: 550_000, transaction_date: "2026-12-03" })],
    "2026-12"
  );
  assert.equal(dec[0].pendingAlertThreshold, 50);
});

test("summarizeBudgetMonth aggregates totals, inactive exclusions, over-budget, and unbudgeted categories", () => {
  const budgets = [
    makeBudget({ id: "b1", category: "Makanan & Minuman", limit_amount: 2_000_000 }),
    makeBudget({ id: "b2", category: "Transportasi", limit_amount: 500_000 }),
    makeBudget({ id: "b3", category: "Belanja", limit_amount: 1_000_000, is_active: false }),
  ];

  const txs = [
    makeTx({ id: "t1", category: "Makanan & Minuman", amount: 1_600_000 }),
    makeTx({ id: "t2", category: "Transportasi", amount: 650_000 }),
    makeTx({ id: "t3", category: "Belanja", amount: 300_000 }),
    makeTx({ id: "t4", category: "Kesehatan", amount: 200_000 }),
  ];

  const summary = summarizeBudgetMonth(budgets, txs, "2026-11");
  assert.equal(summary.activeCount, 2);
  assert.equal(summary.inactiveCount, 1);
  assert.equal(summary.totalBudget, 2_500_000);
  assert.equal(summary.totalSpentBudgeted, 2_250_000);
  assert.equal(summary.totalConfirmedExpenseAll, 2_750_000);
  assert.equal(summary.remainingBudget, 250_000);
  assert.equal(summary.overallUsagePct, 90);
  assert.equal(summary.exceededCount, 1);
  assert.equal(summary.approachingCount, 1);
  assert.equal(summary.attentionCount, 2);
  assert.equal(summary.topCategories[0].budget.category, "Transportasi");
  assert.equal(summary.unbudgetedCategories.length, 1);
  assert.equal(summary.unbudgetedCategories[0].category, "Kesehatan");
});

test("period month helpers format Indonesian labels and shift across year boundaries", () => {
  assert.equal(formatPeriodMonthID("2026-11"), "November 2026");
  assert.equal(formatPeriodMonthID("2026-11", true), "Nov 2026");
  assert.equal(shiftPeriodMonth("2026-12", 1), "2027-01");
  assert.equal(shiftPeriodMonth("2026-01", -1), "2025-12");
});
