# Runbook: Local Triage Pilot

This runbook outlines the manual, human-operated workflow for evaluating raw inbox material using a local model as a non-authoritative triage assistant.

## Core Rules & Constraints

> [!IMPORTANT]
> - **Zero Repo Access:** The local model does not edit the repository. It has no write paths, no daemon, and no automated loop.
> - **Zero Autopilot:** The local model does not promote or approve anything, and it must never write official Brain knowledge directly.
> - **No Auto-Promotion:** The model must not generate ready-to-run promotion CLI commands.
> - **Evidence Integrity:** A fabricated, hallucinatory, or inaccurate quote/evidence excerpt invalidates the entire suggestion.
> - **Mandatory Human Review:** Human operators must independently verify the raw input and model suggestion before utilizing the promotion script.

---

## Step-by-Step Triage Workflow

### Step 1: Generate Scoped Context Packs
First, the human operator generates the latest size-capped local context pack that contains role contracts and metadata to serve as guidelines for the local model.
```bash
npm run brain:export-packs
```
This generates the pack file under: `content/brain/exports/packs/local-MCB-0023.md`.

### Step 2: Manually Run the Local Model
The human operator executes the local model **manually outside the repository** (e.g. via local CLI, ollama, or standard chat UI), providing:
1. The contents of the generated local context pack (`content/brain/exports/packs/local-MCB-0023.md`).
2. The raw input text/log that needs triage.
3. The copyable template located in `content/brain/templates/triage-suggestion.md`.

Instruct the model to analyze the raw input and populate the template.

### Step 3: Save the Suggestion
Save the generated triage suggestion from the model output as a Markdown file, e.g. `suggestion.md` outside the repository or in a temp directory. Ensure the document starts with the mandatory banner:
```markdown
> **NOT OFFICIAL BRAIN KNOWLEDGE.** Machine-generated suggestion from a local model. Unverified. Requires human review before any promotion.
```

### Step 4: Capture the Suggestion in the Inbox
The human operator imports the suggestion markdown file into the Brain's Git-backed inbox registry using the existing capture tool:
```bash
npm run brain:capture -- --title "Triage suggestion: <item>" --source local --file ./suggestion.md --tag triage-suggestion --tag mcb-0023
```
This writes the suggestion file to `content/brain/inbox/` and updates `content/brain/registries/inbox.json`.

### Step 5: Perform Human Triage Review
The human operator manually reviews:
1. The original raw input.
2. The imported model suggestion document under `content/brain/inbox/`.
3. Checks the review checklist at the bottom of the suggestion file.

### Step 6: Promote (If Appropriate)
If the suggestion is accurate and verified by the human, promote the knowledge using the existing promotion workflow:
```bash
node scripts/brain-promote.mjs --inbox-id INB-#### --target decisions --id DEC-#### --title "..." --summary "..." --tags "..." --yes
```
If the item is noise, update its status to `archived` or run appropriate commands.
