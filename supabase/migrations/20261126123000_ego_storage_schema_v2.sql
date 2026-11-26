-- EGO storage schema v2 (additive, test-project rehearsal only).
-- Does not copy, delete, or transform any Owner records.
-- Existing rows are preserved; this migration is designed for the empty EGO-TEST project.

begin;

-- Align legacy base tables with the current application model while retaining legacy enum values.
alter table public.accounts drop constraint if exists accounts_account_type_check;
alter table public.accounts add constraint accounts_account_type_check
  check (account_type in ('cash','bank','ewallet','e_wallet','other'));

alter table public.transactions alter column category drop not null;
alter table public.transactions add column if not exists idempotency_key text;
create unique index if not exists uq_transactions_owner_idempotency
  on public.transactions(owner_id, idempotency_key)
  where idempotency_key is not null;

alter table public.assets add column if not exists unit text;

alter table public.debts add column if not exists debt_type text;
alter table public.debts add column if not exists interest_rate_annual numeric;
alter table public.debts add column if not exists monthly_fee numeric;
alter table public.debts add column if not exists installment_amount numeric;
alter table public.debts add column if not exists payment_frequency text;
alter table public.debts drop constraint if exists debts_status_check;
alter table public.debts add constraint debts_status_check
  check (status in ('active','paid','unpaid','partial'));
alter table public.debts alter column status set default 'active';
alter table public.debts add constraint debts_debt_type_check
  check (debt_type is null or debt_type in ('kpr','kendaraan','kartu_kredit','pinjaman_pribadi','paylater','usaha','lainnya'));
alter table public.debts add constraint debts_payment_frequency_check
  check (payment_frequency is null or payment_frequency in ('weekly','biweekly','monthly','quarterly','yearly'));

alter table public.owner_commands add column if not exists parsed_draft jsonb;
alter table public.owner_commands drop constraint if exists owner_commands_status_check;
alter table public.owner_commands add constraint owner_commands_status_check
  check (status in ('pending','processed','approved','executed','rejected'));

-- Composite unique keys make owner-aware foreign keys possible (not merely ID-only references).
create unique index if not exists uq_accounts_id_owner on public.accounts(id, owner_id);
create unique index if not exists uq_debts_id_owner on public.debts(id, owner_id);

-- Complete the app's persisted collections.
create table if not exists public.owner_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  date_format text not null default 'DD MMM YYYY'
    check (date_format in ('DD/MM/YYYY','YYYY-MM-DD','DD MMM YYYY')),
  expense_alert_limit numeric not null default 5000000
    check (expense_alert_limit >= 0),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_transactions_id_owner on public.transactions(id, owner_id);

create table if not exists public.debt_payment_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null,
  transaction_id uuid,
  request_id text,
  amount numeric not null check (amount > 0),
  principal_paid numeric not null default 0 check (principal_paid >= 0),
  interest_paid numeric not null default 0 check (interest_paid >= 0),
  remaining_after numeric not null check (remaining_after >= 0),
  notes text,
  created_at timestamptz not null default now(),
  constraint debt_payment_logs_debt_owner_fkey
    foreign key (debt_id, owner_id) references public.debts(id, owner_id),
  constraint debt_payment_logs_transaction_owner_fkey
    foreign key (transaction_id, owner_id) references public.transactions(id, owner_id)
);
create unique index if not exists uq_debt_payment_request
  on public.debt_payment_logs(owner_id, request_id) where request_id is not null;

create table if not exists public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  transaction_type text not null check (transaction_type in ('income','expense')),
  amount numeric not null check (amount > 0),
  category text not null,
  account_id uuid,
  frequency text not null check (frequency in ('weekly','monthly','yearly')),
  next_due_date date not null,
  is_active boolean not null default true,
  notes text,
  last_queued_date date,
  created_at timestamptz not null default now(),
  constraint recurring_bills_account_owner_fkey
    foreign key (account_id, owner_id) references public.accounts(id, owner_id)
);

create unique index if not exists uq_recurring_bills_id_owner on public.recurring_bills(id, owner_id);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  goal_type text not null check (goal_type in ('emergency_fund','savings_target')),
  target_amount numeric not null check (target_amount >= 0),
  current_amount numeric not null default 0 check (current_amount >= 0),
  target_date date,
  linked_account_id uuid,
  notes text,
  status text not null default 'active' check (status in ('active','completed')),
  created_at timestamptz not null default now(),
  constraint savings_goals_account_owner_fkey
    foreign key (linked_account_id, owner_id) references public.accounts(id, owner_id)
);
create unique index if not exists uq_savings_goals_id_owner on public.savings_goals(id, owner_id);

