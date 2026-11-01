# BA Mate UI and UX review

30 October 2026. This is an ongoing visual and usability review, not a claim that every screen or dialog has been checked. The user requested emphasis on the main application experience, layout and bulk actions. The APNK restored copy was used for visual checks; business decisions were not answered.

## First pass

- **Project overview:** Background status and expandable proposal details previously appeared above the active goal, pushing the next action down. The active goal and review readiness now lead; background information and proposals remain available below. On a wide window the readiness metrics use a compact two-column layout. Checked visually at the default window and a 900 × 700 viewport.
- **Guided workflow:** The AI workbench previously separated the completion checklist from the clarification queue. The queue now follows the checklist, and an AI assistance shortcut at the top jumps to the workbench below. Checked the Clarify screen and shortcut in the restored APNK copy. Other stages and small windows remain to be reviewed.
- **Requirements and stories:** Search displayed a nested border, long text fields exposed only a few lines, and selecting drafts exposed SRS synchronization controls even when no selected artifact was approved. Search styling, editor field height and the responsive header were improved. Select all applies to currently shown items, Approved adds visible approved items, and Clear removes all selections across tabs. The count and SRS action distinguish selected from approved items. On the 900 × 700 check the title, actions and list/editor remained readable; selection of six drafts left SRS synchronization disabled. Search-filter, mixed approved/draft and keyboard flows need further live testing.
- **Goal setup and AI proposal review:** Added select-all and clear actions for reviewed goal sources and AI suggestions. Selecting does not start a goal or adopt a suggestion; source validation and proposal review remain in place. Component tests cover the selection controls, but a live visual check of these controls is still needed.

## Further visual pass

- **Sources:** The selected source name and two review controls were squeezed into one row, making the content unreadable. The source list is narrower, the controls have a responsive row of their own, and the search field no longer has a double border. Verified in the restored APNK project at the default viewport.
- **Registers:** Long assumptions were clipped in single-line editable fields and generated identifiers wrapped awkwardly. Register entries now use expandable, multiline fields and the identifier column is wider. Verified stakeholders, assumptions and row actions at the default viewport. Narrow windows and other register types still need review.
- **Evidence links:** Long matrices pushed the selected relationship's review controls far down the page. The matrix now scrolls independently with a persistent header and explanatory text. The review status is still set individually; selecting all must not imply that evidence has been verified. Verified the populated matrix at the default viewport.
- **Changes & impact:** The change editor had narrow, unlabeled fields and selectors aligned away from the main reading flow. Fields now have visible labels and more space, and selectors align with the form. Verified the empty screen and a new request in the isolated restored copy; patch editing and other states remain to be checked.
- **Checks & safeguards:** Review findings now appear before the background policy layers, bringing blocking issues closer to the top; an empty state explains when no findings exist. Verified the populated screen at the default viewport. Rule configuration and disposition states still need review.
- **Templates and Settings:** Looked at the template list, preview dialog, and the top of Settings at the default viewport. These observations are not a full audit of their interactions or responsive states.

## Document, diagram and history pass

- **Document studio:** The export row compressed the heading and extended off-screen because an earlier layout selector no longer matched after an explanatory note was added. The header now has its own wrapping export row. Long document blocks grow to show their contents and their editing tools are visible without hovering; document and diagram names in libraries can wrap. Checked the populated APNK document at the default viewport. Review mode, individual block types and dialogs need further visual and keyboard checks.
- **Diagram studio:** A long structured-node list stretched the preview row, placing the beginning of the diagram far below the toolbar. The diagram and node editor now scroll independently at wide sizes and the preview starts at the top. Toolbar names use available space; the layout was checked at default and 900 × 700 sizes. Focus mode, diagram types, dialogs and zoom interactions need further checks.
- **Activity and baselines:** The full baseline scope previously pushed versions and audit activity far down the screen. It is now an explicitly labelled expandable section with a count, while the current gate and approval checks remain visible. Long audit entries wrap, and the scrollable audit and evidence regions can receive keyboard focus. Checked the collapsed and expanded scope at the default viewport. Approval and snapshot states need further review.

