import type {
  Account,
  AccountBalance,
  AccountType,
  Asset,
  DateFormatPref,
  Debt,
  RecurringBill,
  RecurringFrequency,
  SavingsGoal,
  Transaction,
} from "../types/ego";

export function roundCurrency(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function formatIDR(amount: number, compact = false): string {
  const safe = Number.isFinite(amount) ? roundCurrency(amount) : 0;
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);

  if (compact && abs >= 1_000_000_000) {
    const val = (abs / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
    return `${sign}Rp ${val} M`;
  }
  if (compact && abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(1).replace(/\.0$/, "").replace(".", ",");
    return `${sign}Rp ${val} jt`;
  }

  const hasFraction = Math.abs(abs - Math.round(abs)) > 0.001;
  const formatted = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(abs);

  return `${sign}Rp ${formatted}`;
}

export function formatThousandsInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseThousandsInput(formatted: string): number {
  const digits = formatted.replace(/\D/g, "");
  if (!digits) return 0;
  const num = Number.parseInt(digits, 10);
  return Number.isFinite(num) ? num : 0;
}

export function formatDateID(isoDate: string | null | undefined, pref: DateFormatPref = "DD MMM YYYY"): string {
  if (!isoDate) return "—";
  const datePart = isoDate.slice(0, 10);
  if (pref === "YYYY-MM-DD") return datePart;

  const [y, m, d] = datePart.split("-").map((v) => Number.parseInt(v, 10));
  if (!y || !m || !d) return isoDate;

  if (pref === "DD/MM/YYYY") {
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${String(d).padStart(2, "0")} ${months[m - 1] ?? m} ${y}`;
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isPostedConfirmed(tx: Pick<Transaction, "status" | "owner_confirmed">): boolean {
  return tx.status === "posted" && tx.owner_confirmed === true;
}

export function computeAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): AccountBalance[] {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();

  for (const tx of transactions) {
    if (!isPostedConfirmed(tx)) continue;
    const amt = Number(tx.amount) || 0;
    if (amt <= 0) continue;

    if (tx.destination_account_id) {
      incoming.set(
        tx.destination_account_id,
        roundCurrency((incoming.get(tx.destination_account_id) ?? 0) + amt)
      );
    }
    if (tx.source_account_id) {
      outgoing.set(
        tx.source_account_id,
        roundCurrency((outgoing.get(tx.source_account_id) ?? 0) + amt)
      );
    }
  }

  return accounts.map((acc) => {
    const inSum = incoming.get(acc.id) ?? 0;
    const outSum = outgoing.get(acc.id) ?? 0;
    const current_balance = roundCurrency((Number(acc.opening_balance) || 0) + inSum - outSum);
    return {
      ...acc,
      current_balance,
    };
  });
}

export function groupAccountsByType(accounts: AccountBalance[]): Record<AccountType, AccountBalance[]> {
  return {
    cash: accounts.filter((a) => a.account_type === "cash"),
    bank: accounts.filter((a) => a.account_type === "bank"),
    ewallet: accounts.filter((a) => a.account_type === "ewallet"),
  };
}

export interface NetWorthSummary {
  totalAccountBalance: number;
  totalAssetValue: number;
  totalDebtBalance: number;
  netWorth: number;
}

export function computeNetWorth(
  accountBalances: AccountBalance[],
  assets: Asset[],
  debts: Debt[]
): NetWorthSummary {
  const totalAccountBalance = roundCurrency(
    accountBalances
      .filter((a) => a.is_active)
      .reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0)
  );
  const totalAssetValue = roundCurrency(
    assets.reduce((sum, a) => sum + (Number(a.current_value) || 0), 0)
  );
  const totalDebtBalance = roundCurrency(
    debts
      .filter((d) => d.status === "active")
      .reduce((sum, d) => sum + (Number(d.outstanding_balance) || 0), 0)
  );

  const netWorth = roundCurrency(totalAccountBalance + totalAssetValue - totalDebtBalance);

  return {
    totalAccountBalance,
    totalAssetValue,
    totalDebtBalance,
    netWorth,
  };
}

export interface CashflowSummary {
  income: number;
  expense: number;
  netCashflow: number;
  transactionCount: number;
}

export function computeMonthlyCashflow(
  transactions: Transaction[],
  yearMonth: string
): CashflowSummary {
  let income = 0;
  let expense = 0;
  let transactionCount = 0;

  for (const tx of transactions) {
    if (!isPostedConfirmed(tx)) continue;
    if (!tx.transaction_date.startsWith(yearMonth)) continue;

    if (tx.transaction_type === "income") {
      income = roundCurrency(income + Number(tx.amount));
      transactionCount += 1;
    } else if (tx.transaction_type === "expense") {
      expense = roundCurrency(expense + Number(tx.amount));
      transactionCount += 1;
    }
  }

  return {
    income,
    expense,
    netCashflow: roundCurrency(income - expense),
    transactionCount,
  };
}

export function accountTypeLabel(type: AccountType): string {
  switch (type) {
    case "cash":
      return "Tunai";
    case "bank":
      return "Bank";
    case "ewallet":
      return "E-Wallet";
  }
}

export function assetTypeLabel(type: Asset["asset_type"]): string {
  switch (type) {
    case "emas":
      return "Emas";
    case "properti":
      return "Properti";
    case "kendaraan":
      return "Kendaraan";
    case "investasi":
      return "Investasi";
    case "elektronik":
      return "Elektronik";
    case "lainnya":
      return "Lainnya";
  }
}

export function daysUntilDue(dueDate: string | null | undefined, referenceDateISO = todayISO()): number | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  const ref = new Date(`${referenceDateISO.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(ref.getTime())) return null;
  return Math.round((due.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

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

export interface CashflowMonthPoint {
  monthKey: string;
  label: string;
  shortLabel: string;
  income: number;
  expense: number;
  net: number;
  transactionCount: number;
}

export function computeCashflowSeries(
  transactions: Transaction[],
  monthsCount: 3 | 6 | 12,
  referenceMonth = todayISO().slice(0, 7)
): CashflowMonthPoint[] {
  const match = /^(\d{4})-(\d{2})$/.exec(referenceMonth.slice(0, 7));
  const fallback = todayISO().slice(0, 7);
  const refYear = match
    ? Number.parseInt(match[1], 10)
    : Number.parseInt(fallback.slice(0, 4), 10);
  const refMonth = match
    ? Number.parseInt(match[2], 10)
    : Number.parseInt(fallback.slice(5, 7), 10);

  const buckets = new Map<string, CashflowMonthPoint>();
  const order: string[] = [];

  const refZeroBased = refYear * 12 + (refMonth - 1);
  for (let offset = monthsCount - 1; offset >= 0; offset--) {
    const idx = refZeroBased - offset;
    const year = Math.floor(idx / 12);
    const monthIndex = ((idx % 12) + 12) % 12;
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const shortLabel = MONTHS_SHORT_ID[monthIndex];
    const point: CashflowMonthPoint = {
      monthKey,
      label: `${shortLabel} ${year}`,
      shortLabel,
      income: 0,
      expense: 0,
      net: 0,
      transactionCount: 0,
    };
    buckets.set(monthKey, point);
    order.push(monthKey);
  }

  for (const tx of transactions) {
    if (!isPostedConfirmed(tx)) continue;
    if (tx.transaction_type !== "income" && tx.transaction_type !== "expense") {
      continue;
    }
    const amt = Number(tx.amount) || 0;
    if (amt <= 0) continue;

    const monthKey = tx.transaction_date.slice(0, 7);
    const bucket = buckets.get(monthKey);
    if (!bucket) continue;

    if (tx.transaction_type === "income") {
      bucket.income = roundCurrency(bucket.income + amt);
    } else {
      bucket.expense = roundCurrency(bucket.expense + amt);
    }
    bucket.net = roundCurrency(bucket.income - bucket.expense);
    bucket.transactionCount += 1;
  }

  return order.map((key) => buckets.get(key)!);
}

export interface CategoryBreakdownItem {
  category: string;
  total: number;
  percentage: number;
  count: number;
}

export interface CategoryBreakdownResult {
  type: "income" | "expense";
  totalAmount: number;
  totalCount: number;
  items: CategoryBreakdownItem[];
}

export interface CategoryBreakdownOptions {
  yearMonth?: string;
  fromDate?: string;
  toDate?: string;
}

export function computeCategoryBreakdown(
  transactions: Transaction[],
  type: "income" | "expense",
  options: CategoryBreakdownOptions = {}
): CategoryBreakdownResult {
  const groups = new Map<string, { total: number; count: number }>();
  let totalAmount = 0;
  let totalCount = 0;

  for (const tx of transactions) {
    if (!isPostedConfirmed(tx)) continue;
    if (tx.transaction_type !== type) continue;

    const txDate = tx.transaction_date.slice(0, 10);
    if (options.yearMonth && !txDate.startsWith(options.yearMonth)) continue;
    if (options.fromDate && txDate < options.fromDate) continue;
    if (options.toDate && txDate > options.toDate) continue;

    const amt = Number(tx.amount) || 0;
    if (amt <= 0) continue;

    const category = (tx.category ?? "").trim() || "Umum";
    const existing = groups.get(category) ?? { total: 0, count: 0 };
    existing.total = roundCurrency(existing.total + amt);
    existing.count += 1;
    groups.set(category, existing);

    totalAmount = roundCurrency(totalAmount + amt);
    totalCount += 1;
  }

  const items: CategoryBreakdownItem[] = Array.from(groups.entries())
    .map(([category, data]) => ({
      category,
      total: data.total,
      percentage:
        totalAmount > 0
          ? Math.round(((data.total / totalAmount) * 100 + Number.EPSILON) * 10) / 10
          : 0,
      count: data.count,
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.count !== a.count) return b.count - a.count;
      return a.category.localeCompare(b.category, "id");
    });

  return {
    type,
    totalAmount,
    totalCount,
    items,
  };
}

export function getGreetingID(hour = new Date().getHours()): string {
  if (hour >= 4 && hour < 11) return "Selamat pagi";
  if (hour >= 11 && hour < 15) return "Selamat siang";
  if (hour >= 15 && hour < 19) return "Selamat sore";
  return "Selamat malam";
}

export function advanceDueDate(
  isoDate: string,
  frequency: RecurringFrequency
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return todayISO();

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (frequency === "weekly") {
    const dt = new Date(Date.UTC(year, month - 1, day + 7));
    return dt.toISOString().slice(0, 10);
  }

  if (frequency === "yearly") {
    const targetYear = year + 1;
    const maxDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
    const clampedDay = Math.min(day, maxDay);
    return `${targetYear}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
  }

  // monthly (clamp day to target month's last day, e.g. Jan 31 -> Feb 28/29)
  const zeroBasedMonth = month - 1 + 1;
  const targetYear = year + Math.floor(zeroBasedMonth / 12);
  const targetMonthIndex = ((zeroBasedMonth % 12) + 12) % 12;
  const maxDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, maxDay);
  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export function getDueRecurringBills(
  bills: RecurringBill[],
  referenceDateISO = todayISO(),
  windowDays = 7
): RecurringBill[] {
  return bills
    .filter((bill) => {
      if (!bill.is_active) return false;
      if (bill.last_queued_date && bill.last_queued_date === bill.next_due_date) {
        return false;
      }
      const delta = daysUntilDue(bill.next_due_date, referenceDateISO);
      return delta !== null && delta <= windowDays;
    })
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
}

export function recurringFrequencyLabel(freq: RecurringFrequency): string {
  switch (freq) {
    case "weekly":
      return "Mingguan";
    case "monthly":
      return "Bulanan";
    case "yearly":
      return "Tahunan";
  }
}

export interface GoalProgressResult {
  savedAmount: number;
  targetAmount: number;
  remainingAmount: number;
  percentage: number;
  isCompleted: boolean;
}

export function computeGoalProgress(
  goal: SavingsGoal,
  linkedAccount?: Pick<AccountBalance, "current_balance">
): GoalProgressResult {
  const targetAmount = Math.max(0, roundCurrency(Number(goal.target_amount) || 0));
  const rawSaved = linkedAccount
    ? Math.max(0, Number(linkedAccount.current_balance) || 0)
    : Math.max(0, Number(goal.current_amount) || 0);
  const savedAmount = roundCurrency(rawSaved);
  const remainingAmount = roundCurrency(Math.max(0, targetAmount - savedAmount));
  const percentage =
    targetAmount > 0
      ? Math.min(100, Math.round(((savedAmount / targetAmount) * 100 + Number.EPSILON) * 10) / 10)
      : 0;
  const isCompleted =
    goal.status === "completed" || (targetAmount > 0 && savedAmount >= targetAmount);

  return {
    savedAmount,
    targetAmount,
    remainingAmount,
    percentage,
    isCompleted,
  };
}

export function computeAverageMonthlyCashflow(
  transactions: Transaction[],
  monthsCount: 3 | 6 | 12 = 3,
  referenceMonth = todayISO().slice(0, 7)
): { avgIncome: number; avgExpense: number; avgNet: number } {
  const series = computeCashflowSeries(transactions, monthsCount, referenceMonth);
  const activeMonths = series.filter((m) => m.transactionCount > 0);
  const divisor = Math.max(1, activeMonths.length);
  const totalIncome = activeMonths.reduce((s, m) => s + m.income, 0);
  const totalExpense = activeMonths.reduce((s, m) => s + m.expense, 0);
  const avgIncome = roundCurrency(totalIncome / divisor);
  const avgExpense = roundCurrency(totalExpense / divisor);
  return {
    avgIncome,
    avgExpense,
    avgNet: roundCurrency(avgIncome - avgExpense),
  };
}

export function estimateGoalCompletionMonths(
  remainingAmount: number,
  avgMonthlyNetCashflow: number
): number | null {
  if (remainingAmount <= 0) return 0;
  if (!Number.isFinite(avgMonthlyNetCashflow) || avgMonthlyNetCashflow <= 0) {
    return null;
  }
  return Math.ceil(remainingAmount / avgMonthlyNetCashflow);
}

export function computeEmergencyFundMonths(
  liquidBalance: number,
  avgMonthlyExpense: number
): number | null {
  if (!Number.isFinite(avgMonthlyExpense) || avgMonthlyExpense <= 0) return null;
  if (!Number.isFinite(liquidBalance) || liquidBalance <= 0) return 0;
  return Math.round(((liquidBalance / avgMonthlyExpense) + Number.EPSILON) * 10) / 10;
}

export interface TransactionFilterOptions {
  type?: "all" | "income" | "expense" | "transfer";
  accountId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export function filterTransactions(
  transactions: Transaction[],
  options: TransactionFilterOptions = {}
): Transaction[] {
  const q = (options.search ?? "").trim().toLowerCase();
  return transactions.filter((tx) => {
    if (options.type && options.type !== "all" && tx.transaction_type !== options.type) {
      return false;
    }
    if (
      options.accountId &&
      tx.source_account_id !== options.accountId &&
      tx.destination_account_id !== options.accountId
    ) {
      return false;
    }
    if (q) {
      const cat = (tx.category ?? "").toLowerCase();
      const desc = (tx.description ?? "").toLowerCase();
      if (!cat.includes(q) && !desc.includes(q)) {
        return false;
      }
    }
    const txDate = tx.transaction_date.slice(0, 10);
    if (options.fromDate && txDate < options.fromDate) return false;
    if (options.toDate && txDate > options.toDate) return false;
    return true;
  });
}

export interface TransactionDateGroup {
  dateKey: string;
  label: string;
  items: Transaction[];
  dayIncome: number;
  dayExpense: number;
}

function shiftIsoDays(isoDate: string, deltaDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return isoDate;
  const dt = new Date(
    Date.UTC(
      Number.parseInt(match[1], 10),
      Number.parseInt(match[2], 10) - 1,
      Number.parseInt(match[3], 10) + deltaDays
    )
  );
  return dt.toISOString().slice(0, 10);
}

export function groupTransactionsByDate(
  transactions: Transaction[],
  dateFormat: DateFormatPref = "DD MMM YYYY",
  referenceDateISO = todayISO()
): TransactionDateGroup[] {
  const yesterdayISO = shiftIsoDays(referenceDateISO, -1);
  const groups = new Map<string, TransactionDateGroup>();

  const sorted = [...transactions].sort((a, b) => {
    const dateCmp = b.transaction_date.slice(0, 10).localeCompare(a.transaction_date.slice(0, 10));
    if (dateCmp !== 0) return dateCmp;
    return b.created_at.localeCompare(a.created_at);
  });

  for (const tx of sorted) {
    const dateKey = tx.transaction_date.slice(0, 10);
    let group = groups.get(dateKey);
    if (!group) {
      const formatted = formatDateID(dateKey, dateFormat);
      const label =
        dateKey === referenceDateISO
          ? `Hari Ini · ${formatted}`
          : dateKey === yesterdayISO
            ? `Kemarin · ${formatted}`
            : formatted;
      group = {
        dateKey,
        label,
        items: [],
        dayIncome: 0,
        dayExpense: 0,
      };
      groups.set(dateKey, group);
    }
    group.items.push(tx);
    if (isPostedConfirmed(tx)) {
      if (tx.transaction_type === "income") {
        group.dayIncome = roundCurrency(group.dayIncome + (Number(tx.amount) || 0));
      } else if (tx.transaction_type === "expense") {
        group.dayExpense = roundCurrency(group.dayExpense + (Number(tx.amount) || 0));
      }
    }
  }

  return Array.from(groups.values());
}

export interface BalanceTrendSummary {
  hasBaseline: boolean;
  currentMonthNet: number;
  previousMonthNet: number;
  deltaAmount: number;
  deltaPercent: number | null;
}

export function computeBalanceTrend(
  transactions: Transaction[],
  currentMonth = todayISO().slice(0, 7)
): BalanceTrendSummary {
  const series = computeCashflowSeries(transactions, 3, currentMonth);
  const currentPoint = series[series.length - 1];
  const prevPoint = series[series.length - 2];

  if (!currentPoint || !prevPoint || prevPoint.transactionCount === 0) {
    return {
      hasBaseline: false,
      currentMonthNet: currentPoint?.net ?? 0,
      previousMonthNet: 0,
      deltaAmount: currentPoint?.net ?? 0,
      deltaPercent: null,
    };
  }

  const deltaAmount = roundCurrency(currentPoint.net - prevPoint.net);
  const deltaPercent =
    prevPoint.net !== 0
      ? Math.round(((deltaAmount / Math.abs(prevPoint.net)) * 100 + Number.EPSILON) * 10) / 10
      : null;

  return {
    hasBaseline: true,
    currentMonthNet: currentPoint.net,
    previousMonthNet: prevPoint.net,
    deltaAmount,
    deltaPercent,
  };
}
