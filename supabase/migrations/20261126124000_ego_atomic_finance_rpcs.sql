-- EGO storage RPC v2.2: atomic ledger operations, EGO-TEST only.
-- Functions are SECURITY INVOKER: RLS and auth.uid() remain in force.
begin;

create or replace function public.create_confirmed_transaction(
  p_id uuid,
  p_transaction_type text,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_transaction_date date,
  p_category text,
  p_description text,
  p_owner_confirmed boolean
)
returns public.transactions
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_existing public.transactions;
begin
  if v_owner is null then
    raise exception 'Autentikasi Owner diperlukan.' using errcode = '28000';
  end if;
  if p_owner_confirmed is distinct from true then
    raise exception 'Persetujuan eksplisit Owner wajib sebelum transaksi diposting.' using errcode = '42501';
  end if;
  if p_id is null or p_amount is null or p_amount <= 0 or p_transaction_date is null then
    raise exception 'Data transaksi tidak valid.' using errcode = '22023';
  end if;
  if not (
    (p_transaction_type = 'income' and p_source_account_id is null and p_destination_account_id is not null)
    or (p_transaction_type = 'expense' and p_source_account_id is not null and p_destination_account_id is null)
    or (p_transaction_type = 'transfer' and p_source_account_id is not null
      and p_destination_account_id is not null and p_source_account_id <> p_destination_account_id)
  ) then
    raise exception 'Pasangan akun transaksi tidak valid.' using errcode = '22023';
  end if;

  select * into v_existing
  from public.transactions
  where id = p_id and owner_id = v_owner
  for update;

  if found then
    if v_existing.transaction_type = p_transaction_type
      and v_existing.source_account_id is not distinct from p_source_account_id
      and v_existing.destination_account_id is not distinct from p_destination_account_id
      and v_existing.amount = p_amount
      and v_existing.transaction_date = p_transaction_date
      and v_existing.category is not distinct from p_category
      and v_existing.description is not distinct from p_description
      and v_existing.status = 'posted'
      and v_existing.owner_confirmed = true then
      return v_existing;
    end if;
    raise exception 'ID transaksi sudah digunakan untuk data berbeda.' using errcode = '23505';
  end if;

  insert into public.transactions (
    id, owner_id, transaction_type, source_account_id, destination_account_id,
    amount, transaction_date, category, description, status, owner_confirmed, idempotency_key
  ) values (
    p_id, v_owner, p_transaction_type, p_source_account_id, p_destination_account_id,
    p_amount, p_transaction_date, p_category, p_description, 'posted', true, p_id::text
  )
  returning * into v_existing;

  return v_existing;
end;
$$;

create or replace function public.cancel_confirmed_transaction(p_id uuid)
returns public.transactions
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_tx public.transactions;
begin
  if v_owner is null then
    raise exception 'Autentikasi Owner diperlukan.' using errcode = '28000';
  end if;
  select * into v_tx
  from public.transactions
  where id = p_id and owner_id = v_owner
  for update;
  if not found then
    raise exception 'Transaksi tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_tx.status = 'cancelled' then
    raise exception 'Transaksi sudah dibatalkan.' using errcode = '22023';
  end if;
  update public.transactions
  set status = 'cancelled'
  where id = p_id and owner_id = v_owner
  returning * into v_tx;
  return v_tx;
end;
$$;

create or replace function public.approve_owner_command(
  p_command_id uuid,
  p_owner_confirmed boolean,
  p_draft jsonb default null
)
returns public.transactions
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_cmd public.owner_commands;
  v_draft jsonb;
  v_tx public.transactions;
  v_type text;
  v_amount numeric;
  v_source uuid;
  v_destination uuid;
  v_date date;
  v_category text;
  v_description text;
begin
  if v_owner is null then
    raise exception 'Autentikasi Owner diperlukan.' using errcode = '28000';
  end if;
  if p_owner_confirmed is distinct from true then
    raise exception 'Persetujuan eksplisit Owner wajib sebelum menjalankan perintah.' using errcode = '42501';
  end if;

  select * into v_cmd
  from public.owner_commands
  where id = p_command_id and owner_id = v_owner
  for update;
  if not found then
    raise exception 'Perintah tidak ditemukan.' using errcode = 'P0002';
  end if;

  if v_cmd.status = 'processed' then
    select * into v_tx from public.transactions
    where id = v_cmd.id and owner_id = v_owner;
    if not found then
      raise exception 'Perintah sudah diproses tetapi transaksi tidak ditemukan.' using errcode = 'P0002';
    end if;
    return v_tx;
  end if;
  if v_cmd.status <> 'pending' then
    raise exception 'Perintah sudah tidak berstatus pending.' using errcode = '22023';
  end if;

  v_draft := coalesce(p_draft, v_cmd.parsed_draft);
  if v_draft is null or jsonb_typeof(v_draft) <> 'object' then
    raise exception 'Draf transaksi tidak tersedia.' using errcode = '22023';
  end if;

  v_type := v_draft->>'transaction_type';
  v_amount := nullif(v_draft->>'amount','')::numeric;
  v_source := nullif(v_draft->>'source_account_id','')::uuid;
  v_destination := nullif(v_draft->>'destination_account_id','')::uuid;
  v_date := coalesce(nullif(v_draft->>'transaction_date','')::date, current_date);
  v_category := coalesce(nullif(btrim(v_draft->>'category'),''),'Lainnya');
  v_description := coalesce(nullif(btrim(v_draft->>'description'),''),v_cmd.command_text);

  if v_type = 'income' then
    v_source := null;
  elsif v_type = 'expense' then
    v_destination := null;
  end if;

  v_tx := public.create_confirmed_transaction(
    v_cmd.id, v_type, v_source, v_destination, v_amount,
    v_date, v_category, v_description, true
  );

  update public.owner_commands
  set status = 'processed',
      owner_confirmed = true,
      processed_at = now(),
      parsed_draft = jsonb_build_object(
        'transaction_type', v_type,
        'amount', v_amount,
        'category', v_category,
        'description', v_description,
        'source_account_id', v_source,
        'destination_account_id', v_destination,
        'transaction_date', v_date
      )
  where id = v_cmd.id and owner_id = v_owner;

  return v_tx;
