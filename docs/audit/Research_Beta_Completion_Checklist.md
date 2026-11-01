# BA_MATE — Research Beta Completion Checklist

## Scope rule

BA_MATE must reliably support the agreed BA lifecycle:

Evidence → clarification → requirements/criteria → review → approval → controlled change → faithful export.

The framework is the research contribution. BA_MATE is the reference implementation and evaluation instrument. Do not add a lifecycle stage merely to add features.

## Release priorities

- **P0:** Must be complete before any real-company or participant beta.
- **P1:** Required for the practical beta experience and research-quality evidence.
- **Optional:** Build only when needed by the study cohort; do not delay core validation.

---

## 1. Canonical artifacts, revisions, and traceability — P0

Create one consistent identity and revision model for every BA artifact:

- Evidence source and passage/location
- Clarification question and answer
- Stakeholder, assumption, decision, risk, and business rule
- Requirement, NFR, user story, and acceptance criterion
- Diagram/process model
- Document section
- Change request, impact record, baseline, approval, and export

Required changes:

- Give every artifact a stable ID and immutable content revision.
- Separate content changes from metadata/status changes.
- Pin traceability links to artifact revisions, not only artifact IDs.
- Record relationship types: supports, derived from, conflicts with, embeds, supersedes, affects, verifies.
- Detect edits before downstream invalidation is calculated.
- Record affected outputs and approvals whenever evidence, a clarification answer, rule, requirement, criterion, diagram, or document changes.
- Reject duplicate IDs, dangling revisions, and invalid trace links.
- Preserve approved baselines exactly; later work must never mutate them.

Completion proof:

- Editing a requirement, answer, rule, document, or diagram correctly marks only dependent artifacts as stale/review-required.
- Unaffected artifacts remain approved only where policy explicitly permits it.
- Earlier baselines remain unchanged and retrievable.

---

## 2. Shared approval, review, and baseline policy — P0

Replace separate approval buttons and direct status changes with one guarded workflow policy.

Required changes:

- Apply the same guarded transition to requirements, stories, criteria, diagrams, documents, bulk actions, imported content, restored content, and baseline creation.
- Separate simple stage navigation from formal approval.
- Require current selected revisions, relevant evidence support, resolved blockers, review completion, acceptance-criteria policy, dependency freshness, and authority/decision records.
- Prevent “in review” from being shown as approved.
- Support scoped approval by goal or agreed scope; define whether unrelated draft work blocks approval.
- Allow “not applicable” process models only with a recorded rationale.
- Record external stakeholder agreement honestly; do not present it as authenticated e-signature approval.

Completion proof:

- No artifact can be approved when it has blockers, stale dependencies, stale embedded diagrams, unverified support, or unmet required criteria.
- Direct artifact approval cannot bypass baseline rules.
- Approved manifests include the exact revisions and decision record used.

---

## 3. Safe editing, undo/redo, backup, and recovery — P0

Required changes:

- Scope undo/redo history to the correct project and document.
- Prevent document identity replacement or duplicate document IDs.
- Add visible project backup and restore controls using the existing ZIP capability.
- Clearly separate project backup, document export, and research-data export.
- Validate imported backups before applying them.
- Create a recovery copy before restoration, migration, or schema upgrade.
- Handle corrupt files, interrupted writes, unsupported backups, and restore conflicts safely.
- Correct the user guide to describe actual local storage and recovery behaviour.

Completion proof:

- Editing document A, switching to document B, then undoing never changes B into A.
- Backup → clean workspace → restore preserves artifacts, sources, answers, history, and baselines.
- Corrupt imports leave existing work untouched.
- Save, restart, and interrupted-write recovery are tested.

---

## 4. Complete requirement-to-document synchronization — P0

Required changes:

- Define the full mapping from approved BA artifacts into SRS sections:
  - Requirement statement
  - Acceptance criteria
  - Business rules
  - Rationale
  - Dependencies
  - Source/provenance
  - Relevant decisions and assumptions
- Let the BA choose the target document and target sections.
- Show an actual before/after diff, not placeholder content.
- Bind every synchronization proposal to both source and target revisions.
- Mark the proposal stale when either side changes.
- Avoid duplicate sections on repeat application.
- Mark document approval stale when a substantive synchronized section changes.

