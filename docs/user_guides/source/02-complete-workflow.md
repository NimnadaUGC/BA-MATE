# BA Mate Complete Workflow
Application guide 2 | BA-MATE 1.0.0-beta.3 | 1 November 2026

Use this guide to take a project from reviewed source material to an approved baseline, then make a controlled change. Complete Guide 1 first. Keep Guide 3 nearby for backup and recovery. AI can propose work; the BA remains responsible for evidence, stakeholder confirmation and approval.

## Follow the six application stages
| Stage | Your outcome |
| --- | --- |
| Setup | Define a goal, review and select sources, retain safeguards. |
| Discover | Identify stakeholders and record uncertainties. |
| Clarify | Record confirmed answers and resolve blockers. |
| Define | Draft testable requirements or stories with evidence. |
| Validate | Review quality, traceability and deliverables. |
| Approve | Record an authorised baseline and complete the goal. |

The Framework companion describes nine methodological phases. The application groups the work into these six stages and supports later iteration through goals and controlled changes. There are no extra app screens for each Framework phase. Use **Guided workflow** as your stage checklist and follow its links to the relevant workspace.

## In this guide
Project and goal — page 2. Sources and stakeholders — page 3. Clarifications — page 4. Requirements and AI proposals — page 5.

Evidence and quality — page 6. Diagrams and documents — page 7. SRS synchronisation — page 8. Baseline approval — page 9.

Controlled changes — page 10. Chat and selection — page 11.

**Practice case.** Use examples/practice-cash-checkout.txt from this guide pack. All people, confirmations and amounts in the exercise are fictional. Keep the project separate from real work and formal research tasks.

<!-- page -->
## Create a project and goal
**Path:** Global sidebar → Projects → New project

1. In the first project step, enter **Practice Cash Checkout** and describe a cash-only checkout. State that card payments, refunds and stock management are out of scope. Optional AI help with the description is not required.
2. In the knowledge-base step, choose a managed project folder or an existing folder. A managed folder is created under the application's data directory; an existing folder remains where you chose it. Add **practice-cash-checkout.txt** from the examples folder. Uploaded files are copied when you create the project, normally into **Uploaded Sources**.
3. Review governance in the final step. Retain the locked core safeguards and select any applicable additional packs. Create the project. A new project starts without approved requirements or deliverables.
4. Create a **New goal** when prompted, or open **More tools → Goals → New goal**. Choose **Start from new material** for this exercise. Use a title such as “Specify the cash checkout” and a description such as “Produce reviewed checkout requirements and an SRS, with an approved baseline.”
5. Select suitable reviewed sources if already available, then **Start this goal**. You can start before the source is reviewed, but Setup cannot advance until at least one current reviewed source is selected for this goal.

**Expected result.** The project has an active goal at **Setup**. The top bar identifies your project and goal. Open **Guided workflow** to see the checklist. **Advance to Discover** becomes available only when the current stage is ready; merely opening a later workspace does not advance the stage.

## Choose another goal when needed
Other goal types support improving an existing SRS or stories, creating an addendum, creating a deliverable, resolving stakeholder questions, or reviewing policies and safeguards. Choose the type that matches your intended outcome and describe the boundary. A goal is a scope for governed work, rather than a chat title.

**Stop and review.** Check the project folder, goal title and outcome before continuing. Do not add a second active task to the wrong project. Local project member roles control approval authority inside this workspace; they are not invitations or verified online identities.

<!-- page -->
## Review sources and discover stakeholders
**Path:** Project materials → Sources

1. Open the practice source. Compare the extracted content with the original. Check that its title, classification and relevant statements are correct. PDF, DOCX, text, Markdown, CSV, JSON and spreadsheet formats support extraction; media originals may be retained without OCR or transcription.
2. Choose **Accept extracted source for this project** only after reviewing it. Acceptance records the reviewed source revision. It does not approve any requirements derived from that source.
3. Choose **Use for “[goal title]”** to include the reviewed revision in the active goal. Where offered, **Select all reviewed** selects eligible reviewed sources; it is not an instruction to trust every file automatically.
4. Return to **Guided workflow**. Confirm the goal description, at least one selected current reviewed source and governance context are complete, then choose **Advance to Discover**.
5. Open **Project materials → Registers** and **Add stakeholder**. Record the fictional shop owner and cashier, with clear roles. Use **Edit details** to maintain owners and statuses. Add assumptions, decisions, risks or issues in their corresponding tabs when relevant.
6. In **Guided workflow**, record a clarification question about the cash-change limit and the behaviour above that limit. You can add it manually or review an AI clarification proposal using page 5. At least one stakeholder and one question are needed before advancing to Clarify.

