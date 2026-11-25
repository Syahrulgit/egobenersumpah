import {
  computeAverageMonthlyCashflow,
  computeEmergencyFundMonths,
  computeGoalProgress,
  computeNetWorth,
  estimateGoalCompletionMonths,
  formatIDR,
  roundCurrency,
  todayISO,
} from "./finance";
import { effectiveMonthlyInstallment } from "./debt-manager";
import { computeCashflowForecast } from "./cashflow-forecast";
import type {
  AccountBalance,
  Asset,
  CategoryBudget,
  Debt,
  FinancialReminder,
  GoalScenarioKey,
  RecurringBill,
  SavingsGoal,
  Transaction,
  WhatIfRiskLevel,
  WhatIfScenarioParams,
  WhatIfScenarioType,
  WhatIfSimulationResult,
  WhatIfVariantOutcome,
} from "../types/ego";

export function whatIfScenarioTypeLabel(type: WhatIfScenarioType): string {
  switch (type) {
    case "cash_purchase":
      return "Beli Barang Tunai";
    case "installment_purchase":
      return "Beli Barang Cicilan";
    case "new_loan":
      return "Ajukan Pinjaman Baru";
    case "accelerated_debt_payoff":
      return "Percepat Pelunasan Utang";
    case "income_change":
      return "Perubahan Penghasilan";
    case "living_cost_change":
      return "Perubahan Biaya Hidup";
    case "savings_boost":
      return "Tambah Setoran Tabungan";
    case "goal_milestone":
      return "Simulasi Target Finansial";
  }
}

export function computeAmortizedMonthlyPayment(
  principal: number,
  tenorMonths: number,
  annualInterestPct: number
): number {
  const P = Math.max(0, Number(principal) || 0);
  const n = Math.max(1, Math.round(Number(tenorMonths) || 1));
  if (P <= 0) return 0;
  const r = Math.max(0, Number(annualInterestPct) || 0) / 100 / 12;
  if (r === 0) return roundCurrency(P / n);
  const factor = Math.pow(1 + r, n);
  return roundCurrency((P * r * factor) / (factor - 1));
}

function classifyWhatIfRisk(options: {
  afterImmediateBalance: number;
  after30dBalance: number;
  after90dBalance: number;
  monthlyCashflowAfter: number;
  emergencyMonthsAfter: number | null;
  beforeEmergencyMonths: number | null;
}): WhatIfRiskLevel {
  if (
    options.afterImmediateBalance < 0 ||
    options.after30dBalance < 0 ||
    options.after90dBalance < 0 ||
    options.monthlyCashflowAfter < 0
  ) {
    return "berisiko";
  }
  if (
    (options.emergencyMonthsAfter !== null && options.emergencyMonthsAfter < 2) ||
    (options.beforeEmergencyMonths !== null &&
      options.emergencyMonthsAfter !== null &&
      options.emergencyMonthsAfter < options.beforeEmergencyMonths * 0.6)
  ) {
    return "waspada";
  }
  if (
    options.after30dBalance < 500_000 ||
    (options.monthlyCashflowAfter > 0 && options.monthlyCashflowAfter < 250_000)
  ) {
    return "waspada";
  }
  return "aman";
}

