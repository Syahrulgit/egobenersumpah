-- Prevent posted outflows from making an Owner account balance negative.
-- The wrappers serialize all transactions affecting the participating account(s)
-- and delegate the immutable ledger write to the previously hardened RPCs.
ALTER FUNCTION public.create_confirmed_transaction(uuid,text,uuid,uuid,numeric,date,text,text,boolean)
  RENAME TO create_confirmed_transaction_internal;
REVOKE ALL ON FUNCTION public.create_confirmed_transaction_internal(uuid,text,uuid,uuid,numeric,date,text,text,boolean)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.create_confirmed_transaction(
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
  v_balance numeric(15,2);
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Autentikasi Owner diperlukan.' USING ERRCODE = '28000';
  END IF;
  IF p_owner_confirmed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Persetujuan eksplisit Owner wajib sebelum transaksi diposting.' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Data transaksi tidak valid.' USING ERRCODE = '22023';
  END IF;

  -- Acquire the same request lock before account locks in both RPC paths.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || p_id::text, 0)
  );

  -- One stable lock order serializes credits and debits across both accounts.
  PERFORM a.id
  FROM public.accounts AS a
  WHERE a.owner_id = v_owner
    AND a.id = ANY (ARRAY[p_source_account_id, p_destination_account_id]::uuid[])
  ORDER BY a.id
  FOR UPDATE;

  -- A replay must return the original result even if the account was spent down
  -- after the original commit. The internal RPC validates the exact payload.
  IF EXISTS (
    SELECT 1 FROM public.transactions AS t
    WHERE t.id = p_id AND t.owner_id = v_owner
  ) THEN
    RETURN public.create_confirmed_transaction_internal(
      p_id, p_transaction_type, p_source_account_id, p_destination_account_id,
      p_amount, p_transaction_date, p_category, p_description, p_owner_confirmed
    );
  END IF;

  IF p_transaction_type IN ('expense', 'transfer') THEN
    SELECT a.opening_balance
      + COALESCE(SUM(t.amount) FILTER (WHERE t.destination_account_id = a.id), 0)
      - COALESCE(SUM(t.amount) FILTER (WHERE t.source_account_id = a.id), 0)
    INTO v_balance
    FROM public.accounts AS a
    LEFT JOIN public.transactions AS t
      ON t.owner_id = a.owner_id
      AND (t.source_account_id = a.id OR t.destination_account_id = a.id)
      AND t.status = 'posted'
      AND t.owner_confirmed IS TRUE
    WHERE a.id = p_source_account_id
      AND a.owner_id = v_owner
      AND a.is_active IS TRUE
    GROUP BY a.id, a.opening_balance;

    IF v_balance IS NULL THEN
      -- Let the hardened internal RPC return its established account error.
      RETURN public.create_confirmed_transaction_internal(
        p_id, p_transaction_type, p_source_account_id, p_destination_account_id,
        p_amount, p_transaction_date, p_category, p_description, p_owner_confirmed
      );
    END IF;
    IF pg_catalog.round(p_amount, 2) > v_balance THEN
      RAISE EXCEPTION 'Saldo akun sumber tidak mencukupi. Saldo tersedia: %, nominal: %.',
        v_balance, pg_catalog.round(p_amount, 2)
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN public.create_confirmed_transaction_internal(
    p_id, p_transaction_type, p_source_account_id, p_destination_account_id,
    p_amount, p_transaction_date, p_category, p_description, p_owner_confirmed
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_confirmed_transaction(uuid,text,uuid,uuid,numeric,date,text,text,boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_confirmed_transaction(uuid,text,uuid,uuid,numeric,date,text,text,boolean)
  TO authenticated;

ALTER FUNCTION public.ego_pay_debt_atomic(uuid,uuid,numeric,uuid,boolean,date,text)
  RENAME TO ego_pay_debt_atomic_internal;
REVOKE ALL ON FUNCTION public.ego_pay_debt_atomic_internal(uuid,uuid,numeric,uuid,boolean,date,text)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.ego_pay_debt_atomic(
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
  v_owner uuid := auth.uid();
  v_balance numeric(15,2);
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Sesi Owner tidak valid.' USING ERRCODE = '28000';
  END IF;
  IF p_owner_confirmed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Persetujuan eksplisit Owner wajib dicentang.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR p_source_account_id IS NULL
    OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'ID permintaan, akun sumber, dan nominal pembayaran harus valid.'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize retries first; exact replays must remain safe after later spending.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':' || p_request_id::text, 0)
  );
  IF EXISTS (
    SELECT 1 FROM public.debt_payment_logs AS l
    WHERE l.owner_id = v_owner AND l.request_id = p_request_id
  ) THEN
    RETURN public.ego_pay_debt_atomic_internal(
      p_request_id, p_debt_id, p_amount, p_source_account_id,
      p_owner_confirmed, p_transaction_date, p_notes
    );
  END IF;

  -- Serialize debt outflows with ordinary expenses/transfers on this account.
  PERFORM a.id
  FROM public.accounts AS a
  WHERE a.id = p_source_account_id AND a.owner_id = v_owner
  FOR UPDATE;

  SELECT a.opening_balance
    + COALESCE(SUM(t.amount) FILTER (WHERE t.destination_account_id = a.id), 0)
    - COALESCE(SUM(t.amount) FILTER (WHERE t.source_account_id = a.id), 0)
  INTO v_balance
  FROM public.accounts AS a
  LEFT JOIN public.transactions AS t
    ON t.owner_id = a.owner_id
    AND (t.source_account_id = a.id OR t.destination_account_id = a.id)
    AND t.status = 'posted'
    AND t.owner_confirmed IS TRUE
  WHERE a.id = p_source_account_id
    AND a.owner_id = v_owner
    AND a.is_active IS TRUE
  GROUP BY a.id, a.opening_balance;

  IF v_balance IS NULL THEN
    RETURN public.ego_pay_debt_atomic_internal(
      p_request_id, p_debt_id, p_amount, p_source_account_id,
      p_owner_confirmed, p_transaction_date, p_notes
    );
  END IF;
  IF pg_catalog.round(p_amount, 2) > v_balance THEN
    RAISE EXCEPTION 'Saldo akun sumber tidak mencukupi. Saldo tersedia: %, nominal: %.',
      v_balance, pg_catalog.round(p_amount, 2)
      USING ERRCODE = '22023';
  END IF;

  RETURN public.ego_pay_debt_atomic_internal(
    p_request_id, p_debt_id, p_amount, p_source_account_id,
    p_owner_confirmed, p_transaction_date, p_notes
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.ego_pay_debt_atomic(uuid,uuid,numeric,uuid,boolean,date,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ego_pay_debt_atomic(uuid,uuid,numeric,uuid,boolean,date,text)
  TO authenticated;
