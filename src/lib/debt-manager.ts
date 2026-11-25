import { daysUntilDue, roundCurrency, todayISO } from "./finance";
import type {
  Debt,
  DebtDisplayStatus,
  DebtPaymentFrequency,
  DebtType,
} from "../types/ego";

export type NormalizedDebt = Debt & {
  debt_type: DebtType;
  interest_rate_annual: number;
  monthly_fee: number;
  installment_amount: number;
  payment_frequency: DebtPaymentFrequency;
};

export type DebtStrategyKey = "snowball" | "avalanche" | "minimum_only";

export interface DebtPayoffOrderItem {
  debtId: string;
  creditor: string;
  debtType: DebtType;
  startingBalance: number;
  annualInterestRate: number;
  payoffMonthIndex: number;
  payoffDateISO: string;
  totalInterestPaid: number;
  totalFeePaid: number;
}

export interface DebtTimelinePoint {
  monthIndex: number;
  dateISO: string;
  label: string;
  totalRemaining: number;
  totalInterestCumulative: number;
}

export interface DebtPayoffSimulation {
  strategy: DebtStrategyKey;
  strategyLabel: string;
  extraMonthlyPayment: number;
  monthsToDebtFree: number | null;
  debtFreeDateISO: string | null;
  totalPrincipal: number;
  totalInterestPaid: number;
  totalFeePaid: number;
  totalPaid: number;
  monthlyRequiredMinimum: number;
  totalMonthlyAllocation: number;
  payoffOrder: DebtPayoffOrderItem[];
  timeline: DebtTimelinePoint[];
  usedEstimatedMinimumForZeroInstallment: boolean;
}

export interface DebtStrategyComparison {
  activeDebtCount: number;
  overdueDebtCount: number;
  totalOutstanding: number;
  totalOriginal: number;
  totalMonthlyCommitment: number;
  minimumOnly: DebtPayoffSimulation;
  snowball: DebtPayoffSimulation;
  avalanche: DebtPayoffSimulation;
  snowballInterestSavedVsMin: number;
  avalancheInterestSavedVsMin: number;
  snowballMonthsSavedVsMin: number;
  avalancheMonthsSavedVsMin: number;
  recommendedStrategy: "snowball" | "avalanche";
  recommendationReason: string;
  cashflowFitWarning: string | null;
}

export function normalizeDebt(debt: Debt): NormalizedDebt {
  return {
    ...debt,
    debt_type: debt.debt_type ?? "lainnya",
    interest_rate_annual: Math.max(0, Number(debt.interest_rate_annual ?? 0) || 0),
    monthly_fee: Math.max(0, Number(debt.monthly_fee ?? 0) || 0),
    installment_amount: Math.max(0, Number(debt.installment_amount ?? 0) || 0),
    payment_frequency: debt.payment_frequency ?? "monthly",
  };
}

export function debtTypeLabel(type: DebtType | undefined): string {
  switch (type) {
    case "kpr":
      return "KPR / Properti";
    case "kendaraan":
      return "Cicilan Kendaraan";
    case "kartu_kredit":
      return "Kartu Kredit";
    case "pinjaman_pribadi":
      return "Pinjaman Pribadi";
    case "paylater":
      return "PayLater";
    case "usaha":
      return "Pinjaman Usaha";
    default:
      return "Utang Lainnya";
  }
}

export function debtFrequencyLabel(freq: DebtPaymentFrequency | undefined): string {
  switch (freq) {
    case "weekly":
      return "Mingguan";
    case "biweekly":
      return "2 Mingguan";
    case "quarterly":
      return "Triwulan";
    case "yearly":
      return "Tahunan";
    default:
      return "Bulanan";
  }
}

