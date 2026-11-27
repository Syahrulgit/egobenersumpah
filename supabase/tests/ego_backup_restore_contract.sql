\set ON_ERROR_STOP on

-- Synthetic-only contract test for the additive, atomic EGO restore RPC.
DO $restore_contract$
DECLARE
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_other uuid := '22222222-2222-4222-8222-222222222222';
  v_backup jsonb;
  v_result jsonb;
  v_conflict_backup jsonb;
  v_unconfirmed_backup jsonb;
  v_has_row boolean;
  v_oid oid;
BEGIN
  v_oid := pg_catalog.to_regprocedure('public.ego_restore_backup(jsonb,boolean)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Atomic restore RPC is missing';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_catalog.pg_proc WHERE oid = v_oid) THEN
    RAISE EXCEPTION 'Restore RPC must use its reviewed SECURITY DEFINER boundary';
  END IF;
  IF NOT (SELECT COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""'] FROM pg_catalog.pg_proc WHERE oid = v_oid) THEN
    RAISE EXCEPTION 'Restore RPC must pin an empty search_path';
  END IF;
  IF pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute the restore RPC';
  END IF;
  IF NOT pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated Owner must be able to execute the restore RPC';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_owner,
      'email', 'owner@example.com',
      'role', 'authenticated'
    )::text,
    true
  );

  v_backup := pg_catalog.jsonb_build_object(
    'app', 'EGO Personal AI',
    'version', '1.0',
    'exported_at', '2026-11-27T05:00:00Z',
    'owner_email', 'owner@example.com',
    'data', pg_catalog.jsonb_build_object(
      'accounts', pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'id', '01010101-0101-4101-8101-010101010101',
          'owner_id', v_other,
          'account_name', 'Restored cash',
          'account_type', 'cash',
          'opening_balance', 25000,
          'currency', 'IDR',
          'is_active', true,
          'created_at', '2026-11-27T05:00:00Z',
          'current_balance', 25000
        )
      ),
      'assets', '[]'::jsonb,
      'debts', pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'id', '02020202-0202-4202-8202-020202020202',
          'owner_id', v_other,
          'creditor', 'Restored creditor',
          'description', 'Synthetic restore test',
          'original_amount', 100,
          'outstanding_balance', 100,
          'due_date', null,
          'status', 'active',
          'notes', null,
          'created_at', '2026-11-27T05:00:00Z',
          'updated_at', '2026-11-27T05:00:00Z',
          'debt_type', 'lainnya',
          'interest_rate', null,
          'installment_amount', 0,
          'interest_rate_annual', 0,
          'monthly_fee', 0,
          'payment_frequency', 'monthly'
        )
      ),
      'recurring_bills', '[]'::jsonb,
      'savings_goals', '[]'::jsonb,
      'transactions', pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'id', '03030303-0303-4303-8303-030303030303',
          'owner_id', v_other,
          'transaction_date', '2026-11-27',
          'transaction_type', 'income',
          'category', 'Restore test',
          'amount', 100,
          'source_account_id', null,
          'destination_account_id', '01010101-0101-4101-8101-010101010101',
          'description', 'Synthetic restore test',
          'owner_confirmed', true,
          'status', 'posted',
          'recorded_at', '2026-11-27T05:00:00Z',
          'source_command', null,
          'created_at', '2026-11-27T05:00:00Z'
        )
      ),
      'debt_payment_logs', pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'id', '04040404-0404-4404-8404-040404040404',
          'owner_id', v_other,
          'debt_id', '02020202-0202-4202-8202-020202020202',
          'transaction_id', '03030303-0303-4303-8303-030303030303',
          'amount', 10,
          'principal_paid', 10,
          'interest_paid', 0,
          'remaining_after', 90,
          'notes', 'Synthetic restore test',
          'created_at', '2026-11-27T05:00:00Z',
          'request_id', '05050505-0505-4505-8505-050505050505'
        )
      ),
      'owner_commands', pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'id', '06060606-0606-4606-8606-060606060606',
          'owner_id', v_other,
          'command_text', 'Synthetic restored command',
          'command_type', 'transaction',
          'status', 'pending',
          'owner_confirmed', false,
          'created_at', '2026-11-27T05:00:00Z',
          'processed_at', null,
          'parsed_draft', null
        )
      ),
      'financial_reminders', '[]'::jsonb,
      'financial_reminder_logs', '[]'::jsonb,
      'category_budgets', '[]'::jsonb,
      'budget_alert_logs', '[]'::jsonb,
      'whatif_scenarios', '[]'::jsonb,
      'financial_health_scores', '[]'::jsonb
    )
  );

  v_result := public.ego_restore_backup(v_backup, true);
  IF (v_result->>'inserted')::integer <> 5 OR (v_result->>'skipped_identical')::integer <> 0 THEN
    RAISE EXCEPTION 'Expected five inserted rows and no skips, got %', v_result;
  END IF;

  IF (SELECT owner_id FROM public.accounts WHERE id = '01010101-0101-4101-8101-010101010101') <> v_owner
    OR (SELECT owner_id FROM public.debts WHERE id = '02020202-0202-4202-8202-020202020202') <> v_owner
    OR (SELECT owner_id FROM public.transactions WHERE id = '03030303-0303-4303-8303-030303030303') <> v_owner
    OR (SELECT owner_id FROM public.debt_payment_logs WHERE id = '04040404-0404-4404-8404-040404040404') <> v_owner
    OR (SELECT owner_id FROM public.owner_commands WHERE id = '06060606-0606-4606-8606-060606060606') <> v_owner THEN
    RAISE EXCEPTION 'Restore trusted owner_id from the backup instead of binding rows to auth.uid()';
  END IF;

  -- A retry is idempotent: identical existing rows are skipped, never rewritten.
  v_result := public.ego_restore_backup(v_backup, true);
  IF (v_result->>'inserted')::integer <> 0 OR (v_result->>'skipped_identical')::integer <> 5 THEN
    RAISE EXCEPTION 'Expected idempotent retry to skip five identical rows, got %', v_result;
  END IF;

  -- Missing explicit Owner confirmation must reject before writing anything.
  v_unconfirmed_backup := pg_catalog.jsonb_set(
    v_backup,
    '{data,accounts}',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id', '07070707-0707-4707-8707-070707070707',
      'account_name', 'Must not be restored',
      'account_type', 'cash',
      'opening_balance', 0,
      'currency', 'IDR',
      'is_active', true,
      'created_at', '2026-11-27T05:00:00Z'
    ))
  );
  BEGIN
    PERFORM public.ego_restore_backup(v_unconfirmed_backup, false);
    RAISE EXCEPTION 'Unconfirmed restore unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  SELECT EXISTS(SELECT 1 FROM public.accounts WHERE id = '07070707-0707-4707-8707-070707070707')
    INTO v_has_row;
  IF v_has_row THEN
    RAISE EXCEPTION 'Unconfirmed restore wrote data';
  END IF;

  -- The backup Owner email must match the current authenticated JWT.
  v_conflict_backup := pg_catalog.jsonb_set(v_backup, '{owner_email}', '"other@example.com"'::jsonb);
  BEGIN
    PERFORM public.ego_restore_backup(v_conflict_backup, true);
    RAISE EXCEPTION 'Wrong-Owner backup unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- A different row using an existing ID aborts the whole restore. The new
  -- first row in this same call must be rolled back with the later conflict.
  v_conflict_backup := pg_catalog.jsonb_set(
    v_backup,
    '{data,accounts}',
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'id', '08080808-0808-4808-8808-080808080808',
        'account_name', 'Atomic rollback probe',
        'account_type', 'cash',
        'opening_balance', 0,
        'currency', 'IDR',
        'is_active', true,
        'created_at', '2026-11-27T05:00:00Z'
      ),
      pg_catalog.jsonb_build_object(
        'id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'account_name', 'Conflicting different row',
        'account_type', 'cash',
        'opening_balance', 100000,
        'currency', 'IDR',
        'is_active', true,
        'created_at', '2026-11-27T05:00:00Z'
      )
    )
  );
  BEGIN
    PERFORM public.ego_restore_backup(v_conflict_backup, true);
    RAISE EXCEPTION 'Conflicting restore unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  SELECT EXISTS(SELECT 1 FROM public.accounts WHERE id = '08080808-0808-4808-8808-080808080808')
    INTO v_has_row;
  IF v_has_row THEN
    RAISE EXCEPTION 'Atomic rollback failed: an earlier row survived a later conflict';
  END IF;

  -- No authenticated identity must be rejected.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '', true);
  PERFORM pg_catalog.set_config('request.jwt.claims', '', true);
  BEGIN
    PERFORM public.ego_restore_backup(v_backup, true);
    RAISE EXCEPTION 'Unauthenticated restore unexpectedly succeeded';
  EXCEPTION WHEN invalid_authorization_specification THEN
    NULL;
  END;
END
$restore_contract$;

select 'EGO atomic backup restore contract: PASS' as result;