## Global and project tools pass

- **Recent work:** Activity now presents a readable description rather than an opaque object identifier; project and goal names have room beside the status. Checked with a populated restored project at the default viewport.
- **Goals:** Goal choices now appear before optional, expandable AI suggestions and questions. The heading reflects whether the project already has goals. Verified the dialog and reviewed-source select-all and clear controls without starting another goal. Described-goal and suggested-goal workflows still need a full interaction and responsive check.
- **Project settings:** Core policy rows are visibly marked locked, and the explanatory text distinguishes them from editable policies. Checked the populated default layout; policy proposal and folder dialogs need review.
- **Ask BA Mate:** The composer fits within the default desktop viewport, conversations open at the newest messages, and new messages follow only while the reader is near the bottom. Search and message fields have accessible names. The context picker now identifies already attached items, has a labelled search and a close button, and responds to Escape. Verified the populated screen and picker; a component test covers attachment and Escape. Sending and smaller-window behavior need further checks.

## Project setup and settings pass

- **New project:** Template cards were squeezed into five narrow columns. They now use wider responsive cards, and navigating forward or back returns the new step to the top and focuses its heading. Core policies are marked locked and the governance explanation no longer says every policy is editable. Checked all three steps at the default viewport and the first and final steps at 900 × 700 without creating a project. A component test verifies step scroll and focus in both directions. File upload, AI proposal and workspace selection dialogs still need visual checks.
- **Settings:** Added a visible disclosure indicator for advanced model options and gave the backup project selector a clear accessible name and enough width for the selected project. Checked the default viewport without changing settings or exporting data. Provider-specific states, qualification and restore dialogs remain to be inspected.

## Clarification form pass

- **Guided workflow — Clarify:** The answer, confirmation, help text and save button were squeezed into a single narrow row. They are now separated, with labelled multiline answer and question editors; empty affected-artifact text is hidden. The requirement to name the confirming person is unchanged. Checked populated cards and question editing at the default viewport and the answer layout at 900 × 700 and 500 × 700. Existing component tests verify confirmation and reopening an edited answer. No APNK stakeholder answers were recorded during the review. Other workflow stages and clarification action states remain to be checked.

## AI workbench pass

- **Saved AI reviews:** Previous tasks now show plain-language task names and visible disclosure indicators. The reviewed proposal lists selected items by their reviewed titles instead of internal array keys, with an explicit fallback for unavailable saved entries. Long editable suggestions can grow to show more content. Checked an accepted APNK quality-review run in the restored copy; selection-label handling is covered by a component test. A live pending proposal, the individual edit types, and narrower viewports remain to be reviewed.

## Background suggestions and goal setup pass

- **Overview suggestions:** Added disclosure indicators to the background context and suggestion groups. Suggested questions display lexical overlap hints where detected and link to the clarification queue for comparison; these hints are not semantic duplicate detection. Question actions now have distinct accessible names. The goal suggestion section explicitly says the user must select the suggestion in goal setup.
- **Goal setup:** The goal name and description are visible and editable before creation, including values selected from AI suggestions. The selected suggestion is identified, and changing goal type does not silently erase manually entered details. Checked the overview-to-goal flow and selection in the restored copy without creating a goal; a component test checks preservation of entered details. Suggested questions and the described-goal dialog still need further interaction checks.

## Artifact selection and story editor pass

- **Requirements and stories:** Filtering could hide the currently open item while leaving its editor visible without explanation. The editor now explains that state and offers to clear the search. The AI action says it uses the open item, distinguishing it from checked items. Story acceptance criteria and remove buttons now have distinct accessible names and a labelled group. Verified a filtered select-all and cross-tab selection in the restored project and checked the story editor at the default viewport. A component test covers the search notice and criterion labels; mixed approved/draft selection and a full keyboard pass remain outstanding.