**Expected result.** The goal has a reviewed evidence source, named stakeholder roles and a visible uncertainty. The question is **Unanswered** until a responsible person confirms an answer.

**Changed originals.** The service watches accessible project folders while it runs; browser folder access may also depend on browser permission. If the original changes, the previous review and goal selection can become stale. Compare the new extraction, accept the current revision and select it again. Old baselines remain preserved. Do not approve while the app reports stale or missing source evidence.

**Stop and review.** Extraction can omit tables, scans or formatting. An imported filename is not evidence that all content was read correctly. If the original is unavailable, reconnect it and verify its content before relying on it.

<!-- page -->
## Resolve clarification questions
**Path:** Guided workflow → clarification question list

1. Inspect each question, priority, owner, rationale and affected records. For the practice case ask: “What is the maximum cash change, and what should happen if it is exceeded?” Treat this as a blocking decision.
2. In a real project, obtain the answer from the responsible stakeholder. For this exercise only, simulate: “Maximum change is 500 currency units. If calculated change exceeds 500, block completion and ask for a smaller cash amount.”
3. Enter the answer and identify **Who confirmed this answer?** Use **Simulated shop owner for practice only** in the exercise. Complete the confirmation control only because this is an explicitly fictional rehearsal; never present that record as a real stakeholder confirmation.
4. Review other questions. Record confirmed answers, or defer/discard nonblocking questions with a reason where appropriate. Deferring a blocking question does not resolve the missing business decision.
5. Return to the Clarify checklist. You need at least one answered question with actual answer text, no questions left Unanswered, and no blocking questions or findings. Advance to **Define** when ready.

**Expected result.** The recorded answer is linked to the decision it resolves and identifies its confirmer. The app retains the distinction between a proposal and a confirmed answer.

## Keep uncertainty visible
Record an assumption when a fact is not yet confirmed. A model may suggest likely answers, but you must not mark them stakeholder-confirmed on that basis. If a finding reveals a conflict, assign an owner and resolve it before approval.

If a confirmed answer later changes, update the governed records through the appropriate revision or change workflow. Recheck dependent requirements, stories, documents and evidence. A previous review may no longer cover the changed answer.

**Stop and review.** Do not advance solely to make the checklist green. Ask whether another BA could identify the source of the decision, who confirmed it and which artifacts depend on it. If not, improve the record before drafting requirements.

<!-- page -->
## Draft requirements and review AI proposals
**Path:** Guided workflow → Task AI; or Project materials → Requirements & stories

1. To use AI, confirm the connection and project permission from Guide 1. Choose **Draft requirements and user stories** in Task AI, give a narrow instruction and inspect **Comparison mode and included evidence**. Keep the assigned research condition unchanged during a formal task.
2. Choose **Run selected task**. Wait for the proposal or use **Cancel request**. The proposal is separate from your BA artifacts. Inspect the context receipt, assumptions, statements, criteria and evidence identifiers.
3. Correct the proposed text before applying it. Select individual items, or **Select all suggestions** and deselect unsuitable items. Choose **Add … items as drafts**. Use **Reject proposal** when the proposal is not useful. Previous AI tasks retain their review history.
4. Alternatively, open the Requirements or Stories tab in **Requirements & stories**, then **New requirement** or **New story**. Fill the editor with the statement or story, testable acceptance criteria, evidence references, rationale and rules. Use **Add criterion** for additional cases. Manual work follows the same review and approval controls.

## A testable practice requirement
**Statement:** The checkout shall block sale completion when cash tendered minus the order total exceeds 500 currency units, and ask the cashier to request a smaller cash amount.

**Acceptance criteria:** With order total 100 and cash 600, calculated change is 500 and the limit permits completion. With order total 100 and cash 601, change is 501 and completion is blocked with the instruction to request a smaller amount. These examples test the limit only; record a separate requirement for insufficient cash if it belongs in scope.