export function computeDebtDisplayStatus(
  debt: Pick<Debt, "status" | "outstanding_balance" | "due_date">,
  referenceDateISO = todayISO()
): DebtDisplayStatus {
  if (debt.status === "paid" || Number(debt.outstanding_balance) <= 0) {
    return "paid";
  }
  const delta = daysUntilDue(debt.due_date, referenceDateISO);
  if (delta !== null && delta < 0) return "overdue";
  if (delta !== null && delta <= 7) return "due_soon";
  return "active";
}

export function debtFrequencyToMonthlyFactor(freq: DebtPaymentFrequency | undefined): number {
  switch (freq) {
    case "weekly":
      return 52 / 12;
    case "biweekly":
      return 26 / 12;
    case "quarterly":
      return 1 / 3;
    case "yearly":
      return 1 / 12;
    default:
      return 1;
  }
}

export function effectiveMonthlyInstallment(debt: Debt): {
  monthlyAmount: number;
  isEstimatedFallback: boolean;
} {
  const norm = normalizeDebt(debt);
  const outstanding = Math.max(0, Number(norm.outstanding_balance) || 0);
  if (norm.status === "paid" || outstanding <= 0) {
    return { monthlyAmount: 0, isEstimatedFallback: false };
  }
  if (norm.installment_amount > 0) {
    const monthly = roundCurrency(
      norm.installment_amount * debtFrequencyToMonthlyFactor(norm.payment_frequency)
    );
    return {
      monthlyAmount: Math.min(outstanding + norm.monthly_fee + outstanding * (norm.interest_rate_annual / 1200), monthly),
      isEstimatedFallback: false,
    };
  }
  // Fallback minimum assumption when Owner has not filled fixed installment: 5% of balance or min Rp 100.000
  const fallback = Math.min(outstanding, Math.max(100_000, roundCurrency(outstanding * 0.05)));
  return { monthlyAmount: fallback, isEstimatedFallback: true };
}

