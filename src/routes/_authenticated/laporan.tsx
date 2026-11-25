import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { CashflowChart } from "../../components/ego/cashflow-chart";
import { CategoryBreakdown } from "../../components/ego/category-breakdown";
import { useTransactionSheet } from "../../components/ego/transaction-input-sheet";
import {
  transactionsToCsv,
  triggerBrowserDownload,
  vaultSnapshotToBackupJson,
} from "../../lib/export";
import {
  computeAverageMonthlyCashflow,
  computeEmergencyFundMonths,
  computeMonthlyCashflow,
  computeNetWorth,
  formatIDR,
  todayISO,
} from "../../lib/finance";
import { useAuthStatus, useVaultSnapshot } from "../../lib/queries";

export function LaporanPage() {
  const { data: auth } = useAuthStatus();
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const { openTransactionSheet } = useTransactionSheet();
  const navigate = useNavigate();

  const [monthsCount, setMonthsCount] = useState<3 | 6 | 12>(6);
  const [breakdownType, setBreakdownType] = useState<"income" | "expense">(
    "expense"
  );

  const accounts = vault?.accounts ?? [];
  const transactions = vault?.transactions ?? [];
  const assets = vault?.assets ?? [];
  const debts = vault?.debts ?? [];

  const currentMonth = todayISO().slice(0, 7);
  const netWorth = useMemo(
    () => computeNetWorth(accounts, assets, debts),
    [accounts, assets, debts]
  );
  const currentCashflow = useMemo(
    () => computeMonthlyCashflow(transactions, currentMonth),
    [transactions, currentMonth]
  );
  const avgCashflow = useMemo(
    () => computeAverageMonthlyCashflow(transactions, monthsCount, currentMonth),
    [transactions, monthsCount, currentMonth]
  );
  const emergencyMonths = useMemo(
    () =>
      computeEmergencyFundMonths(
        netWorth.totalAccountBalance,
        avgCashflow.avgExpense
      ),
    [netWorth.totalAccountBalance, avgCashflow.avgExpense]
  );

  const grossWealth = Math.max(
    1,
    netWorth.totalAccountBalance + netWorth.totalAssetValue
  );
  const cashShare = Math.round(
    (netWorth.totalAccountBalance / grossWealth) * 100
  );
  const assetShare = Math.max(0, 100 - cashShare);

  function handleExportCsv() {
    if (!vault) return;
    const csv = transactionsToCsv(vault.transactions, vault.accounts);
    triggerBrowserDownload(
      `ego-laporan-transaksi-${todayISO()}.csv`,
      csv,
      "text/csv;charset=utf-8;"
    );
    toast.success("Laporan transaksi (CSV) berhasil diunduh.");
  }

  function handleExportJson() {
    if (!vault) return;
    const json = vaultSnapshotToBackupJson(vault, auth?.owner?.email ?? null);
    triggerBrowserDownload(
      `ego-laporan-brankas-${todayISO()}.json`,
      json,
      "application/json;charset=utf-8;"
    );
    toast.success("Arsip lengkap brankas (JSON) berhasil diunduh.");
  }

  return (
    <AppShell
      title="Laporan Keuangan"
      subtitle="Analisis arus kas, komposisi kekayaan, dan ekspor laporan dari data brankas aktual."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!vault}
            onClick={handleExportCsv}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#DCE4F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#06132F] hover:bg-slate-50 disabled:opacity-50 dark:border-[#1B3163] dark:bg-[#091634] dark:text-[#C7D0E0] dark:hover:bg-[#0D1E45]"
          >
            <FileSpreadsheet
              className="h-3.5 w-3.5 text-[#087BFF] dark:text-[#19D8FF]"
              aria-hidden="true"
            />
            <span>CSV</span>
          </button>
          <button
            type="button"
            disabled={!vault}
            onClick={handleExportJson}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#087BFF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0666DB] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Cadangan JSON</span>
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-5">
          <div className="h-36 animate-pulse rounded-3xl border border-[#DCE4F0] bg-white dark:border-[#1B3163] dark:bg-[#091634]" />
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="h-80 animate-pulse rounded-2xl border border-[#DCE4F0] bg-white dark:border-[#1B3163] dark:bg-[#091634] lg:col-span-7" />
            <div className="h-80 animate-pulse rounded-2xl border border-[#DCE4F0] bg-white dark:border-[#1B3163] dark:bg-[#091634] lg:col-span-5" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Executive KPI Strip */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="ego-card-hero rounded-2xl border border-[#1B3163] p-5 text-white shadow-md shadow-[#06132F]/15">
              <p className="text-xs font-medium text-[#C7D0E0]/80">
                Kekayaan Bersih
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-white">
                {formatIDR(netWorth.netWorth)}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#19D8FF]">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Saldo + Aset − Utang</span>
              </p>
            </div>

            <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 dark:border-[#1B3163] dark:bg-[#091634]">
              <p className="text-xs font-medium text-slate-500 dark:text-[#C7D0E0]/75">
                Rata-rata Pemasukan ({monthsCount} Bln)
              </p>
              <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-[#087BFF] dark:text-[#19D8FF]">
                {formatIDR(avgCashflow.avgIncome)}
              </p>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-[#C7D0E0]/65">
                Bulan ini: {formatIDR(currentCashflow.income)}
              </p>
            </div>

            <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 dark:border-[#1B3163] dark:bg-[#091634]">
              <p className="text-xs font-medium text-slate-500 dark:text-[#C7D0E0]/75">
                Rata-rata Pengeluaran ({monthsCount} Bln)
              </p>
              <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {formatIDR(avgCashflow.avgExpense)}
              </p>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-[#C7D0E0]/65">
                Bulan ini: {formatIDR(currentCashflow.expense)}
              </p>
            </div>

            <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 dark:border-[#1B3163] dark:bg-[#091634]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500 dark:text-[#C7D0E0]/75">
                  Ketahanan Dana Darurat
                </p>
                <ShieldCheck
                  className="h-4 w-4 text-[#087BFF] dark:text-[#19D8FF]"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-[#06132F] dark:text-white">
                {emergencyMonths !== null ? `${emergencyMonths} bulan` : "—"}
              </p>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-[#C7D0E0]/65">
                Rasio likuid terhadap beban bulanan
              </p>
            </div>
          </section>

          {/* Wealth Composition Card */}
          <section className="rounded-2xl border border-[#DCE4F0] bg-white p-5 dark:border-[#1B3163] dark:bg-[#091634]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                  Komposisi Kekayaan &amp; Kewajiban
                </h2>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                  Perbandingan likuiditas kas, portofolio aset, dan sisa kewajiban aktif.
                </p>
              </div>
              <Link
                to="/aset"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#087BFF] hover:underline dark:text-[#19D8FF]"
              >
                <span>Detail Portofolio</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-[#EEF3FA] dark:bg-[#06132F]">
              <div className="flex h-full w-full">
                <div
                  style={{ width: `${cashShare}%` }}
                  className="h-full bg-[#087BFF] transition-all"
                />
                <div
                  style={{ width: `${assetShare}%` }}
                  className="h-full bg-[#19D8FF] transition-all"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F]">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#087BFF]" />
                  <span>Saldo Likuid ({cashShare}%)</span>
                </div>
                <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#06132F] dark:text-white">
                  {formatIDR(netWorth.totalAccountBalance)}
                </p>
              </div>

              <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F]">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#19D8FF]" />
                  <span>Nilai Aset ({assetShare}%)</span>
                </div>
                <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#06132F] dark:text-white">
                  {formatIDR(netWorth.totalAssetValue)}
                </p>
              </div>

              <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F]">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                  <span className="h-2.5 w-2.5 rounded-xs bg-rose-500" />
                  <span>Sisa Kewajiban Utang</span>
                </div>
                <p className="mt-1 font-mono text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  {formatIDR(netWorth.totalDebtBalance)}
                </p>
              </div>
            </div>
          </section>

          {/* Charts */}
          <section className="grid gap-5 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <CashflowChart
                transactions={transactions}
                monthsCount={monthsCount}
                onMonthsCountChange={setMonthsCount}
                referenceMonth={currentMonth}
                onAddTransaction={() => openTransactionSheet()}
              />
            </div>

            <div className="lg:col-span-5">
              <CategoryBreakdown
                title="Distribusi Kategori"
                subtitle="Klik kategori untuk menyaring riwayat transaksi"
                transactions={transactions}
                type={breakdownType}
                onTypeChange={setBreakdownType}
                maxItems={7}
                onAddTransaction={() => openTransactionSheet({ type: breakdownType })}
                onSelectCategory={(cat, txType) => {
                  void navigate({
                    to: "/transaksi",
                    search: { kategori: cat, jenis: txType },
                  });
                }}
              />
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
