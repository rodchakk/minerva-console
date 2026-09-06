import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const unitActionsPath = "features/entry/field/FieldUnitActions.tsx";
const unitStatusPath = "features/entry/field/unitStatusActions.ts";
const destinationsPath = "features/entry/field/FieldDestinationsCard.tsx";
const communityPagePath = "app/(field)/field/entry/communities/[communityId]/page.tsx";

test("Field unit status reuses the canonical Console unit status boundary", () => {
  const action = read(unitStatusPath);
  const ui = read(unitActionsPath);

  assert.match(action, /setCommunityUnitActiveStatusAction/);
  assert.match(action, /revalidatePath/);
  assert.doesNotMatch(action, /\.from\("houses"\).*\.update/s);

  assert.match(ui, /Deactivate unit/);
  assert.match(ui, /Reactivate unit/);
  assert.match(ui, /setFieldUnitActiveStatus/);
  assert.match(ui, /Residents linked to this unit will be deactivated/);
  assert.match(ui, /Residents previously deactivated by this unit will be restored/);
  assert.match(ui, /isReadOnlyPreview/);
});

test("Field community overview shows configured destinations without adding management", () => {
  const card = read(destinationsPath);
  const page = read(communityPagePath);

  assert.match(page, /FieldDestinationsCard/);
  assert.match(page, /previews\.destinations/);
  assert.match(card, /Access destinations/);
  assert.match(card, /destination\.name/);
  assert.match(card, /destination\.isActive/);
  assert.match(card, /editing remains in Console/);
  assert.doesNotMatch(card, /createCommunityDestinationAction|renameCommunityDestinationAction|setCommunityDestinationActiveAction/);
});

test("Field explains that the token-free browser address is not the shareable registration link", () => {
  const page = read(communityPagePath);

  assert.match(page, /Field&apos;s Copy or Share action/);
  assert.match(page, /browser address shown after opening registration is intentionally token-free/);
  assert.match(page, /activeCampaignAccessRecoverable/);
});
