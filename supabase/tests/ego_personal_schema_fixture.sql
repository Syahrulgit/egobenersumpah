-- Disposable PostgreSQL fixture matching the EGO-PERSONAL core finance schema.
-- Synthetic IDs only. Never point this fixture at a production database.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'ego_postgrest_test_only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres NOLOGIN;
  END IF;
END
$roles$;

GRANT anon, authenticated TO authenticator;

CREATE TABLE auth.users (id uuid PRIMARY KEY);
INSERT INTO auth.users (id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $function$
  SELECT COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', TRUE), '')::uuid,
    (NULLIF(pg_catalog.current_setting('request.jwt.claims', TRUE), '')::jsonb ->> 'sub')::uuid
  )
$function$;

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('cash','bank','e_wallet','other')),
  opening_balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'IDR',
  is_active boolean NOT NULL DEFAULT TRUE,
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
  owner_confirmed boolean NOT NULL DEFAULT FALSE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','cancelled')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source_command text,
  created_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  CONSTRAINT transactions_posted_requires_owner_confirmation
    CHECK (status <> 'posted' OR owner_confirmed IS TRUE),
  CONSTRAINT transactions_account_shape CHECK (
    (transaction_type = 'income' AND source_account_id IS NULL AND destination_account_id IS NOT NULL)
    OR (transaction_type = 'expense' AND source_account_id IS NOT NULL AND destination_account_id IS NULL)
    OR (transaction_type = 'transfer' AND source_account_id IS NOT NULL
      AND destination_account_id IS NOT NULL AND source_account_id <> destination_account_id)
  )
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
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid
);
CREATE UNIQUE INDEX debt_payment_logs_owner_request_id_uidx
  ON public.debt_payment_logs(owner_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE TABLE public.owner_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_text text NOT NULL,
  command_type text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','rejected')),
  owner_confirmed boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  parsed_draft jsonb
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_owner ON public.accounts
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY debts_owner ON public.debts
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY transactions_owner ON public.transactions
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY debt_logs_owner ON public.debt_payment_logs
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY owner_commands_owner ON public.owner_commands
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accounts, public.debts, public.transactions,
  public.debt_payment_logs, public.owner_commands TO authenticated;
GRANT DELETE ON public.debt_payment_logs TO authenticated;

-- Model the live PERSONAL column-only grants separately from table grants.
REVOKE INSERT, UPDATE ON TABLE public.transactions, public.debt_payment_logs,
  public.owner_commands FROM authenticated;
GRANT INSERT (id, transaction_date, transaction_type, category, amount,
  source_account_id, destination_account_id, description, owner_confirmed,
  status, recorded_at, source_command, created_at, owner_id),
  UPDATE (id, transaction_date, transaction_type, category, amount,
  source_account_id, destination_account_id, description, owner_confirmed,
  status, recorded_at, source_command, created_at, owner_id)
ON TABLE public.transactions TO authenticated;
GRANT INSERT (id, owner_id, debt_id, transaction_id, amount, principal_paid,
  interest_paid, remaining_after, notes, created_at, request_id),
  UPDATE (id, owner_id, debt_id, transaction_id, amount, principal_paid,
  interest_paid, remaining_after, notes, created_at, request_id)
ON TABLE public.debt_payment_logs TO authenticated;
GRANT INSERT (id, command_text, command_type, status, owner_confirmed,
  created_at, processed_at, owner_id, parsed_draft),
  UPDATE (id, command_text, command_type, status, owner_confirmed,
  created_at, processed_at, owner_id, parsed_draft)
ON TABLE public.owner_commands TO authenticated;

-- Seed the known over-broad Supabase default ACLs so the candidate must remove them.
GRANT TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT TRUNCATE, TRIGGER, REFERENCES ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT TRUNCATE, TRIGGER, REFERENCES ON TABLES TO anon, authenticated;
CREATE TABLE public.security_privilege_probe (id integer PRIMARY KEY);
GRANT TRUNCATE, TRIGGER, REFERENCES ON public.security_privilege_probe TO anon, authenticated;

INSERT INTO public.accounts (id, account_name, account_type, owner_id, is_active) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Owner cash','cash','11111111-1111-4111-8111-111111111111',TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Owner bank','bank','11111111-1111-4111-8111-111111111111',TRUE),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Other owner bank','bank','22222222-2222-4222-8222-222222222222',TRUE),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Inactive account','bank','11111111-1111-4111-8111-111111111111',FALSE);

INSERT INTO public.debts (id, owner_id, creditor, original_amount, outstanding_balance, status) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111','Test creditor',100.00,100.00,'active'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff','11111111-1111-4111-8111-111111111111','Concurrent creditor',50.00,50.00,'active'),
  ('99999999-9999-4999-8999-999999999999','22222222-2222-4222-8222-222222222222','Other owner debt',100.00,100.00,'active');

INSERT INTO public.owner_commands (id, owner_id, command_text, status, parsed_draft) VALUES
  ('12121212-1212-4121-8121-121212121212','11111111-1111-4111-8111-111111111111',
   'Tes persetujuan perintah', 'pending',
   '{"transaction_type":"expense","amount":5,"source_account_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","destination_account_id":null,"transaction_date":"2026-11-26","category":"Tes","description":"Draf uji"}'),
  ('13131313-1313-4131-8131-131313131313','11111111-1111-4111-8111-111111111111',
   'Perintah sudah ditolak', 'rejected', NULL),
  ('14141414-1414-4141-8141-141414141414','11111111-1111-4111-8111-111111111111',
   'Perintah untuk uji penolakan', 'pending', NULL);

INSERT INTO public.owner_commands (id, owner_id, command_text, status, parsed_draft) VALUES
  ('15151515-1515-4151-8151-151515151515','22222222-2222-4222-8222-222222222222',
   'Perintah privat Owner kedua', 'pending', NULL);
