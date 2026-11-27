import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { CategoryBreakdown } from "../../components/ego/category-breakdown";
import { CategoryIcon } from "../../components/ego/category-icon";
import {
  EGO_EASE,
  EgoCountUp,
  EgoStaggerSection,
} from "../../components/ego/ego-motion";
import { ModalSheet } from "../../components/ego/modal-sheet";
import { useTransactionSheet } from "../../components/ego/transaction-input-sheet";
import { transactionsToCsv, triggerBrowserDownload } from "../../lib/export";
import {
  filterTransactions,
  formatDateID,
  formatIDR,
  groupTransactionsByDate,
  todayISO,
} from "../../lib/finance";
import { useCancelTransaction, useVaultSnapshot } from "../../lib/queries";
import type { Transaction, TransactionType } from "../../types/ego";

export function TransaksiPage() {
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const cancelTx = useCancelTransaction();
  const { openTransactionSheet } = useTransactionSheet();
  const navigate = useNavigate();
  const routeSearch = useSearch({ strict: false }) as {
    kategori?: string;
    jenis?: "all" | TransactionType;
    akun?: string;
  };

  const accounts = vault?.accounts ?? [];
  const transactions = vault?.transactions ?? [];
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";

  const [filterType, setFilterType] = useState<"all" | TransactionType>(
    routeSearch.jenis ?? "all"
  );
  const [filterAccountId, setFilterAccountId] = useState(
    routeSearch.akun ?? ""
  );
  const [filterSearch, setFilterSearch] = useState(routeSearch.kategori ?? "");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [breakdownType, setBreakdownType] = useState<"income" | "expense">(
    routeSearch.jenis === "income" ? "income" : "expense"
  );
  const [showFilters, setShowFilters] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    if (routeSearch.jenis) {
      setFilterType(routeSearch.jenis);
      if (routeSearch.jenis === "income" || routeSearch.jenis === "expense") {
        setBreakdownType(routeSearch.jenis);
      }
    }
    if (routeSearch.kategori !== undefined) {
      setFilterSearch(routeSearch.kategori);
    }
    if (routeSearch.akun !== undefined) {
      setFilterAccountId(routeSearch.akun);
    }
  }, [routeSearch.jenis, routeSearch.kategori, routeSearch.akun]);

  const hasActiveFilter =
    filterType !== "all" ||
    filterAccountId !== "" ||
    filterSearch.trim() !== "" ||
    filterFrom !== "" ||
    filterTo !== "";

  function handleResetFilters() {
    setFilterType("all");
    setFilterAccountId("");
    setFilterSearch("");
    setFilterFrom("");
    setFilterTo("");
    void navigate({ to: "/transaksi", search: {}, replace: true });
  }

  function applyQuickPeriod(preset: "all" | "this-month" | "last-7d") {
    const today = todayISO();
    if (preset === "all") {
      setFilterFrom("");
      setFilterTo("");
      return;
    }
    if (preset === "this-month") {
      setFilterFrom(`${today.slice(0, 7)}-01`);
      setFilterTo(today);
      return;
    }
    const dt = new Date(`${today}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() - 6);
    setFilterFrom(dt.toISOString().slice(0, 10));
    setFilterTo(today);
  }

  async function handleCancelTransaction(id: string) {
    try {
      await cancelTx.mutateAsync(id);
      toast.success("Transaksi dibatalkan dan saldo akun telah dikembalikan.");
      setSelectedTx(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal membatalkan transaksi."
      );
    }
  }

  const accountNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const acc of accounts) map.set(acc.id, acc.account_name);
    return map;
  }, [accounts]);

  const filteredTransactions = useMemo(
    () =>
      filterTransactions(transactions, {
        type: filterType,
        accountId: filterAccountId || undefined,
        search: filterSearch,
        fromDate: filterFrom || undefined,
        toDate: filterTo || undefined,
      }),
    [
      transactions,
      filterType,
      filterAccountId,
      filterSearch,
      filterFrom,
      filterTo,
    ]
  );

  const groupedByDate = useMemo(
    () => groupTransactionsByDate(filteredTransactions, dateFormat),
    [filteredTransactions, dateFormat]
  );

  const displayedGroups = useMemo(() => {
    const visibleTransactions = showAllTransactions
      ? filteredTransactions
      : filteredTransactions.slice(0, 5);
    const visibleIds = new Set(visibleTransactions.map((tx) => tx.id));
    return groupedByDate
      .map((group) => ({
        ...group,
        items: group.items.filter((tx) => visibleIds.has(tx.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredTransactions, groupedByDate, showAllTransactions]);

  const periodSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filteredTransactions) {
      if (tx.status !== "posted" || !tx.owner_confirmed) continue;
      if (tx.transaction_type === "income") income += tx.amount;
      if (tx.transaction_type === "expense") expense += tx.amount;
    }
    return { income, expense };
  }, [filteredTransactions]);

  return (
    <AppShell
      title="Transaksi"
      subtitle="Semua uang masuk, keluar, dan perpindahan akun dalam satu buku mutasi bersih."
      action={
        <button
          type="button"
          onClick={() => openTransactionSheet({ redirectOnSuccess: false })}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2 text-xs font-semibold text-[#101827] shadow-sm shadow-[#D4AF37]/20 transition-all hover:brightness-105 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Catat Transaksi</span>
        </button>
      }
    >
      <div className="ego-transactions space-y-4">
        <EgoStaggerSection index={0}>
        <section className="ego-transaction-panel ego-transaction-summary ego-main-card relative isolate overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-5">
          <div className="relative z-10 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Buku Mutasi &amp; Ringkasan Periode
              </p>
              <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {showAllTransactions || filteredTransactions.length <= 5
                  ? filteredTransactions.length
                  : 5}{" "}
                / {filteredTransactions.length} transaksi
              </p>
            </div>
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#14B8A6]/25 bg-[#14B8A6]/8 p-3.5 dark:border-[#14B8A6]/30 dark:bg-[#14B8A6]/10">
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Uang Masuk
                </p>
                <p className="mt-1 truncate font-mono text-base font-bold tabular-nums text-[#0D9488] dark:text-[#2DD4BF] sm:text-lg">
                  +<EgoCountUp value={periodSummary.income} formatter={(v) => formatIDR(v, true)} />
                </p>
              </div>
              <div className="rounded-2xl border border-[#EF4444]/25 bg-[#EF4444]/8 p-3.5 dark:border-[#EF4444]/30 dark:bg-[#EF4444]/10">
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Uang Keluar
                </p>
                <p className="mt-1 truncate font-mono text-base font-bold tabular-nums text-[#DC2626] dark:text-[#F87171] sm:text-lg">
                  -<EgoCountUp value={periodSummary.expense} formatter={(v) => formatIDR(v, true)} />
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3.5 dark:border-[#1E293B] dark:bg-[#0B111E]">
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Selisih Bersih
                </p>
                <p
                  className={`mt-1 truncate font-mono text-base font-bold tabular-nums sm:text-lg ${
                    periodSummary.income - periodSummary.expense >= 0
                      ? "text-[#9A7411] dark:text-[#E6C768]"
                      : "text-[#DC2626] dark:text-[#F87171]"
                  }`}
                >
                  <EgoCountUp
                    value={periodSummary.income - periodSummary.expense}
                    formatter={(v) => formatIDR(v, true)}
                  />
                </p>
              </div>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Jenis transaksi"
            className="grid grid-cols-4 gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-[#1E293B] dark:bg-[#0B111E]"
          >
            {(
              [
                { id: "all", label: "Semua" },
                { id: "expense", label: "Keluar" },
                { id: "income", label: "Masuk" },
                { id: "transfer", label: "Transfer" },
              ] as const
            ).map((tab) => {
              const active = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setFilterType(tab.id);
                    if (tab.id === "income" || tab.id === "expense") {
                      setBreakdownType(tab.id);
                    }
                  }}
                  className={`ego-pressable min-h-[42px] rounded-xl px-1.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? "bg-[#101827] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#101827]"
                      : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((value) => !value)}
              className="ego-pressable inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-[#101827] transition-colors hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200"
            >
              <Search className="h-3.5 w-3.5 text-[#9A7411] dark:text-[#E6C768]" aria-hidden="true" />
              <span>Filter &amp; Alat</span>
              {hasActiveFilter ? (
                <span className="rounded-md bg-[#D4AF37]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#9A7411] dark:bg-[#D4AF37]/20 dark:text-[#E6C768]">
                  Aktif
                </span>
              ) : null}
              {showFilters ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
            {hasActiveFilter ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-[#DC2626] hover:bg-[#EF4444]/8 dark:text-[#F87171]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reset</span>
              </button>
            ) : null}
          </div>

          <AnimatePresence initial={false}>
          {showFilters ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: EGO_EASE }}
              className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#1E293B] dark:bg-[#0B111E]"
            >
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Cari transaksi
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    aria-label="Cari transaksi"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Keterangan atau kategori..."
                    className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-9 text-xs text-[#101827] placeholder:text-slate-400 focus:border-[#D4AF37] focus:outline-none dark:border-[#1E293B] dark:bg-[#101827] dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Pilih akun
                </label>
                <select
                  aria-label="Filter akun"
                  value={filterAccountId}
                  onChange={(e) => setFilterAccountId(e.target.value)}
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#101827] focus:border-[#D4AF37] focus:outline-none dark:border-[#1E293B] dark:bg-[#101827] dark:text-white"
                >
                  <option value="">Semua Akun</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Periode
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyQuickPeriod("this-month")}
                    className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#101827] hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-200"
                  >
                    Bulan Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickPeriod("last-7d")}
                    className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#101827] hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-200"
                  >
                    7 Hari
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickPeriod("all")}
                    className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#101827] hover:border-[#D4AF37]/50 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-200"
                  >
                    Semua
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] text-slate-500 dark:text-slate-400">
                      Dari tanggal
                    </label>
                    <input
                      type="date"
                      aria-label="Tanggal mulai"
                      value={filterFrom}
                      onChange={(e) => setFilterFrom(e.target.value)}
                      className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-2 py-2 font-mono text-[11px] text-[#101827] focus:border-[#D4AF37] focus:outline-none dark:border-[#1E293B] dark:bg-[#101827] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-slate-500 dark:text-slate-400">
                      Sampai tanggal
                    </label>
                    <input
                      type="date"
                      aria-label="Tanggal akhir"
                      value={filterTo}
                      onChange={(e) => setFilterTo(e.target.value)}
                      className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-2 py-2 font-mono text-[11px] text-[#101827] focus:border-[#D4AF37] focus:outline-none dark:border-[#1E293B] dark:bg-[#101827] dark:text-white"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-[#1E293B]">
                <button
                  type="button"
                  disabled={filteredTransactions.length === 0}
                  onClick={() => {
                    const csv = transactionsToCsv(filteredTransactions, accounts);
                    triggerBrowserDownload(
                      `ego-transaksi-${todayISO()}.csv`,
                      csv,
                      "text/csv;charset=utf-8;"
                    );
                    toast.success(
                      `${filteredTransactions.length} transaksi diekspor ke CSV.`
                    );
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-[#101827] hover:border-[#D4AF37]/50 disabled:opacity-50 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-200"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ekspor CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBreakdown((value) => !value)}
                  className="inline-flex min-h-[38px] items-center gap-1 text-[11px] font-semibold text-[#9A7411] hover:underline dark:text-[#E6C768]"
                >
                  <span>
                    {showBreakdown
                      ? "Tutup ringkasan kategori"
                      : "Ringkasan kategori"}
                  </span>
                  {showBreakdown ? (
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
              {showBreakdown && !isLoading ? (
                <div className="pt-1">
                  <CategoryBreakdown
                    embedded
                    title="Ringkasan Kategori"
                    subtitle="Pilih kategori untuk menyaring transaksi"
                    transactions={transactions}
                    type={breakdownType}
                    onTypeChange={(nextType) => {
                      setBreakdownType(nextType);
                      if (
                        filterType === "income" ||
                        filterType === "expense"
                      ) {
                        setFilterType(nextType);
                      }
                    }}
                    fromDate={filterFrom || undefined}
                    toDate={filterTo || undefined}
                    selectedCategory={filterSearch}
                    showEmptyCta={false}
                    maxItems={8}
                    onSelectCategory={(cat, txType) => {
                      const isSame =
                        filterSearch.trim().toLowerCase() === cat.toLowerCase() &&
                        filterType === txType;
                      if (isSame) {
                        setFilterSearch("");
                        setFilterType("all");
                      } else {
                        setFilterSearch(cat);
                        setFilterType(txType);
                      }
                    }}
                  />
                </div>
              ) : null}
            </motion.div>
          ) : null}
          </AnimatePresence>
        </section>
        </EgoStaggerSection>

        {/* Date-Grouped Transactions List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((k) => (
              <div
                key={k}
                className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-[#1E293B] dark:bg-[#101827]"
              />
            ))}
          </div>
        ) : groupedByDate.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-[#1E293B] dark:bg-[#101827]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D4AF37]/12 text-[#9A7411] dark:bg-[#D4AF37]/15 dark:text-[#E6C768]">
              <Wallet className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-bold text-[#101827] dark:text-white">
              Belum ada transaksi yang sesuai
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {hasActiveFilter
                ? "Ubah atau reset filter di atas untuk menampilkan catatan lainnya."
                : "Catat transaksi pertama Anda melalui tombol + atau Catat Transaksi."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => openTransactionSheet({ redirectOnSuccess: false })}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2 text-xs font-semibold text-[#101827] hover:brightness-105"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Catat Transaksi</span>
              </button>
              {hasActiveFilter ? (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-[#101827] dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white"
                >
                  <span>Reset Filter</span>
                </button>
              ) : null}
            </div>
          </section>
        ) : (
          <EgoStaggerSection index={1} className="space-y-4">
            {displayedGroups.map((group) => (
              <section
                key={group.dateKey}
                className="ego-transaction-panel overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-[#1E293B] dark:bg-[#0B111E]">
                  <h2 className="text-xs font-bold text-[#101827] dark:text-white">
                    {group.label}
                  </h2>
                  <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
                    {group.dayIncome > 0 ? (
                      <span className="font-semibold text-[#0D9488] dark:text-[#2DD4BF]">
                        +{formatIDR(group.dayIncome)}
                      </span>
                    ) : null}
                    {group.dayExpense > 0 ? (
                      <span className="font-semibold text-[#DC2626] dark:text-[#F87171]">
                        -{formatIDR(group.dayExpense)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <ul className="divide-y divide-slate-200/75 dark:divide-[#1E293B]/80">
                  {group.items.map((tx) => {
                    const srcName = tx.source_account_id
                      ? accountNameMap.get(tx.source_account_id) ?? "Akun"
                      : null;
                    const dstName = tx.destination_account_id
                      ? accountNameMap.get(tx.destination_account_id) ?? "Akun"
                      : null;
                    const accountFlow =
                      tx.transaction_type === "transfer"
                        ? `${srcName ?? "?"} → ${dstName ?? "?"}`
                        : tx.transaction_type === "income"
                          ? dstName ?? "—"
                          : srcName ?? "—";
                    const isCancelled = tx.status === "cancelled";

                    const iconWrapCls = isCancelled
                      ? "bg-slate-100 text-slate-400 dark:bg-[#0B111E] dark:text-slate-500"
                      : tx.transaction_type === "income"
                        ? "bg-[#14B8A6]/12 text-[#0D9488] dark:bg-[#14B8A6]/15 dark:text-[#2DD4BF]"
                        : tx.transaction_type === "expense"
                          ? "bg-[#EF4444]/10 text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#F87171]"
                          : "bg-[#D4AF37]/12 text-[#9A7411] dark:bg-[#D4AF37]/15 dark:text-[#E6C768]";

                    return (
                      <li key={tx.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedTx(tx)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-[#162032]"
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
                                {tx.description || tx.category || "Mutasi"}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                {tx.category || "Umum"} · {accountFlow}
                                {isCancelled ? " · Dibatalkan" : ""}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <p
                              className={`font-mono text-sm font-bold tabular-nums whitespace-nowrap ${
                                isCancelled
                                  ? "text-slate-400 line-through dark:text-slate-500"
                                  : tx.transaction_type === "income"
                                    ? "text-[#0D9488] dark:text-[#2DD4BF]"
                                    : tx.transaction_type === "expense"
                                      ? "text-[#DC2626] dark:text-[#F87171]"
                                      : "text-[#101827] dark:text-[#E6C768]"
                              }`}
                            >
                              {tx.transaction_type === "income"
                                ? "+"
                                : tx.transaction_type === "expense"
                                  ? "-"
                                  : "⇄ "}
                              {formatIDR(tx.amount)}
                            </p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">
                              {isCancelled ? "Saldo Kembali" : "Detail →"}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {filteredTransactions.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAllTransactions((value) => !value)}
                className="ego-pressable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-[#9A7411] shadow-xs transition-colors hover:border-[#D4AF37]/50 hover:bg-slate-50 dark:border-[#1E293B] dark:bg-[#101827] dark:text-[#E6C768] dark:hover:bg-[#162032]"
              >
                {showAllTransactions
                  ? "Tampilkan lebih sedikit"
                  : `Lihat Semua Transaksi (${filteredTransactions.length})`}
                {showAllTransactions ? (
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            ) : null}
          </EgoStaggerSection>
        )}
      </div>

      {/* Transaction Detail & Cancel ModalSheet */}
      <ModalSheet
        open={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        title="Rincian Transaksi"
        subtitle={
          selectedTx
            ? formatDateID(selectedTx.transaction_date, dateFormat)
            : undefined
        }
      >
        {selectedTx ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-[#1E293B] dark:bg-[#0B111E]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                <dt className="text-slate-500 dark:text-slate-400">
                  Alur Akun
                </dt>
                <dd className="text-right font-semibold text-[#101827] dark:text-white">
                  {selectedTx.transaction_type === "transfer"
                    ? `${
                        selectedTx.source_account_id
                          ? accountNameMap.get(selectedTx.source_account_id) ??
                            "Akun"
                          : "?"
                      } → ${
                        selectedTx.destination_account_id
                          ? accountNameMap.get(
                              selectedTx.destination_account_id
                            ) ?? "Akun"
                          : "?"
                      }`
                    : selectedTx.transaction_type === "income"
                      ? selectedTx.destination_account_id
                        ? accountNameMap.get(selectedTx.destination_account_id) ??
                          "Akun"
                        : "—"
                      : selectedTx.source_account_id
                        ? accountNameMap.get(selectedTx.source_account_id) ??
                          "Akun"
                        : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500 dark:text-slate-400">
                  Status
                </dt>
                <dd className="text-right font-semibold text-[#0D9488] dark:text-[#2DD4BF]">
                  {selectedTx.status === "cancelled"
                    ? "Dibatalkan (Saldo Dikembalikan)"
                    : "Disetujui Owner · Terposting"}
                </dd>
              </div>
            </dl>

            {selectedTx.status !== "cancelled" ? (
              <button
                type="button"
                onClick={() => handleCancelTransaction(selectedTx.id)}
                disabled={cancelTx.isPending}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/8 px-4 py-2.5 text-xs font-semibold text-[#DC2626] transition-colors hover:bg-[#EF4444]/15 disabled:opacity-60 dark:border-[#EF4444]/35 dark:bg-[#EF4444]/12 dark:text-[#F87171]"
              >
                {cancelTx.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                )}
                <span>Batalkan Transaksi &amp; Kembalikan Saldo</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </ModalSheet>
    </AppShell>
  );
}