Completion proof:

- Selected approved requirements and criteria appear faithfully in the chosen document.
- Deliberately excluded content remains untouched.
- A receipt identifies the exact source and target revisions.
- Reapplying a proposal is safe and idempotent.

---

## 5. Controlled change management and reapproval — P0

Required changes:

- Connect AI impact analysis directly to the related change request.
- Replace example/hardcoded differences with real source-versus-proposed changes.
- Allow the BA to accept or reject each proposed patch.
- Apply accepted patches atomically across requirements, stories, criteria, documents, diagrams, and traces.
- Keep proposed, accepted, implemented, and revalidated states distinct.
- Prevent a change becoming “implemented” merely because version numbers advanced.
- Preserve the original baseline and create a reviewed addendum or new baseline only after revalidation.

Completion proof:

- A single business-rule change shows accurate impacts and an accurate difference.
- Rejected changes remain unchanged.
- Cancellation or failure causes no partial mutation.
- Dependent approvals are invalidated and must be re-established.

---

## 6. Faithful documents and exports — P1, beta gate

Required document outputs:

- SRS
- Requirements specification
- Acceptance-criteria specification
- Traceability matrix
- Change record/addendum
- Selected-baseline export
- Markdown, DOCX, and PDF variants

Required changes:

- Export an explicitly selected working revision or approved baseline.
- Preserve actual approval status, criteria, trace links, unresolved decisions, and change history.
- Render diagrams as diagrams, not text placeholders.
- Preserve tables, Unicode, long paragraphs, page breaks, and page numbering.
- Handle long documents without clipped content or broken pagination.
- Visually inspect representative DOCX and PDF outputs.

Completion proof:

- Markdown, DOCX, and PDF match the selected manifest.
- Old approved baselines never export current working content.
- No criteria, diagrams, tables, or status information is silently omitted.

---

## 7. Optional developer handover package — Optional feature

This is useful but must not be required to complete the BA lifecycle.

Required changes:

- Export developer-oriented Markdown containing only specified information:
  - Selected requirements and acceptance criteria
  - Linked diagrams
  - Constraints and interfaces where explicitly captured
  - Trace references
  - Change history
  - Unresolved decisions, assumptions, and risks
- Clearly identify draft versus approved content.
- Package linked diagrams and artifacts when requested.
- Never invent architecture, APIs, database design, or technical implementation choices.

Completion proof:

- A BA can complete core J1 and J3 journeys without using handover.
- When requested, the package faithfully represents the selected revision.

---

## 8. Explicit AI context selection and safe task behaviour — P1, beta gate

Required changes:

- Require explicit evidence/source selection for every AI task.
- Ensure “no selected source” does not silently mean “use all approved project sources.”
- Enforce goal and scope boundaries.
- Include relevant confirmed decisions, criteria, risks, governance rules, and source locations.
- Pin context revisions to the AI request.
- Show context omissions and truncation clearly.
- Enforce confidential-source restrictions before cloud inference.
- Reject malformed, unsupported, stale, or invalid-reference AI responses.
- Prevent late responses from modifying deleted, changed, or different projects.
- Provide cancel, retry, failure explanation, and manual-continuation paths.
- Keep rejected original and edited AI drafts locally where appropriate.
- Record failure category and unknown/unavailable usage values correctly.

Completion proof:

- Unrelated-goal evidence cannot enter a task.
- Cancelled or late AI results cannot alter artifacts.
- Failed AI tasks never block manual BA work.
- A task’s result is traceable to exact model, context, schema, and workspace revisions.

---

## 9. AI providers, credentials, and model qualification — P1, beta gate

Priority order:

1. Personal API keys
2. Local Ollama
3. OpenRouter
4. Hugging Face
5. Native provider adapters only where participants genuinely require them

Required changes:

- Make provider/key type requirements clear.
- Support explicit key removal.
- Consider OS credential storage for persisted credentials.
- Keep keys out of exports, settings backups, analytics, logs, and research uploads.
- Test each selectable provider/model against each supported BA task—not only connection success.
- Test invalid keys, credit exhaustion, unsupported structured output, unavailable models, timeouts, long context, and provider errors.
- Publish a supported-model/task matrix with known limitations.
- Record provider, model, context parameters, schema/prompt version, latency, usage/cost when available, errors, device constraints, and human correction effort.
- Freeze a fixed model profile for controlled research comparisons.

