-- Read-only deployed importer snapshots inspected 2026-09-17.
-- Test fixtures only: the production migration does not replace these functions.
CREATE OR REPLACE FUNCTION public.confirm_resident_bulk_import_v1(p_community_id uuid, p_rows jsonb, p_create_missing_units boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
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
        and q.status in ('pending','invited','pin_generated','activated')
        and (
          (v_email is not null and q.email = v_email)
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
DECLARE
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
        AND status               = 'pending'
        AND (
          (v_email IS NOT NULL AND email = v_email)
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
