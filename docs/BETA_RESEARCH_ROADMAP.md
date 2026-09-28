# BA Mate: framework evaluation and beta readiness roadmap

Discussion draft — 20 September 2026; readiness links updated 21 September. This document proposes the next work; it does not mark those features implemented. The fresh [Steps 4–5 audit](audit/FEATURE_AUDIT_2026_09_21.md) and [verification record](audit/VERIFICATION_2026_09_21.md) supersede the earlier readiness snapshot, while preserving historical verification records.

**Numbering:** the agreed research checklist uses Steps 1–3 for contribution/framework/evaluation documentation, Step 4 for hosting, and Step 5 for the feature audit. The numbered implementation workstreams below were written earlier and have different numbering. Use the [research index](../../RESEARCH_INDEX.md) for checklist progress and the [new backlog](audit/IMPLEMENTATION_BACKLOG.md) for repair order and acceptance criteria.

## Confirmed constraints from the discussion

**Steps 1–3 documentation:** the current [research index](../../RESEARCH_INDEX.md) links the contribution specification, framework F4 diagrams and evaluation protocol P2. These are reviewable pre-evaluation drafts, not evidence of application readiness, protocol approval or completed participant testing.

- First cohort uses **Windows and macOS**.
- The researcher confirms **Register.lk Core shared hosting**, one domain with multiple subdomains, PHP/MySQL and Node/Python options. The [hosting plan](hosting/SHARED_HOSTING_PLAN.md) selects PHP/MySQL for the lightweight service, with actual account and installer-distribution checks still pending.
- Intended participant testing period is approximately **one month**; this is not a promised implementation deadline.
- **Personal API keys and local Ollama are the priority.** Occasional researcher-sponsored access is optional and must remain affordable.
- No sponsored budget has been fixed. Set a hard total cap before issuing any funded credentials; do not assume unlimited free provider access.
- Plan to use existing shared hosting at **bamate.csbodima.lk** for downloads, manuals, participant accounts, consented research collection and administration, subject to verifying the hosting plan's capabilities and limits.
- **No separate VPS and no researcher-hosted AI models are planned.** A lightweight HTTPS API on the shared hosting will mediate account/database operations; desktop clients must never connect directly to the database or contain its credentials.
- The core lifecycle is **Scope → evidence → clarification → requirements and criteria → process model → validation → document → approval → change**. It is iterative, with returns to affected stages. Developer handover is an optional supporting artifact export, not a mandatory stage or completion gate.
- Direct provider-native key support, including providers used for GPT/Gemini access, requires corresponding adapters and live tests. Existing OpenRouter/Hugging Face support does not mean every provider's own key can be pasted into those connections.

## 1. Research objective and release boundary

The intended contribution is an explicit, reusable method for evidence-grounded, human-governed BA work using replaceable AI models. BA Mate is the reference implementation and evaluation environment. Diagrams, decision rules, schemas, worked cases and later portable skills explain how another team could implement that method.

