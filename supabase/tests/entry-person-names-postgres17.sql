\set ON_ERROR_STOP on
create schema if not exists public;
create or replace function public._cr_normalize_name_v1(p_name text) returns text language sql immutable as $$
  select nullif(lower(regexp_replace(btrim(coalesce(p_name, '')), '[[:space:]]+', ' ', 'g')), '');
$$;
create table public.profiles(user_id uuid primary key, full_name text);
create table public.resident_activation_queue(id uuid primary key, resident_name text);
create table public.community_registration_residents(id uuid primary key, full_name text not null, normalized_full_name text);
create table public.resident_invites(id uuid primary key, full_name text);
create table public.resident_favorites(id uuid primary key, full_name text);
create table public.houses(id uuid primary key, owner_name text);
\i supabase/migrations/20261112190000_entry_person_name_capitalization.sql

do $test$
declare n text;
begin
  n := public.entry_display_person_name_v1('mIkAsA anCkErMaN');
  if n <> 'Mikasa Anckerman' then raise exception 'Unexpected mixed-case display name: %', n; end if;
  if public.entry_display_person_name_v1('MARÍA JOSÉ LÓPEZ') <> 'María José López' then raise exception 'Accent capitalization failed'; end if;
  if public.entry_display_person_name_v1('juan   carlos   perez    martinez') <> 'Juan Carlos Perez Martinez' then raise exception 'Four-word capitalization failed'; end if;
end $test$;

insert into public.profiles values('00000000-0000-0000-0000-000000000001','mIkAsA anCkErMaN');
insert into public.resident_activation_queue values('00000000-0000-0000-0000-000000000002','MARÍA JOSÉ LÓPEZ');
insert into public.community_registration_residents values('00000000-0000-0000-0000-000000000003','juan CARLOS perez martinez',null);
insert into public.resident_invites values('00000000-0000-0000-0000-000000000004','lUiS alBerto');
insert into public.resident_favorites values('00000000-0000-0000-0000-000000000005','eRika muÑOZ');
insert into public.houses values('00000000-0000-0000-0000-000000000006','maRía del cId');

do $test$
begin
 if (select full_name from public.profiles) <> 'Mikasa Anckerman' then raise exception 'profile insert'; end if;
 if (select resident_name from public.resident_activation_queue) <> 'María José López' then raise exception 'queue insert'; end if;
 if (select full_name from public.community_registration_residents) <> 'Juan Carlos Perez Martinez' then raise exception 'registration insert'; end if;
 if (select normalized_full_name from public.community_registration_residents) <> 'juan carlos perez martinez' then raise exception 'registration normalized key'; end if;
 if (select full_name from public.resident_invites) <> 'Luis Alberto' then raise exception 'invites insert'; end if;
 if (select full_name from public.resident_favorites) <> 'Erika Muñoz' then raise exception 'favorites insert'; end if;
 if (select owner_name from public.houses) <> 'María Del Cid' then raise exception 'owner insert'; end if;
end $test$;

update public.profiles set full_name='JUAN ANTONIO SANTOS PÉREZ';
update public.resident_activation_queue set resident_name='jOse mIGUEL';
update public.community_registration_residents set full_name='aNa LuIsA rOsAles cAStro';
update public.resident_invites set full_name='anA mARía';
update public.resident_favorites set full_name='jUAN cARLOS';
update public.houses set owner_name='rOsa elENA';

do $test$
begin
 if (select full_name from public.profiles) <> 'Juan Antonio Santos Pérez' then raise exception 'profile update'; end if;
 if (select resident_name from public.resident_activation_queue) <> 'Jose Miguel' then raise exception 'queue update'; end if;
 if (select full_name from public.community_registration_residents) <> 'Ana Luisa Rosales Castro' then raise exception 'registration update'; end if;
 if (select normalized_full_name from public.community_registration_residents) <> 'ana luisa rosales castro' then raise exception 'registration normalized update'; end if;
 if (select full_name from public.resident_invites) <> 'Ana María' then raise exception 'invites update'; end if;
 if (select full_name from public.resident_favorites) <> 'Juan Carlos' then raise exception 'favorites update'; end if;
 if (select owner_name from public.houses) <> 'Rosa Elena' then raise exception 'owner update'; end if;
end $test$;
\echo 'PASS: ENTRY person-name migration six-table PostgreSQL fixture'
