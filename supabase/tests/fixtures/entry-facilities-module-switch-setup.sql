-- Isolated PostgreSQL 17 smoke fixture for the Facilities feature flag migration.
-- This is intentionally NOT a production data snapshot.
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION public.is_superadmin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;

CREATE TABLE public.community_settings (
  community_id uuid PRIMARY KEY,
  allow_reservations boolean NOT NULL
);

CREATE TABLE public.community_facilities (
  id uuid PRIMARY KEY,
  community_id uuid NOT NULL,
  name text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  opening_time time,
  closing_time time,
  slot_minutes integer,
  approval_mode text,
  price_per_slot numeric,
  currency_code text,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE public.facility_reservations (
  id uuid PRIMARY KEY,
  community_id uuid NOT NULL,
  facility_id uuid,
  resident_user_id uuid,
  house_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  status text,
  note text,
  created_by_role text,
  slot_minutes_snapshot integer,
  slots_count integer,
  price_per_slot_snapshot numeric,
  currency_code_snapshot text,
  total_amount numeric,
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  cancelled_by uuid,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz,
  updated_at timestamptz
);

ALTER TABLE public.community_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY cf_smoke_permit ON public.community_facilities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY fr_smoke_permit ON public.facility_reservations
  FOR SELECT TO authenticated USING (true);
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.community_facilities, public.facility_reservations, public.community_settings TO authenticated;

-- The two synthetic communities have exactly opposite module states.
INSERT INTO public.community_settings (community_id, allow_reservations) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
INSERT INTO public.community_facilities (id,community_id,is_active,name) VALUES
  ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,'OFF test facility'),
  ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true,'ON test facility');
INSERT INTO public.facility_reservations (id,community_id,facility_id,status) VALUES
  ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','PENDING'),
  ('44444444-4444-4444-8444-444444444444','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','PENDING');
