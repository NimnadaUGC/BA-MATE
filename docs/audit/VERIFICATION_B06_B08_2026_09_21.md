# Verification — B06 to B08 — 2026-09-21

## B06 — faithful selected-revision exports

- The document studio now requires an explicit working-revision or locked-baseline choice before Markdown, DOCX, PDF or developer-handover export.
- A baseline export resolves content from that baseline’s immutable snapshot and manifest. It refuses an old baseline without a snapshot/manifest or a document that was not part of the baseline; it cannot silently substitute today’s document.
- Every export carries the selected revision, actual approval wording, revision manifest, linked records, acceptance criteria, business rules, trace references and unresolved clarifications/governance items.
- Markdown uses escaped YAML scalars and Mermaid code. DOCX/PDF render embedded Mermaid diagrams as images, retain structured-table rows, and paginate before a block/diagram is placed. The developer handover keeps recorded requirements, criteria, constraints, diagrams, changes and unresolved decisions but expressly does not invent technical architecture.
- frontend/src/exporters.test.ts verifies historic-baseline fidelity after newer working edits, draft handover wording, criteria/manifest preservation and rejection of an unmanifested baseline.

## B07 — safe, honest AI work

- Context is goal-scoped. An empty source selection now means no source, never all approved sources. A task includes a revision-pinned project brief, explicitly selected reviewed sources with passage locations, in-scope artifacts, answered decisions, risks and governance checks. Other-goal records are excluded.
- The evidence receipt discloses inclusion, omission and partial truncation. Confidential selected evidence marks the bundle local-only; the backend rejects cloud inference for it.
- The workbench has cancellation, preserves failed/cancelled runs as local metadata with unavailable usage values, and permits manual BA work after every failure. It stops late or stale responses from becoming pending proposals, and the project updater discards responses after project deletion.
- Selected AI adoption still validates task schema, supplied references, Mermaid syntax, revision fingerprint and pending state before changing a draft.

## B08 — local/BYOK profile qualification

- Settings has explicit in-memory credential removal, an opt-in synthetic all-task qualification run and local report/review workflow. It records profile/settings, framework/prompt version, platform memory, latency, usage/unavailable values, errors and correction counts.
- The measured support matrix is in MODEL_QUALIFICATION_MATRIX_2026_09_21.md. The installed local qwen2.5:3b passed every structured synthetic task. OpenRouter and Hugging Face remain honestly unqualified until a key-holder runs their live synthetic suite.
- A profile is not marked pilot-qualified merely because it connects or returns JSON. A BA must review every synthetic output, record corrections and explicitly approve the exact profile.

## Automated verification

Run from BA_MATE/frontend:

    npm test -- --run
    npm run build

Result: 45 frontend tests passed; production build passed (existing large-chunk warning only).

Run from BA_MATE/backend:

    .venv/bin/python -m unittest discover -s tests -q

Result: 24 backend tests passed.
