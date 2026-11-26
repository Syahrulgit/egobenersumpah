-- EGO-PERSONAL RPC alignment candidate.
-- Target: teudnrqmadbrxpguoqug only.
-- REVIEW ONLY: do not apply until Owner approves the exact SQL and recovery plan.
-- This candidate matches EGO-PERSONAL schema: transactions has no idempotency_key;
-- debt_payment_logs.request_id is UUID; owner_commands states are pending/processed/rejected.
--
-- Security boundary:
--   * authenticated may SELECT transactions and debt_payment_logs.
--   * ledger writes are restricted to these narrowly-scoped SECURITY DEFINER RPCs.
--   * every RPC derives the owner from auth.uid(), never from client owner_id.
--   * fixed empty search_path; all application objects are schema-qualified.
--
-- IMPORTANT: apply only as the database migration owner (normally postgres), after
-- validating on the isolated EGO-PERSONAL fixture. No production data is rewritten.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_confirmed_transaction(
  p_id uuid,
  p_transaction_type text,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_transaction_date date,
  p_category text,
  p_description text,
  p_owner_confirmed boolean
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_existing public.transactions%ROWTYPE;
  -- Match transactions.amount numeric(15,2) before idempotency checks.
  v_amount numeric(15,2);
  v_category text := COALESCE(NULLIF(pg_catalog.btrim(p_category), ''), 'Lainnya');
  v_description text := NULLIF(pg_catalog.btrim(p_description), '');
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Autentikasi Owner diperlukan.' USING ERRCODE = '28000';
  END IF;
  IF p_owner_confirmed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Persetujuan eksplisit Owner wajib sebelum transaksi diposting.' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL OR p_amount IS NULL OR p_amount <= 0 OR p_transaction_date IS NULL THEN
    RAISE EXCEPTION 'Data transaksi tidak valid.' USING ERRCODE = '22023';
  END IF;
  v_amount := pg_catalog.round(p_amount, 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal transaksi harus minimal 0,01.' USING ERRCODE = '22023';
  END IF;
  IF p_transaction_type IS NULL OR p_transaction_type NOT IN ('income', 'expense', 'transfer') THEN
    RAISE EXCEPTION 'Jenis transaksi tidak valid.' USING ERRCODE = '22023';
  END IF;

  IF NOT (
    (p_transaction_type = 'income' AND p_source_account_id IS NULL AND p_destination_account_id IS NOT NULL)
    OR (p_transaction_type = 'expense' AND p_source_account_id IS NOT NULL AND p_destination_account_id IS NULL)
    OR (p_transaction_type = 'transfer' AND p_source_account_id IS NOT NULL
      AND p_destination_account_id IS NOT NULL AND p_source_account_id <> p_destination_account_id)
  ) THEN
    RAISE EXCEPTION 'Pasangan akun transaksi tidak valid.' USING ERRCODE = '22023';
  END IF;

  -- Same Owner + same transaction UUID is serialized so concurrent retries
  -- cannot both create a ledger row.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || p_id::text, 0)
  );

  IF p_source_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.accounts AS a
    WHERE a.id = p_source_account_id AND a.owner_id = v_owner AND a.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Akun sumber tidak ditemukan, bukan milik Owner, atau tidak aktif.' USING ERRCODE = '22023';
  END IF;
  IF p_destination_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.accounts AS a
    WHERE a.id = p_destination_account_id AND a.owner_id = v_owner AND a.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Akun tujuan tidak ditemukan, bukan milik Owner, atau tidak aktif.' USING ERRCODE = '22023';
  END IF;

  SELECT t.* INTO v_existing
  FROM public.transactions AS t
  WHERE t.id = p_id AND t.owner_id = v_owner
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.transaction_type = p_transaction_type
      AND v_existing.source_account_id IS NOT DISTINCT FROM p_source_account_id
      AND v_existing.destination_account_id IS NOT DISTINCT FROM p_destination_account_id
      AND v_existing.amount = v_amount
      AND v_existing.transaction_date = p_transaction_date
      AND v_existing.category = v_category
      AND v_existing.description IS NOT DISTINCT FROM v_description
      AND v_existing.status = 'posted'
      AND v_existing.owner_confirmed IS TRUE THEN
      RETURN v_existing;
    END IF;
    RAISE EXCEPTION 'ID transaksi sudah digunakan untuk data berbeda.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.transactions (
    id, owner_id, transaction_type, source_account_id, destination_account_id,
    amount, transaction_date, category, description, status, owner_confirmed
  ) VALUES (
    p_id, v_owner, p_transaction_type, p_source_account_id, p_destination_account_id,
    v_amount, p_transaction_date, v_category, v_description, 'posted', TRUE
  )
  RETURNING * INTO v_existing;

  RETURN v_existing;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_confirmed_transaction(p_id uuid)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_tx public.transactions%ROWTYPE;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Autentikasi Owner diperlukan.' USING ERRCODE = '28000';
  END IF;

  SELECT t.* INTO v_tx
  FROM public.transactions AS t
  WHERE t.id = p_id AND t.owner_id = v_owner
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;

  -- Debt payments are a three-record accounting operation. A status-only
  -- cancellation would corrupt the debt balance/payment history invariant.
  IF EXISTS (
    SELECT 1 FROM public.debt_payment_logs AS l
    WHERE l.owner_id = v_owner AND l.transaction_id = p_id
  ) THEN
    RAISE EXCEPTION 'Pembayaran utang memerlukan proses pembalikan atomik khusus; pembatalan umum ditolak.' USING ERRCODE = '55000';
  END IF;

  IF v_tx.status = 'cancelled' THEN
    RETURN v_tx;
  END IF;
  IF v_tx.status <> 'posted' OR v_tx.owner_confirmed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Hanya transaksi posted yang telah dikonfirmasi Owner yang dapat dibatalkan.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.transactions AS t
  SET status = 'cancelled'
  WHERE t.id = p_id AND t.owner_id = v_owner
  RETURNING t.* INTO v_tx;

  RETURN v_tx;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_owner_command_draft(
  p_command_id uuid,
  p_draft jsonb
)
RETURNS public.owner_commands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_cmd public.owner_commands%ROWTYPE;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Autentikasi Owner diperlukan.' USING ERRCODE = '28000';
  END IF;
  IF p_draft IS NULL OR pg_catalog.jsonb_typeof(p_draft) <> 'object' THEN
    RAISE EXCEPTION 'Draf transaksi tidak valid.' USING ERRCODE = '22023';
  END IF;
  SELECT c.* INTO v_cmd
  FROM public.owner_commands AS c
  WHERE c.id = p_command_id AND c.owner_id = v_owner
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perintah tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;
  IF v_cmd.status <> 'pending' THEN
    RAISE EXCEPTION 'Draf hanya dapat diubah saat perintah masih pending.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.owner_commands AS c
  SET parsed_draft = p_draft
  WHERE c.id = p_command_id AND c.owner_id = v_owner
  RETURNING c.* INTO v_cmd;
  RETURN v_cmd;