## Synchronization review pass

- **SRS updates:** The review now shows the selection count and offers select all and clear without applying changes. An isolated copy with simulated approvals was used to verify mixed draft/approved selection and the review controls; no updates were applied to the real APNK document.
- **Content protection:** A proposed addition could previously identify an ordinary linked paragraph as the content to replace. Synchronization now updates only explicitly marked, dedicated blocks; other content is preserved, and an addition warns that related content may already exist. The change receipt records the actual blocks changed. Proposals targeting changed or non-draft documents, or unapproved or changed source artifacts, must be refreshed.
- **Existing documents:** Older synchronized blocks do not carry the new marker. A new proposal will add a dedicated block instead of updating those older blocks, so reviewers should check for duplicated content. A migration or guided reconciliation remains a potential improvement.

## Settings connection and navigation pass

- **AI connection:** Editing a provider or model and navigating to another page previously discarded the form without a warning. Unsaved changes now remain in memory while navigating the application, with a visible save-or-discard notice and a browser warning when leaving or reloading. Removing an existing session key requires saving or discarding other connection edits first, so that action cannot silently erase them. Checked switching to OpenRouter, moving to Templates and back, and discarding the edit without saving. The browser warning and discard behavior are covered by a component test.
- **Project backups:** The selected project now falls back to an available project when the list changes while Settings remains open. The restore button opens a file picker; package validation and a complete restore were not retested in this visual pass. Provider-specific settings and qualification review states still need further review.

## Narrow project overview pass

- **Workflow stages:** On narrow screens, stage names disappeared and the controls were announced only as numbers or unnamed buttons. Stage names and statuses remain visible in a horizontally scrollable strip, and every control has an accessible name that explains it opens the current workflow. Checked at 500 × 700.
- **Recent changes:** A long internal identifier made the entire overview scroll horizontally. Activity now shows a readable description, person and formatted time; long text wraps or is limited to two lines, with full details in History. At 500 × 700 the main content no longer overflowed horizontally in the restored APNK copy.
- **Template preview:** Checked the controlled-product template preview and its Cancel action at default and 500 × 700 sizes. Project creation and the other templates were not exercised in this pass.

## Narrow register pass

- **Registers:** The table placed owners, statuses and row actions beyond the right edge on a narrow window. At 500 × 700 each entry now displays its title, owner, impact, status and an explicit Edit details control without horizontal scrolling. Opening details exposes the existing editing controls and reports its expanded state to assistive technology. Verified a populated stakeholder entry at 500 × 700 and the table at the default desktop size, without changing a register. Other register types and editing actions still need visual checks.
- **Other screens:** Checked the main content width of Sources, Traceability, Changes & impact, Checks, Activity, conversations and Guided workflow at 500 × 700. This was an overflow scan of their initial states, not a complete interaction or accessibility review; the collapsed AI workbench and other expanded states need additional inspection.

## Task AI panel pass

- **Impact assistance:** The change description was required but labelled as additional instructions, leaving the disabled Run button unexplained. The label now identifies the required description, and the panel explains how to enable impact analysis. It also explains when a goal or review of an existing proposal is required before running another task.
- **Panel navigation:** The expanded Task AI header now offers an explicit Close label. Checked the Changes & impact panel at 500 × 700, including enabling Run with a hypothetical instruction and closing and reopening the panel. No AI request was run and no project decision was changed. Other task types, proposals and smaller-window review states need further checks.

## Evidence review layout pass

- **Evidence links:** At 500 × 700 the matrix hid destinations and statuses to the right, while the selected review panel could compress its text into a very narrow column. Relationships now show their source, destination, description and status together; coverage metrics use two columns. The review panel uses readable stacked controls on narrow windows and a clearer sequence on desktop. Checked a source-backed link and a stakeholder link, the passage controls, and the default desktop layout without changing review statuses. Creating, verifying and deleting links were not retested in this pass.

