-- PostgreSQL 17 regression: a table-returning RPC's id output must not
-- collide with unqualified community_facilities.id in SQL statements.
-- Uses only synthetic fixture rows; never runs against production data.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT '99999999-9999-4999-8999-999999999999'::uuid $$;
CREATE OR REPLACE FUNCTION public.is_superadmin() RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT true $$;
CREATE TABLE public.communities (id uuid PRIMARY KEY);
INSERT INTO public.communities (id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

DO $regression$
DECLARE
  v_result record;
BEGIN
  -- Existing ON-community facility: should toggle without "id is ambiguous".
  SELECT * INTO v_result FROM public.superadmin_upsert_community_facility(
    p_community_id => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    p_facility_id => '22222222-2222-4222-8222-222222222222',
    p_name => 'ON test facility',
    p_is_active => false,
    p_opening_time => '08:00',
    p_closing_time => '22:00',
    p_slot_minutes => 60,
    p_approval_mode => 'MANUAL',
    p_price_per_slot => 100,
    p_currency_code => 'HNL'
  );
  IF v_result.id IS DISTINCT FROM '22222222-2222-4222-8222-222222222222'
     OR v_result.is_active IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Disable did not return expected facility row';
  END IF;

  SELECT * INTO v_result FROM public.superadmin_upsert_community_facility(
    p_community_id => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    p_facility_id => '22222222-2222-4222-8222-222222222222',
    p_name => 'ON test facility',
    p_is_active => true,
    p_opening_time => '08:00',
    p_closing_time => '22:00',
    p_slot_minutes => 60,
    p_approval_mode => 'MANUAL',
    p_price_per_slot => 100,
    p_currency_code => 'HNL'
  );
  IF v_result.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Enable did not return expected active facility';
  END IF;
  IF (SELECT count(*) FROM public.community_facilities) <> 2 THEN
    RAISE EXCEPTION 'Unexpected facility count';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.community_facilities cf
    WHERE cf.id='11111111-1111-4111-8111-111111111111'
      AND cf.community_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND cf.is_active IS TRUE
  ) THEN RAISE EXCEPTION 'Other community facility modified'; END IF;

  BEGIN
    PERFORM public.superadmin_upsert_community_facility(
      p_community_id => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_facility_id => '22222222-2222-4222-8222-222222222222',
      p_name => 'Cross-community forbidden'
    );
    RAISE EXCEPTION 'Cross-community facility change unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'P0404' THEN NULL;
  END;
END
$regression$;
