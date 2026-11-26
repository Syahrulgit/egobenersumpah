-- Run after both migrations have been applied to the ephemeral database.
\set ON_ERROR_STOP on
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $test$
DECLARE
  v_result jsonb;
  v_replay jsonb;
  v_balance numeric;
  v_tx_count integer;
  v_log_count integer;
BEGIN
  -- The first migration must reject posted transactions without Owner confirmation.
  BEGIN
    INSERT INTO public.transactions (transaction_type,category,amount,source_account_id,owner_confirmed,status,owner_id)
    VALUES ('expense','fixture invalid',1.00,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false,'posted',auth.uid());
    RAISE EXCEPTION 'posted unconfirmed transaction unexpectedly inserted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- Successful payment and exact retry must return the same records.
  v_result := public.ego_pay_debt_atomic(
    '99999999-9999-4999-8999-999999999999',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    30.00,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    true,
    DATE '2026-11-26',
    'integration success'
  );
  IF (v_result->>'replayed')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'first payment should not be replay'; END IF;
  v_replay := public.ego_pay_debt_atomic(
    '99999999-9999-4999-8999-999999999999',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    30.00,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    true,
    DATE '2026-11-26',
    'integration success'
  );
  IF (v_replay->>'replayed')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'retry should be replay'; END IF;
  IF v_result->'transaction'->>'id' <> v_replay->'transaction'->>'id' THEN RAISE EXCEPTION 'retry created a different transaction'; END IF;
  SELECT outstanding_balance INTO v_balance FROM public.debts WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  SELECT count(*) INTO v_tx_count FROM public.transactions WHERE owner_id=auth.uid();
  SELECT count(*) INTO v_log_count FROM public.debt_payment_logs WHERE owner_id=auth.uid();
  IF v_balance <> 70.00 OR v_tx_count <> 1 OR v_log_count <> 1 THEN RAISE EXCEPTION 'duplicate retry changed balances or counts'; END IF;

  -- Same request ID with altered amount must be rejected.
  BEGIN
    PERFORM public.ego_pay_debt_atomic('99999999-9999-4999-8999-999999999999','dddddddd-dddd-4ddd-8ddd-dddddddddddd',31.00,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,DATE '2026-11-26','integration success');
    RAISE EXCEPTION 'altered retry unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- Owner confirmation and amount validations.
  BEGIN
    PERFORM public.ego_pay_debt_atomic('99999999-9999-4999-8999-999999999998','dddddddd-dddd-4ddd-8ddd-dddddddddddd',10.00,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false,DATE '2026-11-26',NULL);
    RAISE EXCEPTION 'unconfirmed payment unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.ego_pay_debt_atomic('99999999-9999-4999-8999-999999999997','dddddddd-dddd-4ddd-8ddd-dddddddddddd',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,DATE '2026-11-26',NULL);
    RAISE EXCEPTION 'zero payment unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.ego_pay_debt_atomic('99999999-9999-4999-8999-999999999996','dddddddd-dddd-4ddd-8ddd-dddddddddddd',71.00,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,DATE '2026-11-26',NULL);
    RAISE EXCEPTION 'overpayment unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.ego_pay_debt_atomic('99999999-9999-4999-8999-999999999995','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',10.00,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,DATE '2026-11-26',NULL);
    RAISE EXCEPTION 'other-owner debt unexpectedly succeeded';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    PERFORM public.ego_pay_debt_atomic('99999999-9999-4999-8999-999999999994','dddddddd-dddd-4ddd-8ddd-dddddddddddd',10.00,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true,DATE '2026-11-26',NULL);
    RAISE EXCEPTION 'other-owner account unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.ego_pay_debt_atomic('99999999-9999-4999-8999-999999999993','dddddddd-dddd-4ddd-8ddd-dddddddddddd',10.00,'cccccccc-cccc-4ccc-8ccc-cccccccccccc',true,DATE '2026-11-26',NULL);
    RAISE EXCEPTION 'inactive account unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END
$test$;
RESET ROLE;

-- Verify rollback of transaction + debt update if the final log insert fails.
CREATE OR REPLACE FUNCTION public.test_reject_payment_log() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.notes = 'force-log-failure' THEN RAISE EXCEPTION 'intentional test failure'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER test_reject_payment_log BEFORE INSERT ON public.debt_payment_logs
FOR EACH ROW EXECUTE FUNCTION public.test_reject_payment_log();
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $rollback$
DECLARE v_balance numeric; v_count integer;
BEGIN
  SELECT outstanding_balance INTO v_balance FROM public.debts WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  SELECT count(*) INTO v_count FROM public.transactions WHERE owner_id=auth.uid();
  BEGIN
    PERFORM public.ego_pay_debt_atomic('99999999-9999-4999-8999-999999999992','dddddddd-dddd-4ddd-8ddd-dddddddddddd',10.00,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,DATE '2026-11-26','force-log-failure');
    RAISE EXCEPTION 'forced failure unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'forced failure unexpectedly succeeded' THEN RAISE; END IF;
  END;
  IF (SELECT outstanding_balance FROM public.debts WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> v_balance THEN RAISE EXCEPTION 'debt balance did not roll back'; END IF;
  SELECT count(*) INTO v_count FROM public.transactions WHERE owner_id=auth.uid();
  IF v_count <> 1 THEN RAISE EXCEPTION 'transaction insert did not roll back'; END IF;
END
$rollback$;
RESET ROLE;
DROP TRIGGER test_reject_payment_log ON public.debt_payment_logs;
DROP FUNCTION public.test_reject_payment_log();
SELECT 'EGO finance integration tests passed' AS result;