function addMonthsISO(referenceDateISO: string, monthsToAdd: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(referenceDateISO.trim());
  const y = match ? Number.parseInt(match[1], 10) : Number(todayISO().slice(0, 4));
  const m = match ? Number.parseInt(match[2], 10) : Number(todayISO().slice(5, 7));
  const d = match ? Number.parseInt(match[3], 10) : 1;
  const zeroBased = m - 1 + monthsToAdd;
  const targetYear = y + Math.floor(zeroBased / 12);
  const targetMonthIdx = ((zeroBased % 12) + 12) % 12;
  const maxDay = new Date(Date.UTC(targetYear, targetMonthIdx + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, maxDay);
  return `${targetYear}-${String(targetMonthIdx + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function shortMonthYearLabel(dateISO: string): string {
  const y = dateISO.slice(0, 4);
  const m = Number.parseInt(dateISO.slice(5, 7), 10);
  return `${MONTHS_SHORT[m - 1] ?? m} ${y.slice(2)}`;
}

export function simulateDebtPayoffStrategy(options: {
  debts: Debt[];
  strategy: DebtStrategyKey;
  extraMonthlyPayment?: number;
  referenceDateISO?: string;
  maxMonths?: number;
}): DebtPayoffSimulation {
  const referenceDateISO = options.referenceDateISO ?? todayISO();
  const maxMonths = options.maxMonths ?? 360;
  const extraMonthly =
    options.strategy === "minimum_only"
      ? 0
      : Math.max(0, roundCurrency(Number(options.extraMonthlyPayment ?? 0) || 0));

  const activeDebts = options.debts
    .map(normalizeDebt)
    .filter((d) => d.status === "active" && d.outstanding_balance > 0);

  const strategyLabel =
    options.strategy === "snowball"
      ? "Debt Snowball (Saldo Terkecil Dulu)"
      : options.strategy === "avalanche"
        ? "Debt Avalanche (Bunga Tertinggi Dulu)"
        : "Pembayaran Minimum Saat Ini";

  if (activeDebts.length === 0) {
    return {
      strategy: options.strategy,
      strategyLabel,
      extraMonthlyPayment: extraMonthly,
      monthsToDebtFree: 0,
      debtFreeDateISO: referenceDateISO,
      totalPrincipal: 0,
      totalInterestPaid: 0,
      totalFeePaid: 0,
      totalPaid: 0,
      monthlyRequiredMinimum: 0,
      totalMonthlyAllocation: extraMonthly,
      payoffOrder: [],
      timeline: [
        {
          monthIndex: 0,
          dateISO: referenceDateISO,
          label: "Sekarang",
          totalRemaining: 0,
          totalInterestCumulative: 0,
        },
      ],
      usedEstimatedMinimumForZeroInstallment: false,
    };
  }

  let usedFallback = false;
  const items = activeDebts.map((d) => {
    const eff = effectiveMonthlyInstallment(d);
    if (eff.isEstimatedFallback) usedFallback = true;
    return {
      debt: d,
      remaining: roundCurrency(d.outstanding_balance),
      minimumMonthly: eff.monthlyAmount,
      monthlyRate: d.interest_rate_annual / 100 / 12,
      monthlyFee: d.monthly_fee,
      interestAccrued: 0,
      feePaid: 0,
      paidOffMonth: null as number | null,
    };
  });

  const totalPrincipal = roundCurrency(
    items.reduce((sum, item) => sum + item.remaining, 0)
  );
  const monthlyRequiredMinimum = roundCurrency(
    items.reduce((sum, item) => sum + item.minimumMonthly, 0)
  );
  const totalMonthlyAllocation = roundCurrency(monthlyRequiredMinimum + extraMonthly);

  const timeline: DebtTimelinePoint[] = [
    {
      monthIndex: 0,
      dateISO: referenceDateISO,
      label: "Sekarang",
      totalRemaining: totalPrincipal,
      totalInterestCumulative: 0,
    },
  ];
  const payoffOrder: DebtPayoffOrderItem[] = [];

  let cumulativeInterest = 0;
  let cumulativeFees = 0;
  let totalPaid = 0;
  let month = 0;

  while (month < maxMonths) {
    const remainingCount = items.filter((i) => i.remaining > 0.01).length;
    if (remainingCount === 0) break;
    month += 1;

    // 1. Accrue monthly interest & monthly fee on active debts
    for (const item of items) {
      if (item.remaining <= 0.01) continue;
      const interest = roundCurrency(item.remaining * item.monthlyRate);
      const fee = roundCurrency(item.monthlyFee);
      item.interestAccrued = roundCurrency(item.interestAccrued + interest);
      item.feePaid = roundCurrency(item.feePaid + fee);
      cumulativeInterest = roundCurrency(cumulativeInterest + interest);
      cumulativeFees = roundCurrency(cumulativeFees + fee);
      item.remaining = roundCurrency(item.remaining + interest + fee);
    }

    // 2. Compute budget available this month (for minimum_only, each debt pays its own minimum; for snowball/avalanche, freed minimums roll over!)
    let poolBudget =
      options.strategy === "minimum_only"
        ? 0
        : totalMonthlyAllocation;

    // Pay minimum on every active debt first
    for (const item of items) {
      if (item.remaining <= 0.01) continue;
      const minPay = Math.min(item.remaining, Math.max(1, item.minimumMonthly));
      item.remaining = roundCurrency(item.remaining - minPay);
      totalPaid = roundCurrency(totalPaid + minPay);
      if (options.strategy !== "minimum_only") {
        poolBudget = roundCurrency(Math.max(0, poolBudget - minPay));
      }
      if (item.remaining <= 0.01) {
        item.remaining = 0;
        if (item.paidOffMonth === null) {
          item.paidOffMonth = month;
          const dateISO = addMonthsISO(referenceDateISO, month);
          payoffOrder.push({
            debtId: item.debt.id,
            creditor: item.debt.creditor,
            debtType: item.debt.debt_type,
            startingBalance: roundCurrency(item.debt.outstanding_balance),
            annualInterestRate: item.debt.interest_rate_annual,
            payoffMonthIndex: month,
            payoffDateISO: dateISO,
            totalInterestPaid: item.interestAccrued,
            totalFeePaid: item.feePaid,
          });
        }
      }
    }

    // 3. Apply remaining pool (extra + rolled-over freed minimums) according to strategy order
    if (options.strategy !== "minimum_only" && poolBudget > 0) {
      const candidates = items
        .filter((i) => i.remaining > 0.01)
        .sort((a, b) => {
          if (options.strategy === "avalanche") {
            if (b.debt.interest_rate_annual !== a.debt.interest_rate_annual) {
              return b.debt.interest_rate_annual - a.debt.interest_rate_annual;
            }
            return a.remaining - b.remaining;
          }
          // snowball: smallest remaining first
          if (a.remaining !== b.remaining) return a.remaining - b.remaining;
          return b.debt.interest_rate_annual - a.debt.interest_rate_annual;
        });

      for (const target of candidates) {
        if (poolBudget <= 0) break;
        const pay = Math.min(target.remaining, poolBudget);
        target.remaining = roundCurrency(target.remaining - pay);
        totalPaid = roundCurrency(totalPaid + pay);
        poolBudget = roundCurrency(poolBudget - pay);
        if (target.remaining <= 0.01) {
          target.remaining = 0;
          if (target.paidOffMonth === null) {
            target.paidOffMonth = month;
            const dateISO = addMonthsISO(referenceDateISO, month);
            payoffOrder.push({
              debtId: target.debt.id,
              creditor: target.debt.creditor,
              debtType: target.debt.debt_type,
              startingBalance: roundCurrency(target.debt.outstanding_balance),
              annualInterestRate: target.debt.interest_rate_annual,
              payoffMonthIndex: month,
              payoffDateISO: dateISO,
              totalInterestPaid: target.interestAccrued,
              totalFeePaid: target.feePaid,
            });
          }
        }
      }
    }

    const totalRemaining = roundCurrency(
      items.reduce((sum, i) => sum + i.remaining, 0)
    );
    const stepDate = addMonthsISO(referenceDateISO, month);
    timeline.push({
      monthIndex: month,
      dateISO: stepDate,
      label: shortMonthYearLabel(stepDate),
      totalRemaining,
      totalInterestCumulative: cumulativeInterest,
    });

    if (totalRemaining <= 0.01) break;
  }

  const allPaid = items.every((i) => i.remaining <= 0.01);
  return {
    strategy: options.strategy,
    strategyLabel,
    extraMonthlyPayment: extraMonthly,
    monthsToDebtFree: allPaid ? month : null,
    debtFreeDateISO: allPaid ? addMonthsISO(referenceDateISO, month) : null,
    totalPrincipal,
    totalInterestPaid: cumulativeInterest,
    totalFeePaid: cumulativeFees,
    totalPaid,
    monthlyRequiredMinimum,
    totalMonthlyAllocation,
    payoffOrder,
    timeline,
    usedEstimatedMinimumForZeroInstallment: usedFallback,
  };
}

export function compareDebtStrategies(options: {
  debts: Debt[];
  extraMonthlyPayment?: number;
  monthlyNetSurplus?: number;
  referenceDateISO?: string;
}): DebtStrategyComparison {
  const referenceDateISO = options.referenceDateISO ?? todayISO();
  const normalized = options.debts.map(normalizeDebt);
  const activeDebts = normalized.filter(
    (d) => d.status === "active" && d.outstanding_balance > 0
  );
  const overdueDebtCount = activeDebts.filter(
    (d) => computeDebtDisplayStatus(d, referenceDateISO) === "overdue"
  ).length;
  const totalOutstanding = roundCurrency(
    activeDebts.reduce((s, d) => s + d.outstanding_balance, 0)
  );
  const totalOriginal = roundCurrency(
    normalized.reduce((s, d) => s + d.original_amount, 0)
  );

  const extra = Math.max(0, roundCurrency(Number(options.extraMonthlyPayment ?? 0) || 0));

  const minimumOnly = simulateDebtPayoffStrategy({
    debts: normalized,
    strategy: "minimum_only",
    extraMonthlyPayment: 0,
    referenceDateISO,
  });
  const snowball = simulateDebtPayoffStrategy({
    debts: normalized,
    strategy: "snowball",
    extraMonthlyPayment: extra,
    referenceDateISO,
  });
  const avalanche = simulateDebtPayoffStrategy({
    debts: normalized,
    strategy: "avalanche",
    extraMonthlyPayment: extra,
    referenceDateISO,
  });

  const snowballInterestSavedVsMin = roundCurrency(
    Math.max(0, minimumOnly.totalInterestPaid - snowball.totalInterestPaid)
  );
  const avalancheInterestSavedVsMin = roundCurrency(
    Math.max(0, minimumOnly.totalInterestPaid - avalanche.totalInterestPaid)
  );
  const snowballMonthsSavedVsMin =
    minimumOnly.monthsToDebtFree !== null && snowball.monthsToDebtFree !== null
      ? Math.max(0, minimumOnly.monthsToDebtFree - snowball.monthsToDebtFree)
      : 0;
  const avalancheMonthsSavedVsMin =
    minimumOnly.monthsToDebtFree !== null && avalanche.monthsToDebtFree !== null
      ? Math.max(0, minimumOnly.monthsToDebtFree - avalanche.monthsToDebtFree)
      : 0;

  let recommendedStrategy: "snowball" | "avalanche" = "avalanche";
  let recommendationReason =
    "Semua kewajiban aktif sudah lunas atau belum ada utang berbunga.";

  if (activeDebts.length > 0) {
    const interestAdvantage = roundCurrency(
      snowball.totalInterestPaid - avalanche.totalInterestPaid
    );
    const hasVaryingRates =
      new Set(activeDebts.map((d) => d.interest_rate_annual)).size > 1;
    if (hasVaryingRates && interestAdvantage >= 50_000) {
      recommendedStrategy = "avalanche";
      recommendationReason = `Debt Avalanche menghemat biaya bunga lebih besar hingga Rp ${Math.round(
        interestAdvantage
      ).toLocaleString("id-ID")} dibanding Snowball karena memprioritaskan utang berbunga tertinggi terlebih dahulu.`;
    } else {
      recommendedStrategy = "snowball";
      recommendationReason =
        "Debt Snowball direkomendasikan karena selisih bunga relatif tipis, sementara melunasi saldo terkecil lebih cepat memberi kelegaan arus kas bulanan.";
    }
  }

  let cashflowFitWarning: string | null = null;
  if (
    options.monthlyNetSurplus !== undefined &&
    activeDebts.length > 0 &&
    extra > 0 &&
    options.monthlyNetSurplus < extra
  ) {
    cashflowFitWarning =
      options.monthlyNetSurplus <= 0
        ? "Rata-rata surplus kas bulanan saat ini belum positif. Tambahan cicilan ekstra berisiko menekan likuiditas."
        : `Ekstra cicilan Rp ${Math.round(extra).toLocaleString(
            "id-ID"
          )}/bln melebihi rata-rata surplus kas bulanan (Rp ${Math.round(
            options.monthlyNetSurplus
          ).toLocaleString("id-ID")}/bln).`;
  }

  return {
    activeDebtCount: activeDebts.length,
    overdueDebtCount,
    totalOutstanding,
    totalOriginal,
    totalMonthlyCommitment: minimumOnly.monthlyRequiredMinimum,
    minimumOnly,
    snowball,
    avalanche,
    snowballInterestSavedVsMin,
    avalancheInterestSavedVsMin,
    snowballMonthsSavedVsMin,
    avalancheMonthsSavedVsMin,
    recommendedStrategy,
    recommendationReason,
    cashflowFitWarning,
  };
}
