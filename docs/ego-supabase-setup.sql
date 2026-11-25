-- =====================================================================
-- EGO PERSONAL AI — IDEMPOTENT SUPABASE SETUP SCRIPT
-- Jalankan skrip ini pada Supabase SQL Editor.
-- Prinsip: Single-Owner Guard + Absolute Owner Vault Control + RLS
-- =====================================================================

create extension if not exists pgcrypto;

-- 1. Tabel Akun Keuangan (Kas, Bank, E-Wallet)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_name text not null check (char_length(account_name) between 1 and 80),
  account_type text not null check (account_type in ('cash', 'bank', 'ewallet')),
  opening_balance numeric(18,2) not null default 0,
  currency text not null default 'IDR',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Tabel Transaksi (Mutasi Kas Terkontrol)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('income', 'expense', 'transfer')),
  source_account_id uuid references public.accounts(id),
  destination_account_id uuid references public.accounts(id),
  amount numeric(18,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  category text,
  description text,
  status text not null default 'pending' check (status in ('posted', 'pending', 'cancelled')),
  owner_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ego_posted_requires_confirmation check (status <> 'posted' or owner_confirmed = true),
  constraint ego_income_requires_dest check (transaction_type <> 'income' or destination_account_id is not null),
  constraint ego_expense_requires_source check (transaction_type <> 'expense' or source_account_id is not null),
  constraint ego_transfer_accounts check (
    transaction_type <> 'transfer' or (
      source_account_id is not null
      and destination_account_id is not null
      and source_account_id <> destination_account_id
    )
  )
);

create index if not exists transactions_owner_date_idx
  on public.transactions (owner_id, transaction_date desc);

-- 3. Tabel Aset Fisik & Investasi
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  asset_name text not null check (char_length(asset_name) between 1 and 120),
  asset_type text not null default 'lainnya' check (asset_type in ('emas', 'properti', 'kendaraan', 'investasi', 'elektronik', 'lainnya')),
  current_value numeric(18,2) not null default 0 check (current_value >= 0),
  quantity numeric(18,4),
  unit text,
  notes text,
  created_at timestamptz not null default now()
);

-- 4. Tabel Utang & Kewajiban
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creditor text not null check (char_length(creditor) between 1 and 120),
  original_amount numeric(18,2) not null check (original_amount > 0),
  outstanding_balance numeric(18,2) not null check (outstanding_balance >= 0),
  due_date date,
  status text not null default 'active' check (status in ('active', 'paid')),
  description text,
  created_at timestamptz not null default now()
);

-- 5. Tabel Antrean Perintah Owner AI
create table if not exists public.owner_commands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  command_text text not null check (char_length(command_text) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'processed', 'rejected')),
  parsed_draft jsonb,
  created_at timestamptz not null default now()
);

-- 6. View Saldo Akun Riil (Security Invoker)
drop view if exists public.account_balances;
create view public.account_balances
with (security_invoker = true)
as
select
  a.id,
  a.owner_id,
  a.account_name,
  a.account_type,
  a.opening_balance,
  a.currency,
  a.is_active,
  a.created_at,
  (
    a.opening_balance
    + coalesce((
      select sum(t.amount)
      from public.transactions t
      where t.destination_account_id = a.id
        and t.status = 'posted'
        and t.owner_confirmed = true
    ), 0)
    - coalesce((
      select sum(t.amount)
      from public.transactions t
      where t.source_account_id = a.id
        and t.status = 'posted'
        and t.owner_confirmed = true
    ), 0)
  )::numeric(18,2) as current_balance
from public.accounts a;

-- 7. Row Level Security (RLS)
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.assets enable row level security;
alter table public.debts enable row level security;
alter table public.owner_commands enable row level security;

drop policy if exists ego_accounts_owner_all on public.accounts;
create policy ego_accounts_owner_all on public.accounts
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists ego_transactions_owner_all on public.transactions;
create policy ego_transactions_owner_all on public.transactions
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists ego_assets_owner_all on public.assets;
create policy ego_assets_owner_all on public.assets
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists ego_debts_owner_all on public.debts;
create policy ego_debts_owner_all on public.debts
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists ego_commands_owner_all on public.owner_commands;
create policy ego_commands_owner_all on public.owner_commands
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 8. Trigger Validasi Integritas Akun Transaksi
create or replace function public.ego_check_tx_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  src_owner uuid;
  dst_owner uuid;
begin
  if new.source_account_id is not null then
    select owner_id into src_owner from public.accounts where id = new.source_account_id;
    if src_owner is null or src_owner <> new.owner_id then
      raise exception 'Akun sumber tidak valid atau bukan milik Owner.';
    end if;
  end if;

  if new.destination_account_id is not null then
    select owner_id into dst_owner from public.accounts where id = new.destination_account_id;
    if dst_owner is null or dst_owner <> new.owner_id then
      raise exception 'Akun tujuan tidak valid atau bukan milik Owner.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ego_check_tx_accounts on public.transactions;
create trigger trg_ego_check_tx_accounts
  before insert or update on public.transactions
  for each row execute function public.ego_check_tx_accounts();

