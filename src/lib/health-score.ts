import { summarizeBudgetMonth } from "./budgets";
import { effectiveMonthlyInstallment } from "./debt-manager";
import {
  computeAverageMonthlyCashflow,
  computeCashflowSeries,
  computeEmergencyFundMonths,
  computeGoalProgress,
  computeNetWorth,
  formatIDR,
  todayISO,
} from "./finance";
import type {
  AccountBalance,
  Asset,
  BudgetAlertLog,
  CategoryBudget,
  Debt,
  FinancialHealthScoreResult,
  HealthScoreComponent,
  HealthScoreGrade,
  SavingsGoal,
  Transaction,
} from "../types/ego";

export const HEALTH_SCORE_WEIGHTS = {
  cashflow_stability: 20,
  savings_ratio: 15,
  debt_to_asset_ratio: 15,
  installment_burden: 15,
  emergency_fund: 15,
  budget_discipline: 10,
  goal_progress: 10,
} as const;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function classifyHealthGrade(score: number | null): HealthScoreGrade {
  if (score === null) return "Belum Cukup Data";
  if (score >= 85) return "Prima";
  if (score >= 70) return "Sehat";
  if (score >= 55) return "Cukup";
  if (score >= 40) return "Perlu Perhatian";
  return "Rentan";
}

