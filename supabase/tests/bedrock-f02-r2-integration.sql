\set ON_ERROR_STOP on
-- Behavioral assertions for the F02 R2 protocol. Run only against the
-- disposable PG17 fixture after applying both F02 migrations.

create or replace function public.f02_assert(p_condition boolean, p_message text)
returns void language plpgsql as $$ begin
  if not p_condition then raise exception 'F02 assertion failed: %', p_message; end if;
end $$;

-- 1-2. v25 completes/fails only a legacy public claim.
do $$
declare c uuid := gen_random_uuid(); m uuid := gen_random_uuid(); q uuid := gen_random_uuid(); ok boolean;
begin
  insert into communities values (c); insert into community_messages(id, community_id) values (m,c);
  insert into community_message_push_queue(id,message_id,community_id) values(q,m,c);
  select queue_id is not null into ok from claim_pending_community_message_pushes(1); perform f02_assert(ok, 'legacy public claim');
  select success into ok from complete_community_message_push(q); perform f02_assert(ok, 'legacy public complete');
  perform f02_assert((select status='sent' and claim_protocol='LEGACY_V25' from community_message_push_queue where id=q), 'legacy complete preserves provenance');

  m := gen_random_uuid(); q := gen_random_uuid(); insert into community_messages(id,community_id) values(m,c);
  insert into community_message_push_queue(id,message_id,community_id) values(q,m,c);
  perform queue_id from claim_pending_community_message_pushes(1);
  select success into ok from fail_community_message_push(q, 'synthetic legacy failure'); perform f02_assert(ok, 'legacy public fail');
  perform f02_assert((select status='failed' and claim_protocol='LEGACY_V25' from community_message_push_queue where id=q), 'legacy fail preserves provenance');
end $$;

-- 3-5. Legacy terminal RPCs cannot alter private or public V2 leases; wrong
-- and replaced lease tokens are rejected.
do $$
declare c uuid := gen_random_uuid(); private_user uuid := gen_random_uuid(); m uuid := gen_random_uuid(); q uuid := gen_random_uuid(); r record; old_token uuid; replacement uuid := gen_random_uuid(); rejected boolean;
begin
  insert into communities values(c); insert into community_members values(c,private_user,true);
  insert into community_messages(id,community_id,target_user_id) values(m,c,private_user);
  insert into community_message_push_queue(id,message_id,community_id) values(q,m,c);
  select * into r from claim_pending_community_message_pushes_v2(1); old_token := r.claim_token;
  rejected := false; begin perform success from complete_community_message_push(q); exception when others then rejected := true; end;
  perform f02_assert(rejected, 'legacy complete rejects V2 private');
  rejected := false; begin perform success from fail_community_message_push(q,'x'); exception when others then rejected := true; end;
  perform f02_assert(rejected, 'legacy fail rejects V2 private');
  rejected := false; begin perform complete_community_message_push_v2(q, gen_random_uuid(), '{}'::jsonb); exception when others then rejected := true; end;
  perform f02_assert(rejected, 'wrong V2 lease rejected');
  update community_message_push_queue set claim_token=replacement where id=q;
  rejected := false; begin perform mark_community_message_push_provider_contacted_v2(q, old_token); exception when others then rejected := true; end;
  perform f02_assert(rejected, 'replaced V2 lease rejected');

  m := gen_random_uuid(); q := gen_random_uuid(); insert into community_messages(id,community_id) values(m,c);
  insert into community_message_push_queue(id,message_id,community_id) values(q,m,c);
  select * into r from claim_pending_community_message_pushes_v2(1);
  rejected := false; begin perform success from complete_community_message_push(q); exception when others then rejected := true; end;
  perform f02_assert(rejected, 'legacy complete rejects V2 public');
  perform f02_assert((select status='processing' and claim_protocol='V2' and claim_token=r.claim_token from community_message_push_queue where id=q), 'V2 public remains leased');
end $$;

