-- Unify ENTRY onboarding/readiness across Operations, Communities, and Community Detail.
-- The canonical source of truth is get_community_onboarding_progress_v1().
-- This keeps the existing list RPC contract while adapting it to the canonical model.

create or replace function public.list_superadmin_communities_with_progress_v1()
returns table(
  id uuid,
  name text,
  community_code text,
  is_active boolean,
  gate_status text,
  city text,
  unit_label text,
  created_at timestamptz,
  onboarding_status text,
  completed_tasks integer,
  total_tasks integer,
  next_step_key text,
  pending_activation_count bigint,
  activation_queue_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.name,
    c.community_code,
    c.is_active,
    c.gate_status,
    c.city,
    c.unit_label,
    c.created_at,
    coalesce(progress.payload ->> 'onboarding_status', 'pending_setup')::text
      as onboarding_status,
    coalesce(nullif(progress.payload ->> 'completed_tasks', '')::integer, 0)
      as completed_tasks,
    coalesce(nullif(progress.payload ->> 'total_tasks', '')::integer, 0)
      as total_tasks,
    coalesce(progress.payload ->> 'next_step_key', 'units')::text
      as next_step_key,
    (
      coalesce(
        nullif(progress.payload -> 'metrics' ->> 'activation_queue_pending', '')::bigint,
        0
      )
      +
      coalesce(
        nullif(progress.payload -> 'metrics' ->> 'activation_queue_failed', '')::bigint,
        0
      )
    ) as pending_activation_count,
    coalesce(
      nullif(progress.payload -> 'metrics' ->> 'activation_queue_total', '')::bigint,
      0
    ) as activation_queue_count
  from public.communities c
  cross join lateral (
    select public.get_community_onboarding_progress_v1(c.id) as payload
  ) progress
  order by c.created_at desc;
end;
$$;

comment on function public.list_superadmin_communities_with_progress_v1()
is 'ENTRY community list adapter backed by canonical get_community_onboarding_progress_v1 readiness.';
