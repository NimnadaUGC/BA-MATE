# Verification record — Steps 4–5 audit

Performed 20–21 September 2026. Current BA Mate 0.4 source; development browser build on this Mac. Synthetic data only. No paid inference, participant collection, live cloud-model call, hosting deployment or release publication occurred.

## Completed checks

| Check | Result | Limit of conclusion |
|---|---|---|
| Existing frontend suite | 28 tests passed across four files | Existing assertions, not full BA journey coverage |
| Existing backend suite | 20 tests passed | Provider HTTP responses are mocked; no live model qualification |
| TypeScript type check | Passed | Not runtime or semantic correctness |
| Production frontend build | Passed in isolated audit output | Large-chunk warnings remain; no low-resource performance benchmark |
| Browser route smoke | 15 project routes; no browser page errors captured | Rendering and control discovery, not exhaustive action execution |
| Requirement approval with blocker | Reproduced defect A01 | Synthetic requirement became approved while a blocking finding remained |
| Baseline/stale dependency probes | AUD-01/AUD-02 reproduced defects; AUD-03 demonstrated whole-project scope coupling | Three diagnostic assertions plus one fixture-preparation test; passing means current problematic behaviour was observed |
| Document cross-document undo | Reproduced A04 | Edit A → create B → Undo replaced B with A content/name; code also copies A identity |
| Sync review | Reproduced incomplete mapping A06 | Approved FR-01 preview contained title/statement and placeholder prior text, without its criteria |
| Download smoke | Markdown 722 bytes; DOCX 9,213 bytes; PDF 4,788 bytes | Small synthetic document only; no visual/fidelity qualification |
| Hosting | Official public listing reviewed; user-supplied plan recorded | Actual account and installer permission not verified |

The route set was overview, goals, workflow, conversations, sources, artifacts, registers, traceability, diagrams, documents, changes, governance, activity, evaluation and team. The fixture was an explicitly synthetic clone of the built-in example with a blocking finding. It is not company data or an evaluated participant case.

## Isolation and reproducibility

Build and local workspace were placed under `BA_MATE/tmp/audit-2026-09-20/`, separate from the normal participant workspace. The loopback server used port 8769. The audit did not intentionally mutate application runtime sources or the normal workspace. Temporary diagnostic probes were kept outside the standard test suites because they assert current defects and must not be mistaken for corrected-behaviour regression tests.

Durable evidence is under [evidence](evidence/README.md): diagnostic output, action output, route result summary, screenshots and source hashes. Hashes identify inspected code; they are not signed attestations. Temporary browser scripts and fixture files remain in the isolated audit folder for developer reproduction.

Reproduction conditions:

1. **A01:** create a requirement and blocking finding; submit requirement for review; press its Approve control. Current UI permits approved status.
2. **A02:** link an approved requirement to an approved document; edit the requirement statement; apply the store's version enforcement. Requirement becomes draft, linked document remains approved.
3. **A03:** satisfy current requirement/story/document review and verified-support checks; retain a draft process model and stale diagram embed. Current `approvalAllowed` still returns true.
4. **A04:** open document A, change a block style, create document B, press Undo. The document library contains two A entries instead of distinct A and B.
5. **A06:** select the approved requirement and open Create/update SRS. Compare the proposal with the requirement's criteria and the actual target document; content and prior-text omissions are visible.

## Inconclusive and untested areas

The new-project wizard was exercised but this harness did not conclusively verify its saved/reopened project. It is not recorded as a product persistence failure or a completed journey. An initial export/action script timed out because an exact button label omitted a count suffix; the corrected locator succeeded. These harness issues are not product defects.

No full J1/J2/J3 journey passed in this audit. Not covered: live Ollama/OpenRouter/Hugging Face inference, native Windows/macOS installers on clean devices, production accounts/consent/upload, updater/migration, real-company content, comprehensive accessibility, concurrent processes, large-project load, visual PDF/DOCX review or penetration/dependency-security assessment. Source-derived findings are labelled separately in the [feature audit](FEATURE_AUDIT_2026_09_21.md).

These observations test prototype readiness. They do not establish improved BA accuracy, efficiency, model equivalence, participant usability or empirical framework validity.

## Documentation closeout

Checked local Markdown links and code-fence balance across the nine created/updated documentation files: no missing targets or unbalanced fences. Evidence JSON parsed successfully. The isolated audit server was stopped after the checks. Framework diagrams and application runtime source were not changed during this audit; the architecture sketch in the hosting plan is a new documentation diagram.
