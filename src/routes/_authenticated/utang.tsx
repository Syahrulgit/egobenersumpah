import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BellPlus,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  History,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { ApprovalCheck } from "../../components/ego/approval-check";
import { CategoryIcon } from "../../components/ego/category-icon";
import { ModalSheet } from "../../components/ego/modal-sheet";
import { MoneyInput } from "../../components/ego/money-input";
import {
  compareDebtStrategies,
  computeDebtDisplayStatus,
  debtFrequencyLabel,
  debtTypeLabel,
  effectiveMonthlyInstallment,
  normalizeDebt,
} from "../../lib/debt-manager";
import {
  computeAverageMonthlyCashflow,
  daysUntilDue,
  formatDateID,
  formatIDR,
  todayISO,
} from "../../lib/finance";
import {
  useCreateDebt,
  usePayDebt,
  useUpdateDebt,
  useVaultSnapshot,
} from "../../lib/queries";
import type { Debt, DebtPaymentFrequency, DebtType } from "../../types/ego";

const DEBT_TYPE_OPTIONS: Array<{ value: DebtType; label: string }> = [
  { value: "kpr", label: "KPR / Properti" },
  { value: "kendaraan", label: "Cicilan Kendaraan" },
  { value: "kartu_kredit", label: "Kartu Kredit" },
  { value: "pinjaman_pribadi", label: "Pinjaman Pribadi" },
  { value: "paylater", label: "PayLater" },
  { value: "usaha", label: "Pinjaman Usaha" },
  { value: "lainnya", label: "Utang Lainnya" },
];

const DEBT_FREQ_OPTIONS: Array<{ value: DebtPaymentFrequency; label: string }> =
  [
    { value: "monthly", label: "Bulanan" },
    { value: "biweekly", label: "2 Mingguan" },
    { value: "weekly", label: "Mingguan" },
    { value: "quarterly", label: "Triwulan" },
    { value: "yearly", label: "Tahunan" },
  ];

