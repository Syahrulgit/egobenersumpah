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
  ChevronDown,
  CreditCard,
  Eye,
  EyeOff,
  FlaskConical,
  HeartPulse,
  PieChart,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { AppShell } from "../../components/ego/app-shell";
import {
  BudgetUsageChart,
  severityBadgeClass,
} from "../../components/ego/budget-usage-chart";
import { CashflowChart } from "../../components/ego/cashflow-chart";
import { CategoryBreakdown } from "../../components/ego/category-breakdown";
import { CategoryIcon } from "../../components/ego/category-icon";
import { EgoCompanion, EgoRoboAvatar } from "../../components/ego/ego-brand";
import {
  EGO_EASE,
  EgoAnimatedBar,
  EgoCountUp,
  EgoStaggerSection,
  triggerSignatureFeedback,
} from "../../components/ego/ego-motion";
import { ModalSheet } from "../../components/ego/modal-sheet";
import { useTransactionSheet } from "../../components/ego/transaction-input-sheet";
import { TtsButton } from "../../components/ego/tts-button";
import { formatPeriodMonthID, summarizeBudgetMonth } from "../../lib/budgets";
import { computeCashflowForecast } from "../../lib/cashflow-forecast";
import {
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

  const triggerQuickAction = (
    button: HTMLButtonElement,
    type: "expense" | "transfer"
  ) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      openTransactionSheet({ type });
      return;
    }

    try {
      button.animate(
        [
          { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(212, 175, 55, 0)" },
          {
            transform: "scale(0.96)",
            boxShadow: "0 0 0 4px rgba(212, 175, 55, 0.24)",
            offset: 0.3,
          },
          { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(212, 175, 55, 0)" },
        ],
        { duration: 240, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      );
      window.setTimeout(() => openTransactionSheet({ type }), 130);
    } catch {
      openTransactionSheet({ type });
    }
  };

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
  const [roboBriefOpen, setRoboBriefOpen] = useState(false);

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

  const recentTx = transactions.slice(0, 3);
  const activeAccounts = accounts.filter((a) => a.is_active);
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const pendingCommands =
    vault?.owner_commands.filter((c) => c.status === "pending").length ?? 0;
  const egoMood =
    forecast30.deficitDaysCount > 0
      ? "alert"
      : pendingCommands > 0
        ? "thinking"
        : "idle";
  const roboCompanionMood =
    roboBriefOpen && egoMood === "idle" ? "happy" : egoMood;
  const egoMoodLabel =
    egoMood === "alert"
      ? "Ada kondisi keuangan yang perlu diperhatikan"
      : egoMood === "thinking"
        ? "Meninjau draf yang menunggu Owner"
        : roboBriefOpen
          ? "Briefing keuangan Owner sedang aktif"
          : "Siap membantu analisis keuangan Owner";

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
            onClick={(e) => {
              triggerSignatureFeedback(e.currentTarget, "action", e);
              openTransactionSheet();
            }}
            className="ego-pressable ego-icon-action inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E6C768] to-[#D4AF37] px-3.5 py-2 text-xs font-bold text-[#101827] shadow-xs transition-all hover:brightness-105 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
            <span>Catat Transaksi</span>
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-5">
          <div className="h-52 animate-pulse rounded-3xl border border-slate-200 bg-white dark:border-[#1E293B] dark:bg-[#101827]" />
          <div className="grid grid-cols-4 gap-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-[#1E293B] dark:bg-[#101827]"
              />
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-[#1E293B] dark:bg-[#101827] lg:col-span-7" />
            <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-[#1E293B] dark:bg-[#101827] lg:col-span-5" />
          </div>
        </div>
      ) : (
        <div className="ego-dashboard space-y-5">
          {/* B. Primary Balance Hero Card + C. Quick Actions */}
          <EgoStaggerSection index={0} className="space-y-5">
          <section
            aria-label="Kartu Saldo Utama"
            className="ego-card-hero ego-card-hero--living relative overflow-hidden rounded-[1.75rem] border border-[#D4AF37]/30 p-5 text-white shadow-xl shadow-[#101827]/20 sm:p-7"
          >
            <div className="ego-card-hero__companion" aria-hidden="true">
              <EgoCompanion size="lg" mode={roboCompanionMood} />
            </div>
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-semibold tracking-wider text-slate-300">
                    Total Saldo Likuid
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      triggerSignatureFeedback(e.currentTarget, "action", e);
                      toggleBalanceHidden();
                    }}
                    aria-label={
                      balanceHidden ? "Tampilkan saldo" : "Sembunyikan saldo"
                    }
                    className="ego-pressable ego-icon-action inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-slate-300 transition-colors hover:border-[#D4AF37]/45 hover:bg-white/10 hover:text-[#E6C768]"
                  >
                    {balanceHidden ? (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>

                <p className="mt-2 font-mono text-[1.85rem] leading-tight font-bold tracking-tight text-white tabular-nums sm:text-4xl">
                  {balanceHidden ? (
                    maskedMoney
                  ) : (
                    <EgoCountUp
                      value={netWorth.totalAccountBalance}
                      formatter={(v) => formatIDR(v)}
                    />
                  )}
                </p>

                {/* Income (Emerald) & Expense (Coral Red) high-contrast summary */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
                  {balanceTrend.hasBaseline ? (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 font-mono font-semibold tabular-nums ${
                        balanceTrend.deltaAmount >= 0
                          ? "border-[#14B8A6]/35 bg-[#14B8A6]/15 text-[#5EEAD4]"
                          : "border-[#EF4444]/35 bg-[#EF4444]/15 text-[#FCA5A5]"
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

                  <div className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 font-mono text-xs tabular-nums">
                    <span className="whitespace-nowrap text-slate-300">
                      Masuk{" "}
                      <strong className="text-[#2DD4BF]">
                        {balanceHidden ? "••••" : formatIDR(cashflow.income, true)}
                      </strong>
                    </span>
                    <span className="text-slate-500" aria-hidden="true">
                      ·
                    </span>
                    <span className="whitespace-nowrap text-slate-300">
                      Keluar{" "}
                      <strong className="text-[#FCA5A5]">
                        {balanceHidden ? "••••" : formatIDR(cashflow.expense, true)}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-stretch gap-2.5 sm:shrink-0 sm:items-end">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#D4AF37]/30 bg-white/[0.04] px-4 py-2.5 sm:block sm:py-3">
                  <p className="text-[11px] font-medium text-slate-300">
                    Kekayaan Bersih
                  </p>
                  <p
                    className={`font-mono text-base font-bold tabular-nums sm:mt-1 sm:text-lg ${
                      netWorth.netWorth >= 0 ? "text-[#E6C768]" : "text-[#FCA5A5]"
                    }`}
                  >
                    {balanceHidden ? (
                      maskedMoney
                    ) : (
                      <EgoCountUp
                        value={netWorth.netWorth}
                        formatter={(v) => formatIDR(v)}
                      />
                    )}
                  </p>
                </div>

                {pendingCommands > 0 ? (
                  <Link
                    to="/owner"
                    className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[#FF4DDE]/40 bg-[#FF4DDE]/14 px-3 py-1.5 text-xs font-semibold text-[#FF9EEA] transition-colors hover:bg-[#FF4DDE]/22 whitespace-nowrap sm:justify-start"
                  >
                    <Bot className="h-3.5 w-3.5 shrink-0 text-[#FF4DDE]" aria-hidden="true" />
                    <span>{pendingCommands} draf AI menunggu persetujuan</span>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="relative z-10 mt-5 flex items-center justify-between gap-2 border-t border-white/10 pt-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 text-lg font-extrabold leading-none tabular-nums text-white" aria-label={`${activeAccounts.length} akun aktif`}>
                  {activeAccounts.length}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    triggerSignatureFeedback(e.currentTarget, "ai", e);
                    setRoboBriefOpen((v) => !v);
                  }}
                  aria-expanded={roboBriefOpen}
                  className="ego-pressable ego-icon-ai inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[#FF4DDE]/40 bg-[#0A101D]/85 px-2.5 py-1.5 text-left transition-colors hover:border-[#FF4DDE]/75 hover:bg-[#162032]"
                >
                  <EgoCompanion size="sm" mode={roboCompanionMood} className="!h-7 !w-7" />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold leading-tight text-white">
                      EGO Robo AI
                    </span>
                    <span className="block text-[10px] leading-tight text-[#FF9EEA]">
                      {egoMood === "alert"
                        ? "Perlu atensi"
                        : egoMood === "thinking"
                          ? `${pendingCommands} draf AI`
                          : roboBriefOpen
                            ? "Briefing aktif"
                            : "Siaga · Ringkasan"}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-[#FF9EEA] transition-transform ${
                      roboBriefOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </div>
              <Link
                to="/akun"
                className="relative -top-0.5 inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/12 px-3.5 py-2 text-xs font-semibold text-[#E6C768] transition-colors hover:bg-[#D4AF37]/22 whitespace-nowrap"
              >
                <span>Kelola Akun</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <AnimatePresence initial={false}>
              {roboBriefOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: EGO_EASE }}
                  className="relative z-10 mt-3 rounded-2xl border border-[#FF4DDE]/35 bg-[#090F1B]/90 p-3.5 text-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#FF4DDE]" aria-hidden="true" />
                      <div className="space-y-1">
                        <p className="font-bold text-[#FF9EEA]">
                          Briefing EGO Robo AI — {egoMoodLabel}
                        </p>
                        <p className="text-slate-300">
                          Skor Kesehatan:{" "}
                          <strong className="font-mono text-[#E6C768]">
                            {health.totalScore !== null ? `${health.totalScore}/100` : "—"}
                          </strong>{" "}
                          · Proyeksi 30 hari:{" "}
                          <strong className="font-mono text-white">
                            {balanceHidden ? "••••••" : formatIDR(forecast30.endingBalance)}
                          </strong>
                          {dueBills.length > 0
                            ? ` · ${dueBills.length} tagihan jatuh tempo ≤ 7 hari.`
                            : " · Jadwal tagihan aman."}
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/owner"
                      search={{ tab: "ai" }}
                      className="ego-pressable inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl bg-[#FF4DDE]/20 px-3 py-1.5 text-[11px] font-bold text-[#FF9EEA] ring-1 ring-[#FF4DDE]/45 transition-colors hover:bg-[#FF4DDE]/30 whitespace-nowrap"
                    >
                      <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Buka Konsultan Robo AI</span>
                    </Link>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>

          {/* C. Quick Actions — Thumb-zone friendly on iPhone */}
          <section aria-label="Aksi Cepat">
            <div className="grid grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={(event) => triggerQuickAction(event.currentTarget, "expense")}
                className="group flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-1.5 py-2.5 text-center transition-all duration-150 hover:border-[#D4AF37]/60 hover:shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:hover:border-[#D4AF37]/50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#E6C768] to-[#D4AF37] text-[#101827] shadow-2xs">
                  <Plus
                    className="h-4 w-4 stroke-[2.5] transition-transform duration-150 group-active:rotate-12 motion-reduce:transition-none motion-reduce:group-active:rotate-0"
                    aria-hidden="true"
                  />
                </span>
                <span className="text-[11px] font-bold leading-tight text-[#101827] dark:text-white">
                  Catat Transaksi
                </span>
              </button>

              <button
                type="button"
                onClick={(event) => triggerQuickAction(event.currentTarget, "transfer")}
                className="group flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-1.5 py-2.5 text-center transition-all duration-150 hover:border-[#D4AF37]/60 hover:shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:hover:border-[#D4AF37]/50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101827] text-[#E6C768] dark:bg-[#D4AF37]/15 dark:text-[#E6C768]">
                  <ArrowLeftRight
                    className="h-4 w-4 transition-transform duration-150 group-active:scale-110 motion-reduce:transition-none motion-reduce:group-active:scale-100"
                    aria-hidden="true"
                  />
                </span>
                <span className="text-[11px] font-bold leading-tight text-[#101827] dark:text-white">
                  Transfer
                </span>
              </button>

              <Link
                to="/aset"
                className="flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-1.5 py-2.5 text-center transition-all hover:border-[#D4AF37]/60 hover:shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:hover:border-[#D4AF37]/50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D4AF37]/15 text-[#9A7411] dark:bg-[#D4AF37]/15 dark:text-[#E6C768]">
                  <Briefcase className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-[11px] font-bold leading-tight text-[#101827] dark:text-white">
                  Tambah Aset
                </span>
              </Link>

              <Link
                to="/utang"
                className="flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-1.5 py-2.5 text-center transition-all hover:border-[#EF4444]/45 hover:shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:hover:border-[#EF4444]/45"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EF4444]/12 text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#F87171]">
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-[11px] font-bold leading-tight text-[#101827] dark:text-white">
                  Bayar Utang
                </span>
              </Link>
            </div>

            <div className="mt-2.5">
              <Link
                to="/laporan"
                className="ego-pressable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/30 bg-[#101827] px-4 py-2 text-center text-xs font-semibold text-[#E6C768] transition-colors hover:bg-[#162032] whitespace-nowrap"
              >
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                <span>Lihat Laporan</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </section>
          </EgoStaggerSection>

          <EgoStaggerSection index={1}>
          <details className="group rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none">
            <summary className="flex min-h-[58px] cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[#101827] dark:text-white">
                  Analisis &amp; Perencanaan
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                  Grafik, ringkasan keuangan, pengingat, target, dan anggaran
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[#9A7411] dark:text-[#E6C768]">
                <span className="group-open:hidden">Lihat</span>
                <span className="hidden group-open:inline">Tutup</span>
                <ArrowRight
                  className="h-4 w-4 transition-transform group-open:rotate-90"
                  aria-hidden="true"
                />
              </span>
            </summary>

            <div className="space-y-5 border-t border-slate-200 p-3 dark:border-[#1E293B] sm:p-4">
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
                  <h2 className="text-sm font-bold text-[#101827] dark:text-white">
                    Ringkasan Posisi Keuangan
                  </h2>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Data aktual terverifikasi
                  </span>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
                  <Link
                    to="/aset"
                    className="ego-main-card ego-main-card--summary rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#D4AF37]/60 dark:border-[#1E293B] dark:bg-[#162032] dark:hover:border-[#D4AF37]/50"
                  >
                    <span className="ego-main-card__robo" aria-hidden="true">
                      <EgoRoboAvatar size="lg" mode="idle" />
                    </span>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Total Aset</span>
                      <Briefcase
                        className="h-4 w-4 text-[#B8901F] dark:text-[#D4AF37]"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-2 font-mono text-base font-bold tabular-nums text-[#101827] dark:text-white">
                      {balanceHidden
                        ? "••••••"
                        : formatIDR(netWorth.totalAssetValue)}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {assets.length} instrumen tercatat
                    </p>
                  </Link>

                  <Link
                    to="/utang"
                    className="ego-main-card ego-main-card--summary rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#EF4444]/45 dark:border-[#1E293B] dark:bg-[#162032] dark:hover:border-[#EF4444]/45"
                  >
                    <span className="ego-main-card__robo" aria-hidden="true">
                      <EgoRoboAvatar size="lg" mode={debts.some((d) => d.status === "active") ? "alert" : "happy"} />
                    </span>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Total Utang</span>
                      <CreditCard className="h-4 w-4 text-[#EF4444]" aria-hidden="true" />
                    </div>
                    <p className="mt-2 font-mono text-base font-bold tabular-nums text-[#DC2626] dark:text-[#F87171]">
                      {balanceHidden
                        ? "••••••"
                        : formatIDR(netWorth.totalDebtBalance)}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {debts.filter((d) => d.status === "active").length} kewajiban aktif
                    </p>
                  </Link>

                  <Link
                    to="/laporan"
                    className="ego-main-card ego-main-card--summary rounded-2xl border border-[#D4AF37]/30 bg-white p-4 transition-colors hover:border-[#D4AF37]/70 dark:border-[#D4AF37]/25 dark:bg-[#162032] dark:hover:border-[#D4AF37]/60"
                  >
                    <span className="ego-main-card__robo" aria-hidden="true">
                      <EgoRoboAvatar size="lg" mode={netWorth.netWorth >= 0 ? "happy" : "alert"} />
                    </span>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Kekayaan Bersih</span>
                      <ShieldCheck
                        className="h-4 w-4 text-[#B8901F] dark:text-[#D4AF37]"
                        aria-hidden="true"
                      />
                    </div>
                    <p
                      className={`mt-2 font-mono text-base font-bold tabular-nums ${
                        netWorth.netWorth >= 0
                          ? "text-[#9A7411] dark:text-[#E6C768]"
                          : "text-[#DC2626] dark:text-[#F87171]"
                      }`}
                    >
                      {balanceHidden ? "••••••" : formatIDR(netWorth.netWorth)}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {avgCashflow.avgExpense > 0
                        ? `Rata beban ${formatIDR(avgCashflow.avgExpense, true)}/bln`
                        : "Kas + Aset − Utang"}
                    </p>
                  </Link>

                  <Link
                    to="/rencana"
                    search={{ tab: "target" }}
                    className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#D4AF37]/60 dark:border-[#1E293B] dark:bg-[#162032] dark:hover:border-[#D4AF37]/50"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Target Keuangan</span>
                      <Target
                        className="h-4 w-4 text-[#B8901F] dark:text-[#D4AF37]"
                        aria-hidden="true"
                      />
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
                              <p className="mt-2 truncate text-sm font-bold text-[#101827] dark:text-white">
                                {g.title}
                              </p>
                              <div className="mt-2">
                                <EgoAnimatedBar
                                  percentage={prog.percentage}
                                  heightClassName="h-1.5"
                                  trackClassName="bg-slate-200 dark:bg-slate-700"
                                />
                              </div>
                              <p className="mt-1.5 font-mono text-[11px] font-semibold tabular-nums text-[#9A7411] dark:text-[#E6C768]">
                                {prog.percentage}% tercapai · {activeGoals.length} aktif
                              </p>
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <>
                        <p className="mt-2 font-mono text-base font-bold text-[#101827] dark:text-white">
                          {activeGoals.length} Aktif
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          Atur target tabungan
                        </p>
                      </>
                    )}
                  </Link>

                  <Link
                    to="/rencana"
                    search={{ tab: "tagihan" }}
                    className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#D4AF37]/60 dark:border-[#1E293B] dark:bg-[#162032] dark:hover:border-[#D4AF37]/50"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Tagihan Mendatang</span>
                      <CalendarClock
                        className={`h-4 w-4 ${
                          dueBills.length > 0
                            ? "text-[#D4AF37]"
                            : "text-[#14B8A6]"
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                    <p
                      className={`mt-2 font-mono text-base font-bold tabular-nums ${
                        dueBills.length > 0
                          ? "text-[#9A7411] dark:text-[#E6C768]"
                          : "text-[#0D9488] dark:text-[#2DD4BF]"
                      }`}
                    >
                      {dueBills.length > 0 ? formatIDR(dueTotal) : "0 Tagihan"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
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
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#1E293B] dark:bg-[#162032]">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/15 text-[#9A7411] dark:text-[#E6C768]">
                          <BellRing className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div>
                          <h2 className="text-sm font-bold text-[#101827] dark:text-white">
                            Pengingat Keuangan
                          </h2>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {reminderSummary.totalActiveCount} pengingat aktif ·{" "}
                            {reminderSummary.upcomingBillsCount} tagihan mendatang
                          </p>
                        </div>
                      </div>
                      {reminderSummary.overdueCount > 0 ? (
                        <span className="rounded-lg bg-[#EF4444]/12 px-2 py-0.5 font-mono text-[11px] font-bold text-[#DC2626] dark:bg-[#EF4444]/18 dark:text-[#F87171] tabular-nums">
                          {reminderSummary.overdueCount} Terlambat
                        </span>
                      ) : reminderSummary.dueTodayCount > 0 ? (
                        <span className="rounded-lg bg-[#D4AF37]/15 px-2 py-0.5 font-mono text-[11px] font-bold text-[#9A7411] dark:text-[#E6C768] tabular-nums">
                          {reminderSummary.dueTodayCount} Hari Ini
                        </span>
                      ) : null}
                    </div>

                    {reminderSummary.nearestReminder ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#1E293B] dark:bg-[#101827]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                            Pengingat Terdekat
                          </span>
                          <span
                            className={`text-[11px] font-semibold ${
                              reminderSummary.nearestReminder.isOverdue
                                ? "text-[#DC2626] dark:text-[#F87171]"
                                : "text-[#9A7411] dark:text-[#E6C768]"
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
                          <p className="truncate text-sm font-bold text-[#101827] dark:text-white">
                            {reminderSummary.nearestReminder.title}
                          </p>
                          <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-[#101827] dark:text-[#E6C768]">
                            {balanceHidden
                              ? "••••••"
                              : formatIDR(reminderSummary.nearestReminder.amount)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-[#101827]/70 dark:text-slate-300">
                        Belum ada pengingat jatuh tempo aktif. Tambah jadwal atau sinkronkan tagihan &amp; utang.
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span>
                        Setoran tabungan berikutnya:{" "}
                        <strong className="text-[#101827] dark:text-white">
                          {reminderSummary.nextSavingsDeposit
                            ? `${reminderSummary.nextSavingsDeposit.title} (${formatDateID(reminderSummary.nextSavingsDeposit.dueDate, dateFormat)})`
                            : "Belum dijadwalkan"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-[#1E293B]">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Konfirmasi Owner wajib sebelum saldo berubah
                    </span>
                    <Link
                      to="/pengingat"
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-[#101827] px-3 py-1.5 text-xs font-semibold text-[#E6C768] transition-colors hover:bg-[#1E293B] whitespace-nowrap dark:bg-[#D4AF37]/15"
                    >
                      <span>Pusat Pengingat</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                {/* Card 2: Goal Simulator */}
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#1E293B] dark:bg-[#162032]">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/15 text-[#9A7411] dark:text-[#E6C768]">
                          <Calculator className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div>
                          <h2 className="text-sm font-bold text-[#101827] dark:text-white">
                            Simulator Target Keuangan
                          </h2>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {goalSummary.activeGoalsCount} target aktif ·{" "}
                            {goalSummary.completedGoalsCount} tercapai
                          </p>
                        </div>
                      </div>
                      {goalSummary.atRiskCount > 0 ? (
                        <span className="rounded-lg bg-[#EF4444]/12 px-2 py-0.5 font-mono text-[11px] font-bold text-[#DC2626] dark:bg-[#EF4444]/18 dark:text-[#F87171] tabular-nums">
                          {goalSummary.atRiskCount} Perlu Perhatian
                        </span>
                      ) : goalSummary.activeGoalsCount > 0 ? (
                        <span className="rounded-lg bg-[#14B8A6]/15 px-2 py-0.5 font-mono text-[11px] font-bold text-[#0D9488] dark:text-[#2DD4BF] tabular-nums">
                          On Track
                        </span>
                      ) : null}
                    </div>

                    {goalSummary.primaryGoal ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#1E293B] dark:bg-[#101827]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold text-[#101827] dark:text-white">
                            Target Utama: {goalSummary.primaryGoal.title}
                          </span>
                          <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-[#9A7411] dark:text-[#E6C768]">
                            {goalSummary.primaryGoal.progressPct}%
                          </span>
                        </div>
                        <div className="mt-2">
                          <EgoAnimatedBar
                            percentage={goalSummary.overallProgressPct}
                            heightClassName="h-2"
                            trackClassName="bg-slate-200 dark:bg-slate-700"
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                          <span>
                            Progres gabungan:{" "}
                            <strong className="font-mono tabular-nums text-[#101827] dark:text-white">
                              {goalSummary.overallProgressPct}%
                            </strong>
                          </span>
                          <span>
                            ETA:{" "}
                            <strong className="text-[#9A7411] dark:text-[#E6C768]">
                              {goalSummary.primaryGoal.etaText}
                            </strong>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-[#101827]/70 dark:text-slate-300">
                        Belum ada target tabungan terdaftar. Jalankan simulasi skenario setoran kapan saja tanpa mengubah saldo.
                      </div>
                    )}

                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Bandingkan skenario Konservatif, Normal, dan Optimistis berdasarkan surplus kas Anda.
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-[#1E293B]">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Terhubung ke data target &amp; pengingat setoran
                    </span>
                    <Link
                      to="/rencana"
                      search={{ tab: "simulator" }}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-[#101827] px-3 py-1.5 text-xs font-semibold text-[#E6C768] transition-colors hover:bg-[#1E293B] whitespace-nowrap dark:bg-[#D4AF37]/15"
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
                  className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#D4AF37]/60 dark:border-[#1E293B] dark:bg-[#162032] dark:hover:border-[#D4AF37]/50"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Financial Health Score</span>
                    <HeartPulse
                      className="h-4 w-4 text-[#B8901F] dark:text-[#D4AF37]"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 font-mono text-lg font-bold tabular-nums text-[#101827] dark:text-white">
                    {health.totalScore !== null ? `${health.totalScore}/100` : "—"}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-[#9A7411] dark:text-[#E6C768]">
                    {health.grade}
                    {health.isDataIncomplete ? " · Data Parsial" : ""}
                  </p>
                </Link>

                <Link
                  to="/analitik"
                  className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#D4AF37]/60 dark:border-[#1E293B] dark:bg-[#162032] dark:hover:border-[#D4AF37]/50"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Proyeksi Saldo 30 Hari</span>
                    <Activity
                      className="h-4 w-4 text-[#14B8A6]"
                      aria-hidden="true"
                    />
                  </div>
                  <p
                    className={`mt-2 font-mono text-base font-bold tabular-nums ${
                      forecast30.endingBalance < 0
                        ? "text-[#DC2626] dark:text-[#F87171]"
                        : "text-[#101827] dark:text-white"
                    }`}
                  >
                    {balanceHidden ? "••••••" : formatIDR(forecast30.endingBalance)}
                  </p>
                  <p
                    className={`mt-1 text-[11px] font-semibold ${
                      forecast30.deficitDaysCount > 0
                        ? "text-[#DC2626] dark:text-[#F87171]"
                        : "text-[#0D9488] dark:text-[#2DD4BF]"
                    }`}
                  >
                    {forecast30.deficitDaysCount > 0
                      ? `Risiko defisit ${forecast30.deficitDaysCount} hari`
                      : "Arus kas 30 hari aman"}
                  </p>
                </Link>

                <Link
                  to="/simulasi"
                  className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#D4AF37]/60 dark:border-[#1E293B] dark:bg-[#162032] dark:hover:border-[#D4AF37]/50"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>What-If Simulator</span>
                    <FlaskConical
                      className="h-4 w-4 text-[#B8901F] dark:text-[#D4AF37]"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-sm font-bold text-[#101827] dark:text-white">
                    Uji Keputusan Finansial
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {(vault?.whatif_scenarios ?? []).length} skenario tersimpan · Aman &amp; terisolasi
                  </p>
                </Link>

                {/* EGO AI Core — Midnight Navy + Neon Magenta AI identity */}
                <Link
                  to="/owner"
                  search={{ tab: "ai" }}
                  className="rounded-2xl border border-[#FF4DDE]/35 bg-[#101827] p-4 text-white transition-colors hover:border-[#FF4DDE]/70"
                >
                  <div className="flex items-center gap-3">
                    <EgoCompanion size="md" mode={egoMood} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-wide text-[#FF9EEA]">
                        EGO AI Core
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-white">
                        Konsultan Keuangan AI
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                        {egoMoodLabel}
                      </p>
                    </div>
                  </div>
                </Link>
              </section>

              {/* E3. Smart Budget Monitor Dashboard Widget */}
              <section
                aria-label="Ringkasan Smart Budget Monitor"
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#1E293B] dark:bg-[#162032]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/15 text-[#9A7411] dark:text-[#E6C768]">
                      <PieChart className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-[#101827] dark:text-white">
                        Smart Budget Monitor — {formatPeriodMonthID(currentMonth)}
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {budgetSummary.activeCount > 0
                          ? `${budgetSummary.activeCount} anggaran aktif · Dihitung hanya dari pengeluaran terkonfirmasi Owner`
                          : "Atur batas anggaran bulanan per kategori pengeluaran Anda"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {budgetSummary.attentionCount > 0 ? (
                      <span className="rounded-lg bg-[#EF4444]/12 px-2.5 py-1 font-mono text-[11px] font-bold text-[#DC2626] dark:bg-[#EF4444]/18 dark:text-[#F87171] tabular-nums">
                        {budgetSummary.attentionCount} Mendekati / Melewati Batas
                      </span>
                    ) : budgetSummary.activeCount > 0 ? (
                      <span className="rounded-lg bg-[#14B8A6]/15 px-2.5 py-1 font-mono text-[11px] font-bold text-[#0D9488] dark:text-[#2DD4BF]">
                        Semua Aman
                      </span>
                    ) : null}
                    <Link
                      to="/anggaran"
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-[#101827] px-3 py-1.5 text-xs font-semibold text-[#E6C768] transition-colors hover:bg-[#1E293B] whitespace-nowrap dark:bg-[#D4AF37]/15"
                    >
                      <span>Kelola Anggaran</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                {budgetSummary.activeCount === 0 ? (
                  <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center sm:flex-row sm:text-left dark:border-slate-700 dark:bg-[#101827]/70">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Belum ada kategori anggaran aktif untuk {formatPeriodMonthID(currentMonth)}.
                      Buat batas per kategori agar EGO memantau ambang 50%, 75%, 90%, 100%, dan &gt;100%.
                    </p>
                    <Link
                      to="/anggaran"
                      className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E6C768] to-[#D4AF37] px-4 py-2 text-xs font-bold text-[#101827] hover:brightness-105 whitespace-nowrap"
                    >
                      <Plus className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
                      <span>Buat Anggaran</span>
                    </Link>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {/* 3 Budget KPI Strips */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#1E293B] dark:bg-[#101827]">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Total Anggaran Bulanan
                        </p>
                        <p className="mt-1 font-mono text-base font-bold tabular-nums text-[#101827] dark:text-white">
                          {balanceHidden ? maskedMoney : formatIDR(budgetSummary.totalBudget)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#1E293B] dark:bg-[#101827]">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Pengeluaran Terkonfirmasi
                        </p>
                        <p className="mt-1 font-mono text-base font-bold tabular-nums text-[#DC2626] dark:text-[#F87171]">
                          {balanceHidden
                            ? maskedMoney
                            : formatIDR(budgetSummary.totalSpentBudgeted)}{" "}
                          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                            ({budgetSummary.overallUsagePct.toFixed(0)}%)
                          </span>
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#1E293B] dark:bg-[#101827]">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Sisa Anggaran
                        </p>
                        <p
                          className={`mt-1 font-mono text-base font-bold tabular-nums ${
                            budgetSummary.remainingBudget < 0
                              ? "text-[#DC2626] dark:text-[#F87171]"
                              : "text-[#0D9488] dark:text-[#2DD4BF]"
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
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#1E293B] dark:bg-[#101827]">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className="text-xs font-bold text-[#101827] dark:text-white">
                              Penggunaan Tertinggi
                            </h3>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
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
                                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${severityBadgeClass(
                                      item.severity
                                    )}`}
                                  >
                                    {item.usagePct.toFixed(0)}%
                                  </span>
                                  <span className="truncate font-semibold text-[#101827] dark:text-white">
                                    {item.budget.category}
                                  </span>
                                </div>
                                <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-300">
                                  {balanceHidden ? "••••" : formatIDR(item.spentAmount, true)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {budgetSummary.alertCategories.length > 0 ? (
                          <div className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/8 p-3.5 dark:border-[#EF4444]/35 dark:bg-[#EF4444]/12">
                            <p className="text-xs font-bold text-[#991B1B] dark:text-[#FECACA]">
                              Indikator Mendekati / Melewati Batas
                            </p>
                            <ul className="mt-2 space-y-1.5">
                              {budgetSummary.alertCategories.slice(0, 3).map((a) => (
                                <li
                                  key={a.budget.id}
                                  className="flex items-center justify-between gap-2 text-[11px] text-[#7F1D1D] dark:text-[#FEE2E2]"
                                >
                                  <span className="truncate font-semibold">
                                    {a.budget.category}
                                  </span>
                                  <span className="shrink-0 font-mono font-bold tabular-nums">
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
            </div>
          </details>
          </EgoStaggerSection>

          {/* F. Recent Transactions — Clean white card with Emerald income & Coral Red expense */}
          <EgoStaggerSection index={2}>
          <section
            aria-label="Transaksi Terbaru"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#101827] dark:text-white">
                  Transaksi Terbaru
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ketuk transaksi untuk melihat rincian lengkap.
                </p>
              </div>
              <Link
                to="/transaksi"
                className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-[#101827] transition-colors hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 whitespace-nowrap dark:border-[#1E293B] dark:bg-[#162032] dark:text-[#E6C768]"
              >
                <span>Lihat Semua</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            {recentTx.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center dark:border-[#1E293B] dark:bg-[#162032]">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#101827] text-[#E6C768] dark:bg-[#D4AF37]/15">
                  <Wallet className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-bold text-[#101827] dark:text-white">
                  Belum ada catatan transaksi
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Ketuk tombol + di navigasi bawah atau Catat Transaksi untuk memulai.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => openTransactionSheet()}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E6C768] to-[#D4AF37] px-4 py-2 text-xs font-bold text-[#101827] hover:brightness-105 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
                    <span>Catat Transaksi</span>
                  </button>
                  <Link
                    to="/owner"
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#FF4DDE]/35 bg-[#101827] px-4 py-2 text-xs font-semibold text-white hover:bg-[#162032] whitespace-nowrap"
                  >
                    <Bot className="h-3.5 w-3.5 text-[#FF4DDE]" aria-hidden="true" />
                    <span>Tanya EGO AI</span>
                  </Link>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200/80 dark:divide-[#1E293B]">
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
                      ? "text-[#0D9488] dark:text-[#2DD4BF]"
                      : tx.transaction_type === "expense"
                        ? "text-[#DC2626] dark:text-[#F87171]"
                        : "text-[#101827] dark:text-[#E6C768]";

                  const iconWrapCls = isCancelled
                    ? "bg-slate-100 text-slate-400 dark:bg-[#162032] dark:text-slate-500"
                    : tx.transaction_type === "income"
                      ? "bg-[#14B8A6]/12 text-[#0D9488] dark:bg-[#14B8A6]/15 dark:text-[#2DD4BF]"
                      : tx.transaction_type === "expense"
                        ? "bg-[#EF4444]/10 text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#F87171]"
                        : "bg-[#101827]/8 text-[#101827] dark:bg-[#D4AF37]/15 dark:text-[#E6C768]";

                  return (
                    <li key={tx.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTx(tx)}
                        className="flex min-h-[60px] w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-[#162032]"
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
                                  : "text-[#101827] dark:text-white"
                              }`}
                            >
                              {tx.description || tx.category || "Mutasi Kas"}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
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
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
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
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3.5 py-2.5 text-xs dark:border-[#D4AF37]/30 dark:bg-[#D4AF37]/12">
                <span className="font-medium text-[#6B500B] dark:text-[#E6C768]">
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
                  className="font-bold text-[#6B500B] underline dark:text-[#E6C768]"
                >
                  Lihat Tagihan
                </Link>
              </div>
            ) : null}
          </section>
          </EgoStaggerSection>
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
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-[#1E293B] dark:bg-[#101827]">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
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
                      ? "text-[#0D9488] dark:text-[#2DD4BF]"
                      : selectedTx.transaction_type === "expense"
                        ? "text-[#DC2626] dark:text-[#F87171]"
                        : "text-[#101827] dark:text-[#E6C768]"
                }`}
              >
                {formatIDR(selectedTx.amount)}
              </p>
            </div>

            <dl className="divide-y divide-slate-200 text-xs dark:divide-[#1E293B]">
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500 dark:text-slate-400">
                  Keterangan
                </dt>
                <dd className="text-right font-semibold text-[#101827] dark:text-white">
                  {selectedTx.description || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500 dark:text-slate-400">
                  Kategori
                </dt>
                <dd className="text-right font-semibold text-[#101827] dark:text-white">
                  {selectedTx.category || "Umum"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500 dark:text-slate-400">Akun</dt>
                <dd className="text-right font-semibold text-[#101827] dark:text-white">
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
                <dt className="text-slate-500 dark:text-slate-400">
                  Status
                </dt>
                <dd
                  className={`text-right font-semibold ${
                    selectedTx.status === "cancelled"
                      ? "text-[#DC2626] dark:text-[#F87171]"
                      : "text-[#0D9488] dark:text-[#2DD4BF]"
                  }`}
                >
                  {selectedTx.status === "cancelled"
                    ? "Dibatalkan"
                    : "Disetujui Owner · Terposting"}
                </dd>
              </div>
            </dl>

            <Link
              to="/transaksi"
              onClick={() => setSelectedTx(null)}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-[#101827] hover:bg-slate-100 dark:border-[#1E293B] dark:bg-[#162032] dark:text-white"
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
