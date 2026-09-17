-- Auth email identifies one account project-wide. Failed rows are retryable;
-- activated rows reserve the identity, while skipped rows are terminal history.
-- Existing conflicting data must stop deployment, never be rewritten here.
create unique index ux_raq_live_email_identity
  on public.resident_activation_queue (lower(btrim(email)))
  where nullif(btrim(email), '') is not null
    and status in ('pending', 'invited', 'pin_generated', 'activated', 'failed');

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
