# Application guide verification

Edition: **BA-MATE 1.0.0-beta.3**, **1 November 2026**. Companion versions: BA-MATE-SKILL v1.0.5 and F4-draft.1 (v1.0.0).

## Requirement coverage

| Requested coverage | Published location | Application evidence reviewed |
| --- | --- | --- |
| Installation and first launch | Guide 1 pages 1–3 | `desktop/main.cjs`, `start.py`, current release audit |
| AI connection and configuration | Guide 1 pages 4–7 | `ModelSettings.tsx`, `runtime.py`, official provider setup references |
| Project paths and knowledge base | Guide 2 pages 2–3; Guide 3 page 2 | Project wizard, `workspaceFiles.ts`, `project_files.py`, `persistence.py` |
| Complete six-stage workflow | Guide 2 pages 1–9 | `workflowReadiness.ts`, `App.tsx`, `store.ts`, native workflow record |
| Clarification and human review | Guide 2 pages 4–6 | Clarification controls, `WorkflowWorkbench.tsx`, artifact approval guards |
| Documents and diagrams | Guide 2 pages 7–9 | `connected.tsx`, document sync/export controls, `controlledChanges.ts` |
| Baselines and later changes | Guide 2 pages 9–10 | Baseline manifest/approval, patch targets/criteria and revalidation policy |
| Chat access, mentions and selection | Guide 2 page 11 | Assistant/saved conversation controls, artifact selection toolbar, final UI audit |
| Saving, backup and restore | Guide 3 pages 2–3 | Save/recovery banner, ZIP export/restore controls and restore processing-permission reset |
| Navigation, troubleshooting and stopping points | Guide 3 pages 4–6; checkpoints throughout | Enabled navigation groups, app error/review controls and unconnected study state |
| Reference theme and document style | All three guides | SKILL Getting Started DOCX; Framework Diagram Guide style and structure |

Source paths in this table are relative to the application backend/frontend directories as expanded in [the source index](README.md). This publication pass checked instructions against the current code and the existing native/UI evidence; it did not repeat clean-device installation, model qualification or a new participant session.

## Publication checks completed

- Three final Word editions and three matching PDFs: **7, 11 and 6 pages**, **24 pages total**.
- Every rendered page visually inspected. Revisions corrected blank cover-following pages, a wrapped Windows command, a cross-guide link and the position of the approval checkpoint. The practice sequence keeps the goal active between B1 and B2, matching the native workflow record; the importable brief excludes the later confirmation/change answers. Latest changed pages were inspected again; other final page images matched the inspected versions byte for byte.
- Canonical DOCX rendering and retained-reference/final visual diffs completed. App-specific content and pagination differ intentionally; A4 section geometry, typography and recurring design components remain source-derived.
- Nine template font/style/theme/media package parts per Word document preserved byte for byte; original numbering definitions retained. Retained reference SHA-256 unchanged.
- All **406 source lines/cells** checked for text coverage in DOCX XML and rendered PDF text, after Markdown formatting removal and whitespace normalisation. PDF extraction can place arrow glyphs at line ends; the comparison omits those glyphs, whose visual positions were inspected.
- Topic headings appear on their stated pages. Internal link targets, PDF destinations, heading bookmarks, repeatable table headers, logo alt text, A4 page bounds, updating page fields and cached page totals checked.
- Final document XML and guide text checked for credential-like strings and private home paths. No API key or real participant record is part of the guide pack.
- Local index links and the application README guide link checked. Application source code and reference guides were not changed by this publication work.

File hashes, source hashes, page counts and per-guide checks are recorded in [build-manifest.json](build-manifest.json). Rendering evidence remains in the application's ignored `tmp/user-guides-20261101` directory rather than the tester folder.

## Distribution boundary retained

The guides explain the unsigned supervised Apple Silicon beta and optional source setup accurately. They do not turn that candidate into a signed/notarised or clean-device-qualified release, qualify Windows distribution, enrol a participant, certify accessibility or establish research validity. Obtain the actual beta application and study instructions from the researcher.
