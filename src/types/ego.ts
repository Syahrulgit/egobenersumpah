export type AccountType = "cash" | "bank" | "ewallet";
export type TransactionType = "income" | "expense" | "transfer";
export type TransactionStatus = "posted" | "pending" | "cancelled";
export type AssetType =
  | "emas"
  | "properti"
  | "kendaraan"
  | "investasi"
  | "elektronik"
  | "lainnya";
export type DebtStatus = "active" | "paid";
export type DebtDisplayStatus = "active" | "paid" | "overdue" | "due_soon";
export type DebtType =
  | "kpr"
  | "kendaraan"
  | "kartu_kredit"
  | "pinjaman_pribadi"
  | "paylater"
  | "usaha"
  | "lainnya";
export type DebtPaymentFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";
export type CommandStatus = "pending" | "processed" | "rejected";
export type DateFormatPref = "DD/MM/YYYY" | "YYYY-MM-DD" | "DD MMM YYYY";

export interface Account {
  id: string;
  owner_id: string;
  account_name: string;
  account_type: AccountType;
  opening_balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
}

export interface AccountBalance extends Account {
  current_balance: number;
}

export interface Transaction {
  id: string;
  owner_id: string;
  transaction_type: TransactionType;
  source_account_id: string | null;
  destination_account_id: string | null;
  amount: number;
  transaction_date: string;
  category: string | null;
  description: string | null;
  status: TransactionStatus;
  owner_confirmed: boolean;
  created_at: string;
}

export interface Asset {
  id: string;
  owner_id: string;
  asset_name: string;
  asset_type: AssetType;
  current_value: number;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  created_at: string;
}

export interface Debt {
  id: string;
  owner_id: string;
  creditor: string;
  debt_type?: DebtType;
  original_amount: number;
  outstanding_balance: number;
  interest_rate_annual?: number;
  monthly_fee?: number;
  installment_amount?: number;
  payment_frequency?: DebtPaymentFrequency;
  due_date: string | null;
  status: DebtStatus;
  description: string | null;
  created_at: string;
}

export interface DebtPaymentLog {
  id: string;
  owner_id: string;
  debt_id: string;
  transaction_id: string | null;
  amount: number;
  principal_paid: number;
  interest_paid: number;
  remaining_after: number;
  notes: string | null;
  created_at: string;
}

export interface ParsedCommandDraft {
  transaction_type: TransactionType;
  amount: number | null;
  category: string;
  description: string;
  source_account_id: string | null;
  destination_account_id: string | null;
  source_hint: string | null;
  destination_hint: string | null;
  transaction_date: string;
  confidence: "high" | "medium" | "low";
  warnings: string[];
}

export interface OwnerCommand {
  id: string;
  owner_id: string;
  command_text: string;
  status: CommandStatus;
  parsed_draft: ParsedCommandDraft | null;
  created_at: string;
}

export interface OwnerPreferences {
  date_format: DateFormatPref;
  expense_alert_limit: number;
}

