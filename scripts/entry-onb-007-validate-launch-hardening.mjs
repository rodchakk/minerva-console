import fs from "node:fs";

const migrationPath =
  "supabase/migrations/20260817011000_create_entry_community_registration_launch_ui_hardening_v1.sql";
const actionPath = "features/entry/communityRegistration/admin/actions.ts";
const cardPath =
  "features/entry/communityRegistration/admin/CommunityRegistrationCard.tsx";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function functionBody(sql, functionName) {
  const pattern = new RegExp(
    `create or replace function public\\.${functionName}[\\s\\S]*?\\$function\\$;`,
    "i",
  );
  return sql.match(pattern)?.[0] ?? "";
}

function assert(name, ok) {
  if (!ok) {
    throw new Error(name);
  }
  console.log(`PASS ${name}`);
}

const migration = read(migrationPath);
const actions = read(actionPath);
const card = read(cardPath);
const launch = functionBody(migration, "launch_community_registration_campaign_v1");
const rotate = functionBody(
  migration,
  "rotate_community_registration_campaign_access_v1",
);

assert("forward-only ONB-007 hardening migration exists", migration.length > 0);

assert(
  "atomic launch RPC composes existing approved backend functions",
  /create_community_registration_campaign_v1\(/.test(launch) &&
    /add_community_registration_units_v1\(/.test(launch),
);

assert(
  "atomic launch does not catch and suppress partial failures",
  !/\bexception\b/i.test(launch),
);

assert(
  "atomic launch receives hash only and does not return token material",
  /p_campaign_token_hash text/.test(launch) &&
    !/plaintext|capability/i.test(launch) &&
    !/'campaign_token_id'|'token_hash'|'access_token_id'/.test(
      launch.match(/return jsonb_build_object\([\s\S]*?\);/i)?.[0] ?? "",
    ),
);

assert(
  "server action calls atomic launch RPC instead of two network mutations",
  /launch_community_registration_campaign_v1/.test(actions) &&
    !/create_community_registration_campaign_v1/.test(actions) &&
    !/add_community_registration_units_v1/.test(actions),
);

assert(
  "rotation RPC locks campaign before token mutation",
  /from public\.community_registration_campaigns[\s\S]*for update/i.test(rotate) &&
    rotate.indexOf("for update") < rotate.indexOf("update public.community_registration_access_tokens"),
);

assert(
  "rotation RPC permits campaign-access replacement only for open campaigns",
  /if v_campaign\.status <> 'open' then[\s\S]*ENTRY_CR_INVALID_STATE[\s\S]*P0409/.test(
    rotate,
  ) &&
    !/v_campaign\.status not in \('open', 'paused', 'review', 'confirmed'\)/.test(
      rotate,
    ),
);

assert(
  "rotation revokes active campaign access then inserts replacement in one RPC",
  /token_type = 'campaign_access'[\s\S]*status = 'active'/.test(rotate) &&
    /set status = 'revoked'[\s\S]*revoked_at = now\(\)/.test(rotate) &&
    /insert into public\.community_registration_access_tokens/.test(rotate) &&
    /'campaign_access'/.test(rotate) &&
    /v_active_count <> 1/.test(rotate),
);

assert(
  "rotation returns safe metadata only",
  !/'token_hash'|'replacement_token_id'|'access_token_id'/.test(
    rotate.match(/return jsonb_build_object\([\s\S]*?\);/i)?.[0] ?? "",
  ),
);

assert(
  "new RPCs are service-role only and revoked from public anon authenticated",
  /_cr_service_role_only_v1\(\)/.test(launch) &&
    /_cr_service_role_only_v1\(\)/.test(rotate) &&
    /revoke all on function public\.launch_community_registration_campaign_v1[\s\S]*from public/.test(
      migration,
    ) &&
    /revoke all on function public\.launch_community_registration_campaign_v1[\s\S]*from anon/.test(
      migration,
    ) &&
    /revoke all on function public\.launch_community_registration_campaign_v1[\s\S]*from authenticated/.test(
      migration,
    ) &&
    /revoke all on function public\.rotate_community_registration_campaign_access_v1\(uuid, text, uuid\) from public/.test(
      migration,
    ) &&
    /revoke all on function public\.rotate_community_registration_campaign_access_v1\(uuid, text, uuid\) from anon/.test(
      migration,
    ) &&
    /revoke all on function public\.rotate_community_registration_campaign_access_v1\(uuid, text, uuid\) from authenticated/.test(
      migration,
    ) &&
    /grant execute on function public\.launch_community_registration_campaign_v1[\s\S]*to service_role/.test(
      migration,
    ) &&
    /grant execute on function public\.rotate_community_registration_campaign_access_v1\(uuid, text, uuid\) to service_role/.test(
      migration,
    ),
);

assert(
  "replacement UI warns previous link is invalidated",
  /Replace registration link/.test(card) &&
    /invalidates the previous registration\s+link/.test(card) &&
    /replaceCommunityRegistrationLink/.test(actions),
);

assert(
  "replacement UI is exposed only for an open campaign",
  /canReplaceLink\s*=\s*campaign\?\.status\.trim\(\)\.toLowerCase\(\)\s*===\s*"open"/.test(
    card,
  ) &&
    /canReplaceLink && campaign \?/.test(card) &&
    !/\) : campaign \? \([\s\S]*Replace registration link/.test(card),
);

assert(
  "no plaintext token persistence or logging in admin launch/replacement code",
  !/localStorage|sessionStorage|cookies\.set|console\.(log|info|warn|error|debug)/.test(
    `${actions}\n${card}`,
  ),
);

assert(
  "case A successful launch returns safe operational metadata after unit attachment",
  /v_units_result := public\.add_community_registration_units_v1\(/.test(launch) &&
    /'inserted_unit_count'/.test(launch) &&
    /'status', v_campaign_result ->> 'status'/.test(launch),
);

assert(
  "case B unit validation failure rolls back the campaign transaction",
  /create_community_registration_campaign_v1\(/.test(launch) &&
    /add_community_registration_units_v1\(/.test(launch) &&
    !/\bexception\b/i.test(launch),
);

assert(
  "case C lost-response recovery is exposed only as replacement link action",
  /Replace registration link/.test(card) &&
    /canReplaceLink/.test(card) &&
    /replaceCommunityRegistrationLink/.test(actions) &&
    /rotate_community_registration_campaign_access_v1/.test(actions),
);

assert(
  "case D replacement success invalidates previous active campaign access",
  /set status = 'revoked'[\s\S]*insert into public\.community_registration_access_tokens/.test(
    rotate,
  ) && /'revoked_previous_count', v_revoked_count/.test(rotate),
);

assert(
  "case E replacement DB failure rolls back old-token revocation",
  /update public\.community_registration_access_tokens/.test(rotate) &&
    /insert into public\.community_registration_access_tokens/.test(rotate) &&
    !/\bexception\b/i.test(rotate),
);

assert(
  "case F unauthorized callers are blocked at action and RPC boundaries",
  /requireSuperadmin\(\)/.test(actions) &&
    /_cr_service_role_only_v1\(\)/.test(launch) &&
    /_cr_service_role_only_v1\(\)/.test(rotate),
);

assert(
  "case G cross-community unit validation stays delegated to approved backend",
  /add_community_registration_units_v1\(/.test(launch) &&
    !/insert into public\.community_registration_units/i.test(launch),
);

assert(
  "non-open operational statuses cannot reach successful replacement through UI/backend contract",
  /if v_campaign\.status <> 'open' then/.test(rotate) &&
    /ENTRY_CR_INVALID_STATE/.test(rotate) &&
    /canReplaceLink/.test(card) &&
    !/paused', 'review', 'confirmed/.test(rotate),
);
