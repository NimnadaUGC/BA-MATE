# BA Mate token management and functional audit

Date: 29 October 2026, Asia/Colombo. Scope: implement token management only; examine current source, saved APNK POS test project, live AI, UI routes, framework conformance and export/recovery behaviour. Existing unrelated repository changes were preserved. No permission redesign, retrieval system, public deployment or empirical research result is claimed.

## Evidence and baseline

- The initial current-source suites passed 49 backend tests and 71 frontend tests. Older dated audits are historical, not current proof.
- The user-authorised APNK POS project (project-1793239900575) contains one reviewed, goal-selected four-page PDF named Business Requirements Document (BRD).pdf. The managed original exists and its SHA-256 matches the reviewed source and the goal revision pin. Its extracted content has 4,942 characters and four passages. The separate APNK Mini POS project has artifacts but no source documents; it is not the same project.
- The uploaded PDF is a short POS product BRD, not the longer DOCX in the separate APNK Mini POS scenario pack. It covers two roles, product lookup, checkout, cash/card/split payments, stock deduction, receipts and EOD reports. Its stock threshold is explicitly an example, not a confirmed value. POS checkout scenarios in it are requirements for the product being analysed; BA Mate itself is not a POS implementation.
- A private pre-audit workspace snapshot is retained under ignored tmp/audit-2026-10-29. No credentials were written into it. Non-APNK projects are compared against that snapshot after testing.

## Implemented token changes

See ../TOKEN_MANAGEMENT.md. OpenRouter model discovery now exposes full published context and output limits, with automatic full-context or manual budgeting. The prototype 65,536/8,192 caps are removed. The shared provider boundary guards estimated input plus output reservation. Reference-tokenizer estimates include schema and JSON escaping, with explicitly labelled fallbacks, margin and actual successful-provider usage. Silent last-20-history-message trimming and fixed request item-count ceilings are removed. Token/data receipts are visible in workbench/chat/inspector. This does not add semantic retrieval, source batching, financial caps, new cloud providers or a new processing-permission policy.

The live selected profile advertises 1,000,000 context and 131,072 completion tokens. The test allowance is 32,768 output tokens. An end-marker capacity probe sent four synthetic sources totalling 626,508 characters; OpenRouter reported 223,756 input tokens, 83 output tokens and cost 0, with no reference omitted/partial. The correct end marker returned. The app estimated 215,658 input tokens: this is direct evidence that counting remains approximate. The full one-million-token window was discovered, not exhaustively stress-tested. Evidence: evidence/2026-10-29/long-context-live.json.

## Framework conformance findings

| Mechanism | Current evidence | Assessment |
|---|---|---|
| M1 Evidence selection and revisions | Reviewed sources, active-goal selection and receipts exist; runtime budget now expanded. A diagnostic changed a source hash while retaining the old goal pin and the request builder still included it; Setup readiness also accepted it. | Partial; enforce pin checks at every request boundary. |
| M2 Clarification | Live clarification identified genuine missing decisions and distinguished the BRD's example threshold. Human adoption creates unanswered questions. Unanswered governance-linked questions were omitted from subsequent context; the first of multiple evidence IDs is all that a clarification retains. | Partial; preserve all evidence links and relevant open questions. |
| M3 Bounded proposals | Schemas, invalid-reference rejection, Mermaid parsing, stale-proposal checks and error paths are implemented and tested. Five task types succeeded live; an initial impact run exhausted 32,768 output tokens after 285.5 seconds. | Useful but model-profile qualification remains necessary; increasing output alone is not a reliability guarantee. |
| M4 Human review and adoption | Live UI selection/edit/adoption preserved original and corrected proposals separately and created only drafts/Pending traces. | Core behaviour verified; requirement/story relationships still need manual linking. |
| M5 Quality and semantic support | Live quality review identified undefined exception behaviour. Blockers prevent approval. A diagnostic placeholder criterion 'TBD' plus a manually marked Verified path produced no artifact approval issue. | Structural checks support human review; they do not prove semantic support or testability. |
| M6 Approval and revision | Domain probes invalidated dependent working documents/requirements and Pending traces while leaving historical snapshot content unchanged. Snapshot recovery retained a prior working copy and restored drafts. | Core state behaviour verified; local roles are not authenticated stakeholder signatures. |
| M7 Faithful outputs | Historical Markdown probe used the selected snapshot rather than newer working text. UI and export checks are recorded below. | Assess each actual export format; do not infer visual fidelity from a download succeeding. |

## Priority recommendations outside this implementation

