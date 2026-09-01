create index if not exists support_ticket_messages_author_id_idx
  on public.support_ticket_messages(author_id);

drop policy if exists support_tickets_select_own_or_superadmin on public.support_tickets;
create policy support_tickets_select_own_or_superadmin
on public.support_tickets
for select
to authenticated
using (
  created_by = (select auth.uid())
  or (select public.is_superadmin(auth.uid()))
);

drop policy if exists support_ticket_messages_select_own_or_superadmin on public.support_ticket_messages;
create policy support_ticket_messages_select_own_or_superadmin
on public.support_ticket_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id
      and (
        t.created_by = (select auth.uid())
        or (select public.is_superadmin(auth.uid()))
      )
  )
);
