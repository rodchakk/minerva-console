import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);

function read(path) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

function assert(name, condition) {
  if (!condition) {
    throw new Error(name);
  }
  console.log(`PASS ${name}`);
}

const backendSql = read(
  "supabase/migrations/20260806233000_create_entry_community_registration_backend_v1.sql",
);
const progressiveSql = read(
  "supabase/migrations/20260820192138_entry_onb_012_progressive_unit_activation_handoff.sql",
);
const runtimeHotfixSql = read(
  "supabase/migrations/20260821070500_entry_onb_012_fix_uuid_conversion_classifier.sql",
);
const actions = read("features/entry/communityRegistration/review/actions.ts");

const classifierPattern =
  /create or replace function public\._cr_classify_unit_conversion_v1[\s\S]*?\$function\$;/;
const progressiveClassifier = progressiveSql.match(classifierPattern)?.[0] ?? "";
const hotfixClassifier = runtimeHotfixSql.match(classifierPattern)?.[0] ?? "";
const conversionFunction =
  progressiveSql.match(
    /create or replace function public\.convert_community_registration_unit_to_activation_v1[\s\S]*?\$function\$;/,
  )?.[0] ?? "";

const uuidAggregatePattern = /\b(min|max)\s*\(\s*(?:q\.)?id\s*\)/i;

assert(
  "runtime hotfix includes exactly the classifier replacement",
  hotfixClassifier.length > 0 &&
    runtimeHotfixSql.trim().endsWith(hotfixClassifier.trim()) &&
    !/record_community_registration_unit_external_approval_v1|convert_community_registration_unit_to_activation_v1/.test(
      runtimeHotfixSql,
    ),
);

assert(
  "classifier prohibits UUID aggregate candidate selection",
  !uuidAggregatePattern.test(progressiveClassifier) &&
    !uuidAggregatePattern.test(hotfixClassifier) &&
    !/\b(min|max)\s*\(\s*q\.id\s*\)/i.test(progressiveSql),
);

assert(
  "classifier uses the established UUID-safe matching queue pattern",
  /with matching_queue as/.test(progressiveClassifier) &&
    /queue_count as/.test(progressiveClassifier) &&
    /queue_candidate as/.test(progressiveClassifier) &&
    /select queue_count\.value,\s*queue_candidate\.id,\s*queue_candidate\.status/.test(
      progressiveClassifier,
    ) &&
    /from queue_count\s+left join queue_candidate on true/.test(
      progressiveClassifier,
    ) &&
    hotfixClassifier.includes("with matching_queue as") &&
    hotfixClassifier.includes("queue_candidate as"),
);

assert(
  "Condominio 101 confirmed can classify under progressive campaign status",
  /v_campaign\.status not in \('open', 'review', 'confirmed'\)/.test(
    progressiveClassifier,
  ) &&
    /v_unit\.status not in \('confirmed', 'processed'\)/.test(
      progressiveClassifier,
    ) &&
    /v_submission\.status <> 'confirmed'/.test(progressiveClassifier) &&
    /v_submission\.patronato_confirmed_at is null/.test(progressiveClassifier),
);

assert(
  "conversion creates or reuses Activation Queue rows and processes unit",
  /insert into public\.resident_activation_queue/.test(conversionFunction) &&
    /community_registration_resident_id = v_resident\.id/.test(conversionFunction) &&
    /set status = 'converted'/.test(conversionFunction) &&
    /set status = 'processed'/.test(conversionFunction),
);

assert(
  "conversion preserves campaign open and supports idempotent retry",
  /v_campaign\.status not in \('open', 'review', 'confirmed'\)/.test(
    conversionFunction,
  ) &&
    /if v_unit\.status = 'processed'[\s\S]*already_complete/.test(
      conversionFunction,
    ) &&
    !/update\s+public\.community_registration_campaigns/i.test(conversionFunction),
);

assert(
  "102 and 103 can still register while campaign is open",
  /resolve_community_registration_campaign_v1[\s\S]*v_campaign\.status <> 'open'/.test(
    backendSql,
  ) &&
    /lookup_community_registration_unit_v1[\s\S]*and c\.status = 'open'/.test(
      backendSql,
    ) &&
    /submit_community_registration_household_v1[\s\S]*v_campaign\.status <> 'open'/.test(
      backendSql,
    ),
);

assert(
  "conversion errors expose bounded diagnostics only",
  /ENTRY_ONB_012_CONVERSION_RPC_FAILED/.test(actions) &&
    /console\.error\(diagnosticCode/.test(actions) &&
    !/conversion\.error\.message/.test(actions),
);

execFileSync("git", ["diff", "--check"], {
  cwd: new URL(".", ROOT),
  stdio: "ignore",
});

console.log("ENTRY-ONB-012 runtime hotfix validation passed.");
