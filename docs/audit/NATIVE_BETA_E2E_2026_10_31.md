# Native Mac beta workflow — 31 October 2026

Objective: open the actual new Mac preview, test the core workflow end to end, fix essential failures, rebuild and retest before beta handoff. This is engineering evidence on this Mac, not a clean-device or cross-platform qualification.

## Execution plan

- Native Electron launch and file picker; a new synthetic project and source, leaving existing analyst projects untouched.
- Setup → Discover → Clarify → Define: stakeholder and confirmed decision, live AI proposal review, selective adoption and acceptance criteria.
- Validate → Approve: individually verified evidence, document synchronization and process narrative, approval scope and a locked B1.
- Controlled change: update confirmed evidence, review concrete statement/criteria/document patches, implement atomically, reverify affected work, synchronize documents, revalidate and create B2. Confirm B1 is unchanged and complete the goal.
- Quit/reopen the rebuilt native preview; inspect persisted content, source originals, history and baseline revisions. Test the assistant, native folder/file operations and cancellation along that path.
- Regressions, typecheck, build and bundle/service version agreement; record exact limits and final artifact.

## Essential failures found and repaired

1. Document studio leaves Submit for review enabled after submission, and offers the same action even on an approved document. Correct the status actions so they reflect the current state and do not repeat or silently demote a review.
2. Changes & impact can draft only a requirement statement patch; requirement acceptance criteria cannot be included in the controlled change. A 500→300 rule change therefore cannot update its boundary examples through the same reviewed change.
3. A document impact defaults to its first block with no block chooser. The native test needs the second requirement block, so the default would target unrelated text unless the user leaves this workflow and edits manually.

## Evidence recorded

The original 1.0.0-beta.1 preview launched at loopback port 56487. Native UI created NATIVE BETA E2E — Synthetic Cash Checkout, imported checkout-source.txt through the native picker, reviewed and selected SRC-01, recorded a synthetic shop owner/cashier stakeholder and a confirmed maximum-change answer of 500, generated two requirements with real OpenRouter/Gemini, reviewed and tightened their criteria, verified three evidence relationships individually and approved the two requirements. The SRS was built through reviewed synchronization, a textual process paragraph was added, the document was submitted and baseline B1 was approved with a clearly labelled synthetic approver.

B1 manifest: FR-6843b47b v1, FR-a4be056d v1, DOC-mvwolu0e-009 v4. Its complete version-record SHA-256 was 8d181b50bb6368bec757b2ccd4401d8738c521784bd387f779e90a7f89abc2eb. The saved record is retained under ignored tmp/native-beta-e2e-20261031 for later comparison. Approvals and business rules in this project are synthetic test decisions only.

## Repairs verified in beta.2

- Requirement acceptance criteria can now be added as a separate version-pinned patch in the same change request as its statement. Statement and criteria apply as one content revision per artifact, including when several document blocks are updated together.
- Document patches expose an exact block chooser, labelled with section and linked artifact/type; changing the target resets its before/after content so the analyst reviews the newly selected block.
- Patch review uses readable stacked current/replacement panels rather than squeezing labels, content and selectors into one row.
- Document status actions now show In review without allowing repeat submission, offer Return to draft, and require Create working revision for approved content.
- Goal completion now checks current review status and evidence dependencies even when content revision numbers still match an earlier baseline. Changing a confirmed answer invalidated the affected reviews/links; native testing confirmed completion stayed blocked until the work was revalidated and B2 approved.
- Saved conversations use the evidence scope of their own goal. Completed or inactive goal conversations provide answers only. They retain usable current source attachments without exposing artifact mutation proposals or borrowing another active goal’s scope.
- The overview distinguishes saved completed work from a fresh project, and no longer presents a phantom in-progress workflow when there is no active goal.


## Completed native workflow

The confirmed maximum change was superseded from 500 to 300. Native UI reset the affected requirement/document reviews and evidence links. A single change request included the requirement statement, acceptance criteria and the exact second SRS block. Accepting and implementing all three patches advanced the requirement once to v2 and the document once to v5. The first requirement and the manual third document block remained unchanged.

Premature revalidation was blocked. After submitting the changed requirement/document for review and individually reverifying affected trace links, revalidation succeeded. B2 was approved with the synthetic approver; its manifest is FR-6843b47b v1, FR-a4be056d v2, DOC-mvwolu0e-009 v5. All Approve checks passed and the goal was marked Completed. B1 still equals the saved complete record.

The completed goal conversation retained its source attachment. Native keyboard mentions found the second requirement by title; Enter attached it without sending. A deliberately missing session credential produced the actual provider-key error and the previous-message recovery action. After supplying the authorized session-only credential, real OpenRouter/google/gemini-2.5-flash-lite answered with the current 300 rule. A follow-up correctly distinguished total 100/tender 400 (change 300, one receipt) from tender 401 (change 301, request smaller tender, no receipt). No mutation proposal was offered. Stop cancelled a further native request; the UI showed “Request stopped” and recovery controls. A first cancellation attempt finished before Stop could be clicked; the subsequent request was stopped immediately after its progress indicator appeared.

Quit terminated the old native loopback service. Reopening retained the completed goal, B1/B2 and saved assistant answers. The session credential was absent after restart. Original nonsecret provider settings were restored, and the final candidate was quit/reopened again. Its native overview visibly showed saved work and its Goals view showed Completed. The preview remains open for review.

## Final verification

| Check | Result |
|---|---|
| Frontend regression suite | 260 tests across 47 files passed |
| Backend suite | 69 unittest tests passed |
| TypeScript and production build | Passed |
| Whitespace | git diff --check passed |
| Native app / frozen service | Both report 1.0.0-beta.2 |
| Production frontend / native bundled frontend | SHA-256 manifest matches |
| B1 after controlled change and restart | Complete record unchanged |
| Unaffected requirement and document blocks | Unchanged |
| Original source | File SHA-256 matches recorded source revision |
| Existing projects | All nine original projects equal their before-test snapshots |
| Settings and credential | Original configuration signature restored; no session key after final restart |

The full desktop build produced beta.2; subsequent frontend repairs were production-built and copied into that candidate’s frontend resources. The final shipped resources were compared to frontend/dist and tested in the actual reopened native app. This record does not describe a fresh full desktop compilation after each frontend-only repair.

Candidate: `release/core-beta-1.0.0-beta.2-20261031/mac-arm64/BA Mate.app`.

Evidence: [reopened completed goal](evidence/2026-10-31-native/native-final-reopened-goal.jpg), [reopened overview](evidence/2026-10-31-native/native-final-reopened-overview.jpg), [B1/B2 native view](evidence/2026-10-31-native/native-baselines-B1-B2.jpg), [chat continuation and Stop](evidence/2026-10-31-native/native-chat-continuation-and-stop.jpg), [persistence assertions](evidence/2026-10-31-native/persistence-verification.json), [frontend SHA-256 manifest](evidence/2026-10-31-native/frontend-bundle-sha256.json).

## Circulation boundary

The requested core workflow is verified on this Mac using synthetic data. This is an unsigned Apple Silicon preview for a supervised beta; clean-device installation/Gatekeeper and Windows distribution remain unqualified. Other providers/models were not newly qualified by this native pass. Diagram/export expansion, hosting and broad visual redesign remain outside this essential repair scope. No participant outcomes or framework-validity conclusions follow from these engineering tests. No credential is included in the app or evidence.
