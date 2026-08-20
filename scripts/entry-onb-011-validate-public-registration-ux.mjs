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

function git(args) {
  return execFileSync("git", args, {
    cwd: new URL(".", ROOT),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const diffNames = [
  ...git(["diff", "--name-only"]).split(/\r?\n/),
  ...git(["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/),
].filter(Boolean);

const shell = read(
  "features/entry/communityRegistration/public/PublicRegistrationShell.tsx",
);
const page = read("app/(public)/entry/register/[slug]/page.tsx");
const correctionPage = read(
  "app/(public)/entry/register/[slug]/correct/page.tsx",
);
const unitRoute = read("app/(public)/entry/register/[slug]/unit/route.ts");
const unitForm = read(
  "features/entry/communityRegistration/public/UnitLookupForm.tsx",
);
const unitLabelPrefix = read(
  "features/entry/communityRegistration/public/unitLabelPrefix.ts",
);
const householdForm = read(
  "features/entry/communityRegistration/public/HouseholdDraftForm.tsx",
);
const submitRoute = read("app/(public)/entry/register/[slug]/submit/route.ts");
const correctionSubmitRoute = read(
  "app/(public)/entry/register/[slug]/correct/submit/route.ts",
);
const gateway = read("features/entry/communityRegistration/public/gateway.ts");
const successBlock =
  householdForm.match(/\{step === "success" \? \([\s\S]*?\) : step === "review"/)?.[0] ??
  "";

assert(
  "scope avoids protected console and migrations",
  diffNames.every(
    (name) =>
      !name.startsWith("app/(console)/") &&
      !name.startsWith("supabase/migrations/") &&
      !/mobile|react-native|expo|seshat|vercel/i.test(name),
  ),
);

assert(
  "public shell uses official centered logo and black header",
  /src="\/minerva-logo-transparent\.png"/.test(shell) &&
    /width=\{520\}/.test(shell) &&
    /height=\{260\}/.test(shell) &&
    /justify-center/.test(shell) &&
    /bg-\[#030305\]/.test(shell) &&
    /PublicRegistrationShell/.test(page) &&
    /PublicRegistrationShell/.test(correctionPage),
);

assert(
  "persistent three-step stepper exists",
  /Vivienda/.test(shell) &&
    /Residentes/.test(shell) &&
    /Revisi&oacute;n/.test(shell) &&
    /currentStep=\{1\}/.test(unitForm) &&
    /currentStep=\{currentStep\}/.test(householdForm),
);

assert(
  "vivienda lookup asks for suffix and keeps canonical returned unit label",
  /unitSuffix/.test(unitForm) &&
    /placeholder="Ej\. 1 o 5B"/.test(unitForm) &&
    /No escribas &quot;\{unitLabelPrefix\}&quot;/.test(unitForm) &&
    /unitLabel=\{state\.result\.unitLabel\}/.test(unitForm) &&
    !/const UNIT_PREFIX = "Casa"/.test(unitRoute) &&
    /resolveCommunityRegistrationUnitPrefix/.test(unitRoute) &&
    /buildUnitLookupCandidates/.test(unitRoute),
);

assert(
  "unit lookup prefix derives from configured community unit label",
  /unit_label/.test(unitLabelPrefix + gateway) &&
    /casas: "Casa"/.test(unitLabelPrefix) &&
    /villas: "Villa"/.test(unitLabelPrefix) &&
    /apartamentos: "Apartamento"/.test(unitLabelPrefix) &&
    /buildCommunityUnitLookupLabel/.test(unitRoute) &&
    /hasCommunityUnitPrefix/.test(unitRoute) &&
    !/community_registration_access_tokens/.test(gateway) &&
    /resolve_community_registration_campaign_v1/.test(gateway) &&
    /lookup_community_registration_unit_v1/.test(gateway) &&
    /if \(!unitLabelPrefix\)/.test(gateway + unitRoute),
);

assert(
  "resident capture is one-at-a-time with collapsed saved cards",
  /activeResidentId/.test(householdForm) &&
    /savedResidentIds/.test(householdForm) &&
    /ResidentSummaryCard/.test(householdForm) &&
    /Aún no has agregado residentes/.test(householdForm) &&
    /Guardar residente/.test(householdForm) &&
    /Agregar otro residente/.test(householdForm) &&
    /Continuar a revisión/.test(householdForm),
);

assert(
  "review and success states are polished and connected",
  /Revisar información/.test(householdForm) &&
    /Revisa la información antes de enviarla a la administración de tu residencial\./.test(
      householdForm,
    ) &&
    /Enviar registro/.test(householdForm) &&
    !/Continuar a envio/.test(householdForm) &&
    /Registro enviado/.test(householdForm) &&
    /isComplete=\{step === "success"\}/.test(householdForm) &&
    /Ya puedes cerrar esta página\./.test(successBlock) &&
    !/Finalizar/.test(successBlock) &&
    !/<button[\s\S]*Finalizar/.test(successBlock),
);

assert(
  "submission security flow remains route based",
  /hasSameOriginBoundary\(request\)/.test(submitRoute) &&
    /hasSameOriginBoundary\(request\)/.test(correctionSubmitRoute) &&
    /credentials: "same-origin"/.test(householdForm) &&
    (householdForm.match(/fetch\(/g) ?? []).length === 1 &&
    !/localStorage|sessionStorage|document\.cookie|console\.(log|info|warn|error|debug)/.test(
      householdForm + unitForm,
    ),
);

console.log("ENTRY-ONB-011 public registration UX validation passed.");
