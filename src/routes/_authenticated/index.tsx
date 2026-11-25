import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  BellRing,
  Bot,
  Briefcase,
  Calculator,
  CalendarClock,
  CreditCard,
  Eye,
  EyeOff,
  FlaskConical,
  HeartPulse,
  PieChart,
  Plus,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "../../components/ego/app-shell";
import {
  BudgetUsageChart,
  severityBadgeClass,
} from "../../components/ego/budget-usage-chart";
import { CashflowChart } from "../../components/ego/cashflow-chart";
import { CategoryBreakdown } from "../../components/ego/category-breakdown";
import { AccountTypeIcon, CategoryIcon } from "../../components/ego/category-icon";
import { ModalSheet } from "../../components/ego/modal-sheet";
import { useTransactionSheet } from "../../components/ego/transaction-input-sheet";
import { TtsButton } from "../../components/ego/tts-button";
import { formatPeriodMonthID, summarizeBudgetMonth } from "../../lib/budgets";
import { computeCashflowForecast } from "../../lib/cashflow-forecast";
import {
  accountTypeLabel,
  computeAverageMonthlyCashflow,
  computeBalanceTrend,
  computeGoalProgress,
  computeMonthlyCashflow,
  computeNetWorth,
  daysUntilDue,
  formatDateID,
  formatIDR,
  getDueRecurringBills,
  getGreetingID,
  todayISO,
} from "../../lib/finance";
import { summarizeGoalsForDashboard } from "../../lib/goal-simulator";
import { computeFinancialHealthScore } from "../../lib/health-score";
import { useAuthStatus, useVaultSnapshot } from "../../lib/queries";
import { summarizeRemindersForDashboard } from "../../lib/reminders";
import type { Transaction } from "../../types/ego";

const BALANCE_HIDDEN_KEY = "ego_balance_hidden";

