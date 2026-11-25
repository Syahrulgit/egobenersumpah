import { isPostedConfirmed, roundCurrency, todayISO } from "./finance";
import { reminderCategoryMeta } from "./reminders";
import type {
  BudgetAlertLog,
  BudgetSeverityLevel,
  BudgetThresholdLevel,
  CategoryBudget,
  FinancialReminder,
  RecurringBill,
  Transaction,
} from "../types/ego";

export const BUDGET_CATEGORY_PRESETS = [
  "Makanan & Minuman",
  "Transportasi",
  "Utilitas & Tagihan",
  "Belanja",
  "Kesehatan",
  "Asuransi",
  "Langganan Digital",
  "Tempat Tinggal",
  "Utang & Cicilan",
  "Investasi & Aset",
  "Pengeluaran Lainnya",
] as const;

const MONTHS_FULL_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

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

export function normalizeBudgetCategoryKey(category: string | null | undefined): string {
  const cleaned = (category ?? "").trim().toLowerCase();
  return cleaned || "umum";
}

export function formatPeriodMonthID(periodMonth: string, short = false): string {
  const match = /^(\d{4})-(\d{2})$/.exec(periodMonth.trim());
  if (!match) return periodMonth;
  const year = match[1];
  const mIdx = Number.parseInt(match[2], 10) - 1;
  const label = short ? MONTHS_SHORT_ID[mIdx] : MONTHS_FULL_ID[mIdx];
  return label ? `${label} ${year}` : periodMonth;
}

