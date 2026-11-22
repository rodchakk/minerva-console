-- Qualify identifiers in table-returning superadmin facility RPC.
-- Its output column 'id' collides with unqualified column references in PL/pgSQL.
-- No user/community/facility data is modified by this migration.

CREATE OR REPLACE FUNCTION public.superadmin_upsert_community_facility(p_community_id uuid, p_name text, p_description text DEFAULT NULL::text, p_is_active boolean DEFAULT true, p_opening_time time without time zone DEFAULT '10:00:00'::time without time zone, p_closing_time time without time zone DEFAULT '22:00:00'::time without time zone, p_slot_minutes integer DEFAULT 60, p_approval_mode text DEFAULT 'MANUAL'::text, p_price_per_slot numeric DEFAULT 0, p_currency_code text DEFAULT 'HNL'::text, p_facility_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, community_id uuid, name text, description text, is_active boolean, opening_time time without time zone, closing_time time without time zone, slot_minutes integer, approval_mode text, price_per_slot numeric, currency_code text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0401'; END IF;
  IF NOT public.is_superadmin() THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'P0403'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.communities AS c WHERE c.id = p_community_id) THEN
    RAISE EXCEPTION 'community_not_found' USING ERRCODE = 'P0404';
  END IF;
  IF p_name IS NULL OR trim(p_name) = '' THEN RAISE EXCEPTION 'name_required' USING ERRCODE = 'P0400'; END IF;
  IF p_opening_time >= p_closing_time THEN RAISE EXCEPTION 'invalid_hours' USING ERRCODE = 'P0400'; END IF;
  IF p_slot_minutes <= 0 THEN RAISE EXCEPTION 'invalid_slot_minutes' USING ERRCODE = 'P0400'; END IF;
  IF p_approval_mode NOT IN ('AUTO','MANUAL') THEN RAISE EXCEPTION 'invalid_approval_mode' USING ERRCODE = 'P0400'; END IF;
  IF p_price_per_slot < 0 THEN RAISE EXCEPTION 'invalid_price' USING ERRCODE = 'P0400'; END IF;
  IF p_currency_code IS NULL OR trim(p_currency_code) = '' THEN RAISE EXCEPTION 'currency_code_required' USING ERRCODE = 'P0400'; END IF;

  IF p_facility_id IS NULL THEN
    INSERT INTO public.community_facilities (
      community_id, name, description, is_active,
      opening_time, closing_time, slot_minutes,
      approval_mode, price_per_slot, currency_code
    ) VALUES (
      p_community_id, trim(p_name), p_description, p_is_active,
      p_opening_time, p_closing_time, p_slot_minutes,
      p_approval_mode, p_price_per_slot, trim(p_currency_code)
    )
    RETURNING community_facilities.id INTO v_new_id;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.community_facilities AS cf
      WHERE cf.id = p_facility_id AND cf.community_id = p_community_id
    ) THEN RAISE EXCEPTION 'facility_not_found_or_cross_community' USING ERRCODE = 'P0404'; END IF;
    UPDATE public.community_facilities AS cf SET
      name = trim(p_name), description = p_description, is_active = p_is_active,
      opening_time = p_opening_time, closing_time = p_closing_time,
      slot_minutes = p_slot_minutes, approval_mode = p_approval_mode,
      price_per_slot = p_price_per_slot, currency_code = trim(p_currency_code)
    WHERE cf.id = p_facility_id AND cf.community_id = p_community_id;
    v_new_id := p_facility_id;
  END IF;

  RETURN QUERY
  SELECT cf.id, cf.community_id, cf.name, cf.description,
         cf.is_active, cf.opening_time, cf.closing_time,
         cf.slot_minutes, cf.approval_mode,
         cf.price_per_slot, cf.currency_code,
         cf.created_at, cf.updated_at
  FROM public.community_facilities cf WHERE cf.id = v_new_id;
END;
$function$;
