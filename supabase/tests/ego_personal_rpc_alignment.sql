\set ON_ERROR_STOP on

-- Regression guard: neither anon nor authenticated may retain table-level
-- MAINTAIN, TRUNCATE, TRIGGER, or REFERENCES on any public relation after the candidate.
DO $privilege_test$
DECLARE
  v_rel record;
  v_role text;
  v_priv text;
BEGIN
  FOR v_rel IN
    SELECT c.oid, n.nspname, c.relname
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
  LOOP
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH v_priv IN ARRAY ARRAY['MAINTAIN','TRUNCATE','TRIGGER','REFERENCES'] LOOP
        IF pg_catalog.has_table_privilege(v_role, v_rel.oid, v_priv) THEN
          RAISE EXCEPTION 'Unexpected % privilege for % on %.%', v_priv, v_role, v_rel.nspname, v_rel.relname;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END
$privilege_test$;

-- Table-level REVOKE does not remove separately granted column REFERENCES.
-- Assert that no column-level REFERENCES survives on finance ledger tables.
DO $column_reference_test$
DECLARE
  v_col record;
  v_role text;
BEGIN
  FOR v_col IN
    SELECT c.oid AS relid, c.relname, a.attname
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute AS a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relname IN ('transactions','debt_payment_logs')
      AND a.attnum > 0 AND NOT a.attisdropped
  LOOP
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF pg_catalog.has_column_privilege(v_role, v_col.relid, v_col.attname, 'REFERENCES') THEN
        RAISE EXCEPTION 'Unexpected column REFERENCES privilege for % on %.%', v_role, v_col.relname, v_col.attname;
      END IF;
    END LOOP;
  END LOOP;
END
$column_reference_test$;

-- The app migration runs as postgres and all current EGO-PERSONAL public
-- relations are owned by postgres. Supabase-managed supabase_admin defaults
-- are reserved platform ACLs and cannot be altered by this executor.
DO $default_privilege_test$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_default_acl AS d
    CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) AS a
    JOIN pg_catalog.pg_roles AS gr ON gr.oid = a.grantee
    WHERE d.defaclobjtype = 'r'
      AND d.defaclnamespace = 'public'::regnamespace
      AND d.defaclrole = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'postgres')
      AND gr.rolname IN ('anon','authenticated')
      AND a.privilege_type IN ('MAINTAIN','TRUNCATE','TRIGGER','REFERENCES')
  ) THEN
    RAISE EXCEPTION 'Dangerous table privileges remain in postgres-owned public-schema default ACLs';
  END IF;
END
$default_privilege_test$;

-- Contract test for the entire exposed finance RPC surface.
-- Each function must be SECURITY DEFINER with a fixed empty search_path,
-- owned by a privileged migration role, executable by authenticated only,
-- and never executable by anon or PUBLIC.
DO $rpc_contract$
DECLARE
  v_name text;
  v_oid oid;
  v_proc record;
  v_expected text[] := ARRAY[
    'create_confirmed_transaction(uuid,text,uuid,uuid,numeric,date,text,text,boolean)',
    'cancel_confirmed_transaction(uuid)',
    'save_owner_command_draft(uuid,jsonb)',
    'approve_owner_command(uuid,boolean)',
    'reject_owner_command(uuid)',
    'ego_pay_debt_atomic(uuid,uuid,numeric,uuid,boolean,date,text)'
  ];
