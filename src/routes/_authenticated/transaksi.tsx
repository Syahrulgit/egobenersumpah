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
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { CategoryBreakdown } from "../../components/ego/category-breakdown";
import { CategoryIcon } from "../../components/ego/category-icon";
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
  const [showBreakdown, setShowBreakdown] = useState(false);
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
      title="Riwayat Transaksi"
      subtitle="Telusuri, saring, dan periksa seluruh mutasi kas terverifikasi."
      action={
        <div className="flex flex-wrap items-center gap-2">
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
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#DCE4F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#06132F] hover:bg-slate-50 disabled:opacity-50 dark:border-[#1B3163] dark:bg-[#091634] dark:text-[#C7D0E0] dark:hover:bg-[#0D1E45]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => openTransactionSheet({ redirectOnSuccess: false })}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#087BFF]/20 hover:brightness-110 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Catat Transaksi</span>
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Period Totals + Filters Card */}
        <section className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none">
          {/* Type Tabs */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              role="tablist"
              aria-label="Filter jenis mutasi"
              className="grid grid-cols-4 gap-1 rounded-2xl border border-[#DCE4F0] bg-[#EEF3FA] p-1 dark:border-[#1B3163] dark:bg-[#06132F]"
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
                    className={`min-h-[38px] rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? "bg-[#087BFF] text-white shadow-xs"
                        : "text-slate-600 hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-lg bg-[#087BFF]/10 px-2.5 py-1 font-mono font-semibold text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF] tabular-nums">
                +{formatIDR(periodSummary.income, true)}
              </span>
              <span className="rounded-lg bg-rose-500/10 px-2.5 py-1 font-mono font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 tabular-nums">
                -{formatIDR(periodSummary.expense, true)}
              </span>
              <span className="font-mono text-slate-500 dark:text-[#C7D0E0]/70 tabular-nums">
                {filteredTransactions.length} entri
              </span>
            </div>
          </div>

          {/* Search, Account, Period Inputs */}
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-slate-400 dark:text-[#C7D0E0]/60"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label="Cari transaksi"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Cari keterangan atau kategori..."
                className="min-h-[42px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] py-2 pr-3 pl-9 text-xs text-[#06132F] placeholder:text-slate-400 focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#19D8FF]"
              />
            </div>

            <select
              aria-label="Filter akun"
              value={filterAccountId}
              onChange={(e) => setFilterAccountId(e.target.value)}
              className="min-h-[42px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-2 text-xs text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
            >
              <option value="">Semua Akun</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_name}
                </option>
              ))}
            </select>

            <input
              type="date"
              aria-label="Tanggal mulai"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="min-h-[42px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-2 font-mono text-xs text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
            />

            <input
              type="date"
              aria-label="Tanggal akhir"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="min-h-[42px] w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-2 font-mono text-xs text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
            />
          </div>

          {/* Quick Period Chips & Category Toggle */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyQuickPeriod("this-month")}
                className="min-h-[32px] rounded-lg border border-[#DCE4F0] bg-[#F4F7FB] px-2.5 py-1 text-[11px] font-semibold text-[#06132F] hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => applyQuickPeriod("last-7d")}
                className="min-h-[32px] rounded-lg border border-[#DCE4F0] bg-[#F4F7FB] px-2.5 py-1 text-[11px] font-semibold text-[#06132F] hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]"
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => applyQuickPeriod("all")}
                className="min-h-[32px] rounded-lg border border-[#DCE4F0] bg-[#F4F7FB] px-2.5 py-1 text-[11px] font-semibold text-[#06132F] hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]"
              >
                Semua Periode
              </button>
              {hasActiveFilter ? (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  <span>Reset</span>
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setShowBreakdown((v) => !v)}
              className="inline-flex min-h-[32px] items-center gap-1 text-xs font-semibold text-[#087BFF] hover:underline dark:text-[#19D8FF]"
            >
              <span>{showBreakdown ? "Sembunyikan Ringkasan Kategori" : "Lihat Ringkasan Kategori"}</span>
              {showBreakdown ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>

          {showBreakdown && !isLoading ? (
            <div className="mt-4">
              <CategoryBreakdown
                embedded
                title="Rincian Kategori Periode Filter"
                subtitle="Klik kategori untuk menyaring daftar di bawah"
                transactions={transactions}
                type={breakdownType}
                onTypeChange={(nextType) => {
                  setBreakdownType(nextType);
                  if (filterType === "income" || filterType === "expense") {
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
        </section>

        {/* Date-Grouped Transactions List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((k) => (
              <div
                key={k}
                className="h-20 animate-pulse rounded-2xl border border-[#DCE4F0] bg-white dark:border-[#1B3163] dark:bg-[#091634]"
              />
            ))}
          </div>
        ) : groupedByDate.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-[#DCE4F0] bg-white p-8 text-center dark:border-[#1B3163] dark:bg-[#091634]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
              <Wallet className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-bold text-[#06132F] dark:text-white">
              Belum ada transaksi yang sesuai
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-[#C7D0E0]/75">
              {hasActiveFilter
                ? "Ubah atau reset filter di atas untuk menampilkan catatan lainnya."
                : "Catat transaksi pertama Anda melalui tombol + atau Catat Transaksi."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => openTransactionSheet({ redirectOnSuccess: false })}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0666DB]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Catat Transaksi</span>
              </button>
              {hasActiveFilter ? (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-4 py-2 text-xs font-semibold text-[#06132F] dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white"
                >
                  <span>Reset Filter</span>
                </button>
              ) : null}
            </div>
          </section>
        ) : (
          <div className="space-y-4">
            {groupedByDate.map((group) => (
              <section
                key={group.dateKey}
                className="overflow-hidden rounded-2xl border border-[#DCE4F0] bg-white shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE4F0] bg-[#F4F7FB] px-4 py-2.5 dark:border-[#1B3163] dark:bg-[#06132F]">
                  <h2 className="text-xs font-bold text-[#06132F] dark:text-white">
                    {group.label}
                  </h2>
                  <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
                    {group.dayIncome > 0 ? (
                      <span className="font-semibold text-[#087BFF] dark:text-[#19D8FF]">
                        +{formatIDR(group.dayIncome)}
                      </span>
                    ) : null}
                    {group.dayExpense > 0 ? (
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        -{formatIDR(group.dayExpense)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <ul className="divide-y divide-[#DCE4F0]/70 dark:divide-[#1B3163]/70">
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
                          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#F4F7FB] dark:hover:bg-[#0D1E45]/70"
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
                                {tx.description || tx.category || "Mutasi"}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-[#C7D0E0]/70">
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
                                    ? "text-[#087BFF] dark:text-[#19D8FF]"
                                    : tx.transaction_type === "expense"
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-[#06132F] dark:text-[#C7D0E0]"
                              }`}
                            >
                              {tx.transaction_type === "income"
                                ? "+"
                                : tx.transaction_type === "expense"
                                  ? "-"
                                  : "⇄ "}
                              {formatIDR(tx.amount)}
                            </p>
                            <p className="text-[11px] text-slate-400 dark:text-[#C7D0E0]/55">
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
          </div>
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
            <div className="rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] p-4 text-center dark:border-[#1B3163] dark:bg-[#06132F]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#C7D0E0]/70">
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
                <dt className="text-slate-500 dark:text-[#C7D0E0]/70">
                  Alur Akun
                </dt>
                <dd className="text-right font-semibold text-[#06132F] dark:text-white">
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
                <dt className="text-slate-500 dark:text-[#C7D0E0]/70">
                  Status
                </dt>
                <dd className="text-right font-semibold text-[#087BFF] dark:text-[#19D8FF]">
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
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
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
