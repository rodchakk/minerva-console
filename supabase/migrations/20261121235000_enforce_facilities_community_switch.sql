-- ENTRY Facilities: module toggle is authoritative, no rows are deleted.
-- Protect SECURITY DEFINER reads; fail closed on missing community settings.
-- Generated from checked production function signatures on 2026-11-21.

-- resident_list_community_facilities
CREATE OR REPLACE FUNCTION public.resident_list_community_facilities()
 RETURNS TABLE(id uuid, community_id uuid, name text, description text, is_active boolean, opening_time time without time zone, closing_time time without time zone, slot_minutes integer, approval_mode text, price_per_slot numeric, currency_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0401'; END IF;
  v_cid := public._res_get_community_id();
  -- SECURITY DEFINER bypasses RLS; require explicit module enablement.
  IF NOT EXISTS (
    SELECT 1 FROM public.community_settings cs
    WHERE cs.community_id = v_cid AND cs.allow_reservations IS TRUE
  ) THEN RETURN; END IF;

  RETURN QUERY
  SELECT cf.id, cf.community_id, cf.name, cf.description,
         cf.is_active, cf.opening_time, cf.closing_time,
         cf.slot_minutes, cf.approval_mode, cf.price_per_slot, cf.currency_code
  FROM public.community_facilities cf
  WHERE cf.community_id = v_cid AND cf.is_active = true
  ORDER BY cf.name;
END;
$function$

-- admin_list_community_facilities
CREATE OR REPLACE FUNCTION public.admin_list_community_facilities()
 RETURNS TABLE(id uuid, community_id uuid, name text, description text, is_active boolean, opening_time time without time zone, closing_time time without time zone, slot_minutes integer, approval_mode text, price_per_slot numeric, currency_code text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0401'; END IF;
  v_cid := public._admin_get_community_id();
  -- SECURITY DEFINER bypasses RLS; require explicit module enablement.
  IF NOT EXISTS (
    SELECT 1 FROM public.community_settings cs
    WHERE cs.community_id = v_cid AND cs.allow_reservations IS TRUE
  ) THEN RETURN; END IF;

  RETURN QUERY
  SELECT cf.id, cf.community_id, cf.name, cf.description,
         cf.is_active, cf.opening_time, cf.closing_time,
         cf.slot_minutes, cf.approval_mode, cf.price_per_slot, cf.currency_code,
         cf.created_at, cf.updated_at
  FROM public.community_facilities cf
  WHERE cf.community_id = v_cid
  ORDER BY cf.is_active DESC, cf.name;
END;
$function$

-- admin_list_facility_reservations
CREATE OR REPLACE FUNCTION public.admin_list_facility_reservations(p_status text DEFAULT NULL::text, p_date date DEFAULT NULL::date)
 RETURNS TABLE(reservation_id uuid, facility_id uuid, facility_name text, resident_user_id uuid, resident_name text, house_id uuid, house_label text, start_at timestamp with time zone, end_at timestamp with time zone, status text, note text, created_by_role text, slot_minutes_snapshot integer, slots_count integer, price_per_slot_snapshot numeric, currency_code_snapshot text, total_amount numeric, created_at timestamp with time zone, approved_at timestamp with time zone, rejected_at timestamp with time zone, cancelled_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0401'; END IF;
  v_cid := public._admin_get_community_id();
  -- SECURITY DEFINER bypasses RLS; require explicit module enablement.
  IF NOT EXISTS (
    SELECT 1 FROM public.community_settings cs
    WHERE cs.community_id = v_cid AND cs.allow_reservations IS TRUE
  ) THEN RETURN; END IF;

  RETURN QUERY
  SELECT fr.id, fr.facility_id, cf.name,
         fr.resident_user_id, p.full_name,
         fr.house_id, h.house_label,
         fr.start_at, fr.end_at,
         fr.status, fr.note, fr.created_by_role,
         fr.slot_minutes_snapshot, fr.slots_count,
         fr.price_per_slot_snapshot, fr.currency_code_snapshot,
         fr.total_amount, fr.created_at,
         fr.approved_at, fr.rejected_at, fr.cancelled_at
  FROM public.facility_reservations fr
  JOIN public.community_facilities cf ON cf.id = fr.facility_id
  LEFT JOIN public.profiles p
    ON p.user_id = fr.resident_user_id AND p.community_id = v_cid
  LEFT JOIN public.houses h ON h.id = fr.house_id
  WHERE fr.community_id = v_cid
    AND (p_status IS NULL OR fr.status = p_status)
    AND (p_date   IS NULL OR fr.start_at::date = p_date)
  ORDER BY fr.start_at ASC;
END;
$function$

-- list_my_facility_reservations
CREATE OR REPLACE FUNCTION public.list_my_facility_reservations()
 RETURNS TABLE(reservation_id uuid, facility_id uuid, facility_name text, start_at timestamp with time zone, end_at timestamp with time zone, status text, note text, created_by_role text, slot_minutes_snapshot integer, slots_count integer, price_per_slot_snapshot numeric, currency_code_snapshot text, total_amount numeric, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0401'; END IF;
  RETURN QUERY
  SELECT fr.id, fr.facility_id, cf.name,
         fr.start_at, fr.end_at, fr.status, fr.note, fr.created_by_role,
         fr.slot_minutes_snapshot, fr.slots_count,
         fr.price_per_slot_snapshot, fr.currency_code_snapshot,
         fr.total_amount, fr.created_at
  FROM public.facility_reservations fr
  JOIN public.community_facilities cf ON cf.id = fr.facility_id
  WHERE fr.resident_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.community_settings cs
      WHERE cs.community_id = fr.community_id AND cs.allow_reservations IS TRUE
    )
  ORDER BY fr.start_at ASC;
END;
$function$

-- get_facility_availability
CREATE OR REPLACE FUNCTION public.get_facility_availability(p_facility_id uuid, p_date date)
 RETURNS TABLE(start_at timestamp with time zone, end_at timestamp with time zone, status text, reservation_status text, slot_minutes integer, price_per_slot numeric, currency_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid        uuid := auth.uid();
  v_fac        record;
  v_cid        uuid;
  v_is_admin   boolean := false;
  v_is_sa      boolean := false;
  v_tz         text;
  v_slot_start timestamptz;
  v_slot_end   timestamptz;
  v_day_open   timestamptz;
  v_day_close  timestamptz;
  v_today_local date;
  v_now_local  timestamp;
  v_res_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0401';
  END IF;

  SELECT cf.* INTO v_fac FROM public.community_facilities cf WHERE cf.id = p_facility_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'facility_not_found' USING ERRCODE = 'P0404'; END IF;

  v_cid   := v_fac.community_id;
  v_is_sa := public.is_superadmin();

  IF NOT v_is_sa THEN
    v_is_admin := public.core_is_admin(v_cid);
    IF NOT v_is_admin THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.community_members cm
        WHERE cm.user_id = v_uid AND cm.community_id = v_cid
          AND cm.is_active = true AND cm.role = 'RESIDENT'
      ) THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'P0403'; END IF;
      IF NOT v_fac.is_active THEN RAISE EXCEPTION 'facility_inactive' USING ERRCODE = 'P0400'; END IF;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.community_settings cs
    WHERE cs.community_id = v_cid AND cs.allow_reservations IS TRUE
  ) THEN RAISE EXCEPTION 'reservations_disabled' USING ERRCODE = 'P0403'; END IF;

  v_tz := public._community_timezone(v_cid);

  -- Construir apertura/cierre del día interpretados en hora local de la comunidad
  v_day_open  := (p_date::text || ' ' || v_fac.opening_time::text)::timestamp AT TIME ZONE v_tz;
  v_day_close := (p_date::text || ' ' || v_fac.closing_time::text)::timestamp AT TIME ZONE v_tz;

  -- "Hoy" y "ahora" en hora local de la comunidad
  v_today_local := (now() AT TIME ZONE v_tz)::date;
  v_now_local   :=  now() AT TIME ZONE v_tz;

  v_slot_start := v_day_open;
  LOOP
    v_slot_end := v_slot_start + (v_fac.slot_minutes || ' minutes')::interval;
    EXIT WHEN v_slot_end > v_day_close;

    -- Para hoy en la zona local: ocultar slots cuyo fin ya pasó
    IF p_date = v_today_local
       AND (v_slot_end AT TIME ZONE v_tz) <= v_now_local THEN
      v_slot_start := v_slot_end;
      CONTINUE;
    END IF;

    SELECT fr.status INTO v_res_status
    FROM public.facility_reservations fr
    WHERE fr.facility_id = p_facility_id
      AND fr.status IN ('PENDING','APPROVED')
      AND fr.start_at < v_slot_end AND fr.end_at > v_slot_start
    LIMIT 1;

    start_at           := v_slot_start;
    end_at             := v_slot_end;
    slot_minutes       := v_fac.slot_minutes;
    price_per_slot     := v_fac.price_per_slot;
    currency_code      := v_fac.currency_code;

    IF FOUND THEN
      status := 'OCCUPIED'; reservation_status := v_res_status;
    ELSE
      status := 'AVAILABLE'; reservation_status := NULL;
    END IF;

    RETURN NEXT;
    v_slot_start := v_slot_end;
  END LOOP;
END;
$function$

-- guard_community_facilities_by_setting
CREATE OR REPLACE FUNCTION public.guard_community_facilities_by_setting()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_allow_reservations boolean;
begin
  if coalesce(new.is_active, true) = false then
    return new;
  end if;

  select cs.allow_reservations
  into v_allow_reservations
  from public.community_settings cs
  where cs.community_id = new.community_id;

  if coalesce(v_allow_reservations, false) = false then
    raise exception 'Reservations are disabled for community %', new.community_id
      using errcode = '23514';
  end if;

  return new;
end;
$function$

-- guard_facility_reservations_by_setting
CREATE OR REPLACE FUNCTION public.guard_facility_reservations_by_setting()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_allow_reservations boolean;
  v_status text;
begin
  select cs.allow_reservations
  into v_allow_reservations
  from public.community_settings cs
  where cs.community_id = new.community_id;

  if coalesce(v_allow_reservations, false) = true then
    return new;
  end if;

  v_status := upper(coalesce(new.status, ''));

  if tg_op = 'UPDATE' and v_status in ('CANCELLED', 'REJECTED') then
    return new;
  end if;

  raise exception 'Reservations are disabled for community %', new.community_id
    using errcode = '23514';
end;
$function$


DROP POLICY IF EXISTS community_facilities_feature_enabled_select ON public.community_facilities;
CREATE POLICY community_facilities_feature_enabled_select ON public.community_facilities
AS RESTRICTIVE FOR SELECT TO authenticated USING (
  public.is_superadmin() OR EXISTS (
    SELECT 1 FROM public.community_settings cs
    WHERE cs.community_id = community_facilities.community_id AND cs.allow_reservations IS TRUE
  )
);

DROP POLICY IF EXISTS facility_reservations_feature_enabled_select ON public.facility_reservations;
CREATE POLICY facility_reservations_feature_enabled_select ON public.facility_reservations
AS RESTRICTIVE FOR SELECT TO authenticated USING (
  public.is_superadmin() OR EXISTS (
    SELECT 1 FROM public.community_settings cs
    WHERE cs.community_id = facility_reservations.community_id AND cs.allow_reservations IS TRUE
  )
);
