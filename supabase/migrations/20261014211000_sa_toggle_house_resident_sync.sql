-- Keep the legacy superadmin unit toggle in sync with resident activation.
--
-- admin_toggle_house is the canonical guarded operation: when a house is
-- disabled it deactivates its resident profiles/memberships and marks them
-- deactivated_by_unit; re-enabling restores only those unit-deactivated.
-- The older sa_toggle_house changed houses.is_active alone, leaving active
-- residents assigned to inactive units and triggering
-- RESIDENT_HOUSE_CONTEXT_INVALID in observability.
--
-- Preserve the sa_toggle_house RPC signature/return shape and superadmin
-- authorization, but use the same canonical behavior as Console/Field.

create or replace function public.sa_toggle_house(
  p_house_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if not coalesce(public.is_superadmin(), false) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  return public.admin_toggle_house(p_house_id, p_is_active);
end;
$function$;

revoke all on function public.sa_toggle_house(uuid, boolean) from public;
revoke all on function public.sa_toggle_house(uuid, boolean) from anon;
grant execute on function public.sa_toggle_house(uuid, boolean) to authenticated;
grant execute on function public.sa_toggle_house(uuid, boolean) to service_role;
