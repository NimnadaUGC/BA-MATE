# Ordered implementation backlog after Steps 4–5

Prepared 21 September 2026. Input: [feature audit](FEATURE_AUDIT_2026_09_21.md), [hosting plan](../hosting/SHARED_HOSTING_PLAN.md), [F4 specification](../../../Framework/Specification/FRAMEWORK_SPECIFICATION.md), [P2 protocol](../../../Evaluation/EVALUATION_PROTOCOL.md). **All tickets below are open.** These are implementation tasks and acceptance criteria, not claims that the features have been repaired.

Work order: **content/recovery integrity → complete BA journeys and faithful outputs → model qualification → participant service and permitted collection → installation/update/manuals → rehearsal and study freeze**. Hosting account checks can run alongside local repairs. No firm completion date is assigned before those gates pass.

## First repair batch — protect the evaluated mechanism

### B01 — Canonical revisions and dependency propagation — P0

Addresses A02/A12; foundation for B02/B04/B05/B06. Work in `types.ts`, `store.ts`, `workflow.ts` and `connected.tsx`.

Define artifact revision identity, content versus workflow metadata changes, typed relationships and selected approval scope. Detect direct requirement/story/document/model edits before propagating impact. Include block links and embeds, removals and changed clarification answers. Pending impacts must visibly require review; preserve unaffected approvals only after a recorded impact decision. Avoid advancing content revisions merely because synchronization metadata changed.

**Acceptance:** change a linked requirement or business rule through each editor/proposal/import route; every affected working artifact and trace is stale/review-required, the earlier baseline remains byte-for-byte unchanged, unrelated artifacts retain status only under the explicit policy. Duplicate IDs and dangling revision references are rejected. A separate goal cannot silently enter a scoped baseline.

### B02 — One approval and baseline policy — P0

Depends on B01; addresses A01/A03/A12. Replace ad hoc status setters with shared guarded transitions. Apply to requirement/story/diagram/document approval, baseline creation, bulk actions and restored/imported material. Distinguish stage navigation from approval. Check authority record, selected revisions, blockers, support, criteria, required reviews and current dependencies. Record externally obtained stakeholder agreement without claiming authenticated electronic signature. A textual process model or justified not-applicable decision can satisfy the relevant scope; do not require a diagram for every case.

**Acceptance:** UI and state-level tests reject approval with a blocking issue, unverified support, unmet criterion policy, stale embed or unreviewed required model. Direct artifact approval cannot bypass baseline policy. A valid selected manifest can be approved and retrieved with its decision record. In-review is never displayed as approved.

### B03 — Document identity, undo and accessible recovery — P0

Can start immediately; addresses A04/A08. Scope undo/redo history to document and project identity; preserve canonical revision invariants. Connect tested project ZIP backup/import helpers to visible controls, with validation, confirmation, progress and conflict-safe restore. Clearly distinguish content backups, document exports and research exports. Preserve a recovery copy before migrations/restores; explain actual managed local storage.

**Acceptance:** edit A → select/create B → undo/redo never changes B into A or duplicates IDs. Backup → fresh workspace → restore preserves originals, answers, artifacts and history; imported external processing is off. Corrupt/unsupported packages leave existing work intact. Save/reopen and interrupted-write recovery pass. Correct the manual against the visible controls.

### B04 — Complete, revision-safe document synchronization — P0

Depends on B01/B02; addresses A06. Define a complete mapping for requirement statement, criteria, rules, rationale, dependencies, provenance and relevant decisions. Let the BA choose the target document and sections. Show actual old text and proposed new text, not a placeholder. Bind the proposal to source and target revisions; reject or rebase changed inputs before applying. Distinguish intentionally omitted fields from accidental loss.

**Acceptance:** selected approved requirements and criteria appear faithfully in the chosen SRS; deselected items remain untouched. Editing either source or target after opening the proposal makes it stale. Receipts identify exactly the content revisions used. Reapplying cannot create duplicate sections or content. Applying an update never silently preserves stale document approval.

### B05 — Real change impact, patch and reapproval — P0

Depends on B01/B02/B04; addresses A05. Join AI impact proposals to the change record. Replace the sample difference with real affected content and human-reviewed patches. Apply only selected changes atomically, including stories, criteria, documents and process models where relevant. Keep proposed, accepted, implemented and revalidated states distinct. A change cannot be Implemented simply because versions increased.

