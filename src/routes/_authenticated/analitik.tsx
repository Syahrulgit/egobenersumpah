import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookmarkCheck,
  CalendarClock,
  CheckCircle2,
  HeartPulse,
  Info,
  Loader2,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { CashflowForecastChart } from "../../components/ego/cashflow-forecast-chart";
import {
  EGO_EASE,
  EgoAnimatedBar,
  EgoCountUp,
  EgoStaggerSection,
} from "../../components/ego/ego-motion";
import {
  computeCashflowForecast,
  type ForecastHorizonDays,
} from "../../lib/cashflow-forecast";
import { formatDateID, formatIDR, todayISO } from "../../lib/finance";
import { computeFinancialHealthScore } from "../../lib/health-score";
import { useSaveHealthScore, useVaultSnapshot } from "../../lib/queries";
import type { HealthScoreGrade } from "../../types/ego";

const HORIZON_TABS: Array<{ days: ForecastHorizonDays; label: string }> = [
  { days: 7, label: "7 Hari" },
  { days: 30, label: "30 Hari" },
  { days: 90, label: "90 Hari" },
  { days: 365, label: "365 Hari" },
];

function gradeBadgeClass(grade: HealthScoreGrade): string {
  switch (grade) {
    case "Prima":
      return "bg-[#14B8A6]/20 text-[#2DD4BF] ring-1 ring-[#14B8A6]/35";
    case "Sehat":
      return "bg-[#D4AF37]/20 text-[#E6C768] ring-1 ring-[#D4AF37]/40";
    case "Cukup":
      return "bg-white/10 text-slate-200 ring-1 ring-white/15";
    case "Perlu Perhatian":
      return "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/35";
    case "Rentan":
      return "bg-[#EF4444]/20 text-[#FCA5A5] ring-1 ring-[#EF4444]/40";
    default:
      return "bg-white/10 text-slate-200";
  }
}

