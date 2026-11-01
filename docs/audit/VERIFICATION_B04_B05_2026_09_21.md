# B04–B05 implementation verification

Implemented 21 September 2026 against the BA_MATE 0.4 working tree. This record covers revision-safe SRS synchronization (B04) and real reviewed change implementation (B05). It does not claim that the later export, AI qualification, participant-service, installation, or research-readiness stages are complete.

## B04 — Revision-safe SRS synchronization

- The BA explicitly selects the synchronization mode, target document and target section.
- Each proposed document change captures the actual existing block text, the source artifact revision, the selected target block/section, and the target document revision.
- SRS content now includes statement, acceptance criteria, business rules, rationale, dependencies, evidence/provenance, and relevant recorded decisions rather than a title-and-statement placeholder.
- Applying a proposal rechecks all source and target revisions. A stale proposal becomes `stale`, is retained with an audit event, and does not modify the document.
- Applying selected changes updates/creates one controlled block per artifact, records exact source versions and target document version in a receipt, and returns the document to draft for review. Reapplying an accepted proposal is disabled.

## B05 — Real controlled changes

- A change request now has an explicit affected approved baseline, optional attached reviewed AI impact-analysis record, selected impacts, and concrete editable before/after patches.
- Patches are bound to their source revision and a real target field or document block. They support requirement statements, user-story criteria, Mermaid diagram source, and targeted document-block content.
- A BA must select and substantively edit patches, then explicitly accept them. The request changes through `Impact review` → `Approved` → `Implemented` → `Revalidated`; a rejected patch remains retained and is never applied.
- Implementation validates every selected accepted patch before mutation. Stale, unchanged, missing, or unapproved patches prevent all changes. On success, patches apply as working revisions atomically; the original locked baseline is not modified and revalidation remains an explicit action.

## Regression evidence

| Check | Result |
|---|---|
| Frontend TypeScript check | Passed |
| Frontend unit tests | 39 passed |
| Frontend production build | Passed |
| Backend unit tests | 20 passed |

The focused B04–B05 tests cover complete SRS content, stale source/target proposal detection, unchanged/stale patch rejection without mutation, actual requirement patch application, and story/diagram/document-block patch application.

## Remaining boundary

The next stage is B06–B08: selected-revision exports, explicit AI context safety, and real-model qualification. B04–B05 makes the controlled document and change journeys reliable; it does not yet certify Markdown/DOCX/PDF fidelity or model suitability.