## Changes and impact pass

- **Finding and fix:** Projects with multiple change requests had no control for reopening an earlier request. A labelled request picker now exposes each request by title, status and identifier; a component test switches between two requests. Creating a request now preselects only a locked baseline, consistent with the available choices.
- **Affected artifacts:** The picker and impact list show artifact names as well as types and identifiers. At 500 × 700, selector labels no longer reserve hundreds of pixels of empty space; the selected artifact's full name is also displayed below the control. Checked the populated APNK selector without creating or changing a request. Multiple-request navigation was tested in a component fixture; patch implementation and the remaining editing states need further live review.

## Checks and safeguards pass

- **Finding review:** The rationale field was squeezed into a small inline box. It is now a labelled multiline editor with separated actions. Switching between findings preserves unfinished notes while the page remains open; saving still records the decision, and cancelling discards that note. A component test covers switching without recording a decision. Checked the open resolution form at 500 × 700 without saving a stakeholder decision.
- **Rule editor:** Its control now reports whether it is expanded and offers a clear close action. The page heading matches the navigation label, and summary metrics use two columns on narrow screens. The actual addition and deletion of project rules were not retested in this pass.

## Document workspace pass

- **Layout:** Export options are grouped under a labelled disclosure, bringing document selection and editing closer to the top. On narrow screens the document library stacks its heading and entries, giving long names more room. Checked the APNK working document and the expanded export choices at 500 × 700; exports were not rerun in this pass.
- **Review mode:** Undo and Redo, including the keyboard shortcut, are now unavailable in review mode; the selected mode is announced through its button state. A component test confirms that an existing edit cannot be undone until Edit mode is restored. Document comments and remaining review actions still need further evaluation.

## Document comments pass

- **Comments:** The Comments button previously inserted a fixed generic comment immediately and provided no way to read or write review notes. It now opens a panel showing existing comments and their status, with an explicit authoring field and controls to resolve or reopen a comment. Document undo and redo preserve comments. Checked the empty panel at 500 × 700 without adding a note to APNK; a component test covers authored notes, resolution and preservation through undo. Diagram comments and remaining review actions still need evaluation.

## Diagram comments pass

- **Comments:** Diagram comments had the same preset-note behavior. The Comments button now opens a panel for actual notes, including resolve and reopen actions; unfinished text is kept separately per diagram while the workspace remains open. A component test checks opening, authoring and resolving. Checked the empty panel at 500 × 700 without recording a comment in APNK. The footer now wraps its version and link counts at narrow widths. Other diagram review and approval states still need inspection.

## Diagram editing pass

- **Node editor:** Evidence links previously appeared under every node even though they belong to the whole diagram. They are now shown once with their scope explained, and node fields have distinct accessible names. At 500 × 700 the diagram preview and node list now scroll independently, keeping the editor reachable on long diagrams; the scroll regions can receive keyboard focus.
- **Save:** Saving without source changes is disabled, avoiding an unnecessary new version and withdrawal of approval. A component test covers the unchanged state. Checked the populated APNK diagram at 500 × 700 without editing or approving it; focus mode and other diagram types remain to be checked.

## Project list pass

- **Finding projects:** The project list now supports searching by name, folder, domain or workflow stage, with a result count and a clear no-results state. A component test checks filtering and clearing across multiple projects. Checked the no-results state at 500 × 700 in the restored workspace; a live workspace with many projects and project deletion were not exercised in this pass.

## Guided workflow filter pass

- **Clarification queue:** Switching priority filters previously unmounted hidden questions and discarded unsaved answer text. Drafts now remain while switching filters on the page, and an empty filter explains how to show all questions. Filter selection and checklist actions have distinct accessible names. Checklist actions targeting the current workflow now bring the clarification queue into view and clear its filter. A component test covers draft preservation; the Optional filter was checked at 500 × 700 without recording an answer. Drafts are still temporary when leaving the page.