end;
$$;

create or replace function public.pay_debt_atomically(
  p_debt_id uuid,
  p_request_id uuid,
  p_amount numeric,
  p_source_account_id uuid,
  p_notes text,
  p_owner_confirmed boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_debt public.debts;
  v_log public.debt_payment_logs;
  v_tx public.transactions;
  v_new_balance numeric;
begin
  if v_owner is null then
    raise exception 'Autentikasi Owner diperlukan.' using errcode = '28000';
  end if;
  if p_owner_confirmed is distinct from true then
    raise exception 'Persetujuan eksplisit Owner wajib sebelum membayar utang.' using errcode = '42501';
  end if;
  if p_request_id is null or p_amount is null or p_amount <= 0 or p_source_account_id is null then
    raise exception 'Data pembayaran utang tidak valid.' using errcode = '22023';
  end if;

  select * into v_log
  from public.debt_payment_logs
  where owner_id = v_owner and request_id = p_request_id::text;
  if found then
    select * into v_tx from public.transactions
    where id = v_log.transaction_id and owner_id = v_owner;
    if v_log.debt_id = p_debt_id
      and v_log.amount = p_amount
      and v_log.notes is not distinct from p_notes
      and v_tx.source_account_id is not distinct from p_source_account_id then
      select * into v_debt from public.debts where id = p_debt_id and owner_id = v_owner;
      return jsonb_build_object('debt',to_jsonb(v_debt),'transaction',to_jsonb(v_tx),'log',to_jsonb(v_log),'replayed',true);
    end if;
    raise exception 'ID pembayaran sudah digunakan untuk rincian berbeda.' using errcode = '23505';
  end if;

  select * into v_debt
  from public.debts
  where id = p_debt_id and owner_id = v_owner
  for update;
  if not found then
    raise exception 'Data utang tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_debt.status = 'paid' or v_debt.outstanding_balance <= 0 then
    raise exception 'Utang sudah lunas.' using errcode = '22023';
  end if;
  if p_amount > v_debt.outstanding_balance then
    raise exception 'Pembayaran melebihi sisa utang.' using errcode = '22023';
  end if;
  perform 1 from public.accounts
  where id = p_source_account_id and owner_id = v_owner;
  if not found then
    raise exception 'Akun sumber tidak ditemukan atau bukan milik Owner.' using errcode = '23503';
  end if;

  v_new_balance := greatest(0, v_debt.outstanding_balance - p_amount);

  insert into public.transactions (
    owner_id, transaction_type, source_account_id, destination_account_id,
    amount, transaction_date, category, description, status, owner_confirmed, idempotency_key
  ) values (
    v_owner, 'expense', p_source_account_id, null, p_amount, current_date,
    'Utang & Cicilan', 'Pembayaran utang ke ' || v_debt.creditor,
    'posted', true, 'debt-payment:' || p_request_id::text
  )
  returning * into v_tx;

  update public.debts
  set outstanding_balance = v_new_balance,
      status = case when v_new_balance = 0 then 'paid' else 'active' end,
      updated_at = now()
  where id = v_debt.id and owner_id = v_owner
  returning * into v_debt;

  insert into public.debt_payment_logs (
    owner_id, debt_id, transaction_id, request_id, amount,
    principal_paid, interest_paid, remaining_after, notes
  ) values (
    v_owner, v_debt.id, v_tx.id, p_request_id::text, p_amount,
    p_amount, 0, v_new_balance, p_notes
  )
  returning * into v_log;

  return jsonb_build_object('debt',to_jsonb(v_debt),'transaction',to_jsonb(v_tx),'log',to_jsonb(v_log),'replayed',false);
end;
$$;

revoke all on function public.create_confirmed_transaction(uuid,text,uuid,uuid,numeric,date,text,text,boolean) from public, anon;
revoke all on function public.cancel_confirmed_transaction(uuid) from public, anon;
revoke all on function public.approve_owner_command(uuid,boolean,jsonb) from public, anon;
revoke all on function public.pay_debt_atomically(uuid,uuid,numeric,uuid,text,boolean) from public, anon;
grant execute on function public.create_confirmed_transaction(uuid,text,uuid,uuid,numeric,date,text,text,boolean) to authenticated;
grant execute on function public.cancel_confirmed_transaction(uuid) to authenticated;
grant execute on function public.approve_owner_command(uuid,boolean,jsonb) to authenticated;
grant execute on function public.pay_debt_atomically(uuid,uuid,numeric,uuid,text,boolean) to authenticated;

commit;
