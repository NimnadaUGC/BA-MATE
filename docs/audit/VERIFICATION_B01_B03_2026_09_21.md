# B01–B03 implementation verification

Implemented 21 September 2026 against the BA_MATE 0.4 working tree. This record covers only the first repair batch: canonical revision/dependency handling (B01), guarded approval/baseline transitions (B02), and document/recovery integrity (B03). It does not claim that later synchronization, change, export, model, account, or research-collection work is complete.

## Delivered controls

- **B01:** source, clarification, register, governance, requirement, story, diagram, document, and project-brief content now have stable revision semantics. Trace links pin the revisions reviewed at both endpoints; a changed endpoint makes the link pending. The dependency pass first identifies all direct changes, including edits, additions/removals and changed links, then propagates their effects through evidence, explicit trace links, story/requirement relations, diagrams, document sections, blocks and diagram embeds. Locked baselines are restored from the pre-edit copy only.
- **B02:** requirements/stories and diagrams use a shared artifact-approval rule. It checks active approval authority, scoped blockers, current evidence paths, testable criteria, current trace revisions, pending traces, diagram references and stale diagram embeds. Baseline creation is scoped to the active goal and records an explicit revision manifest; it cannot include another goal merely because it exists in the project. It promotes only in-scope reviewed artifacts, including reviewed diagrams.
- **B03:** document history is scoped by document identity, so selecting B cannot make undo apply A’s prior content. Settings now provides visible project ZIP export and restore. Restore validates first, disables cloud processing, and adds a separate project rather than overwriting existing work. The local service retains transactional workspace revisions, while restoring an internal snapshot first records a recovery snapshot. The pilot guide now describes the visible controls and storage honestly.

## Regression evidence

| Check | Result |
|---|---|
| Frontend TypeScript check | Passed |
| Frontend unit tests | 34 passed |
| Frontend production build | Passed |
| Backend unit tests | 20 passed |
| Isolated browser rehearsal | Passed: Settings shows project backup/restore controls; editing A, creating/selecting B left B's Undo disabled, so A could not overwrite B |

The frontend regressions include direct requirement-change propagation, stale trace-revision rejection, scoped baseline manifests, criterion enforcement, immutable baseline preservation, restoration recovery, project ZIP round-trip, and source/clarification/project-brief revision advancement.

## Remaining boundary

The next implementation stage is B04–B05. In particular, this repair batch does not make requirement-to-SRS synchronization complete or make change requests apply real reviewed content patches. Those defects remain release blockers until the next stage is implemented and verified.
