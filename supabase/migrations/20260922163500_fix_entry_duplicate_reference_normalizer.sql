-- Hotfix: archived duplicate resolution referenced a non-existent
-- public._cr_normalize_unit_label(text) helper.
-- Keep the deployed RPC stable and provide a compatibility wrapper that
-- delegates to the existing versioned internal normalizer.

create or replace function public._cr_normalize_unit_label(
  p_label text
)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select public._cr_normalize_unit_label_v1(p_label);
$function$;

revoke execute on function public._cr_normalize_unit_label(text)
  from public, anon, authenticated;
grant execute on function public._cr_normalize_unit_label(text)
  to service_role;

comment on function public._cr_normalize_unit_label(text) is
  'Compatibility wrapper for ENTRY duplicate-resolution RPCs. Delegates to _cr_normalize_unit_label_v1.';
