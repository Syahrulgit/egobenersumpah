-- EGO storage schema v2.1: tighten ledger invariants and remove redundant policies.
-- Test project only. No rows are rewritten or removed.
begin;

-- Remove the baseline policies that would otherwise overlap the consolidated owner_isolation policy.
drop policy if exists owner_accounts_access on public.accounts;
drop policy if exists owner_assets_access on public.assets;
drop policy if exists owner_debts_access on public.debts;
drop policy if exists owner_commands_insert on public.owner_commands;
drop policy if exists owner_commands_select on public.owner_commands;
drop policy if exists owner_commands_update on public.owner_commands;
drop policy if exists owner_transactions_insert on public.transactions;
drop policy if exists owner_transactions_select on public.transactions;
drop policy if exists owner_transactions_update on public.transactions;

-- Enforce the application's core transaction rules even if a future API route forgets validation.
alter table public.transactions
  add constraint transactions_posted_requires_owner_confirmation
  check (status <> 'posted' or owner_confirmed = true);
alter table public.transactions
  add constraint transactions_account_shape_check
  check (
    (transaction_type = 'income' and source_account_id is null and destination_account_id is not null)
    or
    (transaction_type = 'expense' and source_account_id is not null and destination_account_id is null)
    or
    (transaction_type = 'transfer' and source_account_id is not null
      and destination_account_id is not null and source_account_id <> destination_account_id)
  );

-- Index the referencing columns in the exact order used by composite foreign keys.
create index if not exists idx_transactions_source_owner
  on public.transactions(source_account_id, owner_id);
create index if not exists idx_transactions_destination_owner
  on public.transactions(destination_account_id, owner_id);
create index if not exists idx_debt_payment_logs_debt_owner
  on public.debt_payment_logs(debt_id, owner_id);
create index if not exists idx_debt_payment_logs_transaction_owner
  on public.debt_payment_logs(transaction_id, owner_id);
create index if not exists idx_recurring_bills_account_owner
  on public.recurring_bills(account_id, owner_id);
create index if not exists idx_savings_goals_account_owner
  on public.savings_goals(linked_account_id, owner_id);
create index if not exists idx_financial_reminders_account_owner
  on public.financial_reminders(linked_account_id, owner_id);
create index if not exists idx_financial_reminders_goal_owner
  on public.financial_reminders(linked_goal_id, owner_id);
create index if not exists idx_financial_reminders_debt_owner
  on public.financial_reminders(linked_debt_id, owner_id);
create index if not exists idx_financial_reminders_bill_owner
  on public.financial_reminders(linked_bill_id, owner_id);
create index if not exists idx_financial_reminder_logs_reminder_owner
  on public.financial_reminder_logs(reminder_id, owner_id);
create index if not exists idx_budget_alert_logs_budget_owner
  on public.budget_alert_logs(budget_id, owner_id);

commit;
