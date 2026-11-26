-- EGO-PERSONAL RPC alignment rollback plan.
-- Run only after the application release has been rolled back to a version that
-- no longer calls the new RPC contract. Review against current ACLs before use.
-- This restores selected pre-alignment DML grants observed on 2026-11-26.
-- SECURITY HARDENING IS INTENTIONALLY NOT REVERSED: do not restore TRUNCATE,
-- TRIGGER, or REFERENCES for anon/authenticated, and do not restore their
-- default privileges. Those grants were over-broad and unrelated to app rollback.

BEGIN;

DROP FUNCTION IF EXISTS public.approve_owner_command(uuid, boolean, jsonb);
DROP FUNCTION IF EXISTS public.reject_owner_command(uuid);
DROP FUNCTION IF EXISTS public.cancel_confirmed_transaction(uuid);
DROP FUNCTION IF EXISTS public.create_confirmed_transaction(uuid, text, uuid, uuid, numeric, date, text, text, boolean);

-- Restore the original SECURITY INVOKER posture of the existing PERSONAL debt RPC.
ALTER FUNCTION public.ego_pay_debt_atomic(uuid, uuid, numeric, uuid, boolean, date, text)
  SECURITY INVOKER;
ALTER FUNCTION public.ego_pay_debt_atomic(uuid, uuid, numeric, uuid, boolean, date, text)
  SET search_path = public, pg_temp;

-- Restore the grants observed before the candidate migration.
GRANT INSERT, UPDATE ON TABLE public.transactions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.debt_payment_logs TO authenticated;
GRANT UPDATE ON TABLE public.owner_commands TO authenticated;

-- Keep the debt RPC callable by authenticated Owner only.
REVOKE ALL ON FUNCTION public.ego_pay_debt_atomic(uuid, uuid, numeric, uuid, boolean, date, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ego_pay_debt_atomic(uuid, uuid, numeric, uuid, boolean, date, text)
  TO authenticated;

COMMIT;
