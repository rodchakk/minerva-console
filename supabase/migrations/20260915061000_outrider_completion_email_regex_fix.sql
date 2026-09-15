-- Preserve existing contact-completion semantics while keeping the unit-completion QA fix.
-- Use POSIX character classes to avoid backslash-escaping ambiguity in PostgreSQL regex strings.

create or replace function public._outrider_complete_sections_v2(
  p_unit_types text[],
  p_unit_type_other text,
  p_unit_naming_example text,
  p_has_destinations boolean,
  p_destinations text[],
  p_has_inactive_units boolean,
  p_inactive_units_notes text,
  p_security_staff_count integer,
  p_contact_name text,
  p_contact_phone text,
  p_contact_email text
)
returns text[]
language plpgsql
set search_path to ''
as $function$
declare
  v_sections text[] := '{}'::text[];
  v_email_present boolean := false;
  v_email_valid boolean := false;
begin
  if cardinality(coalesce(p_unit_types, '{}'::text[])) > 0
     and (
       'otro' <> all(coalesce(p_unit_types, '{}'::text[]))
       or nullif(btrim(coalesce(p_unit_type_other, '')), '') is not null
     ) then
    v_sections := array_append(v_sections, 'units');
  end if;

  if p_has_destinations = false
     or (p_has_destinations = true and cardinality(coalesce(p_destinations, '{}'::text[])) > 0) then
    v_sections := array_append(v_sections, 'destinations');
  end if;

  if p_has_inactive_units = false
     or (
       p_has_inactive_units = true
       and nullif(btrim(coalesce(p_inactive_units_notes, '')), '') is not null
     ) then
    v_sections := array_append(v_sections, 'inactive_units');
  end if;

  if p_security_staff_count is not null then
    v_sections := array_append(v_sections, 'available_information');
  end if;

  v_email_present := nullif(btrim(coalesce(p_contact_email, '')), '') is not null;
  v_email_valid :=
    v_email_present
    and p_contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$';

  if nullif(btrim(coalesce(p_contact_name, '')), '') is not null
     and (
       nullif(btrim(coalesce(p_contact_phone, '')), '') is not null
       or v_email_valid
     )
     and (not v_email_present or v_email_valid) then
    v_sections := array_append(v_sections, 'contact');
  end if;

  return v_sections;
end;
$function$;
