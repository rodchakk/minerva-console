-- ENTRY Support defense-in-depth hardening.
--
-- Support rows remain readable by authenticated users only through RLS.
-- All writes continue to flow through the reviewed SECURITY DEFINER RPCs.
-- The ticket-number sequence is internal to support_create_ticket() and does not
-- need to be exposed to browser roles.

revoke all privileges on table public.support_tickets from public, anon, authenticated;
revoke all privileges on table public.support_ticket_messages from public, anon, authenticated;

grant select on table public.support_tickets to authenticated;
grant select on table public.support_ticket_messages to authenticated;

revoke all privileges on sequence public.support_ticket_number_seq from public, anon, authenticated;

-- Keep the RPC boundary explicit. Browser callers may execute the support RPCs
-- only as authenticated users; each sensitive RPC performs its own authorization.
revoke all on function public.support_create_ticket(text, text, text, uuid, jsonb) from public, anon;
revoke all on function public.support_add_message(uuid, text) from public, anon;
revoke all on function public.support_update_status(uuid, text) from public, anon;
revoke all on function public.support_admin_list_tickets(text) from public, anon;
revoke all on function public.support_admin_get_ticket(uuid) from public, anon;

grant execute on function public.support_create_ticket(text, text, text, uuid, jsonb) to authenticated;
grant execute on function public.support_add_message(uuid, text) to authenticated;
grant execute on function public.support_update_status(uuid, text) to authenticated;
grant execute on function public.support_admin_list_tickets(text) to authenticated;
grant execute on function public.support_admin_get_ticket(uuid) to authenticated;
