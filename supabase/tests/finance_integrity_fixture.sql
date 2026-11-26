-- Ephemeral PostgreSQL fixture for EGO finance migration integration tests.
-- This schema is deliberately isolated and contains no production data.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.debts (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  creditor text NOT NULL,
  outstanding_balance numeric(14,2) NOT NULL,
  status text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  transaction_type text NOT NULL,
  source_account_id uuid,
  destination_account_id uuid,
  amount numeric(14,2) NOT NULL,
  transaction_date date NOT NULL,
  category text NOT NULL,
  description text,
  status text NOT NULL,
  owner_confirmed boolean NOT NULL
);
CREATE TABLE public.debt_payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  debt_id uuid NOT NULL,
  transaction_id uuid,
  amount numeric(14,2) NOT NULL,
  principal_paid numeric(14,2) NOT NULL,
  interest_paid numeric(14,2) NOT NULL,
  remaining_after numeric(14,2) NOT NULL,
  notes text
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_owner ON public.accounts USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY debts_owner ON public.debts USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY transactions_owner ON public.transactions USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY debt_logs_owner ON public.debt_payment_logs USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accounts, public.debts, public.transactions, public.debt_payment_logs TO authenticated;
INSERT INTO public.accounts (id, owner_id, is_active) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111',false);
INSERT INTO public.debts (id, owner_id, creditor, outstanding_balance, status) VALUES
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','Fixture creditor',100.00,'active'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-2222-4222-8222-222222222222','Other owner',100.00,'active'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','11111111-1111-4111-8111-111111111111','Concurrent test',50.00,'active');
