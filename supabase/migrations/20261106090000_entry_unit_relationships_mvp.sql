-- ENTRY administrative relationships. These rows never grant residential access.
alter table public.community_settings
  add column if not exists allow_unit_relationships boolean not null default false;

create table public.entry_unit_links (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  unit_a_id uuid not null,
  unit_b_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  ended_at timestamptz,
  ended_by uuid references auth.users(id) on delete restrict,
  constraint entry_unit_links_ordered check (unit_a_id < unit_b_id),
  constraint entry_unit_links_end_pair check ((ended_at is null) = (ended_by is null)),
  constraint entry_unit_links_a_community_fk foreign key (unit_a_id, community_id)
    references public.houses(id, community_id) on delete restrict,
  constraint entry_unit_links_b_community_fk foreign key (unit_b_id, community_id)
    references public.houses(id, community_id) on delete restrict
);
create unique index entry_unit_links_one_active_pair
  on public.entry_unit_links (community_id, unit_a_id, unit_b_id) where ended_at is null;
create index entry_unit_links_b_active_idx
  on public.entry_unit_links (community_id, unit_b_id) where ended_at is null;

create table public.entry_unit_responsibilities (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  house_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  ended_at timestamptz,
  ended_by uuid references auth.users(id) on delete restrict,
  constraint entry_unit_responsibilities_end_pair check ((ended_at is null) = (ended_by is null)),
  constraint entry_unit_responsibilities_house_community_fk foreign key (house_id, community_id)
    references public.houses(id, community_id) on delete restrict,
  constraint entry_unit_responsibilities_member_fk foreign key (community_id, user_id)
    references public.community_members(community_id, user_id) on delete restrict
);
create unique index entry_unit_responsibilities_one_active
  on public.entry_unit_responsibilities (community_id, house_id, user_id) where ended_at is null;
create index entry_unit_responsibilities_user_active_idx
  on public.entry_unit_responsibilities (community_id, user_id, house_id) where ended_at is null;

alter table public.entry_unit_links enable row level security;
alter table public.entry_unit_links force row level security;
alter table public.entry_unit_responsibilities enable row level security;
alter table public.entry_unit_responsibilities force row level security;
revoke all on public.entry_unit_links, public.entry_unit_responsibilities from public, anon, authenticated, service_role;
grant select on public.entry_unit_links, public.entry_unit_responsibilities to authenticated, service_role;
create policy entry_unit_links_superadmin_read on public.entry_unit_links for select to authenticated using (public.is_superadmin() and exists (select 1 from public.community_settings s where s.community_id = entry_unit_links.community_id and s.allow_unit_relationships));
create policy entry_unit_responsibilities_superadmin_read on public.entry_unit_responsibilities for select to authenticated using (public.is_superadmin() and exists (select 1 from public.community_settings s where s.community_id = entry_unit_responsibilities.community_id and s.allow_unit_relationships));

-- Every route that changes houses.house_label, including legacy SECURITY
-- DEFINER RPCs and authorized direct UPDATEs, must pass the same checks.
create or replace function public.enforce_entry_house_label_update_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
set row_security = off
as $$
declare
  v_old_normalized text;
  v_new_normalized text;
  v_new_registration_normalized text;