Do not treat parallel multi-agent execution as a prerequisite. It is optional and should be added only if it has a justified research or usability benefit.

Completion proof:

- Ollama, OpenRouter, and Hugging Face have measured capability profiles.
- No claim is made that smaller/cheaper models are equivalent until task evidence supports it.
- Personal-key and local-model participation work independently of sponsorship.

---

## 10. Everyday BA experience and usability — P1, beta gate

Required changes:

- Clear next actions at every lifecycle stage.
- Plain-language terminology and explanation of statuses.
- Visible review queues for blockers, stale artifacts, unanswered questions, and pending impacts.
- Editable drafts and review comments; remove hardcoded/demo comment behaviour.
- Clear uncertainty, conflict, and missing-evidence indicators.
- Reliable empty states, deletion confirmation, errors, and recovery actions.
- Support manual work when AI is unavailable.
- Label rule-based suggestions and prototype behaviour honestly; remove misleading controls.
- Test keyboard use, dialogs, accessibility basics, low-resource devices, and large projects.

Completion proof:

- A BA can follow the manual through a new-project, existing-specification, and approved-change journey without developer assistance.
- No required action is merely a toast, placeholder, or mock action.

---

## 11. Existing-specification journey — P1, beta gate

Required changes:

- Preserve the original imported document.
- Extract candidate information into canonical BA artifacts.
- Let the BA review, correct, reject, and link extracted content.
- Preserve source locations and revisions.
- Produce a true before/after comparison of the original and revised specification.
- Handle representative PDF, DOCX, text, tables, and scanned-document limitations honestly.

Completion proof:

- A BA can import an existing SRS, locate each extracted proposition, review it, create canonical artifacts, revise the specification, and export a faithful result.

---

## 12. Research consent and permitted-measurement contract — P0 before collection

Define and approve a strict data contract before remote collection.

Permitted measurements may include:

- Study pseudonym
- Research condition
- App/framework/protocol/instrument/model-profile versions
- Task start/end time and duration
- Provider/model profile
- Failure category
- Review/correction effort
- Submitted ratings
- Explicitly submitted free-text feedback

Do not collect as routine analytics:

- Project content
- Prompts
- Model responses
- Documents
- Filenames
- Source text
- Credentials
- Company identifiers
- Content hashes that can identify private material

Required changes:

- Separate measured duration, self-ratings, and independently assessed quality.
- Define missing-value handling; blank ratings must not become zero.
- Define consent, retention, withdrawal, and offline-queue behaviour.
- Use study pseudonyms, not arbitrary local IDs.
- Review free-text feedback separately because it may contain confidential information.
- Create a version manifest tying framework, application, task case, prompt/schema, instrument, and model profile together.

Completion proof:

- Deliberately injected project names, prompts, filenames, secrets, and content cannot enter upload payloads.
- Local work remains available without optional research consent.
- Each collected record states exactly which condition and frozen versions produced it.

---

## 13. Participant accounts and offline behaviour — P1, beta gate

Required changes:

- Replace the local password gate with maintained authentication components.
- Implement invitations, registration, login, account recovery, session handling, sign-out, and revocation.
- Separate participant identity from study pseudonym and researcher records.
- Create researcher-only administration authority.
- Define local/offline access and session-expiry rules.
- Ensure loss of connection never destroys or blocks access to local work or backups.
- Keep desktop local APIs loopback-only.
- Do not place database/server credentials in the desktop installer.
- Do not represent participant login as proof of stakeholder approval authority.

Completion proof:

- Invited users can register, recover access, sign in, sign out, and work offline according to the documented policy.
- Expired/reused invitations and unauthorised administration fail safely.
- Revocation and offline expiry do not destroy local projects.

---

## 14. Consented feedback upload and researcher administration — P1, beta gate

Required changes:

- Implement small versioned upload batches.
- Add offline queues, visible sync state, retry/backoff, and duplicate-upload protection.
- Provide consent withdrawal handling.
- Separate identity mapping from research records.
- Let participants preview submitted feedback where appropriate.
- Provide protected researcher export and administration.
- Minimise access logs and include backups/exports in retention and privacy policy.
- Test database backup and restoration before real collection.

