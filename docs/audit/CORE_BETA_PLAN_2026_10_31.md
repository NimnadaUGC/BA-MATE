# Core beta completion — 31 October 2026

Target: a focused BA-MATE v1.0.0 beta candidate alongside BA-MATE-SKILL v1.0.5 and F4-draft.1 v1.0.0. This record describes application engineering checks, not research outcomes or proof of usability.

## Scope and acceptance

1. **Chat continuity and safe AI execution:** keep the assistant draft/context/history per project across closing and navigation; expose progress, Stop and retry; cancel on unmount/project change; ignore late responses; retain newer drafts. Saved project conversations continue to use explicit human review for proposed changes.
2. **Context mentions:** shared, keyboard-operable suggestions in both composers, matching IDs and names at the caret, Escape dismissal, no send while selecting a mention, proper labels and exact artifact navigation. Attached context remains visible and removable.
3. **Selection and status:** count all selected and hidden items; select/deselect visible items; submit selected drafts and return selected reviews to draft with clear eligibility. Keep approval individual and guarded. Put status actions within reach of the editor and keep controls readable at narrow widths.
4. **Assistant access and layout:** visible named assistant entry; direct full-conversation entry; consistent composer typography, spacing, scroll and wrapping at desktop and narrow sizes. Preserve the existing sidebar and research workflow.
5. **Verification:** frontend typecheck, meaningful race/selection/keyboard regression tests, production build, backend suite, isolated synthetic browser walkthrough and an authentication check with the supplied provider credential. Report actual provider failures without treating mocked tests as model qualification.

## Boundaries

No framework or skill redesign, diagram/export expansion, hosting, automatic approvals, participant-data collection, dependency upgrades, or claims of cross-platform release qualification. Do not modify existing analyst decisions or project files during manual tests. Preserve the pre-existing working tree. Credentials must not enter files, logs, screenshots, commits or reports.

## Beta decision

Record implemented changes and verified evidence below. Remaining distribution/model/pilot checks must be distinguished from fixes completed in this pass.

## Completed in this pass

- Shared caret-aware context mentions in both chat composers: search by name or ID, arrow navigation, Enter/Tab attachment, Escape dismissal, IME-safe sending, and preservation of text after the caret. Enter does not send while choosing a mention. Completed mentions do not reopen when returning to a draft.
- Project assistant sessions retain their draft, attachments, completed answers and errors across closing and in-app navigation. Project-scoped context cannot carry over when switching projects. A browser leave warning covers temporary assistant drafts. Temporary assistant sessions do **not** survive a reload or appear in project backups; saved conversations remain the durable chat path.
- Both chats expose Stop, retain newer text during delayed responses, reject missing attachments, and cancel pending work on unmount/conversation changes. Late responses cannot append after cancellation. Failed saved-conversation requests show the actual error and an explicit restore-message action without inserting a fabricated AI answer into conversation history.
- Assistant links open the exact referenced artifact. Navigating from the overlay closes it; a pinned assistant stays available. A visible Ask BA Mate button and an Open saved conversations action make both entry points easier to find. Demo-specific prompts for nonexistent CR-01/privacy findings were replaced with applicable project prompts.
- Chat uses the available window height so the thread scrolls while the composer stays visible. Narrow workspaces use a compact conversation selector. Names, context chips, actions and errors wrap, and both chats use consistent composer typography and keyboard hints.
- Selection exposes draft/review/approved counts and hidden selections across searches and tabs. Deselect shown preserves other selections. Bulk submit affects selected drafts; bulk return affects selected reviews. Both recheck eligibility against current state, retain content revisions and audit actual changes. Approval remains individual and guarded. The editor exposes expandable approval blockers beside its actions.
- Project AI processing is available in Project settings and linked from both chats, using the same control as Task AI. Confidential sources prevent external processing. Derived requirements, stories, diagrams, documents and changes inherit confidentiality through recorded dependencies. Attached change requests now contribute their actual rationale, impacts and patches to AI context. Request-context disclosures identify included, partial and omitted items, including implicit context.
- Version labels now identify **1.0.0-beta.1** and **F4-draft.1 (v1.0.0)**. Desktop readiness checks use the desktop package's version. New evaluation runs capture the framework version; historical runs keep their earlier version. The skill and framework documents themselves were not changed. The in-app Beta guide explains the new chat, selection and permission controls.

## Verification evidence

