-- ENTRY-ONB-008: Resolve pending correction review when a resident resubmits.
--
-- Runtime walkthrough found that resubmit_community_registration_household_v1
-- created the next submission version and consumed the edit capability, but left
-- the prior correction_requested review current/pending. That made the internal
-- review workspace continue to count/show an observation that had already been
-- acted on.
--
-- This forward-only fix keeps correction resolution in the same transaction as
-- the successful resubmission. It also repairs any already-stale current pending
-- correction review that has a newer submission version for the same unit.

create or replace function public.resubmit_community_registration_household_v1(
  p_edit_token_hash text,
  p_residents jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_token_hint record;
  v_campaign public.community_registration_campaigns%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_old_submission public.community_registration_submissions%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_effective_limit integer;
  v_validated jsonb;
  v_resident jsonb;
  v_new_submission_id uuid;
  v_new_version integer;
begin
  perform public._cr_service_role_only_v1();

  select id, campaign_id, campaign_unit_id, submission_id
    into v_token_hint
    from public.community_registration_access_tokens
   where token_hash = btrim(coalesce(p_edit_token_hash, ''))
     and token_type = 'resident_edit';

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TOKEN', '42501');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_token_hint.campaign_id
   for update;

  select * into v_unit
    from public.community_registration_units
   where id = v_token_hint.campaign_unit_id
     and campaign_id = v_token_hint.campaign_id
   for update;

  select * into v_old_submission
    from public.community_registration_submissions
   where id = v_token_hint.submission_id
     and campaign_unit_id = v_token_hint.campaign_unit_id
     and campaign_id = v_token_hint.campaign_id
   for update;

  select * into v_token
    from public.community_registration_access_tokens
   where id = v_token_hint.id
   for update;

  if not found
     or v_token.status <> 'active'
     or v_token.expires_at is null
     or v_token.expires_at <= now()
     or v_token.revoked_at is not null
     or v_token.consumed_at is not null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TOKEN', '42501');
  end if;

  if v_campaign.status not in ('open', 'review')
     or (v_campaign.opens_at is not null and v_campaign.opens_at > now())
     or (v_campaign.closes_at is not null and v_campaign.closes_at <= now())
     or v_unit.status <> 'edit_enabled'
     or v_old_submission.status <> 'edit_enabled' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  v_effective_limit := coalesce(v_unit.resident_limit_override, v_campaign.default_resident_limit);
  v_validated := public._cr_validate_residents_v1(p_residents, v_effective_limit);

  select coalesce(max(version_number), 0) + 1
    into v_new_version
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id;

  update public.community_registration_submissions
     set status = 'superseded'
   where id = v_old_submission.id;

  insert into public.community_registration_submissions (
    campaign_unit_id,
    campaign_id,
    community_id,
    house_id,
    version_number,
    status,
    submitted_at,
    locked_at,
    previous_submission_id
  )
  values (
    v_unit.id,
    v_campaign.id,
    v_campaign.community_id,
    v_unit.house_id,
    v_new_version,
    'submitted',
    now(),
    now(),
    v_old_submission.id
  )
  returning id into v_new_submission_id;

  for v_resident in
    select value from jsonb_array_elements(v_validated->'residents')
  loop
    insert into public.community_registration_residents (
      submission_id,
      campaign_id,
      community_id,
      campaign_unit_id,
      house_id,
      position,
      full_name,
      email,
      phone,
      normalized_full_name,
      normalized_email,
      normalized_phone,
      relationship_to_house,
      is_owner_reference,
      validation_status
    )
    values (
      v_new_submission_id,
      v_campaign.id,
      v_campaign.community_id,
      v_unit.id,
      v_unit.house_id,
      (v_resident->>'position')::integer,
      v_resident->>'full_name',
      v_resident->>'email',
      v_resident->>'phone',
      v_resident->>'normalized_full_name',
      v_resident->>'normalized_email',
      v_resident->>'normalized_phone',
      v_resident->>'relationship_to_house',
      (v_resident->>'is_owner_reference')::boolean,
      'valid'
    );
  end loop;

  -- The resident has now acted on the current correction request. Close that
  -- observation inside the same transaction before returning the unit to the
  -- internal review queue. Any later failure rolls this resolution back too.
  perform public._cr_replace_current_review_v1(v_unit.id);

  update public.community_registration_access_tokens
     set status = 'consumed',
         consumed_at = now()
   where id = v_token.id;

  update public.community_registration_units
     set status = 'submitted',
         last_submitted_at = now(),
         reviewed_at = null,
         reviewed_by = null,
         patronato_confirmed_at = null,
         patronato_confirmed_by = null
   where id = v_unit.id;

  insert into public.community_registration_events (
    campaign_id,
    campaign_unit_id,
    submission_id,
    event_type,
    actor_type,
    access_token_id,
    metadata
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_new_submission_id,
    'household_resubmitted',
    'resident_token',
    v_token.id,
    jsonb_build_object(
      'resident_count', (v_validated->>'resident_count')::integer,
      'previous_submission_id', v_old_submission.id,
      'previous_version', v_old_submission.version_number,
      'version', v_new_version,
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'submitted'
    )
  );

  return jsonb_build_object(
    'accepted', true,
    'receipt', jsonb_build_object(
      'version', v_new_version,
      'unit_label', v_unit.unit_label_snapshot,
      'resident_count', (v_validated->>'resident_count')::integer,
      'submitted_at', now()
    )
  );
end;
$function$;

revoke all on function public.resubmit_community_registration_household_v1(text, jsonb) from public;
revoke all on function public.resubmit_community_registration_household_v1(text, jsonb) from anon;
revoke all on function public.resubmit_community_registration_household_v1(text, jsonb) from authenticated;
grant execute on function public.resubmit_community_registration_household_v1(text, jsonb) to service_role;

-- One-time reconciliation for rows produced by the pre-fix behavior. A pending
-- correction is stale when a newer submission version already exists for the
-- same campaign unit. No IDs or environment-specific values are hardcoded.
update public.community_registration_reviews review
   set is_current = false,
       resolution_status = 'resolved',
       replaced_at = coalesce(review.replaced_at, now()),
       resolved_at = coalesce(review.resolved_at, now())
 where review.decision = 'correction_requested'
   and review.is_current
   and review.resolution_status = 'pending'
   and exists (
     select 1
       from public.community_registration_submissions reviewed_submission
       join public.community_registration_submissions newer_submission
         on newer_submission.campaign_unit_id = reviewed_submission.campaign_unit_id
        and newer_submission.campaign_id = reviewed_submission.campaign_id
        and newer_submission.version_number > reviewed_submission.version_number
      where reviewed_submission.id = review.submission_id
        and reviewed_submission.campaign_unit_id = review.campaign_unit_id
        and reviewed_submission.campaign_id = review.campaign_id
   );
