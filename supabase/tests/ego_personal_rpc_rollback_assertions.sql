\set ON_ERROR_STOP on

DO $rollback_assertions$
DECLARE
  v_proc record;
  v_oid oid;
BEGIN
  IF pg_catalog.to_regprocedure('public.create_confirmed_transaction(uuid,text,uuid,uuid,numeric,date,text,text,boolean)') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.cancel_confirmed_transaction(uuid)') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.save_owner_command_draft(uuid,jsonb)') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.approve_owner_command(uuid,boolean)') IS NOT NULL
    OR pg_catalog.to_regprocedure('public.reject_owner_command(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback left candidate-only RPCs installed';
  END IF;

  v_oid := pg_catalog.to_regprocedure('public.ego_pay_debt_atomic(uuid,uuid,numeric,uuid,boolean,date,text)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Rollback removed the canonical debt RPC';
  END IF;
  SELECT p.prosecdef, p.proconfig, p.prosrc, p.proacl
    INTO v_proc FROM pg_catalog.pg_proc AS p WHERE p.oid = v_oid;

  IF v_proc.prosecdef IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'Rollback did not restore SECURITY INVOKER';
  END IF;
  IF NOT (COALESCE(v_proc.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=public, pg_temp']) THEN
    RAISE EXCEPTION 'Rollback did not restore the original search_path: %', v_proc.proconfig;
  END IF;
  IF pg_catalog.strpos(v_proc.prosrc, 'pg_advisory_xact_lock') > 0
    OR pg_catalog.strpos(v_proc.prosrc, 'FOR UPDATE') = 0 THEN
    RAISE EXCEPTION 'Rollback did not restore the original debt RPC implementation';
  END IF;
  IF NOT pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE')
    OR pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Rollback left incorrect debt RPC EXECUTE grants';
  END IF;
  IF NOT pg_catalog.has_table_privilege('authenticated','public.transactions','INSERT')
    OR NOT pg_catalog.has_table_privilege('authenticated','public.transactions','UPDATE')
    OR NOT pg_catalog.has_table_privilege('authenticated','public.debt_payment_logs','DELETE')
    OR NOT pg_catalog.has_table_privilege('authenticated','public.owner_commands','UPDATE') THEN
    RAISE EXCEPTION 'Rollback did not restore the pre-alignment authenticated DML grants';
  END IF;
  IF pg_catalog.has_table_privilege('anon','public.transactions','TRUNCATE')
    OR pg_catalog.has_table_privilege('authenticated','public.transactions','TRUNCATE') THEN
    RAISE EXCEPTION 'Rollback incorrectly restored dangerous TRUNCATE privileges';
  END IF;
END
$rollback_assertions$;

SELECT 'EGO-PERSONAL rollback assertions passed' AS result;
