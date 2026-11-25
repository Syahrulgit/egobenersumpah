import {
  AlertTriangle,
  BellPlus,
  Calculator,
  CheckCircle2,
  Info,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { summarizeBudgetMonth } from "../../lib/budgets";
import { computeAverageMonthlyCashflow, formatDateID, formatIDR, todayISO } from "../../lib/finance";
import {
  DEPOSIT_FREQUENCY_OPTIONS,
  addMonthsISO,
  computeGoalSimulation,
  mapDepositFrequencyToReminderFrequency,
} from "../../lib/goal-simulator";
import { useCreateReminder, useVaultSnapshot } from "../../lib/queries";
import type {
  AccountBalance,
  DateFormatPref,
  DepositFrequency,
  GoalScenarioKey,
  SavingsGoal,
  Transaction,
} from "../../types/ego";
import { ApprovalCheck } from "./approval-check";
import { GoalProjectionChart } from "./goal-projection-chart";
import { ModalSheet } from "./modal-sheet";
import { MoneyInput } from "./money-input";

interface GoalSimulatorPanelProps {
  goals: SavingsGoal[];
  accounts: AccountBalance[];
  transactions: Transaction[];
  dateFormat: DateFormatPref;
  selectedGoalId?: string | null;
  onSelectGoalId?: (goalId: string | null) => void;
}

export function GoalSimulatorPanel({
  goals,
  accounts,
  transactions,
  dateFormat,
  selectedGoalId,
  onSelectGoalId,
}: GoalSimulatorPanelProps) {
  const createReminder = useCreateReminder();
  const { data: vault } = useVaultSnapshot(true);
  const activeAccounts = accounts.filter((a) => a.is_active);
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const avgCashflow = useMemo(
    () => computeAverageMonthlyCashflow(transactions, 3),
    [transactions]
  );

  const currentBudgetSummary = useMemo(
    () =>
      summarizeBudgetMonth(
        vault?.category_budgets ?? [],
        transactions,
        todayISO().slice(0, 7),
        vault?.budget_alert_logs ?? [],
        vault?.recurring_bills ?? [],
        vault?.financial_reminders ?? []
      ),
    [
      vault?.category_budgets,
      transactions,
      vault?.budget_alert_logs,
      vault?.recurring_bills,
      vault?.financial_reminders,
    ]
  );

  const defaultGoal = useMemo(
    () =>
      goals.find((g) => g.id === selectedGoalId) ??
      goals.find((g) => g.status === "active") ??
      goals[0] ??
      null,
    [goals, selectedGoalId]
  );

  const [sourceMode, setSourceMode] = useState<string>(defaultGoal ? defaultGoal.id : "custom");
  const [title, setTitle] = useState(defaultGoal?.title || "Target Tabungan Baru");
  const [targetAmount, setTargetAmount] = useState(defaultGoal?.target_amount ?? 25_000_000);
  const [currentAmount, setCurrentAmount] = useState(() => {
    if (!defaultGoal) return 0;
    if (defaultGoal.linked_account_id) {
      return accountMap.get(defaultGoal.linked_account_id)?.current_balance ?? defaultGoal.current_amount;
    }
    return defaultGoal.current_amount;
  });
  const [targetDate, setTargetDate] = useState(defaultGoal?.target_date ?? addMonthsISO(todayISO(), 12));
  const [noTargetDate, setNoTargetDate] = useState(defaultGoal ? !defaultGoal.target_date : false);
  const [depositFrequency, setDepositFrequency] = useState<DepositFrequency>("monthly");
  const [monthlyDeposit, setMonthlyDeposit] = useState(() =>
    Math.max(500_000, avgCashflow.avgNet > 0 ? Math.round(avgCashflow.avgNet * 0.5) : 1_500_000)
  );
  const [linkedAccountId, setLinkedAccountId] = useState(defaultGoal?.linked_account_id ?? "");

  const [customScenarioAmounts, setCustomScenarioAmounts] = useState(false);
  const [conservativeAmount, setConservativeAmount] = useState(Math.round(monthlyDeposit * 0.7));
  const [optimisticAmount, setOptimisticAmount] = useState(Math.round(monthlyDeposit * 1.3));
  const [useYieldAssumption, setUseYieldAssumption] = useState(false);
  const [annualYieldPct, setAnnualYieldPct] = useState(4);

  const [selectedScenario, setSelectedScenario] = useState<GoalScenarioKey>("normal");
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderFirstDate, setReminderFirstDate] = useState(todayISO());
  const [reminderTime, setReminderTime] = useState("08:00");
  const [reminderConfirmed, setReminderConfirmed] = useState(false);

  // Sync when selectedGoalId changes from Target tab
  useEffect(() => {
    if (!selectedGoalId) return;
    const goal = goals.find((g) => g.id === selectedGoalId);
    if (!goal) return;
    setSourceMode(goal.id);
    setTitle(goal.title);
    setTargetAmount(goal.target_amount);
    const linked = goal.linked_account_id ? accountMap.get(goal.linked_account_id) : undefined;
    setCurrentAmount(linked ? Math.max(0, linked.current_balance) : goal.current_amount);
    setTargetDate(goal.target_date ?? addMonthsISO(todayISO(), 12));
    setNoTargetDate(!goal.target_date);
    setLinkedAccountId(goal.linked_account_id ?? "");
  }, [selectedGoalId, goals, accountMap]);

  function handleSelectGoalSource(nextValue: string) {
    setSourceMode(nextValue);
    if (nextValue === "custom") {
      onSelectGoalId?.(null);
      return;
    }
    const goal = goals.find((g) => g.id === nextValue);
    if (!goal) return;
    onSelectGoalId?.(goal.id);
    setTitle(goal.title);
    setTargetAmount(goal.target_amount);
    const linked = goal.linked_account_id ? accountMap.get(goal.linked_account_id) : undefined;
    setCurrentAmount(linked ? Math.max(0, linked.current_balance) : goal.current_amount);
    setTargetDate(goal.target_date ?? addMonthsISO(todayISO(), 12));
    setNoTargetDate(!goal.target_date);
    setLinkedAccountId(goal.linked_account_id ?? "");
  }

  function handleNormalDepositChange(val: number) {
    setMonthlyDeposit(val);
    if (!customScenarioAmounts) {
      setConservativeAmount(Math.round(val * 0.7));
      setOptimisticAmount(Math.round(val * 1.3));
    }
  }

  const simulation = useMemo(
    () =>
      computeGoalSimulation({
        goal_id: sourceMode !== "custom" ? sourceMode : null,
        title: title.trim() || "Target Keuangan",
        target_amount: targetAmount,
        current_amount: currentAmount,
        target_date: noTargetDate ? null : targetDate || null,
        monthly_deposit: monthlyDeposit,
        deposit_frequency: depositFrequency,
        linked_account_id: linkedAccountId || null,
        conservative_monthly_deposit: customScenarioAmounts ? conservativeAmount : undefined,
        optimistic_monthly_deposit: customScenarioAmounts ? optimisticAmount : undefined,
        use_yield_assumption: useYieldAssumption,
        annual_yield_pct: annualYieldPct,
      }),
    [
      sourceMode,
      title,
      targetAmount,
      currentAmount,
      noTargetDate,
      targetDate,
      monthlyDeposit,
      depositFrequency,
      linkedAccountId,
      customScenarioAmounts,
      conservativeAmount,
      optimisticAmount,
      useYieldAssumption,
      annualYieldPct,
    ]
  );

  const chosenScenario = simulation.scenarios[selectedScenario];

  const statusBadge =
    simulation.status === "achieved"
      ? {
          label: "Tercapai",
          cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        }
      : simulation.status === "on_track"
        ? {
            label: "Sesuai Rencana",
            cls: "bg-[#087BFF]/15 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]",
          }
        : {
            label: "Berisiko Terlambat",
            cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
          };

  function openReminderReview() {
    setReminderFirstDate(todayISO());
    setReminderConfirmed(false);
    setReminderModalOpen(true);
  }

  async function handleConfirmCreateReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!reminderConfirmed) return;
    if (chosenScenario.cycleDeposit <= 0) {
      toast.error("Nominal setoran pada skenario terpilih harus lebih dari Rp 0.");
      return;
    }

    try {
      const freqLabel =
        DEPOSIT_FREQUENCY_OPTIONS.find((o) => o.value === depositFrequency)?.label ??
        "Bulanan";
      await createReminder.mutateAsync({
        title: `Setoran ${title.trim() || "Target Tabungan"} (${chosenScenario.label})`,
        reminder_type: "setoran_tabungan",
        transaction_type: "transfer",
        amount: chosenScenario.cycleDeposit,
        due_date: reminderFirstDate || todayISO(),
        reminder_time: reminderTime || "08:00",
        frequency: mapDepositFrequencyToReminderFrequency(depositFrequency),
        remind_offsets: [3, 1, 0],
        custom_days_before: null,
        linked_account_id: linkedAccountId || null,
        linked_goal_id: sourceMode !== "custom" ? sourceMode : null,
        notes: `Dari Simulator Target (${freqLabel}, skenario ${chosenScenario.label}${
          depositFrequency === "biweekly" ? " · siklus 2 mingguan" : ""
        }).`,
        owner_confirmed: true,
      });
      toast.success(
        `Pengingat setoran "${title.trim() || "Target"}" berhasil dibuat. Tidak ada saldo atau transaksi yang diubah.`
      );
      setReminderModalOpen(false);
      setReminderConfirmed(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal membuat pengingat setoran."
      );
    }
  }

  return (
    <section
      aria-label="Simulator Target Keuangan"
      className="space-y-5"
    >
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Input Controls */}
        <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none lg:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#06132F] dark:text-white">
                Parameter Simulasi
              </h2>
              <p className="text-xs text-slate-600 dark:text-[#C7D0E0]/75">
                Uji strategi setoran tanpa mengubah data transaksi asli.
              </p>
            </div>
            <Calculator className="h-5 w-5 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="sim-goal-source"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Sumber Target Keuangan
              </label>
              <select
                id="sim-goal-source"
                value={sourceMode}
                onChange={(e) => handleSelectGoalSource(e.target.value)}
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm font-medium text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
              >
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title} ({formatIDR(g.target_amount, true)})
                  </option>
                ))}
                <option value="custom">Simulasi Kustom (Tidak Mengubah Target)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="sim-title"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Nama Target
              </label>
              <input
                id="sim-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Dana Darurat / DP Rumah"
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyInput
                id="sim-target-amount"
                label="Nominal Target"
                value={targetAmount}
                onChange={setTargetAmount}
              />
              <MoneyInput
                id="sim-current-amount"
                label="Terkumpul Saat Ini"
                value={currentAmount}
                onChange={setCurrentAmount}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="sim-target-date"
                  className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                >
                  Tanggal Target
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-[#C7D0E0]/80">
                  <input
                    type="checkbox"
                    checked={noTargetDate}
                    onChange={(e) => setNoTargetDate(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-[#087BFF]"
                  />
                  <span>Tanpa batas tanggal</span>
                </label>
              </div>
              {!noTargetDate ? (
                <input
                  id="sim-target-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 font-mono text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                />
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="sim-frequency"
                  className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                >
                  Frekuensi Setoran
                </label>
                <select
                  id="sim-frequency"
                  value={depositFrequency}
                  onChange={(e) => setDepositFrequency(e.target.value as DepositFrequency)}
                  className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                >
                  {DEPOSIT_FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="sim-account"
                  className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
                >
                  Akun Terkait (Opsional)
                </label>
                <select
                  id="sim-account"
                  value={linkedAccountId}
                  onChange={(e) => setLinkedAccountId(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-sm text-[#06132F] focus:border-[#087BFF] focus:bg-white focus:outline-none dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white dark:focus:border-[#19D8FF]"
                >
                  <option value="">Tidak ditentukan</option>
                  {activeAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name} ({formatIDR(acc.current_balance, true)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <MoneyInput
              id="sim-monthly-deposit"
              label="Rencana Setoran Bulanan (Skenario Normal)"
              value={monthlyDeposit}
              onChange={handleNormalDepositChange}
              hint={
                depositFrequency !== "monthly"
                  ? `Setara ±${formatIDR(Math.round(simulation.scenarios.normal.cycleDeposit))} per ${
                      depositFrequency === "weekly" ? "minggu" : "2 minggu"
                    }`
                  : undefined
              }
            />

            {/* Customize 3 scenarios */}
            <div className="rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F]">
              <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-semibold text-[#06132F] dark:text-white">
                <span>Ubah Nominal Konservatif &amp; Optimistis Manual</span>
                <input
                  type="checkbox"
                  checked={customScenarioAmounts}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setCustomScenarioAmounts(checked);
                    if (!checked) {
                      setConservativeAmount(Math.round(monthlyDeposit * 0.7));
                      setOptimisticAmount(Math.round(monthlyDeposit * 1.3));
                    }
                  }}
                  className="h-4 w-4 rounded accent-[#087BFF]"
                />
              </label>

              {customScenarioAmounts ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <MoneyInput
                    id="sim-conservative"
                    label="Konservatif / bln"
                    value={conservativeAmount}
                    onChange={setConservativeAmount}
                  />
                  <MoneyInput
                    id="sim-optimistic"
                    label="Optimistis / bln"
                    value={optimisticAmount}
                    onChange={setOptimisticAmount}
                  />
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                  Otomatis 70% ({formatIDR(simulation.scenarios.conservative.monthlyDeposit, true)}) &amp; 130% ({formatIDR(simulation.scenarios.optimistic.monthlyDeposit, true)}) dari skenario Normal.
                </p>
              )}
            </div>

            {/* Optional yield assumption (OFF by default) */}
            <div className="rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] p-3.5 dark:border-[#1B3163] dark:bg-[#06132F]">
              <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-semibold text-[#06132F] dark:text-white">
                <span>Asumsi Imbal Hasil Tahunan (Opsional)</span>
                <input
                  type="checkbox"
                  checked={useYieldAssumption}
                  onChange={(e) => setUseYieldAssumption(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#087BFF]"
                />
              </label>

              {useYieldAssumption ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      id="sim-yield-pct"
                      type="number"
                      min={0}
                      max={30}
                      step={0.5}
                      value={annualYieldPct}
                      onChange={(e) => setAnnualYieldPct(Number(e.target.value) || 0)}
                      className="w-24 rounded-xl border border-[#DCE4F0] bg-white px-3 py-2 font-mono text-sm font-bold text-[#06132F] dark:border-[#1B3163] dark:bg-[#091634] dark:text-white"
                    />
                    <span className="text-xs font-semibold text-slate-600 dark:text-[#C7D0E0]">
                      % per tahun (simulasi majemuk bulanan)
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Catatan: Nilai ini adalah asumsi simulasi semata dan bukan jaminan imbal hasil maupun pemasukan riil.
                  </p>
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                  Nonaktif secara default — perhitungan murni berdasarkan setoran pribadi tanpa asumsi bunga.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Simulation Outputs & Chart */}
        <div className="space-y-5 lg:col-span-7">
          {/* Status & KPI Summary Card */}
          <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-[#06132F] dark:text-white">
                    {title.trim() || "Simulasi Target"}
                  </h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusBadge.cls}`}>
                    {statusBadge.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                  Progres {simulation.progressPercentage}% · Sisa dana{" "}
                  <strong className="font-mono text-[#06132F] dark:text-white tabular-nums">
                    {formatIDR(simulation.remainingAmount)}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                onClick={openReminderReview}
                disabled={simulation.isAlreadyAchieved || chosenScenario.cycleDeposit <= 0}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-[#087BFF]/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <BellPlus className="h-4 w-4" aria-hidden="true" />
                <span>Buat Pengingat Setoran</span>
              </button>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <svg
                viewBox="0 0 100 6"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="h-2.5 w-full overflow-hidden rounded-full"
              >
                <rect
                  x={0}
                  y={0}
                  width={100}
                  height={6}
                  rx={3}
                  className="fill-slate-200 dark:fill-[#132652]"
                />
                {simulation.progressPercentage > 0 ? (
                  <rect
                    x={0}
                    y={0}
                    width={simulation.progressPercentage}
                    height={6}
                    rx={3}
                    className="fill-[#087BFF] transition-all dark:fill-[#19D8FF]"
                  />
                ) : null}
              </svg>
            </div>

            {/* Edge-case alerts */}
            {simulation.isAlreadyAchieved ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Target sudah tercapai 100%! Dana terkumpul melebihi atau menyamai nominal target.
                </span>
              </div>
            ) : simulation.isPastDue ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-2.5 text-xs text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Tanggal target sudah terlewati. Perbarui tanggal target atau tambah setoran untuk mengejar kekurangan{" "}
                  <strong className="font-mono">{formatIDR(simulation.remainingAmount)}</strong>.
                </span>
              </div>
            ) : null}

            {/* 4 Key Calculated Metrics */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3 dark:border-[#1B3163] dark:bg-[#06132F]">
                <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                  Sisa Target
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-[#06132F] dark:text-white tabular-nums">
                  {formatIDR(simulation.remainingAmount, true)}
                </p>
              </div>

              <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3 dark:border-[#1B3163] dark:bg-[#06132F]">
                <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                  Sisa Waktu Target
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-[#06132F] dark:text-white tabular-nums">
                  {simulation.monthsRemaining === null
                    ? "Fleksibel"
                    : simulation.isPastDue
                      ? "Lewat tenggat"
                      : `${simulation.monthsRemaining} bln`}
                </p>
              </div>

              <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3 dark:border-[#1B3163] dark:bg-[#06132F]">
                <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                  Setoran Min / Bln
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-[#087BFF] dark:text-[#19D8FF] tabular-nums">
                  {simulation.minimumMonthlyDeposit !== null
                    ? formatIDR(simulation.minimumMonthlyDeposit, true)
                    : "—"}
                </p>
              </div>

              <div className="rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-3 dark:border-[#1B3163] dark:bg-[#06132F]">
                <p className="text-[11px] text-slate-500 dark:text-[#C7D0E0]/70">
                  Estimasi Selesai
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-[#06132F] dark:text-white tabular-nums">
                  {simulation.isAlreadyAchieved
                    ? "Tercapai"
                    : simulation.scenarios.normal.estimatedMonths !== null
                      ? `${simulation.scenarios.normal.estimatedMonths} bln`
                      : "Perlu setoran"}
                </p>
              </div>
            </div>

            {currentBudgetSummary.activeCount > 0 ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 text-xs dark:border-[#1B3163] dark:bg-[#06132F]">
                <span className="text-slate-600 dark:text-[#C7D0E0]/85">
                  Konteks Anggaran Bulan Ini:{" "}
                  <strong className="font-mono text-[#06132F] dark:text-white">
                    {formatIDR(currentBudgetSummary.totalSpentBudgeted, true)}
                  </strong>{" "}
                  / {formatIDR(currentBudgetSummary.totalBudget, true)} ({currentBudgetSummary.overallUsagePct.toFixed(0)}%)
                </span>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    currentBudgetSummary.remainingBudget < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-[#087BFF] dark:text-[#19D8FF]"
                  }`}
                >
                  {currentBudgetSummary.remainingBudget >= 0
                    ? `Sisa anggaran ${formatIDR(currentBudgetSummary.remainingBudget, true)}`
                    : `Lewat batas ${formatIDR(Math.abs(currentBudgetSummary.remainingBudget), true)}`}
                </span>
              </div>
            ) : null}

            {simulation.monthlyPlanGap !== null && !simulation.isAlreadyAchieved ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB]/70 px-3.5 py-2 text-xs dark:border-[#1B3163] dark:bg-[#06132F]/70">
                <TrendingUp className="h-4 w-4 shrink-0 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
                {simulation.monthlyPlanGap >= 0 ? (
                  <span className="text-slate-700 dark:text-[#C7D0E0]">
                    Selisih rencana vs kebutuhan minimum:{" "}
                    <strong className="font-mono text-[#087BFF] dark:text-[#19D8FF]">
                      +{formatIDR(Math.round(simulation.monthlyPlanGap))}/bln
                    </strong>{" "}
                    (lebih cepat dari target tanggal).
                  </span>
                ) : (
                  <span className="text-slate-700 dark:text-[#C7D0E0]">
                    Kekurangan setoran per bulan untuk mengejar tanggal target:{" "}
                    <strong className="font-mono text-rose-600 dark:text-rose-400">
                      {formatIDR(Math.round(Math.abs(simulation.monthlyPlanGap)))}/bln
                    </strong>
                    .
                  </span>
                )}
              </div>
            ) : null}
          </div>

          {/* 3 Scenario Comparison Cards */}
          <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#06132F] dark:text-white">
                  Perbandingan 3 Skenario (Pilih untuk Dijadikan Pengingat)
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                  Ketuk salah satu kartu skenario untuk memilih jadwal setoran.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {(["conservative", "normal", "optimistic"] as GoalScenarioKey[]).map((key) => {
                const sc = simulation.scenarios[key];
                const isSelected = selectedScenario === key;
                const scStatus =
                  sc.status === "achieved"
                    ? "Tercapai"
                    : sc.status === "on_track"
                      ? "Tepat Waktu"
                      : "Berisiko";
                const scBadgeCls =
                  sc.status === "achieved"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : sc.status === "on_track"
                      ? "bg-[#087BFF]/15 text-[#087BFF] dark:bg-[#19D8FF]/15 dark:text-[#19D8FF]"
                      : "bg-rose-500/15 text-rose-700 dark:text-rose-300";

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedScenario(key)}
                    aria-pressed={isSelected}
                    className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-[#087BFF] bg-[#087BFF]/8 ring-2 ring-[#087BFF]/20 dark:border-[#19D8FF] dark:bg-[#19D8FF]/10 dark:ring-[#19D8FF]/20"
                        : "border-[#DCE4F0] bg-[#F4F7FB]/70 hover:border-[#087BFF]/40 dark:border-[#1B3163] dark:bg-[#06132F]/70"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#06132F] dark:text-white">
                          {sc.label}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${scBadgeCls}`}>
                          {scStatus}
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-base font-bold text-[#06132F] dark:text-white tabular-nums">
                        {formatIDR(sc.monthlyDeposit, true)}
                        <span className="text-[11px] font-normal text-slate-500 dark:text-[#C7D0E0]/70">
                          /bln
                        </span>
                      </p>
                      {depositFrequency !== "monthly" ? (
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-[#C7D0E0]/75 tabular-nums">
                          ≈ {formatIDR(sc.cycleDeposit, true)} /{" "}
                          {depositFrequency === "weekly" ? "mgg" : "2 mgg"}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-3 border-t border-[#DCE4F0]/80 pt-2 text-[11px] text-slate-600 dark:border-[#1B3163] dark:text-[#C7D0E0]/80">
                      <p>
                        ETA:{" "}
                        <strong className="font-mono text-[#06132F] dark:text-white">
                          {sc.estimatedDate
                            ? formatDateID(sc.estimatedDate, dateFormat)
                            : "—"}
                        </strong>
                      </p>
                      {sc.planVsTargetGap !== null ? (
                        <p className="mt-0.5">
                          Selisih tenggat:{" "}
                          <strong
                            className={`font-mono ${
                              sc.planVsTargetGap >= 0
                                ? "text-[#087BFF] dark:text-[#19D8FF]"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {sc.planVsTargetGap >= 0 ? "+" : ""}
                            {formatIDR(sc.planVsTargetGap, true)}
                          </strong>
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Projection Chart */}
          <div className="rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-xs dark:border-[#1B3163] dark:bg-[#091634] dark:shadow-none">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#06132F] dark:text-white">
                  Proyeksi Pertumbuhan Dana Tabungan
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#C7D0E0]/75">
                  Ketuk atau arahkan kursor pada grafik untuk membandingkan saldo setiap bulan.
                </p>
              </div>
              <Sparkles className="h-4 w-4 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
            </div>

            <GoalProjectionChart
              series={simulation.projectionSeries}
              targetAmount={targetAmount}
            />

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-2 text-[11px] text-slate-600 dark:border-[#1B3163] dark:bg-[#06132F] dark:text-[#C7D0E0]/75">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#087BFF] dark:text-[#19D8FF]" aria-hidden="true" />
              <span>
                Hasil simulasi bersifat proyeksi perencanaan dan tidak dijamin sebagai pemasukan. Saldo riil hanya berubah melalui transaksi yang Owner setujui.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Review & Confirm Modal for "Buat Pengingat Setoran" */}
      <ModalSheet
        open={reminderModalOpen}
        onClose={() => setReminderModalOpen(false)}
        title="Buat Pengingat Setoran Target"
        subtitle="Tinjau jadwal pengingat sebelum disimpan ke Pusat Pengingat."
      >
        <form onSubmit={handleConfirmCreateReminder} className="space-y-4">
          <div className="rounded-2xl border border-[#DCE4F0] bg-[#F4F7FB] p-4 text-xs dark:border-[#1B3163] dark:bg-[#06132F]">
            <p className="font-bold text-[#06132F] dark:text-white">
              Ringkasan Rencana ({chosenScenario.label})
            </p>
            <dl className="mt-2.5 space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-[#C7D0E0]/75">Target</dt>
                <dd className="font-semibold text-[#06132F] dark:text-white">
                  {title.trim() || "Target Tabungan"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-[#C7D0E0]/75">Nominal Setoran</dt>
                <dd className="font-mono font-bold text-[#087BFF] dark:text-[#19D8FF]">
                  {formatIDR(chosenScenario.cycleDeposit)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-[#C7D0E0]/75">Jadwal Pengingat</dt>
                <dd className="font-semibold text-[#06132F] dark:text-white">
                  {depositFrequency === "monthly" ? "Bulanan" : "Mingguan"} · H-3, H-1, H-0
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="sim-rem-date"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Mulai Tanggal Pengingat
              </label>
              <input
                id="sim-rem-date"
                type="date"
                required
                value={reminderFirstDate}
                onChange={(e) => setReminderFirstDate(e.target.value)}
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 font-mono text-sm text-[#06132F] dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="sim-rem-time"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C7D0E0]"
              >
                Jam Pengingat
              </label>
              <input
                id="sim-rem-time"
                type="time"
                required
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3.5 py-2.5 font-mono text-sm text-[#06132F] dark:border-[#1B3163] dark:bg-[#06132F] dark:text-white"
              />
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Pengingat ini hanya mengingatkan waktu setoran. Tidak ada transaksi otomatis atau pemotongan saldo yang dijalankan tanpa persetujuan Anda.
          </div>

          <ApprovalCheck
            id="sim-create-rem-confirm"
            checked={reminderConfirmed}
            onChange={setReminderConfirmed}
          />

          <button
            type="submit"
            disabled={!reminderConfirmed || createReminder.isPending}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#0066E0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#087BFF]/20 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createReminder.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Menyimpan Pengingat...</span>
              </>
            ) : (
              <span>Simpan Pengingat Setoran</span>
            )}
          </button>
        </form>
      </ModalSheet>
    </section>
  );
}
