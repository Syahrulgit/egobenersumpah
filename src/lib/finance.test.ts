import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceDueDate,
  computeAccountBalances,
  computeBalanceTrend,
  computeCashflowSeries,
  computeCategoryBreakdown,
  computeEmergencyFundMonths,
  computeGoalProgress,
  computeMonthlyCashflow,
  computeNetWorth,
  estimateGoalCompletionMonths,
  filterTransactions,
  formatIDR,
  formatThousandsInput,
  getDueRecurringBills,
  getGreetingID,
  groupTransactionsByDate,
  parseThousandsInput,
} from "./finance";
import type {
  Account,
  Asset,
  Debt,
  RecurringBill,
  SavingsGoal,
  Transaction,
} from "../types/ego";

const OWNER = "owner-1";

const accounts: Account[] = [
  {
    id: "acc-bca",
    owner_id: OWNER,
    account_name: "BCA Utama",
    account_type: "bank",
    opening_balance: 10_000_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
  {
    id: "acc-gopay",
    owner_id: OWNER,
    account_name: "GoPay",
    account_type: "ewallet",
    opening_balance: 500_000,
    currency: "IDR",
    is_active: true,
    created_at: "2026-11-01T00:00:00Z",
  },
];

test("formatIDR produces standard Indonesian Rupiah notation", () => {
  assert.equal(formatIDR(1_500_000), "Rp 1.500.000");
  assert.equal(formatIDR(0), "Rp 0");
  assert.equal(formatIDR(-25_000), "-Rp 25.000");
});

test("formatThousandsInput and parseThousandsInput roundtrip cleanly", () => {
  assert.equal(formatThousandsInput("1500000"), "1.500.000");
  assert.equal(parseThousandsInput("1.500.000"), 1_500_000);
});

test("computeAccountBalances ignores pending and cancelled transactions (Vault Invariant)", () => {
  const transactions: Transaction[] = [
    {
      id: "tx-1",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 1_000_000,
      transaction_date: "2026-11-10",
      category: "Belanja",
      description: "Posted & confirmed",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-10T00:00:00Z",
    },
    {
      id: "tx-2",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 2_000_000,
      transaction_date: "2026-11-11",
      category: "Belanja",
      description: "Pending must not deduct",
      status: "pending",
      owner_confirmed: false,
      created_at: "2026-11-11T00:00:00Z",
    },
    {
      id: "tx-3",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 3_000_000,
      transaction_date: "2026-11-12",
      category: "Belanja",
      description: "Cancelled must not deduct",
      status: "cancelled",
      owner_confirmed: true,
      created_at: "2026-11-12T00:00:00Z",
    },
    {
      id: "tx-4",
      owner_id: OWNER,
      transaction_type: "transfer",
      source_account_id: "acc-bca",
      destination_account_id: "acc-gopay",
      amount: 500_000,
      transaction_date: "2026-11-13",
      category: "Transfer Internal",
      description: "Top up GoPay",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-13T00:00:00Z",
    },
  ];

  const balances = computeAccountBalances(accounts, transactions);
  const bca = balances.find((a) => a.id === "acc-bca");
  const gopay = balances.find((a) => a.id === "acc-gopay");

  assert.equal(bca?.current_balance, 8_500_000);
  assert.equal(gopay?.current_balance, 1_000_000);

  const cashflow = computeMonthlyCashflow(transactions, "2026-11");
  assert.equal(cashflow.income, 0);
  assert.equal(cashflow.expense, 1_000_000);
});

test("computeNetWorth calculates (accounts + assets) - active debts", () => {
  const balances = computeAccountBalances(accounts, []);
  const assets: Asset[] = [
    {
      id: "asset-1",
      owner_id: OWNER,
      asset_name: "Emas Antam",
      asset_type: "emas",
      current_value: 5_000_000,
      quantity: 3,
      unit: "gram",
      notes: null,
      created_at: "2026-11-01T00:00:00Z",
    },
  ];
  const debts: Debt[] = [
    {
      id: "debt-1",
      owner_id: OWNER,
      creditor: "Bank KPR",
      original_amount: 10_000_000,
      outstanding_balance: 3_500_000,
      due_date: "2026-12-01",
      status: "active",
      description: null,
      created_at: "2026-11-01T00:00:00Z",
    },
  ];

  const summary = computeNetWorth(balances, assets, debts);
  assert.equal(summary.totalAccountBalance, 10_500_000);
  assert.equal(summary.totalAssetValue, 5_000_000);
  assert.equal(summary.totalDebtBalance, 3_500_000);
  assert.equal(summary.netWorth, 12_000_000);
});

test("computeCashflowSeries aggregates chronological months across year rollover and ignores unconfirmed/cancelled/transfer", () => {
  const txs: Transaction[] = [
    {
      id: "t-dec",
      owner_id: OWNER,
      transaction_type: "income",
      source_account_id: null,
      destination_account_id: "acc-bca",
      amount: 10_000_000,
      transaction_date: "2025-12-20",
      category: "Gaji & Pendapatan",
      description: "Gaji Desember",
      status: "posted",
      owner_confirmed: true,
      created_at: "2025-12-20T00:00:00Z",
    },
    {
      id: "t-jan-exp",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 2_500_000,
      transaction_date: "2026-01-10",
      category: "Utilitas & Tagihan",
      description: "Listrik",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-01-10T00:00:00Z",
    },
    {
      id: "t-feb-pending",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 9_000_000,
      transaction_date: "2026-02-05",
      category: "Belanja",
      description: "Pending must be excluded",
      status: "pending",
      owner_confirmed: false,
      created_at: "2026-02-05T00:00:00Z",
    },
    {
      id: "t-feb-cancelled",
      owner_id: OWNER,
      transaction_type: "income",
      source_account_id: null,
      destination_account_id: "acc-bca",
      amount: 4_000_000,
      transaction_date: "2026-02-07",
      category: "Bonus & Investasi",
      description: "Cancelled must be excluded",
      status: "cancelled",
      owner_confirmed: true,
      created_at: "2026-02-07T00:00:00Z",
    },
    {
      id: "t-feb-transfer",
      owner_id: OWNER,
      transaction_type: "transfer",
      source_account_id: "acc-bca",
      destination_account_id: "acc-gopay",
      amount: 1_500_000,
      transaction_date: "2026-02-12",
      category: "Transfer Internal",
      description: "Transfer must be excluded from cashflow",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-02-12T00:00:00Z",
    },
  ];

  const series = computeCashflowSeries(txs, 3, "2026-02");
  assert.equal(series.length, 3);
  assert.deepEqual(
    series.map((s) => s.monthKey),
    ["2025-12", "2026-01", "2026-02"]
  );
  assert.equal(series[0].label, "Des 2025");
  assert.equal(series[0].income, 10_000_000);
  assert.equal(series[0].expense, 0);
  assert.equal(series[0].net, 10_000_000);

  assert.equal(series[1].income, 0);
  assert.equal(series[1].expense, 2_500_000);
  assert.equal(series[1].net, -2_500_000);

  assert.equal(series[2].income, 0);
  assert.equal(series[2].expense, 0);
  assert.equal(series[2].transactionCount, 0);
});

test("computeCategoryBreakdown groups, sorts, computes percentages, and supports date filters", () => {
  const txs: Transaction[] = [
    {
      id: "e-1",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 600_000,
      transaction_date: "2026-11-05",
      category: "Makanan & Minuman",
      description: "Belanja dapur",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-05T00:00:00Z",
    },
    {
      id: "e-2",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 150_000,
      transaction_date: "2026-11-12",
      category: "Makanan & Minuman",
      description: "Makan siang",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-12T00:00:00Z",
    },
    {
      id: "e-3",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 250_000,
      transaction_date: "2026-11-14",
      category: "Transportasi",
      description: "BBM",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-14T00:00:00Z",
    },
    {
      id: "e-4-pending",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 5_000_000,
      transaction_date: "2026-11-15",
      category: "Belanja",
      description: "Pending excluded",
      status: "posted",
      owner_confirmed: false,
      created_at: "2026-11-15T00:00:00Z",
    },
    {
      id: "e-5-prev-month",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 500_000,
      transaction_date: "2026-10-28",
      category: "Utilitas & Tagihan",
      description: "Internet Oktober",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-10-28T00:00:00Z",
    },
  ];

  const novBreakdown = computeCategoryBreakdown(txs, "expense", {
    yearMonth: "2026-11",
  });
  assert.equal(novBreakdown.totalAmount, 1_000_000);
  assert.equal(novBreakdown.totalCount, 3);
  assert.equal(novBreakdown.items.length, 2);
  assert.deepEqual(novBreakdown.items[0], {
    category: "Makanan & Minuman",
    total: 750_000,
    percentage: 75,
    count: 2,
  });
  assert.deepEqual(novBreakdown.items[1], {
    category: "Transportasi",
    total: 250_000,
    percentage: 25,
    count: 1,
  });

  const rangedBreakdown = computeCategoryBreakdown(txs, "expense", {
    fromDate: "2026-10-01",
    toDate: "2026-11-10",
  });
  assert.equal(rangedBreakdown.totalAmount, 1_100_000);
  assert.equal(rangedBreakdown.items.length, 2);
  assert.equal(rangedBreakdown.items[0].category, "Makanan & Minuman");
  assert.equal(rangedBreakdown.items[1].category, "Utilitas & Tagihan");
});

test("getGreetingID returns natural Indonesian greetings by hour", () => {
  assert.equal(getGreetingID(7), "Selamat pagi");
  assert.equal(getGreetingID(13), "Selamat siang");
  assert.equal(getGreetingID(17), "Selamat sore");
  assert.equal(getGreetingID(21), "Selamat malam");
  assert.equal(getGreetingID(2), "Selamat malam");
});

test("advanceDueDate handles weekly, monthly end-of-month clamping, and yearly", () => {
  assert.equal(advanceDueDate("2026-11-10", "weekly"), "2026-11-17");
  assert.equal(advanceDueDate("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(advanceDueDate("2024-01-31", "monthly"), "2024-02-29");
  assert.equal(advanceDueDate("2026-12-15", "monthly"), "2027-01-15");
  assert.equal(advanceDueDate("2024-02-29", "yearly"), "2025-02-28");
});

test("getDueRecurringBills filters active bills within window and excludes already queued cycles", () => {
  const bills: RecurringBill[] = [
    {
      id: "b-overdue",
      owner_id: OWNER,
      title: "Internet Biznet",
      transaction_type: "expense",
      amount: 375_000,
      category: "Utilitas & Tagihan",
      account_id: "acc-bca",
      frequency: "monthly",
      next_due_date: "2026-11-18",
      last_queued_date: null,
      is_active: true,
      notes: null,
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "b-already-queued",
      owner_id: OWNER,
      title: "Listrik PLN",
      transaction_type: "expense",
      amount: 500_000,
      category: "Utilitas & Tagihan",
      account_id: "acc-bca",
      frequency: "monthly",
      next_due_date: "2026-11-22",
      last_queued_date: "2026-11-22",
      is_active: true,
      notes: null,
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "b-soon",
      owner_id: OWNER,
      title: "Gaji Bulanan",
      transaction_type: "income",
      amount: 12_000_000,
      category: "Gaji & Pendapatan",
      account_id: "acc-bca",
      frequency: "monthly",
      next_due_date: "2026-11-25",
      last_queued_date: null,
      is_active: true,
      notes: null,
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "b-far",
      owner_id: OWNER,
      title: "Pajak Tahunan",
      transaction_type: "expense",
      amount: 2_000_000,
      category: "Utilitas & Tagihan",
      account_id: "acc-bca",
      frequency: "yearly",
      next_due_date: "2026-12-20",
      last_queued_date: null,
      is_active: true,
      notes: null,
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: "b-paused",
      owner_id: OWNER,
      title: "Gym",
      transaction_type: "expense",
      amount: 450_000,
      category: "Belanja",
      account_id: "acc-bca",
      frequency: "monthly",
      next_due_date: "2026-11-21",
      last_queued_date: null,
      is_active: false,
      notes: null,
      created_at: "2026-11-01T00:00:00Z",
    },
  ];

  const due = getDueRecurringBills(bills, "2026-11-20", 7);
  assert.deepEqual(
    due.map((b) => b.id),
    ["b-overdue", "b-soon"]
  );
});

test("computeGoalProgress, estimateGoalCompletionMonths, and computeEmergencyFundMonths compute accurate metrics", () => {
  const balances = computeAccountBalances(accounts, []);
  const manualGoal: SavingsGoal = {
    id: "g-1",
    owner_id: OWNER,
    title: "Liburan Keluarga",
    goal_type: "savings_target",
    target_amount: 20_000_000,
    current_amount: 5_000_000,
    linked_account_id: null,
    target_date: "2027-06-01",
    status: "active",
    notes: null,
    created_at: "2026-11-01T00:00:00Z",
  };
  const linkedGoal: SavingsGoal = {
    id: "g-2",
    owner_id: OWNER,
    title: "Dana Darurat",
    goal_type: "emergency_fund",
    target_amount: 30_000_000,
    current_amount: 0,
    linked_account_id: "acc-bca",
    target_date: null,
    status: "active",
    notes: null,
    created_at: "2026-11-01T00:00:00Z",
  };

  const manualProg = computeGoalProgress(manualGoal);
  assert.equal(manualProg.savedAmount, 5_000_000);
  assert.equal(manualProg.remainingAmount, 15_000_000);
  assert.equal(manualProg.percentage, 25);
  assert.equal(manualProg.isCompleted, false);

  const bcaBalance = balances.find((a) => a.id === "acc-bca");
  const linkedProg = computeGoalProgress(linkedGoal, bcaBalance);
  assert.equal(linkedProg.savedAmount, 10_000_000);
  assert.equal(linkedProg.remainingAmount, 20_000_000);
  assert.equal(linkedProg.percentage, 33.3);

  assert.equal(estimateGoalCompletionMonths(15_000_000, 3_500_000), 5);
  assert.equal(estimateGoalCompletionMonths(15_000_000, 0), null);
  assert.equal(estimateGoalCompletionMonths(0, 3_500_000), 0);

  assert.equal(computeEmergencyFundMonths(10_500_000, 3_000_000), 3.5);
  assert.equal(computeEmergencyFundMonths(10_500_000, 0), null);
});

test("filterTransactions and groupTransactionsByDate handle account filters and today/yesterday grouping", () => {
  const sample: Transaction[] = [
    {
      id: "t-1",
      owner_id: OWNER,
      transaction_type: "expense",
      source_account_id: "acc-bca",
      destination_account_id: null,
      amount: 120_000,
      transaction_date: "2026-11-24",
      category: "Makanan & Minuman",
      description: "Makan Siang",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-24T12:00:00Z",
    },
    {
      id: "t-2",
      owner_id: OWNER,
      transaction_type: "transfer",
      source_account_id: "acc-bca",
      destination_account_id: "acc-gopay",
      amount: 500_000,
      transaction_date: "2026-11-23",
      category: "Transfer Internal",
      description: "Top Up GoPay",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-23T09:00:00Z",
    },
    {
      id: "t-3",
      owner_id: OWNER,
      transaction_type: "income",
      source_account_id: null,
      destination_account_id: "acc-bca",
      amount: 1_000_000,
      transaction_date: "2026-10-15",
      category: "Bonus & Investasi",
      description: "Dividen",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-10-15T10:00:00Z",
    },
  ];

  const gopayOnly = filterTransactions(sample, { accountId: "acc-gopay" });
  assert.deepEqual(gopayOnly.map((t) => t.id), ["t-2"]);

  const searchMakan = filterTransactions(sample, { search: "makan" });
  assert.deepEqual(searchMakan.map((t) => t.id), ["t-1"]);

  const grouped = groupTransactionsByDate(sample, "DD MMM YYYY", "2026-11-24");
  assert.equal(grouped.length, 3);
  assert.ok(grouped[0].label.startsWith("Hari Ini"));
  assert.equal(grouped[0].dayExpense, 120_000);
  assert.ok(grouped[1].label.startsWith("Kemarin"));
});

test("computeBalanceTrend reports hasBaseline=false when prior month has no data and delta when present", () => {
  const onlyCurrent: Transaction[] = [
    {
      id: "t-now",
      owner_id: OWNER,
      transaction_type: "income",
      source_account_id: null,
      destination_account_id: "acc-bca",
      amount: 2_000_000,
      transaction_date: "2026-11-10",
      category: "Gaji",
      description: "Gaji",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-11-10T08:00:00Z",
    },
  ];
  assert.equal(computeBalanceTrend(onlyCurrent, "2026-11").hasBaseline, false);

  const withPrev: Transaction[] = [
    ...onlyCurrent,
    {
      id: "t-prev",
      owner_id: OWNER,
      transaction_type: "income",
      source_account_id: null,
      destination_account_id: "acc-bca",
      amount: 1_000_000,
      transaction_date: "2026-10-10",
      category: "Gaji",
      description: "Gaji Okt",
      status: "posted",
      owner_confirmed: true,
      created_at: "2026-10-10T08:00:00Z",
    },
  ];
  const trend = computeBalanceTrend(withPrev, "2026-11");
  assert.equal(trend.hasBaseline, true);
  assert.equal(trend.deltaAmount, 1_000_000);
  assert.equal(trend.deltaPercent, 100);
});

