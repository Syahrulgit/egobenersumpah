import { daysUntilDue, formatDateID, roundCurrency, todayISO } from "./finance";
import type {
  AccountBalance,
  DepositFrequency,
  GoalScenarioKey,
  GoalScenarioOutcome,
  GoalScenarioProjectionPoint,
  GoalSimulationInput,
  GoalSimulationResult,
  GoalTargetStatus,
  ReminderFrequency,
  SavingsGoal,
} from "../types/ego";

export const DEPOSIT_FREQUENCY_OPTIONS: Array<{
  value: DepositFrequency;
  label: string;
  cyclesPerYear: number;
  reminderFrequency: ReminderFrequency;
}> = [
  {
    value: "monthly",
    label: "Bulanan",
    cyclesPerYear: 12,
    reminderFrequency: "monthly",
  },
  {
    value: "biweekly",
    label: "2 Mingguan",
    cyclesPerYear: 26,
    reminderFrequency: "weekly",
  },
  {
    value: "weekly",
    label: "Mingguan",
    cyclesPerYear: 52,
    reminderFrequency: "weekly",
  },
];

const MONTHS_SHORT_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

export function addMonthsISO(baseDateISO: string, monthsToAdd: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(baseDateISO.trim());
  const baseYear = match ? Number.parseInt(match[1], 10) : Number.parseInt(todayISO().slice(0, 4), 10);
  const baseMonth = match ? Number.parseInt(match[2], 10) : Number.parseInt(todayISO().slice(5, 7), 10);
  const baseDay = match ? Number.parseInt(match[3], 10) : Number.parseInt(todayISO().slice(8, 10), 10);

  const zeroBasedMonth = baseMonth - 1 + monthsToAdd;
  const targetYear = baseYear + Math.floor(zeroBasedMonth / 12);
  const targetMonthIndex = ((zeroBasedMonth % 12) + 12) % 12;
  const maxDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(baseDay, maxDay);
  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

function monthLabelID(dateISO: string, monthIndex: number): string {
  if (monthIndex === 0) return "Sekarang";
  const match = /^(\d{4})-(\d{2})/.exec(dateISO);
  if (!match) return `Bln ${monthIndex}`;
  const yr = match[1].slice(2);
  const mIdx = Number.parseInt(match[2], 10) - 1;
  return `${MONTHS_SHORT_ID[mIdx] ?? match[2]} '${yr}`;
}

export function computeCycleDepositAmount(
  monthlyDeposit: number,
  frequency: DepositFrequency
): number {
  const safeMonthly = Math.max(0, Number.isFinite(monthlyDeposit) ? monthlyDeposit : 0);
  if (frequency === "weekly") {
    return roundCurrency((safeMonthly * 12) / 52);
  }
  if (frequency === "biweekly") {
    return roundCurrency((safeMonthly * 12) / 26);
  }
  return roundCurrency(safeMonthly);
}

function projectBalanceAfterMonths(
  startAmount: number,
  monthlyDeposit: number,
  monthlyRate: number,
  months: number
): number {
  let balance = startAmount;
  for (let i = 0; i < months; i++) {
    balance = balance * (1 + monthlyRate) + monthlyDeposit;
  }
  return roundCurrency(balance);
}

function estimateMonthsToTarget(
  startAmount: number,
  targetAmount: number,
  monthlyDeposit: number,
  monthlyRate: number,
  maxMonths = 240
): number | null {
  if (targetAmount <= 0 || startAmount >= targetAmount) return 0;
  if (monthlyDeposit <= 0 && monthlyRate <= 0) return null;

  let balance = startAmount;
  for (let m = 1; m <= maxMonths; m++) {
    balance = balance * (1 + monthlyRate) + monthlyDeposit;
    if (balance >= targetAmount) {
      return m;
    }
  }
  return null;
}

function evaluateScenarioOutcome(params: {
  key: GoalScenarioKey;
  label: string;
  currentAmount: number;
  targetAmount: number;
  monthlyDeposit: number;
  frequency: DepositFrequency;
  monthlyRate: number;
  monthsRemaining: number | null;
  isPastDue: boolean;
  isAlreadyAchieved: boolean;
  refDateISO: string;
}): GoalScenarioOutcome {
  const monthlyDeposit = Math.max(0, roundCurrency(params.monthlyDeposit));
  const cycleDeposit = computeCycleDepositAmount(monthlyDeposit, params.frequency);

  if (params.isAlreadyAchieved) {
    return {
      key: params.key,
      label: params.label,
      monthlyDeposit,
      cycleDeposit,
      estimatedMonths: 0,
      estimatedDate: params.refDateISO,
      projectedAtTargetDate: params.currentAmount,
      planVsTargetGap: roundCurrency(params.currentAmount - params.targetAmount),
      status: "achieved",
    };
  }

  const estimatedMonths = estimateMonthsToTarget(
    params.currentAmount,
    params.targetAmount,
    monthlyDeposit,
    params.monthlyRate
  );
  const estimatedDate =
    estimatedMonths !== null ? addMonthsISO(params.refDateISO, estimatedMonths) : null;

  const projectedAtTargetDate =
    params.monthsRemaining !== null
      ? projectBalanceAfterMonths(
          params.currentAmount,
          monthlyDeposit,
          params.monthlyRate,
          params.monthsRemaining
        )
      : null;

  const planVsTargetGap =
    projectedAtTargetDate !== null
      ? roundCurrency(projectedAtTargetDate - params.targetAmount)
      : null;

  let status: GoalTargetStatus = "on_track";
  if (params.isPastDue) {
    status = "at_risk";
  } else if (params.monthsRemaining !== null) {
    if (projectedAtTargetDate === null || projectedAtTargetDate + 1 < params.targetAmount) {
      status = "at_risk";
    }
  } else if (estimatedMonths === null || monthlyDeposit <= 0) {
    status = "at_risk";
  }

  return {
    key: params.key,
    label: params.label,
    monthlyDeposit,
    cycleDeposit,
    estimatedMonths,
    estimatedDate,
    projectedAtTargetDate,
    planVsTargetGap,
    status,
  };
}

export function computeGoalSimulation(
  input: GoalSimulationInput,
  refDateISO = todayISO()
): GoalSimulationResult {
  const targetAmount = Math.max(0, roundCurrency(Number(input.target_amount) || 0));
  const currentAmount = Math.max(0, roundCurrency(Number(input.current_amount) || 0));
  const remainingAmount = roundCurrency(Math.max(0, targetAmount - currentAmount));
  const isAlreadyAchieved = targetAmount > 0 && currentAmount >= targetAmount;
  const progressPercentage =
    targetAmount > 0
      ? Math.min(100, Math.round(((currentAmount / targetAmount) * 100 + Number.EPSILON) * 10) / 10)
      : 0;

  const cleanTargetDate =
    input.target_date && /^\d{4}-\d{2}-\d{2}$/.test(input.target_date.slice(0, 10))
      ? input.target_date.slice(0, 10)
      : null;

  const daysRemaining = cleanTargetDate ? daysUntilDue(cleanTargetDate, refDateISO) : null;
  const isPastDue = daysRemaining !== null && daysRemaining < 0 && !isAlreadyAchieved;

  let monthsRemaining: number | null = null;
  if (daysRemaining !== null) {
    if (daysRemaining <= 0) {
      monthsRemaining = 0;
    } else {
      monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30.4375));
    }
  }

  const useYieldAssumption = input.use_yield_assumption === true;
  const annualYieldPct = useYieldAssumption
    ? Math.min(30, Math.max(0, roundCurrency(Number(input.annual_yield_pct) || 0)))
    : 0;
  const monthlyRate = annualYieldPct > 0 ? annualYieldPct / 100 / 12 : 0;

  let minimumMonthlyDeposit: number | null = null;
  if (isAlreadyAchieved) {
    minimumMonthlyDeposit = 0;
  } else if (monthsRemaining !== null) {
    if (monthsRemaining === 0) {
      minimumMonthlyDeposit = remainingAmount;
    } else if (monthlyRate === 0) {
      minimumMonthlyDeposit = roundCurrency(remainingAmount / monthsRemaining);
    } else {
      const growthFactor = Math.pow(1 + monthlyRate, monthsRemaining);
      const fvCurrent = currentAmount * growthFactor;
      const shortfall = Math.max(0, targetAmount - fvCurrent);
      const annuityFactor = (growthFactor - 1) / monthlyRate;
      minimumMonthlyDeposit =
        annuityFactor > 0
          ? roundCurrency(shortfall / annuityFactor)
          : roundCurrency(shortfall / monthsRemaining);
    }
  }

  const normalMonthly = Math.max(0, roundCurrency(Number(input.monthly_deposit) || 0));
  const conservativeMonthly =
    input.conservative_monthly_deposit !== undefined &&
    Number.isFinite(input.conservative_monthly_deposit)
      ? Math.max(0, roundCurrency(input.conservative_monthly_deposit))
      : roundCurrency(normalMonthly * 0.7);
  const optimisticMonthly =
    input.optimistic_monthly_deposit !== undefined &&
    Number.isFinite(input.optimistic_monthly_deposit)
      ? Math.max(0, roundCurrency(input.optimistic_monthly_deposit))
      : roundCurrency(normalMonthly * 1.3);

  const conservative = evaluateScenarioOutcome({
    key: "conservative",
    label: "Konservatif",
    currentAmount,
    targetAmount,
    monthlyDeposit: conservativeMonthly,
    frequency: input.deposit_frequency,
    monthlyRate,
    monthsRemaining,
    isPastDue,
    isAlreadyAchieved,
    refDateISO,
  });

  const normal = evaluateScenarioOutcome({
    key: "normal",
    label: "Normal",
    currentAmount,
    targetAmount,
    monthlyDeposit: normalMonthly,
    frequency: input.deposit_frequency,
    monthlyRate,
    monthsRemaining,
    isPastDue,
    isAlreadyAchieved,
    refDateISO,
  });

  const optimistic = evaluateScenarioOutcome({
    key: "optimistic",
    label: "Optimistis",
    currentAmount,
    targetAmount,
    monthlyDeposit: optimisticMonthly,
    frequency: input.deposit_frequency,
    monthlyRate,
    monthsRemaining,
    isPastDue,
    isAlreadyAchieved,
    refDateISO,
  });

  const monthlyPlanGap =
    minimumMonthlyDeposit !== null
      ? roundCurrency(normal.monthlyDeposit - minimumMonthlyDeposit)
      : null;

  const status: GoalTargetStatus = isAlreadyAchieved ? "achieved" : normal.status;

  const chartHorizon = isAlreadyAchieved
    ? 6
    : Math.min(
        48,
        Math.max(
          6,
          monthsRemaining ?? 0,
          Math.min(36, normal.estimatedMonths ?? 12)
        )
      );

  const projectionSeries: GoalScenarioProjectionPoint[] = [];
  let cBal = currentAmount;
  let nBal = currentAmount;
  let oBal = currentAmount;

  for (let m = 0; m <= chartHorizon; m++) {
    const dateISO = addMonthsISO(refDateISO, m);
    projectionSeries.push({
      monthIndex: m,
      dateISO,
      label: monthLabelID(dateISO, m),
      conservative: roundCurrency(cBal),
      normal: roundCurrency(nBal),
      optimistic: roundCurrency(oBal),
      targetAmount,
    });
    cBal = cBal * (1 + monthlyRate) + conservative.monthlyDeposit;
    nBal = nBal * (1 + monthlyRate) + normal.monthlyDeposit;
    oBal = oBal * (1 + monthlyRate) + optimistic.monthlyDeposit;
  }

  return {
    remainingAmount,
    progressPercentage,
    monthsRemaining,
    daysRemaining,
    isPastDue,
    isAlreadyAchieved,
    minimumMonthlyDeposit,
    monthlyPlanGap,
    status,
    scenarios: {
      conservative,
      normal,
      optimistic,
    },
    projectionSeries,
    useYieldAssumption,
    annualYieldPct,
  };
}

