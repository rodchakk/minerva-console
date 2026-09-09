create table if not exists public.entry_field_work_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  staff_email_snapshot text,
  product_area text not null default 'entry',
  community_id uuid references public.communities(id) on delete set null,
  community_name_snapshot text,
  classification text not null,
  work_location text not null,
  notes text not null default '',
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entry_field_work_sessions_product_area_check
    check (product_area = 'entry'),
  constraint entry_field_work_sessions_classification_check
    check (classification in ('onboarding', 'support', 'maintenance', 'research_development')),
  constraint entry_field_work_sessions_work_location_check
    check (work_location in ('onsite', 'remote')),
  constraint entry_field_work_sessions_notes_length_check
    check (char_length(notes) <= 2000),
  constraint entry_field_work_sessions_duration_check
    check (duration_seconds is null or duration_seconds >= 0),
  constraint entry_field_work_sessions_stop_after_start_check
    check (stopped_at is null or stopped_at >= started_at),
  constraint entry_field_work_sessions_stopped_duration_check
    check (
      (stopped_at is null and duration_seconds is null)
      or (stopped_at is not null and duration_seconds is not null)
    )
);

create unique index if not exists entry_field_work_sessions_one_active_per_staff_idx
  on public.entry_field_work_sessions(staff_user_id)
  where stopped_at is null;

create index if not exists entry_field_work_sessions_staff_started_idx
  on public.entry_field_work_sessions(staff_user_id, started_at desc);

create index if not exists entry_field_work_sessions_community_started_idx
  on public.entry_field_work_sessions(community_id, started_at desc);

create or replace function public.set_entry_field_work_sessions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_entry_field_work_sessions_updated_at
  on public.entry_field_work_sessions;
create trigger set_entry_field_work_sessions_updated_at
before update on public.entry_field_work_sessions
for each row
execute function public.set_entry_field_work_sessions_updated_at();

alter table public.entry_field_work_sessions enable row level security;

revoke all on table public.entry_field_work_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.entry_field_work_sessions to authenticated;

create policy entry_field_work_sessions_superadmin_select
  on public.entry_field_work_sessions
  for select
  to authenticated
  using ((select public.is_superadmin(auth.uid())));

create policy entry_field_work_sessions_staff_insert
  on public.entry_field_work_sessions
  for insert
  to authenticated
  with check (
    (select public.is_superadmin(auth.uid()))
    and staff_user_id = auth.uid()
  );

create policy entry_field_work_sessions_staff_update
  on public.entry_field_work_sessions
  for update
  to authenticated
  using (
    (select public.is_superadmin(auth.uid()))
    and staff_user_id = auth.uid()
  )
  with check (
    (select public.is_superadmin(auth.uid()))
    and staff_user_id = auth.uid()
  );

create policy entry_field_work_sessions_staff_delete
  on public.entry_field_work_sessions
  for delete
  to authenticated
  using (
    (select public.is_superadmin(auth.uid()))
    and staff_user_id = auth.uid()
  );

comment on table public.entry_field_work_sessions is
  'Durable Minerva Field work-time sessions for ENTRY staff work and manual finance entry.';
comment on column public.entry_field_work_sessions.product_area is
  'Fixed ENTRY attribution for Minerva Field work captured by this table.';
comment on column public.entry_field_work_sessions.classification is
  'Operational classification: onboarding, support, maintenance, or research_development.';
comment on column public.entry_field_work_sessions.work_location is
  'Where the work happened: onsite or remote.';