**Acceptance:** J3 changes one concrete business rule from a baseline, shows an accurate difference, applies the selected content, leaves rejected changes untouched and invalidates the correct approvals. Cancellation/failure has no partial mutation. Produce a consistent addendum/new baseline after revalidation; the original baseline remains retrievable.

## Second batch — useful BA outputs and reliable AI

### B06 — Faithful documents and optional developer handover — P1, beta gate

Depends on B01/B04/B05; addresses A07. Generate and export an explicitly selected working revision or baseline. Preserve true status, criteria, trace references, unresolved decisions and process content. Render diagrams and structured tables appropriately; handle long paragraphs, page breaks, Unicode and YAML escaping. Offer a separate developer Markdown package with selected specification, criteria, interfaces/constraints when actually specified, change notes and unresolved items. Do not invent implementation architecture.

**Acceptance:** compare source manifest with Markdown/DOCX/PDF and developer Markdown on short/long cases and an old approved baseline after working edits. No missing criteria, clipped content, false approval or current-version substitution. Open and visually inspect documents. Complete J1/J3 with handover skipped and with it explicitly requested.

### B07 — Explicit task context and honest model execution — P1, beta gate

Depends on B01. Repair goal scoping and empty-selection semantics. Include relevant confirmed decisions, criteria, risks and governance policy. Pin context revisions and source locations; disclose truncation and external processing. Handle stale responses, project deletion, navigation, cancellation and bounded retry without duplicate adoption. Record failure categories and unavailable usage values, preserving original/edited output locally where appropriate.

**Acceptance:** unrelated-goal evidence stays excluded; no-selected-source does not silently mean all sources. Confidential context cannot reach cloud inference. Each task rejects malformed/stale/invalid-reference output without changing artifacts. Cancellation and late responses cannot modify a deleted or different project. All failure paths permit manual BA work.

### B08 — Qualify local/BYOK model profiles — P1, beta gate

Depends on B07 and reviewed synthetic cases. Test Ollama, OpenRouter and Hugging Face through every supported task, not only connection health. Record model identifier/provider, capability, context/parameters, prompt/schema version, latency, error/usage reporting, device memory and human corrections. Add native provider adapters only where cohort needs native keys; make key types clear. Add explicit credential removal; evaluate OS storage for optional persistence.

**Acceptance:** publish a measured supported-task matrix and known limits. Test unavailable model, invalid key, exhausted credits, unsupported structured output, timeout and long context. Use a fixed profile for controlled comparisons. Make no claim of cheaper-model equivalence until measured. Parallel agents and hosting model weights are not prerequisites.

### B09 — Consent and measurement contract — P0 before remote collection

Can be designed alongside B01–B08; must precede B10/B11. Align event fields and instruments to P2/I2. Separate self-ratings, measured duration and independently rated correctness. Replace arbitrary identifiers/metadata spreads with a strict allowlist and study pseudonyms. Define missing values, withdrawal, retention and offline queues. Create a manifest tying all research versions together. Decide precisely what the shared-control Generic AI condition estimates.

**Acceptance:** a field-by-field approved contract explains purpose, source, consent and retention. Injected company names, prompts, files, credentials and content hashes cannot enter the upload payload. Empty ratings do not become zero performance. Run records identify condition and exact versions. Local company work remains usable without consenting to optional collection.

## Third batch — small hosted service and participant delivery

### B10 — Shared-hosting participant identity — P1, beta gate

Depends on B09 and hosting H01–H06. Implement the PHP/MySQL account/invite/recovery/session service and separate administrator authority. Establish desktop sign-in, credential storage, revocation and offline expiry behaviour. The current Electron shell denies arbitrary external navigation/windows; any browser-based authentication needs a narrowly scoped supported integration, not disabling those protections. Do not treat participant login as proof of each company stakeholder's approval authority.

**Acceptance:** invited participant can enroll, authenticate, recover and sign out. Expired/reused tokens and unauthorised administration fail. Account revocation and offline expiry follow documented policy without destroying local work. Local APIs remain loopback; no server database credential ships in the installer.

### B11 — Consented central feedback and research administration — P1, beta gate

