import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import fs from "node:fs";

const migrationPath =
  "supabase/migrations/20260818010000_entry_onb_009_recoverable_campaign_links.sql";
const actionsPath = "features/entry/communityRegistration/admin/actions.ts";
const queriesPath = "features/entry/communityRegistration/admin/queries.ts";
const cardPath =
  "features/entry/communityRegistration/admin/CommunityRegistrationCard.tsx";
const helperPath =
  "features/entry/communityRegistration/admin/campaignLinkEncryption.ts";
const reviewActionsPath = "features/entry/communityRegistration/review/actions.ts";
const correctionStatePath =
  "features/entry/communityRegistration/public/correctionAccessState.ts";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(name, ok) {
  if (!ok) {
    throw new Error(name);
  }
  console.log(`PASS ${name}`);
}

function functionBody(sql, functionName) {
  const pattern = new RegExp(
    `create or replace function public\\.${functionName}[\\s\\S]*?\\$function\\$;`,
    "i",
  );
  return sql.match(pattern)?.[0] ?? "";
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  return Buffer.from(padded, "base64");
}

function decodeKey(env) {
  const value = env?.trim() ?? "";
  if (!value) throw new Error("missing key");
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, "hex");
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value) || value.length % 4 === 1) {
    throw new Error("invalid key");
  }
  const key = decodeBase64Url(value.replace(/=+$/, ""));
  if (key.byteLength !== 32) throw new Error("invalid key length");
  return key;
}

const aad = Buffer.from("entry-cr-campaign-link:v1", "utf8");

