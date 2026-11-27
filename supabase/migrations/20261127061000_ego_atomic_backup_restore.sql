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
  v_fk record;
  v_fk_violation boolean;
  v_unknown_keys text[];
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

  -- owner_email/exported_at are descriptive metadata, not proof of file
  -- authenticity. Authorization is the live authenticated UID plus the
  -- explicit confirmation below; a JSON file can be edited by its holder.
  if p_backup ? 'owner_email'
    and p_backup->'owner_email' <> 'null'::jsonb
    and pg_catalog.jsonb_typeof(p_backup->'owner_email') <> 'string' then
    raise exception 'Metadata email Owner tidak valid.' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_backup->'data') is distinct from 'object' then
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
    if pg_catalog.jsonb_typeof(v_rows) is distinct from 'array' then
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
        or NULLIF(v_row->>'id', '') is null then
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

      -- Reject unknown fields rather than silently discarding them during
      -- jsonb_populate_record. The only legacy client-only field allowed is
      -- accounts.current_balance, which is intentionally not persisted.
      select pg_catalog.array_agg(keys.key order by keys.key)
        into v_unknown_keys
      from pg_catalog.jsonb_object_keys(v_row) as keys(key)
      where not exists (
        select 1
        from pg_catalog.pg_attribute a
        where a.attrelid = pg_catalog.to_regclass(pg_catalog.format('public.%I', v_table))
          and a.attname = keys.key
          and a.attnum > 0
          and not a.attisdropped
      )
      and not (v_table = 'accounts' and keys.key = 'current_balance');

      if v_unknown_keys is not null then
        raise exception 'Field tidak dikenal pada koleksi "%": %',
          v_table, pg_catalog.array_to_string(v_unknown_keys, ', ')
          using errcode = '22023';
      end if;

      -- Foreign keys into another Owner's rows must never be accepted.
      -- Discover single-column references to public tables that carry owner_id.
      for v_fk in
        select
          child_att.attname as child_column,
          parent.relname as parent_table,
          parent_att.attname as parent_column
        from pg_catalog.pg_constraint c
        join pg_catalog.pg_class child on child.oid = c.conrelid
        join pg_catalog.pg_namespace child_ns on child_ns.oid = child.relnamespace
        join pg_catalog.pg_class parent on parent.oid = c.confrelid
        join pg_catalog.pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
        join unnest(c.conkey) with ordinality child_key(attnum, ord) on true
        join unnest(c.confkey) with ordinality parent_key(attnum, ord)
          on parent_key.ord = child_key.ord
        join pg_catalog.pg_attribute child_att
          on child_att.attrelid = child.oid and child_att.attnum = child_key.attnum
        join pg_catalog.pg_attribute parent_att
          on parent_att.attrelid = parent.oid and parent_att.attnum = parent_key.attnum
        where c.contype = 'f'
          and c.conrelid = pg_catalog.to_regclass(pg_catalog.format('public.%I', v_table))
          and child_ns.nspname = 'public'
          and parent_ns.nspname = 'public'
          and pg_catalog.cardinality(c.conkey) = 1
          and exists (
            select 1 from pg_catalog.pg_attribute owner_att
            where owner_att.attrelid = parent.oid
              and owner_att.attname = 'owner_id'
              and owner_att.attnum > 0
              and not owner_att.attisdropped
          )
      loop
        execute pg_catalog.format(
          'select (r.%I is not null and not exists (' ||
          'select 1 from public.%I p where p.%I = r.%I and p.owner_id = $2)) ' ||
          'from pg_catalog.jsonb_populate_record(null::public.%I, $1) as r',
          v_fk.child_column,
          v_fk.parent_table,
          v_fk.parent_column,
          v_fk.child_column,
          v_table
        )
        into v_fk_violation
        using v_row, v_owner;

        if v_fk_violation then
          raise exception 'Referensi pada kolom "%" koleksi "%" bukan milik Owner aktif.',
            v_fk.child_column, v_table using errcode = '42501';
        end if;
      end loop;

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
grant execute on function public.ego_restore_backup(jsonb, boolean) to authenticated;

comment on function public.ego_restore_backup(jsonb, boolean) is
  'Atomic additive-only EGO backup restore. Requires authenticated Owner UID and explicit Owner confirmation; treats backup metadata as untrusted, enforces known columns and same-Owner single-column foreign keys, skips identical rows and aborts on conflicts.';

commit;
