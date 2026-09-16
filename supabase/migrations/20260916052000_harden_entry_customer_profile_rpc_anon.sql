-- Explicitly prevent anonymous callers from invoking the customer profile write RPC.
-- The RPC already requires superadmin internally; this closes the database grant surface too.

revoke execute on function public.upsert_entry_customer_profile_v1(
  uuid,
  uuid,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) from anon;