Depends on B09/B10. Implement small versioned batches, deduplication, queue limits/backoff, withdrawal handling, user-visible sync status and researcher export. Keep identity mapping separate. Preview optional feedback. Apply access-log minimisation and retention to server operations, backups and exports too.

**Acceptance:** synthetic online/offline/retry/duplicate/revoked-consent runs collect only authorised fields once. Account access cannot retrieve another participant's records. Withdrawal behaves as promised. Database restore and research export preserve provenance. The researcher receives no private workspace content.

### B12 — Limited sponsorship — optional; gate only if funded access is issued

Depends on qualified providers and explicit researcher budget. Manually provision participant-specific capped credentials if needed; automated funding is deferred. Keep administrative/provider management secrets off desktops and out of analytics. Explain expiry and exhaustion.

**Acceptance:** copied credentials remain subject to the provider-enforced limit, revoked keys stop working, total spending is bounded and reconciled. BYOK/local use remains independent. No free-price or model-availability guarantee.

### B13 — Windows/macOS releases, updates and recovery — P1, beta gate

Depends on stable schema, B03, B10/B11 and hosting H02/H09/H10. Determine cohort CPU architectures/OS versions, produce installers, sign/notarize as applicable, test clean devices and publish accurate release metadata. Implement a safe update client, scheduled install checkpoint, pre-migration backup and tested recovery path. An installed binary must match its bundled UI/service version.

**Acceptance:** clean Windows and macOS installation → sign-in → model connection → saved sample → restart → upgrade works. Interrupted download, invalid signature, migration failure and rollback/recovery retain work. Frozen comparison runs are not silently updated; affected runs are recorded/rescheduled when necessary.

## Fourth batch — remove prototype friction and rehearse

### B14 — Participant UX, manuals and complete action audit — P1, beta gate

Depends on repaired flows. Remove or label demo suggestions, hardcoded changes and simulated invitations. Make comments editable, next actions understandable and researcher administration separate from daily BA work. Test every visible control, keyboard/dialog behaviour, useful empty states, errors and deletion confirmation. Keep folder/storage wording honest. Write Windows/macOS installation, privacy, model connection, backup/recovery, updates and BA-task guides from the released interface.

**Acceptance:** a BA can perform J1/J2/J3 from the manual without developer intervention. No required action is only a toast/mock. Sample output matches instructions. Accessibility and practical low-resource/large-project limits are recorded; unresolved limitations are explicitly excluded from beta scope rather than hidden.

### B15 — Internal rehearsal, freeze and invited pilot — release decision

Depends on B01–B11 and B13–B14; B12 only if sponsorship is used. Run the three journeys and F4 M1–M7 challenges with synthetic data and qualified real models. Check unavailable network/model, stale proposals, source changes, long outputs, backup, account/consent changes and updates. Keep developer defect evidence separate from research outcomes.

**Acceptance:** no known critical data-loss, false-approval, silent-content-loss or unauthorised-collection defects; all applicable gates have named evidence. Finish the [study freeze records](../../../Evaluation/Templates/STUDY_RECORDS.md), reviewed cases/keys, rater preparation and participant materials. Then invite a small rehearsal group, refine on evidence, freeze again and widen circulation. Controlled comparisons, interviews and final framework/skills publication follow the research roadmap.

## Release evidence matrix

| Gate | Required tickets/evidence | Current result |
|---|---|---|
| G1 Content and approval integrity | B01–B05; A01–A06/A08 reproduction becomes passing corrected-behaviour checks | Fail / repairs required |
| G2 BA journey and output fidelity | J1/J2/J3; B06/B14; manual and unavailable-model paths | Not passed |
| G3 Real-model suitability | B07/B08 task matrix and failure cases | Not qualified this audit |
| G4 Account, consent and data boundary | B09–B11; synthetic service/reconnect/privacy tests | Not implemented |
| G5 Distribution and recovery | B03/B13; hosting account evidence; clean-device/upgrade tests | Not qualified |
| G6 Research readiness | B15; approved materials and completed version/treatment freeze | Pending |

The next concrete implementation unit is **B01–B03**: canonical change tracking, shared approval rules and document/recovery integrity. Establish corrected-behaviour regression tests for the reproduced defects before expanding features. Continue immediately to B04/B05 so the framework can be exercised through a complete approved-change journey.
