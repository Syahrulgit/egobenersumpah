import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  History,
  Info,
  Loader2,
  PauseCircle,
  PieChart,
  PlayCircle,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { ApprovalCheck } from "../../components/ego/approval-check";
import {
  BudgetUsageChart,
  severityBadgeClass,
} from "../../components/ego/budget-usage-chart";
import { CategoryIcon } from "../../components/ego/category-icon";
import {
  EgoAnimatedBar,
  EgoCountUp,
  EgoStaggerSection,
} from "../../components/ego/ego-motion";
import { ModalSheet } from "../../components/ego/modal-sheet";
import { MoneyInput } from "../../components/ego/money-input";
import { useTransactionSheet } from "../../components/ego/transaction-input-sheet";
import {
  BUDGET_CATEGORY_PRESETS,
  budgetThresholdLabel,
  formatPeriodMonthID,
  normalizeBudgetCategoryKey,
  shiftPeriodMonth,
  summarizeBudgetMonth,
} from "../../lib/budgets";
import { formatDateID, formatIDR, todayISO } from "../../lib/finance";
import {
  useCopyMonthBudgets,
  useCreateBudget,
  useDeleteBudget,
  useUpdateBudget,
  useVaultSnapshot,
} from "../../lib/queries";
import { summarizeRemindersForDashboard } from "../../lib/reminders";
import type { BudgetAlertLog, CategoryBudget } from "../../types/ego";

type BudgetTab = "pantauan" | "riwayat";
type BudgetFilter = "all" | "attention" | "exceeded" | "inactive";

function logEventLabel(log: BudgetAlertLog): {
  label: string;
  badgeCls: string;
} {
  if (log.event_type === "threshold_crossed") {
    if (log.threshold_level === 101 || log.threshold_level === 100) {
      return {
        label: budgetThresholdLabel(log.threshold_level),
        badgeCls:
          "bg-[#EF4444]/15 text-[#DC2626] dark:bg-[#EF4444]/20 dark:text-[#F87171]",
      };
    }
    if (log.threshold_level === 90) {
      return {
        label: budgetThresholdLabel(90),
        badgeCls:
          "bg-orange-500/15 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
      };
    }
    if (log.threshold_level === 75) {
      return {
        label: budgetThresholdLabel(75),
        badgeCls:
          "bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
      };
    }
    return {
      label: budgetThresholdLabel(50),
      badgeCls:
        "bg-[#D4AF37]/15 text-[#9A7411] dark:bg-[#D4AF37]/20 dark:text-[#E6C768]",
    };
  }
  switch (log.event_type) {
    case "created":
      return {
        label: "Anggaran Dibuat",
        badgeCls:
          "bg-[#D4AF37]/15 text-[#9A7411] dark:bg-[#D4AF37]/20 dark:text-[#E6C768]",
      };
    case "updated":
      return {
        label: "Batas Diperbarui",
        badgeCls:
          "bg-slate-200/80 text-slate-700 dark:bg-[#162032] dark:text-slate-300",
      };
    case "paused":
      return {
        label: "Dinonaktifkan",
        badgeCls:
          "bg-slate-200/80 text-slate-600 dark:bg-[#162032] dark:text-slate-400",
      };
    case "resumed":
      return {
        label: "Diaktifkan Kembali",
        badgeCls:
          "bg-[#14B8A6]/15 text-[#0D9488] dark:bg-[#14B8A6]/20 dark:text-[#2DD4BF]",
      };
  }
}

