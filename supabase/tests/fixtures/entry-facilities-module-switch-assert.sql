-- Assertions run AFTER the Facilities module switch migration on isolated PostgreSQL.
DO $check$
BEGIN
  IF (
    SELECT count(*)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'resident_list_community_facilities',
        'admin_list_community_facilities',
        'admin_list_facility_reservations',
        'list_my_facility_reservations',
        'get_facility_availability'
      )
      AND pg_get_functiondef(p.oid) ~* 'allow_reservations IS TRUE'
  ) <> 5 THEN RAISE EXCEPTION 'A read RPC is missing its module guard'; END IF;

  IF (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN (
        'community_facilities_feature_enabled_select',
        'facility_reservations_feature_enabled_select'
      )
      AND permissive = 'RESTRICTIVE'
      AND qual ~* 'allow_reservations'
  ) <> 2 THEN RAISE EXCEPTION 'Feature policies missing or not restrictive'; END IF;
END
$check$;

-- Non-superadmin authenticated users must not see rows when OFF.
SET ROLE authenticated;
DO $check$
BEGIN
  IF (SELECT count(*) FROM public.community_facilities) <> 1 THEN
    RAISE EXCEPTION 'OFF facility is visible under authenticated RLS';
  END IF;
  IF (SELECT count(*) FROM public.facility_reservations) <> 1 THEN
    RAISE EXCEPTION 'OFF reservation is visible under authenticated RLS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.community_facilities
    WHERE community_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ) THEN RAISE EXCEPTION 'ON facility incorrectly hidden'; END IF;
END
$check$;
RESET ROLE;

-- Row-level insert/update guard remains authoritative even for privileged writes.
CREATE TRIGGER smoke_guard_community_facilities
  BEFORE INSERT OR UPDATE ON public.community_facilities
  FOR EACH ROW EXECUTE FUNCTION public.guard_community_facilities_by_setting();

CREATE TRIGGER smoke_guard_facility_reservations
  BEFORE INSERT OR UPDATE ON public.facility_reservations
  FOR EACH ROW EXECUTE FUNCTION public.guard_facility_reservations_by_setting();

DO $check$
BEGIN
  BEGIN
    INSERT INTO public.community_facilities (id,community_id,name,is_active)
    VALUES ('55555555-5555-4555-8555-555555555555',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','OFF denied',true);
    RAISE EXCEPTION 'OFF facility insert succeeded unexpectedly';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  BEGIN
    INSERT INTO public.community_facilities (id,community_id,name,is_active)
    VALUES ('66666666-6666-4666-8666-666666666666',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc','Missing settings denied',true);
    RAISE EXCEPTION 'Missing settings allowed active facility';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  -- Disabling an individual facility while module is OFF must remain possible.
  UPDATE public.community_facilities
  SET is_active = false
  WHERE id = '11111111-1111-4111-8111-111111111111';

  BEGIN
    INSERT INTO public.facility_reservations (id,community_id,status)
    VALUES ('77777777-7777-4777-8777-777777777777',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PENDING');
    RAISE EXCEPTION 'OFF reservation insert succeeded unexpectedly';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  -- Historical pending reservations can still be cancelled while module is OFF.
  UPDATE public.facility_reservations SET status = 'CANCELLED'
  WHERE id = '33333333-3333-4333-8333-333333333333';

  IF NOT EXISTS (
    SELECT 1 FROM public.facility_reservations
    WHERE id = '33333333-3333-4333-8333-333333333333' AND status = 'CANCELLED'
  ) THEN RAISE EXCEPTION 'OFF cancellation was blocked'; END IF;
END
$check$;