1. Enforce selected source revision pins in projectEvidence, readiness and the backend's inference boundary. Re-reviewing a changed original must not silently make it selected for an old goal.
2. Preserve multi-source provenance and include unresolved governance/brief questions consistently. Detect repeated clarification proposals rather than creating duplicate questions.
3. Qualify the full live task profile and improve failures: token exhaustion is currently categorized as unknown; failed-run records discard actual model/usage details. Add bounded total-duration control and clearer progress/cost/cancel behaviour.
4. Make AI-derived assumptions and uncertain diagram branches explicit before adoption. A valid citation ID or Mermaid program is not proof of a correct business rule. Add requirement/story relationships when generated together.
5. Consolidate repeated cloud-processing controls as discussed; keep this separate from current token scope. Automatic unreviewed-folder roles currently return local_model_required when OpenRouter is selected.
6. Review export layout and source-revision receipts, then complete real new/existing/change journeys before public release.
7. Reconcile runtime/research versions: runtime and package identify 0.4.0 / ba-framework-0.4.0 while the method documents identify F4-draft.1 and the researcher targets application 1.0.0. Historical backlog statements conflict with later implemented repairs.
8. Reduce workspace snapshot bloat. At inspection, 51 retained revisions held about 364 MB of JSON in a 389 MB SQLite file; a legacy original is duplicated in saved snapshots. This is an observed storage condition, not a benchmark of large-project responsiveness.

## Limitations

This is developer functional evidence with one free OpenRouter/NVIDIA model and a fictional project. It does not establish participant usability, comparative research effectiveness, universal model equivalence, legal compliance or production security. Other provider adapters have automated contract/fault tests; they were not all requalified with live keys. Accounts/consent/research upload have local contract tests and PHP syntax checks; no staging database or real participant service was exercised. Signed installers, clean Windows/Linux devices, updates/rollback, comprehensive accessibility and penetration testing remain unverified. The source changes have not been packaged as a new public release.

## Live AI task results

The selected model was nvidia/nemotron-3.5-super-vl:free through OpenRouter. Successful task responses reported zero cost. Latencies below describe this run only, not a performance guarantee. Provider-reported output can include reasoning.

| Function | Live result | Important qualification |
|---|---|---|
| Clarification | 24.3 seconds; five questions adopted | The example stock threshold was correctly left unconfirmed. No stakeholder answers were fabricated or adopted. |
| Requirements and stories | 28.1 seconds; two requirements, two stories and three questions adopted | Human edits removed an unsupported default quantity and an unconfirmed insufficient-cash outcome before adoption. Original and reviewed proposals remained distinct. |
| Diagram | 39.6 seconds; Mermaid rendered and a draft was adopted | Some branches still imply unconfirmed exception outcomes. Rendering proves syntax, not business correctness. |
| Document | 29.3 seconds; two sections adopted into a draft SRS | This is a partial working document, not a complete approved SRS. Relevant unanswered governance questions were absent from the model's context. |
| Quality review | 34.7 seconds; two Warning findings adopted | It identified missing invalid-item and cash exception rules. Repeated clarification suggestions need deduplication. |
| Change impact | Broad request exhausted 32,768 output tokens after 285.5 seconds; narrowed retry succeeded in 19.6 seconds | The retry was rejected to avoid adopting unconfirmed decisions. Some conclusions still needed relevance review. |
| Project chat | Answered that five units is an example; no mutation proposed | Full-context receipt showed 16 references and no omitted history. An old nonexistent requirement attachment was manually removed first. The chat edit/adoption action types were not each requalified live. |
| Project/policy setup assistants | Both returned structured proposals; explicit remote-denial case returned 409 | Helper responses require human adoption. Background folder-analysis roles remain local-model dependent. |

APNK POS now holds one source, eight unanswered clarifications, two draft requirements, two draft stories, two assumption records, fourteen Pending evidence links, two Warning checks, one draft diagram, one draft document and one named snapshot. Three clarification blockers remain intentionally unresolved. Eight workbench runs include six successful proposals and two failed runs (one pre-audit failure). An additional chat audit message is retained. No baseline was approved using invented stakeholder answers. Other pre-existing projects were byte-for-byte equivalent as project objects to the pre-audit snapshot on final comparison.

## Export, persistence and recovery checks

- Downloaded actual working-document Markdown, DOCX, PDF, developer handover Markdown and connected-artifact JSON through the UI. The four-page PDF and two-page DOCX were rendered and inspected. Draft labels and unresolved-decision appendices were present.
- Confirmed export defect: a linked SRC-01 is printed as having no current record even though the reviewed source exists. artifactRecord handles other artifact types but omits source records. This is a provenance defect, not a missing original file.
- Confirmed formatting problems: Markdown headings/list markers appear literally in PDF/DOCX, DOCX paragraphs flatten internal structure, and a PDF section heading is stranded at the end of a page. The ordinary short document was readable with no observed clipped text. The PDF writer's handling of a single paragraph longer than a page is an additional source-derived risk; that extreme case was not reproduced live.
- Exported a portable ZIP and restored it through Settings. Its JSON contains the retained original as base64. A separate managed project was created; the recovered BRD file SHA-256 matched f376bd0617a5340d988ddac36ebae64ff6567b2d720fe556d67e5e421a651740. Requirements, stories, clarifications, evidence links, documents, diagrams, AI runs and versions matched before the audit copy was renamed. External processing was disabled on import.
- The retained project is labelled **APNK POS — audit recovery copy**. In it, created a new snapshot, changed the project name, and restored that snapshot through the UI. The original name returned, a recovery snapshot retained the intervening working copy, artifacts remained drafts and evidence links Pending. Restoration moved the goal to Validate but did not make a baseline approvable while blockers remained.
- Requirement workflow roundtrip exposed an audit inconsistency: returning an item from review to draft produced content revision 2, while the accompanying audit entry said the content revision remained 1. A rejection-reason field participates in revision comparison. Reported for later repair.

