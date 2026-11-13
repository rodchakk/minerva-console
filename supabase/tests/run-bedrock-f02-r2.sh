#!/usr/bin/env bash
set -euo pipefail

db_url="${1:-postgresql://postgres:postgres@127.0.0.1:5432/bedrock_f02_r2_ci}"

case "$db_url" in
  postgresql://*@127.0.0.1:*/*bedrock_f02_r2_*|postgres://*@127.0.0.1:*/*bedrock_f02_r2_*) ;;
  *)
    echo "Refusing F02 R2 tests against a non-local or ambiguously named database." >&2
    exit 2
    ;;
esac

admin_url="${db_url%/*}/postgres"
db_name="${db_url##*/}"

psql "$admin_url" -X -v ON_ERROR_STOP=1 -c "drop database if exists \"$db_name\" with (force);"
psql "$admin_url" -X -v ON_ERROR_STOP=1 -c "create database \"$db_name\";"

run_file() {
  psql "$db_url" -X -v ON_ERROR_STOP=1 -f "$1"
}

run_file supabase/tests/fixtures/bedrock-f02-r2-schema.sql
run_file supabase/tests/fixtures/bedrock-f02-r2-historical-data.sql
run_file supabase/migrations/20261028032025_bedrock_f02_notification_audience_isolation.sql
run_file supabase/tests/bedrock-f02-r1-transition.sql
run_file supabase/migrations/20261028035327_f02_legacy_claim_lease_isolation.sql
run_file supabase/tests/bedrock-f02-r2-migration-compatibility.sql
run_file supabase/tests/bedrock-f02-r2-integration.sql

community_id="90000000-0000-0000-0000-000000000001"
message_id="90000000-0000-0000-0000-000000000002"
queue_id="90000000-0000-0000-0000-000000000003"
lock_key=741025

pending_count="$(psql "$db_url" -X -Atc "select count(*) from public.community_message_push_queue where status='pending';")"
test "$pending_count" = "0"

psql "$db_url" -X -v ON_ERROR_STOP=1 <<SQL
insert into public.communities(id) values ('$community_id');
insert into public.community_messages(id, community_id) values ('$message_id', '$community_id');
insert into public.community_message_push_queue(id, message_id, community_id) values ('$queue_id', '$message_id', '$community_id');
SQL

worker_a_output="$(mktemp)"
cleanup() {
  rm -f "$worker_a_output"
}
trap cleanup EXIT

psql "$db_url" -X -v ON_ERROR_STOP=1 -At >"$worker_a_output" <<SQL &
begin;
select count(*) from public.claim_pending_community_message_pushes_v2(1);
select pg_advisory_lock($lock_key);
select pg_sleep(4);
select pg_advisory_unlock($lock_key);
commit;
SQL
worker_a_pid=$!

lock_observed=0
for _ in $(seq 1 40); do
  lock_count="$(psql "$db_url" -X -Atc "select count(*) from pg_locks where locktype='advisory' and granted and classid=0 and objid=$lock_key;")"
  if test "$lock_count" != "0"; then
    lock_observed=1
    break
  fi
  sleep 0.1
done
test "$lock_observed" = "1"

second_count="$(psql "$db_url" -X -Atc "select count(*) from public.claim_pending_community_message_pushes_v2(1);")"
test "$second_count" = "0"
wait "$worker_a_pid"

final_state="$(psql "$db_url" -X -Atc "select status || '|' || attempts || '|' || claim_protocol || '|' || (claim_token is not null)::text from public.community_message_push_queue where id='$queue_id';")"
test "$final_state" = "processing|1|V2|true"

echo "PASS: F02 R2 PostgreSQL behavior and concurrent claim isolation."