export interface GoalDashboardSummary {
  totalGoalsCount: number;
  activeGoalsCount: number;
  completedGoalsCount: number;
  overallProgressPct: number;
  atRiskCount: number;
  primaryGoal: {
    id: string;
    title: string;
    progressPct: number;
    etaText: string;
    status: GoalTargetStatus;
  } | null;
}

export function summarizeGoalsForDashboard(
  goals: SavingsGoal[],
  accounts: AccountBalance[],
  avgMonthlyNetCashflow: number,
  refDateISO = todayISO()
): GoalDashboardSummary {
  const accMap = new Map(accounts.map((a) => [a.id, a]));
  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");

  let totalTarget = 0;
  let totalSaved = 0;
  let atRiskCount = 0;
  let primaryGoal: GoalDashboardSummary["primaryGoal"] = null;

  for (const goal of goals) {
    const linked = goal.linked_account_id ? accMap.get(goal.linked_account_id) : undefined;
    const saved = linked
      ? Math.max(0, Number(linked.current_balance) || 0)
      : Math.max(0, Number(goal.current_amount) || 0);
    const target = Math.max(0, Number(goal.target_amount) || 0);
    totalSaved += Math.min(saved, target > 0 ? target : saved);
    totalTarget += target;

    if (goal.status === "active") {
      const sim = computeGoalSimulation(
        {
          goal_id: goal.id,
          title: goal.title,
          target_amount: target,
          current_amount: saved,
          target_date: goal.target_date,
          monthly_deposit: Math.max(0, avgMonthlyNetCashflow),
          deposit_frequency: "monthly",
          linked_account_id: goal.linked_account_id,
        },
        refDateISO
      );

      if (sim.status === "at_risk") {
        atRiskCount += 1;
      }

      if (!primaryGoal) {
        const etaText = sim.isAlreadyAchieved
          ? "Tercapai 100%"
          : sim.scenarios.normal.estimatedDate
            ? formatDateID(sim.scenarios.normal.estimatedDate, "DD MMM YYYY")
            : goal.target_date
              ? `Tenggat ${formatDateID(goal.target_date, "DD MMM YYYY")}`
              : "Perlu simulasi setoran";
        primaryGoal = {
          id: goal.id,
          title: goal.title,
          progressPct: sim.progressPercentage,
          etaText,
          status: sim.status,
        };
      }
    }
  }

  const overallProgressPct =
    totalTarget > 0
      ? Math.min(100, Math.round(((totalSaved / totalTarget) * 100 + Number.EPSILON) * 10) / 10)
      : 0;

  return {
    totalGoalsCount: goals.length,
    activeGoalsCount: activeGoals.length,
    completedGoalsCount: completedGoals.length,
    overallProgressPct,
    atRiskCount,
    primaryGoal,
  };
}

export function mapDepositFrequencyToReminderFrequency(
  freq: DepositFrequency
): ReminderFrequency {
  return freq === "monthly" ? "monthly" : "weekly";
}
