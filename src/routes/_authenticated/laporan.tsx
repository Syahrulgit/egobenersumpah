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
import {
  EgoAnimatedBar,
  EgoCountUp,
  EgoStaggerSection,
} from "../../components/ego/ego-motion";
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
            className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#101827] transition-colors hover:border-[#D4AF37]/45 hover:bg-slate-50 disabled:opacity-50 dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-200 dark:hover:bg-[#162032]"
          >
            <FileSpreadsheet
              className="h-3.5 w-3.5 text-[#9A7411] dark:text-[#E6C768]"
              aria-hidden="true"
            />
            <span>CSV</span>
          </button>
          <button
            type="button"
            disabled={!vault}
            onClick={handleExportJson}
            className="ego-pressable inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-3.5 py-1.5 text-xs font-semibold text-[#101827] shadow-sm shadow-[#D4AF37]/20 transition-all hover:brightness-105 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Cadangan JSON</span>
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-5">
          <div className="h-36 animate-pulse rounded-3xl border border-slate-200 bg-white dark:border-[#1E293B] dark:bg-[#101827]" />
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white dark:border-[#1E293B] dark:bg-[#101827] lg:col-span-7" />
            <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white dark:border-[#1E293B] dark:bg-[#101827] lg:col-span-5" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Executive KPI Strip */}
          <EgoStaggerSection index={0}>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="ego-card-hero ego-card-hero--living rounded-3xl border border-[#D4AF37]/30 p-5 text-white shadow-md shadow-[#101827]/15">
              <div className="relative z-10">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#E6C768]">
                  Kekayaan Bersih
                </p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-white">
                  <EgoCountUp
                    value={netWorth.netWorth}
                    formatter={(v) => formatIDR(v)}
                  />
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#E6C768]">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Saldo + Aset − Utang</span>
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-[#1E293B] dark:bg-[#101827]">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Rata-rata Pemasukan ({monthsCount} Bln)
              </p>
              <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-[#0D9488] dark:text-[#2DD4BF]">
                <EgoCountUp
                  value={avgCashflow.avgIncome}
                  formatter={(v) => formatIDR(v)}
                />
              </p>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Bulan ini: {formatIDR(currentCashflow.income)}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-[#1E293B] dark:bg-[#101827]">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Rata-rata Pengeluaran ({monthsCount} Bln)
              </p>
              <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-[#DC2626] dark:text-[#F87171]">
                <EgoCountUp
                  value={avgCashflow.avgExpense}
                  formatter={(v) => formatIDR(v)}
                />
              </p>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Bulan ini: {formatIDR(currentCashflow.expense)}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-[#1E293B] dark:bg-[#101827]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Ketahanan Dana Darurat
                </p>
                <ShieldCheck
                  className="h-4 w-4 text-[#9A7411] dark:text-[#E6C768]"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-1.5 font-mono text-xl font-bold tabular-nums text-[#101827] dark:text-white">
                {emergencyMonths !== null ? `${emergencyMonths} bulan` : "—"}
              </p>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Rasio likuid terhadap beban bulanan
              </p>
            </div>
          </section>
          </EgoStaggerSection>

          {/* Wealth Composition Card */}
          <EgoStaggerSection index={1}>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-[#1E293B] dark:bg-[#101827]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#101827] dark:text-white">
                  Komposisi Kekayaan &amp; Kewajiban
                </h2>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Perbandingan likuiditas kas, portofolio aset, dan sisa kewajiban aktif.
                </p>
              </div>
              <Link
                to="/aset"
                className="ego-pressable inline-flex items-center gap-1 text-xs font-semibold text-[#9A7411] hover:underline dark:text-[#E6C768]"
              >
                <span>Detail Portofolio</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#1E293B] dark:bg-[#0B111E]">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#14B8A6]" />
                  <span>Saldo Likuid ({cashShare}%)</span>
                </div>
                <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#0D9488] dark:text-[#2DD4BF]">
                  {formatIDR(netWorth.totalAccountBalance)}
                </p>
                <div className="mt-2.5">
                  <EgoAnimatedBar
                    percentage={cashShare}
                    barClassName="bg-[#14B8A6]"
                    heightClassName="h-1.5"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#1E293B] dark:bg-[#0B111E]">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#D4AF37]" />
                  <span>Nilai Aset ({assetShare}%)</span>
                </div>
                <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#9A7411] dark:text-[#E6C768]">
                  {formatIDR(netWorth.totalAssetValue)}
                </p>
                <div className="mt-2.5">
                  <EgoAnimatedBar
                    percentage={assetShare}
                    heightClassName="h-1.5"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#1E293B] dark:bg-[#0B111E]">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#EF4444]" />
                  <span>Sisa Kewajiban Utang</span>
                </div>
                <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#DC2626] dark:text-[#F87171]">
                  {formatIDR(netWorth.totalDebtBalance)}
                </p>
                <div className="mt-2.5">
                  <EgoAnimatedBar
                    percentage={
                      netWorth.totalDebtBalance > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (netWorth.totalDebtBalance / grossWealth) * 100
                            )
                          )
                        : 0
                    }
                    barClassName="bg-[#EF4444]"
                    heightClassName="h-1.5"
                  />
                </div>
              </div>
            </div>
          </section>
          </EgoStaggerSection>

          {/* Charts */}
          <EgoStaggerSection index={2}>
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
          </EgoStaggerSection>
        </div>
      )}
    </AppShell>
  );
}
