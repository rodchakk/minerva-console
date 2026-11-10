-- ENTRY global unit relationships rollout.
-- Enables administrative association tools for existing and future communities.
-- No units, members, access passes, QR codes, roles or existing links are modified.
-- Existing superadmin-only write authorization and community-scoped read permissions remain unchanged.
--
-- The community creation RPC omits this column in its INSERT, so new
-- community_settings rows inherit the true default automatically.
alter table public.community_settings
  alter column allow_unit_relationships set default true;

-- Idempotent backfill of the existing community settings (including Andalucia).
-- This updates only the feature gate, never relations or residential privileges.
update public.community_settings
   set allow_unit_relationships = true
 where allow_unit_relationships = false;
