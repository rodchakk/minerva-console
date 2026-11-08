// Run only against the disposable phase-3 laboratory. No production URL is accepted.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const lab = process.env.ENTRY_RELATIONSHIPS_LAB;
assert.ok(lab, 'Set ENTRY_RELATIONSHIPS_LAB to the disposable lab directory');
const config = JSON.parse(readFileSync(`${lab}/start.log`, 'utf8').split(/\r?\n/).find(x => x.startsWith('{"DB_URL"')));
assert.equal(config.API_URL, 'http://127.0.0.1:56321');
const container = 'supabase_db_entry-relationships-phase3-lab';
function sql(text) {
  return execFileSync('docker', ['exec', container, 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-c', text], { encoding: 'utf8' }).trim();
}
async function request(path, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(config.API_URL + path, {
    method, headers: { apikey: config.ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}
async function user() {
  const email = `${randomUUID()}@example.test`, password = randomUUID() + '!Aa9';
  const created = await request('/auth/v1/admin/users', config.SERVICE_ROLE_KEY, { email, password, email_confirm: true });
  assert.equal(created.status, 200, JSON.stringify(created));
  const login = await request('/auth/v1/token?grant_type=password', config.ANON_KEY, { email, password });
  assert.equal(login.status, 200, JSON.stringify(login));
  return { id: created.data.id, token: login.data.access_token };
}
const admin = await user(), member = await user();
const community = randomUUID(), other = randomUUID(), a = randomUUID(), b = randomUUID(), outside = randomUUID();
sql(`insert into public.superadmin_users(user_id) values ('${admin.id}');
insert into public.communities(id,name,community_code) values ('${community}','Synthetic lab','${community}'),('${other}','Synthetic other','${other}');
insert into public.community_settings(community_id) values ('${community}'),('${other}') on conflict do nothing;
insert into public.houses(id,community_id,house_label) values ('${a}','${community}','Apartamento 1'),('${b}','${community}','Unit B'),('${outside}','${other}','Outside');
insert into public.community_members(community_id,user_id,role) values ('${community}','${member.id}','RESIDENT'),('${community}','${admin.id}','ADMIN');
insert into public.house_residents(community_id,house_id,user_id,is_primary) values ('${community}','${a}','${member.id}',true);`);
sql(`insert into public.profiles(user_id,community_id,house_id,role,full_name,phone) values ('${member.id}','${community}','${a}','RESIDENT','Synthetic Resident','555000000');
insert into public.profiles(user_id,community_id,role,full_name,phone) values ('${admin.id}','${community}','RESIDENT','Synthetic Admin','555000001');
insert into public.visit_passes(community_id,house_id,created_by,visitor_name,pass_type,pin_code,qr_token,expires_at) values ('${community}','${a}','${member.id}','Synthetic Visitor','VISIT','123456','${randomUUID()}',now()+interval '1 day');
insert into public.financial_periods(id,community_id,year,month) values ('${community}','${community}',2026,11);
insert into public.financial_entries(community_id,financial_period_id,entry_type,amount,entry_date) values ('${community}','${community}','income',100,current_date);`);
const rpc = (action, args = {}, token = admin.token) => request('/rest/v1/rpc/manage_entry_unit_relationship_v1', token, { p_action: action, p_community_id: community, ...args });
const legacyLabel = (label) => request('/rest/v1/rpc/admin_update_house_label', admin.token, { p_house_id: a, p_house_label: label });
const legacyProfile = (label, owner) => request('/rest/v1/rpc/admin_update_house_profile', admin.token, { p_house_id: a, p_house_label: label, p_owner_name: owner });
const directLabel = (label) => request(`/rest/v1/houses?id=eq.${a}`, admin.token, { house_label: label }, 'PATCH');
const serviceDirectLabel = (label) => request(`/rest/v1/houses?id=eq.${a}`, config.SERVICE_ROLE_KEY, { house_label: label }, 'PATCH');
assert.equal((await rpc('link_units', { p_unit_id: a, p_other_unit_id: b })).status, 403, 'default gate');
assert.equal((await rpc('rename_unit', { p_unit_id: a, p_label: 'Apartamento 1', p_expected_label: 'Apartamento 1' })).status, 200, 'legacy label editing remains available with associations disabled');
sql(`update public.community_settings set allow_unit_relationships=true where community_id='${community}'; notify pgrst, 'reload schema';`);
const associationBefore = await snapshot(true);
assert.equal((await rpc('link_units', { p_unit_id: a, p_other_unit_id: b }, member.token)).status, 403);
assert.equal((await rpc('link_units', { p_unit_id: a, p_other_unit_id: outside })).status, 409);
assert.equal((await rpc('rename_unit', { p_unit_id: randomUUID(), p_label: 'Missing', p_expected_label: 'Missing' })).status, 409);
assert.ok((await rpc('link_units', { p_unit_id: a, p_other_unit_id: a })).status >= 400);
assert.ok((await rpc('link_units', { p_unit_id: a, p_other_unit_id: b }, config.ANON_KEY)).status >= 400);
const pair = await Promise.all([rpc('link_units', { p_unit_id: a, p_other_unit_id: b }), rpc('link_units', { p_unit_id: b, p_other_unit_id: a })]);
pair.forEach(r => assert.equal(r.status, 200, JSON.stringify(r)));
assert.equal(pair[0].data.id, pair[1].data.id);
assert.equal(pair.filter(r => r.data.created).length, 1);
assert.equal(sql(`select count(*) from public.superadmin_audit_log where action='entry.unit_link.create' and target_id='${pair[0].data.id}'`), '1');
assert.deepEqual((await request('/rest/v1/entry_unit_links?select=id', member.token)).data, []);
assert.equal((await request(`/rest/v1/entry_unit_links?select=id&community_id=eq.${community}`, admin.token)).data.length, 1);
assert.equal((await request(`/rest/v1/entry_unit_links?id=eq.${pair[0].data.id}`, config.SERVICE_ROLE_KEY, {}, 'DELETE')).status, 403);
const responsibility = await rpc('assign_responsible', { p_unit_id: b, p_user_id: member.id });
assert.equal(responsibility.status, 200);
assert.equal((await rpc('remove_responsible', { p_responsibility_id: responsibility.data.id })).status, 200);
assert.equal((await rpc('assign_responsible', { p_unit_id: b, p_user_id: member.id })).status, 200);
assert.equal((await rpc('assign_responsible', { p_unit_id: b, p_user_id: randomUUID() })).status, 409);
assert.deepEqual(await snapshot(true), associationBefore, 'associations must not change units, residence, access or finance');
const ownerBeforeBlockedRename = sql(`select coalesce(owner_name,'') from public.houses where id='${a}'`);
sql(`insert into public.resident_activation_queue(community_id,house_id,unit_label,resident_name) values ('${community}','${a}','Apartamento 1','Pending lab');`);
assert.ok((await rpc('rename_unit', { p_unit_id: a, p_label: 'Blocked', p_expected_label: 'Apartamento 1' })).status >= 400);
assert.ok((await legacyLabel('Blocked legacy')).status >= 400);
assert.ok((await legacyProfile('Blocked profile', 'Changed owner')).status >= 400);
assert.ok((await directLabel('Blocked direct')).status >= 400);
assert.ok((await serviceDirectLabel('Blocked service')).status >= 400);
assert.equal(sql(`select coalesce(owner_name,'') from public.houses where id='${a}'`), ownerBeforeBlockedRename, 'blocked profile rename must roll back owner change');
sql(`delete from public.resident_activation_queue where community_id='${community}';
insert into public.community_registration_campaigns(id,community_id,internal_name,public_title,public_slug,status) values ('${community}','${community}','Lab','Lab','${community}','open');
insert into public.community_registration_units(campaign_id,community_id,house_id,unit_label_snapshot,normalized_unit_label) values ('${community}','${community}','${a}','Apartamento 1','apartamento1');`);
assert.ok((await rpc('rename_unit', { p_unit_id: a, p_label: 'Blocked', p_expected_label: 'Apartamento 1' })).status >= 400);
assert.ok((await legacyLabel('Blocked legacy')).status >= 400);
assert.ok((await legacyProfile('Blocked profile', 'Changed owner')).status >= 400);
assert.ok((await directLabel('Blocked direct')).status >= 400);
assert.ok((await serviceDirectLabel('Blocked service')).status >= 400);
sql(`update public.community_registration_campaigns set status='closed' where id='${community}';`);
assert.equal((await directLabel(' unit-b ')).status, 409, 'direct update normalized conflict');
assert.equal((await serviceDirectLabel(' unit-b ')).status, 409, 'service role direct update normalized conflict');
const deadlocksBefore = Number(sql('select deadlocks from pg_stat_database where datname=current_database()'));
sql(`create function public.delay_service_rename_test() returns trigger language plpgsql as $$ begin if new.house_label='Service concurrent' then perform pg_sleep(2); end if; return new; end $$;
create trigger aaa_delay_service_rename_test before update of house_label on public.houses for each row execute function public.delay_service_rename_test();`);
const serviceWriter = serviceDirectLabel('Service concurrent');
let directWriterHoldsRow = false;
for (let attempt = 0; attempt < 20; attempt += 1) {
  directWriterHoldsRow = sql(`select exists(select 1 from pg_stat_activity where datname=current_database() and usename='authenticator' and wait_event='PgSleep')`) === 't';
  if (directWriterHoldsRow) break;
  await new Promise((resolve) => setTimeout(resolve, 50));
}
assert.ok(directWriterHoldsRow, 'direct writer did not reach the forced row-lock window');
const rpcWriter = rpc('rename_unit', { p_unit_id: a, p_label: 'RPC concurrent', p_expected_label: 'Apartamento 1' });
const mixedWriters = await Promise.race([
  Promise.all([rpcWriter, serviceWriter]),
  new Promise((_, reject) => setTimeout(() => reject(new Error('mixed rename writers timed out')), 10000)),
]);
sql('drop trigger aaa_delay_service_rename_test on public.houses; drop function public.delay_service_rename_test();');
assert.equal(mixedWriters[1].status, 204, JSON.stringify(mixedWriters));
assert.equal(mixedWriters[0].status, 500, JSON.stringify(mixedWriters));
assert.equal(mixedWriters[0].data?.code, '40001', JSON.stringify(mixedWriters));
assert.notEqual(mixedWriters[0].data?.code, '40P01', JSON.stringify(mixedWriters));
assert.equal(Number(sql('select deadlocks from pg_stat_database where datname=current_database()')), deadlocksBefore, 'mixed writers must not deadlock');
assert.equal(sql(`select house_label from public.houses where id='${a}'`), 'Service concurrent');
assert.equal(sql(`select count(*) from public.superadmin_audit_log where action='entry.unit_label.rename' and target_id='${a}' and actor_user_id is null and metadata->>'actor_kind'='system' and metadata->>'actor_role'='service_role' and metadata->>'new_label'='Service concurrent'`), '1', 'service role audit must retain system identity without inventing a user');
assert.equal((await serviceDirectLabel('Apartamento 1')).status, 204);
let renameAuditCount = Number(sql(`select count(*) from public.superadmin_audit_log where action='entry.unit_label.rename' and target_id='${a}'`));
assert.equal((await directLabel('Apartamento direct')).status, 204);
assert.equal(Number(sql(`select count(*) from public.superadmin_audit_log where action='entry.unit_label.rename' and target_id='${a}'`)), ++renameAuditCount);
assert.equal((await legacyLabel('Apartamento legacy')).status, 200);
assert.equal(Number(sql(`select count(*) from public.superadmin_audit_log where action='entry.unit_label.rename' and target_id='${a}'`)), ++renameAuditCount);
const profileRename = await legacyProfile('Apartamento profile', 'Synthetic Owner');
assert.equal(profileRename.status, 200, JSON.stringify(profileRename));
assert.equal(Number(sql(`select count(*) from public.superadmin_audit_log where action='entry.unit_label.rename' and target_id='${a}'`)), ++renameAuditCount);
assert.equal((await directLabel('Apartamento profile')).status, 204);
assert.equal(Number(sql(`select count(*) from public.superadmin_audit_log where action='entry.unit_label.rename' and target_id='${a}'`)), renameAuditCount, 'no-op rename must not audit');
async function snapshot(associations = false) {
  const excluded = associations ? "'entry_unit_links','entry_unit_responsibilities','superadmin_audit_log'" : "'houses','superadmin_audit_log'";
  const tables = sql(`select tablename from pg_tables where schemaname='public' and tablename not in (${excluded}) order by tablename`).split('\n');
  return Object.fromEntries(tables.map(t => [t, sql(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from public."${t}" t`)]));
}
const before = await snapshot();
const houseBefore = sql(`select to_jsonb(h)-'house_label'-'updated_at' from public.houses h where id='${a}'`);
assert.equal((await rpc('rename_unit', { p_unit_id: a, p_label: 'Casa 2009', p_expected_label: 'Apartamento profile' })).status, 200);
assert.equal(Number(sql(`select count(*) from public.superadmin_audit_log where action='entry.unit_label.rename' and target_id='${a}'`)), ++renameAuditCount, 'RPC rename must audit exactly once');
assert.deepEqual(await snapshot(), before, 'rename must preserve every non-house/non-audit table');
assert.equal(sql(`select house_label from public.houses where id='${a}'`), 'Casa 2009');
assert.equal(sql(`select to_jsonb(h)-'house_label'-'updated_at' from public.houses h where id='${a}'`), houseBefore);
assert.equal((await rpc('rename_unit', { p_unit_id: a, p_label: 'Stale', p_expected_label: 'Apartamento 1' })).status, 500);
const concurrentRenames = await Promise.all([
  rpc('rename_unit', { p_unit_id: a, p_label: 'Concurrent A', p_expected_label: 'Casa 2009' }),
  rpc('rename_unit', { p_unit_id: a, p_label: 'Concurrent B', p_expected_label: 'Casa 2009' }),
]);
assert.equal(concurrentRenames.filter((result) => result.status === 200).length, 1, JSON.stringify(concurrentRenames));
assert.equal(concurrentRenames.filter((result) => result.status >= 400).length, 1, JSON.stringify(concurrentRenames));
const concurrentWinner = sql(`select house_label from public.houses where id='${a}'`);
assert.equal((await rpc('rename_unit', { p_unit_id: a, p_label: 'Casa 2009', p_expected_label: concurrentWinner })).status, 200);
assert.equal((await rpc('unlink_units', { p_link_id: pair[0].data.id })).status, 200);
assert.equal((await request(`/rest/v1/entry_unit_links?id=eq.${pair[0].data.id}`, admin.token, { ended_at: null, ended_by: null }, 'PATCH')).status, 403);
assert.equal((await rpc('link_units', { p_unit_id: a, p_other_unit_id: b })).status, 200);
assert.equal(sql(`select count(*) from public.entry_unit_links where community_id='${community}'`), '2');
sql(`create function public.reject_audit_test() returns trigger language plpgsql as $$ begin raise exception 'audit_failure'; end $$;
create trigger reject_audit_test before insert on public.superadmin_audit_log for each row execute function public.reject_audit_test();`);
assert.equal((await rpc('rename_unit', { p_unit_id: a, p_label: 'Rollback', p_expected_label: 'Casa 2009' })).status, 400);
assert.equal(sql(`select house_label from public.houses where id='${a}'`), 'Casa 2009');
sql('drop trigger reject_audit_test on public.superadmin_audit_log; drop function public.reject_audit_test();');
sql(`update public.community_settings set allow_unit_relationships=false where community_id='${community}'`);
assert.deepEqual((await request(`/rest/v1/entry_unit_links?select=id&community_id=eq.${community}`, admin.token)).data, []);
console.log('PASS: real local Auth JWTs, PostgREST RPC/RLS, default gate, community constraints, mixed RPC/service-role concurrency without deadlock, system audit identity, history, rename isolation and atomic audit rollback');
