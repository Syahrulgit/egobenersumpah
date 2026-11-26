-- Isolated PostgreSQL fixture mirroring EGO-PERSONAL columns and key constraints.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
INSERT INTO auth.users (id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('cash','bank','e_wallet','other')),
  opening_balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'IDR',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id)
);
CREATE TABLE public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creditor text NOT NULL,
  description text,
  original_amount numeric NOT NULL CHECK (original_amount >= 0),
  outstanding_balance numeric NOT NULL CHECK (outstanding_balance >= 0),
  due_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paid')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  debt_type text,
  interest_rate numeric,
  installment_amount numeric CHECK (installment_amount >= 0),
  interest_rate_annual numeric NOT NULL DEFAULT 0,
  monthly_fee numeric NOT NULL DEFAULT 0,
  payment_frequency text NOT NULL DEFAULT 'monthly'
);
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('income','expense','transfer')),
  category text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  source_account_id uuid REFERENCES public.accounts(id),
  destination_account_id uuid REFERENCES public.accounts(id),
  description text,
  owner_confirmed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','cancelled')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source_command text,
  created_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id)
);
CREATE TABLE public.debt_payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  debt_id uuid NOT NULL REFERENCES public.debts(id),
  transaction_id uuid REFERENCES public.transactions(id),
  amount numeric NOT NULL CHECK (amount > 0),
  principal_paid numeric NOT NULL DEFAULT 0 CHECK (principal_paid >= 0),
  interest_paid numeric NOT NULL DEFAULT 0 CHECK (interest_paid >= 0),
  remaining_after numeric NOT NULL DEFAULT 0 CHECK (remaining_after >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
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
INSERT INTO public.accounts (id,account_name,account_type,owner_id,is_active) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Owner cash','cash','11111111-1111-4111-8111-111111111111',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Other owner bank','bank','22222222-2222-4222-8222-222222222222',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Inactive account','bank','11111111-1111-4111-8111-111111111111',false);
INSERT INTO public.debts (id,owner_id,creditor,original_amount,outstanding_balance,status) VALUES
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','Fixture creditor',100.00,100.00,'active'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-2222-4222-8222-222222222222','Other owner',100.00,100.00,'active'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','11111111-1111-4111-8111-111111111111','Concurrent test',50.00,50.00,'active');
