-- Fix public Outrider resolution for newly created/pre-admin intakes.
-- jsonb_set() returns SQL NULL when its new value argument is SQL NULL, so a
-- null initial_admin_count previously collapsed the entire resolver payload.
-- Keep the field as JSON null instead. No live ENTRY operational records are created.

create or replace function public.resolve_community_outrider_v1(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_outrider public.community_outrider_sessions%rowtype;
begin
  perform public._outrider_service_role_only_v1();
  v_result := public._resolve_community_outrider_without_admins_v1(p_token_hash);

  if coalesce((v_result ->> 'available')::boolean, false) = false then
    return v_result;
  end if;

  select * into v_outrider
    from public.community_outrider_sessions
   where token_hash = btrim(coalesce(p_token_hash, ''));

  return jsonb_set(
    jsonb_set(
      v_result,
      '{outrider,initial_admin_count}',
      coalesce(to_jsonb(v_outrider.initial_admin_count), 'null'::jsonb),
      true
    ),
    '{outrider,initial_admins}',
    coalesce(v_outrider.initial_admins, '[]'::jsonb),
    true
  );
end;
$function$;

revoke all on function public.resolve_community_outrider_v1(text)
  from public, anon, authenticated;
grant execute on function public.resolve_community_outrider_v1(text)
  to service_role;