Link this requirement to the confirmed clarification and relevant source. Use a story if helpful: “As a cashier, I want the checkout to enforce the cash-change limit so that I follow the shop's cash-handling rule.” A story needs its own testable criteria and evidence.

**Expected result.** At least one requirement or story exists as a draft with criteria and evidence. The Define checklist checks these basics before allowing **Advance to Validate**. It does not judge whether the wording is complete or correct.

**Stop and review.** Do not accept invented policies, unsupported numbers or references that do not support the statement. A stale proposal must be rerun or reviewed against the current evidence before it can be applied.

<!-- page -->
## Verify evidence and quality
**Paths:** Review & approval → Evidence links; Checks & safeguards

1. Open **Evidence links**, whose workspace heading is **Traceability**. Inspect each requirement or story's evidence path. Follow the link to the original source, confirmed clarification or another supporting record.
2. Compare the actual passage and the current artifact revision. Verify a link only when it supports the claim. An attached source ID or an automatically created pending link needs this review; merely adding a reference does not verify it.
3. Resolve pending, broken or stale links. After editing an artifact, reverify links against its new revision. Ensure every requirement and story has a verified, current path to evidence before approval.
4. Open **Checks & safeguards**. Review applicable packs, findings, severity, rationale and decisions. Resolve blocking findings and blocking questions. Record why a rule applies and what evidence resolves the concern; do not silence a finding simply to progress.
5. Optionally run **Review quality and evidence** through Task AI. Review each proposed finding before adding it. AI findings supplement your review of ambiguity, consistency, testability, unsupported assumptions and missing stakeholder perspectives.
6. Review each requirement and story. Use **Submit for review** when the draft is ready. Address review comments before **Approve**, if individual approval is appropriate. **Return to draft** allows correction; editing approved work uses **Create working revision**.

**Expected result.** Artifacts are in review or approved, acceptance criteria are present, evidence paths are verified for current revisions and blocking findings are resolved. Required documents and process evidence must also be reviewed before final approval; pages 7 and 8 cover them.

## Check the boundary cases
For the checkout example, inspect the equality boundary at 500 and the first disallowed value at 501. Check that source, clarification, requirement, story and process wording agree. Avoid adding refund, card or stock features that were excluded from the goal.

**Stop and review.** A green checklist and a model's quality score cannot replace business review. If the app blocks approval, read the specific issue and correct the underlying record. Do not remove evidence or weaken a safeguard to bypass it.

<!-- page -->
## Prepare diagrams and documents
**Paths:** Deliverables → Diagrams; Deliverables → Documents

Use a process representation appropriate to the goal. A simple process can be explained in a reviewed document with a recorded reason for not using a diagram where the safeguards permit it. If the checklist or policy requires a diagram, provide and review one. The exercise below uses a small flowchart and an SRS.

1. Create a diagram manually, or run **Draft a process diagram** through Task AI and add the reviewed proposal as a draft. Use a supported Mermaid type, such as flowchart, sequence, state, ER or user journey.
2. For the practice flow, show cashier entry, change calculation, the **change greater than 500** decision, the blocked branch and the permitted branch. Link the supporting requirement or decision. Check both the diagram code and the rendered meaning.
3. Use **Save version** after editing. Review comments and approval controls; valid Mermaid syntax proves rendering, not business correctness. **Exit focus** or Escape closes the enlarged diagram view. Use **Add to document** to embed a reviewed diagram where useful.
4. In Documents choose **New from template**, select an appropriate SRS template and name the draft. Use **Add section** as needed. Explain purpose, scope, stakeholders, the checkout process, requirements, assumptions and unresolved matters. Do not fill gaps with invented facts.
5. Use **Manage links** and block link controls to connect content to its evidence and artifacts. Review the document's sections and diagram embedding. An embedded diagram is pinned to a revision; a later diagram edit does not silently update the document.

**Expected result.** A draft process diagram and SRS exist and refer to the same current checkout rule. Individual exports can help review, but an exported PDF is not an approved baseline or a recoverable project backup.

