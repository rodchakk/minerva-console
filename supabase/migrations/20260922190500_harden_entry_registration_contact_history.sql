-- Harden ENTRY Resident Registration WhatsApp contact history as append-only.
--
-- Supabase default grants can leave service_role with UPDATE/DELETE on newly
-- created public tables even when the feature only intends SELECT/INSERT.

revoke all on table public.community_registration_contact_events from service_role;
grant select, insert on table public.community_registration_contact_events to service_role;
