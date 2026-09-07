-- ENTRY-OUTRIDER-001: private export bucket for handoff ZIP packages.
-- Vercel Functions cap response payloads, so generated packages are written to
-- private Supabase Storage and served with a short-lived signed URL.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'entry-outrider-exports',
  'entry-outrider-exports',
  false,
  104857600,
  array['application/zip']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