| Check | Result |
|---|---|
| Baseline frontend suite | 236 tests passed before this pass |
| Final frontend suite | **253 tests across 47 files passed** |
| TypeScript | `tsc --noEmit` passed |
| Production frontend | `npm run build` passed; existing dependency `use client` bundler notices remain |
| Backend | **69 tests passed**, including cancellation, concurrency, persistence and provider boundaries |
| Desktop | Entry syntax passed. Fresh unsigned mac-arm64 preview built; its frozen service and bundled frontend loaded, with matching app/service version 1.0.0-beta.1. Native Electron window and clean-device installation remain untested. |
| Working-tree whitespace | `git diff --check` passed |
| Live OpenRouter smoke | All eight tasks passed response/schema/reference validation using the supplied replacement credential and `google/gemini-2.5-flash-lite` |
| Save/restart | Final version labels verified; source, requirement, story and AI-run counts retained; the original source hash still matched; the session credential was cleared on service restart |

Component regression coverage added for caret replacement, mention selection versus sending, IME and Escape, assistant reopen/project isolation, stopping during source checks, abort/late output on unmount and conversation changes, saved-chat history, failure with a newer draft, cross-tab bulk eligibility, confidential processing permission, derived-context sensitivity and historical framework-version preservation.

Live browser checks used a **fresh isolated service on port 8011** and a fictional checkout project. No existing APNK or other analyst project was changed. Verified:

1. New project and first goal; source import, extracted-text review and explicit goal selection; Setup checklist completion and advancement to Discover.
2. Real Task AI generation; select all then deselect the duplicate requirement; adopt only the story as a draft. The original requirement count remained one.
3. Cross-tab requirement/story selection; submit both to review, preserving individual approval checks. An approval attempt without a verified evidence path was blocked with the actual reason.
4. Real chat answer preserved the total 100 / cash 80 / remaining 20 rule; a follow-up recalled the answer. A contextual assistant request used the automatically attached story. Stop retained its draft and did not append a late answer; this timing does not prove whether the external provider had already started inference.
5. Assistant close/reopen retained an unsent mention and its attachment; keyboard Enter attached a name-matched requirement without sending.
6. Chat layout at 1280×720, 900×700 and 500×700. At the latter two widths, measured composer bottoms were 607px and 615px respectively, inside the window. This is a focused responsive/keyboard check, not full screen-reader certification.

Evidence: [final desktop chat](evidence/2026-10-31/chat-desktop-final.jpg), [bulk review](evidence/2026-10-31/artifact-bulk-review.jpg), [500px chat](evidence/2026-10-31/chat-500x700.jpg), [900px chat](evidence/2026-10-31/chat-900x700.jpg), [model matrix](evidence/2026-10-31/model-smoke-summary.json), [restart checks](evidence/2026-10-31/restart-check.json). Routine logs and synthetic raw model responses remain under ignored `tmp/beta-2026-10-31*`.

## Limits and circulation handoff

This is a **beta candidate for a small supervised rehearsal**. Start the updated source with `python3 start.py` from BA-MATE; the frontend build has been refreshed. A new unsigned Apple Silicon Mac preview is at `release/core-beta-1.0.0-beta.1-20261031/mac-arm64/BA Mate.app`. Its frozen service, bundled frontend and version agreement were checked in an isolated workspace; the native Electron window was not launched. Older release directories predate this pass. Clean-device Mac installation and Windows builds remain distribution checks.

The matrix demonstrates one model/profile on one synthetic case, not correctness across cases or qualification of every supported provider. The clarification response missed the most consequential unspecified tax/returns questions, and some validation/impact findings were speculative. Analysts must compare proposals with the evidence and reject weak or duplicate suggestions. Raw response snapshots retain the runtime's earlier version labels because the matrix ran before final label alignment; the subsequent restart check verifies the final candidate labels. This pass did not change the inference adapter.

Before widening circulation, run a short analyst rehearsal using the released interface and the actual target-device build. This pass did not repeat full baseline/change/revalidation journeys, export fidelity checks, Windows installation, research-service staging or a comprehensive accessibility audit. Those historical checks are not silently upgraded to new evidence. No public deployment, participant recruitment or research upload was performed.

During the deliberate service interruption, the already-open browser entered Saving paused; its next reload was stopped by the unsaved-work safeguard. A fresh browser session reopened the saved source, artifacts and conversation successfully. This verifies preserved persisted work and recovery visibility, not seamless replay of an interrupted save. Never discard a real paused window before exporting its recovery copy. The test window contained only disposable synthetic work; saved record counts and source hashes were compared before it was closed. The fresh session displayed Saved on this device and the saved conversation.

Final packaging evidence: [Mac package smoke record](evidence/2026-10-31/mac-package-smoke.json). The package was built once after the core fixes. No icon redesign, installer customization, export/diagram expansion or dependency-version upgrade was added.
