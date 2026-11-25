-- =====================================================================
-- EGO PERSONAL AI — MIGRASI SMART BUDGET MONITOR (IDEMPOTENT)
-- Jalankan skrip ini pada Supabase SQL Editor.
-- Tidak mengubah atau menghapus tabel/kolom/RLS/trigger yang sudah ada.
-- =====================================================================

create extension if not exists pgcrypto;

-- Pastikan fungsi updated_at tersedia
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

-- 1. Tabel Anggaran Bulanan per Kategori
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

-- 2. Tabel Riwayat & Peringatan Anggaran (Anti-Duplikat Ambang per Periode)
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
