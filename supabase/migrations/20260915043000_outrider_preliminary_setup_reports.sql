-- ENTRY Outrider preliminary setup reports.
--
-- This migration adds internal-only setup workbook registration and immutable
-- preliminary report snapshots. It does not create live ENTRY operational
-- houses, residents, guards, destinations, auth users, activation queue records,
-- or registration campaigns.

alter table public.community_outrider_files
  add column if not exists file_sha256 text;

alter table public.community_outrider_files
  drop constraint if exists community_outrider_files_file_sha256_check;

alter table public.community_outrider_files
  add constraint community_outrider_files_file_sha256_check
  check (file_sha256 is null or file_sha256 ~ '^[a-f0-9]{64}$');

alter table public.community_outrider_files
  drop constraint if exists community_outrider_files_category_check;

alter table public.community_outrider_files
  add constraint community_outrider_files_category_check
  check (
    category in (
      'community_data',
      'setup_workbook',
      'units',
      'residents',
      'security_staff',
      'common_areas'
    )
  );

drop index if exists public.community_outrider_files_one_setup_workbook_idx;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'entry-outrider-exports',
  'entry-outrider-exports',
  false,
  104857600,
  array['application/zip', 'application/pdf']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.community_outrider_events
  drop constraint if exists community_outrider_events_type_check;

alter table public.community_outrider_events
  add constraint community_outrider_events_type_check
  check (event_type in (
    'outrider_started',
    'outrider_saved',
    'file_uploaded',
    'outrider_submitted',
    'information_requested',
    'outrider_approved',
    'link_rotated',
    'setup_workbook_uploaded',
    'setup_report_generated',
    'setup_report_superseded',
    'setup_report_approved'
  ));

create table if not exists public.community_outrider_setup_reports (
  id                        uuid        not null default gen_random_uuid() primary key,
  outrider_id               uuid        not null references public.community_outrider_sessions(id) on delete restrict,
  source_file_id            uuid        not null references public.community_outrider_files(id) on delete restrict,
  version                   integer     not null,
  status                    text        not null default 'draft'
                                      constraint community_outrider_setup_reports_status_check
                                      check (status in ('generating', 'draft', 'approved', 'superseded', 'abandoned')),
  report_schema_version     text        not null,
  workbook_schema_version   text        not null,
  source_sha256             text        not null
                                      constraint community_outrider_setup_reports_source_sha_check
                                      check (source_sha256 ~ '^[a-f0-9]{64}$'),
  input_sha256              text        not null
                                      constraint community_outrider_setup_reports_input_sha_check
                                      check (input_sha256 ~ '^[a-f0-9]{64}$'),
  source_filename_snapshot  text        not null,
  parsed_snapshot           jsonb       not null,
  findings                  jsonb       not null,
  report_snapshot           jsonb       not null,
  pdf_storage_path          text,
  generated_by              uuid references auth.users(id) on delete set null,
  approved_by               uuid references auth.users(id) on delete set null,
  generated_at              timestamptz not null default now(),
  approved_at               timestamptz,
  superseded_at             timestamptz,
  abandoned_at              timestamptz,
  created_at                timestamptz not null default now(),

  constraint community_outrider_setup_reports_version_unique unique (outrider_id, version),
  constraint community_outrider_setup_reports_version_positive check (version > 0),
  constraint community_outrider_setup_reports_json_shapes check (
    jsonb_typeof(parsed_snapshot) = 'object'
    and jsonb_typeof(findings) = 'array'
    and jsonb_typeof(report_snapshot) = 'object'
  ),
  constraint community_outrider_setup_reports_approved_metadata check (
    status <> 'approved' or (approved_at is not null and approved_by is not null)
  ),
  constraint community_outrider_setup_reports_superseded_metadata check (
    status <> 'superseded' or superseded_at is not null
  ),
  constraint community_outrider_setup_reports_abandoned_metadata check (
    status <> 'abandoned' or abandoned_at is not null
  )
);

create unique index if not exists community_outrider_setup_reports_current_idx
  on public.community_outrider_setup_reports (outrider_id)
  where status in ('draft', 'approved');