begin
  if new.house_label is not distinct from old.house_label then
    return new;
  end if;

  -- Use the same community lock as the relationship RPC. This serializes
  -- direct and legacy writers with the optimistic rename path.
  perform pg_advisory_xact_lock(hashtextextended(old.community_id::text, 711309));

  new.house_label := btrim(coalesce(new.house_label, ''));
  if new.house_label = '' or char_length(new.house_label) > 120 then
    raise exception 'invalid_unit_label' using errcode = '22023';
  end if;

  v_old_normalized := public.normalize_unit_label(old.house_label);
  v_new_normalized := public.normalize_unit_label(new.house_label);
  v_new_registration_normalized := public._cr_normalize_unit_label_v1(new.house_label);

  if exists (
    select 1
      from public.houses h
     where h.community_id = old.community_id
       and h.id <> old.id
       and (
         public.normalize_unit_label(h.house_label) = v_new_normalized
         or public._cr_normalize_unit_label_v1(h.house_label) = v_new_registration_normalized
       )
  ) then
    raise exception 'unit_label_conflict' using errcode = '23505';
  end if;

  if exists (
    select 1
      from public.resident_activation_queue q
     where q.community_id = old.community_id
       and q.status in ('pending', 'invited', 'pin_generated')
       and (
         q.house_id = old.id
         or (
           q.house_id is null
           and public.normalize_unit_label(q.unit_label) = v_old_normalized
         )
       )
  ) or exists (
    select 1
      from public.community_registration_units u
      join public.community_registration_campaigns c on c.id = u.campaign_id
     where u.community_id = old.community_id
       and u.house_id = old.id
       and u.status = 'unregistered'
       and c.status in ('open', 'paused')
  ) then
    raise exception 'unit_label_has_pending_registration_or_activation' using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_entry_house_label_update_v1() from public, anon, authenticated, service_role;

create trigger enforce_entry_house_label_update_v1
before update of house_label on public.houses
for each row
execute function public.enforce_entry_house_label_update_v1();

create or replace function public.audit_entry_house_label_update_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
set row_security = off
as $$
begin
  insert into public.superadmin_audit_log(
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    auth.uid(),
    'entry.unit_label.rename',
    'house',
    new.id,
    jsonb_build_object(
      'community_id', new.community_id,
      'old_label', old.house_label,
      'new_label', new.house_label
    )
  );
  return new;
end;
$$;

revoke all on function public.audit_entry_house_label_update_v1() from public, anon, authenticated, service_role;

create trigger audit_entry_house_label_update_v1
after update of house_label on public.houses
for each row
when (old.house_label is distinct from new.house_label)
execute function public.audit_entry_house_label_update_v1();