-- 9. Trigger Proteksi Single-Owner pada auth.users
create or replace function public.ego_single_owner_guard()
returns trigger
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  existing_count integer;
begin
  select count(*) into existing_count from auth.users;
  if existing_count >= 1 then
    raise exception 'Sistem Single-Owner: Akun Owner sudah terdaftar. Pendaftaran kedua ditolak.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ego_single_owner_guard on auth.users;
create trigger trg_ego_single_owner_guard
  before insert on auth.users
  for each row execute function public.ego_single_owner_guard();

-- 10. Tabel Tagihan & Pemasukan Rutin (Recurring)
create table if not exists public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  amount numeric(18,2) not null check (amount > 0),
  category text not null default 'Utilitas & Tagihan',
  account_id uuid references public.accounts(id) on delete set null,
  frequency text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'yearly')),
  next_due_date date not null,
  is_active boolean not null default true,
  notes text,
  last_queued_date date,
  created_at timestamptz not null default now()
);

alter table public.recurring_bills enable row level security;

drop policy if exists ego_recurring_owner_all on public.recurring_bills;
create policy ego_recurring_owner_all on public.recurring_bills
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 11. Tabel Target Tabungan & Dana Darurat (Financial Goals)
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  goal_type text not null default 'savings_target' check (goal_type in ('emergency_fund', 'savings_target')),
  target_amount numeric(18,2) not null check (target_amount > 0),
  current_amount numeric(18,2) not null default 0 check (current_amount >= 0),
  target_date date,
  linked_account_id uuid references public.accounts(id) on delete set null,
  notes text,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now()
);

alter table public.savings_goals enable row level security;

drop policy if exists ego_goals_owner_all on public.savings_goals;
create policy ego_goals_owner_all on public.savings_goals
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 12. Tabel Pengingat Keuangan (Financial Reminders)
create table if not exists public.financial_reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  reminder_type text not null check (
    reminder_type in (
      'tagihan_bulanan',
      'cicilan_utang',
      'jatuh_tempo',
      'tanggal_gajian',
      'setoran_tabungan',
      'target_keuangan',
      'pemasukan_rutin'
    )
  ),
  transaction_type text not null default 'expense' check (transaction_type in ('income', 'expense', 'transfer')),
  amount numeric(18,2) not null default 0 check (amount >= 0),
  due_date date not null,
  reminder_time text not null default '08:00' check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  frequency text not null default 'monthly' check (frequency in ('once', 'weekly', 'monthly', 'yearly')),
  remind_offsets integer[] not null default array[7, 3, 1, 0],
  custom_days_before integer check (custom_days_before is null or (custom_days_before >= 0 and custom_days_before <= 90)),
  is_active boolean not null default true,
  is_read boolean not null default false,
  read_at timestamptz,
  last_notified_key text,
  last_notified_at timestamptz,
  linked_account_id uuid references public.accounts(id) on delete set null,
  linked_goal_id uuid references public.savings_goals(id) on delete set null,
  linked_debt_id uuid references public.debts(id) on delete set null,
  linked_bill_id uuid references public.recurring_bills(id) on delete set null,
  dedupe_key text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_reminders_owner_due_idx
  on public.financial_reminders (owner_id, is_active, due_date asc);

create unique index if not exists financial_reminders_owner_dedupe_uidx
  on public.financial_reminders (owner_id, dedupe_key)
  where dedupe_key is not null;

alter table public.financial_reminders enable row level security;

drop policy if exists ego_financial_reminders_owner_all on public.financial_reminders;
create policy ego_financial_reminders_owner_all on public.financial_reminders
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create or replace function public.ego_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ego_financial_reminders_updated_at on public.financial_reminders;
create trigger trg_ego_financial_reminders_updated_at
  before update on public.financial_reminders
  for each row execute function public.ego_touch_updated_at();

-- 13. Tabel Riwayat Pengingat (Financial Reminder Logs)
create table if not exists public.financial_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reminder_id uuid references public.financial_reminders(id) on delete set null,
  reminder_title text not null check (char_length(reminder_title) between 1 and 140),
  event_type text not null check (
    event_type in ('triggered', 'read', 'draft_queued', 'rescheduled', 'paused', 'resumed')
  ),
  trigger_offset integer,
  scheduled_for date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists financial_reminder_logs_owner_created_idx
  on public.financial_reminder_logs (owner_id, created_at desc);

alter table public.financial_reminder_logs enable row level security;

