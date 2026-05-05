-- Add activated_user_id to resident_activation_queue so a completed activation
-- records which auth.users row was created from this queue entry.
-- Nullable: remains NULL until the resident completes mobile activation.

alter table public.resident_activation_queue
  add column if not exists activated_user_id uuid;

-- Sparse index — only populated rows need lookups.
create index if not exists idx_raq_activated_user_id
  on public.resident_activation_queue (activated_user_id)
  where activated_user_id is not null;
