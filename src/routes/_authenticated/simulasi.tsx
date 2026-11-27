import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookmarkPlus,
  Calculator,
  CheckCircle2,
  FlaskConical,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
import { EgoCountUp, EgoStaggerSection } from "../../components/ego/ego-motion";
import { GoalSimulatorPanel } from "../../components/ego/goal-simulator-panel";
import { MoneyInput } from "../../components/ego/money-input";
import { formatDateID, formatIDR, todayISO } from "../../lib/finance";
import {
  useDeleteWhatIfScenario,
  useSaveWhatIfScenario,
  useVaultSnapshot,
} from "../../lib/queries";
import {
  computeAmortizedMonthlyPayment,
  runWhatIfSimulation,
  whatIfScenarioTypeLabel,
} from "../../lib/whatif-simulator";
import type {
  WhatIfRiskLevel,
  WhatIfScenarioParams,
  WhatIfScenarioRecord,
  WhatIfScenarioType,
} from "../../types/ego";

const SCENARIO_TYPES: WhatIfScenarioType[] = [
  "cash_purchase",
  "installment_purchase",
  "new_loan",
  "accelerated_debt_payoff",
  "income_change",
  "living_cost_change",
  "savings_boost",
  "goal_milestone",
];

const QUICK_PRESETS: Array<{
  label: string;
  params: Partial<WhatIfScenarioParams>;
}> = [
  {
    label: "Beli Laptop Rp 15jt Tunai",
    params: {
      scenario_type: "cash_purchase",
      title: "Beli Laptop Kerja Tunai",
      amount: 15_000_000,
      tenor_months: 1,
      annual_interest_pct: 0,
      monthly_delta: 0,
    },
  },
  {
    label: "Cicilan Gadget 12 Bln",
    params: {
      scenario_type: "installment_purchase",
      title: "Cicilan Gadget 12 Bulan",
      amount: 12_000_000,
      tenor_months: 12,
      annual_interest_pct: 12,
      monthly_delta: 0,
    },
  },
  {
    label: "Percepat Bayar Utang Rp 5jt",
    params: {
      scenario_type: "accelerated_debt_payoff",
      title: "Pelunasan Pokok Utang Dipercepat",
      amount: 5_000_000,
      tenor_months: 1,
      annual_interest_pct: 0,
      monthly_delta: 0,
    },
  },
  {
    label: "Naik Gaji +Rp 2jt/bln",
    params: {
      scenario_type: "income_change",
      title: "Kenaikan Penghasilan Bulanan",
      amount: 0,
      tenor_months: 12,
      annual_interest_pct: 0,
      monthly_delta: 2_000_000,
    },
  },
  {
    label: "Tambah Tabungan +Rp 1,5jt/bln",
    params: {
      scenario_type: "savings_boost",
      title: "Naikkan Setoran Tabungan Rutin",
      amount: 0,
      tenor_months: 12,
      annual_interest_pct: 0,
      monthly_delta: 1_500_000,
    },
  },
];

function riskBadgeStyle(risk: WhatIfRiskLevel): {
  cls: string;
  label: string;
} {
  if (risk === "aman") {
    return {
      cls: "bg-[#14B8A6]/15 text-[#0D9488] dark:text-[#2DD4BF]",
      label: "Aman Dijalankan",
    };
  }
  if (risk === "waspada") {
    return {
      cls: "bg-[#D4AF37]/15 text-[#9A7411] dark:text-[#E6C768]",
      label: "Waspada / Perlu Margin",
    };
  }
  return {
    cls: "bg-[#EF4444]/15 text-[#DC2626] dark:text-[#F87171]",
    label: "Berisiko Tinggi",
  };
}