drop policy if exists ego_financial_reminder_logs_owner_all on public.financial_reminder_logs;
create policy ego_financial_reminder_logs_owner_all on public.financial_reminder_logs
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 14. Tabel Anggaran Bulanan per Kategori (Smart Budget Monitor)
create table if not exists public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null check (char_length(trim(category)) between 1 and 80),
  period_month text not null check (period_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  limit_amount numeric(18,2) not null check (limit_amount > 0),
  is_active boolean not null default true,
  last_alert_threshold integer check (last_alert_threshold is null or last_alert_threshold in (50, 75, 90, 100, 101)),
  last_alert_period text check (last_alert_period is null or last_alert_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists category_budgets_owner_period_cat_uidx
  on public.category_budgets (owner_id, period_month, lower(trim(category)));

create index if not exists category_budgets_owner_period_idx
  on public.category_budgets (owner_id, period_month desc, is_active);

alter table public.category_budgets enable row level security;

drop policy if exists ego_category_budgets_owner_all on public.category_budgets;
create policy ego_category_budgets_owner_all on public.category_budgets
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop trigger if exists trg_ego_category_budgets_updated_at on public.category_budgets;
create trigger trg_ego_category_budgets_updated_at
  before update on public.category_budgets
  for each row execute function public.ego_touch_updated_at();

-- 15. Tabel Riwayat & Peringatan Anggaran (Anti-Duplikat Ambang per Periode)
create table if not exists public.budget_alert_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  budget_id uuid references public.category_budgets(id) on delete set null,
  category text not null check (char_length(trim(category)) between 1 and 80),
  period_month text not null check (period_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  threshold_level integer not null check (threshold_level in (0, 50, 75, 90, 100, 101)),
  spent_amount numeric(18,2) not null default 0 check (spent_amount >= 0),
  limit_amount numeric(18,2) not null check (limit_amount > 0),
  usage_pct numeric(8,2) not null default 0 check (usage_pct >= 0),
  event_type text not null default 'threshold_crossed' check (
    event_type in ('threshold_crossed', 'created', 'updated', 'paused', 'resumed')
  ),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists budget_alert_logs_owner_period_idx
  on public.budget_alert_logs (owner_id, period_month desc, created_at desc);

create unique index if not exists budget_alert_logs_dedupe_uidx
  on public.budget_alert_logs (owner_id, budget_id, period_month, threshold_level)
  where event_type = 'threshold_crossed' and budget_id is not null;

alter table public.budget_alert_logs enable row level security;

drop policy if exists ego_budget_alert_logs_owner_all on public.budget_alert_logs;
create policy ego_budget_alert_logs_owner_all on public.budget_alert_logs
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 16. Enrich public.debts untuk Modul Debt Manager
alter table public.debts
  add column if not exists debt_type text not null default 'lainnya';
alter table public.debts
  add column if not exists interest_rate_annual numeric(6,3) not null default 0;
alter table public.debts
  add column if not exists monthly_fee numeric(18,2) not null default 0;
alter table public.debts
  add column if not exists installment_amount numeric(18,2) not null default 0;
alter table public.debts
  add column if not exists payment_frequency text not null default 'monthly';

-- 17. Tabel Riwayat Pembayaran Utang (Debt Payment Logs)
create table if not exists public.debt_payment_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  amount numeric(18,2) not null check (amount > 0),
  principal_paid numeric(18,2) not null default 0 check (principal_paid >= 0),
  interest_paid numeric(18,2) not null default 0 check (interest_paid >= 0),
  remaining_after numeric(18,2) not null default 0 check (remaining_after >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists debt_payment_logs_owner_debt_idx
  on public.debt_payment_logs (owner_id, debt_id, created_at desc);

alter table public.debt_payment_logs enable row level security;

drop policy if exists ego_debt_payment_logs_owner_all on public.debt_payment_logs;
create policy ego_debt_payment_logs_owner_all on public.debt_payment_logs
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 18. Tabel Skenario What-If Simulator
create table if not exists public.whatif_scenarios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 140),
  scenario_type text not null check (
    scenario_type in (
      'cash_purchase',
      'installment_purchase',
      'new_loan',
      'accelerated_debt_payoff',
      'income_change',
      'living_cost_change',
      'savings_boost',
      'goal_milestone'
    )
  ),
  params jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  risk_level text not null default 'aman' check (risk_level in ('aman', 'waspada', 'berisiko')),
  created_at timestamptz not null default now()
);

create index if not exists whatif_scenarios_owner_created_idx
  on public.whatif_scenarios (owner_id, created_at desc);

alter table public.whatif_scenarios enable row level security;

drop policy if exists ego_whatif_scenarios_owner_all on public.whatif_scenarios;
create policy ego_whatif_scenarios_owner_all on public.whatif_scenarios
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 19. Tabel Riwayat Financial Health Score
create table if not exists public.financial_health_scores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_month text not null check (period_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  total_score integer check (total_score is null or (total_score >= 0 and total_score <= 100)),
  grade text not null check (
    grade in ('Prima', 'Sehat', 'Cukup', 'Perlu Perhatian', 'Rentan', 'Belum Cukup Data')
  ),
  available_weight integer not null default 0 check (available_weight >= 0 and available_weight <= 100),
  is_data_incomplete boolean not null default false,
  components jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists financial_health_scores_owner_created_idx
  on public.financial_health_scores (owner_id, created_at desc);

alter table public.financial_health_scores enable row level security;

drop policy if exists ego_financial_health_scores_owner_all on public.financial_health_scores;
create policy ego_financial_health_scores_owner_all on public.financial_health_scores
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