export function DashboardPage() {
  const { data: auth } = useAuthStatus();
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const { openTransactionSheet } = useTransactionSheet();
  const navigate = useNavigate();

  const [chartMonths, setChartMonths] = useState<3 | 6 | 12>(6);
  const [breakdownType, setBreakdownType] = useState<"income" | "expense">(
    "expense"
  );
  const [balanceHidden, setBalanceHidden] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(BALANCE_HIDDEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  function toggleBalanceHidden() {
    setBalanceHidden((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(BALANCE_HIDDEN_KEY, next ? "1" : "0");
      } catch {
        // Ignore storage restrictions
      }
      return next;
    });
  }

  const accounts = vault?.accounts ?? [];
  const transactions = vault?.transactions ?? [];
  const assets = vault?.assets ?? [];
  const debts = vault?.debts ?? [];
  const recurringBills = vault?.recurring_bills ?? [];
  const savingsGoals = vault?.savings_goals ?? [];
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";

  const netWorth = useMemo(
    () => computeNetWorth(accounts, assets, debts),
    [accounts, assets, debts]
  );
  const currentMonth = todayISO().slice(0, 7);
  const cashflow = useMemo(
    () => computeMonthlyCashflow(transactions, currentMonth),
    [transactions, currentMonth]
  );
  const avgCashflow = useMemo(
    () => computeAverageMonthlyCashflow(transactions, 3, currentMonth),
    [transactions, currentMonth]
  );
  const balanceTrend = useMemo(
    () => computeBalanceTrend(transactions, currentMonth),
    [transactions, currentMonth]
  );

  const dueBills = useMemo(
    () => getDueRecurringBills(recurringBills),
    [recurringBills]
  );
  const dueTotal = useMemo(
    () => dueBills.reduce((sum, b) => sum + b.amount, 0),
    [dueBills]
  );
  const activeGoals = useMemo(
    () => savingsGoals.filter((g) => g.status === "active"),
    [savingsGoals]
  );
  const reminderSummary = useMemo(
    () =>
      summarizeRemindersForDashboard(
        vault?.financial_reminders ?? [],
        recurringBills,
        debts
      ),
    [vault?.financial_reminders, recurringBills, debts]
  );
  const goalSummary = useMemo(
    () =>
      summarizeGoalsForDashboard(
        savingsGoals,
        accounts,
        avgCashflow.avgNet
      ),
    [savingsGoals, accounts, avgCashflow.avgNet]
  );
  const budgetSummary = useMemo(
    () =>
      summarizeBudgetMonth(
        vault?.category_budgets ?? [],
        transactions,
        currentMonth,
        vault?.budget_alert_logs ?? [],
        recurringBills,
        vault?.financial_reminders ?? []
      ),
    [
      vault?.category_budgets,
      transactions,
      currentMonth,
      vault?.budget_alert_logs,
      recurringBills,
      vault?.financial_reminders,
    ]
  );

  const health = useMemo(
    () =>
      computeFinancialHealthScore({
        accounts,
        transactions,
        assets,
        debts,
        categoryBudgets: vault?.category_budgets ?? [],
        budgetAlertLogs: vault?.budget_alert_logs ?? [],
        savingsGoals,
        referenceDateISO: todayISO(),
      }),
    [
      accounts,
      transactions,
      assets,
      debts,
      vault?.category_budgets,
      vault?.budget_alert_logs,
      savingsGoals,
    ]
  );

  const forecast30 = useMemo(
    () =>
      computeCashflowForecast({
        accounts,
        transactions,
        recurringBills,
        financialReminders: vault?.financial_reminders ?? [],
        debts,
        categoryBudgets: vault?.category_budgets ?? [],
        horizonDays: 30,
        referenceDateISO: todayISO(),
      }),
    [
      accounts,
      transactions,
      recurringBills,
      vault?.financial_reminders,
      debts,
      vault?.category_budgets,
    ]
  );

  const recentTx = transactions.slice(0, 5);
  const activeAccounts = accounts.filter((a) => a.is_active);
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const pendingCommands =
    vault?.owner_commands.filter((c) => c.status === "pending").length ?? 0;

  const ownerName = auth?.owner?.full_name?.trim() || "Owner";
  const greeting = getGreetingID();
  const maskedMoney = "Rp ••••••••";

  const summarySpeechText = `Ringkasan Keuangan Owner saat ini. Kekayaan bersih Anda adalah ${formatIDR(
    netWorth.netWorth
  )}. Total saldo kas dan rekening mencapai ${formatIDR(
    netWorth.totalAccountBalance
  )}, total nilai aset ${formatIDR(
    netWorth.totalAssetValue
  )}, dan sisa kewajiban utang sebesar ${formatIDR(
    netWorth.totalDebtBalance
  )}. Pada bulan ini, pemasukan terposting sebesar ${formatIDR(
    cashflow.income
  )} dan pengeluaran terposting sebesar ${formatIDR(cashflow.expense)}.`;

  return (
    <AppShell
      title={`${greeting}, ${ownerName}`}
      subtitle="Pusat kendali kekayaan, arus kas, dan aktivitas finansial pribadi."
      action={
        <div className="flex items-center gap-2">
          <TtsButton
            text={summarySpeechText}
            label="Bacakan Ringkasan"
            compact
          />
          <button
            type="button"
            onClick={() => openTransactionSheet()}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-[#087BFF]/20 transition-all hover:brightness-110 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Catat Transaksi</span>
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-5">
          <div className="h-52 animate-pulse rounded-3xl border border-[#DCE4F0] bg-white dark:border-[#1B3163] dark:bg-[#091634]" />
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-2xl border border-[#DCE4F0] bg-white dark:border-[#1B3163] dark:bg-[#091634]"
              />
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="h-80 animate-pulse rounded-2xl border border-[#DCE4F0] bg-white dark:border-[#1B3163] dark:bg-[#091634] lg:col-span-7" />
            <div className="h-80 animate-pulse rounded-2xl border border-[#DCE4F0] bg-white dark:border-[#1B3163] dark:bg-[#091634] lg:col-span-5" />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* B. Primary Balance Hero Card */}
          <section
            aria-label="Kartu Saldo Utama"
            className="ego-card-hero relative overflow-hidden rounded-3xl border border-[#1B3163] p-5 text-white shadow-xl shadow-[#06132F]/20 sm:p-7"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#C7D0E0]/80">
                    Total Saldo Likuid
                  </span>
                  <button
                    type="button"
                    onClick={toggleBalanceHidden}
                    aria-label={
                      balanceHidden ? "Tampilkan saldo" : "Sembunyikan saldo"
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-[#C7D0E0] transition-colors hover:bg-white/20 hover:text-white"
                  >
                    {balanceHidden ? (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>

                <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-white tabular-nums sm:text-4xl">
                  {balanceHidden
                    ? maskedMoney
                    : formatIDR(netWorth.totalAccountBalance)}
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                  {balanceTrend.hasBaseline ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono font-semibold tabular-nums ${
                        balanceTrend.deltaAmount >= 0
                          ? "bg-[#19D8FF]/15 text-[#19D8FF]"
                          : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {balanceTrend.deltaAmount >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>
                        {balanceTrend.deltaAmount >= 0 ? "+" : ""}
                        {balanceHidden
                          ? "••••"
                          : formatIDR(balanceTrend.deltaAmount, true)}
                        {balanceTrend.deltaPercent !== null
                          ? ` (${balanceTrend.deltaPercent > 0 ? "+" : ""}${balanceTrend.deltaPercent}%)`
                          : ""}{" "}
                        vs bulan lalu
                      </span>
                    </span>
                  ) : null}

                  <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[#C7D0E0] tabular-nums">
                    Bulan ini: Masuk{" "}
                    <strong className="text-[#19D8FF]">
                      {balanceHidden ? "••••" : formatIDR(cashflow.income, true)}
                    </strong>{" "}
                    · Keluar{" "}
                    <strong className="text-rose-300">
                      {balanceHidden ? "••••" : formatIDR(cashflow.expense, true)}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-start gap-2 sm:items-end">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-xs">
                  <p className="text-[11px] text-[#C7D0E0]/75">
                    Kekayaan Bersih
                  </p>
                  <p
                    className={`mt-0.5 font-mono text-base font-bold tabular-nums ${
                      netWorth.netWorth >= 0 ? "text-[#19D8FF]" : "text-rose-300"
                    }`}
                  >
                    {balanceHidden ? maskedMoney : formatIDR(netWorth.netWorth)}
                  </p>
                </div>
                {pendingCommands > 0 ? (
                  <Link
                    to="/owner"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#19D8FF]/35 bg-[#19D8FF]/15 px-3 py-1.5 text-xs font-semibold text-[#19D8FF] transition-colors hover:bg-[#19D8FF]/25"
                  >
                    <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{pendingCommands} draf AI menunggu persetujuan</span>
                  </Link>
                ) : null}
              </div>
            </div>

            {/* Per-Account Breakdown inside Hero */}
            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#C7D0E0]/85">
                  Rincian Saldo Akun ({activeAccounts.length} Aktif)
                </span>
                <Link
                  to="/akun"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#19D8FF] hover:underline"
                >
                  <span>Kelola Akun</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>

              {activeAccounts.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-xs text-[#C7D0E0]">
                  <span>
                    Belum ada dompet, rekening bank, atau e-wallet terdaftar.
                  </span>
                  <Link
                    to="/akun"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#087BFF] px-3 py-1.5 font-semibold text-white hover:bg-[#0666DB]"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tambah Akun</span>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  {activeAccounts.slice(0, 4).map((acc) => (
                    <Link
                      key={acc.id}
                      to="/transaksi"
                      search={{ akun: acc.id }}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/7 px-3.5 py-2.5 transition-colors hover:border-[#19D8FF]/45 hover:bg-white/12"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#087BFF]/25 text-[#19D8FF]">
                          <AccountTypeIcon
                            type={acc.account_type}
                            className="h-4 w-4"
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white">
                            {acc.account_name}
                          </p>
                          <p className="text-[11px] text-[#C7D0E0]/70">
                            {accountTypeLabel(acc.account_type)}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-white">
                        {balanceHidden
                          ? "••••••"
                          : formatIDR(acc.current_balance, true)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* C. Quick Actions */}
          <section aria-label="Aksi Cepat">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              <button
                type="button"
                onClick={() => openTransactionSheet({ type: "expense" })}
                className="flex min-h-[76px] flex-col items-start justify-between rounded-2xl border border-[#DCE4F0] bg-white p-3.5 text-left transition-all hover:border-[#087BFF]/50 hover:shadow-sm dark:border-[#1B3163] dark:bg-[#091634] dark:hover:border-[#19D8FF]/50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#19D8FF] to-[#087BFF] text-white shadow-xs">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="mt-2 text-xs font-bold text-[#06132F] dark:text-white">
                  Catat Transaksi
                </span>
              </button>

              <button
                type="button"
                onClick={() => openTransactionSheet({ type: "transfer" })}
                className="flex min-h-[76px] flex-col items-start justify-between rounded-2xl border border-[#DCE4F0] bg-white p-3.5 text-left transition-all hover:border-[#087BFF]/50 hover:shadow-sm dark:border-[#1B3163] dark:bg-[#091634] dark:hover:border-[#19D8FF]/50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#087BFF]/12 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                  <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="mt-2 text-xs font-bold text-[#06132F] dark:text-white">
                  Transfer
                </span>
              </button>

              <Link
                to="/aset"
                className="flex min-h-[76px] flex-col items-start justify-between rounded-2xl border border-[#DCE4F0] bg-white p-3.5 text-left transition-all hover:border-[#087BFF]/50 hover:shadow-sm dark:border-[#1B3163] dark:bg-[#091634] dark:hover:border-[#19D8FF]/50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#087BFF]/12 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                  <Briefcase className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="mt-2 text-xs font-bold text-[#06132F] dark:text-white">
                  Tambah Aset
                </span>
              </Link>

              <Link
                to="/utang"
                className="flex min-h-[76px] flex-col items-start justify-between rounded-2xl border border-[#DCE4F0] bg-white p-3.5 text-left transition-all hover:border-[#087BFF]/50 hover:shadow-sm dark:border-[#1B3163] dark:bg-[#091634] dark:hover:border-[#19D8FF]/50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="mt-2 text-xs font-bold text-[#06132F] dark:text-white">
                  Bayar Utang
                </span>
              </Link>

              <Link
                to="/laporan"
                className="col-span-2 flex min-h-[76px] flex-col items-start justify-between rounded-2xl border border-[#DCE4F0] bg-white p-3.5 text-left transition-all hover:border-[#087BFF]/50 hover:shadow-sm dark:border-[#1B3163] dark:bg-[#091634] dark:hover:border-[#19D8FF]/50 sm:col-span-1"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#06132F] text-[#19D8FF] dark:bg-[#122652]">
                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="mt-2 text-xs font-bold text-[#06132F] dark:text-white">
                  Lihat Laporan
                </span>
              </Link>
            </div>
          </section>

          {/* D. Financial Charts */}
          <section className="grid gap-5 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <CashflowChart
                transactions={transactions}
                monthsCount={chartMonths}
                onMonthsCountChange={setChartMonths}
                referenceMonth={currentMonth}
                onAddTransaction={() => openTransactionSheet()}
              />
            </div>

            <div className="lg:col-span-5">
              <CategoryBreakdown
                title="Kategori Bulan Ini"
                subtitle={`${
                  breakdownType === "expense" ? "Pengeluaran" : "Pemasukan"
                } pada ${currentMonth}`}
                transactions={transactions}
                type={breakdownType}
                onTypeChange={setBreakdownType}
                yearMonth={currentMonth}
                maxItems={5}
                onAddTransaction={() =>
                  openTransactionSheet({ type: breakdownType })
                }
                onSelectCategory={(cat, txType) => {
                  void navigate({
                    to: "/transaksi",
                    search: { kategori: cat, jenis: txType },
                  });
                }}
              />
            </div>
          </section>

          {/* E. Financial Summary Cards */}
          <section aria-label="Ringkasan Finansial">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#06132F] dark:text-white">
                Ringkasan Posisi Keuangan
              </h2>
              <span className="text-[11px] font-medium text-slate-500 dark:text-[#C7D0E0]/70">
                Data aktual terverifikasi
              </span>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
              <Link
                to="/aset"
                className="rounded-2xl border border-[#DCE4F0] bg-white p-4 transition-colors hover:border-[#087BFF]/45 dark:border-[#1B3163] dark:bg-[#091634] dark:hover:border-[#19D8FF]/45"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                  <span>Total Aset</span>
                  <Briefcase className="h-4 w-4 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
                </div>
                <p className="mt-2 font-mono text-base font-bold tabular-nums text-[#06132F] dark:text-white">
                  {balanceHidden
                    ? "••••••"
                    : formatIDR(netWorth.totalAssetValue)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-[#C7D0E0]/65">
                  {assets.length} instrumen tercatat
                </p>
              </Link>

              <Link
                to="/utang"
                className="rounded-2xl border border-[#DCE4F0] bg-white p-4 transition-colors hover:border-[#087BFF]/45 dark:border-[#1B3163] dark:bg-[#091634] dark:hover:border-[#19D8FF]/45"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                  <span>Total Utang</span>
                  <CreditCard className="h-4 w-4 text-rose-500" aria-hidden="true" />
                </div>
                <p className="mt-2 font-mono text-base font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  {balanceHidden
                    ? "••••••"
                    : formatIDR(netWorth.totalDebtBalance)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-[#C7D0E0]/65">
                  {debts.filter((d) => d.status === "active").length} kewajiban aktif
                </p>
              </Link>

              <Link
                to="/laporan"
                className="rounded-2xl border border-[#DCE4F0] bg-white p-4 transition-colors hover:border-[#087BFF]/45 dark:border-[#1B3163] dark:bg-[#091634] dark:hover:border-[#19D8FF]/45"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                  <span>Kekayaan Bersih</span>
                  <ShieldCheck className="h-4 w-4 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
                </div>
                <p className="mt-2 font-mono text-base font-bold tabular-nums text-[#087BFF] dark:text-[#19D8FF]">
                  {balanceHidden ? "••••••" : formatIDR(netWorth.netWorth)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-[#C7D0E0]/65">
                  {avgCashflow.avgExpense > 0
                    ? `Rata beban ${formatIDR(avgCashflow.avgExpense, true)}/bln`
                    : "Kas + Aset − Utang"}
                </p>
              </Link>

              <Link
                to="/rencana"
                search={{ tab: "target" }}
                className="rounded-2xl border border-[#DCE4F0] bg-white p-4 transition-colors hover:border-[#087BFF]/45 dark:border-[#1B3163] dark:bg-[#091634] dark:hover:border-[#19D8FF]/45"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                  <span>Target Keuangan</span>
                  <Target className="h-4 w-4 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
                </div>
                {activeGoals[0] ? (
                  <>
                    {(() => {
                      const g = activeGoals[0];
                      const linked = g.linked_account_id
                        ? accountMap.get(g.linked_account_id)
                        : undefined;
                      const prog = computeGoalProgress(g, linked);
                      return (
                        <>
                          <p className="mt-2 truncate text-sm font-bold text-[#06132F] dark:text-white">
                            {g.title}
                          </p>
                          <p className="mt-1 font-mono text-[11px] font-semibold text-[#087BFF] dark:text-[#19D8FF]">
                            {prog.percentage}% tercapai · {activeGoals.length} aktif
                          </p>
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <p className="mt-2 font-mono text-base font-bold text-[#06132F] dark:text-white">
                      {activeGoals.length} Aktif
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-[#C7D0E0]/65">
                      Atur target tabungan
                    </p>
                  </>
                )}
              </Link>

              <Link
                to="/rencana"
                search={{ tab: "tagihan" }}
                className="rounded-2xl border border-[#DCE4F0] bg-white p-4 transition-colors hover:border-[#087BFF]/45 dark:border-[#1B3163] dark:bg-[#091634] dark:hover:border-[#19D8FF]/45"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                  <span>Tagihan Mendatang</span>
                  <CalendarClock
                    className={`h-4 w-4 ${
                      dueBills.length > 0
                        ? "text-amber-500"
                        : "text-[#087BFF] dark:text-[#19D8FF]"
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <p
                  className={`mt-2 font-mono text-base font-bold tabular-nums ${
                    dueBills.length > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-[#06132F] dark:text-white"
                  }`}
                >
                  {dueBills.length > 0 ? formatIDR(dueTotal) : "0 Tagihan"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-[#C7D0E0]/65">
                  {dueBills.length > 0
                    ? `${dueBills.length} jadwal jatuh tempo ≤ 7 hari`
                    : "Aman 7 hari ke depan"}
                </p>
              </Link>
            </div>
          </section>

          {/* E2. Financial Reminder & Goal Simulator Compact Cards */}
          <section
            aria-label="Ringkasan Pengingat dan Simulator Target"
            className="grid gap-4 lg:grid-cols-2"
          >
            {/* Card 1: Financial Reminder */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#087BFF]/12 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                      <BellRing className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-[#06132F] dark:text-white">
                        Pengingat Keuangan
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                        {reminderSummary.totalActiveCount} pengingat aktif ·{" "}
                        {reminderSummary.upcomingBillsCount} tagihan mendatang
                      </p>
                    </div>
                  </div>
                  {reminderSummary.overdueCount > 0 ? (
                    <span className="rounded-lg bg-rose-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {reminderSummary.overdueCount} Terlambat
                    </span>
                  ) : reminderSummary.dueTodayCount > 0 ? (
                    <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                      {reminderSummary.dueTodayCount} Hari Ini
                    </span>
                  ) : null}
                </div>

                {reminderSummary.nearestReminder ? (
                  <div className="rounded-xl border border-[#DCE4F0]/90 bg-[#F4F7FB] p-3 dark:border-[#1B3163] dark:bg-[#06132F]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#C7D0E0]/65">
                        Pengingat Terdekat
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          reminderSummary.nearestReminder.isOverdue
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-[#087BFF] dark:text-[#19D8FF]"
                        }`}
                      >
                        {reminderSummary.nearestReminder.daysRemaining === null
                          ? formatDateID(
                              reminderSummary.nearestReminder.dueDate,
                              dateFormat
                            )
                          : reminderSummary.nearestReminder.daysRemaining < 0
                            ? `Terlambat ${Math.abs(reminderSummary.nearestReminder.daysRemaining)} hari`
                            : reminderSummary.nearestReminder.daysRemaining === 0
                              ? "Jatuh tempo hari ini"
                              : `${reminderSummary.nearestReminder.daysRemaining} hari lagi`}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-bold text-[#06132F] dark:text-white">
                        {reminderSummary.nearestReminder.title}
                      </p>
                      <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-[#06132F] dark:text-[#19D8FF]">
                        {balanceHidden
                          ? "••••••"
                          : formatIDR(reminderSummary.nearestReminder.amount)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#DCE4F0] bg-[#F4F7FB]/70 p-3 text-xs text-slate-600 dark:border-[#1B3163] dark:bg-[#06132F]/60 dark:text-[#C7D0E0]/75">
                    Belum ada pengingat jatuh tempo aktif. Tambah jadwal atau sinkronkan tagihan &amp; utang.
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-[#C7D0E0]/80">
                  <span>
                    Setoran tabungan berikutnya:{" "}
                    <strong className="text-[#06132F] dark:text-white">
                      {reminderSummary.nextSavingsDeposit
                        ? `${reminderSummary.nextSavingsDeposit.title} (${formatDateID(reminderSummary.nextSavingsDeposit.dueDate, dateFormat)})`
                        : "Belum dijadwalkan"}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#DCE4F0]/80 pt-3 dark:border-[#1B3163]">
                <span className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/65">
                  Konfirmasi Owner wajib sebelum saldo berubah
                </span>
                <Link
                  to="/pengingat"
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-[#087BFF]/10 px-3 py-1.5 text-xs font-semibold text-[#087BFF] transition-colors hover:bg-[#087BFF]/15 whitespace-nowrap dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                >
                  <span>Pusat Pengingat</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Card 2: Goal Simulator */}
            <div className="flex flex-col justify-between rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#087BFF]/12 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                      <Calculator className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-[#06132F] dark:text-white">
                        Simulator Target Keuangan
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                        {goalSummary.activeGoalsCount} target aktif ·{" "}
                        {goalSummary.completedGoalsCount} tercapai
                      </p>
                    </div>
                  </div>
                  {goalSummary.atRiskCount > 0 ? (
                    <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                      {goalSummary.atRiskCount} Perlu Perhatian
                    </span>
                  ) : goalSummary.activeGoalsCount > 0 ? (
                    <span className="rounded-lg bg-[#087BFF]/15 px-2 py-0.5 font-mono text-[11px] font-bold text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF] tabular-nums">
                      On Track
                    </span>
                  ) : null}
                </div>

                {goalSummary.primaryGoal ? (
                  <div className="rounded-xl border border-[#DCE4F0]/90 bg-[#F4F7FB] p-3 dark:border-[#1B3163] dark:bg-[#06132F]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold text-[#06132F] dark:text-white">
                        Target Utama: {goalSummary.primaryGoal.title}
                      </span>
                      <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-[#087BFF] dark:text-[#19D8FF]">
                        {goalSummary.primaryGoal.progressPct}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-[#132652]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#087BFF] to-[#19D8FF] transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(0, goalSummary.overallProgressPct))}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-[#C7D0E0]/75">
                      <span>
                        Progres gabungan:{" "}
                        <strong className="font-mono tabular-nums text-[#06132F] dark:text-white">
                          {goalSummary.overallProgressPct}%
                        </strong>
                      </span>
                      <span>
                        ETA:{" "}
                        <strong className="text-[#087BFF] dark:text-[#19D8FF]">
                          {goalSummary.primaryGoal.etaText}
                        </strong>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#DCE4F0] bg-[#F4F7FB]/70 p-3 text-xs text-slate-600 dark:border-[#1B3163] dark:bg-[#06132F]/60 dark:text-[#C7D0E0]/75">
                    Belum ada target tabungan terdaftar. Jalankan simulasi skenario setoran kapan saja tanpa mengubah saldo.
                  </div>
                )}

                <p className="text-xs text-slate-600 dark:text-[#C7D0E0]/80">
                  Bandingkan skenario Konservatif, Normal, dan Optimistis berdasarkan surplus kas Anda.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#DCE4F0]/80 pt-3 dark:border-[#1B3163]">
                <span className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/65">
                  Terhubung ke data target &amp; pengingat setoran
                </span>
                <Link
                  to="/rencana"
                  search={{ tab: "simulator" }}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-[#087BFF]/10 px-3 py-1.5 text-xs font-semibold text-[#087BFF] transition-colors hover:bg-[#087BFF]/15 whitespace-nowrap dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                >
                  <span>Buka Simulator</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>

          {/* E2B. EGO Complete Ecosystem Overview Cards */}
          <section
            aria-label="Ekosistem Analitik, Simulasi, dan EGO AI Core"
            className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Link
              to="/analitik"
              className="rounded-2xl border border-[#DCE4F0] bg-white p-4 transition-colors hover:border-[#087BFF]/45 dark:border-[#1B3163] dark:bg-[#091634] dark:hover:border-[#19D8FF]/45"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                <span>Financial Health Score</span>
                <HeartPulse className="h-4 w-4 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
              </div>
              <p className="mt-2 font-mono text-lg font-bold tabular-nums text-[#06132F] dark:text-white">
                {health.totalScore !== null ? `${health.totalScore}/100` : "—"}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-[#087BFF] dark:text-[#19D8FF]">
                {health.grade}
                {health.isDataIncomplete ? " · Data Parsial" : ""}
              </p>
            </Link>

            <Link
              to="/analitik"
              className="rounded-2xl border border-[#DCE4F0] bg-white p-4 transition-colors hover:border-[#087BFF]/45 dark:border-[#1B3163] dark:bg-[#091634] dark:hover:border-[#19D8FF]/45"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                <span>Proyeksi Saldo 30 Hari</span>
                <Activity className="h-4 w-4 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
              </div>
              <p
                className={`mt-2 font-mono text-base font-bold tabular-nums ${
                  forecast30.endingBalance < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-[#06132F] dark:text-white"
                }`}
              >
                {balanceHidden ? "••••••" : formatIDR(forecast30.endingBalance)}
              </p>
              <p
                className={`mt-1 text-[11px] font-semibold ${
                  forecast30.deficitDaysCount > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {forecast30.deficitDaysCount > 0
                  ? `Risiko defisit ${forecast30.deficitDaysCount} hari`
                  : "Arus kas 30 hari aman"}
              </p>
            </Link>

            <Link
              to="/simulasi"
              className="rounded-2xl border border-[#DCE4F0] bg-white p-4 transition-colors hover:border-[#087BFF]/45 dark:border-[#1B3163] dark:bg-[#091634] dark:hover:border-[#19D8FF]/45"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                <span>What-If Simulator</span>
                <FlaskConical className="h-4 w-4 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm font-bold text-[#06132F] dark:text-white">
                Uji Keputusan Finansial
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                {(vault?.whatif_scenarios ?? []).length} skenario tersimpan · Aman &amp; terisolasi
              </p>
            </Link>

            <Link
              to="/owner"
              search={{ tab: "ai" }}
              className="rounded-2xl border border-[#DCE4F0] bg-white p-4 transition-colors hover:border-[#087BFF]/45 dark:border-[#1B3163] dark:bg-[#091634] dark:hover:border-[#19D8FF]/45"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                <span>EGO AI Core</span>
                <Bot className="h-4 w-4 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm font-bold text-[#06132F] dark:text-white">
                Konsultan Keuangan AI
              </p>
              <p className="mt-1 text-[11px] text-[#087BFF] dark:text-[#19D8FF]">
                Analisis aktual, estimasi &amp; rekomendasi
              </p>
            </Link>
          </section>

          {/* E3. Smart Budget Monitor Dashboard Widget */}
          <section
            aria-label="Ringkasan Smart Budget Monitor"
            className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#087BFF]/12 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                  <PieChart className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[#06132F] dark:text-white">
                    Smart Budget Monitor — {formatPeriodMonthID(currentMonth)}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/75">
                    {budgetSummary.activeCount > 0
                      ? `${budgetSummary.activeCount} anggaran aktif · Dihitung hanya dari pengeluaran terkonfirmasi Owner`
                      : "Atur batas anggaran bulanan per kategori pengeluaran Anda"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {budgetSummary.attentionCount > 0 ? (
                  <span className="rounded-lg bg-rose-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    {budgetSummary.attentionCount} Mendekati / Melewati Batas
                  </span>
                ) : budgetSummary.activeCount > 0 ? (
                  <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    Semua Aman
                  </span>
                ) : null}
                <Link
                  to="/anggaran"
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-[#087BFF]/10 px-3 py-1.5 text-xs font-semibold text-[#087BFF] transition-colors hover:bg-[#087BFF]/15 whitespace-nowrap dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                >
                  <span>Kelola Anggaran</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {budgetSummary.activeCount === 0 ? (
              <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-dashed border-[#DCE4F0] bg-[#F4F7FB]/70 p-4 text-center sm:flex-row sm:text-left dark:border-[#1B3163] dark:bg-[#06132F]/60">
                <p className="text-xs text-slate-600 dark:text-[#C7D0E0]/80">
                  Belum ada kategori anggaran aktif untuk {formatPeriodMonthID(currentMonth)}.
                  Buat batas per kategori agar EGO memantau ambang 50%, 75%, 90%, 100%, dan &gt;100%.
                </p>
                <Link
                  to="/anggaran"
                  className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0666DB]"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Buat Anggaran</span>
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* 3 Budget KPI Strips */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3 dark:border-[#1B3163] dark:bg-[#06132F]">
                    <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                      Total Anggaran Bulanan
                    </p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-[#06132F] dark:text-white">
                      {balanceHidden ? maskedMoney : formatIDR(budgetSummary.totalBudget)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3 dark:border-[#1B3163] dark:bg-[#06132F]">
                    <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                      Pengeluaran Terkonfirmasi
                    </p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-[#087BFF] dark:text-[#19D8FF]">
                      {balanceHidden
                        ? maskedMoney
                        : formatIDR(budgetSummary.totalSpentBudgeted)}{" "}
                      <span className="text-xs font-normal text-slate-500 dark:text-[#C7D0E0]/70">
                        ({budgetSummary.overallUsagePct.toFixed(0)}%)
                      </span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3 dark:border-[#1B3163] dark:bg-[#06132F]">
                    <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                      Sisa Anggaran
                    </p>
                    <p
                      className={`mt-1 font-mono text-base font-bold tabular-nums ${
                        budgetSummary.remainingBudget < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {balanceHidden
                        ? maskedMoney
                        : budgetSummary.remainingBudget < 0
                          ? `-${formatIDR(Math.abs(budgetSummary.remainingBudget))}`
                          : formatIDR(budgetSummary.remainingBudget)}
                    </p>
                  </div>
                </div>

                {/* Usage Chart + Top Usage / Warning Categories */}
                <div className="grid gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-7">
                    <BudgetUsageChart
                      items={budgetSummary.topCategories}
                      compact
                      balanceHidden={balanceHidden}
                      onSelectCategory={(cat) => {
                        void navigate({
                          to: "/transaksi",
                          search: { kategori: cat, jenis: "expense" },
                        });
                      }}
                    />
                  </div>

                  <div className="space-y-3 lg:col-span-5">
                    <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F]">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="text-xs font-bold text-[#06132F] dark:text-white">
                          Penggunaan Tertinggi
                        </h3>
                        <span className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                          Top {Math.min(3, budgetSummary.topCategories.length)}
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {budgetSummary.topCategories.slice(0, 3).map((item) => (
                          <li
                            key={item.budget.id}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${severityBadgeClass(
                                  item.severity
                                )}`}
                              >
                                {item.usagePct.toFixed(0)}%
                              </span>
                              <span className="truncate font-semibold text-[#06132F] dark:text-white">
                                {item.budget.category}
                              </span>
                            </div>
                            <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-slate-600 dark:text-[#C7D0E0]">
                              {balanceHidden ? "••••" : formatIDR(item.spentAmount, true)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {budgetSummary.alertCategories.length > 0 ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50/75 p-3.5 dark:border-rose-500/35 dark:bg-rose-500/10">
                        <p className="text-xs font-bold text-rose-800 dark:text-rose-200">
                          Indikator Mendekati / Melewati Batas
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {budgetSummary.alertCategories.slice(0, 3).map((a) => (
                            <li
                              key={a.budget.id}
                              className="flex items-center justify-between gap-2 text-[11px] text-rose-900 dark:text-rose-100"
                            >
                              <span className="truncate font-semibold">
                                {a.budget.category}
                              </span>
                              <span className="shrink-0 font-mono font-bold">
                                {a.shortLabel} ({a.usagePct.toFixed(0)}%)
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* F. Recent Transactions */}
          <section
            aria-label="Transaksi Terbaru"
            className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                  Transaksi Terbaru
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#C7D0E0]/70">
                  Ketuk transaksi untuk melihat rincian lengkap.
                </p>
              </div>
              <Link
                to="/transaksi"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-1.5 text-xs font-semibold text-[#087BFF] transition-colors hover:bg-[#087BFF]/10 whitespace-nowrap dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#19D8FF]"
              >
                <span>Lihat Semua</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            {recentTx.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#DCE4F0] bg-[#F4F7FB] px-4 py-8 text-center dark:border-[#1B3163] dark:bg-[#06132F]">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                  <Wallet className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-bold text-[#06132F] dark:text-white">
                  Belum ada catatan transaksi
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                  Ketuk tombol + di navigasi bawah atau Catat Transaksi untuk memulai.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => openTransactionSheet()}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0666DB]"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Catat Transaksi</span>
                  </button>
                  <Link
                    to="/owner"
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#DCE4F0] bg-white px-4 py-2 text-xs font-semibold text-[#06132F] hover:bg-slate-50 dark:border-[#1B3163] dark:bg-[#091634] dark:text-[#C7D0E0]"
                  >
                    <Bot className="h-3.5 w-3.5 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
                    <span>Tanya EGO AI</span>
                  </Link>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-[#DCE4F0]/80 dark:divide-[#1B3163]/80">
                {recentTx.map((tx) => {
                  const isCancelled = tx.status === "cancelled";
                  const srcName = tx.source_account_id
                    ? accountMap.get(tx.source_account_id)?.account_name ?? "Akun"
                    : null;
                  const dstName = tx.destination_account_id
                    ? accountMap.get(tx.destination_account_id)?.account_name ??
                      "Akun"
                    : null;
                  const accountFlow =
                    tx.transaction_type === "transfer"
                      ? `${srcName ?? "?"} → ${dstName ?? "?"}`
                      : tx.transaction_type === "income"
                        ? dstName ?? "—"
                        : srcName ?? "—";

                  const sign =
                    tx.transaction_type === "income"
                      ? "+"
                      : tx.transaction_type === "expense"
                        ? "-"
                        : "⇄ ";

                  const amtColor = isCancelled
                    ? "text-slate-400 line-through dark:text-slate-500"
                    : tx.transaction_type === "income"
                      ? "text-[#087BFF] dark:text-[#19D8FF]"
                      : tx.transaction_type === "expense"
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-[#06132F] dark:text-[#C7D0E0]";

                  const iconWrapCls = isCancelled
                    ? "bg-slate-100 text-slate-400 dark:bg-[#06132F] dark:text-slate-500"
                    : tx.transaction_type === "income"
                      ? "bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                      : tx.transaction_type === "expense"
                        ? "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
                        : "bg-[#06132F]/8 text-[#06132F] dark:bg-[#122652] dark:text-[#C7D0E0]";

                  return (
                    <li key={tx.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTx(tx)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-[#F4F7FB] dark:hover:bg-[#06132F]/70"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconWrapCls}`}
                          >
                            <CategoryIcon
                              category={tx.category}
                              transactionType={tx.transaction_type}
                              className="h-4 w-4"
                            />
                          </span>
                          <div className="min-w-0">
                            <p
                              className={`truncate text-sm font-semibold ${
                                isCancelled
                                  ? "text-slate-400 line-through dark:text-slate-500"
                                  : "text-[#06132F] dark:text-white"
                              }`}
                            >
                              {tx.description || tx.category || "Mutasi Kas"}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-[#C7D0E0]/70">
                              {formatDateID(tx.transaction_date, dateFormat)} ·{" "}
                              {accountFlow} · {tx.category || "Umum"}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p
                            className={`font-mono text-sm font-bold tabular-nums whitespace-nowrap ${amtColor}`}
                          >
                            {sign}
                            {balanceHidden ? "••••" : formatIDR(tx.amount)}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-[#C7D0E0]/55">
                            {isCancelled ? "Dibatalkan" : "Terposting"}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {dueBills.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
                <span className="font-medium text-amber-900 dark:text-amber-200">
                  Pengingat: {dueBills[0].title}{" "}
                  {(() => {
                    const d = daysUntilDue(dueBills[0].next_due_date);
                    if (d === null) return "";
                    if (d < 0) return `terlambat ${Math.abs(d)} hari`;
                    if (d === 0) return "jatuh tempo hari ini";
                    return `${d} hari lagi`;
                  })()}
                </span>
                <Link
                  to="/rencana"
                  search={{ tab: "tagihan" }}
                  className="font-bold text-amber-800 underline dark:text-amber-300"
                >
                  Lihat Tagihan
                </Link>
              </div>
            ) : null}
          </section>
        </div>
      )}

      {/* Transaction Detail ModalSheet */}
      <ModalSheet
        open={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        title="Detail Transaksi"
        subtitle={
          selectedTx
            ? formatDateID(selectedTx.transaction_date, dateFormat)
            : undefined
        }
      >
        {selectedTx ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] p-4 text-center dark:border-[#1B3163] dark:bg-[#06132F]">
              <p className="text-xs font-medium text-slate-500 dark:text-[#C7D0E0]/75">
                {selectedTx.transaction_type === "income"
                  ? "Pemasukan"
                  : selectedTx.transaction_type === "expense"
                    ? "Pengeluaran"
                    : "Transfer Internal"}
              </p>
              <p
                className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                  selectedTx.status === "cancelled"
                    ? "text-slate-400 line-through"
                    : selectedTx.transaction_type === "income"
                      ? "text-[#087BFF] dark:text-[#19D8FF]"
                      : selectedTx.transaction_type === "expense"
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-[#06132F] dark:text-white"
                }`}
              >
                {formatIDR(selectedTx.amount)}
              </p>
            </div>

            <dl className="divide-y divide-[#DCE4F0] text-xs dark:divide-[#1B3163]">
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500 dark:text-[#C7D0E0]/70">
                  Keterangan
                </dt>
                <dd className="text-right font-semibold text-[#06132F] dark:text-white">
                  {selectedTx.description || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500 dark:text-[#C7D0E0]/70">
                  Kategori
                </dt>
                <dd className="text-right font-semibold text-[#06132F] dark:text-white">
                  {selectedTx.category || "Umum"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500 dark:text-[#C7D0E0]/70">Akun</dt>
                <dd className="text-right font-semibold text-[#06132F] dark:text-white">
                  {selectedTx.transaction_type === "transfer"
                    ? `${
                        selectedTx.source_account_id
                          ? accountMap.get(selectedTx.source_account_id)
                              ?.account_name ?? "Akun"
                          : "?"
                      } → ${
                        selectedTx.destination_account_id
                          ? accountMap.get(selectedTx.destination_account_id)
                              ?.account_name ?? "Akun"
                          : "?"
                      }`
                    : selectedTx.transaction_type === "income"
                      ? selectedTx.destination_account_id
                        ? accountMap.get(selectedTx.destination_account_id)
                            ?.account_name ?? "Akun"
                        : "—"
                      : selectedTx.source_account_id
                        ? accountMap.get(selectedTx.source_account_id)
                            ?.account_name ?? "Akun"
                        : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500 dark:text-[#C7D0E0]/70">
                  Status
                </dt>
                <dd className="text-right font-semibold text-[#087BFF] dark:text-[#19D8FF]">
                  {selectedTx.status === "cancelled"
                    ? "Dibatalkan"
                    : "Disetujui Owner · Terposting"}
                </dd>
              </div>
            </dl>

            <Link
              to="/transaksi"
              onClick={() => setSelectedTx(null)}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-4 py-2.5 text-xs font-semibold text-[#06132F] hover:bg-slate-100 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white"
            >
              <span>Kelola di Riwayat Transaksi</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </ModalSheet>
    </AppShell>
  );
}
