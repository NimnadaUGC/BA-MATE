# BA Mate Beta Testing and Recovery
Application guide 3 | BA-MATE 1.0.0-beta.3 | 1 November 2026

Use this guide to protect your local work, recover a project and give useful beta feedback. Guide 1 covers installation and AI setup; Guide 2 covers the complete workflow. Start with fictional practice data before using material approved for a formal research task.

## In this guide
- Saving and local storage — page 2
- Project backup and restore — page 3
- Troubleshooting — page 4
- Workspace navigation reference — page 5
- Beta checks and feedback — page 6

## Agree the testing boundary
The beta.3 preview is intended for a small supervised Apple Silicon Mac beta. It is unsigned and not notarised; clean-device installation and Windows distribution remain unqualified. Use the exact candidate and model profile assigned by the researcher so your observations can be interpreted correctly.

For familiarisation, work through the fictional checkout example in Guide 2. For a formal study, use the assigned task and stopping point. Do not change comparison conditions, run AI during a Manual condition, or substitute practice answers for stakeholder evidence.

**Protect real material.** Confirm project permission and source classification before AI processing. Do not put API keys, identifiable participant data or client source text into feedback. A backup can contain source originals and sensitive project records; share it only through the agreed authorised route.

## Know what is local
The application service saves work on this computer. Ordinary local use does not enrol you in a study or create an online account. The shipped candidate has no connected research service. The Study participation screen explains that unconnected state; do not invent an endpoint or enter unrelated credentials.

**When something goes wrong.** Stop repeating the failing action. Keep the app open if it contains unsaved work, capture the message and follow the relevant recovery step. Avoid reset or deletion while diagnosing a problem.

<!-- page -->
## Saving and local storage
**Check:** Wait for Saved on this device before closing the app or service.

Workspace records are persisted by the local BA Mate service. The project folder contains source material; it is not the whole workspace. Keep both concepts separate when arranging backup or moving to another computer.

| Location or record | What it holds |
| --- | --- |
| ~/.ba-mate/workspace.sqlite3 | Default local workspace database for your operating-system account. |
| ~/.ba-mate/provider.json | Saved provider settings without keys entered in the UI. |
| ~/.ba-mate/projects/ | Default managed project folders; selected existing folders remain at their chosen location. |
| Project folder / Uploaded Sources | Default destination for files copied during project creation; the actual folder can differ if configured. |
| Project backup ZIP | Portable project package with available originals, records, audit history and baselines. |

Here **~** means your user home directory. On Windows the default base is your user profile's **.ba-mate** folder. A researcher-managed **BA_MATE_DATA_DIR** override can change the base path; confirm it with the researcher rather than searching another person's directory. Do not edit database or provider files by hand.

## Saving is different from approving
**Saved on this device** means the workspace revision was saved locally. A draft remains a draft. **Create snapshot** records a workspace checkpoint; **Approve new baseline** records an authorised locked set of artifact revisions. Neither substitutes for a portable project backup.

Unsent chat messages, temporary assistant state and some open editor drafts can remain in memory. Save or submit edits using the screen's own controls before leaving, and copy essential unsent text to a safe note before reloading. Unsaved connection settings stay during in-app navigation but must be saved before qualification.

**Persistent save error.** Keep working is the safe choice in a close warning while you try to save. Follow any recovery ZIP option the app offers; it may contain records without originals. Preserve it, note its limitations and use page 3 before relying on the recovered project. Do not choose Close without latest changes unless you accept losing those edits.

<!-- page -->
## Project backup and restore
**Path:** Global sidebar → Settings → Local data

1. Finish editing, wait for **Saved on this device**, then choose the correct project in **Project for backup**. Choose **Export project backup** and save the ZIP outside the working project folder, using a name that identifies the project and date.
2. Read any warning about unavailable source originals. A records-only package cannot recreate missing source files. Preserve originals separately if they could not be included, and do not assume an incomplete backup is fully recoverable.
3. To test recovery, choose **Restore project backup** and select the exported ZIP. The app validates the package and adds a separate restored project. It does not overwrite your current project. Avoid uploading the ZIP as a source file.
4. Open the restored project. Check source availability and extraction, goal history, requirement and document content, baselines and saved conversations. Reconnect matching missing originals through Sources, then review affected evidence and select current reviewed sources for any active goal.
5. Re-enter an API key if needed after restarting the local service. Backup packages do not carry UI-entered API credentials. External AI permission is disabled on restore; authorise it again in Project settings only if appropriate. Keep the original project until you have verified the restored copy.

**Expected result.** The restored project appears separately and contains the expected work. Repeat a small read-only check after a clean app/service restart to confirm persistence. A successful ZIP validation alone does not prove every needed original was available.

## Choose the right export
| Control | Use it for |
| --- | --- |
| Export project backup | Routine portable recovery through Restore project backup. |
| Export local backup | Workspace JSON for broader records/diagnostics. It is not a project ZIP and has no equivalent routine project-restore path here; consult the researcher for recovery. |
| Document or diagram export | Sharing a deliverable for reading. It does not preserve the project's full evidence and history. |

**Before updating.** Export and verify project backups, quit the app, then replace it only with the release supplied by the researcher. Do not downgrade a live workspace without an agreed recovery plan. Reset demonstration data replaces local work and research observations; it is not a repair command.

<!-- page -->
## Troubleshooting
Record the exact action and message before changing settings. Use fictional data when reproducing a problem. If a suggested step fails, preserve the evidence and contact the researcher through the agreed route.

