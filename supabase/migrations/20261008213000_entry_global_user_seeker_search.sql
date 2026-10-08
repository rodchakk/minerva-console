-- Expand the superadmin ENTRY user seeker across operational identity fields.
create or replace function public.sa_list_users(
  p_community_id uuid default null::uuid,
  p_search text default null::text
)
returns table(
  user_id uuid,
  full_name text,
  email text,
  phone text,
  role text,
  is_active boolean,
  community_id uuid,
  community_name text,
  house_id uuid,
  house_label text,
  created_at timestamptz,
  last_sign_in timestamptz
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_search_digits text := nullif(regexp_replace(coalesce(p_search, ''), '[^0-9]', '', 'g'), '');
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  if p_community_id is null then
    return query
    select
      p.user_id,
      p.full_name,
      au.email::text,
      p.phone,
      coalesce(cm.role::text, p.role::text) as role,
      p.is_active,
      p.community_id,
      c.name::text,
      p.house_id,
      h.house_label::text,
      p.created_at,
      au.last_sign_in_at
    from public.profiles p
    join auth.users au on au.id = p.user_id
    left join public.communities c on c.id = p.community_id
    left join public.houses h
      on h.id = p.house_id
     and h.community_id = p.community_id
    left join public.community_members cm
      on cm.user_id = p.user_id
     and cm.community_id = p.community_id
     and cm.is_active = true
    where (
      v_search is null
      or p.full_name ilike '%' || v_search || '%'
      or au.email ilike '%' || v_search || '%'
      or coalesce(p.username, '') ilike '%' || v_search || '%'
      or coalesce(p.phone, '') ilike '%' || v_search || '%'
      or coalesce(h.house_label, '') ilike '%' || v_search || '%'
      or coalesce(c.name, '') ilike '%' || v_search || '%'
      or coalesce(c.city, '') ilike '%' || v_search || '%'
      or coalesce(cm.role::text, p.role::text, '') ilike '%' || v_search || '%'
      or (
        v_search_digits is not null
        and length(v_search_digits) >= 4
        and regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g')
          like '%' || v_search_digits || '%'
      )
    )
    order by p.created_at desc
    limit 200;
  else
    return query
    select
      p.user_id,
      p.full_name,
      au.email::text,
      p.phone,
      coalesce(cm.role::text, p.role::text) as role,
      p.is_active,
      p.community_id,
      c.name::text,
      p.house_id,
      h.house_label::text,
      p.created_at,
      au.last_sign_in_at
    from public.profiles p
    join auth.users au on au.id = p.user_id
    left join public.communities c on c.id = p.community_id
    left join public.houses h
      on h.id = p.house_id
     and h.community_id = p.community_id
    left join public.community_members cm
      on cm.user_id = p.user_id
     and cm.community_id = p.community_id
     and cm.is_active = true
    where p.community_id = p_community_id
      and (
        v_search is null
        or p.full_name ilike '%' || v_search || '%'
        or au.email ilike '%' || v_search || '%'
        or coalesce(p.username, '') ilike '%' || v_search || '%'
        or coalesce(p.phone, '') ilike '%' || v_search || '%'
        or coalesce(h.house_label, '') ilike '%' || v_search || '%'
        or coalesce(c.name, '') ilike '%' || v_search || '%'
        or coalesce(c.city, '') ilike '%' || v_search || '%'
        or coalesce(cm.role::text, p.role::text, '') ilike '%' || v_search || '%'
        or (
          v_search_digits is not null
          and length(v_search_digits) >= 4
          and regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g')
            like '%' || v_search_digits || '%'
        )
      )
    order by p.created_at desc;
  end if;
end;
$function$;