export function shiftPeriodMonth(periodMonth: string, deltaMonths: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(periodMonth.trim());
  const fallback = todayISO().slice(0, 7);
  const year = match
    ? Number.parseInt(match[1], 10)
    : Number.parseInt(fallback.slice(0, 4), 10);
  const month = match
    ? Number.parseInt(match[2], 10)
    : Number.parseInt(fallback.slice(5, 7), 10);

  const zeroBased = year * 12 + (month - 1) + deltaMonths;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = (((zeroBased % 12) + 12) % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export interface BudgetThresholdClassification {
  usagePct: number;
  crossedThreshold: BudgetThresholdLevel | null;
  severity: BudgetSeverityLevel;
  label: string;
  shortLabel: string;
}

export function classifyBudgetThreshold(
  spentAmount: number,
  limitAmount: number
): BudgetThresholdClassification {
  const safeSpent = Math.max(0, Number.isFinite(spentAmount) ? spentAmount : 0);
  const safeLimit = Math.max(0, Number.isFinite(limitAmount) ? limitAmount : 0);
  if (safeLimit <= 0) {
    return {
      usagePct: 0,
      crossedThreshold: null,
      severity: "safe",
      label: "Aman",
      shortLabel: "Aman",
    };
  }

  const rawRatioPct = (safeSpent / safeLimit) * 100;
  const usagePct = Math.round((rawRatioPct + Number.EPSILON) * 10) / 10;

  if (safeSpent > safeLimit + 0.001) {
    return {
      usagePct,
      crossedThreshold: 101,
      severity: "exceeded_over",
      label: "Anggaran terlampaui",
      shortLabel: ">100% Terlampaui",
    };
  }
  if (safeSpent >= safeLimit - 0.001) {
    return {
      usagePct: Math.max(100, usagePct),
      crossedThreshold: 100,
      severity: "reached_100",
      label: "Anggaran tercapai (100%)",
      shortLabel: "100% Tercapai",
    };
  }
  if (rawRatioPct >= 90) {
    return {
      usagePct,
      crossedThreshold: 90,
      severity: "high_90",
      label: "Peringatan tinggi (≥ 90%)",
      shortLabel: "≥90% Kritis",
    };
  }
  if (rawRatioPct >= 75) {
    return {
      usagePct,
      crossedThreshold: 75,
      severity: "warning_75",
      label: "Mulai mendekati batas (≥ 75%)",
      shortLabel: "≥75% Mendekati",
    };
  }
  if (rawRatioPct >= 50) {
    return {
      usagePct,
      crossedThreshold: 50,
      severity: "info_50",
      label: "Informasi penggunaan (≥ 50%)",
      shortLabel: "≥50% Terpakai",
    };
  }

  return {
    usagePct,
    crossedThreshold: null,
    severity: "safe",
    label: "Dalam batas aman",
    shortLabel: "Aman",
  };
}

export function budgetThresholdLabel(level: BudgetThresholdLevel): string {
  switch (level) {
    case 50:
      return "50% — Informasi Penggunaan";
    case 75:
      return "75% — Mulai Mendekati Batas";
    case 90:
      return "90% — Peringatan Tinggi";
    case 100:
      return "100% — Anggaran Tercapai";
    case 101:
      return ">100% — Anggaran Terlampaui";
  }
}

export interface EvaluatedBudget {
  budget: CategoryBudget;
  spentAmount: number;
  remainingAmount: number;
  overAmount: number;
  usagePct: number;
  transactionCount: number;
  severity: BudgetSeverityLevel;
  severityLabel: string;
  shortLabel: string;
  crossedThreshold: BudgetThresholdLevel | null;
  pendingAlertThreshold: BudgetThresholdLevel | null;
  scheduledUpcomingAmount: number;
}

export function isThresholdAlreadyNotified(
  budget: CategoryBudget,
  periodMonth: string,
  threshold: BudgetThresholdLevel,
  alertLogs: BudgetAlertLog[]
): boolean {
  if (
    budget.last_alert_period === periodMonth &&
    budget.last_alert_threshold !== null &&
    budget.last_alert_threshold >= threshold
  ) {
    return true;
  }
  return alertLogs.some(
    (log) =>
      log.budget_id === budget.id &&
      log.period_month === periodMonth &&
      log.event_type === "threshold_crossed" &&
      log.threshold_level >= threshold
  );
}

export function computeConfirmedExpensesByCategoryForMonth(
  transactions: Transaction[],
  periodMonth: string
): {
  byCategoryKey: Map<string, { displayCategory: string; total: number; count: number }>;
  totalConfirmedExpense: number;
  confirmedTxCount: number;
} {
  const byCategoryKey = new Map<
    string,
    { displayCategory: string; total: number; count: number }
  >();
  let totalConfirmedExpense = 0;
  let confirmedTxCount = 0;

  for (const tx of transactions) {
    if (!isPostedConfirmed(tx)) continue;
    if (tx.transaction_type !== "expense") continue;
    if (!tx.transaction_date.slice(0, 7).startsWith(periodMonth)) continue;

    const amt = Number(tx.amount) || 0;
    if (amt <= 0) continue;

    const rawCat = (tx.category ?? "").trim() || "Umum";
    const key = normalizeBudgetCategoryKey(rawCat);
    const existing = byCategoryKey.get(key) ?? {
      displayCategory: rawCat,
      total: 0,
      count: 0,
    };
    existing.total = roundCurrency(existing.total + amt);
    existing.count += 1;
    byCategoryKey.set(key, existing);

    totalConfirmedExpense = roundCurrency(totalConfirmedExpense + amt);
    confirmedTxCount += 1;
  }

  return { byCategoryKey, totalConfirmedExpense, confirmedTxCount };
}

function mapReminderToBudgetCategoryKey(r: FinancialReminder): string {
  switch (r.reminder_type) {
    case "cicilan_utang":
      return normalizeBudgetCategoryKey("Utang & Cicilan");
    case "tagihan_bulanan":
    case "jatuh_tempo":
      return normalizeBudgetCategoryKey("Utilitas & Tagihan");
    case "setoran_tabungan":
    case "target_keuangan":
      return normalizeBudgetCategoryKey("Investasi & Aset");
    default:
      return normalizeBudgetCategoryKey(reminderCategoryMeta(r.reminder_type).label);
  }
}

export function evaluateBudgetsForMonth(
  budgets: CategoryBudget[],
  transactions: Transaction[],
  periodMonth: string,
  alertLogs: BudgetAlertLog[] = [],
  bills: RecurringBill[] = [],
  reminders: FinancialReminder[] = []
): EvaluatedBudget[] {
  const { byCategoryKey } = computeConfirmedExpensesByCategoryForMonth(
    transactions,
    periodMonth
  );

  const scheduledByCat = new Map<string, number>();
  const countedBillIds = new Set<string>();

  for (const r of reminders) {
    if (!r.is_active || r.transaction_type !== "expense") continue;
    if (!r.due_date.startsWith(periodMonth)) continue;
    if (r.linked_bill_id) countedBillIds.add(r.linked_bill_id);
    const key = mapReminderToBudgetCategoryKey(r);
    scheduledByCat.set(key, roundCurrency((scheduledByCat.get(key) ?? 0) + (Number(r.amount) || 0)));
  }

  for (const b of bills) {
    if (!b.is_active || b.transaction_type !== "expense") continue;
    if (countedBillIds.has(b.id)) continue;
    if (!b.next_due_date.startsWith(periodMonth)) continue;
    const key = normalizeBudgetCategoryKey(b.category);
    scheduledByCat.set(key, roundCurrency((scheduledByCat.get(key) ?? 0) + (Number(b.amount) || 0)));
  }

  return budgets
    .filter((b) => b.period_month === periodMonth)
    .map((budget) => {
      const key = normalizeBudgetCategoryKey(budget.category);
      const spentEntry = byCategoryKey.get(key);
      const spentAmount = spentEntry?.total ?? 0;
      const limitAmount = Math.max(0, roundCurrency(Number(budget.limit_amount) || 0));
      const remainingAmount = roundCurrency(limitAmount - spentAmount);
      const overAmount = roundCurrency(Math.max(0, spentAmount - limitAmount));

      const classification = classifyBudgetThreshold(spentAmount, limitAmount);
      const severity: BudgetSeverityLevel = budget.is_active
        ? classification.severity
        : "inactive";

      const pendingAlertThreshold =
        budget.is_active &&
        classification.crossedThreshold !== null &&
        !isThresholdAlreadyNotified(
          budget,
          periodMonth,
          classification.crossedThreshold,
          alertLogs
        )
          ? classification.crossedThreshold
          : null;

      return {
        budget,
        spentAmount,
        remainingAmount,
        overAmount,
        usagePct: classification.usagePct,
        transactionCount: spentEntry?.count ?? 0,
        severity,
        severityLabel: budget.is_active ? classification.label : "Anggaran dijeda",
        shortLabel: budget.is_active ? classification.shortLabel : "Nonaktif",
        crossedThreshold: budget.is_active ? classification.crossedThreshold : null,
        pendingAlertThreshold,
        scheduledUpcomingAmount: scheduledByCat.get(key) ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.budget.is_active !== b.budget.is_active) {
        return a.budget.is_active ? -1 : 1;
      }
      if (b.usagePct !== a.usagePct) return b.usagePct - a.usagePct;
      if (b.spentAmount !== a.spentAmount) return b.spentAmount - a.spentAmount;
      return a.budget.category.localeCompare(b.budget.category, "id");
    });
}

export interface UnbudgetedCategorySpend {
  category: string;
  spentAmount: number;
  transactionCount: number;
}

export interface BudgetMonthSummary {
  periodMonth: string;
  activeCount: number;
  inactiveCount: number;
  totalBudget: number;
  totalSpentBudgeted: number;
  totalConfirmedExpenseAll: number;
  remainingBudget: number;
  overBudgetAmount: number;
  overallUsagePct: number;
  overallSeverity: BudgetSeverityLevel;
  exceededCount: number;
  reachedCount: number;
  highWarningCount: number;
  approachingCount: number;
  infoCount: number;
  safeCount: number;
  attentionCount: number;
  items: EvaluatedBudget[];
  activeItems: EvaluatedBudget[];
  topCategories: EvaluatedBudget[];
  alertCategories: EvaluatedBudget[];
  unbudgetedCategories: UnbudgetedCategorySpend[];
}

export function summarizeBudgetMonth(
  budgets: CategoryBudget[],
  transactions: Transaction[],
  periodMonth = todayISO().slice(0, 7),
  alertLogs: BudgetAlertLog[] = [],
  bills: RecurringBill[] = [],
  reminders: FinancialReminder[] = []
): BudgetMonthSummary {
  const items = evaluateBudgetsForMonth(
    budgets,
    transactions,
    periodMonth,
    alertLogs,
    bills,
    reminders
  );
  const { byCategoryKey, totalConfirmedExpense } =
    computeConfirmedExpensesByCategoryForMonth(transactions, periodMonth);

  const activeItems = items.filter((i) => i.budget.is_active);
  const inactiveCount = items.length - activeItems.length;

  const totalBudget = roundCurrency(
    activeItems.reduce((sum, i) => sum + i.budget.limit_amount, 0)
  );
  const totalSpentBudgeted = roundCurrency(
    activeItems.reduce((sum, i) => sum + i.spentAmount, 0)
  );
  const remainingBudget = roundCurrency(totalBudget - totalSpentBudgeted);
  const overBudgetAmount = roundCurrency(Math.max(0, totalSpentBudgeted - totalBudget));

  const overallClass = classifyBudgetThreshold(totalSpentBudgeted, totalBudget);

  const exceededCount = activeItems.filter((i) => i.severity === "exceeded_over").length;
  const reachedCount = activeItems.filter((i) => i.severity === "reached_100").length;
  const highWarningCount = activeItems.filter((i) => i.severity === "high_90").length;
  const approachingCount = activeItems.filter((i) => i.severity === "warning_75").length;
  const infoCount = activeItems.filter((i) => i.severity === "info_50").length;
  const safeCount = activeItems.filter((i) => i.severity === "safe").length;
  const attentionCount =
    exceededCount + reachedCount + highWarningCount + approachingCount;

  const budgetedKeys = new Set(
    items.map((i) => normalizeBudgetCategoryKey(i.budget.category))
  );
  const unbudgetedCategories: UnbudgetedCategorySpend[] = Array.from(
    byCategoryKey.entries()
  )
    .filter(([key]) => !budgetedKeys.has(key))
    .map(([, val]) => ({
      category: val.displayCategory,
      spentAmount: val.total,
      transactionCount: val.count,
    }))
    .sort((a, b) => b.spentAmount - a.spentAmount);

  const topCategories = [...activeItems].slice(0, 5);
  const alertCategories = activeItems.filter(
    (i) =>
      i.severity === "exceeded_over" ||
      i.severity === "reached_100" ||
      i.severity === "high_90" ||
      i.severity === "warning_75"
  );

  return {
    periodMonth,
    activeCount: activeItems.length,
    inactiveCount,
    totalBudget,
    totalSpentBudgeted,
    totalConfirmedExpenseAll: totalConfirmedExpense,
    remainingBudget,
    overBudgetAmount,
    overallUsagePct: totalBudget > 0 ? overallClass.usagePct : 0,
    overallSeverity: totalBudget > 0 ? overallClass.severity : "safe",
    exceededCount,
    reachedCount,
    highWarningCount,
    approachingCount,
    infoCount,
    safeCount,
    attentionCount,
    items,
    activeItems,
    topCategories,
    alertCategories,
    unbudgetedCategories,
  };
}
