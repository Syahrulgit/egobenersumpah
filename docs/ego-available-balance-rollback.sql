-- Rollback for 20261127000100_enforce_available_account_balance.
DROP FUNCTION public.create_confirmed_transaction(uuid,text,uuid,uuid,numeric,date,text,boolean);
ALTER FUNCTION public.create_confirmed_transaction_internal(uuid,text,uuid,uuid,numeric,date,text,text,boolean)
  RENAME TO create_confirmed_transaction;
GRANT EXECUTE ON FUNCTION public.create_confirmed_transaction(uuid,text,uuid,uuid,numeric,date,text,text,boolean)
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_confirmed_transaction(uuid,text,uuid,uuid,numeric,date,text,text,boolean)
  FROM anon, PUBLIC;

DROP FUNCTION public.ego_pay_debt_atomic(uuid,uuid,numeric,uuid,boolean,date,text);
ALTER FUNCTION public.ego_pay_debt_atomic_internal(uuid,uuid,numeric,uuid,boolean,date,text)
  RENAME TO ego_pay_debt_atomic;
GRANT EXECUTE ON FUNCTION public.ego_pay_debt_atomic(uuid,uuid,numeric,uuid,boolean,date,text)
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ego_pay_debt_atomic(uuid,uuid,numeric,uuid,boolean,date,text)
  FROM anon, PUBLIC;
