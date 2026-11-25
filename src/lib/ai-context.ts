import { summarizeBudgetMonth } from "./budgets";
import { computeCashflowForecast } from "./cashflow-forecast";
import { compareDebtStrategies } from "./debt-manager";
import {
  computeAverageMonthlyCashflow,
  computeMonthlyCashflow,
  computeNetWorth,
  formatIDR,
  todayISO,
} from "./finance";
import { summarizeGoalsForDashboard } from "./goal-simulator";
import { computeFinancialHealthScore } from "./health-score";
import type {
  AccountBalance,
  Asset,
  BudgetAlertLog,
  CategoryBudget,
  Debt,
  FinancialReminder,
  RecurringBill,
  SavingsGoal,
  Transaction,
  WhatIfScenarioRecord,
} from "../types/ego";

export interface EgoAiContextDigest {
  reference_date: string;
  data_aktual: {
    active_accounts_count: number;
    liquid_balance_idr: number;
    total_assets_idr: number;
    total_active_debt_idr: number;
    active_debts_count: number;
    overdue_debts_count: number;
    net_worth_idr: number;
    current_month: string;
    current_month_confirmed_income_idr: number;
    current_month_confirmed_expense_idr: number;
    avg_3m_income_idr: number;
    avg_3m_expense_idr: number;
    avg_3m_net_idr: number;
    active_budgets_count: number;
    budget_total_limit_idr: number;
    budget_total_spent_idr: number;
    budget_alert_categories: string[];
    health_score: number | null;
    health_grade: string;
  };
  data_estimasi: {
    forecast_30d_ending_balance_idr: number;
    forecast_30d_scheduled_income_idr: number;
    forecast_30d_scheduled_expense_idr: number;
    forecast_30d_estimated_expense_idr: number;
    forecast_30d_lowest_balance_idr: number;
    forecast_30d_deficit_days: number;
    forecast_30d_first_deficit_date: string | null;
    forecast_90d_ending_balance_idr: number;
    forecast_confidence: string;
  };
  simulasi_tersedia: {
    recommended_debt_strategy: "snowball" | "avalanche" | null;
    snowball_months_to_free: number | null;
    avalanche_months_to_free: number | null;
    avalanche_interest_saved_vs_min_idr: number;
    active_goals_count: number;
    goal_overall_progress_pct: number;
    saved_whatif_scenarios: Array<{
      title: string;
      scenario_type: string;
      risk_level: string;
      after_30d_balance_idr: number;
      verdict: string;
    }>;
  };
  data_belum_lengkap: string[];
}

