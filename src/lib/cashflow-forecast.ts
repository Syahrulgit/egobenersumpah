import {
  advanceDueDate,
  isPostedConfirmed,
  roundCurrency,
  todayISO,
} from "./finance";
import { normalizeDebt } from "./debt-manager";
import type {
  AccountBalance,
  CategoryBudget,
  Debt,
  FinancialReminder,
  RecurringBill,
  Transaction,
} from "../types/ego";

export type ForecastHorizonDays = 7 | 30 | 90 | 365;
export type ForecastConfidenceTier = "high" | "medium" | "low";

export interface ForecastScheduledEvent {
  dateISO: string;
  title: string;
  direction: "income" | "expense";
  amount: number;
  source: "scheduled_bill" | "scheduled_reminder" | "scheduled_debt";
  category: string;
}

export interface ForecastDailyPoint {
  dayIndex: number;
  dateISO: string;
  label: string;
  balance: number;
  scheduledNet: number;
  estimatedNet: number;
  isDeficit: boolean;
  isTightBuffer: boolean;
}

export interface CashflowForecastResult {
  horizonDays: ForecastHorizonDays;
  referenceDateISO: string;
  startingBalance: number;
  endingBalance: number;
  netProjectedChange: number;
  scheduledIncome: number;
  scheduledExpense: number;
  estimatedIncome: number;
  estimatedExpense: number;
  totalPredictedIncome: number;
  totalPredictedExpense: number;
  lowestBalance: number;
  lowestBalanceDateISO: string;
  deficitDaysCount: number;
  firstDeficitDateISO: string | null;
  tightBufferDaysCount: number;
  tightBufferThreshold: number;
  confidenceTier: ForecastConfidenceTier;
  confidenceLabel: string;
  assumptions: string[];
  upcomingEvents: ForecastScheduledEvent[];
  dailySeries: ForecastDailyPoint[];
}

