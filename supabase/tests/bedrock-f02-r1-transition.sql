\set ON_ERROR_STOP on
-- Run after migration 20261028032025 and before the R2 migration. This proves
-- the first committed migration is fail-closed during the deployment window.

create or replace function public.f02_assert(p_condition boolean, p_message text)
returns void language plpgsql as $$ begin
  if not p_condition then raise exception 'F02 transition assertion failed: %', p_message; end if;
end $$;

do $$
declare
  c uuid := gen_random_uuid();
  u uuid := gen_random_uuid();
  m_public_v2 uuid := gen_random_uuid();
  m_private_v2 uuid := gen_random_uuid();
  m_legacy uuid := gen_random_uuid();
  q_public_v2 uuid := gen_random_uuid();
  q_private_v2 uuid := gen_random_uuid();
  q_legacy uuid := gen_random_uuid();
  rejected boolean;
begin
  insert into public.communities values (c);
  insert into public.community_members values (c, u, true);
  insert into public.community_messages(id, community_id, target_user_id) values
    (m_public_v2, c, null), (m_private_v2, c, u), (m_legacy, c, null);
  insert into public.community_message_push_queue(
    id, message_id, community_id, status, audience_type,
    audience_target_user_id, delivery_stage, claim_token
  ) values
    (q_public_v2, m_public_v2, c, 'processing', 'PUBLIC', null, 'PRE_PROVIDER', gen_random_uuid()),
    (q_private_v2, m_private_v2, c, 'processing', 'PRIVATE', u, 'PRE_PROVIDER', gen_random_uuid()),
    (q_legacy, m_legacy, c, 'processing', 'PUBLIC', null, 'PRE_PROVIDER', null);

  rejected := false;
  begin perform public.complete_community_message_push(q_public_v2);
  exception when sqlstate 'P0001' then rejected := true; end;
  perform public.f02_assert(rejected, 'migration 1 legacy complete rejects a public v2 lease');

  rejected := false;
  begin perform public.fail_community_message_push(q_private_v2, 'synthetic');
  exception when sqlstate 'P0001' then rejected := true; end;
  perform public.f02_assert(rejected, 'migration 1 legacy fail rejects a private v2 lease');

  perform public.complete_community_message_push(q_legacy);
  perform public.f02_assert(
    (select status = 'sent' from public.community_message_push_queue where id = q_legacy),
    'migration 1 keeps a genuine public no-token legacy claim compatible'
  );

  delete from public.community_messages where id in (m_public_v2, m_private_v2, m_legacy);
  delete from public.community_members where community_id = c;
  delete from public.communities where id = c;
end $$;

drop function public.f02_assert(boolean, text);
