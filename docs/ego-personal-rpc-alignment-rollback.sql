-- EGO-PERSONAL RPC alignment rollback plan.
-- Run only after the application release has been rolled back to a version that
-- no longer calls the new RPC contract. Review against current ACLs before use.
-- Restores the pre-alignment debt RPC implementation from
-- supabase/migrations/20261126000200_atomic_debt_payment.sql and selected DML grants.
-- SECURITY HARDENING IS INTENTIONALLY NOT REVERSED: do not restore TRUNCATE,
-- MAINTAIN, TRIGGER, or REFERENCES for anon/authenticated, and do not restore their
-- default privileges. Those grants were over-broad and unrelated to app rollback.

BEGIN;

DROP FUNCTION IF EXISTS public.approve_owner_command(uuid, boolean);
DROP FUNCTION IF EXISTS public.save_owner_command_draft(uuid, jsonb);
DROP FUNCTION IF EXISTS public.reject_owner_command(uuid);
DROP FUNCTION IF EXISTS public.cancel_confirmed_transaction(uuid);
DROP FUNCTION IF EXISTS public.create_confirmed_transaction(uuid, text, uuid, uuid, numeric, date, text, text, boolean);

-- Keep the hardened, signature-compatible SECURITY DEFINER debt RPC installed.
-- Restoring the old SECURITY INVOKER body while direct ledger DML remains revoked
-- would make authenticated debt payments fail with permission errors. The current
-- RPC derives auth.uid(), requires explicit Owner confirmation, validates ownership,
-- and writes atomically; it remains callable by the previous app through the same
-- seven-argument contract. Rollback removes only the newer command/transaction RPCs.

-- Do NOT restore direct ledger DML grants during rollback.
-- The prior app release must be adapted to use the retained authenticated RPC
-- contract before rollback. Re-granting INSERT/UPDATE/DELETE here would reopen
-- the bypass around explicit Owner confirmation and reintroduce the ACL flaw.
-- If the prior app cannot use the RPC contract, keep finance writes disabled
-- until a compatible app build is available; do not weaken database security.

-- Keep the debt RPC callable by authenticated Owner only.
REVOKE ALL ON FUNCTION public.ego_pay_debt_atomic(uuid, uuid, numeric, uuid, boolean, date, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ego_pay_debt_atomic(uuid, uuid, numeric, uuid, boolean, date, text)
  TO authenticated;

COMMIT;
