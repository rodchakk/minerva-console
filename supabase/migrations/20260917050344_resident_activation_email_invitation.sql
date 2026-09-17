-- Auth email identifies one account project-wide. Failed rows are retryable;
-- activated rows reserve the identity, while skipped rows are terminal history.
-- Existing conflicting data must stop deployment, never be rewritten here.
create unique index ux_raq_live_email_identity
  on public.resident_activation_queue (lower(btrim(email)))
  where nullif(btrim(email), '') is not null
    and status in ('pending', 'invited', 'pin_generated', 'activated', 'failed');

-- Preserve canonical bulk contracts while classifying email reservations per row.
CREATE OR REPLACE FUNCTION public.confirm_resident_bulk_import_v1(p_community_id uuid, p_rows jsonb, p_create_missing_units boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_existing public.resident_activation_queue%rowtype;
  v_constraint text;
  v_lock_email text;
  v_row jsonb;
  v_index int := 0;
  v_unit_label text;
  v_normalized_unit_label text;
  v_resident_name text;
  v_phone text;
  v_email text;
  v_is_owner boolean;
  v_house_id uuid;
  v_activation_method text;
  v_suggested_username text;
  v_raw_data jsonb;
  v_inserted int := 0;
  v_failed int := 0;
  v_skipped_duplicates int := 0;
  v_missing_units_created int := 0;
  v_missing_units_uncreated int := 0;
  v_results jsonb := '[]'::jsonb;
  v_errors text[];
  v_duplicate_existing boolean;
  v_queue_id uuid;
begin
  if not public.is_superadmin() then
    raise exception 'superadmin_required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.communities where id = p_community_id) then
    raise exception 'community_not_found' using errcode = 'P0001';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array' using errcode = 'P0001';
  end if;

  -- Acquire batch email locks in stable order to avoid reversed-batch deadlocks.
  for v_lock_email in
    select distinct nullif(lower(btrim(coalesce(r->>'email', r->>'Email', r->>'correo', r->>'Correo', ''))), '')
    from jsonb_array_elements(p_rows) r
    order by 1
  loop
    if v_lock_email is not null then
      perform pg_advisory_xact_lock(hashtextextended('entry-raq-email|' || v_lock_email, 0));
    end if;
  end loop;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_index := v_index + 1;
    v_errors := array[]::text[];
    v_house_id := null;
    v_queue_id := null;
    v_duplicate_existing := false;

    v_unit_label := nullif(trim(coalesce(v_row->>'unit_label', v_row->>'Unit Label', v_row->>'unit', v_row->>'house_label', v_row->>'House Label', '')), '');
    v_resident_name := nullif(trim(coalesce(v_row->>'resident_name', v_row->>'Resident Name', v_row->>'name', v_row->>'Name', v_row->>'full_name', v_row->>'Full Name', '')), '');
    v_phone := nullif(trim(coalesce(v_row->>'phone', v_row->>'Phone', v_row->>'telefono', v_row->>'Teléfono', '')), '');
    v_email := nullif(lower(trim(coalesce(v_row->>'email', v_row->>'Email', v_row->>'correo', v_row->>'Correo', ''))), '');
    v_is_owner := case
      when lower(trim(coalesce(v_row->>'is_owner', v_row->>'Is Owner', v_row->>'owner', v_row->>'Owner', ''))) in ('true','t','yes','y','1','si','sí','owner','propietario') then true
      else false
    end;
    v_normalized_unit_label := public.normalize_unit_label(v_unit_label);

    if v_unit_label is null or v_normalized_unit_label = '' then
      v_errors := array_append(v_errors, 'missing_unit_label');
    end if;

    if v_resident_name is null then
      v_errors := array_append(v_errors, 'missing_resident_name');
    end if;

    if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      v_errors := array_append(v_errors, 'invalid_email');
    end if;

    if array_length(v_errors, 1) is not null then
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row_number', v_index,
        'status', 'failed',
        'errors', to_jsonb(v_errors),
        'original_row', v_row
      ));
      continue;
    end if;

    select h.id into v_house_id
    from public.houses h
    where h.community_id = p_community_id
      and public.normalize_unit_label(h.house_label) = v_normalized_unit_label
    order by h.is_active desc, h.created_at asc
    limit 1;

    if v_email is not null then
    select * into v_existing from public.resident_activation_queue
      where lower(btrim(email)) = v_email
        and status in ('pending','invited','pin_generated','activated','failed')
      for update;
    if found then
      if v_existing.community_id = p_community_id
         and public.normalize_unit_label(v_existing.unit_label) = public.normalize_unit_label(v_unit_label)
         and (v_existing.house_id is null or v_existing.house_id is not distinct from v_house_id)
         and lower(btrim(regexp_replace(v_existing.resident_name, '\s+', ' ', 'g'))) =
             lower(btrim(regexp_replace(v_resident_name, '\s+', ' ', 'g'))) then
        v_skipped_duplicates := v_skipped_duplicates + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'row_number', v_index, 'status', 'skipped_duplicate',
          'queue_id', v_existing.id, 'existing_status', v_existing.status,
          'unit_label', v_unit_label, 'resident_name', v_resident_name));
      else
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'row_number', v_index, 'status', 'failed',
          'errors', jsonb_build_array('resident_activation_conflict'),
          'queue_id', v_existing.id, 'existing_status', v_existing.status,
          'original_row', v_row));
      end if;
      continue;
    end if;
    end if;

    if v_house_id is null and p_create_missing_units then
      insert into public.houses (community_id, house_label, is_active)
      values (p_community_id, v_unit_label, true)
      returning id into v_house_id;
      v_missing_units_created := v_missing_units_created + 1;
    elsif v_house_id is null then
      v_missing_units_uncreated := v_missing_units_uncreated + 1;
    end if;

    select exists (
      select 1
      from public.resident_activation_queue q
      where q.community_id = p_community_id
        and public.normalize_unit_label(q.unit_label) = v_normalized_unit_label
        and lower(q.resident_name) = lower(v_resident_name)
        and q.status in ('pending','invited','pin_generated','activated','failed')
        and (
          (v_email is not null and lower(btrim(q.email)) = v_email)
          or (v_email is null and v_phone is not null and q.phone = v_phone)
          or (v_email is null and v_phone is null)
        )
    ) into v_duplicate_existing;

    if v_duplicate_existing then
      v_skipped_duplicates := v_skipped_duplicates + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row_number', v_index,
        'status', 'skipped_duplicate',
        'unit_label', v_unit_label,
        'resident_name', v_resident_name
      ));
      continue;
    end if;

    if v_email is not null and v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      v_activation_method := 'email';
      v_suggested_username := null;
    elsif v_resident_name is not null then
      v_activation_method := 'username_pin';
      v_suggested_username := public._raq_suggest_username(v_resident_name, p_community_id);
    else
      v_activation_method := 'unknown';
      v_suggested_username := null;
    end if;

    v_raw_data := jsonb_build_object(
      'import_version', 'resident_bulk_import_backend_v2',
      'row_number', v_index,
      'normalized_unit_label', v_normalized_unit_label,
      'original_row', v_row
    );

    begin
    insert into public.resident_activation_queue (
      community_id,
      house_id,
      unit_label,
      resident_name,
      phone,
      email,
      is_owner_reference,
      suggested_username,
      activation_method,
      status,
      source,
      raw_data,
      created_by
    ) values (
      p_community_id,
      v_house_id,
      v_unit_label,
      v_resident_name,
      v_phone,
      v_email,
      v_is_owner,
      v_suggested_username,
      v_activation_method,
      'pending',
      'excel_import_v2',
      v_raw_data,
      auth.uid()
    ) returning id into v_queue_id;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'ux_raq_live_email_identity' then
        raise;
      end if;
    select * into v_existing from public.resident_activation_queue
      where lower(btrim(email)) = v_email
        and status in ('pending','invited','pin_generated','activated','failed')
      for update;
    if found then
      if v_existing.community_id = p_community_id
         and public.normalize_unit_label(v_existing.unit_label) = public.normalize_unit_label(v_unit_label)
         and (v_existing.house_id is null or v_existing.house_id is not distinct from v_house_id)
         and lower(btrim(regexp_replace(v_existing.resident_name, '\s+', ' ', 'g'))) =
             lower(btrim(regexp_replace(v_resident_name, '\s+', ' ', 'g'))) then
        v_skipped_duplicates := v_skipped_duplicates + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'row_number', v_index, 'status', 'skipped_duplicate',
          'queue_id', v_existing.id, 'existing_status', v_existing.status,
          'unit_label', v_unit_label, 'resident_name', v_resident_name));
      else
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'row_number', v_index, 'status', 'failed',
          'errors', jsonb_build_array('resident_activation_conflict'),
          'queue_id', v_existing.id, 'existing_status', v_existing.status,
          'original_row', v_row));
      end if;
      continue;
    end if;

      -- A reservation disappeared before re-read; report a row conflict, never swallow other constraints.
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row_number', v_index, 'status', 'failed',
        'errors', jsonb_build_array('resident_activation_conflict'), 'original_row', v_row));
      continue;
    end;

    v_inserted := v_inserted + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'row_number', v_index,
      'status', 'inserted',
      'queue_id', v_queue_id,
      'house_id', v_house_id,
      'unit_label', v_unit_label,
      'normalized_unit_label', v_normalized_unit_label,
      'resident_name', v_resident_name,
      'activation_method', v_activation_method,
      'suggested_username', v_suggested_username
    ));
  end loop;

  perform public._sa_audit_log(
    'confirm_resident_bulk_import_v1',
    'community',
    p_community_id,
    jsonb_build_object(
      'inserted_count', v_inserted,
      'failed_count', v_failed,
      'skipped_duplicates_count', v_skipped_duplicates,
      'missing_units_created_count', v_missing_units_created,
      'missing_units_uncreated_count', v_missing_units_uncreated,
      'create_missing_units', p_create_missing_units
    )
  );

  return jsonb_build_object(
    'inserted_count', v_inserted,
    'failed_count', v_failed,
    'skipped_duplicates_count', v_skipped_duplicates,
    'missing_units_created_count', v_missing_units_created,
    'missing_units_uncreated_count', v_missing_units_uncreated,
    'results', v_results
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_resident_activation_queue_bulk_v1(p_community_id uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_existing public.resident_activation_queue%rowtype;
  v_constraint text;
  v_lock_email text;
  v_row               jsonb;
  v_unit_label        text;
  v_resident_name     text;
  v_phone             text;
  v_email             text;
  v_is_owner          boolean;
  v_raw_data          jsonb;
  v_house_id          uuid;
  v_activation_method text;
  v_suggested_uname   text;

  v_inserted_count            int := 0;
  v_skipped_duplicates_count  int := 0;
  v_failed_count              int := 0;
  v_missing_house_count       int := 0;
BEGIN
  -- ── Auth: superadmin only ──
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  -- ── Validate community exists ──
  IF NOT EXISTS (SELECT 1 FROM public.communities WHERE id = p_community_id) THEN
    RAISE EXCEPTION 'community_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- ── Validate p_rows is a JSON array ──
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array' USING ERRCODE = 'P0001';
  END IF;

  -- Acquire batch email locks in stable order to avoid reversed-batch deadlocks.
  for v_lock_email in
    select distinct nullif(lower(btrim(coalesce(r->>'email', r->>'Email', r->>'correo', r->>'Correo', ''))), '')
    from jsonb_array_elements(p_rows) r
    order by 1
  loop
    if v_lock_email is not null then
      perform pg_advisory_xact_lock(hashtextextended('entry-raq-email|' || v_lock_email, 0));
    end if;
  end loop;

  -- ── Process each row ──
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    -- Extract fields
    v_unit_label    := trim(v_row->>'unit_label');
    v_resident_name := trim(v_row->>'resident_name');
    v_phone         := nullif(trim(v_row->>'phone'), '');
    v_email         := nullif(lower(trim(v_row->>'email')), '');
    v_is_owner      := coalesce((v_row->>'is_owner')::boolean, false);
    v_raw_data      := coalesce(v_row->'raw_data', '{}'::jsonb);

    -- ── Required field validation ──
    IF v_unit_label IS NULL OR v_unit_label = '' THEN
      v_failed_count := v_failed_count + 1;
      CONTINUE;
    END IF;
    IF v_resident_name IS NULL OR v_resident_name = '' THEN
      v_failed_count := v_failed_count + 1;
      CONTINUE;
    END IF;

    -- ── Resolve house_id by case-insensitive unit_label ──
    SELECT id INTO v_house_id
    FROM public.houses
    WHERE community_id = p_community_id
      AND lower(house_label) = lower(v_unit_label)
      AND is_active = true
    LIMIT 1;

    if v_email is not null then
    select * into v_existing from public.resident_activation_queue
      where lower(btrim(email)) = v_email
        and status in ('pending','invited','pin_generated','activated','failed')
      for update;
    if found then
      if v_existing.community_id = p_community_id
         and public.normalize_unit_label(v_existing.unit_label) = public.normalize_unit_label(v_unit_label)
         and (v_existing.house_id is null or v_existing.house_id is not distinct from v_house_id)
         and lower(btrim(regexp_replace(v_existing.resident_name, '\s+', ' ', 'g'))) =
             lower(btrim(regexp_replace(v_resident_name, '\s+', ' ', 'g'))) then
        v_skipped_duplicates_count := v_skipped_duplicates_count + 1;

      else
        v_failed_count := v_failed_count + 1;

      end if;
      continue;
    end if;
    end if;

    IF v_house_id IS NULL THEN
      -- Count rows with missing house but still insert with null house_id
      -- Production-safe: partial import is better than blocking the whole batch.
      -- The console can surface these rows filtered by house_id IS NULL for manual fixup.
      v_missing_house_count := v_missing_house_count + 1;
    END IF;

    -- ── Deduplication ──
    -- Avoid exact duplicate pending rows: same community + unit_label (ci) + resident_name (ci) + email/phone
    IF EXISTS (
      SELECT 1 FROM public.resident_activation_queue
      WHERE community_id         = p_community_id
        AND lower(unit_label)    = lower(v_unit_label)
        AND lower(resident_name) = lower(v_resident_name)
        AND status in ('pending','invited','pin_generated','activated','failed')
        AND (
          (v_email IS NOT NULL AND lower(btrim(email)) = v_email)
          OR
          (v_email IS NULL AND v_phone IS NOT NULL AND phone = v_phone)
          OR
          (v_email IS NULL AND v_phone IS NULL)
        )
    ) THEN
      v_skipped_duplicates_count := v_skipped_duplicates_count + 1;
      CONTINUE;
    END IF;

    -- ── Determine activation_method ──
    IF v_email IS NOT NULL AND v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      v_activation_method := 'email';
      v_suggested_uname   := NULL; -- email users don't need username
    ELSIF v_resident_name IS NOT NULL THEN
      v_activation_method := 'username_pin';
      v_suggested_uname   := public._raq_suggest_username(v_resident_name, p_community_id);
    ELSIF v_phone IS NOT NULL THEN
      v_activation_method := 'phone_pin';
      v_suggested_uname   := public._raq_suggest_username(v_resident_name, p_community_id);
    ELSE
      v_activation_method := 'unknown';
      v_suggested_uname   := NULL;
    END IF;

    -- ── Insert ──
    begin
    INSERT INTO public.resident_activation_queue (
      community_id,
      house_id,
      unit_label,
      resident_name,
      phone,
      email,
      is_owner_reference,
      suggested_username,
      activation_method,
      status,
      source,
      raw_data,
      created_by
    ) VALUES (
      p_community_id,
      v_house_id,
      v_unit_label,
      v_resident_name,
      v_phone,
      v_email,
      v_is_owner,
      v_suggested_uname,
      v_activation_method,
      'pending',
      'excel_import',
      v_raw_data,
      auth.uid()
    );
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'ux_raq_live_email_identity' then
        raise;
      end if;
    select * into v_existing from public.resident_activation_queue
      where lower(btrim(email)) = v_email
        and status in ('pending','invited','pin_generated','activated','failed')
      for update;
    if found then
      if v_existing.community_id = p_community_id
         and public.normalize_unit_label(v_existing.unit_label) = public.normalize_unit_label(v_unit_label)
         and (v_existing.house_id is null or v_existing.house_id is not distinct from v_house_id)
         and lower(btrim(regexp_replace(v_existing.resident_name, '\s+', ' ', 'g'))) =
             lower(btrim(regexp_replace(v_resident_name, '\s+', ' ', 'g'))) then
        v_skipped_duplicates_count := v_skipped_duplicates_count + 1;

      else
        v_failed_count := v_failed_count + 1;

      end if;
      continue;
    end if;

      -- A reservation disappeared before re-read; report a row conflict, never swallow other constraints.
      v_failed_count := v_failed_count + 1;

      continue;
    end;

    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  -- ── Audit log ──
  PERFORM public._sa_audit_log(
    'create_resident_activation_queue_bulk',
    'community',
    p_community_id,
    jsonb_build_object(
      'inserted_count',              v_inserted_count,
      'skipped_duplicates_count',    v_skipped_duplicates_count,
      'failed_count',                v_failed_count,
      'rows_with_missing_house_count', v_missing_house_count
    )
  );

  RETURN jsonb_build_object(
    'inserted_count',                v_inserted_count,
    'skipped_duplicates_count',      v_skipped_duplicates_count,
    'failed_count',                  v_failed_count,
    'rows_with_missing_house_count', v_missing_house_count
  );
END;
$function$
;

create or replace function public.prepare_resident_activation_invite_v1(
  p_community_id uuid,
  p_house_id uuid,
  p_resident_name text,
  p_email text,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_email text := nullif(lower(btrim(p_email)), '');
  v_name text := nullif(btrim(regexp_replace(p_resident_name, '\s+', ' ', 'g')), '');
  v_house public.houses%rowtype;
  v_queue public.resident_activation_queue%rowtype;
  v_user_id uuid;
  v_import jsonb;
  v_community_name text;
  v_created boolean := false;
  v_constraint text;
begin
  if not public.is_superadmin() then
    raise exception 'superadmin_required' using errcode = '42501';
  end if;
  select name into v_community_name from public.communities where id = p_community_id;
  if not found then
    raise exception 'community_not_found';
  end if;
  if v_name is null or length(v_name) > 160 or v_email is null
     or length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or length(coalesce(p_phone, '')) > 32 then
    raise exception 'invalid_resident_invite';
  end if;

  select * into v_house from public.houses
    where id = p_house_id and community_id = p_community_id
    for share;
  if not found then
    raise exception 'house_not_in_community';
  end if;
  if not v_house.is_active then
    raise exception 'house_inactive';
  end if;

  -- Serialize same-email wrapper requests; the index protects ALL queue writers,
  -- including both bulk importers and Community Registration conversion.
  perform pg_advisory_xact_lock(hashtextextended('entry-raq-email|' || v_email, 0));
  perform pg_advisory_xact_lock(hashtextextended(
    'entry-raq-resident|' || p_community_id || '|' || p_house_id || '|' || lower(v_name), 0));

  select id into v_user_id from auth.users
    where lower(btrim(email)) = v_email limit 1;
  if found then
    return jsonb_build_object('success', false, 'error', 'email_already_registered',
      'existing_user_id', v_user_id);
  end if;

  select * into v_queue from public.resident_activation_queue
    where lower(btrim(email)) = v_email
      and status in ('pending', 'invited', 'pin_generated', 'activated', 'failed')
    for update;

  if not found then
    if exists (select 1 from public.resident_activation_queue q
      where q.community_id = p_community_id
        and (q.house_id = p_house_id or (q.house_id is null
          and public.normalize_unit_label(q.unit_label) = public.normalize_unit_label(v_house.house_label)))
        and lower(btrim(regexp_replace(q.resident_name, '\s+', ' ', 'g'))) = lower(v_name)
        and q.status in ('pending', 'invited', 'pin_generated', 'activated', 'failed')) then
      return jsonb_build_object('success', false, 'error', 'resident_activation_conflict');
    end if;
    begin
      v_import := public.confirm_resident_bulk_import_v1(p_community_id,
        jsonb_build_array(jsonb_build_object(
          'unit_label', v_house.house_label, 'resident_name', v_name,
          'email', v_email, 'phone', nullif(btrim(p_phone), ''), 'is_owner', false,
          'raw_data', jsonb_build_object('origin', 'resident_email_invitation'))), false);
      if coalesce((v_import->>'failed_count')::integer, 0) > 0 then
        raise exception 'activation_preparation_failed';
      end if;
      v_created := coalesce((v_import->>'inserted_count')::integer, 0) = 1;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'ux_raq_live_email_identity' then
        raise;
      end if;
      -- A different queue writer won the unique-index race. Re-read its row.
      v_created := false;
    end;
    select * into v_queue from public.resident_activation_queue
      where lower(btrim(email)) = v_email
        and status in ('pending', 'invited', 'pin_generated', 'activated', 'failed')
      for update;
    if not found then
      raise exception 'activation_preparation_failed';
    end if;
  end if;

  if v_queue.community_id <> p_community_id or v_queue.house_id is distinct from p_house_id
     or lower(btrim(regexp_replace(v_queue.resident_name, '\s+', ' ', 'g'))) <> lower(v_name)
     or v_queue.activation_method <> 'email' or v_queue.status = 'activated' then
    if v_created then
      -- Roll back importer writes if normalized unit lookup resolved another house.
      raise exception 'resident_activation_conflict';
    end if;
    return jsonb_build_object('success', false, 'error', 'resident_activation_conflict');
  end if;

  perform public._sa_audit_log('prepare_resident_activation_invite_v1', 'community',
    p_community_id, jsonb_build_object('queue_id', v_queue.id, 'house_id', p_house_id,
      'created', v_created, 'status', v_queue.status));
  return jsonb_build_object('success', true, 'queue_id', v_queue.id,
    'created', v_created, 'status', v_queue.status, 'email', v_email,
    'resident_name', v_queue.resident_name, 'house_id', v_house.id,
    'unit_label', v_house.house_label, 'community_name', v_community_name);
end;
$function$;

revoke all on function public.prepare_resident_activation_invite_v1(uuid, uuid, text, text, text)
  from public, anon;
grant execute on function public.prepare_resident_activation_invite_v1(uuid, uuid, text, text, text)
  to authenticated;

comment on index public.ux_raq_live_email_identity is
  'Project-wide normalized email reservation across live/retryable activation rows. Skipped history is excluded.';
comment on function public.prepare_resident_activation_invite_v1(uuid, uuid, text, text, text) is
  'Shared superadmin-only atomic email activation preparation; reuses compatible queue state and canonical bulk importer. Does not create users, PINs, or send emails.';
