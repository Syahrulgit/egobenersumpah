\set ON_ERROR_STOP on

DO $rollback_assertions$
DECLARE
  v_proc record;
  v_oid oid;
  v_rel record;
  v_role text;
  v_priv text;
  v_acl_details text;
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

  IF v_proc.prosecdef IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Rollback removed SECURITY DEFINER from the retained debt RPC';
  END IF;
  IF NOT (COALESCE(v_proc.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'Retained debt RPC does not use the hardened empty search_path: %', v_proc.proconfig;
  END IF;
  IF pg_catalog.strpos(v_proc.prosrc, 'pg_advisory_xact_lock') = 0
    OR pg_catalog.strpos(v_proc.prosrc, 'FOR UPDATE') = 0 THEN
    RAISE EXCEPTION 'Rollback did not retain the hardened atomic debt RPC implementation';
  END IF;
  IF NOT pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE')
    OR pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Rollback left incorrect debt RPC EXECUTE grants';
  END IF;
  -- Check table-level ACL entries directly. has_table_privilege() also returns
  -- true for safe column-level INSERT grants, so it is too broad for owner_commands.
  SELECT pg_catalog.string_agg(
    pg_catalog.format('%I: grantee=%s privilege=%s grantor=%s', c.relname,
      CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE COALESCE(gr.rolname, a.grantee::text) END,
      a.privilege_type, COALESCE(g.rolname, a.grantor::text)), '; ')
  INTO v_acl_details
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))
  ) AS a
  LEFT JOIN pg_catalog.pg_roles AS gr ON gr.oid = a.grantee
  LEFT JOIN pg_catalog.pg_roles AS g ON g.oid = a.grantor
  WHERE n.nspname = 'public'
    AND c.relname IN ('transactions','debt_payment_logs','owner_commands')
    AND a.grantee IN (0,
      (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'anon'),
      (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'authenticated'))
    AND a.privilege_type IN ('INSERT','UPDATE','DELETE');
  IF v_acl_details IS NOT NULL THEN
    RAISE EXCEPTION 'Direct table-level ledger DML remains after rollback: %', v_acl_details;
  END IF;
  -- Ledger tables have no API-role column-level DML grants.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute AS att ON att.attrelid = c.oid AND att.attnum > 0 AND NOT att.attisdropped
    CROSS JOIN LATERAL pg_catalog.aclexplode(att.attacl) AS a
    WHERE n.nspname = 'public'
      AND c.relname IN ('transactions','debt_payment_logs')
      AND att.attacl IS NOT NULL
      AND a.grantee IN (0,
        (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'anon'),
        (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'authenticated'))
      AND a.privilege_type IN ('INSERT','UPDATE','REFERENCES')
  ) THEN
    RAISE EXCEPTION 'Rollback restored column-level ledger DML';
  END IF;
  -- owner_commands may accept only safe command payload columns for INSERT.
  IF NOT pg_catalog.has_column_privilege('authenticated','public.owner_commands','command_text','INSERT')
    OR NOT pg_catalog.has_column_privilege('authenticated','public.owner_commands','parsed_draft','INSERT')
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS c
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
      JOIN pg_catalog.pg_attribute AS att ON att.attrelid = c.oid AND att.attnum > 0 AND NOT att.attisdropped
      CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(att.attacl, ARRAY[]::pg_catalog.aclitem[])) AS a
      WHERE n.nspname = 'public' AND c.relname = 'owner_commands'
        AND att.attacl IS NOT NULL
        AND a.grantee IN (0,
          (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'anon'),
          (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'authenticated'))
        AND (a.privilege_type <> 'INSERT' OR att.attname NOT IN ('command_text','parsed_draft'))
    ) THEN
    RAISE EXCEPTION 'Rollback changed the safe owner_commands column insert contract';
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


-- Exercise the retained debt RPC as the authenticated Owner after rollback.
-- This catches SECURITY INVOKER + revoked-ledger-DML regressions end to end.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', TRUE);
SELECT public.ego_pay_debt_atomic(
  'abababab-abab-4bab-8bab-abababababab',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  5.00,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  TRUE,
  CURRENT_DATE,
  'rollback authenticated RPC smoke test'
);
ROLLBACK;

SELECT 'EGO-PERSONAL rollback assertions passed' AS result;
