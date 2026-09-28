# Step 5 — BA Mate feature and framework-conformance audit

Audit performed 20–21 September 2026 against the current BA Mate 0.4 source and an isolated synthetic workspace. **Verdict: suitable for developer rehearsal; not ready for the proposed real-work beta.** This is a readiness audit, not participant evidence or a completed security assessment. No runtime application fixes or deployment were made in this audit.

## What the evidence establishes

The existing 28 frontend tests, 20 backend tests, type check and production build passed. Fifteen project routes rendered without browser page errors. Small Markdown, DOCX and PDF downloads succeeded. Additional diagnostic probes reproduced gaps in approval and change propagation; passing those probes means the defect was reproduced, not repaired. See the [verification record](VERIFICATION_2026_09_21.md).

The prototype contains genuine local persistence, evidence extraction, provider adapters, structured AI proposals and human-review screens. The important remaining work is consistency between those features. Tests of individual helpers and working screens do not establish a complete BA journey or F4 conformance.

Evidence labels: **R** = reproduced in the isolated runtime; **S** = source inspection; **T** = existing automated tests. “Partial” means useful implementation exists but does not yet satisfy the intended beta contract. “Not verified” does not mean absent. Source line numbers below are locators for this audit revision and may move during repairs.

## Findings that determine repair order

| ID / priority | Finding and consequence | Evidence | Repair ticket |
|---|---|---|---|
| A01 / P0 | Requirement review → Approve succeeds with an unresolved blocking finding. The separate baseline gate does not protect every artifact approval path. Diagram approval also lacks the full common gate. | **R/S:** UI fixture retained `AUDIT-BLOCKER` while FR-01 became approved; `connected.tsx` setStatus around 589, requirement controls around 1177, diagram approval around 2020 | B02 |
| A02 / P0 | Editing a requirement demotes that requirement but can leave a linked document approved. Dependency propagation occurs before direct artifact changes are discovered. | **R/S:** diagnostic AUD-02; `store.ts` enforceWorkingVersions around 374 | B01–B02 |
| A03 / P0 | Baseline eligibility permits a draft diagram and stale embedded diagram. Review of required models/dependencies is absent from the gate. | **R/S:** AUD-01; `store.ts` baselineIssues around 341 | B02 |
| A04 / P0 | Document undo can replace a different document with the earlier document's content and identity. Edit A, create/select B, Undo: two A entries appear and B is replaced. | **R/S:** browser reproduction; document-wide undo stacks around `connected.tsx:2522`, undo around 2781, selection around 2903 | B03 |
| A05 / P0 | The change action marks a request Implemented and advances versions/statuses without applying the substantive requested requirement/document content. The displayed proposed difference is a hardcoded example; story impacts are not handled consistently. | **S:** `App.tsx` apply around 2029; proposed difference around 2296 | B05 |
| A06 / P0 | Requirement-to-SRS synchronization omits acceptance criteria and other substantive fields; its “current document” view is placeholder text. Acceptance lacks a complete freshness check and can attach current revision metadata to earlier proposal text. | **R/S:** sync preview shows only title/statement; `connected.tsx` createSync around 527 and SyncReview apply around 187 | B04 |
| A07 / P1 | Export metadata reflects working artifacts and a generic baseline lookup rather than an explicitly selected revision manifest. Approval wording is hardcoded; diagram blocks export as text placeholders. | **S; R download only:** `exporters.ts` lines 4–24 | B06 |
| A08 / P0 | Project ZIP import/export helpers are tested but have no production UI callers found. The manual tells participants to use them. Settings offers workspace JSON export, without a corresponding participant restore flow. | **S/T:** `store.ts:192/197`; production symbol search; `App.tsx` settings around 3842 | B03 |
| A09 / P1 | Empty goal source selection can fall back to all approved sources; some task context includes all project diagrams/documents. Project-specific governance/register information is not consistently supplied to model tasks. | **S:** `modelGateway.ts`, `WorkflowWorkbench.tsx`, backend workflow context | B07 |
| A10 / P0 before online collection | No real participant account, consent-controlled central upload, researcher API or upload queue exists. Existing research export contains arbitrary local IDs and broadly copied metadata; local console password is not authentication. | **S:** `research.ts`, App research views, backend route inventory | B09–B11 |
| A11 / P1 | Packaging configuration is not a verified Windows/macOS release or updater. Current macOS configuration is unsigned ZIP; DMG and safe update delivery are not complete. | **S:** `desktop/package.json`, `desktop/main.cjs`, build scripts | B13 |
| A12 / design choice | Baseline eligibility is whole-project: a draft in another goal blocks approval. F4 permits explicitly scoped approval. This is a policy mismatch to resolve, not automatically a faulty whole-project design. | **R/S:** AUD-03; `store.ts` baselineIssues | B01–B02 |

