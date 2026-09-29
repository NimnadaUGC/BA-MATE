# Local pilot guide — BA Mate 0.4

This release is a working local research beta. Complete a synthetic rehearsal before inviting participants. Keep the research framework version, application version and prompt version fixed within a comparison round. Record any later change as a new iteration.

The interface now enforces the six workflow stages, goal-scoped approved baselines and evaluated-stage feedback. Approval roles remain a local workflow convention rather than verified external identity. Use **Beta guide** in the main navigation for the participant-facing orientation and this document for installation and study administration.

## Installation

A native Apple Silicon macOS build is produced in `release/mac-arm64/BA Mate.app`. It bundles the Python service and interface. It does not bundle Ollama, model weights, cloud credentials, participant data or research results. The current build is unsigned and has not been notarized. Test signing and clean-device installation before distributing it publicly. Windows and Linux packaging definitions exist but their builds need validation on those platforms.

For the source-based browser edition, install Python 3.10+ and Node.js compatible with the pinned Vite release (Node 22.12+), then run from the BA_MATE folder:

```sh
python3 start.py --setup
python3 start.py
```

On Windows use `py` instead of `python3`. After setup, the supplied Start BA Mate launcher also works. Keep its service window open during a session. A port conflict can be avoided with `python3 start.py --port 8001`. In development, keep the interface server on port 5173 and backend on 8000, or set `VITE_BA_MATE_API_URL` when building.

The workspace is stored in `~/.ba-mate/workspace.sqlite3`; managed project folders are created in `~/.ba-mate/projects`, and connection settings are in `~/.ba-mate/provider.json`. A selected project folder is used directly. Uploaded originals are copied into that folder's `sources` directory, including relative subfolders when a folder of files is imported. `BA_MATE_DATA_DIR` selects a different managed data folder. Wait for “Saved on this device” before closing. In **Settings → Local data**, choose a project and use **Export project backup** to create a private ZIP. **Restore project backup** validates the ZIP and adds it as a separate local project; it never overwrites the current workspace. Content backups are private. The current research JSON still needs identifier/metadata review and is not an approved anonymous central-upload format.

To build native packages on a matching OS and CPU architecture:

```sh
python3 scripts/build_desktop.py
```

Code signing, notarization, application branding and clean-device platform verification remain release work. The desktop shell uses a separate renderer without Node access, context isolation and sandboxing, following [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security). These settings do not establish a complete security audit.

## Connect a model

Install/start Ollama separately and download a model appropriate for the device. Enter an installed identifier in Settings → AI connection. The existing Qwen2.5 3B model was used for the integration rehearsal; it is not a validated research recommendation. Qwen3 8B is an editable default, not an automatically installed dependency. Larger models and longer context windows require more memory; measure latency and task success on the actual test hardware.

Alternatively choose native OpenAI, native Gemini, OpenRouter or Hugging Face, enter an available model identifier and the matching provider key, and save/test the connection. An OpenAI Platform API key is separate from a ChatGPT subscription; a Gemini key is created through Google AI Studio or its associated Google Cloud project. Native provider keys are not interchangeable with OpenRouter or Hugging Face credentials. Enable external processing for the project only when appropriate for the material and organisation. Confidential projects cannot use external inference. Keys entered in Settings disappear when the service closes. No cost guarantee is provided: quotas, billing and model availability must be checked with the provider. Use individual restricted/capped credentials rather than a shared unrestricted research key. A successful connection test is followed by the complete synthetic qualification and human review before participant use.

The agreed deployment uses existing Register.lk Core shared hosting for a small PHP/MySQL account/research service, guides and permitted installer delivery. See the [hosting plan](hosting/SHARED_HOSTING_PLAN.md); no separate VPS or researcher-hosted model is planned. The desktop's local service remains on the participant's computer and must not be exposed as the public service. Local Ollama or the participant's selected provider handles inference.

## Rehearsal workflow

1. Open **Beta guide**, then create a new project and goal using a synthetic business case. New projects start without demonstration artifacts.
2. Import PDF, DOCX, text, Markdown, CSV, JSON or Excel material, or attach common image, audio and video files. Inspect extracted text, original download and extraction limitations. Media and scanned PDFs are preserved but cannot be approved as searchable evidence until a transcription or OCR copy is supplied.
3. Use “Find gaps and ask questions”. Review the questions and add selected items. Record actual stakeholder answers; never treat model suggestions as answers.
4. Draft requirements/stories. Compare against the recorded answers beside the proposal. Correct wording and evidence IDs. Accept only selected supported items. Original output and human edits remain separately recorded.
5. Review working artifacts, acceptance criteria and trace links. AI-generated links begin as Pending. Mark them Verified only after checking semantic support. Address blocking questions and findings.
6. Try diagram, document, quality-review and change-impact tasks. The proposal includes a diagram preview. Mermaid syntax is checked before offering a diagram, but its business meaning still requires BA review.
7. Use the completion checklist in **Guided workflow**. It links directly to missing work and prevents moving to the next stage until the current outcome is complete. During an evaluation run, submit **Stage evaluation** before advancing.
8. Submit requirements, stories and documents for review. After Validate is complete, create the baseline from **History & approved versions**. Baseline approval requires authority, no blockers, reviewed statuses and a verified evidence path for every requirement/story. The local role is a workflow convention, not verified stakeholder identity. Record stakeholder agreement separately according to the study protocol.
9. Alter a linked clarification answer and confirm dependent approvals/trace links require revalidation. Restore a snapshot and confirm content returns as drafts while a recovery snapshot preserves the previous work.
10. Export a full project ZIP from **Settings → Local data**, restore it as a new project, and compare sources, answers, artifacts and history. External processing is disabled on import. This remains an implementation acceptance check before real participant work.

## Research controls

Use pseudonymous participant/case codes and a separate approved mapping outside the app. Prepare the condition and model settings in Research console. Manual runs disable AI within that project's interface; external AI use still requires protocol control. Only one evaluation is active at a time. Model configuration changes invalidate a newly prepared AI run until the settings are restored or the run is recreated.

The built-in Generic AI condition shares evidence, schema, manual-review controls and the app interface with the framework condition. It compares the guidance within this environment. It cannot alone support a claim that the entire framework outperforms unrestricted generic chat. Define the external/manual comparison, matched tasks, order allocation, training time and quality rubric before collecting confirmatory measurements.

Foreground session time is observed application time, not automatically pure productive effort. Self-rated accuracy and confidence are perceptions, not objective correctness. Use blinded BA ratings of de-identified outputs for correctness, completeness, testability and semantic traceability; record correction effort and failures. Keep synthetic developer checks separate from participant results. With a small beta group, avoid treating multiple tasks from one participant as independent people.

Prioritise usability and defect discovery in the first pilot. Do not assume refinement will be minor; failures may require changes to the mechanism, interface, model choice or evaluation design. Freeze the revised version before the next measurement round.

## Remaining release boundaries

- Public authenticated collaboration, role enforcement across separate accounts, invitations and external project-management integrations remain outside this local release.
- No OCR, speech transcription or hosted model provisioning is implemented.
- Source/identifier checks and quantity reminders do not establish factual correctness, compliance or absence of hallucination.
- Baselines are immutable through the normal application update path; SQLite and ZIP files are not cryptographically tamper-evident records.
- Large workspaces still serialize whole-project source contents. Establish practical size/performance limits during rehearsal.
- Cloud adapters need live tests with researcher-selected credentials; Windows/Linux and signed macOS distributions need release testing.