export function AnggaranPage() {
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const { openTransactionSheet } = useTransactionSheet();
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();
  const copyMonthBudgets = useCopyMonthBudgets();

  const currentMonth = todayISO().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [activeTab, setActiveTab] = useState<BudgetTab>("pantauan");
  const [filterStatus, setFilterStatus] = useState<BudgetFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllBudgets, setShowAllBudgets] = useState(false);
  const [historyScope, setHistoryScope] = useState<"month" | "all">("month");

  // Modal state: Create / Edit Budget
  const [formOpen, setFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<CategoryBudget | null>(null);
  const [categorySelect, setCategorySelect] = useState<string>(BUDGET_CATEGORY_PRESETS[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [formMonth, setFormMonth] = useState(currentMonth);
  const [limitAmount, setLimitAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formConfirmed, setFormConfirmed] = useState(false);

  // Modal state: Copy previous month
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyConfirmed, setCopyConfirmed] = useState(false);

  // Modal state: Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<CategoryBudget | null>(null);

  const budgets = vault?.category_budgets ?? [];
  const alertLogs = vault?.budget_alert_logs ?? [];
  const transactions = vault?.transactions ?? [];
  const bills = vault?.recurring_bills ?? [];
  const reminders = vault?.financial_reminders ?? [];
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";
  const budgetsTableReady = vault?.budgetsTableReady !== false;

  const summary = useMemo(
    () =>
      summarizeBudgetMonth(
        budgets,
        transactions,
        selectedMonth,
        alertLogs,
        bills,
        reminders
      ),
    [budgets, transactions, selectedMonth, alertLogs, bills, reminders]
  );

  const reminderSummary = useMemo(
    () => summarizeRemindersForDashboard(reminders, bills, vault?.debts ?? []),
    [reminders, bills, vault?.debts]
  );

  const prevMonth = shiftPeriodMonth(selectedMonth, -1);
  const prevMonthCopyableCount = useMemo(() => {
    const existingKeys = new Set(
      summary.items.map((i) => normalizeBudgetCategoryKey(i.budget.category))
    );
    return budgets.filter(
      (b) =>
        b.period_month === prevMonth &&
        b.is_active &&
        !existingKeys.has(normalizeBudgetCategoryKey(b.category))
    ).length;
  }, [budgets, prevMonth, summary.items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return summary.items.filter((item) => {
      if (filterStatus === "attention") {
        if (
          !item.budget.is_active ||
          (item.severity !== "warning_75" &&
            item.severity !== "high_90" &&
            item.severity !== "reached_100" &&
            item.severity !== "exceeded_over")
        ) {
          return false;
        }
      } else if (filterStatus === "exceeded") {
        if (
          !item.budget.is_active ||
          (item.severity !== "reached_100" && item.severity !== "exceeded_over")
        ) {
          return false;
        }
      } else if (filterStatus === "inactive") {
        if (item.budget.is_active) return false;
      }

      if (q) {
        const hay = `${item.budget.category} ${item.budget.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [summary.items, filterStatus, searchQuery]);

  const visibleItems = showAllBudgets ? filteredItems : filteredItems.slice(0, 5);

  const filteredLogs = useMemo(() => {
    return alertLogs.filter((l) =>
      historyScope === "month" ? l.period_month === selectedMonth : true
    );
  }, [alertLogs, historyScope, selectedMonth]);

  function openCreateModal(prefillCategory?: string) {
    setEditingBudget(null);
    const chosen = prefillCategory || BUDGET_CATEGORY_PRESETS[0];
    if ((BUDGET_CATEGORY_PRESETS as readonly string[]).includes(chosen)) {
      setCategorySelect(chosen);
      setCustomCategory("");
    } else {
      setCategorySelect("__custom__");
      setCustomCategory(chosen);
    }
    setFormMonth(selectedMonth);
    setLimitAmount(0);
    setNotes("");
    setIsActive(true);
    setFormConfirmed(false);
    setFormOpen(true);
  }

  function openEditModal(budget: CategoryBudget) {
    setEditingBudget(budget);
    if ((BUDGET_CATEGORY_PRESETS as readonly string[]).includes(budget.category)) {
      setCategorySelect(budget.category);
      setCustomCategory("");
    } else {
      setCategorySelect("__custom__");
      setCustomCategory(budget.category);
    }
    setFormMonth(budget.period_month);
    setLimitAmount(budget.limit_amount);
    setNotes(budget.notes ?? "");
    setIsActive(budget.is_active);
    setFormConfirmed(false);
    setFormOpen(true);
  }

  async function handleSaveBudget(e: FormEvent) {
    e.preventDefault();
    const resolvedCategory =
      categorySelect === "__custom__" ? customCategory.trim() : categorySelect;
    if (!resolvedCategory) {
      toast.error("Pilih atau masukkan nama kategori pengeluaran.");
      return;
    }

    try {
      if (editingBudget) {
        await updateBudget.mutateAsync({
          id: editingBudget.id,
          category: resolvedCategory,
          period_month: formMonth,
          limit_amount: limitAmount,
          is_active: isActive,
          notes,
          owner_confirmed: formConfirmed,
          previousPeriodMonth: editingBudget.period_month,
          budgetCategoryForLog: editingBudget.category,
          budgetLimitForLog: editingBudget.limit_amount,
        });
        toast.success(`Anggaran "${resolvedCategory}" diperbarui.`);
      } else {
        await createBudget.mutateAsync({
          category: resolvedCategory,
          period_month: formMonth,
          limit_amount: limitAmount,
          is_active: isActive,
          notes,
          owner_confirmed: formConfirmed,
        });
        toast.success(`Anggaran "${resolvedCategory}" (${formatPeriodMonthID(formMonth)}) disimpan.`);
      }
      setSelectedMonth(formMonth);
      setFormOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan anggaran.");
    }
  }

  async function handleToggleActive(budget: CategoryBudget) {
    try {
      await updateBudget.mutateAsync({
        id: budget.id,
        is_active: !budget.is_active,
      });
      toast.success(
        !budget.is_active
          ? `Anggaran "${budget.category}" diaktifkan kembali.`
          : `Anggaran "${budget.category}" dijeda sementara.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status anggaran.");
    }
  }

  async function handleConfirmCopyMonth(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await copyMonthBudgets.mutateAsync({
        from_month: prevMonth,
        to_month: selectedMonth,
        sourceBudgets: budgets,
        existingTargetBudgets: summary.items.map((i) => i.budget),
        owner_confirmed: copyConfirmed,
      });
      if (res.copiedCount > 0) {
        toast.success(
          `${res.copiedCount} anggaran aktif disalin dari ${formatPeriodMonthID(prevMonth)}.`
        );
      } else {
        toast.info("Tidak ada kategori baru yang perlu disalin dari bulan sebelumnya.");
      }
      setCopyModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyalin anggaran.");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteBudget.mutateAsync(deleteTarget.id);
      toast.success(`Anggaran "${deleteTarget.category}" dihapus.`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus anggaran.");
    }
  }

  return (
    <AppShell
      title="Smart Budget Monitor"
      subtitle="Pantau batas anggaran per kategori berbasis transaksi terkonfirmasi Owner."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={prevMonthCopyableCount === 0}
            onClick={() => {
              setCopyConfirmed(false);
              setCopyModalOpen(true);
            }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#101827] transition-colors hover:border-[#D4AF37]/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-200"
          >
            <Copy className="h-3.5 w-3.5 text-[#9A7411] dark:text-[#E6C768]" aria-hidden="true" />
            <span>Salin {formatPeriodMonthID(prevMonth, true)}</span>
          </button>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2 text-xs font-semibold text-[#101827] shadow-sm shadow-[#D4AF37]/20 hover:brightness-105"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tambah Anggaran</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Missing Supabase Table Notice */}
        {!budgetsTableReady ? (
          <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-4 text-xs text-[#101827] dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/12 dark:text-amber-100">
            <p className="font-bold">Tabel Anggaran Belum Aktif di Supabase</p>
            <p className="mt-1 leading-relaxed">
              Jalankan skrip migrasi idempoten{" "}
              <code className="rounded bg-[#D4AF37]/20 px-1.5 py-0.5 font-mono">
                docs/ego-supabase-budgets-migration.sql
              </code>{" "}
              pada SQL Editor Supabase untuk mengaktifkan penyimpanan cloud Smart Budget Monitor.
              Seluruh tabel dan saldo transaksi yang sudah ada tetap aman.
            </p>
          </div>
        ) : null}

        {/* Period Switcher & Confirmed-Only Policy Strip */}
        <EgoStaggerSection index={0} className="space-y-4">
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label="Bulan sebelumnya"
              onClick={() => setSelectedMonth((m) => shiftPeriodMonth(m, -1))}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[#101827] hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-[#1E293B] dark:bg-[#0B111E]">
              <label
                htmlFor="budget-period-picker"
                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
              >
                Periode
              </label>
              <input
                id="budget-period-picker"
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) {
                    setSelectedMonth(e.target.value);
                  }
                }}
                className="bg-transparent font-mono text-sm font-bold text-[#101827] focus:outline-none dark:text-white"
              />
            </div>

            <button
              type="button"
              aria-label="Bulan berikutnya"
              onClick={() => setSelectedMonth((m) => shiftPeriodMonth(m, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[#101827] hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {selectedMonth !== currentMonth ? (
              <button
                type="button"
                onClick={() => setSelectedMonth(currentMonth)}
                className="min-h-[38px] rounded-xl bg-[#D4AF37]/15 px-3 py-1.5 text-xs font-semibold text-[#9A7411] hover:bg-[#D4AF37]/25 dark:bg-[#D4AF37]/20 dark:text-[#E6C768]"
              >
                Bulan Ini
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Info className="h-4 w-4 shrink-0 text-[#9A7411] dark:text-[#E6C768]" aria-hidden="true" />
            <span>
              Periode <strong>{formatPeriodMonthID(selectedMonth)}</strong> · Hanya menghitung transaksi
              pengeluaran <strong>terkonfirmasi Owner</strong> (draf pending tidak dihitung).
            </span>
          </div>
        </section>

        {/* KPI Summary Cards */}
        <section aria-label="Ringkasan Anggaran Periode" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#101827]">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Anggaran Aktif
            </p>
            <p className="mt-2 font-mono text-lg font-bold tabular-nums text-[#101827] dark:text-white">
              <EgoCountUp value={summary.totalBudget} formatter={(v) => formatIDR(v)} />
            </p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {summary.activeCount} kategori aktif
              {summary.inactiveCount > 0 ? ` · ${summary.inactiveCount} dijeda` : ""}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#101827]">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Pengeluaran Terkonfirmasi
            </p>
            <p className="mt-2 font-mono text-lg font-bold tabular-nums text-[#9A7411] dark:text-[#E6C768]">
              <EgoCountUp value={summary.totalSpentBudgeted} formatter={(v) => formatIDR(v)} />
            </p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {summary.overallUsagePct.toFixed(1)}% terpakai · Total beban bulan{" "}
              {formatIDR(summary.totalConfirmedExpenseAll, true)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#101827]">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Sisa Anggaran
            </p>
            <p
              className={`mt-2 font-mono text-lg font-bold tabular-nums ${
                summary.remainingBudget < 0
                  ? "text-[#DC2626] dark:text-[#F87171]"
                  : "text-[#0D9488] dark:text-[#2DD4BF]"
              }`}
            >
              <EgoCountUp
                value={summary.remainingBudget}
                formatter={(v) =>
                  v < 0 ? `-${formatIDR(Math.abs(v))}` : formatIDR(v)
                }
              />
            </p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {summary.remainingBudget < 0
                ? "Melebihi total anggaran aktif"
                : "Ruang pengeluaran kategori terpantau"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#101827]">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Status Ambang Peringatan
            </p>
            <div className="mt-2 flex items-center gap-2">
              {summary.attentionCount > 0 ? (
                <ShieldAlert className="h-5 w-5 text-[#D4AF37]" aria-hidden="true" />
              ) : (
                <CheckCircle2
                  className="h-5 w-5 text-[#14B8A6]"
                  aria-hidden="true"
                />
              )}
              <span className="font-mono text-lg font-bold tabular-nums text-[#101827] dark:text-white">
                {summary.attentionCount} Perlu Perhatian
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {summary.exceededCount + summary.reachedCount} ≥100% ·{" "}
              {summary.highWarningCount} ≥90% · {summary.approachingCount} ≥75%
            </p>
          </div>
        </section>
        </EgoStaggerSection>

        {/* Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Tampilan Smart Budget Monitor"
            className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-[#1E293B] dark:bg-[#101827]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "pantauan"}
              onClick={() => setActiveTab("pantauan")}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "pantauan"
                  ? "bg-[#101827] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#101827]"
                  : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <PieChart className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Pantauan Anggaran ({summary.items.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "riwayat"}
              onClick={() => setActiveTab("riwayat")}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "riwayat"
                  ? "bg-[#101827] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#101827]"
                  : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Riwayat &amp; Peringatan ({alertLogs.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/pengingat"
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#101827] hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-200"
            >
              <BellRing className="h-3.5 w-3.5 text-[#9A7411] dark:text-[#E6C768]" aria-hidden="true" />
              <span>Pengingat ({reminderSummary.totalActiveCount})</span>
            </Link>
            <Link
              to="/rencana"
              search={{ tab: "simulator" }}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#101827] hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-200"
            >
              <Calculator className="h-3.5 w-3.5 text-[#9A7411] dark:text-[#E6C768]" aria-hidden="true" />
              <span>Simulator Target</span>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-300">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#D4AF37]" />
            <span>Memuat data Smart Budget Monitor...</span>
          </div>
        ) : activeTab === "pantauan" ? (
          <EgoStaggerSection index={1} className="space-y-6">
            {/* Usage Chart Card */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-[#101827] dark:text-white">
                    Grafik Penggunaan Anggaran — {formatPeriodMonthID(selectedMonth)}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ketuk bar kategori untuk melihat rincian pemakaian terhadap batas bulanan.
                  </p>
                </div>
              </div>
              <BudgetUsageChart items={summary.activeItems} />
            </section>

            {/* Filter & Search Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: "all", label: `Semua (${summary.items.length})` },
                    {
                      id: "attention",
                      label: `≥75% Perhatian (${summary.attentionCount})`,
                    },
                    {
                      id: "exceeded",
                      label: `≥100% Terpenuhi/Lewat (${summary.exceededCount + summary.reachedCount})`,
                    },
                    {
                      id: "inactive",
                      label: `Dijeda (${summary.inactiveCount})`,
                    },
                  ] as const
                ).map((chip) => {
                  const active = filterStatus === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setFilterStatus(chip.id)}
                      className={`min-h-[36px] rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#9A7411] dark:border-[#D4AF37] dark:bg-[#D4AF37]/20 dark:text-[#E6C768]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-[#D4AF37]/40 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-300"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-64">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kategori atau catatan..."
                  className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white pr-3 pl-9 text-xs text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:outline-none dark:border-[#1E293B] dark:bg-[#101827] dark:text-white"
                />
              </div>
            </div>

            {/* Category Budget List */}
            {filteredItems.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-[#1E293B] dark:bg-[#101827]">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D4AF37]/15 text-[#9A7411] dark:bg-[#D4AF37]/15 dark:text-[#E6C768]">
                  <PieChart className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-[#101827] dark:text-white">
                  {summary.items.length === 0
                    ? `Belum ada anggaran untuk ${formatPeriodMonthID(selectedMonth)}`
                    : "Tidak ada anggaran yang cocok dengan filter"}
                </h3>
                <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                  {summary.items.length === 0
                    ? "Tetapkan batas bulanan per kategori pengeluaran agar EGO memberi peringatan otomatis di 50%, 75%, 90%, 100%, dan >100%."
                    : "Ubah kata kunci pencarian atau pilih filter status lain."}
                </p>
                {summary.items.length === 0 ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => openCreateModal()}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2 text-xs font-semibold text-[#101827] hover:brightness-105"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Buat Anggaran Pertama</span>
                    </button>
                    {prevMonthCopyableCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCopyConfirmed(false);
                          setCopyModalOpen(true);
                        }}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-[#101827] dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
                      >
                        <Copy className="h-3.5 w-3.5 text-[#9A7411] dark:text-[#E6C768]" />
                        <span>Salin {prevMonthCopyableCount} Anggaran Bulan Lalu</span>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {visibleItems.map((item) => {
                  const b = item.budget;
                  const fillWidth = Math.min(100, Math.max(0, item.usagePct));
                  const barColor =
                    item.severity === "exceeded_over" || item.severity === "reached_100"
                      ? "bg-[#EF4444]"
                      : item.severity === "high_90"
                        ? "bg-orange-500"
                        : item.severity === "warning_75"
                          ? "bg-[#D4AF37]"
                          : item.severity === "inactive"
                            ? "bg-slate-400"
                            : "bg-gradient-to-r from-[#0D9488] to-[#14B8A6]";
                  const hasScheduledRisk =
                    item.scheduledUpcomingAmount > 0 &&
                    item.scheduledUpcomingAmount > Math.max(0, item.remainingAmount);

                  return (
                    <article
                      key={b.id}
                      className={`flex flex-col justify-between rounded-2xl border p-4 shadow-xs transition-colors dark:shadow-none ${
                        b.is_active
                          ? "border-slate-200 bg-white dark:border-[#1E293B] dark:bg-[#101827]"
                          : "border-slate-200/75 bg-slate-50/80 opacity-85 dark:border-[#1E293B]/70 dark:bg-[#0B111E]/70"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/12 text-[#9A7411] dark:bg-[#D4AF37]/15 dark:text-[#E6C768]">
                              <CategoryIcon
                                category={b.category}
                                transactionType="expense"
                                className="h-5 w-5"
                              />
                            </span>
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-bold text-[#101827] dark:text-white">
                                {b.category}
                              </h3>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {item.transactionCount} transaksi terkonfirmasi
                              </p>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold ${severityBadgeClass(
                              item.severity
                            )}`}
                          >
                            {item.shortLabel}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-baseline justify-between gap-2 text-xs">
                            <span className="font-mono font-bold text-[#101827] dark:text-white tabular-nums">
                              {formatIDR(item.spentAmount)}
                              <span className="font-normal text-slate-500 dark:text-slate-400">
                                {" "}
                                / {formatIDR(b.limit_amount)}
                              </span>
                            </span>
                            <span className="font-mono font-bold text-[#9A7411] dark:text-[#E6C768] tabular-nums">
                              {item.usagePct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="relative">
                            <EgoAnimatedBar
                              percentage={fillWidth}
                              heightClassName="h-2.5"
                              barClassName={barColor}
                              ariaLabel={`Progres anggaran ${b.category}`}
                            />
                            <span className="pointer-events-none absolute inset-y-0 left-[50%] w-px bg-white/75 dark:bg-[#0B111E]/75" />
                            <span className="pointer-events-none absolute inset-y-0 left-[75%] w-px bg-white/75 dark:bg-[#0B111E]/75" />
                            <span className="pointer-events-none absolute inset-y-0 left-[90%] w-px bg-white/85 dark:bg-[#0B111E]/85" />
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span
                              className={
                                item.remainingAmount < 0
                                  ? "font-semibold text-[#DC2626] dark:text-[#F87171]"
                                  : "text-slate-600 dark:text-slate-300"
                              }
                            >
                              {item.remainingAmount < 0
                                ? `Terlampaui ${formatIDR(Math.abs(item.remainingAmount))}`
                                : `Sisa anggaran ${formatIDR(item.remainingAmount)}`}
                            </span>
                            <Link
                              to="/transaksi"
                              search={{ kategori: b.category, jenis: "expense" }}
                              className="font-semibold text-[#9A7411] hover:underline dark:text-[#E6C768]"
                            >
                              Lihat mutasi
                            </Link>
                          </div>
                        </div>

                        {item.scheduledUpcomingAmount > 0 ? (
                          <div
                            className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] ${
                              hasScheduledRisk
                                ? "border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#101827] dark:border-[#D4AF37]/35 dark:bg-[#D4AF37]/12 dark:text-amber-200"
                                : "border-slate-200 bg-slate-50 text-slate-600 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-300"
                            }`}
                          >
                            {hasScheduledRisk ? (
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D4AF37]" />
                            ) : (
                              <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9A7411] dark:text-[#E6C768]" />
                            )}
                            <span>
                              Ada pengingat/tagihan kategori ini bulan ini sebesar{" "}
                              <strong className="font-mono">
                                {formatIDR(item.scheduledUpcomingAmount)}
                              </strong>
                              {hasScheduledRisk
                                ? " (melebihi sisa anggaran saat ini)."
                                : "."}
                            </span>
                          </div>
                        ) : null}

                        {b.notes ? (
                          <p className="text-[11px] italic text-slate-500 dark:text-slate-400">
                            Catatan: {b.notes}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3 dark:border-[#1E293B]">
                        <button
                          type="button"
                          onClick={() =>
                            openTransactionSheet({ type: "expense", category: b.category })
                          }
                          className="ego-pressable inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-[#D4AF37]/12 px-3 py-1.5 text-xs font-semibold text-[#9A7411] hover:bg-[#D4AF37]/20 dark:bg-[#D4AF37]/15 dark:text-[#E6C768]"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Catat Beban</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(b)}
                            aria-label={`Edit anggaran ${b.category}`}
                            className="ego-pressable inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-[#101827] hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleToggleActive(b)}
                            disabled={updateBudget.isPending}
                            aria-label={
                              b.is_active
                                ? `Nonaktifkan anggaran ${b.category}`
                                : `Aktifkan anggaran ${b.category}`
                            }
                            className="ego-pressable inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-300"
                            title={b.is_active ? "Nonaktifkan sementara" : "Aktifkan kembali"}
                          >
                            {b.is_active ? (
                              <PauseCircle className="h-4 w-4" />
                            ) : (
                              <PlayCircle className="h-4 w-4 text-[#14B8A6]" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(b)}
                            aria-label={`Hapus anggaran ${b.category}`}
                            className="ego-pressable inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/8 text-[#DC2626] hover:bg-[#EF4444]/15 dark:border-[#EF4444]/30 dark:bg-[#EF4444]/12 dark:text-[#F87171]"
                            title="Hapus anggaran"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {filteredItems.length > 0 ? (
              <div className="mt-4 flex flex-col items-center gap-2 border-t border-slate-200 pt-4 dark:border-[#1E293B]">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {showAllBudgets
                    ? `${filteredItems.length} kategori anggaran ditampilkan`
                    : `${visibleItems.length} dari ${filteredItems.length} kategori anggaran ditampilkan`}
                </p>
                {filteredItems.length > 5 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllBudgets((current) => !current)}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-xs font-semibold text-[#9A7411] transition-colors hover:bg-[#D4AF37]/18 dark:border-[#D4AF37]/30 dark:bg-[#D4AF37]/12 dark:text-[#E6C768]"
                  >
                    {showAllBudgets
                      ? "Tampilkan Lebih Sedikit"
                      : `Lihat Semua Kategori (${filteredItems.length})`}
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* Unbudgeted Categories with Confirmed Expenses */}
            {summary.unbudgetedCategories.length > 0 ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-[#1E293B] dark:bg-[#101827]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-[#101827] dark:text-white">
                      Pengeluaran Terkonfirmasi Tanpa Anggaran
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Kategori berikut sudah memiliki transaksi bulan ini tetapi belum dipantau anggarannya.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {summary.unbudgetedCategories.map((u) => (
                    <div
                      key={u.category}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-[#1E293B] dark:bg-[#0B111E]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[#101827] dark:text-white">
                          {u.category}
                        </p>
                        <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                          {formatIDR(u.spentAmount)} · {u.transactionCount} tx
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCreateModal(u.category)}
                        className="shrink-0 rounded-lg bg-[#D4AF37]/15 px-2.5 py-1.5 text-[11px] font-semibold text-[#9A7411] hover:bg-[#D4AF37]/25 dark:bg-[#D4AF37]/20 dark:text-[#E6C768]"
                      >
                        + Pasang
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Cross-Module Integration Banner (Goal Simulator & Reminder) */}
            <section className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#101827]">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#101827] dark:text-white">
                    Sinkronisasi dengan Simulator Target
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {summary.remainingBudget > 0
                      ? `Sisa anggaran bulan ini ${formatIDR(summary.remainingBudget)} dapat menjadi acuan ruang setoran target tabungan.`
                      : "Tinjau porsi pengeluaran agar jadwal setoran target tetap aman."}
                  </p>
                </div>
                <Link
                  to="/rencana"
                  search={{ tab: "simulator" }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#D4AF37]/15 px-3 py-2 text-xs font-semibold text-[#9A7411] hover:bg-[#D4AF37]/25 dark:bg-[#D4AF37]/20 dark:text-[#E6C768]"
                >
                  <span>Simulasi</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#101827]">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#101827] dark:text-white">
                    Integrasi Financial Reminder
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {reminderSummary.overdueCount > 0
                      ? `${reminderSummary.overdueCount} pengingat tagihan terlambat perlu perhatian.`
                      : `${reminderSummary.totalActiveCount} pengingat aktif diselaraskan dengan kategori anggaran.`}
                  </p>
                </div>
                <Link
                  to="/pengingat"
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#D4AF37]/15 px-3 py-2 text-xs font-semibold text-[#9A7411] hover:bg-[#D4AF37]/25 dark:bg-[#D4AF37]/20 dark:text-[#E6C768]"
                >
                  <span>Pengingat</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </section>
          </EgoStaggerSection>
        ) : (
          /* Tab 2: Riwayat & Peringatan */
          <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-[#1E293B] dark:bg-[#101827]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#101827] dark:text-white">
                  Riwayat Penggunaan &amp; Peringatan Ambang
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Setiap ambang (50%, 75%, 90%, 100%, &gt;100%) dicatat maksimal satu kali per periode bulan agar tidak terjadi notifikasi ganda.
                </p>
              </div>

              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-[#1E293B] dark:bg-[#0B111E]">
                <button
                  type="button"
                  onClick={() => setHistoryScope("month")}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                    historyScope === "month"
                      ? "bg-[#101827] text-white dark:bg-[#D4AF37] dark:text-[#101827]"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {formatPeriodMonthID(selectedMonth, true)}
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryScope("all")}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                    historyScope === "all"
                      ? "bg-[#101827] text-white dark:bg-[#D4AF37] dark:text-[#101827]"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Semua Periode
                </button>
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-400">
                Belum ada riwayat peringatan atau perubahan anggaran pada tampilan ini.
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-[#1E293B]">
                {filteredLogs.map((log) => {
                  const badge = logEventLabel(log);
                  return (
                    <li
                      key={log.id}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[#101827] dark:text-white">
                            {log.category}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-[#0B111E] dark:text-slate-300">
                            {formatPeriodMonthID(log.period_month, true)}
                          </span>
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${badge.badgeCls}`}>
                            {badge.label}
                          </span>
                        </div>
                        {log.notes ? (
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            {log.notes}
                          </p>
                        ) : null}
                      </div>

                      <div className="shrink-0 text-left font-mono text-xs tabular-nums sm:text-right">
                        {log.event_type === "threshold_crossed" ? (
                          <p className="font-bold text-[#101827] dark:text-white">
                            {formatIDR(log.spent_amount, true)} / {formatIDR(log.limit_amount, true)}{" "}
                            <span className="text-[#9A7411] dark:text-[#E6C768]">
                              ({log.usage_pct.toFixed(1)}%)
                            </span>
                          </p>
                        ) : (
                          <p className="font-bold text-[#101827] dark:text-white">
                            Batas {formatIDR(log.limit_amount)}
                          </p>
                        )}
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateID(log.created_at.slice(0, 10), dateFormat)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* Modal: Create / Edit Budget */}
      <ModalSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingBudget ? "Edit Anggaran Kategori" : "Tambah Anggaran Bulanan"}
        subtitle="Pantau penggunaan pengeluaran terkonfirmasi Owner secara real-time."
      >
        <form onSubmit={handleSaveBudget} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="budget-category-select"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Kategori Pengeluaran <span className="text-[#EF4444]">*</span>
            </label>
            <select
              id="budget-category-select"
              value={categorySelect}
              onChange={(e) => setCategorySelect(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-[#101827] focus:border-[#D4AF37] focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
            >
              {BUDGET_CATEGORY_PRESETS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="__custom__">Kategori Kustom Lainnya...</option>
            </select>
          </div>

          {categorySelect === "__custom__" ? (
            <div className="space-y-1.5">
              <label
                htmlFor="budget-custom-category"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Nama Kategori Kustom <span className="text-[#EF4444]">*</span>
              </label>
              <input
                id="budget-custom-category"
                type="text"
                required
                maxLength={80}
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Contoh: Pendidikan Anak"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
              />
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="budget-period-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Periode Bulan <span className="text-[#EF4444]">*</span>
              </label>
              <input
                id="budget-period-input"
                type="month"
                required
                value={formMonth}
                onChange={(e) => setFormMonth(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-[#101827] focus:border-[#D4AF37] focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
              />
            </div>

            <MoneyInput
              id="budget-limit-amount"
              label="Batas Anggaran Bulanan"
              value={limitAmount}
              onChange={setLimitAmount}
              required
              placeholder="Contoh: 2.000.000"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="budget-notes-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Catatan (Opsional)
            </label>
            <input
              id="budget-notes-input"
              type="text"
              maxLength={240}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Termasuk makan siang kerja & kopi"
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
            />
          </div>

          <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-xs font-semibold text-[#101827] dark:text-white">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#D4AF37] accent-[#D4AF37]"
            />
            <span>Aktifkan pemantauan &amp; peringatan ambang (50% / 75% / 90% / 100%)</span>
          </label>

          <ApprovalCheck
            id="budget-form-approval"
            checked={formConfirmed}
            onChange={setFormConfirmed}
          />

          <button
            type="submit"
            disabled={
              !formConfirmed ||
              limitAmount <= 0 ||
              createBudget.isPending ||
              updateBudget.isPending
            }
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2.5 text-sm font-semibold text-[#101827] shadow-sm transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createBudget.isPending || updateBudget.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Menyimpan Anggaran...</span>
              </>
            ) : (
              <span>{editingBudget ? "Simpan Perubahan Anggaran" : "Simpan Anggaran"}</span>
            )}
          </button>
        </form>
      </ModalSheet>

      {/* Modal: Copy Previous Month Budgets */}
      <ModalSheet
        open={copyModalOpen}
        onClose={() => setCopyModalOpen(false)}
        title={`Salin Anggaran dari ${formatPeriodMonthID(prevMonth)}`}
        subtitle={`Salin ${prevMonthCopyableCount} anggaran aktif ke periode ${formatPeriodMonthID(selectedMonth)}.`}
      >
        <form onSubmit={handleConfirmCopyMonth} className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-300">
            Kategori yang sudah terdaftar pada periode {formatPeriodMonthID(selectedMonth)} tidak akan ditimpa.
          </div>

          <ApprovalCheck
            id="budget-copy-approval"
            checked={copyConfirmed}
            onChange={setCopyConfirmed}
          />

          <button
            type="submit"
            disabled={!copyConfirmed || copyMonthBudgets.isPending}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2.5 text-sm font-semibold text-[#101827] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copyMonthBudgets.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Menyalin...</span>
              </>
            ) : (
              <span>Salin {prevMonthCopyableCount} Anggaran Aktif</span>
            )}
          </button>
        </form>
      </ModalSheet>

      {/* Modal: Delete Budget Confirmation */}
      <ModalSheet
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Anggaran Kategori?"
        subtitle={
          deleteTarget
            ? `Kategori "${deleteTarget.category}" pada periode ${formatPeriodMonthID(deleteTarget.period_month)}`
            : undefined
        }
      >
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Menghapus anggaran ini hanya menghentikan batas pemantauan bulan tersebut. Transaksi
            pengeluaran terkonfirmasi yang sudah tercatat di brankas Anda tetap aman dan tidak dihapus.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#101827] dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmDelete()}
              disabled={deleteBudget.isPending}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#EF4444] px-4 py-2 text-xs font-semibold text-white hover:bg-[#DC2626] disabled:opacity-50"
            >
              {deleteBudget.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              <span>Ya, Hapus Anggaran</span>
            </button>
          </div>
        </div>
      </ModalSheet>
    </AppShell>
  );
}
