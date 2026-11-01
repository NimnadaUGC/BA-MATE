# Mock-stage verification record

Verified on 2026-08-17 against the local application at
`http://localhost:5173`.

## Automated checks

- TypeScript (`tsc --noEmit`): passing.
- Frontend production build (`vite build`): passing.
- Frontend unit/domain tests: 18 passing.
- Backend orchestration/API tests: 6 passing.
- The application shell, connected editors and assistant are code-split. The
  main application chunk remains below 500 KB. Mermaid's lazily loaded parser
  chunk is larger than Vite's advisory threshold but does not block the build.

## Route coverage

Every public and project route was loaded after lazy content settled. Each
route exposes a page-specific document title and primary heading:

- Projects, Recent work, Templates, Settings and the locked Research console.
- Overview, Goals, Workflow, Conversations and Sources & context.
- Requirements & stories, Registers and Traceability.
- Diagram studio, Document studio and Changes & impact.
- Governance & checks, Activity & baselines, Stage evaluation and Team &
  project settings.
- Unknown global pages, unknown projects and unknown project sections render
  explicit recovery pages instead of silently falling back to unrelated
  content.

The browser console contained only Vite development and React DevTools
messages during the final route and interaction pass; there were no
application warnings or errors.

## Interaction and overlay coverage

- New-project and new-goal dialogs expose dialog semantics, nested BA Mate
  guidance, focus containment, Escape/close behavior and safe cancellation.
- Project, goal, artifact, conversation, register, trace-link, diagram,
  document, document-block, change-request, governance-rule and member
  destructive actions require an accessible confirmation.
- Temporary records were created and deleted through the UI for connected
  artifacts, conversations, trace links, register entries, diagrams,
  documents, change requests, governance rules and mock members. Selection,
  relationship cleanup, audit history and notifications remained consistent.
- The assistant drawer and its typed context picker expose clear landmark and
  dialog semantics. Model failures retain the user's prompt/context and show a
  recoverable error rather than losing the request.
- Clarification creation, answers, deferral, discard and restore are audited
  and acknowledged. Workflow advancement remains gated by blockers and, for
  active research runs, required stage feedback.
- Document synchronization remains proposal-based: only approved artifacts
  are eligible, selected changes require review, and accepted changes create a
  version receipt.
- Diagram controls cover structured node editing, Mermaid validation, zoom,
  focus mode, versioning, proposal review, approval, export and version-pinned
  document embedding.
- Document controls cover templates, structured blocks, formatting, reordering,
  artifact links, comments, version status and JSON/Markdown/DOCX/PDF exports.
- Notifications use a queued, dismissible, severity-aware viewport so rapid
  actions do not overwrite one another.

## Responsive and accessibility checks

- Projects, Traceability, Diagram studio, Document studio and Changes & impact
  were visually checked at a 390 × 844 viewport and at the normal desktop
  viewport.
- Mobile navigation collapses to a drawer; dense matrices and document
  navigation retain deliberate internal scrolling without widening the page.
- Icon-only controls have accessible names; active navigation, tabs, pressed
  controls, switches and ratings expose their current state.
- Dialogs restore focus, trap keyboard focus while active and close with
  Escape. Reduced-motion preferences disable non-essential animation.
- Empty, loading, unavailable and fatal-error states provide a clear recovery
  path.

## Research protections and evidence

- The Research console is hidden behind the exact local researcher password
  gate. Password verification is covered by an automated exact-match test.
- Console unlock lasts for the browser session and can be explicitly locked.
- Stage sessions, page views, actions, assistant requests and errors are
  recorded without source or artifact content.
- A running evaluation requires stage feedback before workflow advancement.
- The stage-evaluation form requires accuracy, usefulness, usability and
  confidence ratings; a complete four-dimension response was submitted in the
  browser pass and acknowledged by the UI.
- Research export contains anonymous run metadata, aggregate event fields and
  ratings rather than project evidence.

## Data and model handoff

- Workspace schema version 5 restores a valid governed goal for pre-v5 demo
  projects while preserving intentionally blank custom projects.
- Project, goal, conversation, context, artifact, validation and baseline
  hierarchy is consistent across navigation and persisted state.
- The mock provider uses the same versioned context envelope, priority-budget
  compaction receipt and explicit human-acceptance boundary required by the
  real provider integration.

Visual QA captures are stored in `tmp/qa/`.