-- 6. Tenant membership is validated atomically: a private target belonging
-- only to another community is quarantined, never converted to public.
do $$
declare c1 uuid := gen_random_uuid(); c2 uuid := gen_random_uuid(); u uuid := gen_random_uuid(); m uuid := gen_random_uuid(); q uuid := gen_random_uuid(); r record;
begin
  insert into communities values(c1),(c2); insert into community_members values(c2,u,true);
  insert into community_messages(id,community_id,target_user_id) values(m,c1,u);
  insert into community_message_push_queue(id,message_id,community_id) values(q,m,c1);
  select * into r from claim_pending_community_message_pushes_v2(5);
  perform f02_assert((select status='failed' and audience_type='PRIVATE' and audience_target_user_id=u and failure_code='INVALID_PRIVATE_AUDIENCE' and claim_protocol='V2' from community_message_push_queue where id=q), 'cross-community private audience quarantined');
end $$;

-- 7-9. Only a stale V2 PRE_PROVIDER lease is requeued. Provider-contacted,
-- legacy, and unclassified claims become non-replayable UNKNOWN_OUTCOME.
do $$
declare c uuid := gen_random_uuid(); u uuid := gen_random_uuid(); m uuid := gen_random_uuid(); q_safe uuid := gen_random_uuid(); q_contact uuid := gen_random_uuid(); q_legacy uuid := gen_random_uuid(); r record;
begin
  insert into communities values(c); insert into community_members values(c,u,true);
  insert into community_messages(id,community_id,target_user_id) values(m,c,u);
  insert into community_message_push_queue(id,message_id,community_id) values(q_safe,m,c),(q_contact,m,c);
  select * into r from claim_pending_community_message_pushes_v2(2);
  update community_message_push_queue set updated_at=now()-interval '20 minutes' where id=q_safe;
  select * into r from community_message_push_queue where id=q_contact;
  perform mark_community_message_push_provider_contacted_v2(q_contact, r.claim_token);
  update community_message_push_queue set updated_at=now()-interval '20 minutes' where id=q_contact;
  m:=gen_random_uuid(); insert into community_messages(id,community_id) values(m,c); insert into community_message_push_queue(id,message_id,community_id) values(q_legacy,m,c);
  perform queue_id from claim_pending_community_message_pushes(1); update community_message_push_queue set updated_at=now()-interval '20 minutes' where id=q_legacy;
  perform sweep_stale_community_message_pushes();
  perform f02_assert((select status='pending' and claim_protocol='V2' and claim_token is null from community_message_push_queue where id=q_safe), 'pre-provider V2 safely requeued');
  perform f02_assert((select status='failed' and delivery_stage='UNKNOWN_OUTCOME' from community_message_push_queue where id=q_contact), 'post-provider claim never replayed');
  perform f02_assert((select status='failed' and delivery_stage='UNKNOWN_OUTCOME' from community_message_push_queue where id=q_legacy), 'legacy stale claim never replayed');
  delete from community_messages where community_id=c;
  delete from community_members where community_id=c;
  delete from communities where id=c;
end $$;

-- 10-12. A V2 retry remains invisible to v25; public NULL work remains
-- legacy-compatible. The function ACLs exclude PUBLIC/anon/authenticated.
do $$
declare c uuid := gen_random_uuid(); m_v2 uuid := gen_random_uuid(); m_legacy uuid := gen_random_uuid(); q_v2 uuid := gen_random_uuid(); q_legacy uuid := gen_random_uuid(); r record; legacy_count integer;
begin
  insert into communities values(c); insert into community_messages(id,community_id) values(m_v2,c),(m_legacy,c);
  insert into community_message_push_queue(id,message_id,community_id,claim_protocol) values(q_v2,m_v2,c,'V2'),(q_legacy,m_legacy,c,null);
  select * into r from claim_pending_community_message_pushes(5);
  select count(*) into legacy_count from community_message_push_queue where status='processing' and claim_protocol='LEGACY_V25';
  perform f02_assert(legacy_count=1 and (select status='pending' and claim_protocol='V2' from community_message_push_queue where id=q_v2), 'rollback v25 excludes V2 public retry');
  perform f02_assert(not has_function_privilege('anon','public.complete_community_message_push(uuid)','execute') and not has_function_privilege('authenticated','public.fail_community_message_push(uuid,text)','execute'), 'legacy RPC ACL is service-role-only');
  delete from community_messages where id in (m_v2, m_legacy);
end $$;