export function computeFinancialHealthScore(options: {
  accounts: AccountBalance[];
  transactions: Transaction[];
  assets: Asset[];
  debts: Debt[];
  categoryBudgets: CategoryBudget[];
  budgetAlertLogs?: BudgetAlertLog[];
  savingsGoals: SavingsGoal[];
  referenceDateISO?: string;
}): FinancialHealthScoreResult {
  const refDate = (options.referenceDateISO ?? todayISO()).slice(0, 10);
  const periodMonth = refDate.slice(0, 7);

  const netWorth = computeNetWorth(options.accounts, options.assets, options.debts);
  const activeAccounts = options.accounts.filter((a) => a.is_active);
  const series3 = computeCashflowSeries(options.transactions, 3, periodMonth);
  const avg3 = computeAverageMonthlyCashflow(options.transactions, 3, periodMonth);
  const activeMonths = series3.filter((m) => m.transactionCount > 0);
  const hasIncomeHistory = avg3.avgIncome > 0;
  const hasExpenseHistory = avg3.avgExpense > 0;
  const hasLiquidAccount = activeAccounts.length > 0;
  const activeDebts = options.debts.filter(
    (d) => d.status === "active" && d.outstanding_balance > 0
  );

  const components: HealthScoreComponent[] = [];
  const missingIndicators: string[] = [];

  // 1. Stabilitas Arus Kas (20%) — measures positive net cashflow months & surplus consistency
  if (activeMonths.length === 0 || (!hasIncomeHistory && !hasExpenseHistory)) {
    missingIndicators.push(
      "Stabilitas Arus Kas (butuh minimal 1 bulan transaksi terkonfirmasi)"
    );
    components.push({
      key: "cashflow_stability",
      label: "Stabilitas Arus Kas",
      weight: HEALTH_SCORE_WEIGHTS.cashflow_stability,
      score: null,
      available: false,
      rawValueLabel: "Belum tersedia",
      targetLabel: "Arus kas bersih positif tiap bulan",
      explanation:
        "Menilai seberapa konsisten pemasukan melampaui pengeluaran selama hingga 3 bulan terakhir.",
      impact: "missing",
    });
  } else {
    const positiveMonths = activeMonths.filter((m) => m.net >= 0).length;
    const positiveRatio = positiveMonths / activeMonths.length;
    const netMarginPct =
      avg3.avgIncome > 0
        ? (avg3.avgNet / avg3.avgIncome) * 100
        : avg3.avgNet >= 0
          ? 20
          : -50;
    const marginComponent =
      netMarginPct >= 20
        ? 100
        : netMarginPct >= 0
          ? 50 + (netMarginPct / 20) * 50
          : Math.max(0, 45 + netMarginPct);
    const score = clampScore(positiveRatio * 50 + marginComponent * 0.5);
    components.push({
      key: "cashflow_stability",
      label: "Stabilitas Arus Kas",
      weight: HEALTH_SCORE_WEIGHTS.cashflow_stability,
      score,
      available: true,
      rawValueLabel: `${positiveMonths}/${activeMonths.length} bln surplus (${formatIDR(
        avg3.avgNet,
        true
      )}/bln)`,
      targetLabel: "Surplus konsisten ≥ 10% pemasukan",
      explanation:
        "Diukur dari rasio bulan bersaldo arus kas positif dan margin surplus rata-rata.",
      impact: score >= 75 ? "positive" : score >= 50 ? "neutral" : "negative",
    });
  }

  // 2. Rasio Tabungan / Saving Rate (15%)
  if (!hasIncomeHistory) {
    missingIndicators.push(
      "Rasio Tabungan (belum ada transaksi pemasukan terkonfirmasi)"
    );
    components.push({
      key: "savings_ratio",
      label: "Rasio Tabungan",
      weight: HEALTH_SCORE_WEIGHTS.savings_ratio,
      score: null,
      available: false,
      rawValueLabel: "Belum tersedia",
      targetLabel: "Minimal 20% dari pemasukan",
      explanation:
        "Persentase sisa pemasukan bersih yang berhasil dipertahankan setelah pengeluaran.",
      impact: "missing",
    });
  } else {
    const savingRate = (avg3.avgNet / avg3.avgIncome) * 100;
    let score: number;
    if (savingRate >= 30) score = 100;
    else if (savingRate >= 20) score = 80 + ((savingRate - 20) / 10) * 20;
    else if (savingRate >= 10) score = 60 + ((savingRate - 10) / 10) * 20;
    else if (savingRate >= 0) score = 30 + (savingRate / 10) * 30;
    else score = Math.max(0, 30 + savingRate);
    score = clampScore(score);

    components.push({
      key: "savings_ratio",
      label: "Rasio Tabungan",
      weight: HEALTH_SCORE_WEIGHTS.savings_ratio,
      score,
      available: true,
      rawValueLabel: `${savingRate.toFixed(1)}% dari pemasukan`,
      targetLabel: "≥ 20% pemasukan tersimpan",
      explanation:
        "Rasio surplus bersih rata-rata dibandingkan rata-rata pemasukan bulanan terkonfirmasi.",
      impact: score >= 75 ? "positive" : score >= 50 ? "neutral" : "negative",
    });
  }

  // 3. Rasio Utang terhadap Aset & Kas (15%)
  const grossWealth = Math.max(
    0,
    netWorth.totalAccountBalance + netWorth.totalAssetValue
  );
  if (!hasLiquidAccount && options.assets.length === 0 && options.debts.length === 0) {
    missingIndicators.push("Rasio Utang terhadap Aset (belum ada akun, aset, atau utang)");
    components.push({
      key: "debt_to_asset_ratio",
      label: "Rasio Utang / Aset",
      weight: HEALTH_SCORE_WEIGHTS.debt_to_asset_ratio,
      score: null,
      available: false,
      rawValueLabel: "Belum tersedia",
      targetLabel: "≤ 30% dari total kas & aset",
      explanation:
        "Perbandingan total sisa pokok utang aktif terhadap total saldo likuid ditambah nilai aset.",
      impact: "missing",
    });
  } else if (netWorth.totalDebtBalance === 0) {
    components.push({
      key: "debt_to_asset_ratio",
      label: "Rasio Utang / Aset",
      weight: HEALTH_SCORE_WEIGHTS.debt_to_asset_ratio,
      score: 100,
      available: true,
      rawValueLabel: "0% (Bebas Utang Aktif)",
      targetLabel: "≤ 30% dari total kas & aset",
      explanation: "Tidak ada kewajiban utang aktif yang membebani kekayaan bersih.",
      impact: "positive",
    });
  } else if (grossWealth <= 0) {
    components.push({
      key: "debt_to_asset_ratio",
      label: "Rasio Utang / Aset",
      weight: HEALTH_SCORE_WEIGHTS.debt_to_asset_ratio,
      score: 10,
      available: true,
      rawValueLabel: "> 100% (Utang melebihi kas & aset)",
      targetLabel: "≤ 30% dari total kas & aset",
      explanation: "Utang aktif saat ini belum diimbangi saldo kas atau aset tercatat.",
      impact: "negative",
    });
  } else {
    const ratioPct = (netWorth.totalDebtBalance / grossWealth) * 100;
    let score: number;
    if (ratioPct <= 15) score = 100;
    else if (ratioPct <= 30) score = 80 + ((30 - ratioPct) / 15) * 20;
    else if (ratioPct <= 50) score = 55 + ((50 - ratioPct) / 20) * 25;
    else if (ratioPct <= 100) score = 20 + ((100 - ratioPct) / 50) * 35;
    else score = 10;
    score = clampScore(score);

    components.push({
      key: "debt_to_asset_ratio",
      label: "Rasio Utang / Aset",
      weight: HEALTH_SCORE_WEIGHTS.debt_to_asset_ratio,
      score,
      available: true,
      rawValueLabel: `${ratioPct.toFixed(1)}%`,
      targetLabel: "≤ 30% dari total kas & aset",
      explanation: "Persentase total sisa pokok utang dibanding total kas & aset aktif.",
      impact: score >= 75 ? "positive" : score >= 50 ? "neutral" : "negative",
    });
  }

  // 4. Beban Cicilan terhadap Pemasukan (15%)
  if (!hasIncomeHistory && activeDebts.length > 0) {
    missingIndicators.push(
      "Beban Cicilan / Pemasukan (butuh catatan pemasukan untuk menghitung rasio DSR)"
    );
    components.push({
      key: "installment_burden",
      label: "Beban Cicilan (DSR)",
      weight: HEALTH_SCORE_WEIGHTS.installment_burden,
      score: null,
      available: false,
      rawValueLabel: "Pemasukan belum tercatat",
      targetLabel: "≤ 30% pemasukan bulanan",
      explanation: "Mengukur proporsi cicilan utang bulanan terhadap pemasukan rutin.",
      impact: "missing",
    });
  } else if (!hasIncomeHistory && options.debts.length === 0) {
    missingIndicators.push(
      "Beban Cicilan (belum ada catatan utang atau pemasukan)"
    );
    components.push({
      key: "installment_burden",
      label: "Beban Cicilan (DSR)",
      weight: HEALTH_SCORE_WEIGHTS.installment_burden,
      score: null,
      available: false,
      rawValueLabel: "Belum tersedia",
      targetLabel: "≤ 30% pemasukan bulanan",
      explanation: "Mengukur proporsi cicilan utang bulanan terhadap pemasukan rutin.",
      impact: "missing",
    });
  } else {
    const monthlyInstallmentSum = activeDebts.reduce(
      (s, d) => s + effectiveMonthlyInstallment(d).monthlyAmount,
      0
    );
    if (monthlyInstallmentSum === 0) {
      components.push({
        key: "installment_burden",
        label: "Beban Cicilan (DSR)",
        weight: HEALTH_SCORE_WEIGHTS.installment_burden,
        score: 100,
        available: true,
        rawValueLabel: "0% (Tanpa cicilan aktif)",
        targetLabel: "≤ 30% pemasukan bulanan",
        explanation: "Tidak ada beban cicilan utang rutin yang memotong arus kas.",
        impact: "positive",
      });
    } else {
      const dsrPct = (monthlyInstallmentSum / avg3.avgIncome) * 100;
      let score: number;
      if (dsrPct <= 15) score = 100;
      else if (dsrPct <= 30) score = 75 + ((30 - dsrPct) / 15) * 25;
      else if (dsrPct <= 45) score = 45 + ((45 - dsrPct) / 15) * 30;
      else score = Math.max(0, 45 - (dsrPct - 45));
      score = clampScore(score);

      components.push({
        key: "installment_burden",
        label: "Beban Cicilan (DSR)",
        weight: HEALTH_SCORE_WEIGHTS.installment_burden,
        score,
        available: true,
        rawValueLabel: `${dsrPct.toFixed(1)}% (${formatIDR(
          monthlyInstallmentSum,
          true
        )}/bln)`,
        targetLabel: "≤ 30% pemasukan bulanan",
        explanation:
          "Total komitmen cicilan bulanan dibandingkan rata-rata pemasukan bulanan.",
        impact: score >= 75 ? "positive" : score >= 50 ? "neutral" : "negative",
      });
    }
  }

  // 5. Kecukupan Dana Darurat (15%)
  const emergencyMonths = computeEmergencyFundMonths(
    netWorth.totalAccountBalance,
    avg3.avgExpense
  );
  if (emergencyMonths === null) {
    missingIndicators.push(
      "Kecukupan Dana Darurat (butuh histori pengeluaran bulanan terkonfirmasi)"
    );
    components.push({
      key: "emergency_fund",
      label: "Dana Darurat",
      weight: HEALTH_SCORE_WEIGHTS.emergency_fund,
      score: null,
      available: false,
      rawValueLabel: "Belum tersedia",
      targetLabel: "≥ 6 bulan pengeluaran",
      explanation:
        "Mengukur berapa bulan total kas likuid sanggup menopang biaya hidup bulanan.",
      impact: "missing",
    });
  } else {
    let score: number;
    if (emergencyMonths >= 6) score = 100;
    else if (emergencyMonths >= 3) score = 70 + ((emergencyMonths - 3) / 3) * 30;
    else if (emergencyMonths >= 1) score = 35 + ((emergencyMonths - 1) / 2) * 35;
    else score = clampScore(emergencyMonths * 35);
    score = clampScore(score);

    components.push({
      key: "emergency_fund",
      label: "Dana Darurat",
      weight: HEALTH_SCORE_WEIGHTS.emergency_fund,
      score,
      available: true,
      rawValueLabel: `${emergencyMonths} bulan`,
      targetLabel: "≥ 6 bulan pengeluaran",
      explanation:
        "Saldo likuid saat ini dibagi rata-rata pengeluaran bulanan terkonfirmasi.",
      impact: score >= 75 ? "positive" : score >= 50 ? "neutral" : "negative",
    });
  }

  // 6. Disiplin Anggaran (10%)
  const budgetSummary = summarizeBudgetMonth(
    options.categoryBudgets,
    options.transactions,
    periodMonth,
    options.budgetAlertLogs ?? []
  );
  if (budgetSummary.activeCount === 0) {
    missingIndicators.push(
      `Disiplin Anggaran (belum ada anggaran aktif pada ${periodMonth})`
    );
    components.push({
      key: "budget_discipline",
      label: "Disiplin Anggaran",
      weight: HEALTH_SCORE_WEIGHTS.budget_discipline,
      score: null,
      available: false,
      rawValueLabel: "Belum ada anggaran aktif",
      targetLabel: "Penggunaan ≤ 90% batas tiap kategori",
      explanation:
        "Memantau kepatuhan pengeluaran terkonfirmasi terhadap batas Smart Budget Monitor.",
      impact: "missing",
    });
  } else {
    const overallPct = budgetSummary.overallUsagePct;
    const exceededPenalty = budgetSummary.exceededCount * 15;
    let baseScore: number;
    if (overallPct <= 75) baseScore = 100;
    else if (overallPct <= 90) baseScore = 85;
    else if (overallPct <= 100) baseScore = 65;
    else baseScore = Math.max(15, 65 - (overallPct - 100));
    const score = clampScore(baseScore - exceededPenalty);

    components.push({
      key: "budget_discipline",
      label: "Disiplin Anggaran",
      weight: HEALTH_SCORE_WEIGHTS.budget_discipline,
      score,
      available: true,
      rawValueLabel: `${overallPct.toFixed(0)}% terpakai (${budgetSummary.exceededCount} terlampaui)`,
      targetLabel: "≤ 90% terpakai tanpa melebihi batas",
      explanation:
        "Dihitung dari persentase penggunaan total dan jumlah kategori yang melewati batas.",
      impact: score >= 75 ? "positive" : score >= 50 ? "neutral" : "negative",
    });
  }

  // 7. Progres Target Keuangan (10%)
  if (options.savingsGoals.length === 0) {
    missingIndicators.push("Progres Target Keuangan (belum ada target tabungan)");
    components.push({
      key: "goal_progress",
      label: "Progres Target",
      weight: HEALTH_SCORE_WEIGHTS.goal_progress,
      score: null,
      available: false,
      rawValueLabel: "Belum ada target",
      targetLabel: "Progres aktif menuju sasaran",
      explanation: "Progres gabungan seluruh target keuangan & dana darurat aktif.",
      impact: "missing",
    });
  } else {
    const accountMap = new Map(options.accounts.map((a) => [a.id, a]));
    let totalTarget = 0;
    let totalSaved = 0;
    for (const g of options.savingsGoals) {
      const prog = computeGoalProgress(
        g,
        g.linked_account_id ? accountMap.get(g.linked_account_id) : undefined
      );
      totalTarget += prog.targetAmount;
      totalSaved += Math.min(prog.targetAmount, prog.savedAmount);
    }
    const pct = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;
    const score = clampScore(pct);
    components.push({
      key: "goal_progress",
      label: "Progres Target",
      weight: HEALTH_SCORE_WEIGHTS.goal_progress,
      score,
      available: true,
      rawValueLabel: `${pct.toFixed(0)}% (${options.savingsGoals.length} target)`,
      targetLabel: "Bertumbuh konsisten ke 100%",
      explanation: "Rasio dana terkumpul dibanding total sasaran target keuangan.",
      impact: score >= 70 ? "positive" : score >= 35 ? "neutral" : "negative",
    });
  }

  // Normalize across AVAILABLE components only (never turn missing metrics into 0!)
  let availableWeight = 0;
  let weightedSum = 0;
  for (const comp of components) {
    if (comp.available && comp.score !== null) {
      availableWeight += comp.weight;
      weightedSum += comp.score * comp.weight;
    }
  }

  const totalScore =
    availableWeight > 0 ? Math.round(weightedSum / availableWeight) : null;
  const grade = classifyHealthGrade(totalScore);
  const isDataIncomplete = missingIndicators.length > 0;

  const boostingFactors = components
    .filter((c) => c.available && (c.score ?? 0) >= 75)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((c) => `${c.label}: ${c.rawValueLabel} (skor ${c.score}/100)`);

  const draggingFactors = components
    .filter((c) => c.available && (c.score ?? 100) < 65)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .map((c) => `${c.label}: ${c.rawValueLabel} (skor ${c.score}/100)`);

  const recommendations: string[] = [];
  for (const comp of components) {
    if (!comp.available) continue;
    if (comp.key === "emergency_fund" && (comp.score ?? 100) < 70) {
      recommendations.push(
        "Prioritaskan penguatan dana darurat hingga minimal 3–6 bulan rata-rata pengeluaran."
      );
    } else if (comp.key === "budget_discipline" && (comp.score ?? 100) < 70) {
      recommendations.push(
        "Evaluasi kategori anggaran yang mendekati/melewati batas di Smart Budget Monitor."
      );
    } else if (
      (comp.key === "installment_burden" || comp.key === "debt_to_asset_ratio") &&
      (comp.score ?? 100) < 70
    ) {
      recommendations.push(
        "Gunakan strategi Debt Avalanche atau Snowball di modul Utang untuk mempercepat penurunan beban bunga."
      );
    } else if (comp.key === "savings_ratio" && (comp.score ?? 100) < 70) {
      recommendations.push(
        "Tingkatkan rasio tabungan secara bertahap menuju minimal 20% dari pemasukan bulanan."
      );
    }
  }
  if (isDataIncomplete) {
    recommendations.push(
      `Lengkapi data yang belum tersedia (${missingIndicators.length} indikator) agar skor 100% akurat tanpa normalisasi bobot.`
    );
  }
  if (recommendations.length === 0 && totalScore !== null) {
    recommendations.push(
      "Fondasi kesehatan keuangan Anda solid. Pertahankan disiplin anggaran dan evaluasi alokasi investasi secara berkala."
    );
  }

  return {
    totalScore,
    grade,
    availableWeight,
    totalWeight: 100,
    isDataIncomplete,
    missingIndicators,
    components,
    boostingFactors,
    draggingFactors,
    recommendations,
    periodMonth,
  };
}