export interface OwnerUser {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface SearchSource {
  title: string;
  uri: string;
}

export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export interface RecurringBill {
  id: string;
  owner_id: string;
  title: string;
  transaction_type: "income" | "expense";
  amount: number;
  category: string;
  account_id: string | null;
  frequency: RecurringFrequency;
  next_due_date: string;
  is_active: boolean;
  notes: string | null;
  last_queued_date: string | null;
  created_at: string;
}

export type GoalType = "emergency_fund" | "savings_target";
export type GoalStatus = "active" | "completed";

export interface SavingsGoal {
  id: string;
  owner_id: string;
  title: string;
  goal_type: GoalType;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  linked_account_id: string | null;
  notes: string | null;
  status: GoalStatus;
  created_at: string;
}

export type ReminderCategory =
  | "tagihan_bulanan"
  | "cicilan_utang"
  | "jatuh_tempo"
  | "tanggal_gajian"
  | "setoran_tabungan"
  | "target_keuangan"
  | "pemasukan_rutin";

export type ReminderFrequency = "once" | "weekly" | "monthly" | "yearly";

export type ReminderStandardOffset = 7 | 3 | 1 | 0;

export type ReminderStatusKind =
  | "overdue"
  | "due_today"
  | "due_soon"
  | "upcoming"
  | "inactive";

export interface FinancialReminder {
  id: string;
  owner_id: string;
  title: string;
  reminder_type: ReminderCategory;
  transaction_type: "income" | "expense" | "transfer";
  amount: number;
  due_date: string;
  reminder_time: string;
  frequency: ReminderFrequency;
  remind_offsets: number[];
  custom_days_before: number | null;
  is_active: boolean;
  is_read: boolean;
  read_at: string | null;
  last_notified_key: string | null;
  last_notified_at: string | null;
  linked_account_id: string | null;
  linked_goal_id: string | null;
  linked_debt_id: string | null;
  linked_bill_id: string | null;
  dedupe_key: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ReminderLogEventType =
  | "triggered"
  | "read"
  | "draft_queued"
  | "rescheduled"
  | "paused"
  | "resumed";

export interface FinancialReminderLog {
  id: string;
  owner_id: string;
  reminder_id: string | null;
  reminder_title: string;
  event_type: ReminderLogEventType;
  trigger_offset: number | null;
  scheduled_for: string | null;
  notes: string | null;
  created_at: string;
}

export type DepositFrequency = "weekly" | "biweekly" | "monthly";
export type GoalScenarioKey = "conservative" | "normal" | "optimistic";
export type GoalTargetStatus = "achieved" | "on_track" | "at_risk";

export interface GoalSimulationInput {
  goal_id?: string | null;
  title: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  monthly_deposit: number;
  deposit_frequency: DepositFrequency;
  linked_account_id: string | null;
  conservative_monthly_deposit?: number;
  optimistic_monthly_deposit?: number;
  use_yield_assumption?: boolean;
  annual_yield_pct?: number;
}

export interface GoalScenarioProjectionPoint {
  monthIndex: number;
  dateISO: string;
  label: string;
  conservative: number;
  normal: number;
  optimistic: number;
  targetAmount: number;
}

export interface GoalScenarioOutcome {
  key: GoalScenarioKey;
  label: string;
  monthlyDeposit: number;
  cycleDeposit: number;
  estimatedMonths: number | null;
  estimatedDate: string | null;
  projectedAtTargetDate: number | null;
  planVsTargetGap: number | null;
  status: GoalTargetStatus;
}

export interface GoalSimulationResult {
  remainingAmount: number;
  progressPercentage: number;
  monthsRemaining: number | null;
  daysRemaining: number | null;
  isPastDue: boolean;
  isAlreadyAchieved: boolean;
  minimumMonthlyDeposit: number | null;
  monthlyPlanGap: number | null;
  status: GoalTargetStatus;
  scenarios: Record<GoalScenarioKey, GoalScenarioOutcome>;
  projectionSeries: GoalScenarioProjectionPoint[];
  useYieldAssumption: boolean;
  annualYieldPct: number;
}

export type BudgetThresholdLevel = 50 | 75 | 90 | 100 | 101;

export type BudgetSeverityLevel =
  | "safe"
  | "info_50"
  | "warning_75"
  | "high_90"
  | "reached_100"
  | "exceeded_over"
  | "inactive";

export interface CategoryBudget {
  id: string;
  owner_id: string;
  category: string;
  period_month: string;
  limit_amount: number;
  is_active: boolean;
  last_alert_threshold: BudgetThresholdLevel | null;
  last_alert_period: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type BudgetLogEventType =
  | "threshold_crossed"
  | "created"
  | "updated"
  | "paused"
  | "resumed";

export interface BudgetAlertLog {
  id: string;
  owner_id: string;
  budget_id: string | null;
  category: string;
  period_month: string;
  threshold_level: BudgetThresholdLevel | 0;
  spent_amount: number;
  limit_amount: number;
  usage_pct: number;
  event_type: BudgetLogEventType;
  notes: string | null;
  created_at: string;
}

export type WhatIfScenarioType =
  | "cash_purchase"
  | "installment_purchase"
  | "new_loan"
  | "accelerated_debt_payoff"
  | "income_change"
  | "living_cost_change"
  | "savings_boost"
  | "goal_milestone";

export type WhatIfRiskLevel = "aman" | "waspada" | "berisiko";

export interface WhatIfScenarioParams {
  scenario_type: WhatIfScenarioType;
  title: string;
  amount: number;
  tenor_months: number;
  annual_interest_pct: number;
  monthly_delta: number;
  target_debt_id?: string | null;
  target_goal_id?: string | null;
  notes?: string | null;
}

export interface WhatIfVariantOutcome {
  key: GoalScenarioKey;
  label: string;
  projectedBalance30d: number;
  projectedBalance90d: number;
  monthlyCashflowAfter: number;
  emergencyMonthsAfter: number | null;
  riskLevel: WhatIfRiskLevel;
}

export interface WhatIfSimulationResult {
  beforeBalance: number;
  afterImmediateBalance: number;
  after30dBalance: number;
  after90dBalance: number;
  monthlyCashflowBefore: number;
  monthlyCashflowAfter: number;
  debtBefore: number;
  debtAfter: number;
  monthlyDebtInstallmentDelta: number;
  emergencyMonthsBefore: number | null;
  emergencyMonthsAfter: number | null;
  goalEtaImpactMonths: number | null;
  budgetImpactNotes: string[];
  riskLevel: WhatIfRiskLevel;
  verdict: string;
  recommendations: string[];
  variants: Record<GoalScenarioKey, WhatIfVariantOutcome>;
}

export interface WhatIfScenarioRecord {
  id: string;
  owner_id: string;
  title: string;
  scenario_type: WhatIfScenarioType;
  params: WhatIfScenarioParams;
  result_summary: WhatIfSimulationResult;
  risk_level: WhatIfRiskLevel;
  created_at: string;
}

export type HealthComponentKey =
  | "cashflow_stability"
  | "savings_ratio"
  | "debt_to_asset_ratio"
  | "installment_burden"
  | "emergency_fund"
  | "budget_discipline"
  | "goal_progress";

export interface HealthScoreComponent {
  key: HealthComponentKey;
  label: string;
  weight: number;
  score: number | null; // 0-100 when available, null when data missing
  available: boolean;
  rawValueLabel: string;
  targetLabel: string;
  explanation: string;
  impact: "positive" | "neutral" | "negative" | "missing";
}

export type HealthScoreGrade =
  | "Prima"
  | "Sehat"
  | "Cukup"
  | "Perlu Perhatian"
  | "Rentan"
  | "Belum Cukup Data";

export interface FinancialHealthScoreResult {
  totalScore: number | null;
  grade: HealthScoreGrade;
  availableWeight: number;
  totalWeight: number;
  isDataIncomplete: boolean;
  missingIndicators: string[];
  components: HealthScoreComponent[];
  boostingFactors: string[];
  draggingFactors: string[];
  recommendations: string[];
  periodMonth: string;
}

export interface FinancialHealthScoreSnapshot {
  id: string;
  owner_id: string;
  period_month: string;
  total_score: number | null;
  grade: HealthScoreGrade;
  available_weight: number;
  is_data_incomplete: boolean;
  components: HealthScoreComponent[];
  created_at: string;
}

export interface AiAdvisorResponse {
  question: string;
  data_aktual: string[];
  data_estimasi: string[];
  hasil_simulasi: string[];
  rekomendasi_ai: string[];
  ringkasan: string;
  peringatan_data: string[];
  model_used: string;
  generated_at: string;
}
