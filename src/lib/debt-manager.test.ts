import assert from "node:assert/strict";
import test from "node:test";
import {
  compareDebtStrategies,
  computeDebtDisplayStatus,
  effectiveMonthlyInstallment,
  normalizeDebt,
  simulateDebtPayoffStrategy,
} from "./debt-manager.ts";
import type { Debt } from "../types/ego.ts";

const baseDebts: Debt[] = [
  {
    id: "d-paylater",
    owner_id: "owner-1",
    creditor: "PayLater Belanja",
    debt_type: "paylater",
    original_amount: 3_000_000,
    outstanding_balance: 2_000_000,
    interest_rate_annual: 24,
    monthly_fee: 10_000,
    installment_amount: 400_000,
    payment_frequency: "monthly",
    due_date: "2026-12-05",
    status: "active",
    description: "Cicilan gadget",
    created_at: "2026-10-01T00:00:00Z",
  },
  {
    id: "d-cc",
    owner_id: "owner-1",
    creditor: "Kartu Kredit BCA",
    debt_type: "kartu_kredit",
    original_amount: 10_000_000,
    outstanding_balance: 8_000_000,
    interest_rate_annual: 30,
    monthly_fee: 0,
    installment_amount: 600_000,
    payment_frequency: "monthly",
    due_date: "2026-11-20",
    status: "active",
    description: null,
    created_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "d-rekan",
    owner_id: "owner-1",
    creditor: "Pinjaman Rekan",
    debt_type: "pinjaman_pribadi",
    original_amount: 5_000_000,
    outstanding_balance: 0,
    interest_rate_annual: 0,
    monthly_fee: 0,
    installment_amount: 0,
    payment_frequency: "monthly",
    due_date: "2026-10-15",
    status: "paid",
    description: null,
    created_at: "2026-08-01T00:00:00Z",
  },
];

test("normalizeDebt applies safe defaults for legacy rows missing new columns", () => {
  const legacy: Debt = {
    id: "legacy-1",
    owner_id: "owner-1",
    creditor: "Bank Legacy",
    original_amount: 4_000_000,
    outstanding_balance: 2_500_000,
    due_date: null,
    status: "active",
    description: null,
    created_at: "2026-01-01T00:00:00Z",
  };
  const norm = normalizeDebt(legacy);
  assert.equal(norm.debt_type, "lainnya");
  assert.equal(norm.interest_rate_annual, 0);
  assert.equal(norm.monthly_fee, 0);
  assert.equal(norm.installment_amount, 0);
  assert.equal(norm.payment_frequency, "monthly");
});

test("computeDebtDisplayStatus detects paid, overdue, due_soon, and active accurately", () => {
  assert.equal(computeDebtDisplayStatus(baseDebts[2], "2026-11-25"), "paid");
  assert.equal(computeDebtDisplayStatus(baseDebts[1], "2026-11-25"), "overdue");
  assert.equal(computeDebtDisplayStatus(baseDebts[0], "2026-12-01"), "due_soon");
  assert.equal(computeDebtDisplayStatus(baseDebts[0], "2026-11-15"), "active");
});

test("effectiveMonthlyInstallment scales non-monthly frequencies and falls back cleanly for zero installment", () => {
  const weekly = effectiveMonthlyInstallment({
    ...baseDebts[0],
    installment_amount: 100_000,
    payment_frequency: "weekly",
  });
  assert.equal(weekly.isEstimatedFallback, false);
  assert.ok(weekly.monthlyAmount > 400_000);

  const fallback = effectiveMonthlyInstallment({
    ...baseDebts[0],
    installment_amount: 0,
  });
  assert.equal(fallback.isEstimatedFallback, true);
  assert.equal(fallback.monthlyAmount, 100_000);
});

test("Debt Snowball pays smallest balance first while Debt Avalanche pays highest rate first and saves more interest", () => {
  const compareFixtures: Debt[] = [
    {
      ...baseDebts[0],
      id: "d-paylater",
      creditor: "PayLater Belanja",
      outstanding_balance: 2_400_000,
      interest_rate_annual: 12,
      installment_amount: 250_000,
    },
    {
      ...baseDebts[1],
      id: "d-cc",
      creditor: "Kartu Kredit BCA",
      outstanding_balance: 3_200_000,
      interest_rate_annual: 36,
      installment_amount: 300_000,
    },
  ];
  const snowball = simulateDebtPayoffStrategy({
    debts: compareFixtures,
    strategy: "snowball",
    extraMonthlyPayment: 650_000,
    referenceDateISO: "2026-11-25",
  });
  const avalanche = simulateDebtPayoffStrategy({
    debts: compareFixtures,
    strategy: "avalanche",
    extraMonthlyPayment: 650_000,
    referenceDateISO: "2026-11-25",
  });

  assert.equal(snowball.payoffOrder[0].debtId, "d-paylater");
  assert.equal(avalanche.payoffOrder[0].debtId, "d-cc");
  assert.ok(avalanche.totalInterestPaid < snowball.totalInterestPaid);
  assert.ok((snowball.monthsToDebtFree ?? 999) < 12);
});

test("compareDebtStrategies reports savings vs minimum and flags cashflow fit warning if surplus insufficient", () => {
  const cmp = compareDebtStrategies({
    debts: baseDebts,
    extraMonthlyPayment: 1_000_000,
    monthlyNetSurplus: 400_000,
    referenceDateISO: "2026-11-25",
  });

  assert.equal(cmp.activeDebtCount, 2);
  assert.equal(cmp.overdueDebtCount, 1);
  assert.equal(cmp.totalOutstanding, 10_000_000);
  assert.ok(cmp.avalancheInterestSavedVsMin > 0);
  assert.ok(cmp.cashflowFitWarning !== null);
});
