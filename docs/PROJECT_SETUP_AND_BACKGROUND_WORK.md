# Project setup and background BA work

This implementation follows the evidence and human-authority rules in the
[BA framework specification](../../Framework/Specification/FRAMEWORK_SPECIFICATION.md).
It prepares work automatically while leaving source selection, stakeholder
answers, proposal adoption and approval with people.

## Project creation

1. The BA chooses one of nine guided foundations or a blank project. A model
   can propose the foundation, domain, summary and full policy list from a
   description. The BA reviews the proposal before it is applied.
2. The BA creates a managed folder or grants read and write access to an
   existing folder. Nested files are project sources. Uploaded files default
   to `Uploaded Sources`; their names and destination folders can be changed.
3. The BA reviews the complete governance list, including model-proposed
   additions, revisions and removals. Core human-oversight rules are retained.
   Files are copied only after this final step.

The new project begins with no copied demonstration artifacts or approvals.
BA Mate then asks what goal to work on first; it can suggest goals as source
analysis progresses. The BA explicitly selects current reviewed source revisions
for each new goal. An older approval without a verifiable folder revision cannot
be selected. BA Mate checks each chosen original against its reviewed hash
again when the goal starts. A changed source blocks that selection and remains
visibly in need of review rather than counting as current goal context. Goal
selections pin the reviewed source hash. Reaccepting a changed extraction does
not silently select the new revision for that goal; the BA selects it again.

## Background processing and review

- The local service scans managed and selected folders, including nested
  folders, about every ten seconds. Changed files are extracted in a bounded
  parallel pool. It continues from saved project context
  while the page is closed and the service remains running. Browser-selected
  folders are scanned while the browser can access their granted handle.
- The source-intake role summarizes tentative extraction. Planning and
  governance roles prepare independent suggestions. Once a goal exists, a
  drafting role may propose requirements from source revisions explicitly
  selected by the BA and from recorded human decisions. A changed source hash
  is excluded from that drafting context. Before a goal exists, no project
  source is treated as selected drafting evidence.
- Extraction and model output never approve a source or artifact. Before a
  source is included as evidence, BA Mate checks its current original against
  the extracted revision. A changed or removed original withdraws working
  approval and makes affected work require review; prior baselines remain in
  history.
- Source extraction review and active-goal selection have separate controls.
  The goal's selected revision must match the current accepted source hash
  before background drafting can use it.
- Suggestions appear in project review and goal setup. The BA may adopt or
  reject them. Adoption creates editable drafts or tracked questions, not
  approved commitments. Chat actions likewise require an explicit decision;
  a proposed stakeholder answer also requires the BA to record who confirmed
  it. A chat proposal to select a source is tied to the goal that was active
  when BA Mate proposed it; changing goals requires a fresh proposal.
- A failed model run leaves manual work available. The BA can retry it after
  correcting the model connection.
- Each run records its local model, input source revisions, excerpt lengths,
  omitted source and decision counts, unmatched selections and recorded
  human-decision count. The project overview
  discloses this context. Earlier complete runs retain their original role
  proposals, even when new source revisions trigger fresh work. A request for
  changed context never presents an older running proposal as the current one.
- When a goal conversation exists, a ready background run can put one
  unresolved clarification question into that conversation as a pending
  proposal. The BA can track or reject it there. Tracking creates an unanswered
  question; a responsible person's answer still needs separate confirmation.
  A question from an older source revision cannot be adopted as current.
- Independent planning and governance outputs are retained if the other role
  fails. A service restart refreshes the local browser session before a save
  request is retried.

## Storage and recovery

Originals are stored in the project folder, not duplicated in every saved
workspace revision. Project backups gather originals from that folder and
validate their hashes. They also include previous AI role outputs and the
current run. Restore creates a new managed folder and writes the originals
there; the old current run becomes historical so its suggestions are not
presented as current context. Sources without an available original remain in
the backup as records and are identified as requiring review. A package whose
original conflicts with its recorded hash is rejected before any folder is
created.

## Practical limits

Automatic source-content roles require a local Ollama connection, because
newly discovered extraction has not been approved for remote processing.
Formats the extractor cannot read remain visible as sources with a limitation;
they do not become usable evidence. Browser-granted folders cannot be scanned
after the browser closes. Suggestions do not advance workflow gates or create
approved baselines automatically.
