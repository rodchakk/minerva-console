create or replace function public.sync_house_registration_snapshots_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_normalized_label text;
begin
  if new.house_label is not distinct from old.house_label
     and new.unit_reference is not distinct from old.unit_reference then
    return new;
  end if;

  v_normalized_label := public._cr_normalize_unit_label_v1(new.house_label);

  if v_normalized_label is null then
    raise exception 'invalid_unit_label' using errcode = 'P0400';
  end if;

  update public.community_registration_units cru
     set unit_label_snapshot = btrim(new.house_label),
         unit_reference_snapshot = nullif(public._cr_normalize_name_v1(new.unit_reference), ''),
         normalized_unit_label = v_normalized_label
   where cru.house_id = new.id
     and cru.community_id = new.community_id
     and cru.status = 'unregistered'
     and exists (
       select 1
         from public.community_registration_campaigns crc
        where crc.id = cru.campaign_id
          and crc.community_id = new.community_id
          and crc.status in ('open', 'paused')
     );

  return new;
end;
$function$;

drop trigger if exists trg_sync_house_registration_snapshots_v1 on public.houses;
create trigger trg_sync_house_registration_snapshots_v1
after update of house_label, unit_reference on public.houses
for each row
execute function public.sync_house_registration_snapshots_v1();

comment on function public.sync_house_registration_snapshots_v1() is
  'Keeps unregistered units in open/paused ENTRY registration campaigns synchronized with edits to houses.house_label and houses.unit_reference. Registered/historical campaign snapshots remain unchanged.';
