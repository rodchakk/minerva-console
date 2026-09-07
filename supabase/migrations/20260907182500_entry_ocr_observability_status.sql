-- ENTRY-OCR-001: expose repository-controlled OCR instrumentation in the
-- existing ENTRY Observability read model without duplicating the v1 query.
--
-- The release order deploys the hardened Edge Function before this migration,
-- so provider_instrumented=true is a capability statement, not an inference
-- from traffic volume. A quiet community can have zero provider calls and still
-- be correctly instrumented.

alter function public.sa_get_entry_observability_v1(
  timestamptz,
  timestamptz,
  uuid
) rename to _sa_get_entry_observability_base_v1;

revoke all on function public._sa_get_entry_observability_base_v1(
  timestamptz,
  timestamptz,
  uuid
) from public, anon, authenticated;
grant execute on function public._sa_get_entry_observability_base_v1(
  timestamptz,
  timestamptz,
  uuid
) to service_role;

create or replace function public.sa_get_entry_observability_v1(
  p_starts_at timestamptz,
  p_ends_at timestamptz default now(),
  p_community_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_result jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  v_result := public._sa_get_entry_observability_base_v1(
    p_starts_at,
    p_ends_at,
    p_community_id
  );

  v_result := jsonb_set(
    v_result,
    '{ocr_queue,provider_instrumented}',
    'true'::jsonb,
    true
  );

  v_result := jsonb_set(
    v_result,
    '{ocr_queue,provider_usage_status}',
    to_jsonb('instrumented'::text),
    true
  );

  return v_result;
end;
$function$;

revoke all on function public.sa_get_entry_observability_v1(
  timestamptz,
  timestamptz,
  uuid
) from public, anon;
grant execute on function public.sa_get_entry_observability_v1(
  timestamptz,
  timestamptz,
  uuid
) to authenticated;
grant execute on function public.sa_get_entry_observability_v1(
  timestamptz,
  timestamptz,
  uuid
) to service_role;

comment on function public.sa_get_entry_observability_v1(
  timestamptz,
  timestamptz,
  uuid
) is
  'ENTRY Observability read model with repository-controlled Gemini OCR provider instrumentation enabled by ENTRY-OCR-001.';

comment on function public._sa_get_entry_observability_base_v1(
  timestamptz,
  timestamptz,
  uuid
) is
  'Internal base implementation for ENTRY Observability v1. Direct client execution is revoked; use sa_get_entry_observability_v1.';
