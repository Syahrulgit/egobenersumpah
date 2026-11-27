-- EGO-PERSONAL atomic, Owner-authorized backup restore.
-- Additive-only restore: exact existing rows are skipped; conflicting IDs abort
-- the entire transaction. No existing row is updated or deleted.
begin;

create or replace function public.ego_restore_backup(
  p_backup jsonb,
  p_owner_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner uuid := auth.uid();
  v_claim_email text;
  v_owner_email text;
  v_table text;
  v_rows jsonb;
  v_row jsonb;
  v_candidate jsonb;
  v_existing jsonb;
  v_inserted integer;
  v_skipped integer;
  v_total integer := 0;
  v_inserted_total integer := 0;
  v_skipped_total integer := 0;
  v_counts jsonb := '{}'::jsonb;
  v_exported_at timestamptz;
begin
  if v_owner is null then
    raise exception 'Autentikasi Owner diperlukan untuk pemulihan.' using errcode = '28000';
  end if;

  if p_owner_confirmed is distinct from true then
    raise exception 'Persetujuan eksplisit Owner wajib sebelum pemulihan.' using errcode = '42501';
  end if;

  if p_backup is null or pg_catalog.jsonb_typeof(p_backup) <> 'object' then
    raise exception 'File cadangan tidak valid.' using errcode = '22023';
  end if;
  if p_backup->>'app' is distinct from 'EGO Personal AI'
    or p_backup->>'version' is distinct from '1.0' then
    raise exception 'Aplikasi atau versi cadangan tidak didukung.' using errcode = '22023';
  end if;
  if pg_catalog.pg_column_size(p_backup) > 10485760 then
    raise exception 'File cadangan melebihi batas 10 MB.' using errcode = '22023';
  end if;

  begin
    v_exported_at := (p_backup->>'exported_at')::timestamptz;
  exception when others then
    raise exception 'Waktu ekspor cadangan tidak valid.' using errcode = '22023';
  end;
  if v_exported_at is null then
    raise exception 'Waktu ekspor cadangan wajib tersedia.' using errcode = '22023';
  end if;

  v_owner_email := pg_catalog.lower(pg_catalog.nullif(p_backup->>'owner_email', ''));
  v_claim_email := pg_catalog.lower(
    pg_catalog.coalesce(
      pg_catalog.nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
      pg_catalog.current_setting('request.jwt.claim.email', true)
    )
  );
  if v_owner_email is null or v_claim_email is null or v_owner_email <> v_claim_email then
    raise exception 'Cadangan bukan milik akun Owner yang sedang masuk.' using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(p_backup->'data') <> 'object' then
    raise exception 'Struktur data cadangan tidak valid.' using errcode = '22023';
  end if;

  -- Serialize restore attempts per Owner. All inserts remain in this one
  -- transaction; any error rolls back every row inserted by this function.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':ego-backup-restore', 0)
  );

  -- Parent rows precede their dependent rows. Missing optional tables are
  -- tolerated only when their backup collection is empty (older schemas).
  foreach v_table in array array[
    'accounts',
    'assets',
    'debts',
    'recurring_bills',
    'savings_goals',
    'transactions',
    'debt_payment_logs',
    'owner_commands',
    'financial_reminders',
    'financial_reminder_logs',
    'category_budgets',
    'budget_alert_logs',
    'whatif_scenarios',
    'financial_health_scores'
  ]
  loop
    v_rows := p_backup->'data'->v_table;
    if pg_catalog.jsonb_typeof(v_rows) <> 'array' then
      raise exception 'Koleksi cadangan "%" hilang atau bukan array.', v_table using errcode = '22023';
    end if;

    v_total := v_total + pg_catalog.jsonb_array_length(v_rows);
    if v_total > 10000 then
      raise exception 'Cadangan melebihi batas 10.000 baris.' using errcode = '22023';
    end if;

    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(v_rows) as item(value)
      group by item.value->>'id'
      having pg_catalog.count(*) > 1
    ) then
      raise exception 'ID ganda ditemukan pada koleksi "%". Tidak ada data yang dipulihkan.', v_table
        using errcode = '23505';
    end if;

    v_inserted := 0;
    v_skipped := 0;

    if pg_catalog.to_regclass(pg_catalog.format('public.%I', v_table)) is null then
      if pg_catalog.jsonb_array_length(v_rows) > 0 then
        raise exception 'Tabel tujuan "%" belum tersedia. Pemulihan dibatalkan.', v_table
          using errcode = '42P01';
      end if;
      v_counts := v_counts || pg_catalog.jsonb_build_object(
        v_table, pg_catalog.jsonb_build_object('inserted', 0, 'skipped', 0)
      );
      continue;
    end if;

    for v_row in
      select item.value
      from pg_catalog.jsonb_array_elements(v_rows) with ordinality as item(value, ordinal)
      order by item.ordinal
    loop
      if pg_catalog.jsonb_typeof(v_row) <> 'object'
        or pg_catalog.nullif(v_row->>'id', '') is null then
        raise exception 'Baris atau ID tidak valid pada koleksi "%".', v_table using errcode = '22023';
      end if;

      -- Never trust owner_id supplied by the backup. Bind every row to the
      -- authenticated Owner, and let the table's composite type discard
      -- client-only fields such as accounts.current_balance.
      v_row := pg_catalog.jsonb_set(
        v_row,
        '{owner_id}',
        pg_catalog.to_jsonb(v_owner),
        true
      );

      execute pg_catalog.format(
        'select pg_catalog.to_jsonb(r) from pg_catalog.jsonb_populate_record(null::public.%I, $1) as r',
        v_table
      )
      into v_candidate
      using v_row;

      execute pg_catalog.format(
        'select pg_catalog.to_jsonb(t) from public.%I as t where t.id = ($1->>''id'')::uuid',
        v_table
      )
      into v_existing
      using v_row;

      if v_existing is not null then
        if v_existing is distinct from v_candidate then
          raise exception 'ID pada koleksi "%" sudah ada dengan isi berbeda. Tidak ada data yang dipulihkan.',
            v_table using errcode = '23505';
        end if;
        v_skipped := v_skipped + 1;
        continue;
      end if;

      execute pg_catalog.format(
        'insert into public.%I select * from pg_catalog.jsonb_populate_record(null::public.%I, $1)',
        v_table,
        v_table
      )
      using v_row;

      v_inserted := v_inserted + 1;
    end loop;

    v_inserted_total := v_inserted_total + v_inserted;
    v_skipped_total := v_skipped_total + v_skipped;
    v_counts := v_counts || pg_catalog.jsonb_build_object(
      v_table,
      pg_catalog.jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped)
    );
  end loop;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'owner_id', v_owner,
    'inserted', v_inserted_total,
    'skipped_identical', v_skipped_total,
    'collections', v_counts,
    'restored_at', pg_catalog.now()
  );
end;
$function$;

revoke all on function public.ego_restore_backup(jsonb, boolean) from public;
revoke all on function public.ego_restore_backup(jsonb, boolean) from anon;
revoke all on function public.ego_restore_backup(jsonb, boolean) from service_role;
grant execute on function public.ego_restore_backup(jsonb, boolean) to authenticated;

comment on function public.ego_restore_backup(jsonb, boolean) is
  'Atomic additive-only EGO backup restore. Requires authenticated Owner, matching JWT email, explicit Owner confirmation; skips identical rows and aborts on conflicts.';

commit;