export function buildEgoAiContextDigest(options: {
  accounts: AccountBalance[];
  transactions: Transaction[];
  assets: Asset[];
  debts: Debt[];
  recurringBills: RecurringBill[];
  financialReminders: FinancialReminder[];
  savingsGoals: SavingsGoal[];
  categoryBudgets: CategoryBudget[];
  budgetAlertLogs?: BudgetAlertLog[];
  whatIfScenarios?: WhatIfScenarioRecord[];
  referenceDateISO?: string;
}): EgoAiContextDigest {
  const refDate = (options.referenceDateISO ?? todayISO()).slice(0, 10);
  const currentMonth = refDate.slice(0, 7);

  const netWorth = computeNetWorth(options.accounts, options.assets, options.debts);
  const currentMonthCf = computeMonthlyCashflow(options.transactions, currentMonth);
  const avg3 = computeAverageMonthlyCashflow(options.transactions, 3, currentMonth);
  const budgetSummary = summarizeBudgetMonth(
    options.categoryBudgets,
    options.transactions,
    currentMonth,
    options.budgetAlertLogs ?? []
  );
  const forecast30 = computeCashflowForecast({
    accounts: options.accounts,
    transactions: options.transactions,
    recurringBills: options.recurringBills,
    financialReminders: options.financialReminders,
    debts: options.debts,
    categoryBudgets: options.categoryBudgets,
    horizonDays: 30,
    referenceDateISO: refDate,
  });
  const forecast90 = computeCashflowForecast({
    accounts: options.accounts,
    transactions: options.transactions,
    recurringBills: options.recurringBills,
    financialReminders: options.financialReminders,
    debts: options.debts,
    categoryBudgets: options.categoryBudgets,
    horizonDays: 90,
    referenceDateISO: refDate,
  });
  const debtCmp = compareDebtStrategies({
    debts: options.debts,
    extraMonthlyPayment: Math.max(0, Math.round(avg3.avgNet * 0.25)),
    monthlyNetSurplus: avg3.avgNet,
    referenceDateISO: refDate,
  });
  const goalSummary = summarizeGoalsForDashboard(
    options.savingsGoals,
    options.accounts,
    avg3.avgNet
  );
  const health = computeFinancialHealthScore({
    accounts: options.accounts,
    transactions: options.transactions,
    assets: options.assets,
    debts: options.debts,
    categoryBudgets: options.categoryBudgets,
    budgetAlertLogs: options.budgetAlertLogs,
    savingsGoals: options.savingsGoals,
    referenceDateISO: refDate,
  });

  const missingData = [...health.missingIndicators];
  if (options.accounts.filter((a) => a.is_active).length === 0) {
    missingData.unshift("Akun kas/bank aktif belum terdaftar");
  }
  if (options.recurringBills.filter((b) => b.is_active).length === 0) {
    missingData.push("Jadwal pemasukan/tagihan rutin belum didaftarkan untuk proyeksi presisi");
  }

  return {
    reference_date: refDate,
    data_aktual: {
      active_accounts_count: options.accounts.filter((a) => a.is_active).length,
      liquid_balance_idr: netWorth.totalAccountBalance,
      total_assets_idr: netWorth.totalAssetValue,
      total_active_debt_idr: netWorth.totalDebtBalance,
      active_debts_count: debtCmp.activeDebtCount,
      overdue_debts_count: debtCmp.overdueDebtCount,
      net_worth_idr: netWorth.netWorth,
      current_month: currentMonth,
      current_month_confirmed_income_idr: currentMonthCf.income,
      current_month_confirmed_expense_idr: currentMonthCf.expense,
      avg_3m_income_idr: avg3.avgIncome,
      avg_3m_expense_idr: avg3.avgExpense,
      avg_3m_net_idr: avg3.avgNet,
      active_budgets_count: budgetSummary.activeCount,
      budget_total_limit_idr: budgetSummary.totalBudget,
      budget_total_spent_idr: budgetSummary.totalSpentBudgeted,
      budget_alert_categories: budgetSummary.alertCategories.map(
        (b) => `${b.budget.category} (${b.usagePct.toFixed(0)}%)`
      ),
      health_score: health.totalScore,
      health_grade: health.grade,
    },
    data_estimasi: {
      forecast_30d_ending_balance_idr: forecast30.endingBalance,
      forecast_30d_scheduled_income_idr: forecast30.scheduledIncome,
      forecast_30d_scheduled_expense_idr: forecast30.scheduledExpense,
      forecast_30d_estimated_expense_idr: forecast30.estimatedExpense,
      forecast_30d_lowest_balance_idr: forecast30.lowestBalance,
      forecast_30d_deficit_days: forecast30.deficitDaysCount,
      forecast_30d_first_deficit_date: forecast30.firstDeficitDateISO,
      forecast_90d_ending_balance_idr: forecast90.endingBalance,
      forecast_confidence: forecast30.confidenceLabel,
    },
    simulasi_tersedia: {
      recommended_debt_strategy:
        debtCmp.activeDebtCount > 0 ? debtCmp.recommendedStrategy : null,
      snowball_months_to_free: debtCmp.snowball.monthsToDebtFree,
      avalanche_months_to_free: debtCmp.avalanche.monthsToDebtFree,
      avalanche_interest_saved_vs_min_idr: debtCmp.avalancheInterestSavedVsMin,
      active_goals_count: goalSummary.activeGoalsCount,
      goal_overall_progress_pct: goalSummary.overallProgressPct,
      saved_whatif_scenarios: (options.whatIfScenarios ?? []).slice(0, 5).map((s) => ({
        title: s.title,
        scenario_type: s.scenario_type,
        risk_level: s.risk_level,
        after_30d_balance_idr: s.result_summary.after30dBalance,
        verdict: s.result_summary.verdict,
      })),
    },
    data_belum_lengkap: Array.from(new Set(missingData)),
  };
}

