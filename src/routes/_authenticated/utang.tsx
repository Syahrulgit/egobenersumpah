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
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { ApprovalCheck } from "../../components/ego/approval-check";
import { CategoryIcon } from "../../components/ego/category-icon";
import {
  EGO_EASE,
  EgoAnimatedBar,
  EgoCountUp,
  EgoStaggerSection,
  useRevealOnce,
} from "../../components/ego/ego-motion";
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

const PENDING_DEBT_PAYMENT_KEY = "ego_pending_debt_payment_request";

interface PendingDebtPaymentRequest {
  request_id: string;
  debt_id: string;
  amount: number;
  source_account_id: string;
  notes: string | null;
  transaction_date: string;
}

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

function DebtPayoffChart({
  minPts,
  recPts,
}: {
  minPts: string;
  recPts: string;
}) {
  const { ref, revealed } = useRevealOnce<HTMLDivElement>();
  return (
    <div ref={ref}>
      <svg
        viewBox="0 0 600 160"
        role="img"
        aria-label="Grafik penurunan sisa pokok utang"
        className="h-36 w-full"
      >
        <motion.polyline
          fill="none"
          stroke="#94A3B8"
          strokeWidth="2"
          strokeDasharray="4 4"
          points={minPts}
          initial={{ pathLength: 0, opacity: 0.25 }}
          animate={revealed ? { pathLength: 1, opacity: 1 } : undefined}
          transition={{ duration: 0.65, ease: EGO_EASE }}
        />
        <motion.polyline
          fill="none"
          stroke="#D4AF37"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={recPts}
          initial={{ pathLength: 0, opacity: 0.35 }}
          animate={revealed ? { pathLength: 1, opacity: 1 } : undefined}
          transition={{ duration: 0.78, delay: 0.08, ease: EGO_EASE }}
        />
      </svg>
    </div>
  );
}

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
  const [paymentRequestId, setPaymentRequestId] = useState<string | null>(null);
  const [paymentTransactionDate, setPaymentTransactionDate] = useState(todayISO());
  const [isPendingPaymentRetry, setIsPendingPaymentRetry] = useState(false);
  const [storedPendingPayment, setStoredPendingPayment] =
    useState<PendingDebtPaymentRequest | null>(() => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.sessionStorage.getItem(PENDING_DEBT_PAYMENT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PendingDebtPaymentRequest;
        return typeof parsed.debt_id === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            parsed.request_id
          ) &&
          Number.isFinite(parsed.amount) &&
          parsed.amount > 0 &&
          typeof parsed.source_account_id === "string"
          ? {
              ...parsed,
              transaction_date:
                typeof parsed.transaction_date === "string"
                  ? parsed.transaction_date
                  : todayISO(),
            }
          : null;
      } catch {
        return null;
      }
    });

  const storedPendingDebt = storedPendingPayment
    ? debts.find((debt) => debt.id === storedPendingPayment.debt_id) ?? null
    : null;

  // History Modal State
  const [historyDebt, setHistoryDebt] = useState<Debt | null>(null);

  // Strategy Simulator State
  const [extraMonthlyPayment, setExtraMonthlyPayment] = useState(500_000);

  // Filter status
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "overdue" | "paid"
  >("all");
  const [showAllDebts, setShowAllDebts] = useState(false);

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

  const visibleDebts = showAllDebts ? filteredDebts : filteredDebts.slice(0, 3);

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
    if (storedPendingPayment && storedPendingPayment.debt_id !== norm.id) {
      toast.error(
        "Selesaikan pemeriksaan pembayaran tertunda terlebih dahulu agar ID percobaan tidak tertimpa."
      );
      return;
    }
    setPayingDebt(norm);
    const defaultPay =
      norm.installment_amount > 0
        ? Math.min(norm.outstanding_balance, norm.installment_amount)
        : norm.outstanding_balance;
    let pending: PendingDebtPaymentRequest | null = null;
    try {
      const raw = window.sessionStorage.getItem(PENDING_DEBT_PAYMENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PendingDebtPaymentRequest;
        if (
          parsed.debt_id === norm.id &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            parsed.request_id
          ) &&
          Number.isFinite(parsed.amount) &&
          parsed.amount > 0 &&
          typeof parsed.source_account_id === "string"
        ) {
          pending = {
            ...parsed,
            transaction_date:
              typeof parsed.transaction_date === "string"
                ? parsed.transaction_date
                : todayISO(),
          };
        }
      }
    } catch {
      try {
        window.sessionStorage.removeItem(PENDING_DEBT_PAYMENT_KEY);
      } catch {
        // Storage may be unavailable in restricted browser contexts.
      }
    }
    setPayAmount(pending?.amount ?? defaultPay);
    setPaySourceAccountId(
      pending?.source_account_id ?? activeAccounts[0]?.id ?? ""
    );
    setPayNotes(pending?.notes ?? "");
    setPayConfirmed(false);
    setIsPendingPaymentRetry(Boolean(pending));
    setStoredPendingPayment(pending);
    setPaymentRequestId(pending?.request_id ?? crypto.randomUUID());
    setPaymentTransactionDate(pending?.transaction_date ?? todayISO());
  }

  async function handlePayDebt(e: React.FormEvent) {
    e.preventDefault();
    if (!payingDebt || !payConfirmed) return;
    if (!paySourceAccountId) {
      toast.error("Pilih akun sumber pembayaran.");
      return;
    }
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      toast.error("Nominal pembayaran harus lebih dari Rp 0.");
      return;
    }
    try {
      if (!paymentRequestId) {
        throw new Error(
          "ID permintaan pembayaran belum siap. Tutup lalu buka kembali formulir pembayaran."
        );
      }
      const pendingRequest: PendingDebtPaymentRequest = {
        request_id: paymentRequestId,
        debt_id: payingDebt.id,
        amount: payAmount,
        source_account_id: paySourceAccountId,
        notes: payNotes.trim() || null,
        transaction_date: paymentTransactionDate,
      };
      window.sessionStorage.setItem(
        PENDING_DEBT_PAYMENT_KEY,
        JSON.stringify(pendingRequest)
      );
      setStoredPendingPayment(pendingRequest);
      await payDebt.mutateAsync({
        ...pendingRequest,
        owner_confirmed: true,
      });
      const isFull = payAmount >= payingDebt.outstanding_balance;
      toast.success(
        isFull
          ? `Utang kepada ${payingDebt.creditor} lunas dan tercatat di Pengeluaran.`
          : `Cicilan ${formatIDR(payAmount)} ke ${payingDebt.creditor} tercatat di Pengeluaran.`
      );
      setPayingDebt(null);
      setPayConfirmed(false);
      setPaymentRequestId(null);
      setIsPendingPaymentRetry(false);
      setStoredPendingPayment(null);
      try {
        window.sessionStorage.removeItem(PENDING_DEBT_PAYMENT_KEY);
      } catch {
        // The committed request ID remains safe to replay if storage cleanup fails.
      }
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
          className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-3.5 py-2 text-xs font-semibold text-[#101827] shadow-sm shadow-[#D4AF37]/20 hover:brightness-105 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Catat Utang</span>
        </button>
      }
    >
      <div className="space-y-6">
        {storedPendingPayment && storedPendingDebt ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-[#D4AF37]/45 bg-[#D4AF37]/10 p-4 dark:border-[#D4AF37]/35 dark:bg-[#D4AF37]/12 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#101827] dark:text-amber-100">
                Ada pembayaran utang yang belum terkonfirmasi hasilnya
              </p>
              <p className="mt-1 text-xs text-slate-700 dark:text-amber-200/85">
                {storedPendingDebt.creditor} · {formatIDR(storedPendingPayment.amount)}. Periksa ulang permintaan yang sama agar tidak tercatat dua kali.
              </p>
            </div>
            <button
              type="button"
              onClick={() => startPayment(storedPendingDebt)}
              className="inline-flex min-h-[38px] shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/60 bg-white px-3 py-2 text-xs font-semibold text-[#101827] hover:bg-[#D4AF37]/15 dark:bg-[#101827] dark:text-[#E6C768]"
            >
              Periksa pembayaran
            </button>
          </section>
        ) : null}

        {/* Metrics Summary */}
        <EgoStaggerSection index={0}>
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="ego-card-hero ego-card-hero--living flex flex-col justify-between gap-3 rounded-3xl border border-[#D4AF37]/30 p-5 text-white shadow-lg shadow-[#101827]/20 sm:p-6">
            <div className="relative z-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#E6C768]/90">
                Total Utang Aktif
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-[#F87171] sm:text-3xl">
                <EgoCountUp
                  value={totalDebt}
                  formatter={(v) => formatIDR(v)}
                />
              </p>
            </div>
            <div className="relative z-10 flex items-center justify-between gap-2 text-xs text-slate-300">
              <span>
                {activeDebts.length} aktif · {strategyComparison.overdueDebtCount} terlambat ·{" "}
                {debts.filter((d) => d.status === "paid").length} lunas
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Komitmen Cicilan / Bulan
              </p>
              <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-[#9A7411] dark:text-[#E6C768]">
                <EgoCountUp
                  value={strategyComparison.totalMonthlyCommitment}
                  formatter={(v) => formatIDR(v)}
                />
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {strategyComparison.avalanche.monthsToDebtFree !== null
                  ? `Bebas utang tercepat ~${strategyComparison.avalanche.monthsToDebtFree} bln (${strategyComparison.recommendedStrategy.toUpperCase()})`
                  : "Belum ada kewajiban aktif"}
              </p>
            </div>
            <Link
              to="/pengingat"
              className="ego-pressable mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A7411] hover:underline dark:text-[#E6C768]"
            >
              <BellPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Atur Pengingat Jatuh Tempo</span>
            </Link>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Jatuh Tempo Terdekat
                </p>
                <CalendarClock
                  className="h-4 w-4 text-[#9A7411] dark:text-[#E6C768]"
                  aria-hidden="true"
                />
              </div>
              {nearestDue ? (
                <>
                  <p className="mt-2 text-sm font-bold text-[#101827] dark:text-white">
                    {nearestDue.creditor} ·{" "}
                    <span className="font-mono tabular-nums text-[#DC2626] dark:text-[#F87171]">
                      {formatIDR(nearestDue.outstanding_balance)}
                    </span>
                  </p>
                  <p
                    className={`mt-1 inline-flex items-center gap-1.5 text-xs font-semibold ${
                      nearestDays !== null && nearestDays < 0
                        ? "text-[#DC2626] dark:text-[#F87171]"
                        : nearestDays !== null && nearestDays <= 7
                          ? "text-[#9A7411] dark:text-[#E6C768]"
                          : "text-slate-600 dark:text-slate-300"
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
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  Tidak ada jatuh tempo aktif yang terjadwal saat ini.
                </p>
              )}
            </div>
            {nearestDue ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => startPayment(nearestDue)}
                  className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#D4AF37]/15 px-3 py-1.5 text-xs font-semibold text-[#9A7411] hover:bg-[#D4AF37]/25 dark:bg-[#D4AF37]/20 dark:text-[#E6C768]"
                >
                  <span>Bayar Cicilan Sekarang</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>
        </section>
        </EgoStaggerSection>

        <EgoStaggerSection index={1} className="space-y-6">
        {/* Primary View Tabs */}
        <div
          role="tablist"
          aria-label="Mode manajemen utang"
          className="grid w-full grid-cols-2 items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-[#1E293B] dark:bg-[#101827] sm:inline-flex sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === "list"}
            onClick={() => setViewTab("list")}
            className={`ego-pressable inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
              viewTab === "list"
                ? "bg-[#101827] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#101827]"
                : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
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
            className={`ego-pressable inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
              viewTab === "strategy"
                ? "bg-[#101827] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#101827]"
                : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
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
          <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-[#101827] dark:text-white">
                  Simulasi Strategi Pelunasan Utang
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Bandingkan Pembayaran Minimum, Debt Snowball (saldo terkecil dulu), dan Debt Avalanche (bunga tertinggi dulu). Tidak mengubah saldo nyata.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 self-start rounded-xl border border-[#FF4DDE]/30 bg-[#FF4DDE]/10 px-3 py-1.5 text-xs font-bold text-[#A21CAF] dark:text-[#FF9EEA]">
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
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-600 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-400">
                Belum ada utang aktif untuk disimulasikan. Tambahkan kewajiban aktif terlebih dahulu.
              </div>
            ) : (
              <>
                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#1E293B] dark:bg-[#0B111E] sm:grid-cols-12 sm:items-end">
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
                            ? "border-[#D4AF37] bg-gradient-to-r from-[#D4AF37] to-[#B8901F] text-[#101827]"
                            : "border-slate-200 bg-white text-[#101827] dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-300"
                        }`}
                      >
                        {val === 0 ? "Tanpa Ekstra" : `+${formatIDR(val, true)}`}
                      </button>
                    ))}
                  </div>
                </div>

                {strategyComparison.cashflowFitWarning ? (
                  <div className="flex items-start gap-2.5 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-3 text-xs text-[#101827] dark:border-[#D4AF37]/35 dark:bg-[#D4AF37]/12 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden="true" />
                    <span>{strategyComparison.cashflowFitWarning}</span>
                  </div>
                ) : null}

                <p className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3 text-xs leading-relaxed text-[#101827] dark:border-[#D4AF37]/25 dark:bg-[#D4AF37]/10 dark:text-slate-200">
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
                          ? "border-[#D4AF37] bg-[#D4AF37]/8 dark:border-[#D4AF37]/70 dark:bg-[#D4AF37]/10"
                          : "border-slate-200 bg-slate-50 dark:border-[#1E293B] dark:bg-[#0B111E]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-bold text-[#101827] dark:text-white">
                          {item.sim.strategyLabel}
                        </h3>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            item.highlighted
                              ? "bg-[#D4AF37]/20 text-[#9A7411] dark:text-[#E6C768]"
                              : "bg-slate-200/80 text-slate-600 dark:bg-[#162032] dark:text-slate-300"
                          }`}
                        >
                          {item.badge}
                        </span>
                      </div>
                      <p className="mt-3 font-mono text-xl font-bold text-[#101827] dark:text-white">
                        {item.sim.monthsToDebtFree !== null
                          ? `${item.sim.monthsToDebtFree} bulan`
                          : "> 30 tahun"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Estimasi lunas:{" "}
                        {item.sim.debtFreeDateISO
                          ? formatDateID(item.sim.debtFreeDateISO, dateFormat)
                          : "—"}
                      </p>
                      <dl className="mt-3 space-y-1 border-t border-slate-200 pt-2.5 text-xs dark:border-[#1E293B]">
                        <div className="flex justify-between">
                          <dt className="text-slate-500 dark:text-slate-400">
                            Total Bunga + Biaya
                          </dt>
                          <dd className="font-mono font-semibold text-[#DC2626] dark:text-[#F87171]">
                            {formatIDR(
                              item.sim.totalInterestPaid + item.sim.totalFeePaid
                            )}
                          </dd>
                        </div>
                        {item.sim.strategy !== "minimum_only" ? (
                          <div className="flex justify-between">
                            <dt className="text-slate-500 dark:text-slate-400">
                              Hemat vs Minimum
                            </dt>
                            <dd className="font-mono font-semibold text-[#0D9488] dark:text-[#2DD4BF]">
                              {formatIDR(item.interestSaved)} ({item.monthsSaved} bln)
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  ))}
                </div>

                {/* Dual-Curve Payoff Timeline SVG */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#1E293B] dark:bg-[#0B111E]">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#101827] dark:text-white">
                      Kurva Penurunan Sisa Pokok (Minimum vs Rekomendasi)
                    </span>
                    <div className="flex items-center gap-4 text-[11px]">
                      <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <span className="h-2 w-4 rounded-full bg-slate-400" />
                        Minimum
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#9A7411] dark:text-[#E6C768]">
                        <span className="h-2 w-4 rounded-full bg-[#D4AF37]" />
                        {strategyComparison.recommendedStrategy === "avalanche"
                          ? "Avalanche"
                          : "Snowball"}
                      </span>
                    </div>
                  </div>
                  <DebtPayoffChart
                    minPts={timelineChart.minPts}
                    recPts={timelineChart.recPts}
                  />
                </div>

                {/* Payoff Order */}
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-[#1E293B] dark:bg-[#0B111E]"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[#101827] dark:text-white">
                            #{idx + 1} · {step.creditor}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Bunga {step.annualInterestRate}%/thn · Pokok{" "}
                            {formatIDR(step.startingBalance, true)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono font-bold text-[#9A7411] dark:text-[#E6C768]">
                            Bulan ke-{step.payoffMonthIndex}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-bold text-[#101827] dark:text-white">
                  Daftar Kreditur &amp; Sisa Pokok
                </h2>
                <div
                  role="tablist"
                  aria-label="Filter status utang"
                  className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-[#1E293B] dark:bg-[#0B111E]"
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
                          ? "bg-[#101827] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#101827]"
                          : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="mt-4 h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-[#0B111E]" />
              ) : filteredDebts.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-[#1E293B] dark:bg-[#0B111E]/70">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D4AF37]/15 text-[#9A7411] dark:bg-[#D4AF37]/15 dark:text-[#E6C768]">
                    <CreditCard className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-[#101827] dark:text-white">
                    {debts.length === 0
                      ? "Tidak ada catatan utang"
                      : "Tidak ada kewajiban pada filter ini"}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    Jika Anda memiliki kewajiban cicilan atau pinjaman, catat beserta suku bunga &amp; cicilan rutin agar strategi pelunasan akurat.
                  </p>
                  {debts.length === 0 ? (
                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="mt-4 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2 text-xs font-semibold text-[#101827] hover:brightness-105"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Catat Kewajiban Pertama</span>
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 divide-y divide-slate-200 dark:divide-[#1E293B]">
                  {visibleDebts.map((debt) => {
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
                            <h3 className="text-sm font-bold text-[#101827] dark:text-white">
                              {debt.creditor}
                            </h3>
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              · {debtTypeLabel(debt.debt_type)}
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                displayStatus === "paid"
                                  ? "bg-[#14B8A6]/15 text-[#0D9488] dark:bg-[#14B8A6]/20 dark:text-[#2DD4BF]"
                                  : displayStatus === "overdue"
                                    ? "bg-[#EF4444]/15 text-[#DC2626] dark:text-[#F87171]"
                                    : displayStatus === "due_soon"
                                      ? "bg-[#D4AF37]/15 text-[#9A7411] dark:text-[#E6C768]"
                                      : "bg-slate-200/80 text-slate-700 dark:bg-[#162032] dark:text-slate-300"
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
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
                            <div className="w-36">
                              <EgoAnimatedBar
                                percentage={progressPct}
                                barClassName={
                                  isPaid
                                    ? "bg-[#14B8A6]"
                                    : "bg-gradient-to-r from-[#B8901F] to-[#D4AF37]"
                                }
                                heightClassName="h-1.5"
                              />
                            </div>
                            <span className="font-mono text-[11px] font-semibold tabular-nums text-[#9A7411] dark:text-[#E6C768]">
                              Terbayar {progressPct}%
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
                          <div className="text-left lg:text-right">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Sisa Pokok
                            </p>
                            <p
                              className={`font-mono text-sm font-bold tabular-nums ${
                                isPaid
                                  ? "text-[#0D9488] dark:text-[#2DD4BF]"
                                  : "text-[#DC2626] dark:text-[#F87171]"
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
                              className="ego-pressable inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-[#101827] hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200"
                            >
                              <History className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="hidden sm:inline">Log</span>
                            </button>

                            <button
                              type="button"
                              aria-label={`Edit utang ${debt.creditor}`}
                              onClick={() => openEditModal(debt)}
                              className="ego-pressable inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-[#101827] hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>

                            {!isPaid ? (
                              <button
                                type="button"
                                onClick={() => startPayment(debt)}
                                className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-3.5 py-2 text-xs font-semibold text-[#101827] shadow-xs transition-all hover:brightness-105 whitespace-nowrap"
                              >
                                <span>Bayar / Lunasi</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 text-xs font-semibold text-[#0D9488] dark:text-[#2DD4BF]">
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
              {filteredDebts.length > 0 ? (
                <div className="mt-4 flex flex-col items-center gap-2 border-t border-slate-200 pt-4 dark:border-[#1E293B]">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {showAllDebts
                      ? `${filteredDebts.length} utang ditampilkan`
                      : `${visibleDebts.length} dari ${filteredDebts.length} utang ditampilkan`}
                  </p>
                  {filteredDebts.length > 3 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllDebts((current) => !current)}
                      className="ego-pressable inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-xs font-semibold text-[#9A7411] transition-colors hover:bg-[#D4AF37]/18 dark:border-[#D4AF37]/30 dark:bg-[#D4AF37]/15 dark:text-[#E6C768]"
                    >
                      {showAllDebts
                        ? "Tampilkan Lebih Sedikit"
                        : `Lihat Semua Utang (${filteredDebts.length})`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>

            {/* Riwayat Pembayaran Utang Terintegrasi Pengeluaran */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[#101827] dark:text-white">
                    Riwayat Pembayaran Terintegrasi Pengeluaran
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Setiap cicilan atau pelunasan tercatat otomatis ke buku mutasi pengeluaran &amp; log pembayaran utang.
                  </p>
                </div>
                <Link
                  to="/transaksi"
                  search={{ kategori: "Utang & Cicilan" }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#9A7411] hover:underline whitespace-nowrap dark:text-[#E6C768]"
                >
                  <span>Lihat Semua</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>

              {debtPaymentExpenses.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Belum ada transaksi pembayaran cicilan atau pelunasan utang yang tercatat.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-[#1E293B]">
                  {debtPaymentExpenses.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EF4444]/10 text-[#DC2626] dark:text-[#F87171]">
                          <CategoryIcon
                            category={tx.category}
                            transactionType={tx.transaction_type}
                            className="h-4 w-4"
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#101827] dark:text-white">
                            {tx.description || "Pembayaran Utang"}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">
                            {formatDateID(tx.transaction_date, dateFormat)} ·{" "}
                            {tx.source_account_id
                              ? accountNameMap.get(tx.source_account_id) ?? "Akun"
                              : "Akun"}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 font-mono font-bold tabular-nums text-[#DC2626] dark:text-[#F87171]">
                        -{formatIDR(tx.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
        </EgoStaggerSection>
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
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Nama Kreditur <span className="text-[#EF4444]">*</span>
              </label>
              <input
                id="debt-creditor"
                type="text"
                required
                value={creditor}
                onChange={(e) => setCreditor(e.target.value)}
                placeholder="Contoh: Bank BCA KPR / Kartu Kredit"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="debt-type"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Jenis Utang
              </label>
              <select
                id="debt-type"
                value={debtType}
                onChange={(e) => setDebtType(e.target.value as DebtType)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
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
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Frekuensi Cicilan
              </label>
              <select
                id="debt-frequency"
                value={paymentFrequency}
                onChange={(e) =>
                  setPaymentFrequency(e.target.value as DebtPaymentFrequency)
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
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
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
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
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Tanggal Jatuh Tempo
              </label>
              <input
                id="debt-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="debt-desc"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Keterangan
              </label>
              <input
                id="debt-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tenor / catatan"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:placeholder:text-slate-500"
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
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2.5 text-sm font-semibold text-[#101827] shadow-sm transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:from-[#162032] dark:disabled:to-[#162032] dark:disabled:text-slate-500"
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
            {isPendingPaymentRetry ? (
              <div className="rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-3 text-xs text-[#101827] dark:border-[#D4AF37]/35 dark:bg-[#D4AF37]/12 dark:text-amber-200">
                Ada percobaan pembayaran sebelumnya yang belum mendapat konfirmasi hasil. Rincian dikunci agar tidak berubah; konfirmasi Owner lalu ulangi permintaan yang sama untuk memeriksa hasil tanpa membuat pembayaran kedua.
              </div>
            ) : null}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#1E293B] dark:bg-[#0B111E]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Sisa Pokok Terutang
              </p>
              <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[#DC2626] dark:text-[#F87171]">
                {formatIDR(payingDebt.outstanding_balance)}
              </p>
            </div>

            {activeAccounts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-700 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-300">
                Belum ada akun aktif sebagai sumber dana.{" "}
                <Link
                  to="/akun"
                  onClick={() => setPayingDebt(null)}
                  className="font-semibold text-[#9A7411] hover:underline dark:text-[#E6C768]"
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
                      disabled={isPendingPaymentRetry}
                      onClick={() => {
                        setPayAmount(payingDebt.installment_amount ?? 0);
                        setPaymentRequestId(crypto.randomUUID());
                        setPayConfirmed(false);
                      }}
                      className="min-h-[36px] rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/12 px-3 py-1.5 text-xs font-semibold text-[#9A7411] hover:bg-[#D4AF37]/20 dark:border-[#D4AF37]/35 dark:bg-[#D4AF37]/15 dark:text-[#E6C768]"
                    >
                      Cicilan Rutin ({formatIDR(payingDebt.installment_amount ?? 0, true)})
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={isPendingPaymentRetry}
                    onClick={() => {
                      setPayAmount(
                        Math.max(1, Math.round(payingDebt.outstanding_balance * 0.25))
                      );
                      setPaymentRequestId(crypto.randomUUID());
                      setPayConfirmed(false);
                    }}
                    className="min-h-[36px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-[#101827] hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    disabled={isPendingPaymentRetry}
                    onClick={() => {
                      setPayAmount(
                        Math.max(1, Math.round(payingDebt.outstanding_balance * 0.5))
                      );
                      setPaymentRequestId(crypto.randomUUID());
                      setPayConfirmed(false);
                    }}
                    className="min-h-[36px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-[#101827] hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    disabled={isPendingPaymentRetry}
                    onClick={() => {
                      setPayAmount(payingDebt.outstanding_balance);
                      setPaymentRequestId(crypto.randomUUID());
                      setPayConfirmed(false);
                    }}
                    className="min-h-[36px] rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/12 px-3 py-1.5 text-xs font-semibold text-[#9A7411] hover:bg-[#D4AF37]/20 dark:border-[#D4AF37]/35 dark:bg-[#D4AF37]/15 dark:text-[#E6C768]"
                  >
                    Lunasi Penuh
                  </button>
                </div>

                <MoneyInput
                  id="pay-debt-amount"
                  label="Nominal Pembayaran (IDR)"
                  value={payAmount}
                  disabled={isPendingPaymentRetry}
                  onChange={(value) => {
                    setPayAmount(value);
                    setPaymentRequestId(crypto.randomUUID());
                    setPayConfirmed(false);
                  }}
                  hint={`Sisa setelah bayar: ${formatIDR(
                    Math.max(0, payingDebt.outstanding_balance - payAmount)
                  )}`}
                  required
                />

                <div className="space-y-1.5">
                  <label
                    htmlFor="pay-debt-acc"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Akun Sumber Dana{" "}
                    <span className="text-[#EF4444]">*</span>
                  </label>
                  <select
                    id="pay-debt-acc"
                    required
                    value={paySourceAccountId}
                    disabled={isPendingPaymentRetry}
                    onChange={(e) => {
                      setPaySourceAccountId(e.target.value);
                      setPaymentRequestId(crypto.randomUUID());
                      setPayConfirmed(false);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
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
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Catatan Pembayaran (Opsional)
                  </label>
                  <input
                    id="pay-debt-notes"
                    type="text"
                    value={payNotes}
                    disabled={isPendingPaymentRetry}
                    onChange={(e) => {
                      setPayNotes(e.target.value);
                      setPaymentRequestId(crypto.randomUUID());
                      setPayConfirmed(false);
                    }}
                    placeholder="Misal: Cicilan bulan ke-4"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
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
                    disabled={isPendingPaymentRetry}
                    onClick={() => setPayingDebt(null)}
                    className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-[#101827] hover:bg-slate-200 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={!payConfirmed || payDebt.isPending}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2.5 text-xs font-semibold text-[#101827] hover:brightness-105 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 dark:disabled:from-[#162032] dark:disabled:to-[#162032] dark:disabled:text-slate-500"
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
        title={
          historyDebt
            ? `Log Pembayaran: ${historyDebt.creditor}`
            : "Riwayat Cicilan"
        }
        subtitle="Daftar pembayaran cicilan atau pelunasan yang telah dieksekusi Owner."
      >
        {historyDebt ? (
          historyDebtLogs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-600 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-400">
              Belum ada log pembayaran untuk kewajiban ini.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-[#1E293B]">
              {historyDebtLogs.map((log) => {
                const linkedTx = log.transaction_id
                  ? txById.get(log.transaction_id)
                  : undefined;
                const accountLabel = linkedTx?.source_account_id
                  ? accountNameMap.get(linkedTx.source_account_id) ?? "Akun"
                  : "Pembayaran Terverifikasi";
                return (
                  <li
                    key={log.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#101827] dark:text-white">
                        {formatDateID(
                          linkedTx?.transaction_date ?? log.created_at,
                          dateFormat
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {accountLabel}
                        {log.notes ? ` · ${log.notes}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-[#0D9488] dark:text-[#2DD4BF]">
                        -{formatIDR(log.amount)}
                      </p>
                      {log.remaining_after > 0 ? (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
