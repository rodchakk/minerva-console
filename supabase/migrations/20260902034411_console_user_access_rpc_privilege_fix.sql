-- MINERVA-CONSOLE-USERS-001A hotfix: Supabase default function grants can include anon explicitly.
-- Keep the Console access RPC unavailable to anonymous callers.

revoke all on function public.get_console_access_context_v1() from public;
revoke all on function public.get_console_access_context_v1() from anon;
grant execute on function public.get_console_access_context_v1() to authenticated;