P0 means resolve before real-work beta because it affects content integrity, the evaluated mechanism, recovery, or the proposed collection boundary. It does not imply every finding is an exploitable security vulnerability. P1 items can also be release gates when required by a participant journey.

## Feature inventory

| Feature/action family | Current state | Evidence and next requirement |
|---|---|---|
| Project list, creation wizard, scope | Partial | S/R: wizard renders and creates a UI project; fresh-project save/reopen was not conclusively established by this harness. Rehearse without seed content. |
| Goals and stage navigation | Partial | S/R: screens work; stage navigation and artifact approval are separate paths. Specify scoped completion and return paths. |
| Existing specification entry | Partial | S: source import available; full existing-SRS → extracted canonical artifacts → reviewed replacement journey not proven. |
| PDF/DOCX/text extraction | Implemented with limits | S/T: originals/text retained, bounded parsing, scanned PDF rejection. Verify representative company documents; DOCX mixed table/paragraph order needs attention. |
| Evidence review and classification | Partial | S/T: reviewed-source selection and confidential-cloud restriction exist. Add explicit per-task source manifest and passage locations. |
| Source replacement/deletion | Partial | S/T: some evidence-change invalidation covered; whole dependency and recovery journeys remain. |
| Clarification questions/answers | Partial | S/T/R: recorded questions and human answers exist; test unanswered/conflicting/stale-answer cases through approval. |
| Stakeholder/risk/assumption/decision registers | Partial | S/R: local register screens exist; model context and artifact relationships are incomplete. |
| Requirement/NFR editing | Partial | S/R: editing/status controls work; approval bypass and downstream invalidation are blockers. |
| User stories and criteria | Partial | S/T: structured fields exist; accepted requirements/stories are not automatically coherently related. Verify editing and trace coverage. |
| Prioritisation/batch selection | Partial | S/R: controls exist; must preserve scope, source review and approval eligibility in batches. |
| Traceability review | Partial | S/T/R: pending/verified paths exist; links do not comprehensively pin endpoint revisions. ID existence is not semantic correctness. |
| Quality findings and validation | Partial | S/T/R: findings/blockers exist; not all approval controls honour them. |
| Structured AI task workbench | Partial | S/T: schemas, explicit proposal adoption and stale-context checking exist. Qualify every task on actual models. |
| Chat/assistant | Partial | S: some conversation state persists; assistant drawer state is local to the component. Handle navigation/deletion during an outstanding response. |
| AI failure handling | Partial | S/T: provider/schema errors are surfaced; no complete cancel/retry UX and failed-run measurement trail. |
| Model context selection | Partial | S: source limits and omission warnings exist; scope fallback and governance context need repair. |
| Ollama | Implemented; current profiles unqualified | S/T: real adapter. No live inference in this audit; local model/device qualification remains. |
| OpenRouter | Implemented; live use unverified | S/T: real structured-output adapter and error handling tested with fake HTTP. Provider key/model availability must be exercised. |
| Hugging Face | Implemented; live use unverified | S/T: real adapter; task support is not established for every selectable model. |
| Native OpenAI/Gemini provider keys | Implemented; live use unverified | S/T: first-class Responses/Interactions adapters, memory-only credentials and mocked HTTP/fault tests are present. Each selected model still requires live connection and full BA-task qualification before beta use. |
| API-key persistence/clearing | Partial | S: keys kept in service memory, excluded from settings file; explicit clear and optional OS credential-store handling need design. |
| Parallel AI roles | Not implemented | S: inference serialized with one slot. Parallelism is optional and unnecessary to establish framework novelty. |
| Mermaid editing/preview | Partial | S/T/R: rendering and syntax checks work; business correctness and revision/approval consistency remain. |
| Model-to-document embedding | Partial | S: pinned versions/stale flags exist; repeated section creation, target selection and approval gating need checks. |
| Document template creation/editing | Partial | S/R: structured editor works; cross-document undo is a data-integrity blocker. |
| Review comments | Demonstration behaviour | S: some comment buttons insert predefined text. Replace with actual comment entry or remove from participant workflow. |
| SRS synchronization | Partial, release blocker | S/R: reviewed proposal UI exists; content completeness, real diff and freshness checks missing. |
| Markdown/DOCX/PDF | Partial | S/R: small files download; fidelity, diagrams, true status, selected baseline, long text and Unicode not qualified. |
| JSON artifact export | Implemented for local artifacts | S: contains project content; must not be used as anonymous analytics. |
| Developer handover package | Missing as controlled feature | S: general Markdown exists, not a complete selected-revision developer package. Optional use; never a mandatory lifecycle stage. |
| Baseline/snapshot/restore | Partial | S/T: historical snapshots protected and restore returns drafts; eligibility and scoped manifest incomplete. |
| Change requests/impact/revalidation | Disconnected/partial | S/R route: AI impact findings and change execution are not one faithful content-update flow; example diff remains. |
| Save and persistence | Implemented with limitations | S/T/R: SQLite/revision checks exist; full-workspace serialization and crash/reopen/large-file behaviour need qualification. |
| Project backup/import | Disconnected | S/T: working helper tests do not provide an accessible backup/restore experience. |
| Folder selection | Partial | S: chosen label/handle is not an implemented persistent folder-based workspace or file watcher. Explain actual local storage. |
| Teams/invitations/approver identity | Local simulation | S/R: editable local membership is not authenticated multiuser authority. Record external agreement honestly. |
| Kickoff/template suggestions | Rules/demo mixed with real features | S: keyword/template suggestions are not model inference. Label clearly and remove misleading prototype actions. |
| Research condition controls | Partial | S/T: manual condition disables app AI; configuration locks exist. Generic mode shares workflow controls and does not isolate the entire framework effect. |
| Local events/ratings/export | Partial | S/T: existing data useful for development; missing-vs-zero and self-rated-vs-objective distinctions need P2/I2 alignment. |
| Login/consent/central collection | Missing | S: design and implementation required; no private-project upload should be introduced. |
| Sponsored usage | Missing; optional | S: manually capped participant credentials can suffice if used; automated funding unnecessary for BYOK/local beta. |
| Installers/updater | Partial/missing | S: Electron shell exists; platform builds/signing, updates and migration recovery not qualified. |
| Help/accessibility/performance | Not fully verified | S/R: guide exists but contains stale claims. Keyboard, assistive technology, low-resource devices and long projects need explicit rehearsal. |