Completion proof:

- Offline, retry, duplicate, revoked-consent, and withdrawal scenarios behave as promised.
- One participant cannot access another participant’s records.
- The researcher cannot retrieve private workspace content.
- Restored databases preserve authorised research provenance.

---

## 15. Research website and administration area — P1, beta gate

Required public site content:

- Research purpose and participant information
- Privacy and consent information
- Download links
- Windows/macOS installation instructions
- BA workflow guide
- Model connection guide
- Backup/recovery guide
- Release notes
- Known limitations
- Contact/support route

Required protected researcher area:

- Participant/invitation management
- Consent records
- Upload status
- Feedback review
- Study-data export
- Backup/restore procedure

Completion proof:

- A new participant can find, install, understand, and use the research release without private developer instructions.
- Research administration is protected and tested.

---

## 16. Sponsored AI access — Optional, only if issued

Required safeguards:

- Make personal keys and local Ollama sufficient for participation.
- Use individual provider credentials, not a shared unrestricted key.
- Set a total study spending ceiling before issuing access.
- Enforce participant-level provider limits and expiry.
- Keep provider-management credentials off participant desktops.
- Explain exhaustion, expiry, and fallback options.

Completion proof:

- Revoked credentials stop working.
- Provider-enforced limits remain effective even if credentials are copied.
- Total sponsored expenditure can be reconciled and bounded.

---

## 17. Windows/macOS installers, updates, and migration safety — P1, beta gate

Required changes:

- Identify cohort OS versions and processor architectures.
- Build clean installers for required Windows and macOS variants.
- Apply signing and macOS notarization where required.
- Publish release notes and a trustworthy download location.
- Add safe update checking and an install checkpoint.
- Create a pre-migration backup before updates.
- Test interrupted downloads, invalid signatures, failed migrations, rollback, and recovery.
- Ensure released desktop, UI, and local service versions match.
- Prevent frozen comparison runs from being silently altered by updates.

Completion proof:

- On clean Windows and macOS devices: install → sign in → connect a model → save work → restart → update succeeds without losing work.

---

## 18. Internal rehearsal, study freeze, and pilot decision — P1, final release gate

Before widening circulation:

- Rehearse all three journeys with synthetic data:
  - J1: new project
  - J2: existing specification
  - J3: approved change
- Exercise framework mechanisms M1–M7.
- Test real qualified models and unavailable-model/manual-work paths.
- Test stale AI proposals, source changes, long outputs, recovery, account changes, consent changes, offline queues, and upgrades.
- Keep developer defect evidence separate from participant research outcomes.
- Freeze the exact framework, app build, prompts/schemas, task cases, scoring rubric, model profile, protocol, instruments, and participant materials.
- Run a small invited rehearsal group.
- Refine only from recorded evidence, then freeze again before wider beta circulation.

Completion proof:

- No known critical data-loss, false-approval, silent-content-loss, or unauthorised-collection defect remains.
- Every release gate has named evidence.
- Participant testing begins only after the frozen research configuration is recorded.

---

# Required release gates

| Gate | Must pass before real beta |
|---|---|
| G1 — Integrity | Canonical revisions, dependency propagation, approval controls, recovery, synchronization, controlled change |
| G2 — BA journeys | J1, J2, J3, accurate documents, manual-work path, usable participant experience |
| G3 — AI suitability | Explicit context controls, real model qualification, provider failure handling |
| G4 — Research boundary | Consent, permitted measurements, participant accounts, secure upload, withdrawal, administration |
| G5 — Distribution | Tested installers, updates, backup/recovery, accurate manuals |
| G6 — Study readiness | Internal rehearsal, frozen materials/configuration, pilot decision |

# Implementation order

1. **B01–B03:** revisions/dependencies, approval policy, undo/backup/recovery  
2. **B04–B05:** revision-safe SRS synchronization and real change implementation  
3. **B06–B08:** dependable exports, AI context safety, model qualification  
4. **B09–B11:** consent contract, accounts, upload service, researcher administration  
5. **B13–B14:** installers, updates, manuals, UX completion  
6. **B15:** internal rehearsal, study freeze, small pilot  
7. **B12 and developer handover:** only when their use is justified and core gates remain on track