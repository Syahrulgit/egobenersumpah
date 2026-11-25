import assert from "node:assert/strict";
import test from "node:test";
import type { AccountBalance, SavingsGoal } from "../types/ego";
import {
  computeCycleDepositAmount,
  computeGoalSimulation,
  summarizeGoalsForDashboard,
} from "./goal-simulator.ts";

test("computeGoalSimulation computes normal, conservative, optimistic scenarios and gap accurately", () => {
  const res = computeGoalSimulation(
    {
      title: "Dana Darurat",
      target_amount: 12_000_000,
      current_amount: 2_000_000,
      target_date: "2027-10-01", // 10 months from 2026-12-01
      monthly_deposit: 1_000_000,
      deposit_frequency: "monthly",
      linked_account_id: null,
      use_yield_assumption: false,
    },
    "2026-12-01"
  );

  assert.equal(res.remainingAmount, 10_000_000);
  assert.equal(res.isAlreadyAchieved, false);
  assert.equal(res.isPastDue, false);
  assert.equal(res.monthsRemaining, 10);
  assert.equal(res.minimumMonthlyDeposit, 1_000_000);
  assert.equal(res.status, "on_track");

  assert.equal(res.scenarios.conservative.monthlyDeposit, 700_000);
  assert.equal(res.scenarios.normal.monthlyDeposit, 1_000_000);
  assert.equal(res.scenarios.optimistic.monthlyDeposit, 1_300_000);
  assert.equal(res.scenarios.conservative.status, "at_risk");
  assert.equal(res.scenarios.normal.status, "on_track");
  assert.equal(res.scenarios.optimistic.status, "on_track");
  assert.equal(res.scenarios.normal.estimatedMonths, 10);
  assert.equal(res.scenarios.optimistic.estimatedMonths, 8);
  assert.ok(res.projectionSeries.length >= 11);
  assert.equal(res.projectionSeries[0].normal, 2_000_000);
});

test("computeGoalSimulation handles edge cases: already achieved, no date, past due, zero deposit, deposit > target, and optional yield", () => {
  // 1. Already achieved
  const achieved = computeGoalSimulation(
    {
      title: "Dana HP",
      target_amount: 5_000_000,
      current_amount: 5_500_000,
      target_date: "2026-11-01",
      monthly_deposit: 500_000,
      deposit_frequency: "monthly",
      linked_account_id: null,
    },
    "2026-12-01"
  );
  assert.equal(achieved.isAlreadyAchieved, true);
  assert.equal(achieved.isPastDue, false);
  assert.equal(achieved.remainingAmount, 0);
  assert.equal(achieved.status, "achieved");
  assert.equal(achieved.scenarios.normal.estimatedMonths, 0);

  // 2. Past due and zero deposit
  const pastDue = computeGoalSimulation(
    {
      title: "Dana Liburan",
      target_amount: 10_000_000,
      current_amount: 2_000_000,
      target_date: "2026-11-15",
      monthly_deposit: 0,
      deposit_frequency: "weekly",
      linked_account_id: null,
    },
    "2026-12-01"
  );
  assert.equal(pastDue.isPastDue, true);
  assert.equal(pastDue.status, "at_risk");
  assert.equal(pastDue.scenarios.normal.estimatedMonths, null);
  assert.equal(pastDue.minimumMonthlyDeposit, 8_000_000);

  // 3. No target date & deposit > remaining
  const fastNoDate = computeGoalSimulation(
    {
      title: "Dana Laptop",
      target_amount: 10_000_000,
      current_amount: 4_000_000,
      target_date: null,
      monthly_deposit: 8_000_000,
      deposit_frequency: "biweekly",
      linked_account_id: null,
    },
    "2026-12-01"
  );
  assert.equal(fastNoDate.monthsRemaining, null);
  assert.equal(fastNoDate.status, "on_track");
  assert.equal(fastNoDate.scenarios.normal.estimatedMonths, 1);

  // 4. Optional yield assumption OFF by default vs ON explicitly
  const withYield = computeGoalSimulation(
    {
      title: "Dana Pensiun",
      target_amount: 50_000_000,
      current_amount: 20_000_000,
      target_date: "2027-12-01",
      monthly_deposit: 2_000_000,
      deposit_frequency: "monthly",
      linked_account_id: null,
      use_yield_assumption: true,
      annual_yield_pct: 6,
    },
    "2026-12-01"
  );
  assert.equal(withYield.useYieldAssumption, true);
  assert.equal(withYield.annualYieldPct, 6);
  assert.ok((withYield.scenarios.normal.projectedAtTargetDate ?? 0) > 20_000_000 + 24_000_000);

  // Cycle conversions
  assert.equal(computeCycleDepositAmount(2_600_000, "biweekly"), 1_200_000);
  assert.equal(computeCycleDepositAmount(5_200_000, "weekly"), 1_200_000);
});

test("summarizeGoalsForDashboard computes active count, overall progress, and at-risk count", () => {
  const accounts: AccountBalance[] = [
    {
      id: "acc-save",
      owner_id: "owner-1",
      account_name: "Tabungan BCA",
      account_type: "bank",
      opening_balance: 5_000_000,
      currency: "IDR",
      is_active: true,
      created_at: "2026-11-01T00:00:00Z",
      current_balance: 5_000_000,
    },
  ];
  const goals: SavingsGoal[] = [
    {
      id: "g-1",
      owner_id: "owner-1",
      title: "Dana Darurat",
      goal_type: "emergency_fund",
      target_amount: 10_000_000,
      current_amount: 0,
      target_date: "2027-02-01", // 2 months from 2026-12-01, needs 2.5jt/mo
      linked_account_id: "acc-save",
      notes: null,
      status: "active",
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "g-2",
      owner_id: "owner-1",
      title: "Dana Selesai",
      goal_type: "savings_target",
      target_amount: 5_000_000,
      current_amount: 5_000_000,
      target_date: null,
      linked_account_id: null,
      notes: null,
      status: "completed",
      created_at: "2026-10-01T00:00:00Z",
    },
  ];

  const summary = summarizeGoalsForDashboard(goals, accounts, 1_500_000, "2026-12-01");
  assert.equal(summary.activeGoalsCount, 1);
  assert.equal(summary.completedGoalsCount, 1);
  assert.equal(summary.overallProgressPct, 66.7); // (5M + 5M) / 15M
  assert.equal(summary.atRiskCount, 1); // 1.5M/mo * 2 + 5M = 8M < 10M
  assert.equal(summary.primaryGoal?.title, "Dana Darurat");
});
