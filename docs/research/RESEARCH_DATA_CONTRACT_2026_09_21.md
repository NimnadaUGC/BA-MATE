# BA Mate consent and permitted-measurement contract — 2026-09-21

Status: implementation contract for B09–B11. It must be approved with the research protocol/ethics materials before any real collection is enabled.

## Separate boundaries

- **Local workspace:** private BA projects, evidence, filenames, prompts, documents, AI responses, backups and provider keys. These never enter the upload serializer.
- **Account identity:** email, password hash, invitation and recovery/session records. Stored only in the account tables.
- **Research record:** study pseudonym and allowlisted measurements. The collection database has no project identifier or workspace payload.

Participation is optional. Without consent, a participant may create, edit, save, export and back up local BA work; the only disabled function is remote research collection.

## Allowed upload fields

| Field | Purpose | Source | Consent | Retention / missing rule |
|---|---|---|---|---|
| schema, batch ID, event ID | Validate version and deduplicate retries | App-generated random identifiers | Active consent | Retain per approved schedule; duplicates are not copied |
| study pseudonym | Link a record to assigned study condition without sending identity | Server-issued identity mapping | Active consent | Mapping access restricted; no local project ID |
| consent version | Prove which information sheet/consent applied | Explicit participant action | Explicit versioned consent | Retain with record |
| occurred time, stage, category, outcome, duration | Measure task timing/failure category | Instrument event | Active consent | Duration may be absent; absent is not zero |
| run code, condition | Associate result with the frozen evaluation condition | Assigned run | Active consent | Run code is random and not a project identifier |
| application, framework, dataset, prompt, model-profile versions | Reproducibility | Frozen run configuration | Active consent | Missing model usage/cost remains unavailable, not zero |
| ratings and task-completed flag | Participant self-report | Explicit stage form submission | Active consent | Each optional rating remains missing when not submitted |
| independent quality and correction effort | Researcher rubric assessment | Protected researcher form, tied to an accepted pseudonymous run and fixed instrument version | Approved assessment procedure | Never inferred from self-ratings; correction effort may remain missing, never zero |
| optional free-text feedback | Usability feedback | Separate preview-confirmed participant submission | Separate explicit confirmation | Review separately for accidental confidential information |

Independently assessed quality/correction effort is recorded through the approved scoring instrument in a protected `quality_assessments` record, not inferred from self-ratings or uploaded as a hidden analytics field.

## Explicit exclusions

The upload schema and server reject project IDs/names, company identifiers, sources, source text, filenames/paths, documents, requirements, diagrams, prompts, model responses, original evidence, content hashes, credentials, API keys, database credentials and arbitrary diagnostics. The old local research JSON export is not an upload format.

## Consent, withdrawal and offline queue

Consent has a version and an active/withdrawn state. The desktop may queue only allowlisted batches while consent is active, displays its queue/sync state, and rechecks account/consent status on reconnect. Withdrawal stops new uploads and discards unsent local batches; it never deletes local projects or backups. The approved protocol must specify server-side retention/deletion handling for already accepted records.

The service has short authenticated sessions and a documented offline-grace timestamp. Expiry, revocation or lack of network must not block local BA work. It only stops collection until an authorised session and active consent are re-established.

## Version manifest

Each run record must tie the following fixed identifiers together: application build, framework, consent version, protocol/instrument, task case, prompt-schema version, provider/model profile and research condition. The upload field names are `app`, `framework`, `protocol`, `instrument`, `task_case`, `prompt_schema` and `model_profile`; all are required for every accepted measurement. A configuration change creates a new run profile; it must not silently replace a frozen comparison configuration.