## Assistant conversation pass

- **Drafts:** Unsent text previously followed the user between conversations, creating a risk of sending it in the wrong context. Drafts are now held separately for each conversation while the page remains open; a component test checks switching. The send flow only clears the original draft if it has not changed while source checks were underway.
- **Proposal review:** On a narrow window the Before and After content was squeezed into columns. It now stacks, with an explicit message for empty content. Checked a pending APNK question at 500 × 700 without accepting or rejecting it. Conversation drafts remain temporary when leaving the page; sending and other proposal types were not retested live in this pass.

## Assistant references pass

- **Open referenced work:** Assistant context and message links previously opened the general section, which could show a different record. Links now carry the selected identifier for sources, requirements, stories, diagrams, documents, change requests and governance findings. Document-section identifiers select the containing document and focus the section. Missing references show a message. Checked an APNK source link and a governance finding in the running application; component tests cover a second source, a missing source, a specific change request, a document section and a governance finding.

## Artifact content search pass

- **Requirements and stories:** Search now includes requirement statements, rationales, business rules and fit criteria, and story role, goal, value and acceptance criteria, as well as the owner. Select all still applies only to displayed results. Checked an APNK requirement by text absent from its title, and component tests cover requirement and story content searches. Advanced filters and larger lists remain to be evaluated.

## Goal readiness pass

- **Goal cards:** A disabled completion action previously relied on hover text to explain its prerequisites. Cards now show the next completion requirement, including outstanding Approve-stage checklist items where applicable. Workflow indicators have accessible stage and status names, and long goal names can wrap. Checked the active APNK goal at 500 × 700 without changing it; a component test checks the unfinished-goal explanation. Planned and completed goal cards and their actions still need live review.

## Project settings draft pass

- **Project setup and policy list:** Unsaved edits were lost when navigating away. Drafts are now kept separately per project while the application remains open, with visible unsaved notices and discard controls. A browser leave warning also applies after moving to another page. Checked a temporary project-name edit across Goals and back without saving it; a component test covers setup and policy drafts. The drafts are in memory and do not survive reload. The page title now matches navigation, and member role and approval controls identify the person they affect. The policy proposal and folder-reconnection workflows still need further review.

## Policy proposal review pass

- **AI policy proposals:** A replacement list previously made removed policies difficult to spot. The review now shows additions and removals against the current editable list, with the full proposed list available separately and an explanation that saving remains a separate step. Locked core policies are retained in the reviewed list. A component test covers additions, removals and retained core policies; no live model proposal was generated in this pass, and folder reconnection remains to be reviewed.

## Next review priorities

### Clarification draft preservation follow-up

- Unfinished clarification answers and confirming-person fields now remain available per project and question when navigating away from the workflow and back during the same application session. An unsaved notice and discard action are shown, and leaving or reloading the app triggers the browser's unsaved-work warning. If the saved question or answer changes while a draft is held, the user is prompted to review it. Drafts are in memory, are not part of project backups or records-only recovery, and do not survive reload or application closure. A component test covers leaving the workflow and returning, plus discarding the draft; the full browser unload and multi-window interaction have not been independently exercised for this change.

Continue through all screen and dialog states, including Checks, History, the rest of Settings, document and diagram studios, and the untested states of Sources, Registers, Evidence links, Changes and Templates, at common and small window sizes. Pay particular attention to excessive scrolling, unclear primary actions, long labels, dense content, bulk selection and focus behavior. Run a keyboard and screen-reader pass and moderated analyst sessions; do not infer usability from automated tests alone.

## Verification

The latest full frontend suite passed 213 tests, including component tests for artifact, goal-source, proposal, synchronization and change-request selection; TypeScript and production build passed. Visual checks used a local restored project and an isolated copy in the in-app browser, not all 100+ screens or platforms.
