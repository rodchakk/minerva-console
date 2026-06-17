# 04 — Workflow

Brain v0 is read in the app and written in Git. No content is created or edited through the UI.

## Authoring loop

1. Open a branch in `rodchakk/minerva-console`.
2. Add or edit files under `content/brain/**`.
3. If you add a new entry to any registry, also append it to the matching JSON in `content/brain/registries/`.
4. Open a PR. Review is the human approval gate.
5. Merge. The next deploy publishes the change in the Brain UI.

## Mission ledger loop - Git-backed project control

Brain missions are tracked in `content/brain/registries/missions.json` with one Markdown file per mission under `content/brain/missions/`. This is project control metadata stored in Git. It is not an agent engine, not automation, and not a UI write path.

The loop is:

1. Mission planned in the registry with `status: "planned"` and a Markdown mission doc.
2. Branch created for the mission.
3. Agent or human executes the mission on that branch.
4. PR opened and checks run.
5. PR merges.
6. Mission status is updated to `completed`, with branch, PR, and commit recorded when visible.
7. The next mission is planned.

Prefer the local helper when creating a new mission:

```bash
npm run brain:new-mission -- --id MCB-0008 --title "Brain Relationship Map" --summary "Add relation views for Brain knowledge." --agent codex --phase planning --tags "brain,missions,planning"
```

## Inbox loop — raw AI output to approved knowledge

Raw outputs from Claude Code, GPT, Codex, Gemini, or humans never become Brain knowledge directly. They pass through an inbox-and-promote process.

1. **Capture.** Prefer the Git-backed CLI so the Markdown item and registry entry are created together:

   ```bash
   npm run brain:capture -- --title "Raw model output" --source codex --file ./raw-output.md --tag mcb-0004
   ```

   The command writes a Markdown file in `content/brain/inbox/` and appends a matching entry to `content/brain/registries/inbox.json` with `status: "inbox"` and a clear `source`. Manual capture is still allowed: copy `content/brain/inbox/TEMPLATE_inbox_item.md`, then add the registry entry by hand.
2. **Triage.** A human reads the inbox item. Most of it is noise; that is expected.
3. **Promote.** Use the promotion CLI to create an approved entry in the target registry and generate a Markdown document:

   ```bash
   npm run brain:promote -- \
     --inbox-id INB-0001 \
     --target decisions \
     --id DEC-0005 \
     --title "Brain remains Git-backed in v0" \
     --summary "Decision approved from inbox review." \
     --tags "brain,architecture,v0" \
     --yes
   ```

   Supported targets: `decisions`, `prompts`, `projects`, `agents`.

   The command:
   - Creates a Markdown file in `content/brain/<target>/<id-slug>.md` with the original raw material preserved.
   - Appends an entry to `content/brain/registries/<target>.json` with `status: "approved"`.
   - Updates the inbox item in `content/brain/registries/inbox.json` to `status: "promoted"` and links the promoted id in `related`.
   - Does **not** delete the original inbox Markdown file.

   Manual promotion is still allowed: create the target artifact and registry entry by hand, then update the inbox item status.

   Promotion does not mean the final wording is perfect. After promotion, the human should review and refine the "Approved Knowledge" section. The raw inbox material is preserved in the promoted document for reference.

   This is not RAG, not automation, not an agent engine. The human intentionally runs the script.

4. **Archive or discard.** Move the inbox item to `status: "promoted"` or `"archived"`. A raw inbox item is never authoritative knowledge.

## Mission handoff

When a mission finishes, copy `content/brain/templates/mission-handoff.md` into the relevant handoff location or paste it into the PR description. The handoff records changed files, registry updates, validation, respected boundaries, and the next suggested mission. The harness version in `10_HANDOFF_TEMPLATE.md` is the canonical checklist; the reusable template exists so handoffs do not need to be rebuilt from memory.

## Relations

Brain entries can reference each other through their `related` arrays. The relations layer makes those links functional and visible.

- **Outgoing relations are explicit.** They are the IDs listed in an entry's `related` array.
- **Incoming backlinks are derived automatically.** Any entry that lists this entry's ID in its `related` array becomes an incoming backlink.
- **Broken relations should be fixed before merge.** A relation is broken when a `related` ID does not exist in any registry.

Relations are surfaced in three places:

- `/brain/relations` lists every connected entry with outgoing and incoming counts, plus a broken-relation banner. Focus a single entry with `/brain/relations?focus=MCB-0006`.
- Every detail page (`/brain/{kind}/{id}`) shows a Relations section with outgoing references, incoming backlinks, and broken references.
- `npm run brain:check-relations` reports broken references from the command line and exits non-zero if any exist. The same check runs inside `brain:guardrails`.

IDs are not globally unique across kinds (for example `MCB-0001` is both a prompt and a mission), so a relation ID resolves to every entry that shares it.

Relations are Git-backed metadata derived from registry `related` arrays. This is not RAG, not embeddings, and not an agent engine.

## Search

Brain has a local search page at `/brain/search` that indexes all registry entries and their linked Markdown documents. Search is Git-backed and read-only — no database, no RAG, no embeddings. It supports:

- Free-text query across title, summary, id, tags, kind, source, path, and document content.
- Filters by kind, tag, and status via URL query params.
- A tag index at `/brain/tags` lists all tags with counts and links to filtered search results.
- Missions are included automatically in search and can be filtered with `kind=missions`.

Tags help human triage and future promotion of inbox items. They are not semantic vectors — they are manually assigned labels.

## Conventions

- IDs use prefixes: `PRJ-` projects, `DEC-` decisions, `MCB-` missions/prompts, `AGT-` agents, `INB-` inbox.
- `created` and `updated` are ISO date strings.
- Long-form documents are referenced by registry entries through `path`.
- Tags use kebab-case.