**Stop and review.** If an embed is stale, choose **Review and refresh**, compare the revisions, then **Use current revision** only when appropriate. This updates the embed reference; it does not approve the diagram. Review the changed document again.

**Optional tools.** Export Mermaid, SVG, PNG or PDF from Diagrams when needed. Keep this exercise focused on the workflow rather than trying every export format.

<!-- page -->
## Synchronise and review the SRS
**Path:** Project materials → Requirements & stories → selected approved artifacts

1. Individually approve the requirement or story after its evidence and criteria pass review. Select the approved artifacts you intend to include in the document. Selection alone does not copy or approve anything.
2. In **Synchronization mode**, choose **Update existing SRS**, **Create new SRS** or **Create addendum**. For the practice project, select the existing draft SRS and its intended requirements section. Existing-document synchronisation needs a draft target; use **Create working revision** if the document is approved.
3. Choose **Create/update SRS** to prepare the proposed updates. Read the before/after content, target section, source revision and linked evidence. Select only the intended updates, then choose **Apply selected updates**. Nothing is applied merely by ticking an artifact or opening the preview.
4. Reopen the document. Check the inserted statement, criteria, rules, rationale and links. Synchronisation manages the linked artifact block; unrelated prose still needs manual review. Check for duplication, missing context and an incorrect target section.
5. In the document editor use **Edit** for content changes and **Review** to inspect the result and comments. Review mode prevents editing. Add or resolve **Comments** as appropriate, then **Submit for review** when ready. Use **Return to draft** for corrections, or **Create working revision** after approval.

**Expected result.** The document contains the intended current artifacts and a coherent process description. All required documents and diagrams are at least in review, their links resolve, and no embedded diagram is stale.

## Complete Validate
Return to **Guided workflow** and inspect every Validate checklist item. Check all scoped artifacts, including linked deliverables inherited from other goals if they appear in the approval issues. Fix the exact item cited, then advance to **Approve**.

**Stop and review.** If the source artifact or target document changed after the synchronisation preview was prepared, discard the stale preview and prepare another. Do not apply an old replacement to newer work. A document's visual polish does not establish that its evidence or revision references are current.

<!-- page -->
## Approve the baseline and complete the goal
**Path:** Review & approval → History & approved versions

**Before you approve.** Review the requirement at the 500/501 boundary, its confirmed answer, the process diagram and the SRS. Check for draft work, stale embeds, unverified links and unresolved blocking decisions. Use the app's specific issues to locate remaining work before recording approval.

1. At the goal's **Approve** stage, review the readiness issues and current revision manifest. Confirm all scoped requirements, stories and deliverables are represented, current evidence is selected and blocking issues are resolved.
2. Confirm an active local project member has approval authority in **Project settings**. A role configured on this device is not external identity verification. Only an authorised person should record an approval.
3. In **History & approved versions**, whose heading is **Activity & baselines**, choose **Approve new baseline**. Review the exact revisions being locked. Enter **Approver name or role**, confirm the authorisation statement and choose **Record approval**.
4. Confirm the new approved baseline, referred to as **B1** in this exercise, appears with its locked manifest. **Create snapshot** is a separate convenience action and does not record formal baseline approval.
5. Choose your stopping point. **For the full B1-to-B2 practice exercise, leave this goal active** and continue to page 10. For a B1-only run, open **More tools → Goals → Mark complete** when readiness permits. Completion does not send work to stakeholders automatically.
6. Open Settings, select the project in **Project for backup** and **Export project backup**. Keep the ZIP in a safe location outside the working project folder. Guide 3 explains verification and restore.

**Expected result.** B1 is locked and available in history. A B1-only goal is completed; the full practice goal remains active until B2. Your ZIP preserves available source originals and project records for recovery.

**Share an approved SRS.** Open the document in **Deliverables → Documents → Export document or project**. In **Export revision**, choose the approved baseline containing that document, then **PDF**, **DOCX**, **Markdown** or **Developer handover** as needed. Inspect the downloaded file before sharing. A working export is labelled not approved. **Project JSON** exports current records regardless of this revision choice; it is not the project backup ZIP.

**After completion.** Saved chat can answer questions about completed work. Later work needs a new goal with its own scoped outputs and six-stage checks. Selecting an older artifact does not assign it to that new goal. Leave the original goal active for the specific change rehearsal on page 10.