function shiftDateISO(isoDate: string, deltaDays: number): string {
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

function advanceDateByDaysOrCycle(
  isoDate: string,
  frequency: "once" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly"
): string {
  if (frequency === "biweekly") return shiftDateISO(isoDate, 14);
  if (frequency === "quarterly") {
    const first = advanceDueDate(isoDate, "monthly");
    const second = advanceDueDate(first, "monthly");
    return advanceDueDate(second, "monthly");
  }
  if (frequency === "weekly" || frequency === "monthly" || frequency === "yearly") {
    return advanceDueDate(isoDate, frequency);
  }
  return isoDate;
}

export function computeCashflowForecast(options: {
  accounts: AccountBalance[];
  transactions: Transaction[];
  recurringBills: RecurringBill[];
  financialReminders: FinancialReminder[];
  debts: Debt[];
  categoryBudgets?: CategoryBudget[];
  horizonDays: ForecastHorizonDays;
  referenceDateISO?: string;
}): CashflowForecastResult {
  const referenceDateISO = (options.referenceDateISO ?? todayISO()).slice(0, 10);
  const horizonDays = options.horizonDays;
  const endDateISO = shiftDateISO(referenceDateISO, horizonDays);

  const startingBalance = roundCurrency(
    options.accounts
      .filter((a) => a.is_active)
      .reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0)
  );

  // 1. Project Confirmed Scheduled Flows (deduped across bills, reminders, and active debts)
  const eventsByDate = new Map<string, ForecastScheduledEvent[]>();
  const allEvents: ForecastScheduledEvent[] = [];

  const pushEvent = (ev: ForecastScheduledEvent) => {
    if (ev.amount <= 0) return;
    if (ev.dateISO < referenceDateISO || ev.dateISO > endDateISO) return;
    allEvents.push(ev);
    const list = eventsByDate.get(ev.dateISO) ?? [];
    list.push(ev);
    eventsByDate.set(ev.dateISO, list);
  };

  const activeBills = options.recurringBills.filter((b) => b.is_active && b.amount > 0);
  const scheduledBillIds = new Set<string>();

  for (const bill of activeBills) {
    scheduledBillIds.add(bill.id);
    let cursor = bill.next_due_date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cursor)) continue;
    // If overdue by <= 30 days, include once on reference date + 1 day if still unpaid (not already queued for this date)
    let safety = 0;
    while (cursor < referenceDateISO && safety < 24) {
      if (bill.last_queued_date !== cursor && safety === 0) {
        pushEvent({
          dateISO: referenceDateISO,
          title: `${bill.title} (Tertunda)`,
          direction: bill.transaction_type,
          amount: roundCurrency(bill.amount),
          source: "scheduled_bill",
          category: bill.category,
        });
      }
      cursor = advanceDueDate(cursor, bill.frequency);
      safety += 1;
    }
    safety = 0;
    while (cursor <= endDateISO && safety < 60) {
      if (bill.last_queued_date !== cursor) {
        pushEvent({
          dateISO: cursor,
          title: bill.title,
          direction: bill.transaction_type,
          amount: roundCurrency(bill.amount),
          source: "scheduled_bill",
          category: bill.category,
        });
      }
      cursor = advanceDueDate(cursor, bill.frequency);
      safety += 1;
    }
  }

  // Active debts scheduled installments
  const activeDebts = options.debts
    .map(normalizeDebt)
    .filter((d) => d.status === "active" && d.outstanding_balance > 0);
  const scheduledDebtIds = new Set<string>();

  for (const debt of activeDebts) {
    scheduledDebtIds.add(debt.id);
    const perPayment =
      debt.installment_amount > 0
        ? Math.min(debt.outstanding_balance, debt.installment_amount)
        : 0;
    if (perPayment <= 0 || !debt.due_date) continue;

    let remaining = debt.outstanding_balance;
    let cursor = debt.due_date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cursor)) continue;

    let safety = 0;
    while (cursor < referenceDateISO && safety < 24) {
      if (safety === 0 && remaining > 0) {
        const pay = Math.min(remaining, perPayment);
        pushEvent({
          dateISO: referenceDateISO,
          title: `Cicilan ${debt.creditor}`,
          direction: "expense",
          amount: roundCurrency(pay),
          source: "scheduled_debt",
          category: "Utang & Cicilan",
        });
        remaining = roundCurrency(remaining - pay);
      }
      cursor = advanceDateByDaysOrCycle(cursor, debt.payment_frequency);
      safety += 1;
    }

    safety = 0;
    while (cursor <= endDateISO && remaining > 0.01 && safety < 60) {
      const pay = Math.min(remaining, perPayment);
      pushEvent({
        dateISO: cursor,
        title: `Cicilan ${debt.creditor}`,
        direction: "expense",
        amount: roundCurrency(pay),
        source: "scheduled_debt",
        category: "Utang & Cicilan",
      });
      remaining = roundCurrency(remaining - pay);
      cursor = advanceDateByDaysOrCycle(cursor, debt.payment_frequency);
      safety += 1;
    }
  }

  // Financial reminders that are NOT linked to an already-counted bill or debt (prevents double counting!)
  const activeReminders = options.financialReminders.filter(
    (r) =>
      r.is_active &&
      r.amount > 0 &&
      r.transaction_type !== "transfer" &&
      (!r.linked_bill_id || !scheduledBillIds.has(r.linked_bill_id)) &&
      (!r.linked_debt_id || !scheduledDebtIds.has(r.linked_debt_id))
  );

  for (const rem of activeReminders) {
    let cursor = rem.due_date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cursor)) continue;
    if (rem.frequency === "once") {
      pushEvent({
        dateISO: cursor >= referenceDateISO ? cursor : referenceDateISO,
        title: rem.title,
        direction: rem.transaction_type === "income" ? "income" : "expense",
        amount: roundCurrency(rem.amount),
        source: "scheduled_reminder",
        category:
          rem.transaction_type === "income"
            ? "Gaji & Pendapatan"
            : "Utilitas & Tagihan",
      });
      continue;
    }
    let safety = 0;
    while (cursor < referenceDateISO && safety < 24) {
      cursor = advanceDateByDaysOrCycle(cursor, rem.frequency);
      safety += 1;
    }
    safety = 0;
    while (cursor <= endDateISO && safety < 60) {
      pushEvent({
        dateISO: cursor,
        title: rem.title,
        direction: rem.transaction_type === "income" ? "income" : "expense",
        amount: roundCurrency(rem.amount),
        source: "scheduled_reminder",
        category:
          rem.transaction_type === "income"
            ? "Gaji & Pendapatan"
            : "Utilitas & Tagihan",
      });
      cursor = advanceDateByDaysOrCycle(cursor, rem.frequency);
      safety += 1;
    }
  }

  // 2. Estimate Historical / Variable Daily Flows from Confirmed Transactions (last 90 days)
  const historyStartISO = shiftDateISO(referenceDateISO, -90);
  const postedHistory = options.transactions.filter((tx) => {
    if (!isPostedConfirmed(tx)) return false;
    if (tx.transaction_type !== "income" && tx.transaction_type !== "expense") {
      return false;
    }
    const dt = tx.transaction_date.slice(0, 10);
    return dt >= historyStartISO && dt <= referenceDateISO;
  });

  // Categories already covered by recurring bills/scheduled debt are excluded from variable daily average to avoid double-counting
  const scheduledExpenseCategories = new Set(
    allEvents
      .filter((e) => e.direction === "expense")
      .map((e) => e.category.trim().toLowerCase())
  );

  let historicalVariableExpense = 0;
  let historicalIncomeTotal = 0;
  const distinctHistoryMonths = new Set<string>();

  for (const tx of postedHistory) {
    distinctHistoryMonths.add(tx.transaction_date.slice(0, 7));
    const catLower = (tx.category ?? "").trim().toLowerCase();
    if (tx.transaction_type === "expense") {
      if (!scheduledExpenseCategories.has(catLower)) {
        historicalVariableExpense = roundCurrency(
          historicalVariableExpense + Number(tx.amount)
        );
      }
    } else if (tx.transaction_type === "income") {
      historicalIncomeTotal = roundCurrency(
        historicalIncomeTotal + Number(tx.amount)
      );
    }
  }

  // Observed days window: use actual span between earliest confirmed tx in window and reference date (minimum 30 days so single-day spikes don't distort 365d)
  let observedDays = 30;
  if (postedHistory.length > 0) {
    const earliestTxDate = postedHistory.reduce(
      (min, t) =>
        t.transaction_date.slice(0, 10) < min ? t.transaction_date.slice(0, 10) : min,
      referenceDateISO
    );
    const diffMs =
      new Date(`${referenceDateISO}T00:00:00Z`).getTime() -
      new Date(`${earliestTxDate}T00:00:00Z`).getTime();
    observedDays = Math.max(30, Math.min(90, Math.round(diffMs / 86_400_000) + 1));
  }

  let dailyEstimatedExpense = roundCurrency(historicalVariableExpense / observedDays);

  // If Owner has active category budgets without historical spend exceeding them, include remaining unscheduled discretionary budget pacing conservatively
  const currentMonth = referenceDateISO.slice(0, 7);
  const activeBudgetsThisMonth = (options.categoryBudgets ?? []).filter(
    (b) => b.is_active && b.period_month === currentMonth
  );
  if (dailyEstimatedExpense === 0 && activeBudgetsThisMonth.length > 0) {
    const totalBudgetMonthly = activeBudgetsThisMonth
      .filter((b) => !scheduledExpenseCategories.has(b.category.trim().toLowerCase()))
      .reduce((s, b) => s + Number(b.limit_amount || 0), 0);
    if (totalBudgetMonthly > 0) {
      dailyEstimatedExpense = roundCurrency(totalBudgetMonthly / 30);
    }
  }

  // Conservative rule: NEVER treat historical variable income as guaranteed if scheduled recurring income already exists
  const hasScheduledIncome = allEvents.some((e) => e.direction === "income");
  const dailyEstimatedIncome =
    !hasScheduledIncome && historicalIncomeTotal > 0 && distinctHistoryMonths.size >= 2
      ? roundCurrency((historicalIncomeTotal / observedDays) * 0.7) // conservative 70% discount on irregular income
      : 0;

  const monthlyBaselineExpense =
    dailyEstimatedExpense * 30 +
    allEvents
      .filter((e) => e.direction === "expense")
      .reduce((s, e) => s + e.amount, 0) *
      (30 / Math.max(1, horizonDays));
  const tightBufferThreshold = roundCurrency(
    Math.max(500_000, monthlyBaselineExpense * 0.25)
  );

  // 3. Build daily projection curve
  let runningBalance = startingBalance;
  let scheduledIncome = 0;
  let scheduledExpense = 0;
  let estimatedIncome = 0;
  let estimatedExpense = 0;
  let lowestBalance = startingBalance;
  let lowestBalanceDateISO = referenceDateISO;
  let deficitDaysCount = 0;
  let firstDeficitDateISO: string | null = null;
  let tightBufferDaysCount = 0;

  const dailySeries: ForecastDailyPoint[] = [
    {
      dayIndex: 0,
      dateISO: referenceDateISO,
      label: referenceDateISO.slice(5),
      balance: runningBalance,
      scheduledNet: 0,
      estimatedNet: 0,
      isDeficit: runningBalance < 0,
      isTightBuffer: runningBalance >= 0 && runningBalance < tightBufferThreshold,
    },
  ];

  for (let day = 1; day <= horizonDays; day++) {
    const dateISO = shiftDateISO(referenceDateISO, day);
    const dayEvents = eventsByDate.get(dateISO) ?? [];

    let daySchedIn = 0;
    let daySchedOut = 0;
    for (const ev of dayEvents) {
      if (ev.direction === "income") daySchedIn = roundCurrency(daySchedIn + ev.amount);
      else daySchedOut = roundCurrency(daySchedOut + ev.amount);
    }

    // Apply day-0 overdue events on day 1 if referenceDateISO itself wasn't processed in loop
    if (day === 1) {
      for (const ev of eventsByDate.get(referenceDateISO) ?? []) {
        if (ev.direction === "income") daySchedIn = roundCurrency(daySchedIn + ev.amount);
        else daySchedOut = roundCurrency(daySchedOut + ev.amount);
      }
    }

    scheduledIncome = roundCurrency(scheduledIncome + daySchedIn);
    scheduledExpense = roundCurrency(scheduledExpense + daySchedOut);
    estimatedIncome = roundCurrency(estimatedIncome + dailyEstimatedIncome);
    estimatedExpense = roundCurrency(estimatedExpense + dailyEstimatedExpense);

    const scheduledNet = roundCurrency(daySchedIn - daySchedOut);
    const estimatedNet = roundCurrency(dailyEstimatedIncome - dailyEstimatedExpense);
    runningBalance = roundCurrency(runningBalance + scheduledNet + estimatedNet);

    const isDeficit = runningBalance < 0;
    const isTightBuffer = !isDeficit && runningBalance < tightBufferThreshold;

    if (isDeficit) {
      deficitDaysCount += 1;
      if (!firstDeficitDateISO) firstDeficitDateISO = dateISO;
    } else if (isTightBuffer) {
      tightBufferDaysCount += 1;
    }

    if (runningBalance < lowestBalance) {
      lowestBalance = runningBalance;
      lowestBalanceDateISO = dateISO;
    }

    dailySeries.push({
      dayIndex: day,
      dateISO,
      label: dateISO.slice(5),
      balance: runningBalance,
      scheduledNet,
      estimatedNet,
      isDeficit,
      isTightBuffer,
    });
  }

  const totalPredictedIncome = roundCurrency(scheduledIncome + estimatedIncome);
  const totalPredictedExpense = roundCurrency(scheduledExpense + estimatedExpense);
  const endingBalance = runningBalance;
  const netProjectedChange = roundCurrency(endingBalance - startingBalance);

  // Confidence scoring
  let confidenceTier: ForecastConfidenceTier = "low";
  if (postedHistory.length >= 10 && (activeBills.length > 0 || activeReminders.length > 0)) {
    confidenceTier = "high";
  } else if (postedHistory.length >= 3 || activeBills.length > 0 || activeDebts.length > 0) {
    confidenceTier = "medium";
  }

  const confidenceLabel =
    confidenceTier === "high"
      ? "Tinggi (Riwayat & Jadwal Rutin Lengkap)"
      : confidenceTier === "medium"
        ? "Menengah (Sebagian Data Terjadwal / Historis)"
        : "Rendah (Data Historis & Jadwal Masih Terbatas)";

  const assumptions: string[] = [
    `Saldo awal Rp ${Math.round(startingBalance).toLocaleString("id-ID")} dihitung hanya dari akun aktif & transaksi terposting yang telah dikonfirmasi Owner.`,
    `Arus terjadwal mencakup ${activeBills.length} jadwal rutin, ${activeDebts.length} cicilan utang aktif, dan ${activeReminders.length} pengingat mandiri tanpa penghitungan ganda.`,
  ];
  if (dailyEstimatedExpense > 0) {
    assumptions.push(
      `Estimasi pengeluaran variabel non-jadwal diproyeksikan sebesar Rp ${Math.round(
        dailyEstimatedExpense
      ).toLocaleString("id-ID")}/hari berdasarkan histori ${observedDays} hari & pacing anggaran.`
    );
  } else {
    assumptions.push(
      "Belum ada histori pengeluaran variabel non-jadwal yang cukup; estimasi harian variabel bernilai Rp 0."
    );
  }
  if (!hasScheduledIncome && dailyEstimatedIncome === 0) {
    assumptions.push(
      "Pemasukan tidak pasti belum diasumsikan sebagai pemasukan terjamin sampai Owner mendaftarkan jadwal gaji/pemasukan rutin."
    );
  }

  return {
    horizonDays,
    referenceDateISO,
    startingBalance,
    endingBalance,
    netProjectedChange,
    scheduledIncome,
    scheduledExpense,
    estimatedIncome,
    estimatedExpense,
    totalPredictedIncome,
    totalPredictedExpense,
    lowestBalance,
    lowestBalanceDateISO,
    deficitDaysCount,
    firstDeficitDateISO,
    tightBufferDaysCount,
    tightBufferThreshold,
    confidenceTier,
    confidenceLabel,
    assumptions,
    upcomingEvents: [...allEvents].sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
    dailySeries,
  };
}