BEGIN
  FOREACH v_name IN ARRAY v_expected LOOP
    v_oid := pg_catalog.to_regprocedure('public.' || v_name);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'Required finance RPC is missing: %', v_name;
    END IF;
    SELECT p.*, r.rolname AS owner_name INTO v_proc
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_roles AS r ON r.oid = p.proowner
    WHERE p.oid = v_oid;
    IF v_proc.prosecdef IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Finance RPC must be SECURITY DEFINER: %', v_name;
    END IF;
    IF NOT (COALESCE(v_proc.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']) THEN
      RAISE EXCEPTION 'Finance RPC must pin search_path to empty: % (%).', v_name, v_proc.proconfig;
    END IF;
    IF v_proc.owner_name IN ('anon','authenticated','PUBLIC') THEN
      RAISE EXCEPTION 'Finance RPC has an untrusted owner: % (%).', v_name, v_proc.owner_name;
    END IF;
    IF pg_catalog.has_function_privilege('anon',v_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'anon can execute finance RPC: %', v_name;
    END IF;
    IF NOT pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated cannot execute intended finance RPC: %', v_name;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_catalog.aclexplode(
        COALESCE(v_proc.proacl, pg_catalog.acldefault('f',v_proc.proowner))
      ) AS a
      WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'PUBLIC retains EXECUTE on finance RPC: %', v_name;
    END IF;
  END LOOP;
  IF pg_catalog.to_regprocedure('public.approve_owner_command(uuid,boolean,jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy approval overload accepting a client-supplied draft still exists';
  END IF;
END
$rpc_contract$;

SET ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',FALSE);

DO $test$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_replay public.transactions%ROWTYPE;
  v_payment jsonb;
  v_payment_replay jsonb;
  v_approved public.transactions%ROWTYPE;
  v_approved_replay public.transactions%ROWTYPE;
  v_balance numeric;
  v_count integer;
  v_balance_before numeric;
  v_balance_after numeric;
  v_expense_before numeric;
  v_expense_after numeric;
  v_count_before integer;
  v_count_after integer;
BEGIN

  -- Column-level ACLs must be revoked independently of table-level grants.
  IF pg_catalog.has_table_privilege('authenticated','public.transactions','INSERT')
    OR pg_catalog.has_table_privilege('authenticated','public.transactions','UPDATE')
    OR pg_catalog.has_column_privilege('authenticated','public.transactions','amount','INSERT')
    OR pg_catalog.has_column_privilege('authenticated','public.transactions','amount','UPDATE') THEN
    RAISE EXCEPTION 'Direct transaction table/column DML privilege remains';
  END IF;
  IF pg_catalog.has_table_privilege('authenticated','public.debt_payment_logs','INSERT')
    OR pg_catalog.has_table_privilege('authenticated','public.debt_payment_logs','UPDATE')
    OR pg_catalog.has_table_privilege('authenticated','public.debt_payment_logs','DELETE')
    OR pg_catalog.has_column_privilege('authenticated','public.debt_payment_logs','amount','INSERT')
    OR pg_catalog.has_column_privilege('authenticated','public.debt_payment_logs','amount','UPDATE') THEN
    RAISE EXCEPTION 'Direct debt payment log DML privilege remains';
  END IF;
  IF pg_catalog.has_table_privilege('authenticated','public.owner_commands','UPDATE')
    OR pg_catalog.has_column_privilege('authenticated','public.owner_commands','status','UPDATE')
    OR pg_catalog.has_column_privilege('authenticated','public.owner_commands','owner_confirmed','INSERT')
    OR pg_catalog.has_column_privilege('authenticated','public.owner_commands','owner_id','INSERT') THEN
    RAISE EXCEPTION 'Owner command protected-column privilege remains';
  END IF;
  IF pg_catalog.has_table_privilege('authenticated','public.owner_commands','INSERT')
    OR NOT pg_catalog.has_column_privilege('authenticated','public.owner_commands','command_text','INSERT')
    OR NOT pg_catalog.has_column_privilege('authenticated','public.owner_commands','parsed_draft','INSERT') THEN
    RAISE EXCEPTION 'Owner command enqueue grants are not restricted to command_text and parsed_draft';
  END IF;

  -- RLS must show only the signed-in Owner's accounts.
  SELECT count(*) INTO v_count FROM public.accounts;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'RLS account isolation failed; expected 3 Owner rows, got %', v_count;
  END IF;

  -- Direct ledger writes must be denied; only RPCs can post or mutate ledger rows.
  BEGIN
    INSERT INTO public.transactions (transaction_type, category, amount, source_account_id, owner_confirmed, status)
    VALUES ('expense','direct bypass',1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',TRUE,'posted');
    RAISE EXCEPTION 'Direct transaction INSERT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Income, expense and transfer all use the same Owner-scoped RPC contract.
  v_tx := public.create_confirmed_transaction(
    '21212121-2121-4121-8121-212121212121','income',NULL,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',100,'2026-11-26','Gaji','Gaji uji',TRUE
  );
  IF v_tx.status <> 'posted' OR v_tx.owner_confirmed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Income was not posted as Owner-confirmed';
  END IF;

  v_tx := public.create_confirmed_transaction(
    '22222222-2222-4222-8222-222222222222','expense',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,10,'2026-11-26','Makan','Makan uji',TRUE
  );
  v_tx := public.create_confirmed_transaction(
    '23232323-2323-4232-8232-232323232323','transfer',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    15,'2026-11-26','Transfer','Transfer uji',TRUE
  );

  -- Exact retry returns the original transaction; conflicting reuse is rejected.
  v_tx := public.create_confirmed_transaction(
    '24242424-2424-4242-8242-242424242424','expense',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,20,'2026-11-26','Tes','Retry',TRUE
  );
  v_replay := public.create_confirmed_transaction(
    '24242424-2424-4242-8242-242424242424','expense',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,20,'2026-11-26','Tes','Retry',TRUE
  );
  IF v_tx.id <> v_replay.id THEN RAISE EXCEPTION 'Transaction retry created a second row'; END IF;
  BEGIN
    PERFORM public.create_confirmed_transaction(
      '24242424-2424-4242-8242-242424242424','expense',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,21,'2026-11-26','Tes','Retry',TRUE
    );
    RAISE EXCEPTION 'Conflicting transaction retry unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Amounts are normalized to the ledger's numeric(15,2) scale before replay comparison.
  v_tx := public.create_confirmed_transaction(
    '29292929-2929-4929-8929-292929292929','expense',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,20.004,'2026-11-26','Tes','Decimal retry',TRUE
  );
  IF v_tx.amount <> 20.00 THEN
    RAISE EXCEPTION 'Transaction amount was not normalized to two decimal places';
  END IF;
  v_replay := public.create_confirmed_transaction(
    '29292929-2929-4929-8929-292929292929','expense',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,20.00,'2026-11-26','Tes','Decimal retry',TRUE
  );
  IF v_tx.id <> v_replay.id THEN
    RAISE EXCEPTION 'Equivalent two-decimal retry was not recognized as the same transaction';
  END IF;
  BEGIN
    PERFORM public.create_confirmed_transaction(
      '29292929-2929-4929-8929-292929292929','expense',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,20.01,'2026-11-26','Tes','Decimal retry',TRUE
    );
    RAISE EXCEPTION 'Different normalized amount unexpectedly replayed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_confirmed_transaction(
      '30303030-3030-4030-8030-303030303030','expense',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,0.004,'2026-11-26','Tes','Rounds to zero',TRUE
    );
    RAISE EXCEPTION 'Amount rounding to zero unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- Outflows must not overdraw the source account; failures leave no ledger rows.
  BEGIN
    PERFORM public.create_confirmed_transaction(
      '61616161-6161-4161-8161-616161616161','expense',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,9999999999999.99,
      '2026-11-26','Tes','Insufficient funds expense',TRUE
    );
    RAISE EXCEPTION 'Expense exceeding available balance unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.transactions WHERE id='61616161-6161-4161-8161-616161616161') THEN
    RAISE EXCEPTION 'Rejected expense left a transaction row';
  END IF;
  BEGIN
    PERFORM public.create_confirmed_transaction(
      '62626262-6262-4262-8262-626262626262','transfer',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      9999999999999.99,'2026-11-26','Tes','Insufficient funds transfer',TRUE
    );
    RAISE EXCEPTION 'Transfer exceeding available balance unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.transactions WHERE id='62626262-6262-4262-8262-626262626262') THEN
    RAISE EXCEPTION 'Rejected transfer left a transaction row';
  END IF;

  -- Reject missing confirmation, invalid account ownership, inactive account and bad shape.
  BEGIN
    PERFORM public.create_confirmed_transaction(
      '25252525-2525-4252-8252-252525252525','expense',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,10,'2026-11-26','Tes','No confirm',FALSE
    );
    RAISE EXCEPTION 'Unconfirmed transaction unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.create_confirmed_transaction(
      '26262626-2626-4262-8262-262626262626','expense',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',NULL,10,'2026-11-26','Tes','Other owner account',TRUE
    );
    RAISE EXCEPTION 'Cross-owner account unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.create_confirmed_transaction(
      '27272727-2727-4272-8272-272727272727','expense',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',NULL,10,'2026-11-26','Tes','Inactive account',TRUE
    );
    RAISE EXCEPTION 'Inactive account unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.create_confirmed_transaction(
      '28282828-2828-4282-8282-282828282828','transfer',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      10,'2026-11-26','Tes','Same account transfer',TRUE
    );
    RAISE EXCEPTION 'Invalid transfer unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- Internal unchecked helpers must never be callable by client roles.
  IF pg_catalog.has_function_privilege('authenticated',
      'public.create_confirmed_transaction_internal(uuid,text,uuid,uuid,numeric,date,text,text,boolean)'::regprocedure,'EXECUTE')
    OR pg_catalog.has_function_privilege('anon',
      'public.create_confirmed_transaction_internal(uuid,text,uuid,uuid,numeric,date,text,text,boolean)'::regprocedure,'EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated',
      'public.ego_pay_debt_atomic_internal(uuid,uuid,numeric,uuid,boolean,date,text)'::regprocedure,'EXECUTE')
    OR pg_catalog.has_function_privilege('anon',
      'public.ego_pay_debt_atomic_internal(uuid,uuid,numeric,uuid,boolean,date,text)'::regprocedure,'EXECUTE') THEN
    RAISE EXCEPTION 'Internal unchecked finance helper is exposed to client roles';
  END IF;

  -- Cross-Owner IDOR regression: Owner A must not read, replace, or approve
  -- Owner B's pending command, even when B's UUID is known to the caller.
  BEGIN
    PERFORM public.save_owner_command_draft(
      '15151515-1515-4151-8151-151515151515',
      '{"transaction_type":"expense","amount":777,"source_account_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}'::jsonb
    );
    RAISE EXCEPTION 'Owner A unexpectedly saved Owner B draft';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
  END;
  BEGIN
    PERFORM public.approve_owner_command('15151515-1515-4151-8151-151515151515',TRUE);
    RAISE EXCEPTION 'Owner A unexpectedly approved Owner B command';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
  END;
  -- Switch identity to B only to verify the target row remained untouched.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',FALSE);
  IF (SELECT status FROM public.owner_commands WHERE id='15151515-1515-4151-8151-151515151515') <> 'pending'
     OR (SELECT parsed_draft FROM public.owner_commands WHERE id='15151515-1515-4151-8151-151515151515') IS NOT NULL THEN
    RAISE EXCEPTION 'Cross-Owner attempt changed Owner B command';
  END IF;
  PERFORM pg_catalog.set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',FALSE);

  -- Owner command is processed atomically and can be safely retried.
  -- The edited draft is persisted first; approval accepts only command ID + Owner confirmation.
  PERFORM public.save_owner_command_draft(
    '12121212-1212-4121-8121-121212121212',
    '{"transaction_type":"expense","amount":5,"source_account_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","destination_account_id":null,"transaction_date":"2026-11-26","category":"Tes","description":"Draf uji"}'::jsonb
  );
  IF pg_catalog.to_regprocedure('public.approve_owner_command(uuid,boolean,jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy approval RPC accepting a client draft still exists';
  END IF;
  IF (SELECT status FROM public.owner_commands WHERE id='12121212-1212-4121-8121-121212121212') <> 'pending'
    OR EXISTS (SELECT 1 FROM public.transactions WHERE description='Draf uji') THEN
    RAISE EXCEPTION 'Saving an Owner draft changed the ledger before explicit approval';
  END IF;
  v_approved := public.approve_owner_command(
    '12121212-1212-4121-8121-121212121212',TRUE
  );
  v_approved_replay := public.approve_owner_command(
    '12121212-1212-4121-8121-121212121212',TRUE
  );
  IF v_approved.id <> v_approved_replay.id THEN
    RAISE EXCEPTION 'Owner command retry created a second transaction';
  END IF;
  IF (SELECT status FROM public.owner_commands WHERE id='12121212-1212-4121-8121-121212121212') <> 'processed' THEN
    RAISE EXCEPTION 'Owner command did not transition to processed';
  END IF;
  BEGIN
    PERFORM public.save_owner_command_draft(
      '12121212-1212-4121-8121-121212121212',
      '{"transaction_type":"expense","amount":999}'::jsonb
    );
    RAISE EXCEPTION 'Processed Owner command draft unexpectedly changed';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.approve_owner_command(
      '12121212-1212-4121-8121-121212121212',FALSE
    );
    RAISE EXCEPTION 'Approval without Owner confirmation unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.approve_owner_command('13131313-1313-4131-8131-131313131313',TRUE);
    RAISE EXCEPTION 'Rejected Owner command unexpectedly processed';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- Rejection is also a narrow, owner-scoped pending -> rejected transition.
  PERFORM public.reject_owner_command('14141414-1414-4141-8141-141414141414');
  PERFORM public.reject_owner_command('14141414-1414-4141-8141-141414141414');
  IF (SELECT status FROM public.owner_commands WHERE id='14141414-1414-4141-8141-141414141414') <> 'rejected' THEN
    RAISE EXCEPTION 'Owner command rejection RPC did not set rejected status';
  END IF;
  BEGIN
    UPDATE public.owner_commands SET status='processed'
    WHERE id='13131313-1313-4131-8131-131313131313';
    RAISE EXCEPTION 'Direct Owner command UPDATE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Positive inputs that normalize to zero must fail with a clear validation error.
  BEGIN
    PERFORM public.ego_pay_debt_atomic(
      '30313131-3031-4131-8131-303131313131',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      0.004,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',TRUE,DATE '2026-11-26','rounds to zero'
    );
    RAISE EXCEPTION 'Debt payment amount rounding to zero unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- Debt payment is also an outflow and must respect the source account balance.
  BEGIN
    PERFORM public.ego_pay_debt_atomic(
      '63636363-6363-4363-8363-636363636363',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      9999999999999.99,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      TRUE,DATE '2026-11-26','Insufficient funds debt payment'
    );
    RAISE EXCEPTION 'Debt payment exceeding available balance unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  IF EXISTS (
    SELECT 1 FROM public.debt_payment_logs
    WHERE request_id='63636363-6363-4363-8363-636363636363'
  ) THEN
    RAISE EXCEPTION 'Rejected debt payment left a payment log';
  END IF;

  -- Debt payment updates debt + transaction + payment log atomically.
  v_payment := public.ego_pay_debt_atomic(
    '31313131-3131-4131-8131-313131313131',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    20,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',TRUE,DATE '2026-11-26','payment test'
  );
  IF (v_payment->>'replayed')::boolean IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'First debt payment was unexpectedly replayed';
  END IF;
  v_payment_replay := public.ego_pay_debt_atomic(
    '31313131-3131-4131-8131-313131313131',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    20,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',TRUE,DATE '2026-11-27','payment test'
  );
  IF (v_payment_replay->>'replayed')::boolean IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Debt payment retry was not replayed';
  END IF;
  IF v_payment->'transaction'->>'id' <> v_payment_replay->'transaction'->>'id' THEN
    RAISE EXCEPTION 'Debt payment retry created a second transaction';
  END IF;
  SELECT outstanding_balance INTO v_balance FROM public.debts WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  SELECT count(*) INTO v_count FROM public.debt_payment_logs
    WHERE debt_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  IF v_balance <> 80 OR v_count <> 1 THEN
    RAISE EXCEPTION 'Debt payment replay changed balance or duplicated payment log';
  END IF;

  BEGIN
    PERFORM public.ego_pay_debt_atomic(
      '31313131-3131-4131-8131-313131313131',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      21,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',TRUE,DATE '2026-11-26','payment test'
    );
    RAISE EXCEPTION 'Conflicting debt request reuse unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.ego_pay_debt_atomic(
      '32323232-3232-4232-8232-323232323232',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      100,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',TRUE,DATE '2026-11-26',NULL
    );
    RAISE EXCEPTION 'Overpayment unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.ego_pay_debt_atomic(
      '33333333-3333-4333-8333-333333333333',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      10,'cccccccc-cccc-4ccc-8ccc-cccccccccccc',TRUE,DATE '2026-11-26',NULL
    );
    RAISE EXCEPTION 'Wrong-owner payment account unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- Generic cancellation must never detach a debt payment from its log/balance.
  BEGIN
    PERFORM public.cancel_confirmed_transaction((v_payment->'transaction'->>'id')::uuid);
    RAISE EXCEPTION 'Debt-payment cancellation unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;

  -- Ordinary posted transactions may be cancelled; repeating cancellation is safe.
  -- Verify the derived account balance and monthly cashflow/report aggregates both reverse.
  SELECT
    COALESCE(SUM(CASE WHEN destination_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' THEN amount ELSE 0 END),0)
      - COALESCE(SUM(CASE WHEN source_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' THEN amount ELSE 0 END),0)
  INTO v_balance_before
  FROM public.transactions
  WHERE owner_id='11111111-1111-4111-8111-111111111111' AND status='posted' AND owner_confirmed IS TRUE;
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE transaction_type='expense'),0),
    COUNT(*) FILTER (WHERE transaction_type IN ('income','expense'))::integer
  INTO v_expense_before, v_count_before
  FROM public.transactions
  WHERE owner_id='11111111-1111-4111-8111-111111111111'
    AND status='posted' AND owner_confirmed IS TRUE
    AND transaction_type IN ('income','expense')
    AND transaction_date >= DATE '2026-11-01' AND transaction_date < DATE '2026-12-01';
  v_tx := public.cancel_confirmed_transaction('24242424-2424-4242-8242-242424242424');
  IF v_tx.status <> 'cancelled' THEN RAISE EXCEPTION 'Normal transaction was not cancelled'; END IF;
  v_tx := public.cancel_confirmed_transaction('24242424-2424-4242-8242-242424242424');
  IF v_tx.status <> 'cancelled' THEN RAISE EXCEPTION 'Cancellation retry was not idempotent'; END IF;
  SELECT
    COALESCE(SUM(CASE WHEN destination_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' THEN amount ELSE 0 END),0)
      - COALESCE(SUM(CASE WHEN source_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' THEN amount ELSE 0 END),0)
  INTO v_balance_after
  FROM public.transactions
  WHERE owner_id='11111111-1111-4111-8111-111111111111' AND status='posted' AND owner_confirmed IS TRUE;
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE transaction_type='expense'),0),
    COUNT(*) FILTER (WHERE transaction_type IN ('income','expense'))::integer
  INTO v_expense_after, v_count_after
  FROM public.transactions
  WHERE owner_id='11111111-1111-4111-8111-111111111111'
    AND status='posted' AND owner_confirmed IS TRUE
    AND transaction_type IN ('income','expense')
    AND transaction_date >= DATE '2026-11-01' AND transaction_date < DATE '2026-12-01';
  IF v_balance_after <> v_balance_before + 20 THEN
    RAISE EXCEPTION 'Cancelled expense did not restore the derived account balance (before %, after %)', v_balance_before, v_balance_after;
  END IF;
  IF v_expense_after <> v_expense_before - 20 OR v_count_after <> v_count_before - 1 THEN
    RAISE EXCEPTION 'Cancelled expense remains in monthly cashflow/report totals (expense % -> %, count % -> %)', v_expense_before, v_expense_after, v_count_before, v_count_after;
  END IF;

  -- Direct updates/deletes to immutable ledger rows are not permitted.
  BEGIN
    UPDATE public.transactions SET amount = 999 WHERE id='21212121-2121-4121-8121-212121212121';
    RAISE EXCEPTION 'Direct transaction UPDATE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.debt_payment_logs WHERE request_id='31313131-3131-4131-8131-313131313131';
    RAISE EXCEPTION 'Direct payment-log DELETE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$test$;

RESET ROLE;

-- Anonymous callers cannot execute the authenticated finance RPC surface.
SET ROLE anon;
SELECT pg_catalog.set_config('request.jwt.claim.sub','',FALSE);
DO $anon_test$
BEGIN
  BEGIN
    PERFORM public.create_confirmed_transaction(
      '41414141-4141-4141-8141-414141414141','expense',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,1,CURRENT_DATE,'Anon','Denied',TRUE
    );
    RAISE EXCEPTION 'Anonymous RPC call unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$anon_test$;
RESET ROLE;

-- Force the last step of a debt payment to fail; all earlier writes must roll back.
CREATE OR REPLACE FUNCTION public.test_fail_payment_log()
RETURNS trigger
LANGUAGE plpgsql
AS $trigger$
BEGIN
  IF NEW.notes = 'force rollback' THEN
    RAISE EXCEPTION 'intentional payment-log failure';
  END IF;
  RETURN NEW;
END
$trigger$;
CREATE TRIGGER test_fail_payment_log
BEFORE INSERT ON public.debt_payment_logs
FOR EACH ROW EXECUTE FUNCTION public.test_fail_payment_log();

SET ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',FALSE);
DO $rollback_test$
DECLARE
  v_before numeric;
  v_after numeric;
  v_tx_before integer;
  v_tx_after integer;
BEGIN
  SELECT outstanding_balance INTO v_before FROM public.debts WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  SELECT count(*) INTO v_tx_before FROM public.transactions WHERE description='Pembayaran utang ke Test creditor';
  BEGIN
    PERFORM public.ego_pay_debt_atomic(
      '51515151-5151-4151-8151-515151515151',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      10,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',TRUE,DATE '2026-11-26','force rollback'
    );
    RAISE EXCEPTION 'Forced payment-log failure unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Forced payment-log failure unexpectedly succeeded' THEN RAISE; END IF;
  END;
  SELECT outstanding_balance INTO v_after FROM public.debts WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  SELECT count(*) INTO v_tx_after FROM public.transactions WHERE description='Pembayaran utang ke Test creditor';
  IF v_after <> v_before OR v_tx_after <> v_tx_before THEN
    RAISE EXCEPTION 'Debt payment failure did not roll back all ledger writes';
  END IF;
END
$rollback_test$;
RESET ROLE;

DROP TRIGGER test_fail_payment_log ON public.debt_payment_logs;
DROP FUNCTION public.test_fail_payment_log();

SELECT 'EGO-PERSONAL RPC alignment integration tests passed' AS result;
