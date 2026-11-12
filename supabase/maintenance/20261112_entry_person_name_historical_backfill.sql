-- OPERATOR-GATED HISTORICAL REPAIR. Do NOT add this file to migrations.
-- Run only after a recent verified backup, isolated regression PASS, and an
-- approved production release of 20261112190000_entry_person_name_capitalization.sql.
-- Run as the database owner. One transaction: backup + updates or nothing.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';

create table if not exists private.entry_person_name_case_backup_20261112 (
  table_name text not null,
  record_id uuid not null,
  old_name text not null,
  old_normalized_full_name text,
  recorded_at timestamptz not null default now(),
  primary key(table_name,record_id)
);
revoke all on private.entry_person_name_case_backup_20261112 from public, anon, authenticated;

insert into private.entry_person_name_case_backup_20261112(table_name,record_id,old_name)
select 'profiles',user_id,full_name from public.profiles
 where full_name is distinct from public.entry_display_person_name_v1(full_name) and full_name is not null
union all
select 'resident_activation_queue',id,resident_name from public.resident_activation_queue
 where resident_name is distinct from public.entry_display_person_name_v1(resident_name) and resident_name is not null
union all
select 'resident_invites',id,full_name from public.resident_invites
 where full_name is distinct from public.entry_display_person_name_v1(full_name) and full_name is not null
union all
select 'resident_favorites',id,full_name from public.resident_favorites
 where full_name is distinct from public.entry_display_person_name_v1(full_name) and full_name is not null
union all
select 'houses',id,owner_name from public.houses
 where owner_name is distinct from public.entry_display_person_name_v1(owner_name) and owner_name is not null
on conflict do nothing;

insert into private.entry_person_name_case_backup_20261112(table_name,record_id,old_name,old_normalized_full_name)
select 'community_registration_residents',id,full_name,normalized_full_name
from public.community_registration_residents
where full_name is distinct from public.entry_display_person_name_v1(full_name) and full_name is not null
on conflict do nothing;

-- Abort on unexpectedly broad changes or missing backup coverage.
do $guard$
declare n int;
begin
  select count(*) into n from private.entry_person_name_case_backup_20261112;
  if n < 1 or n > 900 then
    raise exception 'Name repair backup count % outside reviewed bounds (1..900)',n;
  end if;
end;
$guard$;

update public.profiles p set full_name = public.entry_display_person_name_v1(p.full_name)
from private.entry_person_name_case_backup_20261112 b
where b.table_name='profiles' and b.record_id=p.user_id and p.full_name=b.old_name;

update public.resident_activation_queue q set resident_name = public.entry_display_person_name_v1(q.resident_name)
from private.entry_person_name_case_backup_20261112 b
where b.table_name='resident_activation_queue' and b.record_id=q.id and q.resident_name=b.old_name;

update public.community_registration_residents r
set full_name=public.entry_display_person_name_v1(r.full_name)
from private.entry_person_name_case_backup_20261112 b
where b.table_name='community_registration_residents' and b.record_id=r.id and r.full_name=b.old_name
  and r.normalized_full_name is not distinct from b.old_normalized_full_name;

update public.resident_invites i set full_name = public.entry_display_person_name_v1(i.full_name)
from private.entry_person_name_case_backup_20261112 b
where b.table_name='resident_invites' and b.record_id=i.id and i.full_name=b.old_name;

update public.resident_favorites f set full_name = public.entry_display_person_name_v1(f.full_name)
from private.entry_person_name_case_backup_20261112 b
where b.table_name='resident_favorites' and b.record_id=f.id and f.full_name=b.old_name;

update public.houses h set owner_name=public.entry_display_person_name_v1(h.owner_name)
from private.entry_person_name_case_backup_20261112 b
where b.table_name='houses' and b.record_id=h.id and h.owner_name=b.old_name;

-- Must be zero after a successful, all-target repair. On failure the entire
-- transaction rolls back, including backup creation.
do $verify$
declare n int;
begin
  select count(*) into n from (
    select full_name n from public.profiles
    union all select resident_name from public.resident_activation_queue
    union all select full_name from public.community_registration_residents
    union all select full_name from public.resident_invites
    union all select full_name from public.resident_favorites
    union all select owner_name from public.houses
  ) s where n is not null and n is distinct from public.entry_display_person_name_v1(n);
  if n <> 0 then
    raise exception 'Name repair incomplete: % nonconforming display values',n;
  end if;
end;
$verify$;

commit;
-- After commit, run the checks from the accompanying runbook.
