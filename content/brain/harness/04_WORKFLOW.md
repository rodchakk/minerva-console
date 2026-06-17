# 04 — Workflow

Brain v0 is read in the app and written in Git. No content is created or edited through the UI.

## Authoring loop

1. Open a branch in `rodchakk/minerva-console`.
2. Add or edit files under `content/brain/**`.
3. If you add a new entry to any registry, also append it to the matching JSON in `content/brain/registries/`.
4. Open a PR. Review is the human approval gate.
5. Merge. The next deploy publishes the change in the Brain UI.

## Inbox loop — raw AI output to approved knowledge

Raw outputs from Claude Code, GPT, Codex, Gemini, or humans never become Brain knowledge directly. They pass through an inbox-and-promote process.

1. **Capture.** Save the raw output as a Markdown file in `content/brain/inbox/`, using `TEMPLATE_inbox_item.md` as the starting point. Add an entry in `content/brain/registries/inbox.json` with `status: "inbox"` and a clear `source`.
2. **Triage.** A human reads the inbox item. Most of it is noise; that is expected.
3. **Promote.** Distill the signal into the right typed artifact under `content/brain/{decisions,prompts,projects,agents,docs}/` and add a matching entry to the appropriate registry with `status: "approved"`. Fill in `tags` and `related` so the future graph view can use them.
4. **Archive or discard.** Move the inbox item to `status: "promoted"` or `"archived"`. A raw inbox item is never authoritative knowledge.

## Conventions

- IDs use prefixes: `PRJ-` projects, `DEC-` decisions, `MCB-` missions/prompts, `AGT-` agents, `INB-` inbox.
- `created` and `updated` are ISO date strings.
- Long-form documents are referenced by registry entries through `path`.
- Tags use kebab-case.