| Symptom | Next action |
| --- | --- |
| Mac will not open the app | Follow Guide 1 page 2. For a malware, damaged-app or policy warning, stop; do not disable security controls. |
| App waits for its service or shows a service error | Check whether another BA Mate instance is running. Preserve unsaved text before reopening. For source mode, read the launcher terminal and confirm the intended port. |
| Source setup fails or port 8000 is busy | Check Python and Node versions and the setup error. Use the existing session or the explicit alternative port in Guide 1; keep its terminal open. |
| AI returns 401, 403 or missing-key error | Check provider, key, model access and session state. Re-enter the correct provider's key after service restart; test the connection. Never paste the key into feedback. |
| Rate limit, credits, timeout or invalid proposal | Check provider availability/credits. Narrow the task, inspect output/context limits and retry once appropriate. Local model speed and memory matter. Continue manually if needed. |
| External AI is blocked | Check Project settings → Project AI processing and source classification. Confidential context requires approved local processing. Do not bypass classification. |
| Source is missing, stale or incomplete | Reconnect the matching original, compare extraction, accept the current revision and reselect it for the goal. Scans/media may need a reviewed text source. |
| Cannot advance, approve or complete | Open Guided workflow and the cited record. Check current sources, actual answers, criteria, verified links, review statuses, authority, embeds and change revalidation. |
| Patch or SRS update is stale | Prepare a fresh proposal against the current artifact and target revision. Inspect the replacement; never force an older edit onto newer work. |
| Saving fails or a backup lacks originals | Keep the session open; follow pages 2 and 3. Preserve any recovery package and obtain missing originals before relying on it. |

**Layout or keyboard issue.** Record your window size or zoom, screen name and whether Tab, Escape or a mouse action failed. Try normal zoom and a larger window while preserving the original reproduction steps. The native window has a minimum size; narrower browser layouts do not qualify a separate mobile app.

<!-- page -->
## Workspace navigation reference
Use the sidebar groups below. On compact layouts, open the navigation menu first. The top-bar project and goal identify the current scope. **Recent work** is a shortcut, not a backup.

| Sidebar location | Purpose |
| --- | --- |
| Projects / Recent work | Open or create a project; return to recent records. |
| Templates | Preview available templates before using one for a deliverable. |
| Beta guide | In-app orientation and beta guidance. |
| Study participation | Research connection and participation state; this release is unconnected. |
| Settings | AI connection, qualification, local data and backup. |
| Overview | Project summary and current work. |
| Guided workflow | Six-stage readiness, clarifications and Task AI. |
| Project materials → Sources | Originals, extraction, review and goal selection. |
| Project materials → Requirements & stories | Artifact editing, selection, review and SRS synchronisation. |
| Project materials → Registers | Stakeholders, assumptions, decisions, risks and issues. |
| Deliverables → Diagrams / Documents | Process representations, SRS content, comments and revision review. |
| Review & approval → Evidence links | Traceability and current evidence review. |
| Review & approval → Changes & impact | Impact analysis, replacement patches and revalidation. |
| Review & approval → Checks & safeguards | Governance context, quality findings and blocking issues. |
| Review & approval → History & approved versions | Activity, snapshots and approved baseline manifests. |
| More tools → Goals / Ask BA Mate | Goal scope/completion; saved project conversations. |
| More tools → Project settings | Local members, approval authority and project AI permission. |

**Stage evaluation** appears when a research evaluation run is active. Follow the assigned protocol rather than creating one for ordinary familiarisation. In tabs, use arrow keys, Home and End where supported. Escape closes the topmost dialog; it should return focus to its opening control. Report controls that are unreachable or lose your draft.

<!-- page -->
## Beta checks and feedback
For a practice run, use Guide 2 and record Pass, Issue or Not tested for each check. Pause at the researcher's assigned stopping point during a formal session.

| Practice check | Evidence to inspect |
| --- | --- |
| Install and connect | Correct beta.3 version, working Settings, connection result. |
| Set up evidence | Separate practice project, active goal, reviewed and selected source. |
| Clarify and define | Named stakeholders, explicitly fictional confirmed answer, testable criteria. |
| Validate and approve | Current verified evidence, reviewed SRS/process and locked B1; keep the goal active for the next check. |
| Controlled change | Implemented 500-to-300 change, revalidation, B2, unchanged B1 and completed goal. |
| Save and recover | Work survives reopening; ZIP restores a separate project with checked originals. |
| Everyday access | Chat context picker, selection, status actions, dialogs and keyboard remain usable. |

## Send an actionable report
Use the feedback route supplied by the researcher; this release does not define a public submission address. Include:

- **Environment:** app version, operating system, native or source mode, provider/model and approximate window size or zoom. Never include the API key.
- **Location and steps:** sidebar path, goal stage and the smallest sequence that reproduces the issue. Use safe record IDs or fictional examples.
- **Expected and actual result:** what you intended, what appeared, exact error text, whether work was saved and how often it happened.
- **Impact and evidence:** whether you could continue, whether data was affected, and a redacted screenshot if useful. Record time spent or correction counts only as instructed; do not invent precision.

**Formal participation.** Consent, participant code, study condition and submission are separate from local project roles and practice use. Follow the assigned research protocol. Do not upload client data or a complete backup simply because a feedback form accepts attachments.

**Finish the session.** Save work, export the required project backup, verify that no unsent text needs preserving and quit the app or stop the source service. Keep the beta package and feedback together so the researcher can reproduce version-specific issues.
