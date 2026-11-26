-- EGO storage RPC smoke test. Run only against EGO-TEST or another disposable test project.
-- Creates synthetic auth users and finance rows inside one transaction, then ROLLBACKs everything.
begin;

insert into auth.users
  (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111','authenticated','authenticated','ego-smoke-a@invalid.local','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('22222222-2222-4222-8222-222222222222','authenticated','authenticated','ego-smoke-b@invalid.local','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

insert into public.accounts (id, owner_id, account_name, account_type, opening_balance)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Synthetic A','cash',1000),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Synthetic B','bank',2000);

insert into public.debts (id, owner_id, creditor, original_amount, outstanding_balance, status)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','Synthetic Creditor',500,500,'active');

insert into public.owner_commands (id, owner_id, command_text, status, parsed_draft)
values ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Synthetic command','pending',
'{"transaction_type":"expense","amount":50,"category":"Test","description":"Synthetic command approval","source_account_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","destination_account_id":null,"transaction_date":"2026-11-26"}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);

do $$
declare
  v_tx public.transactions;
  v_result jsonb;
  v_count integer;
begin
  -- RLS: Owner A sees only A's account and cannot mutate/insert Owner B rows.
  if (select count(*) from public.accounts) <> 1 then raise exception 'FAIL: RLS SELECT isolation'; end if;
  update public.accounts set account_name='MUTATED' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if found then raise exception 'FAIL: RLS cross-owner UPDATE'; end if;
  begin
    insert into public.accounts (id,owner_id,account_name,account_type)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','forbidden','cash');
    raise exception 'FAIL: RLS cross-owner INSERT';
  exception when insufficient_privilege then null;
  end;

  -- Explicit Owner confirmation and idempotent transaction create.
  begin
    perform public.create_confirmed_transaction(
      '33333333-3333-4333-8333-333333333333','expense',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,100,current_date,'Test','unconfirmed',false
    );
    raise exception 'FAIL: unconfirmed transaction accepted';
  exception when insufficient_privilege then null;
  end;

  v_tx := public.create_confirmed_transaction(
    '33333333-3333-4333-8333-333333333333','expense',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,100,current_date,'Test','confirmed',true
  );
  if v_tx.status <> 'posted' or v_tx.owner_confirmed is not true then raise exception 'FAIL: posted confirmation'; end if;

  perform public.create_confirmed_transaction(
    '33333333-3333-4333-8333-333333333333','expense',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,100,current_date,'Test','confirmed',true
  );
  select count(*) into v_count from public.transactions where id='33333333-3333-4333-8333-333333333333';
  if v_count <> 1 then raise exception 'FAIL: transaction duplicate on retry'; end if;

  begin
    perform public.create_confirmed_transaction(
      '33333333-3333-4333-8333-333333333333','expense',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,101,current_date,'Test','different',true
    );
    raise exception 'FAIL: conflicting transaction retry accepted';
  exception when unique_violation then null;
  end;

  -- Invalid transfer shape and cross-owner account reference are rejected.
  begin
    perform public.create_confirmed_transaction(
      '66666666-6666-4666-8666-666666666666','transfer',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      10,current_date,'Transfer','same account',true
    );
    raise exception 'FAIL: same-account transfer accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.create_confirmed_transaction(
      '77777777-7777-4777-8777-777777777777','income',
      null,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',10,current_date,'Cross-owner','wrong owner',true
    );
    raise exception 'FAIL: cross-owner account reference accepted';
  exception when foreign_key_violation then null;
  end;

  -- Command approval and its transaction are committed atomically and replay safely.
  begin
    perform public.approve_owner_command('44444444-4444-4444-8444-444444444444',false,null);
    raise exception 'FAIL: command approved without Owner confirmation';
  exception when insufficient_privilege then null;
  end;
  v_tx := public.approve_owner_command('44444444-4444-4444-8444-444444444444',true,null);
  if v_tx.status <> 'posted' then raise exception 'FAIL: command did not post'; end if;
  if not exists (select 1 from public.owner_commands where id='44444444-4444-4444-8444-444444444444' and status='processed' and owner_confirmed) then
    raise exception 'FAIL: command state not updated';
  end if;
  perform public.approve_owner_command('44444444-4444-4444-8444-444444444444',true,null);
  select count(*) into v_count from public.transactions where id='44444444-4444-4444-8444-444444444444';
  if v_count <> 1 then raise exception 'FAIL: command approval retry duplicated transaction'; end if;

  -- Debt, posted expense transaction, and payment log are one atomic operation.
  v_result := public.pay_debt_atomically(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '55555555-5555-4555-8555-555555555555',
    100,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','synthetic payment',true
  );
  if v_result->>'replayed' <> 'false' then raise exception 'FAIL: first payment marked replay'; end if;
  if (select outstanding_balance from public.debts where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 400 then
    raise exception 'FAIL: debt balance not updated';
  end if;
  if (select count(*) from public.debt_payment_logs where request_id='55555555-5555-4555-8555-555555555555') <> 1 then
    raise exception 'FAIL: payment log missing';
  end if;
  v_result := public.pay_debt_atomically(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '55555555-5555-4555-8555-555555555555',
    100,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','synthetic payment',true
  );
  if v_result->>'replayed' <> 'true' then raise exception 'FAIL: payment retry not deduplicated'; end if;
  if (select count(*) from public.debt_payment_logs where request_id='55555555-5555-4555-8555-555555555555') <> 1 then
    raise exception 'FAIL: duplicate payment log';
  end if;

  -- Failed overpayment rolls back without changing the debt.
  begin
    perform public.pay_debt_atomically(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '88888888-8888-4888-8888-888888888888',
      500,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','overpay',true
    );
    raise exception 'FAIL: overpayment accepted';
  exception when invalid_parameter_value then null;
  end;
  if (select outstanding_balance from public.debts where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 400 then
    raise exception 'FAIL: rejected overpayment changed debt';
  end if;

  -- Cancellation is owner-scoped and updates the ledger row.
  perform public.cancel_confirmed_transaction('33333333-3333-4333-8333-333333333333');
  if (select status from public.transactions where id='33333333-3333-4333-8333-333333333333') <> 'cancelled' then
    raise exception 'FAIL: cancellation did not update transaction';
  end if;
end $$;

reset role;
rollback;