create table if not exists public.financial_reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  reminder_type text not null check (reminder_type in ('tagihan_bulanan','cicilan_utang','jatuh_tempo','tanggal_gajian','setoran_tabungan','target_keuangan','pemasukan_rutin')),
  transaction_type text not null check (transaction_type in ('income','expense','transfer')),
  amount numeric not null check (amount >= 0),
  due_date date not null,
  reminder_time time not null,
  frequency text not null check (frequency in ('once','weekly','monthly','yearly')),
  remind_offsets integer[] not null default array[]::integer[],
  custom_days_before integer,
  is_active boolean not null default true,
  is_read boolean not null default false,
  read_at timestamptz,
  last_notified_key text,
  last_notified_at timestamptz,
  linked_account_id uuid,
  linked_goal_id uuid,
  linked_debt_id uuid,
  linked_bill_id uuid,
  dedupe_key text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminders_account_owner_fkey
    foreign key (linked_account_id, owner_id) references public.accounts(id, owner_id),
  constraint reminders_goal_owner_fkey
    foreign key (linked_goal_id, owner_id) references public.savings_goals(id, owner_id),
  constraint reminders_debt_owner_fkey
    foreign key (linked_debt_id, owner_id) references public.debts(id, owner_id),
  constraint reminders_bill_owner_fkey
    foreign key (linked_bill_id, owner_id) references public.recurring_bills(id, owner_id)
);
create unique index if not exists uq_financial_reminders_dedupe
  on public.financial_reminders(owner_id, dedupe_key) where dedupe_key is not null;

create unique index if not exists uq_financial_reminders_id_owner on public.financial_reminders(id, owner_id);

create table if not exists public.financial_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reminder_id uuid,
  reminder_title text not null,
  event_type text not null check (event_type in ('triggered','read','draft_queued','rescheduled','paused','resumed')),
  trigger_offset integer,
  scheduled_for timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint reminder_logs_reminder_owner_fkey
    foreign key (reminder_id, owner_id) references public.financial_reminders(id, owner_id)
);

create table if not exists public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  period_month text not null check (period_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  limit_amount numeric not null check (limit_amount > 0),
  is_active boolean not null default true,
  last_alert_threshold integer check (last_alert_threshold is null or last_alert_threshold in (50,75,90,100,101)),
  last_alert_period text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint category_budgets_owner_period_category_key unique(owner_id, period_month, category)
);

create unique index if not exists uq_category_budgets_id_owner on public.category_budgets(id, owner_id);

create table if not exists public.budget_alert_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  budget_id uuid,
  category text not null,
  period_month text not null check (period_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  threshold_level integer not null check (threshold_level in (0,50,75,90,100,101)),
  spent_amount numeric not null default 0 check (spent_amount >= 0),
  limit_amount numeric not null check (limit_amount >= 0),
  usage_pct numeric not null default 0 check (usage_pct >= 0),
  event_type text not null check (event_type in ('threshold_crossed','created','updated','paused','resumed')),
  notes text,
  created_at timestamptz not null default now(),
  constraint budget_alert_logs_budget_owner_fkey
    foreign key (budget_id, owner_id) references public.category_budgets(id, owner_id)
);
create unique index if not exists uq_category_budgets_id_owner on public.category_budgets(id, owner_id);

create table if not exists public.whatif_scenarios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  scenario_type text not null check (scenario_type in ('cash_purchase','installment_purchase','new_loan','accelerated_debt_payoff','income_change','living_cost_change','savings_boost','goal_milestone')),
  params jsonb not null,
  result_summary jsonb not null,
  risk_level text not null check (risk_level in ('aman','waspada','berisiko')),
  created_at timestamptz not null default now()
);

create table if not exists public.financial_health_scores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  period_month text not null check (period_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  total_score numeric check (total_score is null or total_score between 0 and 100),
  grade text not null check (grade in ('Prima','Sehat','Cukup','Perlu Perhatian','Rentan','Belum Cukup Data')),
  available_weight numeric not null default 0 check (available_weight between 0 and 100),
  is_data_incomplete boolean not null default true,
  components jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Owner-aware composite references for the existing ledger.
alter table public.transactions
  add constraint transactions_source_account_owner_fkey
  foreign key (source_account_id, owner_id) references public.accounts(id, owner_id);
alter table public.transactions
  add constraint transactions_destination_account_owner_fkey
  foreign key (destination_account_id, owner_id) references public.accounts(id, owner_id);

-- Enable RLS and apply one consistent owner policy to every persisted owner table.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'accounts','transactions','assets','debts','owner_commands','owner_preferences',
    'debt_payment_logs','recurring_bills','savings_goals','financial_reminders',
    'financial_reminder_logs','category_budgets','budget_alert_logs',
    'whatif_scenarios','financial_health_scores'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists owner_isolation on public.%I', tbl);
    execute format(
      'create policy owner_isolation on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      tbl
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
  end loop;
end $$;

-- Cover all FK lookup paths; also useful for owner-scoped queries.
create index if not exists idx_transactions_source_account on public.transactions(source_account_id);
create index if not exists idx_transactions_destination_account on public.transactions(destination_account_id);
create index if not exists idx_debt_payment_logs_owner_debt on public.debt_payment_logs(owner_id, debt_id, created_at desc);
create index if not exists idx_recurring_bills_owner_due on public.recurring_bills(owner_id, next_due_date) where is_active;
create index if not exists idx_savings_goals_owner on public.savings_goals(owner_id);
create index if not exists idx_financial_reminders_owner_due on public.financial_reminders(owner_id, due_date) where is_active;
create index if not exists idx_financial_reminder_logs_owner_created on public.financial_reminder_logs(owner_id, created_at desc);
create index if not exists idx_category_budgets_owner_period on public.category_budgets(owner_id, period_month);
create index if not exists idx_budget_alert_logs_owner_created on public.budget_alert_logs(owner_id, created_at desc);
create index if not exists idx_whatif_scenarios_owner_created on public.whatif_scenarios(owner_id, created_at desc);
create index if not exists idx_financial_health_scores_owner_period on public.financial_health_scores(owner_id, period_month);

commit;