export function SimulasiPage() {
  const { data: vault, isLoading } = useVaultSnapshot(true);
  const saveScenario = useSaveWhatIfScenario();
  const deleteScenario = useDeleteWhatIfScenario();

  const [activeTab, setActiveTab] = useState<"whatif" | "goal">("whatif");
  const [scenarioType, setScenarioType] =
    useState<WhatIfScenarioType>("cash_purchase");
  const [title, setTitle] = useState("Simulasi Pembelian Barang Tunai");
  const [amount, setAmount] = useState(5_000_000);
  const [tenorMonths, setTenorMonths] = useState(12);
  const [annualInterestPct, setAnnualInterestPct] = useState(10);
  const [monthlyDelta, setMonthlyDelta] = useState(1_000_000);
  const [targetDebtId, setTargetDebtId] = useState("");
  const [targetGoalId, setTargetGoalId] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const accounts = vault?.accounts ?? [];
  const transactions = vault?.transactions ?? [];
  const assets = vault?.assets ?? [];
  const debts = vault?.debts ?? [];
  const recurringBills = vault?.recurring_bills ?? [];
  const financialReminders = vault?.financial_reminders ?? [];
  const savingsGoals = vault?.savings_goals ?? [];
  const categoryBudgets = vault?.category_budgets ?? [];
  const savedScenarios = vault?.whatif_scenarios ?? [];
  const dateFormat = vault?.preferences.date_format ?? "DD MMM YYYY";

  const activeDebts = debts.filter(
    (d) => d.status === "active" && d.outstanding_balance > 0
  );
  const activeGoals = savingsGoals.filter((g) => g.status === "active");

  const currentParams: WhatIfScenarioParams = useMemo(
    () => ({
      scenario_type: scenarioType,
      title: title.trim() || whatIfScenarioTypeLabel(scenarioType),
      amount,
      tenor_months: Math.max(1, Math.min(360, Math.round(tenorMonths) || 1)),
      annual_interest_pct: Math.max(0, Math.min(200, Number(annualInterestPct) || 0)),
      monthly_delta: monthlyDelta,
      target_debt_id: targetDebtId || null,
      target_goal_id: targetGoalId || null,
    }),
    [
      scenarioType,
      title,
      amount,
      tenorMonths,
      annualInterestPct,
      monthlyDelta,
      targetDebtId,
      targetGoalId,
    ]
  );

  const simResult = useMemo(
    () =>
      runWhatIfSimulation({
        params: currentParams,
        accounts,
        transactions,
        assets,
        debts,
        recurringBills,
        financialReminders,
        savingsGoals,
        categoryBudgets,
        referenceDateISO: todayISO(),
      }),
    [
      currentParams,
      accounts,
      transactions,
      assets,
      debts,
      recurringBills,
      financialReminders,
      savingsGoals,
      categoryBudgets,
    ]
  );

  const usesAmount =
    scenarioType === "cash_purchase" ||
    scenarioType === "installment_purchase" ||
    scenarioType === "new_loan" ||
    scenarioType === "accelerated_debt_payoff" ||
    scenarioType === "goal_milestone";

  const usesTenorAndInterest =
    scenarioType === "installment_purchase" || scenarioType === "new_loan";

  const usesMonthlyDelta =
    scenarioType === "income_change" ||
    scenarioType === "living_cost_change" ||
    scenarioType === "savings_boost";

  const amortizedPreview = usesTenorAndInterest
    ? computeAmortizedMonthlyPayment(amount, tenorMonths, annualInterestPct)
    : 0;

  function applyPreset(preset: (typeof QUICK_PRESETS)[number]) {
    if (preset.params.scenario_type) setScenarioType(preset.params.scenario_type);
    if (preset.params.title) setTitle(preset.params.title);
    if (preset.params.amount !== undefined) setAmount(preset.params.amount);
    if (preset.params.tenor_months !== undefined) {
      setTenorMonths(preset.params.tenor_months);
    }
    if (preset.params.annual_interest_pct !== undefined) {
      setAnnualInterestPct(preset.params.annual_interest_pct);
    }
    if (preset.params.monthly_delta !== undefined) {
      setMonthlyDelta(preset.params.monthly_delta);
    }
  }

  function loadSavedScenario(rec: WhatIfScenarioRecord) {
    const p = rec.params;
    setScenarioType(p.scenario_type);
    setTitle(p.title);
    setAmount(p.amount);
    setTenorMonths(p.tenor_months);
    setAnnualInterestPct(p.annual_interest_pct);
    setMonthlyDelta(p.monthly_delta);
    setTargetDebtId(p.target_debt_id ?? "");
    setTargetGoalId(p.target_goal_id ?? "");
    toast.success(`Skenario "${rec.title}" dimuat ke simulator.`);
  }

  async function handleSaveScenario() {
    if (!title.trim()) {
      toast.error("Nama skenario wajib diisi sebelum menyimpan.");
      return;
    }
    try {
      await saveScenario.mutateAsync({
        params: currentParams,
        result_summary: simResult,
      });
      toast.success(
        "Skenario What-If tersimpan terpisah (tidak mengubah saldo akun atau transaksi aktual)."
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan skenario What-If."
      );
    }
  }

  async function handleDeleteScenario(id: string) {
    try {
      await deleteScenario.mutateAsync(id);
      toast.success("Skenario What-If dihapus.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus skenario."
      );
    }
  }

  const badge = riskBadgeStyle(simResult.riskLevel);

  return (
    <AppShell
      title="Simulasi Keuangan (What-If)"
      subtitle="Uji dampak pembelian besar, cicilan baru, percepatan utang, atau perubahan kas sebelum membuat keputusan."
      action={
        <Link
          to="/analitik"
          className="inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#101827] transition-colors hover:border-[#D4AF37]/45 hover:bg-slate-50 dark:border-[#1E293B] dark:bg-[#101827] dark:text-white dark:hover:bg-[#162032]"
        >
          <span>Lihat Analitik &amp; Skor</span>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Safe Isolation Notice + Tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Pilih mode simulasi"
            className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-[#1E293B] dark:bg-[#101827]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "whatif"}
              onClick={() => setActiveTab("whatif")}
              className={`ego-pressable inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "whatif"
                  ? "bg-[#101827] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#101827]"
                  : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              <span>What-If Keputusan</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "goal"}
              onClick={() => setActiveTab("goal")}
              className={`ego-pressable inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "goal"
                  ? "bg-[#101827] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#101827]"
                  : "text-slate-600 hover:text-[#101827] dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Target className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Simulator Target</span>
            </button>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl border border-[#FF4DDE]/40 bg-[#101827] px-3.5 py-2 text-[11px] font-semibold text-[#FF9EEA] shadow-xs">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#FF4DDE]" aria-hidden="true" />
            <span>
              Sandbox Terisolasi: Tidak mempengaruhi saldo atau transaksi aktual.
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white dark:border-[#1E293B] dark:bg-[#101827]" />
        ) : activeTab === "goal" ? (
          <GoalSimulatorPanel
            goals={savingsGoals}
            accounts={accounts}
            transactions={transactions}
            dateFormat={dateFormat}
            selectedGoalId={selectedGoalId}
            onSelectGoalId={setSelectedGoalId}
          />
        ) : (
          <div className="space-y-6">
            <EgoStaggerSection index={0} className="space-y-5">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Skenario Cepat:
              </span>
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="ego-pressable min-h-[36px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#101827] transition-colors hover:border-[#D4AF37]/50 hover:text-[#9A7411] dark:border-[#1E293B] dark:bg-[#101827] dark:text-slate-200 dark:hover:border-[#D4AF37]/50 dark:hover:text-[#E6C768]"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Form Builder */}
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6 lg:col-span-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D4AF37]/15 text-[#9A7411] dark:text-[#E6C768]">
                    <Calculator className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <h2 className="text-base font-bold text-[#101827] dark:text-white">
                    Parameter Skenario
                  </h2>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="whatif-type"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Jenis Keputusan
                    </label>
                    <select
                      id="whatif-type"
                      value={scenarioType}
                      onChange={(e) => {
                        const next = e.target.value as WhatIfScenarioType;
                        setScenarioType(next);
                        setTitle(whatIfScenarioTypeLabel(next));
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
                    >
                      {SCENARIO_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {whatIfScenarioTypeLabel(t)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="whatif-title"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Nama Skenario
                    </label>
                    <input
                      id="whatif-title"
                      type="text"
                      maxLength={140}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Contoh: Beli motor baru / Naik gaji"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
                    />
                  </div>

                  {usesAmount ? (
                    <MoneyInput
                      id="whatif-amount"
                      label={
                        scenarioType === "accelerated_debt_payoff"
                          ? "Nominal Pembayaran Pokok Ekstra (IDR)"
                          : "Nominal Keputusan (IDR)"
                      }
                      value={amount}
                      onChange={setAmount}
                    />
                  ) : null}

                  {usesTenorAndInterest ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="whatif-tenor"
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                        >
                          Tenor (Bulan)
                        </label>
                        <input
                          id="whatif-tenor"
                          type="number"
                          min={1}
                          max={360}
                          value={tenorMonths}
                          onChange={(e) =>
                            setTenorMonths(
                              Math.max(1, Number.parseInt(e.target.value || "1", 10) || 1)
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="whatif-rate"
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                        >
                          Bunga (%/Tahun)
                        </label>
                        <input
                          id="whatif-rate"
                          type="number"
                          min={0}
                          max={200}
                          step={0.5}
                          value={annualInterestPct}
                          onChange={(e) =>
                            setAnnualInterestPct(
                              Math.max(0, Number.parseFloat(e.target.value || "0") || 0)
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
                        />
                      </div>
                      <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-700 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-200">
                        Estimasi cicilan bulanan:{" "}
                        <strong className="font-mono text-[#9A7411] dark:text-[#E6C768]">
                          {formatIDR(amortizedPreview)}/bln
                        </strong>
                      </div>
                    </div>
                  ) : null}

                  {usesMonthlyDelta ? (
                    <MoneyInput
                      id="whatif-delta"
                      label={
                        scenarioType === "income_change"
                          ? "Tambahan Penghasilan / Bulan (IDR)"
                          : scenarioType === "living_cost_change"
                            ? "Kenaikan Biaya Hidup / Bulan (IDR)"
                            : "Tambahan Setoran Tabungan / Bulan (IDR)"
                      }
                      value={monthlyDelta}
                      onChange={setMonthlyDelta}
                    />
                  ) : null}

                  {scenarioType === "accelerated_debt_payoff" && activeDebts.length > 0 ? (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="whatif-debt-target"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        Target Utang Spesifik
                      </label>
                      <select
                        id="whatif-debt-target"
                        value={targetDebtId}
                        onChange={(e) => setTargetDebtId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
                      >
                        <option value="">Otomatis pilih utang aktif pertama</option>
                        {activeDebts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.creditor} ({formatIDR(d.outstanding_balance)})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {activeGoals.length > 0 ? (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="whatif-goal-target"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        Uji Dampak pada Target Finansial
                      </label>
                      <select
                        id="whatif-goal-target"
                        value={targetGoalId}
                        onChange={(e) => setTargetGoalId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-[#101827] focus:border-[#D4AF37] focus:bg-white focus:outline-none dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-white dark:focus:border-[#D4AF37]"
                      >
                        <option value="">Target aktif pertama</option>
                        {activeGoals.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleSaveScenario}
                    disabled={saveScenario.isPending || !title.trim()}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8901F] px-4 py-2.5 text-sm font-semibold text-[#101827] shadow-sm shadow-[#D4AF37]/20 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saveScenario.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>Simpan Skenario Simulasi</span>
                  </button>
                </div>
              </section>

              {/* Simulation Output Panel */}
              <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6 lg:col-span-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-[#101827] dark:text-white">
                    Hasil Analisis Dampak Keuangan
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${badge.cls}`}
                  >
                    {simResult.riskLevel === "aman" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : simResult.riskLevel === "waspada" ? (
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>{badge.label}</span>
                  </span>
                </div>

                <p className="rounded-2xl border border-[#D4AF37]/30 bg-[#101827] px-4 py-3 text-xs leading-relaxed text-slate-200">
                  {simResult.verdict}
                </p>

                {/* Before vs After KPIs */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#1E293B] dark:bg-[#0B111E]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Saldo Likuid (Saat Ini → Setelah Eksekusi)
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#101827] dark:text-white">
                      {formatIDR(simResult.beforeBalance, true)} →{" "}
                      <span
                        className={
                          simResult.afterImmediateBalance < 0
                            ? "text-[#DC2626] dark:text-[#F87171]"
                            : "text-[#9A7411] dark:text-[#E6C768]"
                        }
                      >
                        <EgoCountUp
                          value={simResult.afterImmediateBalance}
                          formatter={(v) => formatIDR(v, true)}
                        />
                      </span>
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#1E293B] dark:bg-[#0B111E]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Proyeksi Saldo 30 Hari / 90 Hari
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#101827] dark:text-white">
                      <span
                        className={
                          simResult.after30dBalance < 0
                            ? "text-[#DC2626] dark:text-[#F87171]"
                            : "text-[#9A7411] dark:text-[#E6C768]"
                        }
                      >
                        <EgoCountUp
                          value={simResult.after30dBalance}
                          formatter={(v) => formatIDR(v, true)}
                        />
                      </span>{" "}
                      /{" "}
                      <span
                        className={
                          simResult.after90dBalance < 0
                            ? "text-[#DC2626] dark:text-[#F87171]"
                            : "text-[#9A7411] dark:text-[#E6C768]"
                        }
                      >
                        <EgoCountUp
                          value={simResult.after90dBalance}
                          formatter={(v) => formatIDR(v, true)}
                        />
                      </span>
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#1E293B] dark:bg-[#0B111E]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Arus Kas Bulanan (Sebelum → Sesudah)
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#101827] dark:text-white">
                      {formatIDR(simResult.monthlyCashflowBefore, true)} →{" "}
                      <span
                        className={
                          simResult.monthlyCashflowAfter < 0
                            ? "text-[#DC2626] dark:text-[#F87171]"
                            : "text-[#0D9488] dark:text-[#2DD4BF]"
                        }
                      >
                        <EgoCountUp
                          value={simResult.monthlyCashflowAfter}
                          formatter={(v) => formatIDR(v, true)}
                        />
                      </span>
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#1E293B] dark:bg-[#0B111E]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Total Utang &amp; Ketahanan Dana Darurat
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#101827] dark:text-white">
                      Utang{" "}
                      <EgoCountUp
                        value={simResult.debtAfter}
                        formatter={(v) => formatIDR(v, true)}
                      />{" "}
                      ·{" "}
                      {simResult.emergencyMonthsAfter !== null
                        ? `${simResult.emergencyMonthsAfter} bln`
                        : "—"}
                    </p>
                    {simResult.goalEtaImpactMonths !== null ? (
                      <p className="mt-0.5 text-[11px] font-medium text-[#9A7411] dark:text-[#E6C768]">
                        Dampak ETA Target:{" "}
                        {simResult.goalEtaImpactMonths > 0
                          ? `Mundur +${simResult.goalEtaImpactMonths} bulan`
                          : simResult.goalEtaImpactMonths < 0
                            ? `Lebih cepat ${Math.abs(simResult.goalEtaImpactMonths)} bulan`
                            : "Tidak berubah"}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Conservative vs Normal vs Optimistic Comparison */}
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Perbandingan 3 Skenario (Konservatif / Normal / Optimistis)
                  </h3>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    {(
                      ["conservative", "normal", "optimistic"] as const
                    ).map((key) => {
                      const v = simResult.variants[key];
                      const vb = riskBadgeStyle(v.riskLevel);
                      return (
                        <div
                          key={key}
                          className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-[#1E293B] dark:bg-[#0B111E]"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-[#101827] dark:text-white">
                              {v.label}
                            </p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${vb.cls}`}
                            >
                              {v.riskLevel}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                            Saldo 90 Hari
                          </p>
                          <p className="font-mono text-sm font-bold tabular-nums text-[#9A7411] dark:text-[#E6C768]">
                            {formatIDR(v.projectedBalance90d, true)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            Surplus/bln:{" "}
                            <span className="font-mono font-semibold text-[#101827] dark:text-white">
                              {formatIDR(v.monthlyCashflowAfter, true)}
                            </span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Budget Notes + Recommendations */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-[#1E293B] dark:bg-[#0B111E]">
                    <p className="font-bold text-[#101827] dark:text-white">
                      Dampak Anggaran &amp; Kas
                    </p>
                    <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-300">
                      {simResult.budgetImpactNotes.map((n) => (
                        <li key={n}>• {n}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-[#FF4DDE]/25 bg-[#FF4DDE]/5 p-3.5 text-xs dark:border-[#FF4DDE]/30 dark:bg-[#162032]">
                    <p className="flex items-center gap-1.5 font-bold text-[#A21CAF] dark:text-[#FF9EEA]">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Rekomendasi Keputusan</span>
                    </p>
                    <ul className="mt-2 space-y-1 text-slate-700 dark:text-slate-200">
                      {simResult.recommendations.map((r) => (
                        <li key={r}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            </div>
            </EgoStaggerSection>

            {/* Saved Scenarios List */}
            <EgoStaggerSection index={1}>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-[#1E293B] dark:bg-[#101827] dark:shadow-none sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-[#101827] dark:text-white">
                    Skenario Simulasi Tersimpan ({savedScenarios.length})
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Arsip skenario What-If terpisah dari transaksi &amp; saldo akun nyata.
                  </p>
                </div>
              </div>

              {savedScenarios.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-600 dark:border-[#1E293B] dark:bg-[#0B111E] dark:text-slate-400">
                  Belum ada skenario What-If yang disimpan. Klik &ldquo;Simpan Skenario Simulasi&rdquo; untuk menyimpan perbandingan keputusan Anda.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {savedScenarios.map((rec) => {
                    const rb = riskBadgeStyle(rec.risk_level);
                    return (
                      <div
                        key={rec.id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#1E293B] dark:bg-[#0B111E]"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-[#101827] dark:text-white">
                              {rec.title}
                            </p>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${rb.cls}`}
                            >
                              {rec.risk_level}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {whatIfScenarioTypeLabel(rec.scenario_type)} ·{" "}
                            {formatDateID(rec.created_at, dateFormat)}
                          </p>
                          <p className="mt-2 font-mono text-xs font-semibold text-[#9A7411] dark:text-[#E6C768]">
                            Saldo 30h: {formatIDR(rec.result_summary?.after30dBalance ?? 0, true)}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-[#1E293B]">
                          <button
                            type="button"
                            onClick={() => loadSavedScenario(rec)}
                            className="text-xs font-semibold text-[#9A7411] hover:underline dark:text-[#E6C768]"
                          >
                            Muat ke Simulator
                          </button>
                          <button
                            type="button"
                            aria-label={`Hapus skenario ${rec.title}`}
                            onClick={() => handleDeleteScenario(rec.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-[#EF4444]/10 hover:text-[#DC2626] dark:hover:text-[#F87171]"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            </EgoStaggerSection>
          </div>
        )}
      </div>
    </AppShell>
  );
}
