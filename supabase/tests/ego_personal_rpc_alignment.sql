\set ON_ERROR_STOP on

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
BEGIN
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

  -- Owner command is processed atomically and can be safely retried.
  v_approved := public.approve_owner_command(
    '12121212-1212-4121-8121-121212121212',TRUE,
    '{"transaction_type":"expense","amount":5,"source_account_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","destination_account_id":null,"transaction_date":"2026-11-26","category":"Tes","description":"Draf uji"}'::jsonb
  );
  v_approved_replay := public.approve_owner_command(
    '12121212-1212-4121-8121-121212121212',TRUE,NULL
  );
  IF v_approved.id <> v_approved_replay.id THEN
    RAISE EXCEPTION 'Owner command retry created a second transaction';
  END IF;
  IF (SELECT status FROM public.owner_commands WHERE id='12121212-1212-4121-8121-121212121212') <> 'processed' THEN
    RAISE EXCEPTION 'Owner command did not transition to processed';
  END IF;
  BEGIN
    PERFORM public.approve_owner_command('13131313-1313-4131-8131-131313131313',TRUE,NULL);
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
  v_tx := public.cancel_confirmed_transaction('24242424-2424-4242-8242-242424242424');
  IF v_tx.status <> 'cancelled' THEN RAISE EXCEPTION 'Normal transaction was not cancelled'; END IF;
  v_tx := public.cancel_confirmed_transaction('24242424-2424-4242-8242-242424242424');
  IF v_tx.status <> 'cancelled' THEN RAISE EXCEPTION 'Cancellation retry was not idempotent'; END IF;

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
