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
  Target,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../../components/ego/app-shell";
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
      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      label: "Aman Dijalankan",
    };
  }
  if (risk === "waspada") {
    return {
      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      label: "Waspada / Perlu Margin",
    };
  }
  return {
    cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
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
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-1.5 text-xs font-semibold text-[#06132F] hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#091634] dark:text-white whitespace-nowrap"
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
            className="inline-flex items-center gap-1 rounded-2xl border border-[#DCE4F0] bg-white p-1.5 dark:border-[#1B3163] dark:bg-[#091634]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "whatif"}
              onClick={() => setActiveTab("whatif")}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "whatif"
                  ? "bg-[#087BFF] text-white shadow-xs"
                  : "text-slate-600 hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:text-white"
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
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "goal"
                  ? "bg-[#087BFF] text-white shadow-xs"
                  : "text-slate-600 hover:text-[#06132F] dark:text-[#C7D0E0]/75 dark:hover:text-white"
              }`}
            >
              <Target className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Simulator Target</span>
            </button>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl border border-[#087BFF]/25 bg-[#087BFF]/8 px-3 py-2 text-[11px] font-semibold text-[#087BFF] dark:border-[#19D8FF]/25 dark:bg-[#19D8FF]/10 dark:text-[#19D8FF]">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Mode Simulasi Terisolasi: Tidak pernah memotong saldo atau membuat transaksi otomatis.
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-white dark:bg-[#091634]" />
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
          <>
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#C7D0E0]/70">
                Skenario Cepat:
              </span>
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="min-h-[34px] rounded-xl border border-[#DCE4F0] bg-white px-3 py-1.5 text-xs font-medium text-[#06132F] transition-colors hover:border-[#087BFF]/40 hover:text-[#087BFF] dark:border-[#1B3163] dark:bg-[#091634] dark:text-[#C7D0E0] dark:hover:border-[#19D8FF]/40 dark:hover:text-[#19D8FF]"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Form Builder */}
              <section className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6 lg:col-span-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#087BFF]/10 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]">
                    <Calculator className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                    Parameter Skenario
                  </h2>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="whatif-type"
                      className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
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
                      className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
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
                      className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
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
                      className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
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
                          className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
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
                          className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 font-mono text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="whatif-rate"
                          className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
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
                          className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 font-mono text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                        />
                      </div>
                      <div className="col-span-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2 text-xs dark:border-[#1B3163] dark:bg-[#06132F]">
                        Estimasi cicilan bulanan:{" "}
                        <strong className="font-mono text-[#087BFF] dark:text-[#19D8FF]">
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
                        className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                      >
                        Target Utang Spesifik
                      </label>
                      <select
                        id="whatif-debt-target"
                        value={targetDebtId}
                        onChange={(e) => setTargetDebtId(e.target.value)}
                        className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
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
                        className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                      >
                        Uji Dampak pada Target Finansial
                      </label>
                      <select
                        id="whatif-goal-target"
                        value={targetGoalId}
                        onChange={(e) => setTargetGoalId(e.target.value)}
                        className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
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
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#087BFF]/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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
              <section className="space-y-4 rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6 lg:col-span-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-[#06132F] dark:text-white">
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

                <p className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-4 py-3 text-xs leading-relaxed text-[#06132F] dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]">
                  {simResult.verdict}
                </p>

                {/* Before vs After KPIs */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F]">
                    <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                      Saldo Likuid (Saat Ini → Setelah Eksekusi)
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#06132F] dark:text-white">
                      {formatIDR(simResult.beforeBalance, true)} →{" "}
                      <span
                        className={
                          simResult.afterImmediateBalance < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-[#087BFF] dark:text-[#19D8FF]"
                        }
                      >
                        {formatIDR(simResult.afterImmediateBalance, true)}
                      </span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F]">
                    <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                      Proyeksi Saldo 30 Hari / 90 Hari
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#06132F] dark:text-white">
                      <span
                        className={
                          simResult.after30dBalance < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-[#087BFF] dark:text-[#19D8FF]"
                        }
                      >
                        {formatIDR(simResult.after30dBalance, true)}
                      </span>{" "}
                      /{" "}
                      <span
                        className={
                          simResult.after90dBalance < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-[#087BFF] dark:text-[#19D8FF]"
                        }
                      >
                        {formatIDR(simResult.after90dBalance, true)}
                      </span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F]">
                    <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                      Arus Kas Bulanan (Sebelum → Sesudah)
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#06132F] dark:text-white">
                      {formatIDR(simResult.monthlyCashflowBefore, true)} →{" "}
                      <span
                        className={
                          simResult.monthlyCashflowAfter < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }
                      >
                        {formatIDR(simResult.monthlyCashflowAfter, true)}
                      </span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F]">
                    <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                      Total Utang &amp; Ketahanan Dana Darurat
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold tabular-nums text-[#06132F] dark:text-white">
                      Utang {formatIDR(simResult.debtAfter, true)} ·{" "}
                      {simResult.emergencyMonthsAfter !== null
                        ? `${simResult.emergencyMonthsAfter} bln`
                        : "—"}
                    </p>
                    {simResult.goalEtaImpactMonths !== null ? (
                      <p className="mt-0.5 text-[11px] text-[#087BFF] dark:text-[#19D8FF]">
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
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#C7D0E0]/70">
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
                          className="rounded-xl border border-[#DCE4F0] bg-white p-3 dark:border-[#1B3163] dark:bg-[#06132F]"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-[#06132F] dark:text-white">
                              {v.label}
                            </p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${vb.cls}`}
                            >
                              {v.riskLevel}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                            Saldo 90 Hari
                          </p>
                          <p className="font-mono text-sm font-bold tabular-nums text-[#087BFF] dark:text-[#19D8FF]">
                            {formatIDR(v.projectedBalance90d, true)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                            Surplus/bln:{" "}
                            <span className="font-mono font-semibold text-[#06132F] dark:text-white">
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
                  <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 text-xs dark:border-[#1B3163] dark:bg-[#06132F]">
                    <p className="font-bold text-[#06132F] dark:text-white">
                      Dampak Anggaran &amp; Kas
                    </p>
                    <ul className="mt-2 space-y-1 text-slate-600 dark:text-[#C7D0E0]/85">
                      {simResult.budgetImpactNotes.map((n) => (
                        <li key={n}>• {n}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 text-xs dark:border-[#1B3163] dark:bg-[#06132F]">
                    <p className="font-bold text-[#06132F] dark:text-white">
                      Rekomendasi Keputusan
                    </p>
                    <ul className="mt-2 space-y-1 text-slate-600 dark:text-[#C7D0E0]/85">
                      {simResult.recommendations.map((r) => (
                        <li key={r}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            </div>

            {/* Saved Scenarios List */}
            <section className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                    Skenario Simulasi Tersimpan ({savedScenarios.length})
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                    Arsip skenario What-If terpisah dari transaksi &amp; saldo akun nyata.
                  </p>
                </div>
              </div>

              {savedScenarios.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#DCE4F0] bg-[#F4F7FB] p-5 text-center text-xs text-slate-600 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]/75">
                  Belum ada skenario What-If yang disimpan. Klik &ldquo;Simpan Skenario Simulasi&rdquo; untuk menyimpan perbandingan keputusan Anda.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {savedScenarios.map((rec) => {
                    const rb = riskBadgeStyle(rec.risk_level);
                    return (
                      <div
                        key={rec.id}
                        className="flex flex-col justify-between rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] p-4 dark:border-[#1B3163] dark:bg-[#06132F]"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-[#06132F] dark:text-white">
                              {rec.title}
                            </p>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${rb.cls}`}
                            >
                              {rec.risk_level}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                            {whatIfScenarioTypeLabel(rec.scenario_type)} ·{" "}
                            {formatDateID(rec.created_at, dateFormat)}
                          </p>
                          <p className="mt-2 font-mono text-xs font-semibold text-[#087BFF] dark:text-[#19D8FF]">
                            Saldo 30h: {formatIDR(rec.result_summary.after30dBalance, true)}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#DCE4F0] pt-3 dark:border-[#1B3163]">
                          <button
                            type="button"
                            onClick={() => loadSavedScenario(rec)}
                            className="text-xs font-semibold text-[#087BFF] hover:underline dark:text-[#19D8FF]"
                          >
                            Muat ke Simulator
                          </button>
                          <button
                            type="button"
                            aria-label={`Hapus skenario ${rec.title}`}
                            onClick={() => handleDeleteScenario(rec.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-400"
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
          </>
        )}
      </div>
    </AppShell>
  );
}
