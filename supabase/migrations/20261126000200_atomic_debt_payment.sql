-- Atomic, owner-scoped debt payment with retry protection.
-- This migration is staged for review only; do not run against EGO-PERSONAL
-- until the Owner explicitly approves the migration and app release.

ALTER TABLE public.debt_payment_logs
  ADD COLUMN IF NOT EXISTS request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS debt_payment_logs_owner_request_id_uidx
  ON public.debt_payment_logs (owner_id, request_id)
  WHERE request_id IS NOT NULL;

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
SECURITY INVOKER
SET search_path = public, pg_temp
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
  v_notes text := NULLIF(BTRIM(p_notes), '');
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
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pembayaran harus lebih dari Rp 0.' USING ERRCODE = '22023';
  END IF;
  IF p_transaction_date IS NULL THEN
    RAISE EXCEPTION 'Tanggal transaksi pembayaran wajib diisi.' USING ERRCODE = '22023';
  END IF;

  v_amount := ROUND(p_amount, 2);

  -- Serialize payments against the same debt before checking retry identity
  -- and the current outstanding balance.
  SELECT d.* INTO v_debt
  FROM public.debts AS d
  WHERE d.id = p_debt_id AND d.owner_id = v_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utang tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;

  -- A retry after a successful commit returns the original records unchanged.
  SELECT l.* INTO v_existing_log
  FROM public.debt_payment_logs AS l
  WHERE l.owner_id = v_owner_id AND l.request_id = p_request_id;

  IF FOUND THEN
    SELECT t.* INTO v_existing_tx
    FROM public.transactions AS t
    WHERE t.id = v_existing_log.transaction_id
      AND t.owner_id = v_owner_id;

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

    RETURN jsonb_build_object(
      'debt', to_jsonb(v_debt),
      'transaction', to_jsonb(v_existing_tx),
      'log', to_jsonb(v_existing_log),
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

  v_remaining := GREATEST(0, ROUND(v_debt.outstanding_balance - v_amount, 2));

  INSERT INTO public.transactions (
    owner_id,
    transaction_type,
    source_account_id,
    destination_account_id,
    amount,
    transaction_date,
    category,
    description,
    status,
    owner_confirmed
  ) VALUES (
    v_owner_id,
    'expense',
    p_source_account_id,
    NULL,
    v_amount,
    p_transaction_date,
    'Utang & Cicilan',
    'Pembayaran utang ke ' || v_debt.creditor,
    'posted',
    TRUE
  )
  RETURNING * INTO v_transaction;

  UPDATE public.debts
  SET outstanding_balance = v_remaining,
      status = CASE WHEN v_remaining = 0 THEN 'paid' ELSE 'active' END,
      updated_at = NOW()
  WHERE id = p_debt_id AND owner_id = v_owner_id
  RETURNING * INTO v_debt;

  INSERT INTO public.debt_payment_logs (
    owner_id,
    debt_id,
    transaction_id,
    request_id,
    amount,
    principal_paid,
    interest_paid,
    remaining_after,
    notes
  ) VALUES (
    v_owner_id,
    p_debt_id,
    v_transaction.id,
    p_request_id,
    v_amount,
    v_amount,
    0,
    v_remaining,
    v_notes
  )
  RETURNING * INTO v_log;

  RETURN jsonb_build_object(
    'debt', to_jsonb(v_debt),
    'transaction', to_jsonb(v_transaction),
    'log', to_jsonb(v_log),
    'replayed', FALSE
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.ego_pay_debt_atomic(uuid, uuid, numeric, uuid, boolean, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ego_pay_debt_atomic(uuid, uuid, numeric, uuid, boolean, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.ego_pay_debt_atomic(uuid, uuid, numeric, uuid, boolean, date, text) TO authenticated;
