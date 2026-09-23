-- Repair ENTRY combine-household resolution constraint compatibility.
--
-- Some existing databases carry the original auto-generated resolution_type
-- CHECK constraint under PostgreSQL's truncated identifier:
-- community_registration_duplicate_resoluti_resolution_type_check
--
-- The combine-household migration added the new four-value CHECK without
-- removing that legacy constraint, so inserts using combine_household could
-- still be rejected. Remove the legacy constraint and ensure the intended
-- constraint is present.

alter table public.community_registration_duplicate_resolutions
  drop constraint if exists community_registration_duplicate_resoluti_resolution_type_check;

alter table public.community_registration_duplicate_resolutions
  drop constraint if exists community_registration_duplicate_resolutions_resolution_type_check;

alter table public.community_registration_duplicate_resolutions
  add constraint community_registration_duplicate_resolutions_resolution_type_check
  check (resolution_type in (
    'dismissed',
    'merged',
    'resolved_duplicate',
    'combine_household'
  ));
