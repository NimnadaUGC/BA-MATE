# Guide sources and publishing

The three Markdown files are the content sources. `<!-- page -->` starts a new topic page in the Word publisher. Headings, emphasis, links, numbered steps, bullet lists, two-column tables and plain code blocks are supported. Keep the explicit page references and the expected page counts in `build_guides.py` aligned with the rendered result.

## Rebuild Word editions

Run the builder with a Python environment containing `python-docx` and `lxml`:

```sh
python3 docs/user_guides/source/build_guides.py
```

Run this from the BA-MATE folder. The default design reference is the sibling checkout's `BA-MATE-SKILL/docs/user_guide/BA-Mate-01-Getting-Started-v1.0.5.docx`. If it is elsewhere, pass `--template "/path/to/reference.docx"`. The retained reference is read only. The builder replaces its body and app-specific metadata while preserving its styles, theme, embedded fonts and media. Existing numbering definitions are retained and step numbering is appended.

The builder writes three DOCX files and `build-manifest.json`. This is an optional documentation publishing tool, separate from application setup. Do not install these libraries merely to run the BA Mate app.

## Publish PDF editions

Export each Word edition to PDF with headings/bookmarks enabled, or use the document skill's `render_docx.py --emit_pdf` in the Codex bundled runtime. Inspect **every page**, confirm the expected counts (7, 11 and 6), page references, links, typography, tables and footer fields, and publish the verified PDFs beside the DOCX files. Do not use an older PDF after editing its Word source.

Update the verification record and manifest after reviewing changed instructions against the app. A document render verifies layout; it does not execute the application workflow.

## Content evidence

- Application version and model settings: `backend/app/runtime.py`, `frontend/src/ModelSettings.tsx`.
- Native/source startup and data paths: `desktop/main.cjs`, `start.py`, `backend/app/persistence.py`.
- Navigation, project/goal/source/approval/backup controls: `frontend/src/App.tsx`.
- Stage gates and approval policy: `frontend/src/workflowReadiness.ts`, `frontend/src/store.ts`.
- Source handling: `frontend/src/workspaceFiles.ts`, `backend/app/project_files.py`, `docs/PROJECT_SETUP_AND_BACKGROUND_WORK.md`.
- Structured AI review: `frontend/src/WorkflowWorkbench.tsx`.
- Documents, diagrams and linked UI: `frontend/src/connected.tsx`.
- Changes, SRS synchronisation and baselines: `frontend/src/controlledChanges.ts`.
- Observed native workflow and final release checks: `docs/audit/NATIVE_BETA_E2E_2026_10_31.md`, `docs/audit/FINAL_UI_POLISH_2026_11_01.md`.

The official provider and Apple setup references are linked in Guide 1. Their account interfaces and model availability can change; use the profile assigned by the researcher. The guides do not embed credentials, real participant data or a public download address.
