\set ON_ERROR_STOP on

DO $rollback_assertions$
DECLARE
  v_proc record;
  v_oid oid;
  v_rel record;
  v_role text;
  v_priv text;
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
  -- Rollback deliberately keeps direct DML revoked. Finance writes must
  -- continue through the authenticated Owner-confirmation RPC contract.
  IF pg_catalog.has_table_privilege('authenticated','public.transactions','INSERT')
    OR pg_catalog.has_table_privilege('authenticated','public.transactions','UPDATE')
    OR pg_catalog.has_table_privilege('authenticated','public.transactions','DELETE')
    OR pg_catalog.has_table_privilege('authenticated','public.debt_payment_logs','INSERT')
    OR pg_catalog.has_table_privilege('authenticated','public.debt_payment_logs','UPDATE')
    OR pg_catalog.has_table_privilege('authenticated','public.debt_payment_logs','DELETE')
    OR pg_catalog.has_table_privilege('authenticated','public.owner_commands','INSERT')
    OR pg_catalog.has_table_privilege('authenticated','public.owner_commands','UPDATE')
    OR pg_catalog.has_table_privilege('authenticated','public.owner_commands','DELETE') THEN
    RAISE EXCEPTION 'Rollback reopened direct authenticated DML instead of preserving the RPC-only write boundary';
  END IF;
  -- Rollback intentionally retains the candidate's security hardening:
  -- neither API role regains MAINTAIN, TRUNCATE, TRIGGER or REFERENCES.
  FOR v_rel IN
    SELECT c.oid, n.nspname, c.relname
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
  LOOP
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH v_priv IN ARRAY ARRAY['MAINTAIN','TRUNCATE','TRIGGER','REFERENCES'] LOOP
        IF pg_catalog.has_table_privilege(v_role, v_rel.oid, v_priv) THEN
          RAISE EXCEPTION 'Rollback restored hardened % privilege for % on %.%',
            v_priv, v_role, v_rel.nspname, v_rel.relname;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

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
    RAISE EXCEPTION 'Rollback restored hardened postgres-owned default ACL privileges';
  END IF;
END
$rollback_assertions$;

SELECT 'EGO-PERSONAL rollback assertions passed' AS result;
