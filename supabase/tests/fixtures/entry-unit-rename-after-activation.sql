\set ON_ERROR_STOP on
-- Runs against the throwaway relationship fixture database, after the patch.
-- This must never run against a hosted ENTRY project.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"role":"authenticated"}',false);
insert into public.resident_activation_queue(community_id,house_id,status,unit_label)
values ('10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001','invited','House A');

set role authenticated;
select public.manage_entry_unit_relationship_v1(
  'rename_unit','10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  null,null,null,null,'Apartamentos Castro #01','House A');
reset role;

do $$
begin
 if (select house_label from public.houses where id='20000000-0000-0000-0000-000000000001') <> 'Apartamentos Castro #01' then raise exception 'UUID-bound activation blocked a safe rename'; end if;
 if not exists (select 1 from public.resident_activation_queue
   where house_id='20000000-0000-0000-0000-000000000001' and status='invited' and unit_label='House A') then raise exception 'pending activation identity/snapshot changed'; end if;
 if not exists (select 1 from public.superadmin_audit_log where action='entry.unit_label.rename' and target_id='20000000-0000-0000-0000-000000000001' and metadata->>'new_label'='Apartamentos Castro #01') then raise exception 'safe rename not audited'; end if;
end $$;

-- A legacy name-only activation still blocks rename.
insert into public.resident_activation_queue(community_id,house_id,status,unit_label)
values ('10000000-0000-0000-0000-000000000001',null,'pending','Apartamentos Castro #01');
set role authenticated;
do $$ begin
  begin
    perform public.manage_entry_unit_relationship_v1(
      'rename_unit','10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',null,null,null,null,
      'Apartamentos Castro #02','Apartamentos Castro #01');
    raise exception 'unbound activation allowed a rename';
  exception when sqlstate '55000' then null;
  end;
end $$;
reset role;
delete from public.resident_activation_queue where house_id is null;

-- Duplicate names stay protected even when bound queue rows exist.
set role authenticated;
do $$ begin
  begin
    perform public.manage_entry_unit_relationship_v1(
      'rename_unit','10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',null,null,null,null,
      'unit b renamed','Apartamentos Castro #01');
    raise exception 'duplicate unit label was accepted';
  exception when unique_violation then null;
  end;
end $$;
reset role;

-- An open unregistered campaign still blocks a rename.
update public.community_registration_campaigns set status='open'
where id='30000000-0000-0000-0000-000000000001';
set role authenticated;
do $$ begin
  begin
    perform public.manage_entry_unit_relationship_v1(
      'rename_unit','10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',null,null,null,null,
      'Apartamentos Castro #02','Apartamentos Castro #01');
    raise exception 'open unregistered campaign allowed a rename';
  exception when sqlstate '55000' then null;
  end;
end $$;
reset role;
select 'entry-unit-rename-after-activation fixture PASS';
