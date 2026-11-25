-- Enforce the Owner-confirmation invariant for posted transactions.
-- Review and apply manually to EGO-PERSONAL only after approval.
-- This file is not executed by the application or deployment automatically.

DO $ego$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_posted_requires_owner_confirmation'
      AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_posted_requires_owner_confirmation
      CHECK (status <> 'posted' OR owner_confirmed IS TRUE)
      NOT VALID;
  END IF;
END;
$ego$;

-- Existing production audit found no posted rows without Owner confirmation.
-- Validation will fail safely rather than changing any transaction data if that
-- condition is no longer true when this migration is eventually applied.
ALTER TABLE public.transactions
  VALIDATE CONSTRAINT transactions_posted_requires_owner_confirmation;