-- 13. Pre-provider failure retains V2 provenance, clears the old lease, and
-- mints a different lease on reclaim. Both the released and new stale token
-- are rejected after the terminal transition.
do $$
declare c uuid := gen_random_uuid(); m uuid := gen_random_uuid(); q uuid := gen_random_uuid(); first_claim record; second_claim record; rejected boolean;
begin
  insert into communities values(c); insert into community_messages(id,community_id) values(m,c);
  insert into community_message_push_queue(id,message_id,community_id) values(q,m,c);
  select * into first_claim from claim_pending_community_message_pushes_v2(1);
  perform retry_community_message_push_pre_provider_v2(q, first_claim.claim_token, 'SYNTHETIC_PRE_PROVIDER', 'synthetic');
  perform f02_assert((select status='pending' and claim_protocol='V2' and claim_token is null from community_message_push_queue where id=q), 'pre-provider failure safely releases only its lease');
  rejected := false; begin perform mark_community_message_push_provider_contacted_v2(q, first_claim.claim_token); exception when sqlstate 'P0001' then rejected := true; end;
  perform f02_assert(rejected, 'released lease token cannot cross provider boundary');
  update community_message_push_queue set next_attempt_at=now() where id=q;
  select * into second_claim from claim_pending_community_message_pushes_v2(1);
  perform f02_assert(second_claim.queue_id=q and second_claim.claim_token<>first_claim.claim_token, 'reclaim mints a distinct lease');
  perform mark_community_message_push_provider_contacted_v2(q, second_claim.claim_token);
  perform complete_community_message_push_v2(q, second_claim.claim_token, '{"accepted":1}'::jsonb);
  rejected := false; begin perform complete_community_message_push_v2(q, second_claim.claim_token, '{}'::jsonb); exception when sqlstate 'P0001' then rejected := true; end;
  perform f02_assert(rejected and (select status='sent' and claim_protocol='V2' from community_message_push_queue where id=q), 'completed lease cannot be replayed');
end $$;

-- 14. Any failure after the provider-contact boundary is terminal and cannot
-- be reclaimed automatically.
do $$
declare c uuid := gen_random_uuid(); m uuid := gen_random_uuid(); q uuid := gen_random_uuid(); claimed record; reclaimed integer;
begin
  insert into communities values(c); insert into community_messages(id,community_id) values(m,c);
  insert into community_message_push_queue(id,message_id,community_id) values(q,m,c);
  select * into claimed from claim_pending_community_message_pushes_v2(1);
  perform mark_community_message_push_provider_contacted_v2(q, claimed.claim_token);
  perform fail_community_message_push_v2(q, claimed.claim_token, 'SYNTHETIC_UNKNOWN', 'synthetic', null, true);
  select count(*) into reclaimed from claim_pending_community_message_pushes_v2(5) where queue_id=q;
  perform f02_assert(reclaimed=0 and (select status='failed' and delivery_stage='UNKNOWN_OUTCOME' and claim_protocol='V2' from community_message_push_queue where id=q), 'post-provider unknown outcome is terminal and non-replayable');
end $$;

-- 15. Every F02 definer pins an empty search_path, and both legacy and v2
-- worker RPC surfaces exclude PUBLIC/anon/authenticated while allowing the
-- service role.
do $$
declare insecure_count integer;
begin
  select count(*) into insecure_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'claim_pending_community_message_pushes',
      'claim_pending_community_message_pushes_v2',
      'mark_community_message_push_provider_contacted_v2',
      'retry_community_message_push_pre_provider_v2',
      'complete_community_message_push',
      'complete_community_message_push_v2',
      'fail_community_message_push',
      'fail_community_message_push_v2',
      'sweep_stale_community_message_pushes',
      'ensure_welcome_push_after_token'
    )
    and (not p.prosecdef or coalesce(array_to_string(p.proconfig, ','),'') not like '%search_path=""%');
  perform f02_assert(insecure_count=0, 'F02 SECURITY DEFINER functions have an empty pinned search_path');
  perform f02_assert(
    not has_function_privilege('anon','public.complete_community_message_push_v2(uuid,uuid,jsonb)','execute')
    and not has_function_privilege('authenticated','public.fail_community_message_push_v2(uuid,uuid,text,text,jsonb,boolean)','execute')
    and has_function_privilege('service_role','public.claim_pending_community_message_pushes_v2(integer)','execute'),
    'v2 RPC ACL is service-role-only'
  );
end $$;

drop function public.f02_assert(boolean, text);