export function runWhatIfSimulation(options: {
  params: WhatIfScenarioParams;
  accounts: AccountBalance[];
  transactions: Transaction[];
  assets: Asset[];
  debts: Debt[];
  recurringBills: RecurringBill[];
  financialReminders: FinancialReminder[];
  savingsGoals: SavingsGoal[];
  categoryBudgets: CategoryBudget[];
  referenceDateISO?: string;
}): WhatIfSimulationResult {
  const refDate = (options.referenceDateISO ?? todayISO()).slice(0, 10);
  const currentMonth = refDate.slice(0, 7);
  const p = options.params;

  const netWorth = computeNetWorth(options.accounts, options.assets, options.debts);
  const avgCashflow = computeAverageMonthlyCashflow(
    options.transactions,
    3,
    currentMonth
  );

  // Use forecast baseline 30d & 90d so scheduled bills/debts are reflected accurately
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

  const beforeBalance = netWorth.totalAccountBalance;
  const baselineMonthlyExpense =
    avgCashflow.avgExpense > 0
      ? avgCashflow.avgExpense
      : roundCurrency(forecast30.totalPredictedExpense);
  const baselineMonthlyIncome =
    avgCashflow.avgIncome > 0
      ? avgCashflow.avgIncome
      : roundCurrency(forecast30.totalPredictedIncome);
  const monthlyCashflowBefore = roundCurrency(
    baselineMonthlyIncome - baselineMonthlyExpense
  );
  const debtBefore = netWorth.totalDebtBalance;
  const emergencyMonthsBefore = computeEmergencyFundMonths(
    beforeBalance,
    baselineMonthlyExpense
  );

  const amt = Math.max(0, roundCurrency(Number(p.amount) || 0));
  const tenor = Math.max(1, Math.round(Number(p.tenor_months) || 1));
  const rate = Math.max(0, Number(p.annual_interest_pct) || 0);
  const monthlyDeltaInput = roundCurrency(Number(p.monthly_delta) || 0);

  let immediateBalanceDelta = 0;
  let monthlyCashflowDelta = 0;
  let debtDelta = 0;
  let monthlyDebtInstallmentDelta = 0;
  let monthlyExpenseDelta = 0;

  switch (p.scenario_type) {
    case "cash_purchase": {
      immediateBalanceDelta = -amt;
      break;
    }
    case "installment_purchase": {
      const installment = computeAmortizedMonthlyPayment(amt, tenor, rate);
      debtDelta = amt;
      monthlyDebtInstallmentDelta = installment;
      monthlyCashflowDelta = -installment;
      monthlyExpenseDelta = installment;
      break;
    }
    case "new_loan": {
      const installment = computeAmortizedMonthlyPayment(amt, tenor, rate);
      immediateBalanceDelta = amt; // cash received upfront
      debtDelta = amt;
      monthlyDebtInstallmentDelta = installment;
      monthlyCashflowDelta = -installment;
      monthlyExpenseDelta = installment;
      break;
    }
    case "accelerated_debt_payoff": {
      const targetDebt = p.target_debt_id
        ? options.debts.find((d) => d.id === p.target_debt_id)
        : options.debts.find((d) => d.status === "active" && d.outstanding_balance > 0);
      const effectivePay = targetDebt
        ? Math.min(amt, targetDebt.outstanding_balance)
        : Math.min(amt, debtBefore);
      immediateBalanceDelta = -effectivePay;
      debtDelta = -effectivePay;
      if (targetDebt && effectivePay >= targetDebt.outstanding_balance) {
        const freed = effectiveMonthlyInstallment(targetDebt).monthlyAmount;
        monthlyDebtInstallmentDelta = -freed;
        monthlyCashflowDelta = freed;
        monthlyExpenseDelta = -freed;
      } else if (monthlyDeltaInput > 0) {
        monthlyDebtInstallmentDelta = monthlyDeltaInput;
        monthlyCashflowDelta = -monthlyDeltaInput;
        monthlyExpenseDelta = monthlyDeltaInput;
      }
      break;
    }
    case "income_change": {
      monthlyCashflowDelta = monthlyDeltaInput;
      break;
    }
    case "living_cost_change": {
      // Positive monthlyDeltaInput means living cost increases (or user enters +500rb = cost up 500rb)
      monthlyExpenseDelta = monthlyDeltaInput;
      monthlyCashflowDelta = -monthlyDeltaInput;
      break;
    }
    case "savings_boost": {
      const boost = Math.max(0, monthlyDeltaInput || amt);
      // Savings boost transfers from spendable cashflow into reserve
      monthlyCashflowDelta = -boost;
      break;
    }
    case "goal_milestone": {
      immediateBalanceDelta = -amt;
      break;
    }
  }

  const afterImmediateBalance = roundCurrency(beforeBalance + immediateBalanceDelta);
  const monthlyCashflowAfter = roundCurrency(monthlyCashflowBefore + monthlyCashflowDelta);
  const debtAfter = Math.max(0, roundCurrency(debtBefore + debtDelta));
  const after30dBalance = roundCurrency(
    forecast30.endingBalance + immediateBalanceDelta + monthlyCashflowDelta
  );
  const after90dBalance = roundCurrency(
    forecast90.endingBalance + immediateBalanceDelta + monthlyCashflowDelta * 3
  );

  const effectiveMonthlyExpenseAfter = Math.max(
    0,
    roundCurrency(baselineMonthlyExpense + monthlyExpenseDelta)
  );
  const emergencyMonthsAfter = computeEmergencyFundMonths(
    Math.max(0, afterImmediateBalance),
    effectiveMonthlyExpenseAfter
  );

  // Impact on active goals
  const accountMap = new Map(options.accounts.map((a) => [a.id, a]));
  const primaryGoal =
    (p.target_goal_id
      ? options.savingsGoals.find((g) => g.id === p.target_goal_id)
      : undefined) ??
    options.savingsGoals.find((g) => g.status === "active");

  let goalEtaImpactMonths: number | null = null;
  if (primaryGoal) {
    const progress = computeGoalProgress(
      primaryGoal,
      primaryGoal.linked_account_id
        ? accountMap.get(primaryGoal.linked_account_id)
        : undefined
    );
    if (!progress.isCompleted) {
      const effectiveMonthlySavingBefore = Math.max(0, monthlyCashflowBefore);
      const effectiveMonthlySavingAfter =
        p.scenario_type === "savings_boost"
          ? Math.max(0, monthlyCashflowBefore + Math.max(0, monthlyDeltaInput || amt))
          : Math.max(0, monthlyCashflowAfter);
      const beforeMonths = estimateGoalCompletionMonths(
        progress.remainingAmount,
        effectiveMonthlySavingBefore
      );
      const afterMonths = estimateGoalCompletionMonths(
        progress.remainingAmount,
        effectiveMonthlySavingAfter
      );
      if (beforeMonths !== null && afterMonths !== null) {
        goalEtaImpactMonths = afterMonths - beforeMonths;
      }
    }
  }

  // Budget & debt notes
  const budgetImpactNotes: string[] = [];
  const activeBudgets = options.categoryBudgets.filter(
    (b) => b.is_active && b.period_month === currentMonth
  );
  const totalBudgetLimit = activeBudgets.reduce((s, b) => s + b.limit_amount, 0);
  if (monthlyExpenseDelta > 0) {
    budgetImpactNotes.push(
      `Beban bulanan tetap bertambah ${formatIDR(monthlyExpenseDelta)}/bln${
        totalBudgetLimit > 0
          ? ` (${Math.round((monthlyExpenseDelta / totalBudgetLimit) * 100)}% dari total batas anggaran bulan ini)`
          : ""
      }.`
    );
  } else if (monthlyExpenseDelta < 0) {
    budgetImpactNotes.push(
      `Ruang anggaran bulanan lega sebesar ${formatIDR(Math.abs(monthlyExpenseDelta))}/bln.`
    );
  }
  if (immediateBalanceDelta < 0 && beforeBalance > 0) {
    const pctCash = Math.round((Math.abs(immediateBalanceDelta) / beforeBalance) * 100);
    budgetImpactNotes.push(
      `Pengeluaran tunai langsung memakai ${pctCash}% dari saldo likuid saat ini.`
    );
  }
  if (budgetImpactNotes.length === 0) {
    budgetImpactNotes.push(
      "Skenario tidak menambah beban cicilan tetap bulanan pada anggaran kategori."
    );
  }

  const riskLevel = classifyWhatIfRisk({
    afterImmediateBalance,
    after30dBalance,
    after90dBalance,
    monthlyCashflowAfter,
    emergencyMonthsAfter,
    beforeEmergencyMonths: emergencyMonthsBefore,
  });

  // Conservative / Normal / Optimistic variants
  // Conservative: -15% surplus buffer or +10% cost overrun; Optimistic: +15% surplus / cost discipline
  const buildVariant = (key: GoalScenarioKey): WhatIfVariantOutcome => {
    const label =
      key === "conservative"
        ? "Konservatif"
        : key === "normal"
          ? "Normal"
          : "Optimistis";
    const multiplier =
      key === "conservative" ? -0.15 : key === "optimistic" ? 0.15 : 0;
    const baseExpenseRef = Math.max(100_000, baselineMonthlyExpense);
    const bufferShiftMonthly = roundCurrency(baseExpenseRef * multiplier);
    const vMonthlyAfter = roundCurrency(monthlyCashflowAfter + bufferShiftMonthly);
    const v30 = roundCurrency(after30dBalance + bufferShiftMonthly);
    const v90 = roundCurrency(after90dBalance + bufferShiftMonthly * 3);
    const vEm = computeEmergencyFundMonths(
      Math.max(0, v30),
      effectiveMonthlyExpenseAfter
    );
    const vRisk = classifyWhatIfRisk({
      afterImmediateBalance,
      after30dBalance: v30,
      after90dBalance: v90,
      monthlyCashflowAfter: vMonthlyAfter,
      emergencyMonthsAfter: vEm,
      beforeEmergencyMonths: emergencyMonthsBefore,
    });
    return {
      key,
      label,
      projectedBalance30d: v30,
      projectedBalance90d: v90,
      monthlyCashflowAfter: vMonthlyAfter,
      emergencyMonthsAfter: vEm,
      riskLevel: vRisk,
    };
  };

  const variants: Record<GoalScenarioKey, WhatIfVariantOutcome> = {
    conservative: buildVariant("conservative"),
    normal: buildVariant("normal"),
    optimistic: buildVariant("optimistic"),
  };

  let verdict = "";
  if (riskLevel === "aman") {
    verdict =
      "Skenario layak dijalankan: saldo likuid dan arus kas bulanan tetap positif dengan ketahanan dana yang terjaga.";
  } else if (riskLevel === "waspada") {
    verdict =
      "Perlu kehati-hatian: skenario dapat dijalankan tetapi menekan margin surplus atau menipiskan penyangga dana darurat.";
  } else {
    verdict =
      "Berisiko tinggi: skenario berpotensi memicu defisit kas dalam 30–90 hari atau membuat arus kas bulanan negatif.";
  }

  const recommendations: string[] = [];
  if (riskLevel === "berisiko") {
    recommendations.push(
      "Tunda keputusan ini atau kecilkan nominal/tenor agar proyeksi saldo 30–90 hari tidak minus."
    );
  }
  if (
    emergencyMonthsAfter !== null &&
    emergencyMonthsAfter < 3
  ) {
    recommendations.push(
      `Jaga dana darurat minimal 3 bulan beban (${formatIDR(effectiveMonthlyExpenseAfter * 3)}) sebelum menambah komitmen baru.`
    );
  }
  if (p.scenario_type === "installment_purchase" || p.scenario_type === "new_loan") {
    const payment = computeAmortizedMonthlyPayment(amt, tenor, rate);
    recommendations.push(
      `Pastikan cicilan simulasi ${formatIDR(payment)}/bln tidak mendorong rasio cicilan di atas 30% pemasukan bulanan.`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Simulasi berada pada zona aman; eksekusi transaksi aktual tetap wajib melalui konfirmasi eksplisit Owner."
    );
  }

  return {
    beforeBalance,
    afterImmediateBalance,
    after30dBalance,
    after90dBalance,
    monthlyCashflowBefore,
    monthlyCashflowAfter,
    debtBefore,
    debtAfter,
    monthlyDebtInstallmentDelta,
    emergencyMonthsBefore,
    emergencyMonthsAfter,
    goalEtaImpactMonths,
    budgetImpactNotes,
    riskLevel,
    verdict,
    recommendations,
    variants,
  };
}
