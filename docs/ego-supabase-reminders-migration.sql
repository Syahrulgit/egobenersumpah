-- =====================================================================
-- EGO PERSONAL AI — FINANCIAL REMINDERS MIGRATION (IDEMPOTENT)
-- Jalankan skrip ini pada Supabase SQL Editor.
-- Prinsip: Mempertahankan seluruh tabel, RLS, trigger, & data lama.
-- =====================================================================

-- 1. Tabel Pengingat Keuangan (Financial Reminders)
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

-- Trigger updated_at otomatis
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

-- 2. Tabel Riwayat Pengingat (Financial Reminder Logs)
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