export function UtangPage() {
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const createDebt = useCreateDebt();
  const updateDebt = useUpdateDebt();
  const payDebt = usePayDebt();

  const debts = useMemo(
    () => (vault?.debts ?? []).map(normalizeDebt),
    [vault?.debts]
  );
  const transactions = vault?.transactions ?? [];
  const debtLogs = vault?.debt_payment_logs ?? [];
  const activeAccounts = (vault?.accounts ?? []).filter((a) => a.is_active);
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";

  // Top view tab: list vs payoff strategy simulator
  const [viewTab, setViewTab] = useState<"list" | "strategy">("list");

  // Create Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Form Utang Baru / Edit
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [creditor, setCreditor] = useState("");
  const [debtType, setDebtType] = useState<DebtType>("lainnya");
  const [originalAmount, setOriginalAmount] = useState(0);
  const [interestRateAnnual, setInterestRateAnnual] = useState(0);
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [installmentAmount, setInstallmentAmount] = useState(0);
  const [paymentFrequency, setPaymentFrequency] =
    useState<DebtPaymentFrequency>("monthly");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);

  // Payment Modal State
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [paySourceAccountId, setPaySourceAccountId] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payConfirmed, setPayConfirmed] = useState(false);

  // History Modal State
  const [historyDebt, setHistoryDebt] = useState<Debt | null>(null);

  // Strategy Simulator State
  const [extraMonthlyPayment, setExtraMonthlyPayment] = useState(500_000);

  // Filter status
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "overdue" | "paid"
  >("all");

  const activeDebts = debts.filter((d) => d.status === "active");
  const totalDebt = activeDebts.reduce(
    (sum, d) => sum + d.outstanding_balance,
    0
  );

  const avgCashflow = useMemo(
    () => computeAverageMonthlyCashflow(transactions, 3),
    [transactions]
  );

  const strategyComparison = useMemo(
    () =>
      compareDebtStrategies({
        debts,
        extraMonthlyPayment,
        monthlyNetSurplus: avgCashflow.avgNet,
        referenceDateISO: todayISO(),
      }),
    [debts, extraMonthlyPayment, avgCashflow.avgNet]
  );

  const filteredDebts = useMemo(() => {
    if (statusFilter === "all") return debts;
    if (statusFilter === "overdue") {
      return debts.filter((d) => computeDebtDisplayStatus(d) === "overdue");
    }
    return debts.filter((d) => d.status === statusFilter);
  }, [debts, statusFilter]);

  const debtPaymentExpenses = useMemo(() => {
    return transactions
      .filter(
        (tx) =>
          tx.transaction_type === "expense" &&
          tx.category === "Utang & Cicilan" &&
          tx.status === "posted"
      )
      .slice(0, 8);
  }, [transactions]);

  const nearestDue = useMemo(() => {
    const withDates = activeDebts
      .filter((d) => Boolean(d.due_date))
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    return withDates[0] ?? null;
  }, [activeDebts]);

  const nearestDays = nearestDue ? daysUntilDue(nearestDue.due_date) : null;

  const accountNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const acc of vault?.accounts ?? []) map.set(acc.id, acc.account_name);
    return map;
  }, [vault?.accounts]);

  function openCreateModal() {
    setEditingDebt(null);
    setCreditor("");
    setDebtType("lainnya");
    setOriginalAmount(0);
    setInterestRateAnnual(0);
    setMonthlyFee(0);
    setInstallmentAmount(0);
    setPaymentFrequency("monthly");
    setDueDate("");
    setDescription("");
    setOwnerConfirmed(false);
    setCreateModalOpen(true);
  }

  function openEditModal(debt: Debt) {
    const norm = normalizeDebt(debt);
    setEditingDebt(norm);
    setCreditor(norm.creditor);
    setDebtType(norm.debt_type);
    setOriginalAmount(norm.original_amount);
    setInterestRateAnnual(norm.interest_rate_annual);
    setMonthlyFee(norm.monthly_fee);
    setInstallmentAmount(norm.installment_amount);
    setPaymentFrequency(norm.payment_frequency);
    setDueDate(norm.due_date ?? "");
    setDescription(norm.description ?? "");
    setOwnerConfirmed(false);
    setCreateModalOpen(true);
  }

  async function handleSaveDebt(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerConfirmed) return;
    if (!creditor.trim() || originalAmount <= 0) {
      toast.error("Kreditur dan nominal plafon awal wajib diisi.");
      return;
    }
    try {
      if (editingDebt) {
        await updateDebt.mutateAsync({
          id: editingDebt.id,
          creditor: creditor.trim(),
          debt_type: debtType,
          original_amount: editingDebt.original_amount,
          outstanding_balance: editingDebt.outstanding_balance,
          interest_rate_annual: interestRateAnnual,
          monthly_fee: monthlyFee,
          installment_amount: installmentAmount,
          payment_frequency: paymentFrequency,
          due_date: dueDate || null,
          description: description.trim() || null,
          owner_confirmed: true,
        });
        toast.success(`Data utang "${creditor.trim()}" berhasil diperbarui.`);
      } else {
        await createDebt.mutateAsync({
          creditor: creditor.trim(),
          debt_type: debtType,
          original_amount: originalAmount,
          outstanding_balance: originalAmount,
          interest_rate_annual: interestRateAnnual,
          monthly_fee: monthlyFee,
          installment_amount: installmentAmount,
          payment_frequency: paymentFrequency,
          due_date: dueDate || null,
          description: description.trim() || null,
          owner_confirmed: true,
        });
        toast.success(`Kewajiban kepada "${creditor.trim()}" berhasil dicatat.`);
      }
      setCreateModalOpen(false);
      setOwnerConfirmed(false);
      setEditingDebt(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan data utang."
      );
    }
  }

  function startPayment(debt: Debt) {
    const norm = normalizeDebt(debt);
    setPayingDebt(norm);
    const defaultPay =
      norm.installment_amount > 0
        ? Math.min(norm.outstanding_balance, norm.installment_amount)
        : norm.outstanding_balance;
    setPayAmount(defaultPay);
    setPaySourceAccountId(activeAccounts[0]?.id ?? "");
    setPayNotes("");
    setPayConfirmed(false);
  }

  async function handlePayDebt(e: React.FormEvent) {
    e.preventDefault();
    if (!payingDebt || !payConfirmed) return;
    if (!paySourceAccountId) {
      toast.error("Pilih akun sumber pembayaran.");
      return;
    }
    if (payAmount <= 0 || payAmount > payingDebt.outstanding_balance) {
      toast.error(
        "Nominal pembayaran harus lebih dari Rp 0 dan tidak melebihi sisa pokok."
      );
      return;
    }
    try {
      await payDebt.mutateAsync({
        debt_id: payingDebt.id,
        amount: payAmount,
        source_account_id: paySourceAccountId,
        owner_confirmed: true,
        notes: payNotes.trim() || null,
      });
      const isFull = payAmount >= payingDebt.outstanding_balance;
      toast.success(
        isFull
          ? `Utang kepada ${payingDebt.creditor} lunas dan tercatat di Pengeluaran.`
          : `Cicilan ${formatIDR(payAmount)} ke ${payingDebt.creditor} tercatat di Pengeluaran.`
      );
      setPayingDebt(null);
      setPayConfirmed(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memproses pembayaran utang."
      );
    }
  }

  // Dual payoff timeline SVG path helper
  const timelineChart = useMemo(() => {
    const minSeries = strategyComparison.minimumOnly.timeline;
    const recSeries =
      strategyComparison.recommendedStrategy === "avalanche"
        ? strategyComparison.avalanche.timeline
        : strategyComparison.snowball.timeline;
    const maxLen = Math.max(minSeries.length, recSeries.length, 2);
    const maxBal = Math.max(100_000, strategyComparison.totalOutstanding);
    const w = 600;
    const h = 160;
    const padX = 12;
    const padY = 14;
    const toPts = (arr: typeof minSeries) =>
      arr
        .slice(0, 60)
        .map((pt, i) => {
          const x =
            padX +
            (i / Math.max(1, Math.min(maxLen - 1, 59))) * (w - padX * 2);
          const y =
            padY + ((maxBal - pt.totalRemaining) / maxBal) * (h - padY * 2);
          return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
        })
        .join(" ");
    return {
      minPts: toPts(minSeries),
      recPts: toPts(recSeries),
    };
  }, [strategyComparison]);

  const txById = useMemo(
    () => new Map(transactions.map((t) => [t.id, t])),
    [transactions]
  );

  const historyDebtLogs = useMemo(() => {
    if (!historyDebt) return [];
    const logs = debtLogs.filter((l) => l.debt_id === historyDebt.id);
    if (logs.length > 0) return logs;
    // Fallback to matching expense transactions when debt_payment_logs table hasn't been migrated yet
    return transactions
      .filter(
        (tx) =>
          tx.transaction_type === "expense" &&
          tx.category === "Utang & Cicilan" &&
          tx.status === "posted" &&
          (tx.description ?? "")
            .toLowerCase()
            .includes(historyDebt.creditor.toLowerCase())
      )
      .map((tx) => ({
        id: tx.id,
        owner_id: tx.owner_id,
        debt_id: historyDebt.id,
        transaction_id: tx.id,
        amount: tx.amount,
        principal_paid: tx.amount,
        interest_paid: 0,
        remaining_after: 0,
        notes: tx.description,
        created_at: tx.created_at,
      }));
  }, [historyDebt, debtLogs, transactions]);

  return (
    <AppShell
      title="Manajemen Utang & Pelunasan"
      subtitle="Kelola pokok utang, bunga, biaya admin, riwayat bayar, dan strategi Snowball vs Avalanche."
      action={
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#087BFF]/20 hover:brightness-110 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Catat Utang</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Metrics Summary */}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="ego-card-hero flex flex-col justify-between gap-3 rounded-3xl border border-[#1B3163] p-5 text-white shadow-lg shadow-[#06132F]/15 sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#C7D0E0]/80">
                Total Utang Aktif
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-rose-300 sm:text-3xl">
                {formatIDR(totalDebt)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-[#C7D0E0]/85">
              <span>
                {activeDebts.length} aktif · {strategyComparison.overdueDebtCount} terlambat ·{" "}
                {debts.filter((d) => d.status === "paid").length} lunas
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#C7D0E0]/70">
                Komitmen Cicilan / Bulan
              </p>
              <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-[#087BFF] dark:text-[#19D8FF]">
                {formatIDR(strategyComparison.totalMonthlyCommitment)}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                {strategyComparison.avalanche.monthsToDebtFree !== null
                  ? `Bebas utang tercepat ~${strategyComparison.avalanche.monthsToDebtFree} bln (${strategyComparison.recommendedStrategy.toUpperCase()})`
                  : "Belum ada kewajiban aktif"}
              </p>
            </div>
            <Link
              to="/pengingat"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#087BFF] hover:underline dark:text-[#19D8FF]"
            >
              <BellPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Atur Pengingat Jatuh Tempo</span>
            </Link>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#C7D0E0]/70">
                  Jatuh Tempo Terdekat
                </p>
                <CalendarClock
                  className="h-4 w-4 text-[#087BFF] dark:text-[#19D8FF]"
                  aria-hidden="true"
                />
              </div>
              {nearestDue ? (
                <>
                  <p className="mt-2 text-sm font-bold text-[#06132F] dark:text-white">
                    {nearestDue.creditor} ·{" "}
                    <span className="font-mono tabular-nums text-rose-600 dark:text-rose-400">
                      {formatIDR(nearestDue.outstanding_balance)}
                    </span>
                  </p>
                  <p
                    className={`mt-1 inline-flex items-center gap-1.5 text-xs font-semibold ${
                      nearestDays !== null && nearestDays < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : nearestDays !== null && nearestDays <= 7
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-slate-600 dark:text-[#C7D0E0]/80"
                    }`}
                  >
                    <span>
                      {formatDateID(nearestDue.due_date, dateFormat)}
                      {nearestDays !== null
                        ? nearestDays < 0
                          ? ` (Terlambat ${Math.abs(nearestDays)} hari)`
                          : nearestDays === 0
                            ? " (Hari ini)"
                            : ` (${nearestDays} hari lagi)`
                        : ""}
                    </span>
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                  Tidak ada jatuh tempo aktif yang terjadwal saat ini.
                </p>
              )}
            </div>
            {nearestDue ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => startPayment(nearestDue)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#087BFF]/10 px-3 py-1.5 text-xs font-semibold text-[#087BFF] hover:bg-[#087BFF]/15 dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                >
                  <span>Bayar Cicilan Sekarang</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>
        </section>

        {/* Primary View Tabs */}
        <div
          role="tablist"
          aria-label="Mode manajemen utang"
          className="grid w-full grid-cols-2 items-center gap-1 rounded-2xl border border-[#DCE4F0] bg-white p-1.5 dark:border-[#1B3163] dark:bg-[#091634] sm:inline-flex sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === "list"}
            onClick={() => setViewTab("list")}
            className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
              viewTab === "list"
                ? "bg-[#087BFF] text-white shadow-xs"
                : "text-slate-600 hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:text-white"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Kreditur ({debts.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === "strategy"}
            onClick={() => setViewTab("strategy")}
            className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
              viewTab === "strategy"
                ? "bg-[#087BFF] text-white shadow-xs"
                : "text-slate-600 hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:text-white"
            }`}
          >
            <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="sm:hidden">Snowball vs Avalanche</span>
            <span className="hidden sm:inline">
              Strategi Pelunasan (Snowball vs Avalanche)
            </span>
          </button>
        </div>

        {viewTab === "strategy" ? (
          <section className="space-y-5 rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                  Simulasi Strategi Pelunasan Utang
                </h2>
                <p className="text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                  Bandingkan Pembayaran Minimum, Debt Snowball (saldo terkecil dulu), dan Debt Avalanche (bunga tertinggi dulu). Tidak mengubah saldo nyata.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#087BFF]/10 px-3 py-1 text-xs font-bold text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  Rekomendasi:{" "}
                  {strategyComparison.recommendedStrategy === "avalanche"
                    ? "Debt Avalanche"
                    : "Debt Snowball"}
                </span>
              </span>
            </div>

            {activeDebts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#DCE4F0] bg-[#F4F7FB] p-8 text-center text-xs text-slate-600 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]/75">
                Belum ada utang aktif untuk disimulasikan. Tambahkan kewajiban aktif terlebih dahulu.
              </div>
            ) : (
              <>
                <div className="grid gap-4 rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] p-4 dark:border-[#1B3163] dark:bg-[#06132F] sm:grid-cols-12 sm:items-end">
                  <div className="sm:col-span-6">
                    <MoneyInput
                      id="extra-debt-pay"
                      label="Ekstra Anggaran Pelunasan / Bulan (IDR)"
                      value={extraMonthlyPayment}
                      onChange={setExtraMonthlyPayment}
                      hint={`Rata-rata surplus kas 3 bln: ${formatIDR(avgCashflow.avgNet)}/bln`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 sm:col-span-6">
                    {[0, 250_000, 500_000, 1_000_000, 2_000_000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setExtraMonthlyPayment(val)}
                        className={`min-h-[36px] rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          extraMonthlyPayment === val
                            ? "border-[#087BFF] bg-[#087BFF] text-white"
                            : "border-[#DCE4F0] bg-white text-[#06132F] dark:border-[#1B3163] dark:bg-[#091634] dark:text-[#C7D0E0]"
                        }`}
                      >
                        {val === 0 ? "Tanpa Ekstra" : `+${formatIDR(val, true)}`}
                      </button>
                    ))}
                  </div>
                </div>

                {strategyComparison.cashflowFitWarning ? (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{strategyComparison.cashflowFitWarning}</span>
                  </div>
                ) : null}

                <p className="rounded-xl border border-[#087BFF]/25 bg-[#087BFF]/8 px-4 py-3 text-xs leading-relaxed text-[#06132F] dark:border-[#19D8FF]/25 dark:bg-[#19D8FF]/10 dark:text-[#C7D0E0]">
                  <strong>Analisis Strategi:</strong>{" "}
                  {strategyComparison.recommendationReason}
                </p>

                {/* 3 Strategy Comparison Cards */}
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    {
                      sim: strategyComparison.minimumOnly,
                      badge: "Baseline",
                      monthsSaved: 0,
                      interestSaved: 0,
                      highlighted: false,
                    },
                    {
                      sim: strategyComparison.snowball,
                      badge:
                        strategyComparison.recommendedStrategy === "snowball"
                          ? "Disarankan"
                          : "Psikologis Cepat",
                      monthsSaved: strategyComparison.snowballMonthsSavedVsMin,
                      interestSaved:
                        strategyComparison.snowballInterestSavedVsMin,
                      highlighted:
                        strategyComparison.recommendedStrategy === "snowball",
                    },
                    {
                      sim: strategyComparison.avalanche,
                      badge:
                        strategyComparison.recommendedStrategy === "avalanche"
                          ? "Disarankan"
                          : "Hemat Bunga",
                      monthsSaved: strategyComparison.avalancheMonthsSavedVsMin,
                      interestSaved:
                        strategyComparison.avalancheInterestSavedVsMin,
                      highlighted:
                        strategyComparison.recommendedStrategy === "avalanche",
                    },
                  ].map((item) => (
                    <div
                      key={item.sim.strategy}
                      className={`rounded-2xl border p-4 ${
                        item.highlighted
                          ? "border-[#087BFF] bg-[#087BFF]/5 dark:border-[#19D8FF] dark:bg-[#19D8FF]/8"
                          : "border-[#DCE4F0] bg-[#F4F7FB] dark:border-[#1B3163] dark:bg-[#06132F]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-bold text-[#06132F] dark:text-white">
                          {item.sim.strategyLabel}
                        </h3>
                        <span className="rounded-full bg-[#087BFF]/15 px-2 py-0.5 text-[10px] font-bold text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                          {item.badge}
                        </span>
                      </div>
                      <p className="mt-3 font-mono text-xl font-bold text-[#06132F] dark:text-white">
                        {item.sim.monthsToDebtFree !== null
                          ? `${item.sim.monthsToDebtFree} bulan`
                          : "> 30 tahun"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/75">
                        Estimasi lunas:{" "}
                        {item.sim.debtFreeDateISO
                          ? formatDateID(item.sim.debtFreeDateISO, dateFormat)
                          : "—"}
                      </p>
                      <dl className="mt-3 space-y-1 border-t border-[#DCE4F0] pt-2.5 text-xs dark:border-[#1B3163]">
                        <div className="flex justify-between">
                          <dt className="text-slate-500 dark:text-[#C7D0E0]/70">
                            Total Bunga + Biaya
                          </dt>
                          <dd className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                            {formatIDR(
                              item.sim.totalInterestPaid + item.sim.totalFeePaid
                            )}
                          </dd>
                        </div>
                        {item.sim.strategy !== "minimum_only" ? (
                          <div className="flex justify-between">
                            <dt className="text-slate-500 dark:text-[#C7D0E0]/70">
                              Hemat vs Minimum
                            </dt>
                            <dd className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                              {formatIDR(item.interestSaved)} ({item.monthsSaved} bln)
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  ))}
                </div>

                {/* Dual-Curve Payoff Timeline SVG */}
                <div className="rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] p-4 dark:border-[#1B3163] dark:bg-[#06132F]">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#06132F] dark:text-white">
                      Kurva Penurunan Sisa Pokok (Minimum vs Rekomendasi)
                    </span>
                    <div className="flex items-center gap-4 text-[11px]">
                      <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-[#C7D0E0]/75">
                        <span className="h-2 w-4 rounded-full bg-slate-400" />
                        Minimum
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#087BFF] dark:text-[#19D8FF]">
                        <span className="h-2 w-4 rounded-full bg-[#087BFF] dark:bg-[#19D8FF]" />
                        {strategyComparison.recommendedStrategy === "avalanche"
                          ? "Avalanche"
                          : "Snowball"}
                      </span>
                    </div>
                  </div>
                  <svg
                    viewBox="0 0 600 160"
                    role="img"
                    aria-label="Grafik penurunan sisa pokok utang"
                    className="h-36 w-full"
                  >
                    <polyline
                      fill="none"
                      stroke="#94A3B8"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      points={timelineChart.minPts}
                    />
                    <polyline
                      fill="none"
                      stroke="#087BFF"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={timelineChart.recPts}
                    />
                  </svg>
                </div>

                {/* Payoff Order */}
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#C7D0E0]/70">
                    Urutan Prioritas Pelunasan (
                    {strategyComparison.recommendedStrategy === "avalanche"
                      ? "Debt Avalanche"
                      : "Debt Snowball"}
                    )
                  </h3>
                  <ol className="grid gap-2.5 sm:grid-cols-2">
                    {(strategyComparison.recommendedStrategy === "avalanche"
                      ? strategyComparison.avalanche.payoffOrder
                      : strategyComparison.snowball.payoffOrder
                    ).map((step, idx) => (
                      <li
                        key={step.debtId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-xs dark:border-[#1B3163] dark:bg-[#06132F]"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[#06132F] dark:text-white">
                            #{idx + 1} · {step.creditor}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/75">
                            Bunga {step.annualInterestRate}%/thn · Pokok{" "}
                            {formatIDR(step.startingBalance, true)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono font-bold text-[#087BFF] dark:text-[#19D8FF]">
                            Bulan ke-{step.payoffMonthIndex}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                            {formatDateID(step.payoffDateISO, dateFormat)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )}
          </section>
        ) : (
          <>
            {/* Daftar Kreditur */}
            <section className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                  Daftar Kreditur &amp; Sisa Pokok
                </h2>
                <div
                  role="tablist"
                  aria-label="Filter status utang"
                  className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-1 dark:border-[#1B3163] dark:bg-[#06132F]"
                >
                  {(
                    [
                      { id: "all", label: "Semua" },
                      { id: "active", label: "Aktif" },
                      { id: "overdue", label: "Terlambat" },
                      { id: "paid", label: "Lunas" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={statusFilter === tab.id}
                      onClick={() => setStatusFilter(tab.id)}
                      className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                        statusFilter === tab.id
                          ? "bg-[#087BFF] text-white shadow-xs"
                          : "text-slate-600 hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="mt-4 h-40 animate-pulse rounded-2xl bg-[#F4F7FB] dark:bg-[#06132F]" />
              ) : filteredDebts.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-[#DCE4F0] bg-[#F4F7FB] p-8 text-center dark:border-[#1B3163] dark:bg-[#06132F]/60">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                    <CreditCard className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-[#06132F] dark:text-white">
                    {debts.length === 0
                      ? "Tidak ada catatan utang"
                      : "Tidak ada kewajiban pada filter ini"}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-[#C7D0E0]/75">
                    Jika Anda memiliki kewajiban cicilan atau pinjaman, catat beserta suku bunga &amp; cicilan rutin agar strategi pelunasan akurat.
                  </p>
                  {debts.length === 0 ? (
                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="mt-4 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0666DB]"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Catat Kewajiban Pertama</span>
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 divide-y divide-[#DCE4F0]/80 dark:divide-[#1B3163]">
                  {filteredDebts.map((debt) => {
                    const displayStatus = computeDebtDisplayStatus(debt);
                    const isPaid = displayStatus === "paid";
                    const paidPortion = Math.max(
                      0,
                      debt.original_amount - debt.outstanding_balance
                    );
                    const progressPct =
                      debt.original_amount > 0
                        ? Math.min(
                            100,
                            Math.round((paidPortion / debt.original_amount) * 100)
                          )
                        : 0;
                    const eff = effectiveMonthlyInstallment(debt);

                    return (
                      <div
                        key={debt.id}
                        className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-[#06132F] dark:text-white">
                              {debt.creditor}
                            </h3>
                            <span className="rounded-md bg-[#F4F7FB] px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-[#06132F] dark:text-[#C7D0E0]">
                              {debtTypeLabel(debt.debt_type)}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                displayStatus === "paid"
                                  ? "bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                                  : displayStatus === "overdue"
                                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                    : displayStatus === "due_soon"
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                      : "bg-slate-200 text-slate-700 dark:bg-[#132652] dark:text-[#C7D0E0]"
                              }`}
                            >
                              {displayStatus === "paid"
                                ? "Lunas"
                                : displayStatus === "overdue"
                                  ? "Terlambat"
                                  : displayStatus === "due_soon"
                                    ? "Segera Jatuh Tempo"
                                    : "Aktif"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                            Pokok awal: {formatIDR(debt.original_amount)} · Bunga:{" "}
                            <strong>{debt.interest_rate_annual ?? 0}%/thn</strong>
                            {(debt.installment_amount ?? 0) > 0
                              ? ` · Cicilan: ${formatIDR(debt.installment_amount ?? 0)} (${debtFrequencyLabel(debt.payment_frequency)})`
                              : !isPaid
                                ? ` · Est. min ${formatIDR(eff.monthlyAmount)}/bln`
                                : ""}
                            {debt.due_date
                              ? ` · Jatuh tempo: ${formatDateID(debt.due_date, dateFormat)}`
                              : ""}
                          </p>
                          <div className="mt-2.5 flex items-center gap-2.5">
                            <svg
                              viewBox="0 0 100 6"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                              className="h-1.5 w-36 overflow-hidden rounded-full"
                            >
                              <rect
                                x={0}
                                y={0}
                                width={100}
                                height={6}
                                rx={3}
                                className="fill-slate-200 dark:fill-[#132652]"
                              />
                              {progressPct > 0 ? (
                                <rect
                                  x={0}
                                  y={0}
                                  width={progressPct}
                                  height={6}
                                  rx={3}
                                  className="fill-[#087BFF] transition-all dark:fill-[#19D8FF]"
                                />
                              ) : null}
                            </svg>
                            <span className="font-mono text-[11px] font-semibold tabular-nums text-[#087BFF] dark:text-[#19D8FF]">
                              Terbayar {progressPct}%
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
                          <div className="text-left lg:text-right">
                            <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/65">
                              Sisa Pokok
                            </p>
                            <p
                              className={`font-mono text-sm font-bold tabular-nums ${
                                isPaid
                                  ? "text-[#087BFF] dark:text-[#19D8FF]"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {formatIDR(debt.outstanding_balance)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              aria-label={`Riwayat pembayaran ${debt.creditor}`}
                              onClick={() => setHistoryDebt(debt)}
                              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]"
                            >
                              <History className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="hidden sm:inline">Log</span>
                            </button>

                            <button
                              type="button"
                              aria-label={`Edit utang ${debt.creditor}`}
                              onClick={() => openEditModal(debt)}
                              className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>

                            {!isPaid ? (
                              <button
                                type="button"
                                onClick={() => startPayment(debt)}
                                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:brightness-110 whitespace-nowrap"
                              >
                                <span>Bayar / Lunasi</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 text-xs font-semibold text-[#087BFF] dark:text-[#19D8FF]">
                                <CheckCircle2
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                <span>Selesai</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Riwayat Pembayaran Utang Terintegrasi Pengeluaran */}
            <section className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[#06132F] dark:text-white">
                    Riwayat Pembayaran Terintegrasi Pengeluaran
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                    Setiap cicilan atau pelunasan tercatat otomatis ke buku mutasi pengeluaran &amp; log pembayaran utang.
                  </p>
                </div>
                <Link
                  to="/transaksi"
                  search={{ kategori: "Utang & Cicilan" }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#087BFF] hover:underline whitespace-nowrap dark:text-[#19D8FF]"
                >
                  <span>Lihat Semua</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>

              {debtPaymentExpenses.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-[#C7D0E0]/65">
                  Belum ada transaksi pembayaran cicilan atau pelunasan utang yang tercatat.
                </p>
              ) : (
                <ul className="divide-y divide-[#DCE4F0]/80 dark:divide-[#1B3163]">
                  {debtPaymentExpenses.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                          <CategoryIcon
                            category={tx.category}
                            transactionType={tx.transaction_type}
                            className="h-4 w-4"
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#06132F] dark:text-white">
                            {tx.description || "Pembayaran Utang"}
                          </p>
                          <p className="text-slate-500 dark:text-[#C7D0E0]/70">
                            {formatDateID(tx.transaction_date, dateFormat)} ·{" "}
                            {tx.source_account_id
                              ? accountNameMap.get(tx.source_account_id) ?? "Akun"
                              : "Akun"}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400">
                        -{formatIDR(tx.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {/* Modal Catat / Edit Utang */}
      <ModalSheet
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingDebt(null);
        }}
        title={editingDebt ? `Edit Utang: ${editingDebt.creditor}` : "Catat Utang Baru"}
        subtitle="Lengkapi bunga tahunan dan nominal cicilan agar simulasi Snowball vs Avalanche berjalan akurat."
      >
        <form onSubmit={handleSaveDebt} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="debt-creditor"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Nama Kreditur <span className="text-rose-600 dark:text-rose-400">*</span>
              </label>
              <input
                id="debt-creditor"
                type="text"
                required
                value={creditor}
                onChange={(e) => setCreditor(e.target.value)}
                placeholder="Contoh: Bank BCA KPR / Kartu Kredit"
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-[#C7D0E0]/45 dark:focus:border-[#19D8FF]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="debt-type"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Jenis Utang
              </label>
              <select
                id="debt-type"
                value={debtType}
                onChange={(e) => setDebtType(e.target.value as DebtType)}
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
              >
                {DEBT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!editingDebt ? (
            <MoneyInput
              id="debt-original"
              label="Plafon / Pokok Awal (IDR)"
              value={originalAmount}
              onChange={setOriginalAmount}
              required
            />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyInput
              id="debt-installment"
              label="Nominal Cicilan Rutin (IDR)"
              value={installmentAmount}
              onChange={setInstallmentAmount}
            />
            <div className="space-y-1.5">
              <label
                htmlFor="debt-frequency"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Frekuensi Cicilan
              </label>
              <select
                id="debt-frequency"
                value={paymentFrequency}
                onChange={(e) =>
                  setPaymentFrequency(e.target.value as DebtPaymentFrequency)
                }
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
              >
                {DEBT_FREQ_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="debt-interest"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Bunga Tahunan (%/tahun)
              </label>
              <input
                id="debt-interest"
                type="number"
                min={0}
                max={300}
                step={0.1}
                value={interestRateAnnual}
                onChange={(e) =>
                  setInterestRateAnnual(
                    Math.max(0, Number.parseFloat(e.target.value || "0") || 0)
                  )
                }
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 font-mono text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
              />
            </div>

            <MoneyInput
              id="debt-fee"
              label="Biaya Admin / Bulan (IDR)"
              value={monthlyFee}
              onChange={setMonthlyFee}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="debt-due"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Tanggal Jatuh Tempo
              </label>
              <input
                id="debt-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 font-mono text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="debt-desc"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Keterangan
              </label>
              <input
                id="debt-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tenor / catatan"
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-[#C7D0E0]/45 dark:focus:border-[#19D8FF]"
              />
            </div>
          </div>

          <ApprovalCheck
            id="debt-owner-confirm"
            checked={ownerConfirmed}
            onChange={setOwnerConfirmed}
          />

          <button
            type="submit"
            disabled={
              !ownerConfirmed || createDebt.isPending || updateDebt.isPending
            }
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#087BFF]/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:from-[#102452] dark:disabled:to-[#102452] dark:disabled:text-[#C7D0E0]/45"
          >
            {createDebt.isPending || updateDebt.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            <span>{editingDebt ? "Simpan Perubahan Utang" : "Simpan Kewajiban"}</span>
          </button>
        </form>
      </ModalSheet>

      {/* Modal Bayar Cicilan / Pelunasan */}
      <ModalSheet
        open={Boolean(payingDebt)}
        onClose={() => setPayingDebt(null)}
        title={
          payingDebt
            ? `Bayar Kewajiban: ${payingDebt.creditor}`
            : "Pembayaran Utang"
        }
        subtitle="Tercatat otomatis sebagai transaksi Pengeluaran (Utang & Cicilan) dan log cicilan."
      >
        {payingDebt ? (
          <form onSubmit={handlePayDebt} className="space-y-4">
            <div className="rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#C7D0E0]/65">
                Sisa Pokok Terutang
              </p>
              <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {formatIDR(payingDebt.outstanding_balance)}
              </p>
            </div>

            {activeAccounts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#DCE4F0] bg-[#F4F7FB] p-4 text-xs text-slate-700 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]">
                Belum ada akun aktif sebagai sumber dana.{" "}
                <Link
                  to="/akun"
                  onClick={() => setPayingDebt(null)}
                  className="font-semibold text-[#087BFF] hover:underline dark:text-[#19D8FF]"
                >
                  Tambah akun terlebih dahulu
                </Link>
                .
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {(payingDebt.installment_amount ?? 0) > 0 &&
                  (payingDebt.installment_amount ?? 0) <
                    payingDebt.outstanding_balance ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPayAmount(payingDebt.installment_amount ?? 0)
                      }
                      className="min-h-[36px] rounded-xl border border-[#087BFF]/35 bg-[#087BFF]/10 px-3 py-1.5 text-xs font-semibold text-[#087BFF] hover:bg-[#087BFF]/15 dark:border-[#19D8FF]/35 dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                    >
                      Cicilan Rutin ({formatIDR(payingDebt.installment_amount ?? 0, true)})
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      setPayAmount(
                        Math.max(
                          1,
                          Math.round(payingDebt.outstanding_balance * 0.25)
                        )
                      )
                    }
                    className="min-h-[36px] rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-1.5 text-xs font-semibold text-[#06132F] hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPayAmount(
                        Math.max(
                          1,
                          Math.round(payingDebt.outstanding_balance * 0.5)
                        )
                      )
                    }
                    className="min-h-[36px] rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-1.5 text-xs font-semibold text-[#06132F] hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayAmount(payingDebt.outstanding_balance)}
                    className="min-h-[36px] rounded-xl border border-[#087BFF]/35 bg-[#087BFF]/10 px-3 py-1.5 text-xs font-semibold text-[#087BFF] hover:bg-[#087BFF]/15 dark:border-[#19D8FF]/35 dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                  >
                    Lunasi Penuh
                  </button>
                </div>

                <MoneyInput
                  id="pay-debt-amount"
                  label="Nominal Pembayaran (IDR)"
                  value={payAmount}
                  onChange={setPayAmount}
                  hint={`Sisa setelah bayar: ${formatIDR(
                    Math.max(0, payingDebt.outstanding_balance - payAmount)
                  )}`}
                  required
                />

                <div className="space-y-1.5">
                  <label
                    htmlFor="pay-debt-acc"
                    className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                  >
                    Akun Sumber Dana{" "}
                    <span className="text-rose-600 dark:text-rose-400">*</span>
                  </label>
                  <select
                    id="pay-debt-acc"
                    required
                    value={paySourceAccountId}
                    onChange={(e) => setPaySourceAccountId(e.target.value)}
                    className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                  >
                    <option value="">Pilih akun...</option>
                    {activeAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} ({formatIDR(acc.current_balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="pay-debt-notes"
                    className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                  >
                    Catatan Pembayaran (Opsional)
                  </label>
                  <input
                    id="pay-debt-notes"
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="Misal: Cicilan bulan ke-4"
                    className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                  />
                </div>

                <ApprovalCheck
                  id="pay-debt-confirm"
                  checked={payConfirmed}
                  onChange={setPayConfirmed}
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPayingDebt(null)}
                    className="min-h-[44px] flex-1 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-4 py-2.5 text-xs font-semibold text-[#06132F] hover:bg-slate-200 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={!payConfirmed || payDebt.isPending}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-2.5 text-xs font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 dark:disabled:from-[#102452] dark:disabled:to-[#102452] dark:disabled:text-[#C7D0E0]/45"
                  >
                    {payDebt.isPending ? (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span>
                      {payAmount >= payingDebt.outstanding_balance
                        ? "Eksekusi Pelunasan"
                        : "Bayar Cicilan"}
                    </span>
                  </button>
                </div>
              </>
            )}
          </form>
        ) : null}
      </ModalSheet>

      {/* Modal Riwayat Log Pembayaran Per Utang */}
      <ModalSheet
        open={Boolean(historyDebt)}
        onClose={() => setHistoryDebt(null)}
        title={historyDebt ? `Log Pembayaran: ${historyDebt.creditor}` : "Riwayat Cicilan"}
        subtitle="Daftar pembayaran cicilan atau pelunasan yang telah dieksekusi Owner."
      >
        {historyDebt ? (
          historyDebtLogs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#DCE4F0] bg-[#F4F7FB] p-4 text-center text-xs text-slate-600 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]/75">
              Belum ada log pembayaran untuk kewajiban ini.
            </p>
          ) : (
            <ul className="divide-y divide-[#DCE4F0] dark:divide-[#1B3163]">
              {historyDebtLogs.map((log) => {
                const linkedTx = log.transaction_id
                  ? txById.get(log.transaction_id)
                  : undefined;
                const accountLabel =
                  linkedTx?.source_account_id
                    ? accountNameMap.get(linkedTx.source_account_id) ?? "Akun"
                    : "Pembayaran Terverifikasi";
                return (
                  <li
                    key={log.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#06132F] dark:text-white">
                        {formatDateID(linkedTx?.transaction_date ?? log.created_at, dateFormat)}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/75">
                        {accountLabel}
                        {log.notes ? ` · ${log.notes}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-[#087BFF] dark:text-[#19D8FF]">
                        -{formatIDR(log.amount)}
                      </p>
                      {log.remaining_after > 0 ? (
                        <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                          Sisa: {formatIDR(log.remaining_after, true)}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
      </ModalSheet>
    </AppShell>
  );
}
