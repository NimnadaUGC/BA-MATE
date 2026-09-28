# BA Mate — local research pilot 0.4

BA Mate implements a human-governed business-analysis workflow for evaluating the proposed research framework. It connects to native OpenAI and Gemini APIs, Ollama, OpenRouter, or Hugging Face inference. Model output is proposed for BA review; accepted items become drafts, with final approval handled separately.

The core path includes reviewed source extraction, clarification answers, requirements/stories, Mermaid proposals, document sections, quality and impact findings, revision-pinned traceability, content snapshots and local SQLite persistence. Settings provides project ZIP backup and restore; restore validates a package and adds a separate local project rather than overwriting current work. Research records distinguish manual, generic-prompt AI and framework-prompt AI conditions. The prototype is not evidence that the framework is already valid.

**Readiness, 21 September 2026:** the [current audit](docs/audit/FEATURE_AUDIT_2026_09_21.md) found critical approval, synchronization, change and document-undo gaps. Use synthetic developer rehearsals until the documented release gates pass; this is not yet the intended real-work beta.

## Start

```sh
python3 start.py --setup
python3 start.py
```

Python 3.10+ and Node 22.12+ are needed for source setup. On Windows use `py`. Configure an installed local model or a provider key in Settings; model weights and keys are not included. After setup, the included Start BA Mate launcher opens the browser edition.

The Apple Silicon desktop package is built into `release/mac-arm64/BA Mate.app`. It bundles the service and frontend. This is an unsigned local pilot build, not a signed public release.

## Read before the pilot

- [Current research contribution, framework and evaluation pack](../RESEARCH_INDEX.md)
- [Register.lk Core hosting plan and account checklist](docs/hosting/SHARED_HOSTING_PLAN.md)
- [Feature audit and current verification](docs/audit/FEATURE_AUDIT_2026_09_21.md)
- [Prioritised repairs and beta acceptance criteria](docs/audit/IMPLEMENTATION_BACKLOG.md)
- [Installation, rehearsal and study boundaries](docs/PILOT_GUIDE.md)
- [Model connection contract and known model-quality findings](docs/MODEL_INTEGRATION_HANDOFF.md)
- [Framework and application diagrams](docs/BA_MATE_FRAMEWORK_DIAGRAM.md)
- [Implementation verification record](docs/VERIFICATION_0_4.md)

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

Build a native package on its target platform with `python3 scripts/build_desktop.py`. Existing diagram versions and historical mock QA documents are retained for provenance; they do not describe current model behaviour.
