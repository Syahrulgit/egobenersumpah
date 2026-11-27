import { Link, useSearch } from "@tanstack/react-router";
import {
  ArrowRight,
  Calculator,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  Plus,
  Send,
  ShieldCheck,
  Target,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { ApprovalCheck } from "../../components/ego/approval-check";
import {
  EgoAnimatedBar,
  EgoCountUp,
  EgoStaggerSection,
} from "../../components/ego/ego-motion";
import { GoalSimulatorPanel } from "../../components/ego/goal-simulator-panel";
import { ModalSheet } from "../../components/ego/modal-sheet";
import { MoneyInput } from "../../components/ego/money-input";
import { useTransactionSheet } from "../../components/ego/transaction-input-sheet";
import {
  computeAverageMonthlyCashflow,
  computeEmergencyFundMonths,
  computeGoalProgress,
  computeNetWorth,
  daysUntilDue,
  estimateGoalCompletionMonths,
  formatDateID,
  formatIDR,
  getDueRecurringBills,
  recurringFrequencyLabel,
  todayISO,
} from "../../lib/finance";
import {
  useCreateRecurringBill,
  useCreateSavingsGoal,
  useDeleteRecurringBill,
  useDeleteSavingsGoal,
  useQueueRecurringBill,
  useToggleRecurringBill,
  useUpdateGoalProgress,
  useVaultSnapshot,
} from "../../lib/queries";
import type {
  GoalType,
  RecurringBill,
  RecurringFrequency,
  SavingsGoal,
} from "../../types/ego";

const RECURRING_EXPENSE_CATEGORIES = [
  "Utilitas & Tagihan",
  "Tempat Tinggal",
  "Langganan Digital",
  "Utang & Cicilan",
  "Transportasi",
  "Kesehatan",
  "Asuransi",
  "Pengeluaran Lainnya",
];

const RECURRING_INCOME_CATEGORIES = [
  "Gaji & Pendapatan",
  "Bonus & Investasi",
  "Usaha & Freelance",
  "Pemasukan Lainnya",
];

export function RencanaPage() {
  const search = useSearch({ from: "/_authenticated/rencana" });
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const { openTransactionSheet } = useTransactionSheet();
  const createGoal = useCreateSavingsGoal();
  const updateGoal = useUpdateGoalProgress();
  const deleteGoal = useDeleteSavingsGoal();

  const createBill = useCreateRecurringBill();
  const toggleBill = useToggleRecurringBill();
  const queueBill = useQueueRecurringBill();
  const deleteBill = useDeleteRecurringBill();

  const [activeTab, setActiveTab] = useState<"target" | "simulator" | "tagihan">(
    search.tab ?? "target"
  );
  const [simGoalId, setSimGoalId] = useState<string | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [showAllGoals, setShowAllGoals] = useState(false);
  const [showAllBills, setShowAllBills] = useState(false);

  useEffect(() => {
    if (
      search.tab === "target" ||
      search.tab === "simulator" ||
      search.tab === "tagihan"
    ) {
      setActiveTab(search.tab);
    }
  }, [search.tab]);

  const accounts = vault?.accounts ?? [];
  const activeAccounts = accounts.filter((a) => a.is_active);
  const transactions = vault?.transactions ?? [];
  const assets = vault?.assets ?? [];
  const debts = vault?.debts ?? [];
  const goals = vault?.savings_goals ?? [];
  const bills = vault?.recurring_bills ?? [];
  const visibleGoals = showAllGoals ? goals : goals.slice(0, 3);
  const visibleBills = showAllBills ? bills : bills.slice(0, 3);
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";

  const netWorth = useMemo(
    () => computeNetWorth(accounts, assets, debts),
    [accounts, assets, debts]
  );
  const avgCashflow = useMemo(
    () => computeAverageMonthlyCashflow(transactions, 3),
    [transactions]
  );
  const emergencyMonths = useMemo(
    () =>
      computeEmergencyFundMonths(
        netWorth.totalAccountBalance,
        avgCashflow.avgExpense
      ),
    [netWorth.totalAccountBalance, avgCashflow.avgExpense]
  );
  const dueBills = useMemo(() => getDueRecurringBills(bills), [bills]);
  const dueTotal = useMemo(
    () => dueBills.reduce((s, b) => s + b.amount, 0),
    [dueBills]
  );

  const accountMap = useMemo(() => {
    const map = new Map<string, (typeof accounts)[number]>();
    for (const acc of accounts) map.set(acc.id, acc);
    return map;
  }, [accounts]);

  const [goalTitle, setGoalTitle] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("emergency_fund");
  const [goalTarget, setGoalTarget] = useState(0);
  const [goalTrackMode, setGoalTrackMode] = useState<"manual" | "account">(
    "manual"
  );
  const [goalLinkedAccountId, setGoalLinkedAccountId] = useState("");
  const [goalInitialAmount, setGoalInitialAmount] = useState(0);
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [goalNotes, setGoalNotes] = useState("");
  const [goalConfirmed, setGoalConfirmed] = useState(false);

  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [editGoalAmount, setEditGoalAmount] = useState(0);
  const [editGoalConfirmed, setEditGoalConfirmed] = useState(false);

  const [billTitle, setBillTitle] = useState("");
  const [billType, setBillType] = useState<"expense" | "income">("expense");
  const [billAmount, setBillAmount] = useState(0);
  const [billCategory, setBillCategory] = useState("Utilitas & Tagihan");
  const [billAccountId, setBillAccountId] = useState("");
  const [billFrequency, setBillFrequency] =
    useState<RecurringFrequency>("monthly");
  const [billDueDate, setBillDueDate] = useState(todayISO());
  const [billNotes, setBillNotes] = useState("");
  const [billConfirmed, setBillConfirmed] = useState(false);

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalConfirmed) return;
    if (!goalTitle.trim() || goalTarget <= 0) {
      toast.error("Nama target dan nominal sasaran wajib diisi.");
      return;
    }
    if (goalTrackMode === "account" && !goalLinkedAccountId) {
      toast.error("Pilih akun aktif yang ingin disinkronkan.");
      return;
    }

    try {
      await createGoal.mutateAsync({
        title: goalTitle.trim(),
        goal_type: goalType,
        target_amount: goalTarget,
        current_amount: goalTrackMode === "manual" ? goalInitialAmount : 0,
        linked_account_id:
          goalTrackMode === "account" ? goalLinkedAccountId : null,
        target_date: goalTargetDate || null,
        notes: goalNotes.trim() || null,
        owner_confirmed: true,
      });
      toast.success(`Target "${goalTitle.trim()}" berhasil disimpan.`);
      setGoalTitle("");
      setGoalTarget(0);
      setGoalInitialAmount(0);
      setGoalTargetDate("");
      setGoalNotes("");
      setGoalConfirmed(false);
      setGoalModalOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan target tabungan."
      );
    }
  }

  async function handleUpdateGoalAmount(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGoal || !editGoalConfirmed) return;
    try {
      await updateGoal.mutateAsync({
        id: editingGoal.id,
        current_amount: editGoalAmount,
        target_amount: editingGoal.target_amount,
        owner_confirmed: true,
      });
      toast.success(`Progres "${editingGoal.title}" diperbarui.`);
      setEditingGoal(null);
      setEditGoalConfirmed(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memperbarui progres target."
      );
    }
  }

  async function handleToggleGoalStatus(goal: SavingsGoal) {
    const nextStatus = goal.status === "completed" ? "active" : "completed";
    try {
      await updateGoal.mutateAsync({ id: goal.id, status: nextStatus });
      toast.success(
        nextStatus === "completed"
          ? `Target "${goal.title}" ditandai tercapai.`
          : `Target "${goal.title}" diaktifkan kembali.`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengubah status target."
      );
    }
  }

  async function handleDeleteGoal(goal: SavingsGoal) {
    try {
      await deleteGoal.mutateAsync(goal.id);
      toast.success(`Target "${goal.title}" dihapus.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus target."
      );
    }
  }

  async function handleCreateBill(e: React.FormEvent) {
    e.preventDefault();
    if (!billConfirmed) return;
    if (!billTitle.trim() || billAmount <= 0 || !billDueDate) {
      toast.error("Nama jadwal, nominal, dan tanggal jatuh tempo wajib diisi.");
      return;
    }

    try {
      await createBill.mutateAsync({
        title: billTitle.trim(),
        transaction_type: billType,
        amount: billAmount,
        category: billCategory,
        account_id: billAccountId || null,
        frequency: billFrequency,
        next_due_date: billDueDate,
        notes: billNotes.trim() || null,
        owner_confirmed: true,
      });
      toast.success(`Jadwal rutin "${billTitle.trim()}" berhasil ditambahkan.`);
      setBillTitle("");
      setBillAmount(0);
      setBillNotes("");
      setBillConfirmed(false);
      setBillModalOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan jadwal rutin."
      );
    }
  }

  async function handleQueueBill(bill: RecurringBill) {
    try {
      await queueBill.mutateAsync(bill);
      toast.success(
        `Draf "${bill.title}" masuk ke Antrean Persetujuan Owner. Saldo belum berubah sebelum Anda menyetujui.`
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal mengajukan tagihan rutin ke antrean."
      );
    }
  }

  async function handleToggleBill(bill: RecurringBill) {
    try {
      await toggleBill.mutateAsync({ id: bill.id, is_active: !bill.is_active });
      toast.success(
        bill.is_active
          ? `Jadwal "${bill.title}" dijeda sementara.`
          : `Jadwal "${bill.title}" diaktifkan kembali.`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengubah status jadwal."
      );
    }
  }

  async function handleDeleteBill(bill: RecurringBill) {
    try {
      await deleteBill.mutateAsync(bill.id);
      toast.success(`Jadwal "${bill.title}" dihapus.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus jadwal rutin."
      );
    }
  }

  const activeGoalsCount = goals.filter((g) => g.status === "active").length;
  const completedGoalsCount = goals.filter((g) => g.status === "completed").length;

  return (
    <AppShell
      title="Target & Tagihan"
      subtitle="Rencanakan target keuangan, pantau dana darurat, dan kelola jadwal tagihan rutin."
      action={
        <button
          type="button"
          onClick={() =>
            activeTab === "tagihan"
              ? setBillModalOpen(true)
              : setGoalModalOpen(true)
          }
          className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-3.5 py-2 text-xs font-semibold text-[#101827] shadow-sm shadow-[#D4AF37]/20 hover:brightness-105 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{activeTab === "tagihan" ? "Tambah Tagihan" : "Buat Target"}</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Top KPI Cards */}
        <EgoStaggerSection index={0}>
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="ego-card-hero ego-card-hero--living rounded-3xl border border-[#D4AF37]/30 p-5 text-white shadow-lg shadow-[#101827]/20">
            <div className="relative z-10 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#E6C768]/90">
                Ketahanan Dana Darurat
              </p>
              <ShieldCheck
                className="h-4 w-4 text-[#E6C768]"
                aria-hidden="true"
              />
            </div>
            <p className="relative z-10 mt-2 font-mono text-2xl font-bold tabular-nums text-white">
              {emergencyMonths !== null ? `${emergencyMonths} bulan` : "—"}
            </p>
            <p className="relative z-10 mt-1.5 text-xs text-slate-300">
              Likuid{" "}
              <span className="font-mono tabular-nums text-[#E6C768]">
                {formatIDR(netWorth.totalAccountBalance, true)}
              </span>{" "}
              · Rata keluar{" "}
              <span className="font-mono tabular-nums">
                {avgCashflow.avgExpense > 0
                  ? `${formatIDR(avgCashflow.avgExpense, true)}/bln`
                  : "belum tercatat"}
              </span>
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Target Keuangan
              </p>
              <Target
                className="h-4 w-4 text-[#9A7411] dark:text-[#E6C768]"
                aria-hidden="true"
              />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#101827] dark:text-white">
              <EgoCountUp
                value={activeGoalsCount}
                formatter={(v) => `${Math.round(v)} Aktif`}
              />
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {completedGoalsCount} target tercapai · Total {goals.length} rencana
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tagihan ≤ 7 Hari
              </p>
              <CalendarClock
                className="h-4 w-4 text-[#D4AF37]"
                aria-hidden="true"
              />
            </div>
            <p
              className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
                dueBills.length > 0
                  ? "text-[#9A7411] dark:text-[#E6C768]"
                  : "text-[#0D9488] dark:text-[#2DD4BF]"
              }`}
            >
              <EgoCountUp
                value={dueBills.length}
                formatter={(v) => `${Math.round(v)} Jadwal`}
              />
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {dueBills.length > 0
                ? `Estimasi total ${formatIDR(dueTotal)}`
                : "Tidak ada tagihan mendesak dalam 7 hari"}
            </p>
          </div>
        </section>
        </EgoStaggerSection>

        <EgoStaggerSection index={1} className="space-y-6">
        {/* Tab Bar + Quick Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Pilih tampilan Target, Simulator, atau Tagihan"
            className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-[#1E293B] dark:bg-[#101827]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "target"}
              onClick={() => setActiveTab("target")}
              className={`ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "target"
                  ? "bg-[#101827] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#101827]"
                  : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Target className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Target Keuangan ({goals.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "simulator"}
              onClick={() => setActiveTab("simulator")}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "simulator"
                  ? "bg-[#101827] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#101827]"
                  : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Simulator Target</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "tagihan"}
              onClick={() => setActiveTab("tagihan")}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "tagihan"
                  ? "bg-[#101827] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#101827]"
                  : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tagihan Rutin ({bills.length})</span>
            </button>
          </div>

          <Link
            to="/owner"
            search={{ tab: "control" }}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#FF4DDE]/30 bg-[#FF4DDE]/8 px-3.5 py-2 text-xs font-semibold text-[#A21CAF] transition-colors hover:bg-[#FF4DDE]/15 whitespace-nowrap dark:border-[#FF4DDE]/35 dark:bg-[#FF4DDE]/12 dark:text-[#FF9EEA]"
          >
            <span>Buka Antrean Persetujuan</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Tab 1: Target Keuangan */}
        {activeTab === "target" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-[#101827] dark:text-white">
                  Daftar Target Tabungan &amp; Dana Darurat ({goals.length})
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Progres target dana beserta estimasi bulan pencapaian dari surplus kas Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGoalModalOpen(true)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-3.5 py-2 text-xs font-semibold text-[#101827] hover:brightness-105 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Buat Target Baru</span>
              </button>
            </div>

            {isLoading ? (
              <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#0B111E]" />
            ) : goals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-[#1E293B] dark:bg-[#0B111E]/70">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D4AF37]/15 text-[#9A7411] dark:bg-[#D4AF37]/15 dark:text-[#E6C768]">
                  <Target className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-bold text-[#101827] dark:text-white">
                  Belum ada target tabungan atau dana darurat
                </p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Tetapkan target dana darurat 3–6 bulan pengeluaran atau sasaran tabungan khusus Anda.
                </p>
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(true)}
                  className="mt-4 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2 text-xs font-semibold text-[#101827] hover:brightness-105"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Buat Target Pertama</span>
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {visibleGoals.map((goal) => {
                  const linkedAcc = goal.linked_account_id
                    ? accountMap.get(goal.linked_account_id)
                    : undefined;
                  const progress = computeGoalProgress(goal, linkedAcc);
                  const estMonths = !progress.isCompleted
                    ? estimateGoalCompletionMonths(
                        progress.remainingAmount,
                        avgCashflow.avgNet
                      )
                    : 0;

                  return (
                    <div
                      key={goal.id}
                      className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/75 p-4 dark:border-[#1E293B] dark:bg-[#0B111E]/85"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-bold text-[#101827] dark:text-white">
                                {goal.title}
                              </h3>
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                  progress.isCompleted
                                    ? "bg-[#14B8A6]/15 text-[#0D9488] dark:bg-[#14B8A6]/20 dark:text-[#2DD4BF]"
                                    : "bg-[#D4AF37]/15 text-[#9A7411] dark:bg-[#D4AF37]/18 dark:text-[#E6C768]"
                                }`}
                              >
                                {progress.isCompleted
                                  ? "Tercapai"
                                  : goal.goal_type === "emergency_fund"
                                    ? "Dana Darurat"
                                    : "Target Tabungan"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {linkedAcc
                                ? `Tersinkron: ${linkedAcc.account_name}`
                                : "Progres manual"}
                              {goal.target_date
                                ? ` · Tenggat ${formatDateID(goal.target_date, dateFormat)}`
                                : ""}
                              {estMonths !== null && estMonths > 0
                                ? ` · Estimasi ±${estMonths} bln`
                                : ""}
                            </p>
                            {goal.notes ? (
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                {goal.notes}
                              </p>
                            ) : null}
                          </div>

                          <span className="shrink-0 font-mono text-base font-bold tabular-nums text-[#9A7411] dark:text-[#E6C768]">
                            {progress.percentage}%
                          </span>
                        </div>

                        <div>
                          <div className="mb-1.5 flex items-baseline justify-between gap-2">
                            <span className="font-mono text-sm font-bold tabular-nums text-[#101827] dark:text-white">
                              {formatIDR(progress.savedAmount)}
                            </span>
                            <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                              dari {formatIDR(progress.targetAmount)}
                            </span>
                          </div>
                          <EgoAnimatedBar
                            percentage={progress.percentage}
                            barClassName={
                              progress.isCompleted
                                ? "bg-[#14B8A6]"
                                : "bg-gradient-to-r from-[#B8901F] to-[#D4AF37]"
                            }
                            heightClassName="h-2"
                          />
                          <p className="mt-1 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                            Sisa target: {formatIDR(progress.remainingAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-[#1E293B]">
                        {linkedAcc ? (
                          <button
                            type="button"
                            onClick={() =>
                              openTransactionSheet({
                                type: "transfer",
                                destinationAccountId: linkedAcc.id,
                                category: "Transfer Internal",
                                description: `Setoran target: ${goal.title}`,
                              })
                            }
                            className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#D4AF37]/15 px-3 py-1.5 text-xs font-semibold text-[#9A7411] hover:bg-[#D4AF37]/25 dark:bg-[#D4AF37]/18 dark:text-[#E6C768]"
                          >
                            <span>Catat Setoran</span>
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGoal(goal);
                              setEditGoalAmount(goal.current_amount);
                              setEditGoalConfirmed(false);
                            }}
                            className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#D4AF37]/15 px-3 py-1.5 text-xs font-semibold text-[#9A7411] hover:bg-[#D4AF37]/25 dark:bg-[#D4AF37]/18 dark:text-[#E6C768]"
                          >
                            <span>Perbarui Progres</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setSimGoalId(goal.id);
                            setActiveTab("simulator");
                          }}
                          className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#101827] hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-200"
                        >
                          <Calculator className="h-3.5 w-3.5 text-[#9A7411] dark:text-[#E6C768]" aria-hidden="true" />
                          <span>Simulasikan</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleGoalStatus(goal)}
                          disabled={updateGoal.isPending}
                          className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#101827] hover:bg-slate-100 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-200 dark:hover:bg-[#162032]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#14B8A6]" aria-hidden="true" />
                          <span>
                            {goal.status === "completed"
                              ? "Aktifkan"
                              : "Tandai Tercapai"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteGoal(goal)}
                          disabled={deleteGoal.isPending}
                          aria-label={`Hapus target ${goal.title}`}
                          className="inline-flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#DC2626] hover:bg-[#EF4444]/10 dark:text-[#F87171]"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {goals.length > 0 ? (
              <div className="mt-4 flex flex-col items-center gap-2 border-t border-slate-200 pt-4 dark:border-[#1E293B]">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {showAllGoals
                    ? `${goals.length} target ditampilkan`
                    : `${visibleGoals.length} dari ${goals.length} target ditampilkan`}
                </p>
                {goals.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllGoals((current) => !current)}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-xs font-semibold text-[#9A7411] hover:bg-[#D4AF37]/18 dark:border-[#D4AF37]/30 dark:bg-[#D4AF37]/15 dark:text-[#E6C768]"
                  >
                    {showAllGoals
                      ? "Tampilkan Lebih Sedikit"
                      : `Lihat Semua Target (${goals.length})`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : activeTab === "simulator" ? (
          <GoalSimulatorPanel
            goals={goals}
            accounts={accounts}
            transactions={transactions}
            dateFormat={dateFormat}
            selectedGoalId={simGoalId}
            onSelectGoalId={setSimGoalId}
          />
        ) : (
          /* Tab 3: Tagihan Rutin */
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-[#101827] dark:text-white">
                  Jadwal Tagihan &amp; Pemasukan Rutin ({bills.length})
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Ajukan tagihan ke Antrean Persetujuan. Saldo hanya berubah setelah Anda menyetujui draf di Owner Control.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBillModalOpen(true)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-3.5 py-2 text-xs font-semibold text-[#101827] hover:brightness-105 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tambah Jadwal</span>
              </button>
            </div>

            {isLoading ? (
              <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#0B111E]" />
            ) : bills.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-[#1E293B] dark:bg-[#0B111E]/70">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D4AF37]/15 text-[#9A7411] dark:bg-[#D4AF37]/15 dark:text-[#E6C768]">
                  <CalendarClock className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-bold text-[#101827] dark:text-white">
                  Belum ada jadwal tagihan atau pemasukan rutin
                </p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Daftarkan listrik, internet, langganan, atau jadwal gaji agar EGO mengingatkan Anda sebelum jatuh tempo.
                </p>
                <button
                  type="button"
                  onClick={() => setBillModalOpen(true)}
                  className="mt-4 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2 text-xs font-semibold text-[#101827] hover:brightness-105"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tambah Jadwal Pertama</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-[#1E293B]">
                {visibleBills.map((bill) => {
                  const delta = daysUntilDue(bill.next_due_date);
                  const acc = bill.account_id
                    ? accountMap.get(bill.account_id)
                    : undefined;
                  const dueLabel =
                    delta === null
                      ? ""
                      : delta < 0
                        ? `Terlambat ${Math.abs(delta)} hari`
                        : delta === 0
                          ? "Jatuh tempo hari ini"
                          : `${delta} hari lagi`;

                  const dueTone = !bill.is_active
                    ? "text-slate-400 dark:text-slate-500"
                    : delta !== null && delta < 0
                      ? "text-[#DC2626] dark:text-[#F87171]"
                      : delta !== null && delta <= 7
                        ? "text-[#9A7411] dark:text-[#E6C768]"
                        : "text-slate-500 dark:text-slate-400";

                  return (
                    <div
                      key={bill.id}
                      className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={`text-sm font-bold ${
                              bill.is_active
                                ? "text-[#101827] dark:text-white"
                                : "text-slate-400 line-through dark:text-slate-500"
                            }`}
                          >
                            {bill.title}
                          </h3>
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            · {recurringFrequencyLabel(bill.frequency)} ·{" "}
                            {bill.category}
                            {acc ? ` · ${acc.account_name}` : ""}
                          </span>
                        </div>
                        <p className={`mt-1 text-xs font-semibold ${dueTone}`}>
                          Jatuh tempo {formatDateID(bill.next_due_date, dateFormat)}
                          {dueLabel ? ` · ${dueLabel}` : ""}
                          {!bill.is_active ? " · Dijeda" : ""}
                          {bill.notes ? ` · ${bill.notes}` : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <span
                          className={`mr-1 font-mono text-sm font-bold tabular-nums ${
                            bill.transaction_type === "income"
                              ? "text-[#0D9488] dark:text-[#2DD4BF]"
                              : "text-[#DC2626] dark:text-[#F87171]"
                          }`}
                        >
                          {bill.transaction_type === "income" ? "+" : "-"}
                          {formatIDR(bill.amount)}
                        </span>

                        {bill.is_active ? (
                          <button
                            type="button"
                            onClick={() => handleQueueBill(bill)}
                            disabled={queueBill.isPending}
                            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#D4AF37]/15 px-3 py-1.5 text-xs font-semibold text-[#9A7411] transition-colors hover:bg-[#D4AF37]/25 whitespace-nowrap dark:bg-[#D4AF37]/18 dark:text-[#E6C768]"
                          >
                            <Send className="h-3 w-3" aria-hidden="true" />
                            <span>Ajukan Bayar</span>
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleToggleBill(bill)}
                          disabled={toggleBill.isPending}
                          aria-label={
                            bill.is_active
                              ? `Jeda jadwal ${bill.title}`
                              : `Aktifkan jadwal ${bill.title}`
                          }
                          className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-[#101827] hover:bg-slate-200 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200 dark:hover:bg-[#162032]"
                        >
                          {bill.is_active ? (
                            <>
                              <Pause className="h-3 w-3" aria-hidden="true" />
                              <span>Jeda</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3" aria-hidden="true" />
                              <span>Aktifkan</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteBill(bill)}
                          disabled={deleteBill.isPending}
                          aria-label={`Hapus jadwal ${bill.title}`}
                          className="inline-flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#DC2626] hover:bg-[#EF4444]/10 dark:text-[#F87171]"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {bills.length > 0 ? (
              <div className="mt-4 flex flex-col items-center gap-2 border-t border-slate-200 pt-4 dark:border-[#1E293B]">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {showAllBills
                    ? `${bills.length} jadwal ditampilkan`
                    : `${visibleBills.length} dari ${bills.length} jadwal ditampilkan`}
                </p>
                {bills.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllBills((current) => !current)}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-xs font-semibold text-[#9A7411] hover:bg-[#D4AF37]/18 dark:border-[#D4AF37]/30 dark:bg-[#D4AF37]/15 dark:text-[#E6C768]"
                  >
                    {showAllBills
                      ? "Tampilkan Lebih Sedikit"
                      : `Lihat Semua Jadwal (${bills.length})`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        )}
        </EgoStaggerSection>
      </div>

      {/* Modal Buat Target Tabungan */}
      <ModalSheet
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        title="Buat Target Tabungan"
        subtitle="Tetapkan sasaran dana darurat atau tabungan dengan persetujuan Owner."
      >
        <form onSubmit={handleCreateGoal} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="goal-title"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Nama Target{" "}
              <span className="text-[#EF4444]">*</span>
            </label>
            <input
              id="goal-title"
              type="text"
              required
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="Contoh: Dana Darurat 6 Bulan"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="goal-type"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Jenis Sasaran
            </label>
            <select
              id="goal-type"
              value={goalType}
              onChange={(e) => setGoalType(e.target.value as GoalType)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
            >
              <option value="emergency_fund">Dana Darurat</option>
              <option value="savings_target">Target Tabungan</option>
            </select>
          </div>

          <MoneyInput
            id="goal-target-amount"
            label="Target Nominal (IDR)"
            value={goalTarget}
            onChange={setGoalTarget}
            required
          />

          <div className="space-y-1.5">
            <label
              htmlFor="goal-track-mode"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Metode Pantau Dana
            </label>
            <select
              id="goal-track-mode"
              value={goalTrackMode}
              onChange={(e) =>
                setGoalTrackMode(e.target.value as "manual" | "account")
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
            >
              <option value="manual">Catat Progres Manual</option>
              <option value="account">Sinkronkan Saldo Akun Aktif</option>
            </select>
          </div>

          {goalTrackMode === "account" ? (
            <div className="space-y-1.5">
              <label
                htmlFor="goal-linked-acc"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Akun Khusus Tabungan{" "}
                <span className="text-[#EF4444]">*</span>
              </label>
              <select
                id="goal-linked-acc"
                value={goalLinkedAccountId}
                onChange={(e) => setGoalLinkedAccountId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
              >
                <option value="">Pilih akun aktif...</option>
                {activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} ({formatIDR(acc.current_balance)})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <MoneyInput
              id="goal-initial-amount"
              label="Dana Terkumpul Awal (IDR)"
              value={goalInitialAmount}
              onChange={setGoalInitialAmount}
            />
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="goal-target-date"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Target Tanggal (Opsional)
            </label>
            <input
              id="goal-target-date"
              type="date"
              value={goalTargetDate}
              onChange={(e) => setGoalTargetDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="goal-notes"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Catatan (Opsional)
            </label>
            <input
              id="goal-notes"
              type="text"
              value={goalNotes}
              onChange={(e) => setGoalNotes(e.target.value)}
              placeholder="Alokasi bulanan atau tujuan dana"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500"
            />
          </div>

          <ApprovalCheck
            id="goal-owner-confirm"
            checked={goalConfirmed}
            onChange={setGoalConfirmed}
          />

          <button
            type="submit"
            disabled={!goalConfirmed || createGoal.isPending}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2.5 text-sm font-semibold text-[#101827] shadow-sm transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:from-[#162032] dark:disabled:to-[#162032] dark:disabled:text-slate-500"
          >
            {createGoal.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            <span>Simpan Target Tabungan</span>
          </button>
        </form>
      </ModalSheet>

      {/* Modal Perbarui Progres Target */}
      <ModalSheet
        open={Boolean(editingGoal)}
        onClose={() => setEditingGoal(null)}
        title={
          editingGoal
            ? `Perbarui Progres: ${editingGoal.title}`
            : "Perbarui Progres"
        }
        subtitle={
          editingGoal
            ? `Target sasaran: ${formatIDR(editingGoal.target_amount)}`
            : undefined
        }
      >
        {editingGoal ? (
          <form onSubmit={handleUpdateGoalAmount} className="space-y-4">
            <MoneyInput
              id="edit-goal-amount"
              label="Total Dana Terkumpul Saat Ini (IDR)"
              value={editGoalAmount}
              onChange={setEditGoalAmount}
              required
            />
            <ApprovalCheck
              id="edit-goal-confirm"
              checked={editGoalConfirmed}
              onChange={setEditGoalConfirmed}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingGoal(null)}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-[#101827] hover:bg-slate-200 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!editGoalConfirmed || updateGoal.isPending}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2.5 text-xs font-semibold text-[#101827] hover:brightness-105 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 dark:disabled:from-[#162032] dark:disabled:to-[#162032] dark:disabled:text-slate-500"
              >
                {updateGoal.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                <span>Simpan Progres</span>
              </button>
            </div>
          </form>
        ) : null}
      </ModalSheet>

      {/* Modal Tambah Jadwal Rutin */}
      <ModalSheet
        open={billModalOpen}
        onClose={() => setBillModalOpen(false)}
        title="Tambah Jadwal Rutin"
        subtitle="Catat tagihan bulanan atau pemasukan berkala dengan konfirmasi Owner."
      >
        <form onSubmit={handleCreateBill} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="bill-title"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Nama Tagihan / Pemasukan{" "}
              <span className="text-[#EF4444]">*</span>
            </label>
            <input
              id="bill-title"
              type="text"
              required
              value={billTitle}
              onChange={(e) => setBillTitle(e.target.value)}
              placeholder="Contoh: Internet Biznet / Gaji Bulanan"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="bill-type"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Jenis
              </label>
              <select
                id="bill-type"
                value={billType}
                onChange={(e) => {
                  const next = e.target.value as "income" | "expense";
                  setBillType(next);
                  setBillCategory(
                    next === "income"
                      ? RECURRING_INCOME_CATEGORIES[0]
                      : RECURRING_EXPENSE_CATEGORIES[0]
                  );
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
              >
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="bill-frequency"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Frekuensi
              </label>
              <select
                id="bill-frequency"
                value={billFrequency}
                onChange={(e) =>
                  setBillFrequency(e.target.value as RecurringFrequency)
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
              >
                <option value="weekly">Mingguan</option>
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
            </div>
          </div>

          <MoneyInput
            id="bill-amount"
            label="Nominal Estimasi (IDR)"
            value={billAmount}
            onChange={setBillAmount}
            required
          />

          <div className="space-y-1.5">
            <label
              htmlFor="bill-category"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Kategori
            </label>
            <select
              id="bill-category"
              value={billCategory}
              onChange={(e) => setBillCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
            >
              {(billType === "income"
                ? RECURRING_INCOME_CATEGORIES
                : RECURRING_EXPENSE_CATEGORIES
              ).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="bill-account"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Akun Sumber / Tujuan
            </label>
            <select
              id="bill-account"
              value={billAccountId}
              onChange={(e) => setBillAccountId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
            >
              <option value="">Pilih nanti saat persetujuan</option>
              {activeAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_name} ({formatIDR(acc.current_balance)})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="bill-due-date"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Jatuh Tempo Berikutnya{" "}
              <span className="text-[#EF4444]">*</span>
            </label>
            <input
              id="bill-due-date"
              type="date"
              required
              value={billDueDate}
              onChange={(e) => setBillDueDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="bill-notes"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Catatan (Opsional)
            </label>
            <input
              id="bill-notes"
              type="text"
              value={billNotes}
              onChange={(e) => setBillNotes(e.target.value)}
              placeholder="Nomor pelanggan atau keterangan singkat"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500"
            />
          </div>

          <ApprovalCheck
            id="bill-owner-confirm"
            checked={billConfirmed}
            onChange={setBillConfirmed}
          />

          <button
            type="submit"
            disabled={!billConfirmed || createBill.isPending}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2.5 text-sm font-semibold text-[#101827] shadow-sm transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:from-[#162032] dark:disabled:to-[#162032] dark:disabled:text-slate-500"
          >
            {createBill.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            <span>Simpan Jadwal Rutin</span>
          </button>
        </form>
      </ModalSheet>
    </AppShell>
  );
}