create or replace function public.manage_entry_unit_relationship_v1(
  p_action text, p_community_id uuid, p_unit_id uuid default null,
  p_other_unit_id uuid default null, p_user_id uuid default null,
  p_link_id uuid default null, p_responsibility_id uuid default null,
  p_label text default null, p_expected_label text default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
set row_security = off
as $$
declare
  v_actor uuid := auth.uid(); v_a uuid; v_b uuid; v_id uuid; v_label text; v_created boolean;
  v_now timestamptz := clock_timestamp(); v_record jsonb;
begin
  if v_actor is null or not public.is_superadmin(v_actor) then
    raise exception 'superadmin_required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('link_units','unlink_units','assign_responsible','remove_responsible','rename_unit') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  -- Serialize feature gating and all edits within this community. No client-supplied actor is trusted.
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text, 711309));
  -- Existing label editing is independent of the new association feature gate.
  if p_action <> 'rename_unit' then
    perform 1 from public.community_settings s
     where s.community_id = p_community_id and s.allow_unit_relationships for update;
    if not found then raise exception 'unit_relationships_disabled' using errcode = '42501'; end if;
  end if;

  if p_action = 'link_units' then
    if p_unit_id is null or p_other_unit_id is null or p_unit_id = p_other_unit_id then
      raise exception 'two_distinct_units_required' using errcode = '22023';
    end if;
    v_a := least(p_unit_id,p_other_unit_id); v_b := greatest(p_unit_id,p_other_unit_id);
    if not exists (select 1 from public.houses where id=v_a and community_id=p_community_id)
       or not exists (select 1 from public.houses where id=v_b and community_id=p_community_id) then
      raise exception 'unit_not_in_community' using errcode = '23503';
    end if;
    select id into v_id from public.entry_unit_links
     where community_id=p_community_id and unit_a_id=v_a and unit_b_id=v_b and ended_at is null;
    if v_id is null then
      insert into public.entry_unit_links(community_id,unit_a_id,unit_b_id,created_by)
      values(p_community_id,v_a,v_b,v_actor) returning id into v_id;
      insert into public.superadmin_audit_log(actor_user_id,action,target_type,target_id,metadata)
      values(v_actor,'entry.unit_link.create','entry_unit_link',v_id,jsonb_build_object('community_id',p_community_id,'unit_a_id',v_a,'unit_b_id',v_b));
      v_created := true;
    else
      v_created := false;
    end if;
    return jsonb_build_object('id',v_id,'created',v_created);
  elsif p_action = 'unlink_units' then
    update public.entry_unit_links set ended_at=v_now,ended_by=v_actor
     where id=p_link_id and community_id=p_community_id and ended_at is null returning to_jsonb(entry_unit_links.*) into v_record;
    if v_record is null then raise exception 'active_link_not_found' using errcode = 'P0002'; end if;
    insert into public.superadmin_audit_log(actor_user_id,action,target_type,target_id,metadata)
    values(v_actor,'entry.unit_link.end','entry_unit_link',p_link_id,jsonb_build_object('community_id',p_community_id,'unit_a_id',v_record->>'unit_a_id','unit_b_id',v_record->>'unit_b_id'));
    return jsonb_build_object('id',p_link_id,'ended',true);
  elsif p_action = 'assign_responsible' then
    if not exists(select 1 from public.houses where id=p_unit_id and community_id=p_community_id) then
      raise exception 'unit_not_in_community' using errcode = '23503';
    end if;
    if not exists(select 1 from public.community_members where community_id=p_community_id and user_id=p_user_id) then
      raise exception 'member_not_in_community' using errcode = '23503';
    end if;
    select id into v_id from public.entry_unit_responsibilities
     where community_id=p_community_id and house_id=p_unit_id and user_id=p_user_id and ended_at is null;
    if v_id is null then
      insert into public.entry_unit_responsibilities(community_id,house_id,user_id,created_by)
      values(p_community_id,p_unit_id,p_user_id,v_actor) returning id into v_id;
      insert into public.superadmin_audit_log(actor_user_id,action,target_type,target_id,metadata)
      values(v_actor,'entry.unit_responsibility.create','entry_unit_responsibility',v_id,jsonb_build_object('community_id',p_community_id,'house_id',p_unit_id,'user_id',p_user_id));
      v_created := true;
    else
      v_created := false;
    end if;
    return jsonb_build_object('id',v_id,'created',v_created);
  elsif p_action = 'remove_responsible' then
    update public.entry_unit_responsibilities set ended_at=v_now,ended_by=v_actor
     where id=p_responsibility_id and community_id=p_community_id and ended_at is null returning to_jsonb(entry_unit_responsibilities.*) into v_record;
    if v_record is null then raise exception 'active_responsibility_not_found' using errcode = 'P0002'; end if;
    insert into public.superadmin_audit_log(actor_user_id,action,target_type,target_id,metadata)
    values(v_actor,'entry.unit_responsibility.end','entry_unit_responsibility',p_responsibility_id,jsonb_build_object('community_id',p_community_id,'house_id',v_record->>'house_id','user_id',v_record->>'user_id'));
    return jsonb_build_object('id',p_responsibility_id,'ended',true);
  else
    if p_label is null or btrim(p_label)='' or length(btrim(p_label))>120 or p_expected_label is null then
      raise exception 'invalid_label_or_expected_value' using errcode = '22023';
    end if;
    select house_label into v_label from public.houses where id=p_unit_id and community_id=p_community_id for update;
    if not found then raise exception 'unit_not_in_community' using errcode = '23503'; end if;
    if v_label is distinct from p_expected_label then raise exception 'unit_label_changed_refresh' using errcode = '40001'; end if;
    update public.houses set house_label=btrim(p_label) where id=p_unit_id and community_id=p_community_id;
    return jsonb_build_object('id',p_unit_id,'old_label',v_label,'new_label',btrim(p_label));
  end if;
end;
$$;
revoke all on function public.manage_entry_unit_relationship_v1(text,uuid,uuid,uuid,uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.manage_entry_unit_relationship_v1(text,uuid,uuid,uuid,uuid,uuid,uuid,text,text) to authenticated,service_role;