export function AnalitikPage() {
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const saveHealthScore = useSaveHealthScore();
  const [horizonDays, setHorizonDays] = useState<ForecastHorizonDays>(30);

  const accounts = vault?.accounts ?? [];
  const transactions = vault?.transactions ?? [];
  const assets = vault?.assets ?? [];
  const debts = vault?.debts ?? [];
  const recurringBills = vault?.recurring_bills ?? [];
  const financialReminders = vault?.financial_reminders ?? [];
  const savingsGoals = vault?.savings_goals ?? [];
  const categoryBudgets = vault?.category_budgets ?? [];
  const budgetAlertLogs = vault?.budget_alert_logs ?? [];
  const scoreHistory = vault?.financial_health_scores ?? [];
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";

  const today = todayISO();

  const health = useMemo(
    () =>
      computeFinancialHealthScore({
        accounts,
        transactions,
        assets,
        debts,
        categoryBudgets,
        budgetAlertLogs,
        savingsGoals,
        referenceDateISO: today,
      }),
    [
      accounts,
      transactions,
      assets,
      debts,
      categoryBudgets,
      budgetAlertLogs,
      savingsGoals,
      today,
    ]
  );

  const forecast = useMemo(
    () =>
      computeCashflowForecast({
        accounts,
        transactions,
        recurringBills,
        financialReminders,
        debts,
        categoryBudgets,
        horizonDays,
        referenceDateISO: today,
      }),
    [
      accounts,
      transactions,
      recurringBills,
      financialReminders,
      debts,
      categoryBudgets,
      horizonDays,
      today,
    ]
  );

  async function handleSaveSnapshot() {
    try {
      await saveHealthScore.mutateAsync({
        period_month: health.periodMonth,
        total_score: health.totalScore,
        grade: health.grade,
        available_weight: health.availableWeight,
        is_data_incomplete: health.isDataIncomplete,
        components: health.components,
      });
      toast.success("Snapshot Financial Health Score berhasil disimpan.");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan snapshot skor kesehatan."
      );
    }
  }

  const gaugePct = health.totalScore ?? 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (gaugePct / 100) * circumference;

  return (
    <AppShell
      title="Analitik & Proyeksi"
      subtitle="Skor kesehatan keuangan menyeluruh dan prediksi arus kas berbasis jadwal terkonfirmasi & histori aktual."
      action={
        <Link
          to="/simulasi"
          className="inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-3.5 py-1.5 text-xs font-semibold text-[#101827] shadow-sm shadow-[#D4AF37]/20 transition-all hover:brightness-105"
        >
          <span>Uji Keputusan What-If</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <div className="h-52 animate-pulse rounded-3xl border border-slate-200 bg-white dark:border-[#1E293B] dark:bg-[#101827]" />
          <div className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white dark:border-[#1E293B] dark:bg-[#101827]" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* MODUL 5: FINANCIAL HEALTH SCORE */}
          <EgoStaggerSection index={0}>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4AF37]/15 text-[#9A7411] dark:text-[#E6C768]">
                  <HeartPulse className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#101827] dark:text-white">
                    Financial Health Score
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    7 indikator berbobot (0–100). Indikator tanpa data tidak pernah diberi nilai 0 palsu.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveSnapshot}
                disabled={saveHealthScore.isPending}
                className="inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/15 px-3.5 py-1.5 text-xs font-semibold text-[#9A7411] transition-colors hover:bg-[#D4AF37]/25 disabled:opacity-50 dark:text-[#E6C768]"
              >
                {saveHealthScore.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Simpan Snapshot Skor</span>
              </button>
            </div>

            {vault?.ecosystemTablesReady === false ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                Tabel riwayat skor (`financial_health_scores`) belum dibuat di Supabase. Anda tetap dapat membaca seluruh skor real-time di bawah, dan jalankan{" "}
                <code className="font-mono font-semibold">
                  docs/ego-supabase-complete-migration.sql
                </code>{" "}
                bila ingin menyimpan snapshot historis.
              </div>
            ) : null}

            {/* Gauge + Highlights */}
            <div className="mt-5 grid gap-5 lg:grid-cols-12">
              <div className="ego-card-hero ego-card-hero--living flex flex-col items-center justify-center rounded-3xl border border-[#D4AF37]/30 p-6 text-center text-white lg:col-span-4">
                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative flex h-36 w-36 items-center justify-center">
                    <svg
                      viewBox="0 0 130 130"
                      className="h-full w-full -rotate-90"
                      aria-hidden="true"
                    >
                      <circle
                        cx="65"
                        cy="65"
                        r={radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth="12"
                      />
                      {health.totalScore !== null ? (
                        <motion.circle
                          cx="65"
                          cy="65"
                          r={radius}
                          fill="none"
                          stroke={
                            health.totalScore >= 80
                              ? "#14B8A6"
                              : health.totalScore >= 50
                                ? "#D4AF37"
                                : "#EF4444"
                          }
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          initial={{ strokeDashoffset: circumference }}
                          animate={{ strokeDashoffset }}
                          transition={{ duration: 0.65, ease: EGO_EASE }}
                        />
                      ) : null}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-3xl font-bold tabular-nums text-white">
                        {health.totalScore !== null ? (
                          <EgoCountUp value={health.totalScore} />
                        ) : (
                          "—"
                        )}
                      </span>
                      <span className="text-[11px] font-medium text-slate-300">
                        dari 100
                      </span>
                    </div>
                  </div>

                  <span
                    className={`mt-3 rounded-full px-3 py-1 text-xs font-bold ${gradeBadgeClass(
                      health.grade
                    )}`}
                  >
                    {health.grade}
                  </span>
                  <p className="mt-2 text-[11px] text-slate-300">
                    {health.availableWeight} dari {health.totalWeight} bobot indikator tersedia
                  </p>
                </div>
              </div>

              <div className="space-y-4 lg:col-span-8">
                {health.isDataIncomplete ? (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/75 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-bold">
                        Sebagian Data Indikator Belum Tersedia
                      </p>
                      <p className="mt-0.5 leading-relaxed">
                        Skor dihitung hanya dari komponen yang datanya terverifikasi:{" "}
                        {health.missingIndicators.join(" · ")}.
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#1E293B] dark:bg-[#0B111E]">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#0D9488] dark:text-[#2DD4BF]">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <span>Faktor Penguat</span>
                    </div>
                    {health.boostingFactors.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Belum ada indikator berkinerja tinggi yang tercatat.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
                        {health.boostingFactors.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#1E293B] dark:bg-[#0B111E]">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#DC2626] dark:text-[#F87171]">
                      <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                      <span>Faktor Perlu Perbaikan</span>
                    </div>
                    {health.draggingFactors.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Tidak ada indikator bermasalah dari data yang tersedia.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
                        {health.draggingFactors.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* 7 Component Grid */}
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {health.components.map((comp) => (
                    <div
                      key={comp.key}
                      className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-[#1E293B] dark:bg-[#0B111E]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-[#101827] dark:text-white">
                          {comp.label}
                        </p>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-[#162032] dark:text-slate-300">
                          Bobot {comp.weight}%
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between gap-2">
                        <span
                          className={`font-mono text-base font-bold tabular-nums ${
                            !comp.available
                              ? "text-slate-400 dark:text-slate-500"
                              : (comp.score ?? 0) >= 75
                                ? "text-[#0D9488] dark:text-[#2DD4BF]"
                                : (comp.score ?? 0) >= 50
                                  ? "text-[#9A7411] dark:text-[#E6C768]"
                                  : "text-[#DC2626] dark:text-[#F87171]"
                          }`}
                        >
                          {comp.available && comp.score !== null
                            ? `${comp.score}/100`
                            : "Belum Ada Data"}
                        </span>
                        <span className="truncate font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {comp.rawValueLabel}
                        </span>
                      </div>
                      {comp.available && comp.score !== null ? (
                        <div className="mt-2">
                          <EgoAnimatedBar
                            percentage={comp.score}
                            heightClassName="h-1.5"
                            barClassName={
                              comp.score >= 75
                                ? "bg-[#14B8A6]"
                                : comp.score >= 50
                                  ? "bg-[#D4AF37]"
                                  : "bg-[#EF4444]"
                            }
                          />
                        </div>
                      ) : null}
                      <p className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                        {comp.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {scoreHistory.length > 0 ? (
              <div className="mt-5 border-t border-slate-200 pt-4 dark:border-[#1E293B]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Riwayat Snapshot Skor Tersimpan
                </h3>
                <div className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1">
                  {scoreHistory.slice(0, 8).map((snap) => (
                    <div
                      key={snap.id}
                      className="min-w-[165px] shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-[#1E293B] dark:bg-[#0B111E]"
                    >
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatDateID(snap.created_at, dateFormat)} ({snap.period_month})
                      </p>
                      <p className="mt-0.5 font-mono text-base font-bold text-[#9A7411] dark:text-[#E6C768]">
                        {snap.total_score !== null ? `${snap.total_score}/100` : "—"}
                      </p>
                      <p className="text-[11px] font-semibold text-[#101827] dark:text-white">
                        {snap.grade}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
          </EgoStaggerSection>

          {/* MODUL 3: CASHFLOW FORECAST ENGINE */}
          <EgoStaggerSection index={1}>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4AF37]/15 text-[#9A7411] dark:text-[#E6C768]">
                  <Activity className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#101827] dark:text-white">
                    Proyeksi Arus Kas (Cashflow Forecast)
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Memisahkan arus terjadwal terkonfirmasi dari estimasi pengeluaran variabel tanpa penghitungan ganda.
                  </p>
                </div>
              </div>

              <div
                role="tablist"
                aria-label="Pilih horizon proyeksi arus kas"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-[#1E293B] dark:bg-[#0B111E]"
              >
                {HORIZON_TABS.map((tab) => (
                  <button
                    key={tab.days}
                    type="button"
                    role="tab"
                    aria-selected={horizonDays === tab.days}
                    onClick={() => setHorizonDays(tab.days)}
                    className={`ego-pressable min-h-[36px] whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                      horizonDays === tab.days
                        ? "bg-[#101827] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#101827]"
                        : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deficit / Buffer Alert Banner */}
            {forecast.deficitDaysCount > 0 ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#EF4444]/35 bg-[#EF4444]/10 px-4 py-3 text-xs text-[#991B1B] dark:text-[#FCA5A5]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626] dark:text-[#F87171]" aria-hidden="true" />
                <div>
                  <p className="font-bold">
                    Peringatan Risiko Defisit Saldo ({forecast.deficitDaysCount} hari dalam {horizonDays} hari ke depan)
                  </p>
                  <p className="mt-0.5">
                    Saldo diproyeksikan turun di bawah Rp 0 mulai{" "}
                    <strong>
                      {forecast.firstDeficitDateISO
                        ? formatDateID(forecast.firstDeficitDateISO, dateFormat)
                        : "—"}
                    </strong>{" "}
                    dengan titik terendah{" "}
                    <strong className="font-mono">
                      {formatIDR(forecast.lowestBalance)}
                    </strong>
                    .
                  </p>
                </div>
              </div>
            ) : forecast.tightBufferDaysCount > 0 ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>
                  Tidak terdeteksi defisit negatif, namun terdapat{" "}
                  <strong>{forecast.tightBufferDaysCount} hari</strong> dengan saldo penyangga tipis di bawah{" "}
                  <span className="font-mono font-semibold">
                    {formatIDR(forecast.tightBufferThreshold)}
                  </span>
                  .
                </p>
              </div>
            ) : null}

            {/* 4 Forecast KPI Strips */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#1E293B] dark:bg-[#0B111E]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Saldo Awal (Aktual)
                </p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#101827] dark:text-white">
                  <EgoCountUp
                    value={forecast.startingBalance}
                    formatter={(v) => formatIDR(v)}
                  />
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#1E293B] dark:bg-[#0B111E]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Proyeksi Akhir {horizonDays} Hari
                </p>
                <p
                  className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                    forecast.endingBalance < 0
                      ? "text-[#DC2626] dark:text-[#F87171]"
                      : "text-[#9A7411] dark:text-[#E6C768]"
                  }`}
                >
                  <EgoCountUp
                    value={forecast.endingBalance}
                    formatter={(v) => formatIDR(v)}
                  />
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Selisih{" "}
                  <span className="font-mono font-semibold">
                    {forecast.netProjectedChange >= 0 ? "+" : ""}
                    {formatIDR(forecast.netProjectedChange, true)}
                  </span>
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#1E293B] dark:bg-[#0B111E]">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Arus Terjadwal Pasti
                  </p>
                  <TrendingUp className="h-3.5 w-3.5 text-[#0D9488] dark:text-[#2DD4BF]" aria-hidden="true" />
                </div>
                <p className="mt-1 font-mono text-xs font-bold tabular-nums text-[#0D9488] dark:text-[#2DD4BF]">
                  +{formatIDR(forecast.scheduledIncome)}
                </p>
                <p className="font-mono text-xs font-bold tabular-nums text-[#DC2626] dark:text-[#F87171]">
                  -{formatIDR(forecast.scheduledExpense)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#1E293B] dark:bg-[#0B111E]">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Estimasi Variabel
                  </p>
                  <TrendingDown className="h-3.5 w-3.5 text-[#9A7411] dark:text-[#E6C768]" aria-hidden="true" />
                </div>
                <p className="mt-1 font-mono text-xs font-bold tabular-nums text-[#0D9488] dark:text-[#2DD4BF]">
                  +{formatIDR(forecast.estimatedIncome)}
                </p>
                <p className="font-mono text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300">
                  -{formatIDR(forecast.estimatedExpense)}
                </p>
              </div>
            </div>

            {/* Chart */}
            <div className="mt-5">
              <CashflowForecastChart forecast={forecast} />
            </div>

            {/* Assumptions + Scheduled Events */}
            <div className="mt-5 grid gap-5 lg:grid-cols-12">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#1E293B] dark:bg-[#0B111E] lg:col-span-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#101827] dark:text-white">
                    Asumsi &amp; Tingkat Keyakinan
                  </h3>
                  <span className="rounded-full bg-[#D4AF37]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#9A7411] dark:text-[#E6C768]">
                    {forecast.confidenceTier === "high"
                      ? "Tinggi"
                      : forecast.confidenceTier === "medium"
                        ? "Menengah"
                        : "Rendah"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  {forecast.confidenceLabel}
                </p>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                  {forecast.assumptions.map((a) => (
                    <li key={a}>• {a}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#1E293B] dark:bg-[#0B111E] lg:col-span-7">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4 text-[#9A7411] dark:text-[#E6C768]" aria-hidden="true" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#101827] dark:text-white">
                      Agenda Arus Kas Terjadwal ({forecast.upcomingEvents.length})
                    </h3>
                  </div>
                  <Link
                    to="/rencana"
                    search={{ tab: "tagihan" }}
                    className="text-xs font-semibold text-[#9A7411] hover:underline dark:text-[#E6C768]"
                  >
                    Kelola Jadwal
                  </Link>
                </div>

                {forecast.upcomingEvents.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Belum ada tagihan rutin, gaji terjadwal, cicilan utang, atau pengingat aktif dalam {horizonDays} hari ke depan.
                  </p>
                ) : (
                  <ul className="max-h-60 space-y-2 overflow-y-auto pr-1">
                    {forecast.upcomingEvents.slice(0, 20).map((ev, idx) => (
                      <li
                        key={`${ev.dateISO}-${ev.title}-${idx}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-[#1E293B] dark:bg-[#101827]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#101827] dark:text-white">
                            {ev.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {formatDateID(ev.dateISO, dateFormat)} ·{" "}
                            {ev.source === "scheduled_bill"
                              ? "Jadwal Rutin"
                              : ev.source === "scheduled_debt"
                                ? "Cicilan Utang"
                                : "Pengingat"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 font-mono font-bold tabular-nums ${
                            ev.direction === "income"
                              ? "text-[#0D9488] dark:text-[#2DD4BF]"
                              : "text-[#DC2626] dark:text-[#F87171]"
                          }`}
                        >
                          {ev.direction === "income" ? "+" : "-"}
                          {formatIDR(ev.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
          </EgoStaggerSection>
        </div>
      )}
    </AppShell>
  );
}