This covers current feature families and major actions. Route rendering is not an exhaustive click-by-click certification: every visible control must still be exercised or hidden in the release checklist, especially contextual dialogs and failure states.

## Three required BA journeys

| Journey | What exists | Current stopping points | Release proof required |
|---|---|---|---|
| J1 — New project | Scope/evidence/clarification/requirements/model/document screens and proposals | Approval bypass; requirement-to-document omissions; no complete model-backed case verified | Clean project, real selected model, saved/reopened work, trace review, accurate SRS/export and approved manifest |
| J2 — Existing specification | Import/extraction and reusable document/artifact editors | Extraction is not a completed migration into canonical requirements; update diff/content fidelity not established | Preserve original, locate extracted propositions, confirm revisions, compare actual before/after, export without silent omissions |
| J3 — Approved change | Baselines, change screen and impact proposals | Change action can claim implementation without content patch; downstream approval can survive an edit | Prior baseline unchanged, explicit impacts, accepted patches only, revalidation, accurate addendum/new baseline and optional handover |

No journey is marked end-to-end passed. Ordinary BA work must also remain possible manually when the model is unavailable. Complete each without invoking developer handover to prove it remains optional.

## Framework conformance and research consequences

| F4 mechanism | Audit assessment | Evidence needed before evaluation |
|---|---|---|
| M1 Evidence selection/provenance | Partial | Explicit task scope, source/revision locations and cloud-policy checks |
| M2 Clarification/uncertainty | Partial | Conflicting/absent answer challenges; no invented stakeholder confirmation |
| M3 Bounded proposals | Partial | Real-model failures, cancellation, freshness and unchanged workspace on rejection |
| M4 Human adoption/accountability | Partial | Consistent proposal/edited/adopted records across every task |
| M5 Semantic review | Partial | Human support checks and resolved blockers enforced at approval |
| M6 Approval/change integrity | Fails reproduced challenges | B01–B05, including document identity and historical baseline protection |
| M7 Faithful documents/optional handover | Incomplete | Complete criteria, selected revisions/statuses, diagrams and optional package |

Keep F4-draft.1 as the intended mechanism. Do not weaken it merely to match current software defects or claim these synthetic findings are participant validation. Record implementation repairs separately from evidence-led framework refinements. Freeze app/framework/protocol/instrument/dataset/prompt/model-profile identifiers together; current runtime version strings do not yet consistently correspond to F4/P2/I2.

The audit does not require another core lifecycle stage or make handover mandatory. The [hosting design](../hosting/SHARED_HOSTING_PLAN.md) sits outside that BA lifecycle. The [implementation backlog](IMPLEMENTATION_BACKLOG.md) turns the findings into ordered work and acceptance criteria.
