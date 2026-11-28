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

-- Minimal test doubles for the real account schema: this is SQL-only, not
-- a GoTrue integration claim.
alter table public.community_members add column role text not null default 'RESIDENT', add column is_active boolean not null default true;
create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade);
create table public.profiles(user_id uuid primary key references auth.users(id) on delete cascade,community_id uuid not null references public.communities(id),house_id uuid references public.houses(id),role text not null,is_active boolean not null,full_name text not null,created_at timestamptz not null default now());
create table public.community_messages(id uuid primary key default gen_random_uuid(),community_id uuid not null references public.communities(id),source_type text,author_label text,title text,body text,author_user_id uuid references auth.users(id) on delete set null,created_by uuid references auth.users(id) on delete set null,target_user_id uuid references auth.users(id) on delete set null,updated_by uuid,deleted_by uuid,deleted_at timestamptz,image_path text,image_url text,created_at timestamptz,published_at timestamptz,expires_at timestamptz);
create table public.community_admin_activity_log(id uuid primary key default gen_random_uuid(),community_id uuid not null,actor_user_id uuid references auth.users(id),action_type text,target_type text,target_id uuid,created_at timestamptz not null default now());
create table public.system_event_log(id uuid primary key default gen_random_uuid(),community_id uuid,user_id uuid,actor_id uuid,entity_id uuid,event_type text,module text,source text,entity_type text,created_at timestamptz not null default now());
create table public.lifecycle_test_guard_history(id uuid primary key default gen_random_uuid(),guard_id uuid);
create schema storage;
create table storage.objects(id uuid primary key default gen_random_uuid(),owner_id text);
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000011'),('00000000-0000-0000-0000-000000000012'),('00000000-0000-0000-0000-000000000013'),('00000000-0000-0000-0000-000000000014');
insert into public.community_members(community_id,user_id,role,is_active)
select '10000000-0000-0000-0000-000000000001',id,'GUARD',false from auth.users where id in ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000014');
insert into public.profiles(user_id,community_id,role,is_active,full_name)
select id,'10000000-0000-0000-0000-000000000001','GUARD',false,'Synthetic Guard' from auth.users where id in ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000014');
insert into public.community_messages(community_id,source_type,author_label,title,body,author_user_id,created_by,target_user_id,created_at,published_at,expires_at)
select community_id,'community','ENTRY','Bienvenido(a) a ENTRY',entry_lifecycle_private.welcome_body(full_name),user_id,user_id,user_id,created_at,created_at,created_at+interval '365 days' from public.profiles;
insert into public.community_admin_activity_log(community_id,actor_user_id,action_type,target_type,target_id)
select community_id,target_user_id,'community_message_sent','community_message',id from public.community_messages;
insert into public.superadmin_audit_log(actor_user_id,action,target_type,target_id,metadata)
select '00000000-0000-0000-0000-000000000001','community_user.deactivate','user',user_id,'{}'::jsonb from public.profiles;
insert into public.system_event_log(community_id,user_id,actor_id,entity_id,event_type,module,source,entity_type)
select community_id,user_id,'00000000-0000-0000-0000-000000000001',user_id,'USER_DEACTIVATED_BY_SUPERADMIN','superadmin','minerva_console','user' from public.profiles;
insert into public.lifecycle_test_guard_history(guard_id) values ('00000000-0000-0000-0000-000000000012');
insert into auth.sessions(user_id) values ('00000000-0000-0000-0000-000000000013');
insert into storage.objects(owner_id) values ('00000000-0000-0000-0000-000000000014');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
set role authenticated;
do $$ declare c uuid:='10000000-0000-0000-0000-000000000001'; a uuid:='00000000-0000-0000-0000-000000000011';
begin
 if not public.entry_directory_user_delete_eligible_v3(c,a) then raise exception 'unused guard with welcome not eligible'; end if;
 if public.entry_directory_user_delete_eligible_v3(c,'00000000-0000-0000-0000-000000000012') then raise exception 'historical guard eligible'; end if;
 if public.entry_directory_user_delete_eligible_v3(c,'00000000-0000-0000-0000-000000000013') then raise exception 'live session eligible'; end if;
 if public.entry_directory_user_delete_eligible_v3(c,'00000000-0000-0000-0000-000000000014') then raise exception 'storage owner eligible'; end if;
 if not public.entry_directory_delete_user_v3(c,a,'DELETE') then raise exception 'unused guard delete failed'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from auth.users where id='00000000-0000-0000-0000-000000000011') then raise exception 'auth remains'; end if;
 if not exists(select 1 from public.superadmin_audit_log where action='entry.directory.user.delete' and target_id='00000000-0000-0000-0000-000000000011' and jsonb_array_length(metadata->'welcome_activity')=1) then raise exception 'welcome audit missing'; end if;
 if not exists(select 1 from public.system_event_log where user_id='00000000-0000-0000-0000-000000000011') then raise exception 'lifecycle log lost'; end if;
 if not exists(select 1 from public.lifecycle_test_guard_history where guard_id='00000000-0000-0000-0000-000000000012') then raise exception 'operational history lost'; end if;
end $$;
select 'entry-directory-lifecycle-v3 account fixture PASS';
