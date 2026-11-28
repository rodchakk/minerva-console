\set ON_ERROR_STOP on
-- Runs after the existing relationships fixture; never on production.
\ir /tmp/entry-directory-lifecycle-v3.sql
create table public.lifecycle_test_non_fk_history(id uuid primary key default gen_random_uuid(), unknown_unit_reference uuid);
create table public.lifecycle_test_destination(id uuid primary key default gen_random_uuid(), linked_house_id uuid references public.houses(id) on delete set null);
insert into public.houses(id,community_id,house_label) values
('20000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','Delete test empty'),
('20000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000001','Delete test linked'),
('20000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000001','Delete test historical'),
('20000000-0000-0000-0000-000000000014','10000000-0000-0000-0000-000000000001','Delete test destination');
insert into public.lifecycle_test_non_fk_history(unknown_unit_reference) values('20000000-0000-0000-0000-000000000013');
insert into public.lifecycle_test_destination(linked_house_id) values('20000000-0000-0000-0000-000000000014');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.manage_entry_unit_relationship_v1('link_units','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000012');
set role authenticated;
do $$ declare c uuid:='10000000-0000-0000-0000-000000000001'; a uuid:='20000000-0000-0000-0000-000000000011'; b uuid:='20000000-0000-0000-0000-000000000012';
begin
 if public.entry_directory_unit_delete_eligible_v3(c,a) then raise exception 'active link eligible'; end if;
 if public.entry_directory_unit_delete_eligible_v3(c,'20000000-0000-0000-0000-000000000013') then raise exception 'non-FK history eligible'; end if;
 if public.entry_directory_unit_delete_eligible_v3(c,'20000000-0000-0000-0000-000000000014') then raise exception 'SET NULL reference eligible'; end if;
 if public.entry_directory_unit_delete_eligible_v3('10000000-0000-0000-0000-000000000002',b) then raise exception 'wrong community eligible'; end if;
 begin perform public.entry_directory_delete_unit_v3(c,a,'DELETE'); raise exception 'active link deleted'; exception when sqlstate '55000' then null; end;
 begin perform public.entry_directory_delete_unit_v3(c,a,'yes'); raise exception 'bad confirmation accepted'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
select public.manage_entry_unit_relationship_v1('unlink_units','10000000-0000-0000-0000-000000000001',null,null,null,(select id from public.entry_unit_links where (unit_a_id='20000000-0000-0000-0000-000000000011' or unit_b_id='20000000-0000-0000-0000-000000000011') and ended_at is null));
set role authenticated;
do $$ declare c uuid:='10000000-0000-0000-0000-000000000001'; a uuid:='20000000-0000-0000-0000-000000000011';
begin
 if not public.entry_directory_unit_delete_eligible_v3(c,a) then raise exception 'ended link should be eligible'; end if;
 if not public.entry_directory_delete_unit_v3(c,a,'DELETE') then raise exception 'delete failed'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.houses where id='20000000-0000-0000-0000-000000000011') then raise exception 'unit still present'; end if;
 if not exists(select 1 from public.superadmin_audit_log where action='entry.directory.unit.delete' and target_id='20000000-0000-0000-0000-000000000011' and jsonb_array_length(metadata->'ended_links')=1) then raise exception 'ended relationship audit missing'; end if;
 if not exists(select 1 from public.houses where id='20000000-0000-0000-0000-000000000012') then raise exception 'unrelated unit lost'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
set role authenticated;
do $$ begin
 begin perform public.entry_directory_unit_delete_eligible_v3('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000012'); raise exception 'unauthorized read'; exception when insufficient_privilege then null; end;
 begin perform public.entry_directory_delete_unit_v3('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000012','DELETE'); raise exception 'unauthorized delete'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'entry-directory-lifecycle-v3 unit fixture PASS';
