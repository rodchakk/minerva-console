\set ON_ERROR_STOP on
-- Run after both F02 migrations on the historical fixture.

create or replace function public.f02_assert(p_condition boolean, p_message text)
returns void language plpgsql as $$ begin
  if not p_condition then raise exception 'F02 migration assertion failed: %', p_message; end if;
end $$;

do $$
declare rejected boolean;
begin
  perform public.f02_assert(
    (select audience_type = 'PUBLIC' and claim_protocol is null
       from public.community_message_push_queue where id = '40000000-0000-0000-0000-000000000001'),
    'historical public pending row is backfilled but remains unclaimed'
  );
  perform public.f02_assert(
    (select audience_type = 'PRIVATE'
            and audience_target_user_id = '20000000-0000-0000-0000-000000000001'
            and claim_protocol is null
       from public.community_message_push_queue where id = '40000000-0000-0000-0000-000000000002'),
    'historical private pending row receives a tenant-bound audience snapshot'
  );
  perform public.f02_assert(
    (select claim_protocol = 'LEGACY_V25' and delivery_stage = 'PROVIDER_CONTACTED'
       from public.community_message_push_queue where id = '40000000-0000-0000-0000-000000000003'),
    'historical public processing row is classified as legacy without replay'
  );
  perform public.f02_assert(
    (select claim_protocol is null and audience_type = 'PRIVATE'
       from public.community_message_push_queue where id = '40000000-0000-0000-0000-000000000004'),
    'historical private lease-less processing row remains quarantined/unclassified'
  );
  perform public.f02_assert(
    (select delivery_stage = 'CONFIRMED' from public.community_message_push_queue
      where id = '40000000-0000-0000-0000-000000000005'),
    'historical sent row maps to confirmed'
  );
  perform public.f02_assert(
    (select delivery_stage = 'FAILED' and failure_code = 'NO_ACTIVE_TOKENS'
       from public.community_message_push_queue where id = '40000000-0000-0000-0000-000000000006'),
    'historical no-token failure retains safe recovery classification'
  );

  rejected := false;
  begin
    insert into public.community_message_push_queue(message_id, community_id)
    values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');
  exception when foreign_key_violation then rejected := true; end;
  perform public.f02_assert(rejected, 'composite FK rejects message/community crossing');

  rejected := false;
  begin
    update public.community_message_push_queue
       set status = 'processing', claim_protocol = 'V2', claim_token = null
     where id = '40000000-0000-0000-0000-000000000001';
  exception when check_violation then rejected := true; end;
  perform public.f02_assert(rejected, 'V2 processing requires a lease token');

  rejected := false;
  begin
    update public.community_message_push_queue
       set status = 'processing', audience_type = 'PRIVATE',
           audience_target_user_id = '20000000-0000-0000-0000-000000000001',
           claim_protocol = 'LEGACY_V25', claim_token = null
     where id = '40000000-0000-0000-0000-000000000002';
  exception when check_violation then rejected := true; end;
  perform public.f02_assert(rejected, 'legacy provenance cannot be assigned to a private audience');

  delete from public.community_messages
   where id between '30000000-0000-0000-0000-000000000001'::uuid
                and '30000000-0000-0000-0000-000000000006'::uuid;
  delete from public.community_members
   where community_id = '10000000-0000-0000-0000-000000000001';
  delete from public.communities
   where id in (
     '10000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000002'
   );
end $$;

drop function public.f02_assert(boolean, text);