function encryptForValidation(plaintext, env) {
  const key = decodeKey(env);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher
    .getAuthTag()
    .toString("base64url")}:${ciphertext.toString("base64url")}`;
}

function decryptForValidation(payload, env) {
  const [version, ivPart, tagPart, ciphertextPart, extra] = payload.split(":");
  if (version !== "v1" || !ivPart || !tagPart || !ciphertextPart || extra) {
    throw new Error("invalid payload");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    decodeKey(env),
    decodeBase64Url(ivPart),
    { authTagLength: 16 },
  );
  decipher.setAAD(aad);
  decipher.setAuthTag(decodeBase64Url(tagPart));
  return Buffer.concat([
    decipher.update(decodeBase64Url(ciphertextPart)),
    decipher.final(),
  ]).toString("utf8");
}

function hashToken(token) {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

const migration = read(migrationPath);
const actions = read(actionsPath);
const queries = read(queriesPath);
const card = read(cardPath);
const helper = read(helperPath);
const reviewActions = read(reviewActionsPath);
const correctionState = read(correctionStatePath);
const launchV2 = functionBody(migration, "launch_community_registration_campaign_v2");
const rotateV2 = functionBody(
  migration,
  "rotate_community_registration_campaign_access_v2",
);

const key = randomBytes(32).toString("base64url");
const plaintext = randomBytes(32).toString("base64url");
const encryptedA = encryptForValidation(plaintext, key);
const encryptedB = encryptForValidation(plaintext, key);

assert(
  "crypto encrypt/decrypt round trip",
  decryptForValidation(encryptedA, key) === plaintext,
);
assert(
  "crypto uses a random IV so repeated encryption differs",
  encryptedA !== encryptedB,
);
assert("crypto payload does not contain plaintext", !encryptedA.includes(plaintext));

let tamperFailed = false;
try {
  const tamperedParts = encryptedA.split(":");
  tamperedParts[2] =
    tamperedParts[2][0] === "A"
      ? `B${tamperedParts[2].slice(1)}`
      : `A${tamperedParts[2].slice(1)}`;
  decryptForValidation(tamperedParts.join(":"), key);
} catch {
  tamperFailed = true;
}
assert("crypto tampering fails closed", tamperFailed);

for (const candidate of ["", "short", randomBytes(31).toString("base64url")]) {
  let failed = false;
  try {
    encryptForValidation(plaintext, candidate);
  } catch {
    failed = true;
  }
  assert(`invalid key fails closed: ${candidate ? "bad length/format" : "missing"}`, failed);
}

const storedHash = hashToken(plaintext);
const recoveredHash = hashToken(decryptForValidation(encryptedA, key));
assert(
  "hash integrity check supports timing-safe comparison",
  timingSafeEqual(Buffer.from(storedHash), Buffer.from(recoveredHash)),
);

assert("forward-only ONB-009 migration exists", migration.length > 0);
assert(
  "encrypted payload column is nullable and scoped to campaign access only",
  /add column if not exists encrypted_token_payload text/.test(migration) &&
    /encrypted_token_payload is null[\s\S]*token_type = 'campaign_access'/.test(
      migration,
    ) &&
    /campaign_unit_id is null[\s\S]*submission_id is null/.test(migration),
);
assert(
  "new-format launch writes hash and encrypted payload atomically",
  /insert into public\.community_registration_access_tokens \([\s\S]*token_hash,[\s\S]*encrypted_token_payload/.test(
    launchV2,
  ) &&
    /btrim\(p_campaign_token_hash\),[\s\S]*p_encrypted_token_payload/.test(
      launchV2,
    ) &&
    !/update public\.community_registration_access_tokens[\s\S]*encrypted_token_payload/i.test(
      launchV2,
    ),
);
assert(
  "replacement writes new encrypted payload while revoking previous active access",
  /set status = 'revoked'[\s\S]*revoked_at = now\(\)/.test(rotateV2) &&
    /insert into public\.community_registration_access_tokens \([\s\S]*token_hash,[\s\S]*encrypted_token_payload/.test(
      rotateV2,
    ) &&
    /v_active_count <> 1/.test(rotateV2),
);
assert(
  "legacy null encrypted payload remains supported",
  /encrypted_token_payload is null/.test(migration) &&
    /legacy_unrecoverable/.test(actions),
);
assert(
  "new v2 RPCs are service-role only and revoked from public roles",
  /_cr_service_role_only_v1\(\)/.test(launchV2) &&
    /_cr_service_role_only_v1\(\)/.test(rotateV2) &&
    /revoke all on function public\.launch_community_registration_campaign_v2[\s\S]*from public/.test(
      migration,
    ) &&
    /revoke all on function public\.launch_community_registration_campaign_v2[\s\S]*from anon/.test(
      migration,
    ) &&
    /revoke all on function public\.launch_community_registration_campaign_v2[\s\S]*from authenticated/.test(
      migration,
    ) &&
    /grant execute on function public\.launch_community_registration_campaign_v2[\s\S]*to service_role/.test(
      migration,
    ) &&
    /revoke all on function public\.rotate_community_registration_campaign_access_v2\(uuid, text, text, uuid\) from public/.test(
      migration,
    ) &&
    /revoke all on function public\.rotate_community_registration_campaign_access_v2\(uuid, text, text, uuid\) from authenticated/.test(
      migration,
    ) &&
    /grant execute on function public\.rotate_community_registration_campaign_access_v2\(uuid, text, text, uuid\) to service_role/.test(
      migration,
    ),
);

assert(
  "server-only helper uses AES-256-GCM with dedicated strict key",
  /import "server-only"/.test(helper) &&
    /ENTRY_CR_CAMPAIGN_LINK_ENCRYPTION_KEY/.test(helper) &&
    /createCipheriv\("aes-256-gcm"/.test(helper) &&
    /createDecipheriv\("aes-256-gcm"/.test(helper) &&
    /key\.byteLength !== 32/.test(helper) &&
    /randomBytes\(IV_BYTES\)/.test(helper) &&
    /timingSafeEqual/.test(helper),
);
assert(
  "launch and replacement encrypt before Supabase v2 RPC calls",
  actions.indexOf("encryptCampaignRegistrationToken(plaintextToken)") <
    actions.indexOf("launch_community_registration_campaign_v2") &&
    actions.lastIndexOf("encryptCampaignRegistrationToken(plaintextToken)") <
      actions.indexOf("rotate_community_registration_campaign_access_v2") &&
    /p_encrypted_token_payload: encryptedTokenPayload/.test(actions),
);
assert(
  "recover action is superadmin-gated and scoped to open community campaign",
  /export async function recoverCommunityRegistrationLink/.test(actions) &&
    /await requireSuperadmin\(\)/.test(actions) &&
    /\.eq\("id", campaignId\)/.test(actions) &&
    /\.eq\("community_id", communityId\)/.test(actions) &&
    /toLowerCase\(\) !== "open"/.test(actions),
);
assert(
  "recover action rejects invalid active access and validates decrypted hash",
  /\.eq\("token_type", "campaign_access"\)/.test(actions) &&
    /\.eq\("status", "active"\)/.test(actions) &&
    /tokenData\.length !== 1/.test(actions) &&
    /decryptCampaignRegistrationToken\(encryptedPayload\)/.test(actions) &&
    /hashRegistrationToken\(plaintextToken\)/.test(actions) &&
    /timingSafeHashEqual\(recoveredHash, storedHash\)/.test(actions),
);
assert(
  "open recoverable campaign exposes copy open replace controls",
  /Copy registration link/.test(card) &&
    /Open registration/.test(card) &&
    /Replace registration link/.test(card) &&
    /campaignOpen/.test(card) &&
    /ActiveRegistrationLinkControls/.test(card),
);
assert(
  "copy and open recover current URL without rotation",
    /recoverCommunityRegistrationLink/.test(card) &&
    /navigator\.clipboard\.writeText\(url\)/.test(card) &&
    /window\.open\("about:blank"/.test(card) &&
    /opened\.location\.href = result\.data\.registrationUrl/.test(card) &&
    !/copyCurrentLink[\s\S]*replaceCommunityRegistrationLink/.test(card) &&
    !/openCurrentLink[\s\S]*replaceCommunityRegistrationLink/.test(card),
);
assert(
  "legacy open campaign gives honest replace-to-upgrade state",
  /Current registration link cannot be recovered/.test(card) &&
    /Replace the\s+registration link once to enable future re-sharing/.test(card),
);
assert(
  "review or closed campaign does not expose sharing controls",
  /campaignOpen \? \([\s\S]*ActiveRegistrationLinkControls/.test(card) &&
    /Registration sharing is available only while the campaign is open/.test(card),
);
assert(
  "queries expose only recoverability boolean, not token material",
  /activeCampaignAccessRecoverable: boolean/.test(queries) &&
    /not\("encrypted_token_payload", "is", null\)/.test(queries) &&
    !/select\("[^"]*encrypted_token_payload/.test(queries) &&
    !/token_hash/.test(queries),
);
assert(
  "plaintext is not persisted or logged in ONB-009 app code",
  !/localStorage|sessionStorage|cookies\.set|console\.(log|info|warn|error|debug)/.test(
    `${actions}\n${card}\n${helper}`,
  ),
);
assert(
  "resident correction-link policy remains hash-only and untouched",
  !/encryptCampaignRegistrationToken|ENTRY_CR_CAMPAIGN_LINK_ENCRYPTION_KEY|encrypted_token_payload/.test(
    `${reviewActions}\n${correctionState}`,
  ) && /hashCorrectionToken\(plaintextToken\)/.test(reviewActions),
);
