# BA Mate — standalone research application

**Current source candidate, 1 November 2026: v1.0.0-beta.3**, targeting BA-MATE v1.0.0 alongside BA-MATE-SKILL v1.0.5 and F4-draft.1 v1.0.0. The [final UI/UX polish record](docs/audit/FINAL_UI_POLISH_2026_11_01.md) covers the enabled screens, dialogs, responsive checks, essential repairs and final native verification. The unsigned Apple Silicon preview is `release/final-polish-1.0.0-beta.3-20261101/mac-arm64/BA Mate.app`. The actual native preview was opened with matching app/service versions and final production assets, preserving all existing projects. Clean-device installation and cross-platform distribution remain unqualified. The [beta.2 core workflow run](docs/audit/NATIVE_BETA_E2E_2026_10_31.md), [beta.1 pass](docs/audit/CORE_BETA_PLAN_2026_10_31.md) and earlier packages are historical.

BA Mate implements a human-governed business-analysis workflow for evaluating the proposed research framework. It connects to native OpenAI and Gemini APIs, Ollama, OpenRouter, or Hugging Face inference. Model output is proposed for BA review; accepted items become drafts, with final approval handled separately.

The core path includes reviewed source extraction, clarification answers, requirements/stories, Mermaid proposals, document sections, quality and impact findings, revision-pinned traceability, content snapshots and local SQLite persistence. New projects create a managed local directory unless the user chooses an existing directory; uploaded originals are copied into its `sources` subdirectory. PDF, DOCX, text, Markdown, CSV, JSON and Excel files are extracted when readable, while common image, audio and video originals are preserved with an explicit transcription/OCR limitation. Settings provides project ZIP backup and restore; restore validates a package and adds a separate local project rather than overwriting current work. Research records distinguish manual, generic-prompt AI and framework-prompt AI conditions. The prototype is not evidence that the framework is already valid.

**Readiness, 28 September 2026:** the governed workflow, controlled changes, document history and local persistence repairs are implemented. The beta interface now adds enforceable stage-completion checklists, simplified navigation, local typography and participant guidance. Complete the distribution and clean-device checks in the [UI/UX implementation record](docs/audit/UI_UX_IMPLEMENTATION_PLAN_2026_09_28.md) before issuing a public build.

## Start

```sh
python3 start.py --setup
python3 start.py
```

Python 3.10+ and a supported Node.js release (22.12+ on Node 22, or Node 24 or newer) are needed for source setup. On Windows use `py`. Configure an installed local model or a provider key in Settings; model weights and keys are not included. After setup, the included Start BA Mate launcher opens the browser edition.

An older unsigned Apple Silicon pilot build may be present at `release/mac-arm64/BA Mate.app`. It predates the current audit changes and must not be treated as the tested current application. Rebuild and qualify a new package before sharing it with testers.

## Read before the pilot

- [Application installation, complete workflow and recovery guides for beta testers](docs/user_guides/README.md)
- [Current research contribution, framework and evaluation pack](../RESEARCH_INDEX.md)
- [Register.lk Core hosting plan and account checklist](docs/hosting/SHARED_HOSTING_PLAN.md)
- [Feature audit and current verification](docs/audit/FEATURE_AUDIT_2026_09_21.md)
- [Prioritised repairs and beta acceptance criteria](docs/audit/IMPLEMENTATION_BACKLOG.md)
- [Installation, rehearsal and study boundaries](docs/PILOT_GUIDE.md)
- [Model connection contract and known model-quality findings](docs/MODEL_INTEGRATION_HANDOFF.md)
- [Framework and application diagrams](docs/Diagrams/README.md)
- [Implementation verification record](docs/history/v0.4/VERIFICATION_0_4.md)

The local service is required. It binds to loopback and is not suitable for public multi-user hosting. Cloud provider calls require project permission; confidential context is restricted to local inference. Old mock endpoints have been retired.

## Development checks

```sh
cd frontend
npx tsc --noEmit
npm test
npm run build
```

```sh
cd backend
.venv/bin/python -m unittest discover -s tests -v
```

Build a native package on its target platform with `python3 scripts/build_desktop.py`. Each build uses a new timestamped directory under `release`; use `--output` to choose a new directory and `--dir` for an unpacked application. The build refreshes frontend and desktop dependencies and rebuilds the frontend; use a separate checkout if those local files must be preserved. Existing diagram versions and historical mock QA documents are retained for provenance; they do not describe current model behaviour.