END;
$function$;


CREATE OR REPLACE FUNCTION public.approve_owner_command(
  p_command_id uuid,
  p_owner_confirmed boolean
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_cmd public.owner_commands%ROWTYPE;
  v_draft jsonb;
  v_tx public.transactions%ROWTYPE;
  v_type text;
  v_amount numeric;
  v_source uuid;
  v_destination uuid;
  v_date date;
  v_category text;
  v_description text;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Autentikasi Owner diperlukan.' USING ERRCODE = '28000';
  END IF;
  IF p_owner_confirmed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Persetujuan eksplisit Owner wajib sebelum menjalankan perintah.' USING ERRCODE = '42501';
  END IF;

  SELECT c.* INTO v_cmd
  FROM public.owner_commands AS c
  WHERE c.id = p_command_id AND c.owner_id = v_owner
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perintah tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;

  IF v_cmd.status = 'processed' THEN
    SELECT t.* INTO v_tx
    FROM public.transactions AS t
    WHERE t.id = v_cmd.id AND t.owner_id = v_owner;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Perintah berstatus processed tetapi transaksi hasilnya tidak ditemukan.' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_tx;
  END IF;
  IF v_cmd.status <> 'pending' THEN
    RAISE EXCEPTION 'Hanya perintah berstatus pending yang dapat disetujui.' USING ERRCODE = '22023';
  END IF;

  v_draft := v_cmd.parsed_draft;
  IF v_draft IS NULL OR pg_catalog.jsonb_typeof(v_draft) <> 'object' THEN
    RAISE EXCEPTION 'Draf transaksi tidak tersedia atau formatnya tidak valid.' USING ERRCODE = '22023';
  END IF;

  v_type := v_draft->>'transaction_type';
  v_amount := NULLIF(v_draft->>'amount', '')::numeric;
  v_source := NULLIF(v_draft->>'source_account_id', '')::uuid;
  v_destination := NULLIF(v_draft->>'destination_account_id', '')::uuid;
  v_date := COALESCE(NULLIF(v_draft->>'transaction_date', '')::date, CURRENT_DATE);
  v_category := COALESCE(NULLIF(pg_catalog.btrim(v_draft->>'category'), ''), 'Lainnya');
  v_description := COALESCE(NULLIF(pg_catalog.btrim(v_draft->>'description'), ''), v_cmd.command_text);

  v_tx := public.create_confirmed_transaction(
    v_cmd.id, v_type, v_source, v_destination, v_amount,
    v_date, v_category, v_description, TRUE
  );

  UPDATE public.owner_commands AS c
  SET status = 'processed',
      owner_confirmed = TRUE,
      processed_at = pg_catalog.now(),
      parsed_draft = pg_catalog.jsonb_build_object(
        'transaction_type', v_type,
        'amount', v_amount,
        'category', v_category,
        'description', v_description,
        'source_account_id', v_source,
        'destination_account_id', v_destination,
        'transaction_date', v_date
      )
  WHERE c.id = v_cmd.id AND c.owner_id = v_owner;

  RETURN v_tx;
END;
$function$;


CREATE OR REPLACE FUNCTION public.reject_owner_command(p_command_id uuid)
RETURNS public.owner_commands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_cmd public.owner_commands%ROWTYPE;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Autentikasi Owner diperlukan.' USING ERRCODE = '28000';
  END IF;

  SELECT c.* INTO v_cmd
  FROM public.owner_commands AS c
  WHERE c.id = p_command_id AND c.owner_id = v_owner
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perintah tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;
  IF v_cmd.status = 'rejected' THEN
    RETURN v_cmd;
  END IF;
  IF v_cmd.status <> 'pending' THEN
    RAISE EXCEPTION 'Hanya perintah pending yang dapat ditolak.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.owner_commands AS c
  SET status = 'rejected'
  WHERE c.id = p_command_id AND c.owner_id = v_owner
  RETURNING c.* INTO v_cmd;

  RETURN v_cmd;
END;
$function$;

-- Reuse the existing PERSONAL debt-payment contract and UUID request_id column.
-- Do not create a second debt-payment implementation or an idempotency_key column.
CREATE OR REPLACE FUNCTION public.ego_pay_debt_atomic(
  p_request_id uuid,
  p_debt_id uuid,
  p_amount numeric,
  p_source_account_id uuid,
  p_owner_confirmed boolean,
  p_transaction_date date,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner_id uuid := auth.uid();
  v_debt public.debts%ROWTYPE;
  v_existing_log public.debt_payment_logs%ROWTYPE;
  v_existing_tx public.transactions%ROWTYPE;
  v_transaction public.transactions%ROWTYPE;
  v_log public.debt_payment_logs%ROWTYPE;
  v_amount numeric(14,2);
  v_remaining numeric(14,2);
  v_notes text := NULLIF(pg_catalog.btrim(p_notes), '');
BEGIN
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Sesi Owner tidak valid.' USING ERRCODE = '28000';
  END IF;
  IF p_owner_confirmed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Persetujuan eksplisit Owner wajib dicentang.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR p_debt_id IS NULL OR p_source_account_id IS NULL THEN
    RAISE EXCEPTION 'ID permintaan, utang, dan akun sumber wajib diisi.' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_transaction_date IS NULL THEN
    RAISE EXCEPTION 'Nominal dan tanggal pembayaran harus valid.' USING ERRCODE = '22023';
  END IF;

  v_amount := pg_catalog.round(p_amount, 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pembayaran harus minimal 0,01.' USING ERRCODE = '22023';
  END IF;

  -- Lock by Owner + request UUID first, including retries that target a
  -- different debt. The UUID is the immutable identity of one payment attempt.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner_id::text || ':' || p_request_id::text, 0)
  );

  SELECT d.* INTO v_debt
  FROM public.debts AS d
  WHERE d.id = p_debt_id AND d.owner_id = v_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utang tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;

  SELECT l.* INTO v_existing_log
  FROM public.debt_payment_logs AS l
  WHERE l.owner_id = v_owner_id AND l.request_id = p_request_id;

  IF FOUND THEN
    SELECT t.* INTO v_existing_tx
    FROM public.transactions AS t
    WHERE t.id = v_existing_log.transaction_id AND t.owner_id = v_owner_id;

    IF NOT FOUND
      OR v_existing_log.debt_id <> p_debt_id
      OR v_existing_log.amount <> v_amount
      OR v_existing_log.notes IS DISTINCT FROM v_notes
      OR v_existing_tx.transaction_type <> 'expense'
      OR v_existing_tx.source_account_id IS DISTINCT FROM p_source_account_id
      OR v_existing_tx.amount <> v_amount
      OR v_existing_tx.category <> 'Utang & Cicilan'
      OR v_existing_tx.status <> 'posted'
      OR v_existing_tx.owner_confirmed IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'ID pembayaran sudah digunakan untuk rincian berbeda.' USING ERRCODE = '23505';
    END IF;

    -- transaction_date is intentionally not compared for a replay: legacy
    -- pending requests created before this app release did not persist it.
    -- The request UUID is immutable; a retry always returns the original row.
    RETURN pg_catalog.jsonb_build_object(
      'debt', pg_catalog.to_jsonb(v_debt),
      'transaction', pg_catalog.to_jsonb(v_existing_tx),
      'log', pg_catalog.to_jsonb(v_existing_log),
      'replayed', TRUE
    );
  END IF;

  IF v_debt.status <> 'active' OR v_debt.outstanding_balance <= 0 THEN
    RAISE EXCEPTION 'Utang ini tidak memiliki saldo aktif untuk dibayar.' USING ERRCODE = '22023';
  END IF;
  IF v_amount > v_debt.outstanding_balance THEN
    RAISE EXCEPTION 'Nominal pembayaran melebihi sisa utang.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts AS a
    WHERE a.id = p_source_account_id
      AND a.owner_id = v_owner_id
      AND a.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Akun sumber tidak ditemukan atau tidak aktif.' USING ERRCODE = '22023';
  END IF;

  v_remaining := GREATEST(0, pg_catalog.round(v_debt.outstanding_balance - v_amount, 2));

  INSERT INTO public.transactions (
    owner_id, transaction_type, source_account_id, destination_account_id,
    amount, transaction_date, category, description, status, owner_confirmed
  ) VALUES (
    v_owner_id, 'expense', p_source_account_id, NULL, v_amount, p_transaction_date,
    'Utang & Cicilan', 'Pembayaran utang ke ' || v_debt.creditor, 'posted', TRUE
  )
  RETURNING * INTO v_transaction;

  UPDATE public.debts AS d
  SET outstanding_balance = v_remaining,
      status = CASE WHEN v_remaining = 0 THEN 'paid' ELSE 'active' END,
      updated_at = pg_catalog.now()
  WHERE d.id = p_debt_id AND d.owner_id = v_owner_id
  RETURNING d.* INTO v_debt;

  INSERT INTO public.debt_payment_logs (
    owner_id, debt_id, transaction_id, request_id, amount,
    principal_paid, interest_paid, remaining_after, notes
  ) VALUES (
    v_owner_id, p_debt_id, v_transaction.id, p_request_id, v_amount,
    v_amount, 0, v_remaining, v_notes
  )
  RETURNING * INTO v_log;

  RETURN pg_catalog.jsonb_build_object(
    'debt', pg_catalog.to_jsonb(v_debt),
    'transaction', pg_catalog.to_jsonb(v_transaction),
    'log', pg_catalog.to_jsonb(v_log),
    'replayed', FALSE
  );
END;
$function$;

-- These RPCs are intentional authenticated APIs. No anonymous or PUBLIC EXECUTE.
REVOKE ALL ON FUNCTION public.create_confirmed_transaction(uuid,text,uuid,uuid,numeric,date,text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_confirmed_transaction(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_owner_command_draft(uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_owner_command(uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_owner_command(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ego_pay_debt_atomic(uuid,uuid,numeric,uuid,boolean,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_confirmed_transaction(uuid,text,uuid,uuid,numeric,date,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_confirmed_transaction(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_owner_command_draft(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_owner_command(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_owner_command(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ego_pay_debt_atomic(uuid,uuid,numeric,uuid,boolean,date,text) TO authenticated;

-- Remove direct ledger writes so a client cannot bypass the explicit Owner
-- confirmation RPC. SECURITY DEFINER RPCs above perform the required writes.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.transactions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.debt_payment_logs FROM PUBLIC, anon, authenticated;
REVOKE UPDATE ON TABLE public.owner_commands FROM PUBLIC, anon, authenticated;

-- Remove dangerous non-row privileges from every current public table/view.
-- RLS does not protect TRUNCATE; clients do not need TRIGGER or REFERENCES.
REVOKE MAINTAIN, TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;

-- Keep future application tables created by the migration executor role
-- from silently inheriting these privileges again. EGO-PERSONAL application
-- tables are owned by postgres. Supabase's reserved supabase_admin role has
-- platform-managed defaults that the postgres migration executor cannot
-- alter (and is not permitted to join); those defaults are not used to create
-- the application tables and must not be force-modified by this migration.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE MAINTAIN, TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;


-- Column-level ACLs survive table-level REVOKE. Remove the explicitly granted
-- column privileges observed in EGO-PERSONAL as well.
REVOKE INSERT (id, transaction_date, transaction_type, category, amount,
  source_account_id, destination_account_id, description, owner_confirmed,
  status, recorded_at, source_command, created_at, owner_id),
  UPDATE (id, transaction_date, transaction_type, category, amount,
  source_account_id, destination_account_id, description, owner_confirmed,
  status, recorded_at, source_command, created_at, owner_id)
ON TABLE public.transactions FROM PUBLIC, anon, authenticated;

REVOKE INSERT (id, owner_id, debt_id, transaction_id, amount, principal_paid,
  interest_paid, remaining_after, notes, created_at, request_id),
  UPDATE (id, owner_id, debt_id, transaction_id, amount, principal_paid,
  interest_paid, remaining_after, notes, created_at, request_id)
ON TABLE public.debt_payment_logs FROM PUBLIC, anon, authenticated;

-- Owner commands may be enqueued directly only through safe columns. Status,
-- owner identity, confirmation and timestamps remain database-controlled.
REVOKE INSERT, UPDATE ON TABLE public.owner_commands FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, command_text, command_type, status, owner_confirmed,
  created_at, processed_at, owner_id, parsed_draft),
  UPDATE (id, command_text, command_type, status, owner_confirmed,
  created_at, processed_at, owner_id, parsed_draft)
ON TABLE public.owner_commands FROM PUBLIC, anon, authenticated;
GRANT INSERT (command_text, parsed_draft) ON TABLE public.owner_commands TO authenticated;

COMMIT;