A method or model can be a design-science artifact; training a new model is not a prerequisite. A research contribution still needs an identified problem, grounding in prior work, clearly specified design knowledge and credible evaluation. The framework label by itself does not establish novelty. See [Hevner et al., Design Science in Information Systems Research](https://aisel.aisnet.org/misq/vol28/iss1/6/).

Before circulation, freeze an evaluation version with testable rules. After evaluation, publish the refined version with evidence explaining changes and limitations. The final research framework cannot be declared empirically complete before those observations.

## 2. Current implementation: what exists and what remains

| Area | Inspected state | Consequence |
|---|---|---|
| Local inference | Real Ollama; OpenRouter/Hugging Face adapters; structured proposal checks | Live cloud capability tests and model qualification remain |
| Evidence | Original files, text extraction, source review, citations by identifier | Passage-level support, precise goal scope and large-project retrieval need improvement |
| BA workflow | Focused clarification, requirements, review, diagram, document and impact tasks | Complete projects still need orchestration, consistent revisions and stronger connections |
| Review and history | Original/edited proposals, draft acceptance, traces, baseline/restore safeguards | Audit all entry points, stale asynchronous results and document synchronization |
| Documents | Markdown, DOCX, PDF and JSON exporters exist | Diagram blocks become text placeholders; PDF pagination is simplistic; approval labels/baseline selection need fidelity checks |
| Development handover | Basic Markdown document export exists | No controlled, complete developer specification package |
| Research | Local events, ratings, comparison records and manual JSON export | No consent-controlled central submission pipeline; the local console has a client-side fixed password, not real authentication |
| Desktop | Local Electron/Python application; unsigned Apple Silicon package | No participant account system, sponsored allowance service or update client/feed |
| Deployment | Local loopback service | It must not become the public server by simply exposing its port |

## 3. Proposed architecture and information boundaries

Keep three responsibilities separate:

1. **Desktop workspace:** private project evidence, conversation, artifact content, traces, documents and backups; local model execution or explicitly selected cloud inference.
2. **Research service:** enrollment, authentication, consent versions, pseudonymous measurements, submitted feedback, study assignments and sponsored allowances.
3. **Distribution service:** installers, signed update metadata, release notes, user manuals and framework publications.

Use existing shared hosting at **bamate.csbodima.lk** for these web responsibilities. PHP/MySQL is the planning choice based on the user-confirmed Core account and public capability review. Verify the actual account's HTTPS/runtime, capacity, installer-distribution permission, backup/restore and invitation/recovery delivery using the [hosting checklist](hosting/SHARED_HOSTING_PLAN.md). Keep research credentials, database and permissions logically separate from other hosted sites; this is still a shared account. The desktop communicates with authenticated HTTPS endpoints, never directly with the database. The existing local Python/FastAPI service remains on the participant's computer. No separate VPS or model server is part of this plan.

Cloud AI and research analytics are different data flows. Cloud AI necessarily receives selected prompt/context content. Research analytics should receive only its specified measurements. A researcher-hosted inference proxy would also process project content transiently, even with logging disabled; that must be disclosed if selected. Direct provider calls with participant-specific sponsored credentials better match the aim of keeping project content off the research server.

## 4. Earlier implementation and evaluation workstreams

The original numbering is retained below for reference. The current prioritised repair sequence is [B01–B15](audit/IMPLEMENTATION_BACKLOG.md).

### Step 1 — Specify the framework and contribution

- Define scope using the agreed lifecycle: scope → evidence → clarification → requirements and criteria → process model → validation → document → approval → change; explain applicability to SMEs and constraints.
- Show developer handover as an optional export branch from suitable artifact revisions, especially SRS and change documentation. It is outside the mandatory lifecycle and must not block approval or change handling.
- Define vocabulary and relationships: evidence, source passage, stakeholder, decision, assumption, requirement, story, acceptance criterion, finding, artifact revision and baseline.
- Define each mechanism through its inputs, action, output, human responsibility, stopping rule and failure/recovery path.
- Separate mandatory invariants from optional task order. BAs must be able to revisit clarification rather than mechanically advance every stage.
- Map each proposed design principle to prior work, a problem, implementation behaviour and a measurement. Identify what is new, adapted or combined.
- Produce research lifecycle, decision/feedback loop and information-flow diagrams. Keep product architecture as a separate diagram.

**Complete when:** an independent BA can apply the written method to a small case without depending on BA Mate's UI. Freeze this as the evaluation specification, with a change log.

### Step 2 — Audit and connect the artifact model

- Inventory every visible action as implemented, incomplete, demonstration-only or out of scope. Remove or clearly hide nonfunctional controls from the beta experience.
- Establish one canonical representation of requirements, stories and business rules; documents and diagrams refer to identified revisions.
- Unify state transitions and validation across workbench, chat, editors, imports, synchronization and restores.
- Link requirements to stories, acceptance criteria, source passages, decisions, risks and downstream outputs.
- Invalidate dependent approvals and document/diagram embeddings when a source, answer or artifact changes.
- Reject stale responses and synchronization proposals; handle deleted projects, navigation, cancellation and duplicate completion safely.
- Preserve original model output, reviewed revisions, decisions and error categories locally.

**Complete when:** one changed business rule has an explainable impact path through all affected artifacts without silently rewriting a baseline.

### Step 3 — Complete realistic BA journeys

Implement and rehearse a complete vertical workflow: create scope → import/review evidence → identify stakeholders/gaps → record answers → specify/prioritise requirements and NFRs → define acceptance criteria → model the process → review quality and evidence → document → approve → handle change. Change analysis returns to the affected stages for revision, validation and renewed approval. Offer developer handover separately through suitable artifact/export actions.

Support starting from existing requirements/SRS as well as a new brief. Add easy review queues, ordinary BA terminology, visible next actions, batch review where safe, reliable draft recovery and accessible controls. Keep research configuration out of the everyday BA navigation. Allow recording external stakeholder review without pretending that a local role selection proves a verified electronic signature.

**Complete when:** a BA can finish an agreed representative case without developer intervention or copying missing information between disconnected screens.

### Step 4 — Strengthen model orchestration and context

- Use task-specific contracts and explicit evidence selection; handle current goal, approved decisions and relevant prior artifacts consistently.
- Retrieve relevant passages for larger projects, preserving original locations and disclosing omitted/truncated context.
- Distinguish confirmed facts, older contradictions, assumptions and unknowns. Ask clarification when evidence is insufficient.
- Validate schema, identifiers, quoted support, decision consistency, acceptance criteria and Mermaid syntax. A second AI reviewer is advisory, not proof of truth.
- Add cancellation, bounded retry/repair, visible progress, request limits and failure recovery. Never silently switch a study's model.
- Test every task on candidate local and cloud models. Record parameter/context settings, latency, reported usage, failures and BA correction effort.
- Use bounded parallel analysis only for genuinely independent subtasks; merge conflicting findings and preserve the human review boundary. Parallel agents are optional implementation choices, not evidence of novelty.

**Complete when:** supported model profiles have an explicit capability matrix and pass defined task-level checks; unavailable/unsuitable models fail clearly. Do not promise small-model equivalence before measurement.

### Step 5 — Make document generation and synchronization faithful

- Define reviewed structures for SRS, BRD or project brief, user stories/acceptance criteria, traceability matrix and change addendum; prioritise the templates actually needed by the first cohort.
- Generate from canonical artifacts and approved decisions. Mark missing sections, unknown thresholds and unsupported claims explicitly.
- Make document update proposals compare the actual before/after revisions; detect changes between proposal and acceptance.
- Export the selected document/baseline snapshot, with accurate draft/approved status and provenance. Avoid attaching a generic latest-baseline label to mismatched working content.
- Embed actual diagrams, tables and links in DOCX/PDF; include Mermaid code or referenced diagram files in Markdown.
- Fix pagination, long tables, Unicode, long headings, numbering, version history and accessibility. Validate content and rendered output using long representative fixtures.
- Add an export preflight: unresolved blockers, stale embeddings, unreviewed changes and incomplete required sections.

**Complete when:** exported content matches the selected reviewed revision, without lost criteria, placeholder diagrams, clipped text or misleading approval labels.

### Step 6 — Add optional developer handover exports

This is a supporting BA Mate feature planned for beta testers' existing development workflows, not an extra framework stage. A BA can export a suitable document or changed revision when needed, especially an SRS, and can complete the core workflow without using this feature. Clearly distinguish draft packages from approved snapshots; exporting never grants approval. Keep this optional branch separate in the framework and product diagrams.

Offer a ZIP containing a human-readable index and reviewed Markdown specifications, for example:

```text
README.md
scope-and-stakeholders.md
requirements.md
business-rules.md
user-stories-and-acceptance.md
non-functional-requirements.md
data-and-interfaces.md
workflows/*.mmd
traceability.md
open-decisions.md
change-log.md
manifest.json
```

Include stable IDs, linked decisions, exact acceptance criteria, selected baseline/revisions and a clear list of unresolved items. Prefer deterministic conversion from the reviewed model over another unconstrained AI rewrite. Technical architecture/API details must be present and reviewed before inclusion; an SRS alone does not justify inventing them. Treat source documents as reference data, not executable instructions for coding agents. Exclude private source attachments unless the user deliberately includes them.

**Complete when:** a developer can locate each requirement and verification condition, trace it to the selected baseline and identify missing technical decisions without a second elicitation session caused by export omissions.

### Step 7 — Add participant identity and offline behaviour

- Invite individual testers; use a maintained authentication component and a researcher-only administration portal.
- Remove the fixed client-side research-console password as an access-control mechanism.
- Support sign-in/out, recovery, revocation, session expiry and separate researcher permissions.
- Use browser-based native-app sign-in with authorization code/PKCE where supported, and OS credential storage. Do not embed an administrative secret in the desktop package. [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html) describes native-app OAuth requirements.
- Separate participant account identity from research pseudonyms and private workspace content.
- Define cached offline access. Expired sponsorship or an unavailable server should not remove local files or prevent backup/export.
- Local/BYOK work and consent to optional research collection must remain clearly distinguished.

**Complete when:** one tester cannot access another tester's account/research records, sessions recover safely, and offline users retain their work.

### Step 8 — Specify consent and the measurement schema before networking it

Create separate explanations/controls for account operations, optional research participation, cloud AI processing, diagnostic sharing and any optional artifact submission. Align the expanded online collection with the university-approved study protocol and any required amendments.

Allowlisted research fields may include study/run pseudonyms, framework/app/prompt versions, condition, task type, model profile, duration, reported token counts, error codes, acceptance/rejection/edit counts and submitted ratings. Define each measure, including its limitations and denominator. Unknown provider usage remains unavailable rather than zero.

Do not automatically send source text, prompts, model responses, SRS content, names, filenames, file paths, screenshots, keys, arbitrary exception strings, document hashes or the existing whole-workspace export. Generate research-specific random identifiers rather than reusing arbitrary imported project IDs.

Show a preview of submitted fields. Collect ratings separately from optional free-text comments and let participants review comments for sensitive content. Version consent, permit stopping future collection, define withdrawal/deletion and retention, and purge queued unsent records when appropriate. Do not upload historical local telemetry automatically after new consent.

**Complete when:** a network inspection and server schema test demonstrate that forbidden project content cannot enter the ordinary analytics endpoint.

### Step 9 — Implement central research collection and administration

- Create distinct records for accounts, enrollment, consent, studies, runs, metrics, feedback, allowances and releases.
- Use strict payload validation and researcher access controls; separate identity linkage from analysis exports.
- Queue consented events locally when offline; acknowledge uploads, retry safely and deduplicate by event ID.
- Record client event time, server receipt time, version and consent state; show pending/submitted/failed counts to users.
- Avoid project content in logs, crash reports and backups; minimise infrastructure identifiers such as IP retention according to the study design.
- Build a dashboard for participation, completion, usage, failures, ratings and feedback themes, plus reproducible study exports.
- Treat desktop-reported metrics as observations, not tamper-proof billing records. Do not enforce expenditure from client analytics.

**Complete when:** offline/reconnect, repeated submissions, revocation, schema upgrades and researcher exports work with synthetic participants without duplication or content leakage.

### Step 10 — Prioritise personal/local AI; add bounded sponsorship only where needed

Ship personal provider key and local Ollama connections first, with a supported-provider matrix and connection/task checks. Add a research-sponsored connection only for selected participants who need it. Native provider keys require native adapters; explain the difference between a routing-service key and the underlying model provider key. Add capability checks, usage visibility and a clear exhausted-budget path.

For the initial sponsored route, evaluate individually provisioned OpenRouter keys with provider-enforced credit limits. The management credential stays on the research service. OpenRouter documents key creation, revocation and per-key limits in its [management API](https://openrouter.ai/docs/guides/overview/auth/management-api-keys). This is a proposed architecture, not a feature already implemented in BA Mate.

For a small cohort, manually provisioning individually limited credentials is sufficient initially; an automatic funding/billing system is not a prerequisite for a BYOK/local beta. Before funding any participant, agree a total one-month ceiling and an individual ceiling. Use cost caps for researcher expenditure and report tokens where available; tokens have different costs across models. Add total study budget controls, reconciliation, request/rate limits and revocation. A desktop-distributed limited key can be extracted, so its limits must remain effective outside the app. Confirm provider capabilities/terms and endpoint policy before choosing this approach. If stronger per-request policy requires a proxy, disclose the resulting transient content processing.

Use a fixed qualified model profile in controlled comparisons; allow model choice in naturalistic beta work and record it as a contextual factor. Keep sponsored usage access and voluntary feedback permissions distinct.

**Complete when:** personal/local connections pass their cases. For any sponsored participants, an exhausted or revoked allowance cannot continue spending through the app or a copied credential. Fully automated sponsored provisioning can remain a later enhancement.

### Step 11 — Complete installation, updates and support delivery

Prioritise operating systems actually used by the cohort. Build/test each target OS/architecture, sign applicable releases, notarize macOS releases as required and test on clean devices.

Add an authenticated or appropriately public release feed, an update client, release notes and release channels. Electron documents [application updating](https://www.electronjs.org/docs/latest/tutorial/updates); package creation alone does not provide update delivery.

Bundle compatible UI/service versions. Back up before schema migration; test upgrade recovery and define a compatible rollback strategy. Notify, download and install at a safe checkpoint. Freeze builds/prompts within controlled evaluation runs. If an urgent fix requires interruption, record and reschedule the affected run rather than silently mixing treatments.

Create quick-start and full BA manuals, local/cloud connection guides, consent explanation, a sample case with expected outputs, troubleshooting, update/recovery instructions and a private support path. Optional diagnostic attachments require preview; do not automatically attach company projects.

**Complete when:** a fresh participant can install, sign in, connect, complete a sample case, export, restart and upgrade without losing work or receiving a different study version unexpectedly.

### Step 12 — Conduct a small formative rehearsal before general circulation

Use a small invited subset first; select the number based on available support rather than treating it as a statistical sample requirement. Exercise new discovery, existing-SRS improvement and a post-baseline change. Include poor network, exhausted allowance, unavailable model, confidential local-only data, long documents and interrupted updates.

Record defects and usability friction separately from outcome measurements. Revise the framework only where observations justify it, with a mechanism → evidence → change explanation. Freeze the repaired evaluation version before widening the cohort.

**Complete when:** all agreed critical journeys pass, no known data-loss/access/content-leak defects remain, and pilot participants can complete the sample with the manual.

### Step 13 — Run controlled comparisons and naturalistic beta use

- Define A: manual BA; B: generic AI assistance; C: proposed framework, with a precise treatment description and shared minimum protections.
- The present in-app Generic AI mode shares the structured evidence/review interface and mostly changes prompting. It cannot on its own isolate the entire framework effect. Decide whether the primary claim concerns guidance, particular mechanisms or the complete workflow/tool experience, then match the comparison design.
- Use comparable cases and counterbalanced order where practical; separate familiarisation from measured work. Keep model/profile and resources comparable for B/C when estimating a workflow effect.
- Measure blinded expert-rated correctness, completeness, consistency, testability and semantic traceability on controlled, shareable artifacts. Measure time-to-acceptable-output and correction effort, not only API latency. Record usability, perceived usefulness and confidence as distinct measures.
- With private company work, collect experience measures and optionally local expert scores. Objective correctness cannot be inferred from clicks, acceptance rates or model confidence. Sharing content for expert review needs a separate agreed process.
- Treat repeated tasks as nested within participants/cases; define the analysis, missing-data handling, effect estimates and uncertainty before confirmatory collection. A small beta supports formative/exploratory findings and does not automatically establish broad generalisability.
- Assess small versus stronger models as a separate planned comparison unless the available sample supports the additional factors. Keep developer rehearsals, survey responses, beta sessions and interviews identifiable as different evidence sources.
- Interview participants using their observed friction, corrections and adoption concerns; document disconfirming findings as well as benefits.

**Complete when:** data provenance, conditions, versions, rater process, exclusions and limitations are sufficiently clear for another researcher to understand the conclusions.

### Step 14 — Refine and publish the transferable contribution

Produce the final framework specification, diagrams, design principles, evaluation report, anonymised/shareable research outputs as appropriate, limitations, revised prototype and user documentation.

Create portable workflow instructions, schemas, examples and SKILL.md adaptations from the evaluated mechanism. Validate each host-tool adaptation; a skill does not automatically reproduce BA Mate's storage, approval gates or privacy controls. Plugins/integrations can follow as separate implementations of the same documented knowledge. Decide licensing and distribution scope with the relevant university/organisational requirements before publication.

**Complete when:** the contribution can be explained and reused independently of the prototype, with an honest account of what was evaluated and where applicability remains uncertain.

## 5. Delivery sequence and scope control

Recommended order: **framework/treatment specification and shared-hosting feasibility → connected artifact logic → faithful document exports and optional handover capability → model qualification → identity/consent/central collection → optional limited sponsorship → installer/updates/manuals → small rehearsal → broader beta and controlled study → final knowledge artifacts.** This is the project delivery sequence, not the framework's BA lifecycle.

Some infrastructure work can proceed alongside domain work after the data/consent contracts are fixed. Account screens alone do not make the BA workflow ready; a polished SRS export alone does not make research collection ready. Both must pass their release gates.

Before broad beta, require the core journeys, faithful exports, participant access, consent/data minimisation, central submission, local/BYOK connections, qualified model profiles, platform installation, safe update path, manuals and a frozen evaluation protocol. Include and verify the optional developer handover capability for the cohort, while never requiring a participant to use it to complete BA work. Sponsored limits must be verified before issuing any funded access, but automated sponsorship is not required to circulate a personal/local beta. Defer full real-time collaboration, enterprise SSO, large plugin marketplaces, extensive integrations, model hosting/training and broad multi-agent automation unless a specific evaluated mechanism requires them.

## Suggested one-month participant-use sequence

After readiness gates pass, an indicative month is: week 1 onboarding and supervised sample cases; weeks 2–3 real-work beta use and scheduled controlled tasks; week 4 follow-up interviews, outstanding feedback and closing exports. Adjust scheduling to participant availability. Prepare consent and case assignments before the month begins. Keep experimental versions fixed within each comparison block; classify defect-driven repetitions explicitly.

The implementation and small internal rehearsal must precede this month. This schedule is a discussion proposal rather than a guarantee that the remaining software can be completed in a particular number of days.

## 6. Decisions needed for the implementation plan

- Organisation installation restrictions and the Windows/macOS versions/CPU architectures; both operating-system families are confirmed.
- Optional total and individual sponsored-AI caps; actual Register.lk Core account capacity, HTTPS/runtime configuration, backup/recovery and installer-download permission/limits for bamate.csbodima.lk. Provider and PHP/MySQL availability are user-confirmed; deployment is pending. No separate VPS or inference server is planned.
- Priority BA document templates and one representative case with agreed expected outputs.
- Main research claim and A/B/C treatment definitions; mechanism-level versus whole-workflow comparison.
- Approved consent/retention/withdrawal arrangements for the new central service.

These decisions affect sequencing and cost. No firm completion date should be promised before the feature inventory, representative cases and platform constraints are agreed.

## 7. Technical starting points for the next implementation pass

- `frontend/src/workflow.ts`, `store.ts`, `connected.tsx`: canonical revisions, cross-artifact updates, document sync and approval consistency.
- `frontend/src/exporters.ts`: content fidelity, selected-baseline export, real diagrams, pagination and developer handover.
- `frontend/src/modelGateway.ts`, `WorkflowWorkbench.tsx`, `backend/app/workflow.py`: context selection, task orchestration and failure/review contracts.
- `frontend/src/research.ts` and App research views: replace the local password boundary; separate participant feedback from researcher administration; introduce strict consented upload schemas.
- `backend/app/main.py`: retain the local service boundary; implement remote research services separately.
- `desktop/main.cjs`, package/build scripts: identity callback integration, credential storage, signed releases, updater and migration lifecycle.