create unique index if not exists community_outrider_setup_reports_generation_idx
  on public.community_outrider_setup_reports (outrider_id)
  where status = 'generating';

create index if not exists idx_community_outrider_setup_reports_source
  on public.community_outrider_setup_reports (source_file_id);

alter table public.community_outrider_setup_reports enable row level security;
revoke all on table public.community_outrider_setup_reports from public, anon, authenticated;

create or replace function public._outrider_validate_actor_v1(p_actor_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $function$
begin
  if p_actor_user_id is null
     or not exists (select 1 from auth.users where id = p_actor_user_id) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_ACTOR', '42501');
  end if;
end;
$function$;

create or replace function public._outrider_prevent_approved_report_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.status = 'approved' then
    if new.outrider_id is distinct from old.outrider_id
       or new.source_file_id is distinct from old.source_file_id
       or new.version is distinct from old.version
       or new.report_schema_version is distinct from old.report_schema_version
       or new.workbook_schema_version is distinct from old.workbook_schema_version
       or new.source_sha256 is distinct from old.source_sha256
       or new.input_sha256 is distinct from old.input_sha256
       or new.source_filename_snapshot is distinct from old.source_filename_snapshot
       or new.parsed_snapshot is distinct from old.parsed_snapshot
       or new.findings is distinct from old.findings
       or new.report_snapshot is distinct from old.report_snapshot
       or new.pdf_storage_path is distinct from old.pdf_storage_path
       or new.generated_by is distinct from old.generated_by
       or new.generated_at is distinct from old.generated_at
       or new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at
       or new.created_at is distinct from old.created_at
       or new.abandoned_at is distinct from old.abandoned_at then
      perform public._outrider_raise_v1('ENTRY_OUTRIDER_APPROVED_REPORT_IMMUTABLE', 'P0409');
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_outrider_prevent_approved_report_mutation
  on public.community_outrider_setup_reports;
create trigger trg_outrider_prevent_approved_report_mutation
  before update on public.community_outrider_setup_reports
  for each row execute function public._outrider_prevent_approved_report_mutation_v1();

create or replace function public.record_community_outrider_setup_workbook_v1(
  p_outrider_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_byte_size bigint,
  p_file_sha256 text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_outrider public.community_outrider_sessions%rowtype;
  v_file_id uuid;
begin
  perform public._outrider_service_role_only_v1();
  perform public._outrider_validate_actor_v1(p_actor_user_id);

  select * into v_outrider
    from public.community_outrider_sessions
   where id = p_outrider_id
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_UNAVAILABLE', '42501');
  end if;

  if v_outrider.status = 'approved' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_APPROVED_LOCKED', 'P0409');
  end if;

  if p_storage_path is null
     or p_storage_path not like v_outrider.id::text || '/setup_workbook/%'
     or nullif(btrim(coalesce(p_original_filename, '')), '') is null
     or lower(p_original_filename) not like '%.xlsx'
     or p_mime_type <> 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
     or coalesce(p_byte_size, 0) <= 0
     or coalesce(p_byte_size, 0) > 20971520
     or p_file_sha256 is null
     or p_file_sha256 !~ '^[a-f0-9]{64}$' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_SETUP_WORKBOOK');
  end if;

  insert into public.community_outrider_files (
    outrider_id,
    category,
    storage_path,
    original_filename,
    mime_type,
    byte_size,
    file_sha256
  )
  values (
    v_outrider.id,
    'setup_workbook',
    p_storage_path,
    btrim(p_original_filename),
    p_mime_type,
    p_byte_size,
    p_file_sha256
  )
  returning id into v_file_id;

  update public.community_outrider_sessions
     set last_activity_at = now()
   where id = v_outrider.id;

  insert into public.community_outrider_events (
    outrider_id,
    community_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_outrider.id,
    v_outrider.community_id,
    'setup_workbook_uploaded',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'file_id', v_file_id,
      'sha256_prefix', substring(p_file_sha256 from 1 for 12)
    )
  );

  return jsonb_build_object('accepted', true, 'file_id', v_file_id);
exception
  when unique_violation then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_FILE_CONFLICT', 'P0409');
end;
$function$;

create or replace function public.prepare_community_outrider_setup_report_v1(
  p_outrider_id uuid,
  p_source_file_id uuid,
  p_report_schema_version text,
  p_workbook_schema_version text,
  p_source_sha256 text,
  p_input_sha256 text,
  p_parsed_snapshot jsonb,
  p_findings jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_outrider public.community_outrider_sessions%rowtype;
  v_source public.community_outrider_files%rowtype;
  v_latest_source_id uuid;
  v_report public.community_outrider_setup_reports%rowtype;
  v_next_version integer;
  v_pdf_storage_path text;
begin
  perform public._outrider_service_role_only_v1();
  perform public._outrider_validate_actor_v1(p_actor_user_id);

  select * into v_outrider
    from public.community_outrider_sessions
   where id = p_outrider_id
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_UNAVAILABLE', '42501');
  end if;

  if v_outrider.status = 'approved' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_APPROVED_LOCKED', 'P0409');
  end if;

  select * into v_source
    from public.community_outrider_files
   where id = p_source_file_id
     and outrider_id = v_outrider.id
     and category = 'setup_workbook';

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_SETUP_WORKBOOK');
  end if;

  select f.id into v_latest_source_id
    from public.community_outrider_files f
   where f.outrider_id = v_outrider.id
     and f.category = 'setup_workbook'
   order by coalesce(f.uploaded_at, f.created_at) desc, f.created_at desc, f.id desc
   limit 1;

  if v_latest_source_id is distinct from v_source.id then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_SETUP_WORKBOOK_STALE', 'P0409');
  end if;

  if p_report_schema_version <> 'entry-outrider-setup-report-v1'
     or p_workbook_schema_version <> 'entry-onboarding-workbook-v1'
     or p_source_sha256 !~ '^[a-f0-9]{64}$'
     or p_input_sha256 !~ '^[a-f0-9]{64}$'
     or p_source_sha256 is distinct from v_source.file_sha256
     or jsonb_typeof(p_parsed_snapshot) <> 'object'
     or jsonb_typeof(p_findings) <> 'array'
     or exists (
       select 1
       from jsonb_array_elements(p_findings) f
       where f->>'severity' = 'error'
     ) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_BLOCKING_FINDINGS', 'P0409');
  end if;

  update public.community_outrider_setup_reports
     set status = 'abandoned',
         abandoned_at = now()
   where outrider_id = v_outrider.id
     and status = 'generating'
     and generated_at < now() - interval '15 minutes';

  if exists (
    select 1
      from public.community_outrider_setup_reports r
     where r.outrider_id = v_outrider.id
       and r.status = 'generating'
  ) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_SETUP_REPORT_GENERATION_IN_PROGRESS', 'P0409');
  end if;

  select coalesce(max(version), 0) + 1
    into v_next_version
    from public.community_outrider_setup_reports
   where outrider_id = v_outrider.id;

  v_pdf_storage_path := v_outrider.id::text
    || '/setup-reports/v'
    || v_next_version::text
    || '/report.pdf';

  insert into public.community_outrider_setup_reports (
    outrider_id,
    source_file_id,
    version,
    status,
    report_schema_version,
    workbook_schema_version,
    source_sha256,
    input_sha256,
    source_filename_snapshot,
    parsed_snapshot,
    findings,
    report_snapshot,
    pdf_storage_path,
    generated_by,
    generated_at
  )
  values (
    v_outrider.id,
    v_source.id,
    v_next_version,
    'generating',
    p_report_schema_version,
    p_workbook_schema_version,
    p_source_sha256,
    p_input_sha256,
    btrim(v_source.original_filename),
    p_parsed_snapshot,
    p_findings,
    '{}'::jsonb,
    v_pdf_storage_path,
    p_actor_user_id,
    now()
  )
  returning * into v_report;

  return jsonb_build_object(
    'accepted', true,
    'report_id', v_report.id,
    'version', v_report.version,
    'pdf_storage_path', v_report.pdf_storage_path
  );
exception
  when unique_violation then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_SETUP_REPORT_GENERATION_IN_PROGRESS', 'P0409');
end;
$function$;

create or replace function public.cancel_community_outrider_setup_report_generation_v1(
  p_report_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_report public.community_outrider_setup_reports%rowtype;
begin
  perform public._outrider_service_role_only_v1();
  perform public._outrider_validate_actor_v1(p_actor_user_id);

  select * into v_report
    from public.community_outrider_setup_reports
   where id = p_report_id
   for update;

  if not found then
    return jsonb_build_object('accepted', true, 'deleted', false);
  end if;

  if v_report.status <> 'generating' then
    return jsonb_build_object('accepted', true, 'abandoned', false);
  end if;

  update public.community_outrider_setup_reports
     set status = 'abandoned',
         abandoned_at = now()
   where id = v_report.id
     and status = 'generating';

  return jsonb_build_object('accepted', true, 'abandoned', true);
end;
$function$;

create or replace function public.finalize_community_outrider_setup_report_v1(
  p_report_id uuid,
  p_report_schema_version text,
  p_source_filename_snapshot text,
  p_report_snapshot jsonb,
  p_generated_at timestamptz,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_report public.community_outrider_setup_reports%rowtype;
  v_outrider public.community_outrider_sessions%rowtype;
  v_latest_source_id uuid;
  v_superseded_count integer;
begin
  perform public._outrider_service_role_only_v1();
  perform public._outrider_validate_actor_v1(p_actor_user_id);

  select * into v_report
    from public.community_outrider_setup_reports
   where id = p_report_id
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_REPORT_UNAVAILABLE', '42501');
  end if;

  select * into v_outrider
    from public.community_outrider_sessions
   where id = v_report.outrider_id
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_UNAVAILABLE', '42501');
  end if;

  if v_outrider.status = 'approved' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_APPROVED_LOCKED', 'P0409');
  end if;

  select f.id into v_latest_source_id
    from public.community_outrider_files f
   where f.outrider_id = v_outrider.id
     and f.category = 'setup_workbook'
   order by coalesce(f.uploaded_at, f.created_at) desc, f.created_at desc, f.id desc
   limit 1;

  if v_report.status <> 'generating'
     or v_latest_source_id is distinct from v_report.source_file_id
     or p_report_schema_version <> v_report.report_schema_version
     or jsonb_typeof(p_report_snapshot) <> 'object'
     or p_report_snapshot #>> '{source,versionLabel}'
        is distinct from 'v' || v_report.version::text
     or p_report_snapshot #>> '{source,fileId}'
        is distinct from v_report.source_file_id::text then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_SETUP_REPORT_STALE', 'P0409');
  end if;

  update public.community_outrider_setup_reports
     set status = 'superseded',
         superseded_at = now()
   where outrider_id = v_outrider.id
     and status in ('draft', 'approved');

  get diagnostics v_superseded_count = row_count;

  if v_superseded_count > 0 then
    insert into public.community_outrider_events (
      outrider_id,
      community_id,
      event_type,
      actor_type,
      actor_user_id,
      metadata
    )
    values (
      v_outrider.id,
      v_outrider.community_id,
      'setup_report_superseded',
      'entry_admin',
      p_actor_user_id,
      jsonb_build_object('count', v_superseded_count)
    );
  end if;

  update public.community_outrider_setup_reports
     set status = 'draft',
         source_filename_snapshot = btrim(p_source_filename_snapshot),
         report_snapshot = p_report_snapshot,
         generated_by = p_actor_user_id,
         generated_at = coalesce(p_generated_at, now())
   where id = v_report.id
     and status = 'generating'
   returning * into v_report;

  update public.community_outrider_sessions
     set last_activity_at = now()
   where id = v_outrider.id;

  insert into public.community_outrider_events (
    outrider_id,
    community_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_outrider.id,
    v_outrider.community_id,
    'setup_report_generated',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'report_id', v_report.id,
      'version', v_report.version,
      'source_file_id', v_report.source_file_id,
      'sha256_prefix', substring(v_report.source_sha256 from 1 for 12)
    )
  );

  return jsonb_build_object(
    'accepted', true,
    'report_id', v_report.id,
    'version', v_report.version,
    'pdf_storage_path', v_report.pdf_storage_path
  );
end;
$function$;

create or replace function public.approve_community_outrider_setup_report_v1(
  p_report_id uuid,
  p_current_input_sha256 text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_report public.community_outrider_setup_reports%rowtype;
  v_outrider public.community_outrider_sessions%rowtype;
  v_latest_source_id uuid;
begin
  perform public._outrider_service_role_only_v1();
  perform public._outrider_validate_actor_v1(p_actor_user_id);

  select * into v_report
    from public.community_outrider_setup_reports
   where id = p_report_id
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_REPORT_UNAVAILABLE', '42501');
  end if;

  select * into v_outrider
    from public.community_outrider_sessions
   where id = v_report.outrider_id
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_UNAVAILABLE', '42501');
  end if;

  if v_outrider.status = 'approved' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_APPROVED_LOCKED', 'P0409');
  end if;

  select f.id into v_latest_source_id
    from public.community_outrider_files f
   where f.outrider_id = v_outrider.id
     and f.category = 'setup_workbook'
   order by coalesce(f.uploaded_at, f.created_at) desc, f.created_at desc, f.id desc
   limit 1;

  if v_report.status <> 'draft'
     or not exists (
       select 1
       from public.community_outrider_setup_reports r
       where r.id = v_report.id
         and r.outrider_id = v_report.outrider_id
         and r.status in ('draft', 'approved')
     )
     or v_latest_source_id is distinct from v_report.source_file_id
     or v_report.input_sha256 is distinct from p_current_input_sha256
     or exists (
       select 1
       from jsonb_array_elements(v_report.findings) f
       where f->>'severity' = 'error'
     ) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_SETUP_REPORT_STALE', 'P0409');
  end if;

  update public.community_outrider_setup_reports
     set status = 'approved',
         approved_by = p_actor_user_id,
         approved_at = now()
   where id = v_report.id
   returning * into v_report;

  insert into public.community_outrider_events (
    outrider_id,
    community_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_outrider.id,
    v_outrider.community_id,
    'setup_report_approved',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'report_id', v_report.id,
      'version', v_report.version,
      'source_file_id', v_report.source_file_id
    )
  );

  return jsonb_build_object(
    'accepted', true,
    'status', v_report.status,
    'approved_at', v_report.approved_at
  );
end;
$function$;

drop function if exists public.approve_community_outrider_v1(uuid, uuid);

create or replace function public.approve_community_outrider_v1(
  p_outrider_id uuid,
  p_current_input_sha256 text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_outrider public.community_outrider_sessions%rowtype;
  v_report public.community_outrider_setup_reports%rowtype;
  v_latest_source_id uuid;
begin
  perform public._outrider_service_role_only_v1();
  perform public._outrider_validate_actor_v1(p_actor_user_id);

  select * into v_outrider
    from public.community_outrider_sessions
   where id = p_outrider_id
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_UNAVAILABLE');
  end if;

  if v_outrider.status = 'approved' then
    return jsonb_build_object(
      'accepted', true,
      'status', v_outrider.status,
      'approved_at', v_outrider.approved_at
    );
  end if;

  select * into v_report
    from public.community_outrider_setup_reports
   where outrider_id = v_outrider.id
     and status = 'approved'
   order by version desc
   limit 1
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_SETUP_REPORT_REQUIRED', 'P0409');
  end if;

  select f.id into v_latest_source_id
    from public.community_outrider_files f
   where f.outrider_id = v_outrider.id
     and f.category = 'setup_workbook'
   order by coalesce(f.uploaded_at, f.created_at) desc, f.created_at desc, f.id desc
   limit 1;

  if v_latest_source_id is distinct from v_report.source_file_id
     or v_report.input_sha256 is distinct from p_current_input_sha256
     or exists (
       select 1
       from jsonb_array_elements(v_report.findings) f
       where f->>'severity' = 'error'
     ) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_SETUP_REPORT_STALE', 'P0409');
  end if;

  update public.community_outrider_sessions
     set status = 'approved',
         approved_by = p_actor_user_id,
         approved_at = now(),
         last_activity_at = now()
   where id = v_outrider.id
   returning * into v_outrider;

  insert into public.community_outrider_events (
    outrider_id,
    community_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_outrider.id,
    v_outrider.community_id,
    'outrider_approved',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'report_id', v_report.id,
      'version', v_report.version,
      'source_file_id', v_report.source_file_id
    )
  );

  return jsonb_build_object(
    'accepted', true,
    'status', v_outrider.status,
    'approved_at', v_outrider.approved_at
  );
end;
$function$;

comment on table public.community_outrider_setup_reports is
  'Immutable preliminary setup report snapshots generated from an internal setup_workbook. Reports do not create live ENTRY operational records.';
comment on column public.community_outrider_files.file_sha256 is
  'SHA-256 of stored file bytes when computed by an internal deterministic workflow.';
comment on function public.record_community_outrider_setup_workbook_v1(uuid, text, text, text, bigint, text, uuid) is
  'ENTRY internal RPC. Registers an authenticated superadmin setup_workbook upload after private Storage write. service_role only.';
comment on function public.prepare_community_outrider_setup_report_v1(uuid, uuid, text, text, text, text, jsonb, jsonb, uuid) is
  'ENTRY internal RPC. Atomically reserves the authoritative setup report version and private PDF path for the latest setup workbook. service_role only.';
comment on function public.finalize_community_outrider_setup_report_v1(uuid, text, text, jsonb, timestamptz, uuid) is
  'ENTRY internal RPC. Finalizes a reserved setup report snapshot and supersedes any prior current report. service_role only.';
comment on function public.cancel_community_outrider_setup_report_generation_v1(uuid, uuid) is
  'ENTRY internal RPC. Cancels an unfinished setup report reservation after PDF generation or upload failure. service_role only.';
comment on function public.approve_community_outrider_setup_report_v1(uuid, text, uuid) is
  'ENTRY internal RPC. Approves only the current non-stale setup report without blocking findings before final Outrider approval locks the workflow. service_role only.';
comment on function public.approve_community_outrider_v1(uuid, text, uuid) is
  'Final explicit Outrider approval. Requires the current approved setup report to match the latest setup workbook and current Outrider input fingerprint. service_role only.';

revoke all on function public._outrider_validate_actor_v1(uuid) from public, anon, authenticated;
revoke all on function public._outrider_prevent_approved_report_mutation_v1() from public, anon, authenticated;
revoke all on function public.record_community_outrider_setup_workbook_v1(uuid, text, text, text, bigint, text, uuid) from public, anon, authenticated;
revoke all on function public.prepare_community_outrider_setup_report_v1(uuid, uuid, text, text, text, text, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.finalize_community_outrider_setup_report_v1(uuid, text, text, jsonb, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.cancel_community_outrider_setup_report_generation_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.approve_community_outrider_setup_report_v1(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.approve_community_outrider_v1(uuid, text, uuid) from public, anon, authenticated;

grant execute on function public.record_community_outrider_setup_workbook_v1(uuid, text, text, text, bigint, text, uuid) to service_role;
grant execute on function public.prepare_community_outrider_setup_report_v1(uuid, uuid, text, text, text, text, jsonb, jsonb, uuid) to service_role;
grant execute on function public.finalize_community_outrider_setup_report_v1(uuid, text, text, jsonb, timestamptz, uuid) to service_role;
grant execute on function public.cancel_community_outrider_setup_report_generation_v1(uuid, uuid) to service_role;
grant execute on function public.approve_community_outrider_setup_report_v1(uuid, text, uuid) to service_role;
grant execute on function public.approve_community_outrider_v1(uuid, text, uuid) to service_role;