## UI and usability audit

The following are observed or explicitly identified design implications; no permission or general UI redesign was implemented in this token-only change.

| Area | Observation | Recommended change |
|---|---|---|
| Navigation | At the available 897-pixel viewport, text labels disappear while the wide sidebar remains. Global/project buttons then lack accessible names; a name-based Projects action failed. | Keep accessible names independently of visible text; use a genuinely compact responsive sidebar and reliable expand labels. |
| Editing layout | Requirements screen stacks the list/editor with multiple nested scroll areas. Important fields and controls require substantial scrolling. | Reduce nested scrolling, keep selection and save/review state visible, and test desktop and smaller-window layouts explicitly. |
| Workflow terminology | Sources, artifact inclusion, evidence coverage, goal stage and approval status use different concepts without consistently explaining their relationship. APNK shows 0% evidence coverage despite having a reviewed BRD because its artifact traces are still Pending. | Label that metric as verified artifact coverage and explain why. Clarify that “Not included” refers to document inclusion. |
| Entry points | Ask BA Mate, the inspector, Task AI and Guided workflow overlap. Some task assistants are hidden inside disclosures. | Establish one main guided path and present contextual shortcuts as the same assistant with a clear scope. |
| Processing permission | Project workbench and setup/policy helper permissions are separate. Repeated controls were a real source of user confusion. | Later introduce explicit remembered preferences and project overrides; keep confidential/local-only protections. |
| Long AI runs | One impact request took nearly five minutes before output exhaustion. Failed history uses unknown/unavailable fields and loses successful-style usage details. | Show meaningful elapsed progress, cancellation and retry guidance; retain actual request configuration and provider error metadata. |
| Generation quality | Fluent draft text, valid source IDs and rendered diagrams can contain unsupported business behaviour. | Make assumptions and unsupported branches conspicuous during review. Preserve human verification. |
| Approval | Invalid approval attempts were blocked with reasons. Some disabled controls need more discoverable explanations. | Put the next required action beside the disabled control rather than relying solely on a tooltip or later notification. |
| Settings | Full context and output allowance are visible under Advanced model limits. A two-million-token manual budget was rejected with a specific one-million-token error. Its generic alert title still says AI connection unavailable. | Distinguish invalid settings from an unavailable provider. This wording issue is recorded, not changed. |
| Recovery | Restore creates a separate project safely but initially repeats the original name. | Include “Restored copy” in the initial display name to avoid confusion. |
| Documents | Export success does not imply a professional-looking deliverable; raw markup and false missing-source messages remain. | Repair source appendices and structured renderers before external handoff. |
| Study service | Study participation currently displays “not connected”; local BA work remains usable. | Clearly separate researcher setup from participant instructions and test the real staging service before recruitment. |

Global Projects, Recent work, Templates, Beta guide, Settings and disconnected Study participation were inspected. APNK overview, guided workflow, goals, sources, requirements/stories, registers, evidence links, diagrams, documents, changes, safeguards, history, settings and conversation screens were exercised or smoke-checked. Lazy studio routes were additionally inspected after loading; route title alone is not considered proof of functionality. No browser console errors were reported during the inspected session. This is not a comprehensive screen-reader, keyboard-only, mobile-device or user-study evaluation.

## Final verification and release assessment

- 60 backend unit/API tests passed (initial baseline: 49).
- 71 frontend tests across 12 files passed.
- TypeScript checking and production build passed; existing large-bundle warnings remain.
- Python compilation and git diff whitespace checks passed. The three research PHP files passed syntax checks during this audit.
- Live connection test passed after a local-service restart, with the key held only in service memory. Full model context mode is active, output allowance 32,768 and timeout 300 seconds. The saved manual-context value is not the effective context while model mode is active.
- An excessive manual budget was rejected through the actual UI, then full-model mode was restored and a successful connection response was displayed.
- No supplied API credential was found in the reviewed tracked-source/document paths. No credential was added to workspace or provider settings files.
- The local service was left running at http://127.0.0.1:50392. Its address is session-specific. The key must be entered again after that service closes.

Assessment: the core evidence → AI proposal → human correction/adoption → draft workflow is operational. The framework is partially implemented, with valuable controls, but selected evidence revision enforcement, unresolved context, semantic review, provenance exports, model reliability and UX need repair before public-release readiness can be claimed. A larger context window addresses one capacity restriction; it does not resolve these other findings. Full fresh/existing/change project lifecycles on every provider/platform, real collaboration identities, large-document retrieval/batching and actual participant usability remain future validation, not implied passes.