export function formatContextBriefForPrompt(digest: EgoAiContextDigest): string {
  const d = digest.data_aktual;
  const e = digest.data_estimasi;
  const s = digest.simulasi_tersedia;

  return [
    `Tanggal referensi: ${digest.reference_date}`,
    `[DATA AKTUAL TERVERIFIKASI OWNER]`,
    `- Akun aktif: ${d.active_accounts_count}, Saldo likuid total: ${formatIDR(d.liquid_balance_idr)}`,
    `- Total aset: ${formatIDR(d.total_assets_idr)}, Total utang aktif (${d.active_debts_count} akun, ${d.overdue_debts_count} terlambat): ${formatIDR(d.total_active_debt_idr)}`,
    `- Kekayaan bersih: ${formatIDR(d.net_worth_idr)}`,
    `- Bulan ${d.current_month}: Pemasukan terkonfirmasi ${formatIDR(d.current_month_confirmed_income_idr)}, Pengeluaran terkonfirmasi ${formatIDR(d.current_month_confirmed_expense_idr)}`,
    `- Rata-rata 3 bln: Masuk ${formatIDR(d.avg_3m_income_idr)}/bln, Keluar ${formatIDR(d.avg_3m_expense_idr)}/bln, Surplus ${formatIDR(d.avg_3m_net_idr)}/bln`,
    `- Smart Budget (${d.active_budgets_count} aktif): Terpakai ${formatIDR(d.budget_total_spent_idr)} dari batas ${formatIDR(d.budget_total_limit_idr)}${d.budget_alert_categories.length > 0 ? ` · Perhatian: ${d.budget_alert_categories.join(", ")}` : ""}`,
    `- Financial Health Score: ${d.health_score !== null ? `${d.health_score}/100 (${d.health_grade})` : "Belum Cukup Data"}`,
    ``,
    `[DATA ESTIMASI FORECAST]`,
    `- Proyeksi saldo akhir 30 hari: ${formatIDR(e.forecast_30d_ending_balance_idr)} (Terjadwal masuk ${formatIDR(e.forecast_30d_scheduled_income_idr)}, Terjadwal keluar ${formatIDR(e.forecast_30d_scheduled_expense_idr)}, Estimasi keluar variabel ${formatIDR(e.forecast_30d_estimated_expense_idr)})`,
    `- Titik saldo terendah 30 hari: ${formatIDR(e.forecast_30d_lowest_balance_idr)}${e.forecast_30d_first_deficit_date ? ` · Risiko defisit ${e.forecast_30d_deficit_days} hari mulai ${e.forecast_30d_first_deficit_date}` : " · Tidak ada hari defisit"}`,
    `- Proyeksi saldo akhir 90 hari: ${formatIDR(e.forecast_90d_ending_balance_idr)} · Tingkat keyakinan: ${e.forecast_confidence}`,
    ``,
    `[HASIL SIMULASI TERSEDIA]`,
    `- Utang: ${s.recommended_debt_strategy ? `Rekomendasi ${s.recommended_debt_strategy.toUpperCase()} (Snowball ${s.snowball_months_to_free ?? "—"} bln, Avalanche ${s.avalanche_months_to_free ?? "—"} bln, hemat bunga ${formatIDR(s.avalanche_interest_saved_vs_min_idr)})` : "Tidak ada simulasi pelunasan utang aktif"}`,
    `- Target tabungan aktif: ${s.active_goals_count} target (progres ${s.goal_overall_progress_pct}%)`,
    `- Skenario What-If tersimpan (${s.saved_whatif_scenarios.length}): ${
      s.saved_whatif_scenarios.length > 0
        ? s.saved_whatif_scenarios
            .map((sc) => `${sc.title} [${sc.risk_level}, saldo 30h ${formatIDR(sc.after_30d_balance_idr)}]`)
            .join("; ")
        : "Belum ada skenario What-If tersimpan"
    }`,
    ``,
    `[DATA BELUM LENGKAP / JANGAN DIKARANG]`,
    digest.data_belum_lengkap.length > 0
      ? digest.data_belum_lengkap.map((m) => `- ${m}`).join("\n")
      : "- Semua komponen utama tersedia.",
  ].join("\n");
}
