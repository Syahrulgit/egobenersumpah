-- ============================================================================
-- EGO PERSONAL AI — EGO COMPLETE FINANCIAL ECOSYSTEM MIGRATION
-- Idempoten & aman dijalankan berulang kali di Supabase SQL Editor.
-- Tidak menghapus tabel, kolom, trigger, kebijakan RLS, atau data yang ada.
-- ============================================================================

-- 1. Enrich public.debts untuk Modul Debt Manager (Metadata Bunga, Biaya & Cicilan)
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

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'debts_debt_type_check'
  ) then
    alter table public.debts
      add constraint debts_debt_type_check
      check (debt_type in ('kpr', 'kendaraan', 'kartu_kredit', 'pinjaman_pribadi', 'paylater', 'usaha', 'lainnya'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'debts_interest_rate_annual_check'
  ) then
    alter table public.debts
      add constraint debts_interest_rate_annual_check
      check (interest_rate_annual >= 0 and interest_rate_annual <= 300);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'debts_monthly_fee_check'
  ) then
    alter table public.debts
      add constraint debts_monthly_fee_check
      check (monthly_fee >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'debts_installment_amount_check'
  ) then
    alter table public.debts
      add constraint debts_installment_amount_check
      check (installment_amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'debts_payment_frequency_check'
  ) then
    alter table public.debts
      add constraint debts_payment_frequency_check
      check (payment_frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'));
  end if;
end $$;

-- 2. Riwayat Pembayaran Utang per Kewajiban (Debt Payment Logs)
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

-- 3. Tabel Simpanan Skenario What-If Simulator (Terpisah Mutlak dari Transaksi Aktual)
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

-- 4. Tabel Riwayat Financial Health Score (0-100)
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