**Stop and review.** If approval cannot be recorded, preserve the issue text and resolve it. Do not manufacture an approver, alter a baseline file or reset the workspace to bypass the guard.

<!-- page -->
## Make a controlled change
**Paths:** Guided workflow → clarifications; Review & approval → Changes & impact

Practise reducing the maximum change from **500 to 300** after B1. Keep the same block-and-request-smaller-cash behaviour. This is a second fictional stakeholder decision, not an undocumented edit to the first approval.

1. Keep the original goal **active at Approve** after B1. Update the practice clarification answer from 500 to 300 and record its practice-only confirmer. Review the requested outcome and source selection. Changed evidence invalidates affected working reviews; the B1 record stays locked.
2. In **Changes & impact**, choose **New change request**. Describe the 500-to-300 change, its reason and the affected approved baseline. Review the impact list, including requirements, stories, diagrams and document blocks. Optional AI **Assess a proposed change** needs an explicit change description and human review.
3. For affected records use **Draft content patch** and **Draft acceptance criteria patch** as appropriate. For a document select the exact **Document block to replace**. Enter the full intended replacement, compare before/after text and inspect the current revision.
4. Select only correct patches, then **Accept selected patches**. Acceptance records your decision about proposed edits; choose **Implement accepted patches** to apply them. A stale or unchanged patch must be corrected or replaced before implementation.
5. Review the implemented revisions. Test the new boundary: total 100 and cash 400 gives change 300; cash 401 gives change 301 and must be blocked. Update process, SRS and criteria consistently. Submit changed records for review, reverify trace links against the current decision and refresh diagram embeds as needed.
6. Choose **Record revalidation** only after checking the affected work. If it changes again, revalidation may no longer be current. Resolve remaining readiness issues, approve **B2**, then open **Goals → Mark complete**. All six stages should now display as complete.

**Expected result.** B2 captures the reviewed 300-unit rule. B1 still captures its original revisions and remains unchanged. The change request records what was affected, what was applied and what was revalidated.

**Stop and review.** Impact selection is not an implementation plan by itself. Patches need real replacement content, correct targets and current revisions. Revalidation is a BA review record, not an automated claim that every business test passed. Export a fresh project backup after B2.

<!-- page -->
## Use chat and selection controls
**Paths:** Top bar → Ask BA Mate; More tools → Ask BA Mate

The top-bar assistant is useful for a quick question alongside the current workspace. Use **Open saved conversations**, or the full Ask BA Mate workspace, for durable conversation history. Confirm the active project and goal before sending.

1. Type **@** to find a context record by ID or name. Use arrow keys and Enter to attach the highlighted result; this Enter selects context rather than sending. Escape dismisses the picker. Inspect the attached context chips and remove anything unrelated.
2. Ask a focused question, such as “Which confirmed decision supports this cash-change limit?” Use **Shift+Enter** for a new line and **Enter** to send once the picker is closed. Read the response and its context receipt; inspect the underlying records yourself.
3. Use **Stop** to cancel a request. After failure, **Use previous message** can help recover the request for editing and retrying. Check the connection and permission rather than repeatedly sending the same failing request.
4. If chat offers a structured proposal, review the items, criteria and evidence before adding drafts. A conversational answer does not automatically change artifacts or satisfy a stage gate.

**Draft limits.** Unsent messages and temporary assistant conversation state can remain only in memory. A reload, app closure or crash can lose them. Successful saved conversations are durable workspace records. Copy essential unsent text to a safe note before restarting; project backups do not promise to capture every open editor or temporary drawer draft.

## Select and act on artifacts
In **Requirements & stories**, selection controls include **Select all**, **Approved**, **Deselect shown** and **Clear**. They operate on visible records as labelled; selections may remain when changing filters or tabs, so check the count and selected IDs before a bulk action.

Bulk **Submit drafts** and **Return reviews to draft** affect eligible selected records. Approval remains an individual review decision. Select only approved artifacts for SRS synchronisation, then inspect and apply the proposed document updates separately.

**Next:** Use Guide 3 to back up, restore, troubleshoot and report feedback. During a formal study, follow the assigned task, comparison condition and stopping point rather than using this practice sequence as the research protocol.
