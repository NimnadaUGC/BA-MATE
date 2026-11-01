# BA Mate 0.4 implementation verification

Dates: 11–12 September 2026. This record describes synthetic developer checks, not participant evaluation or research findings.

## Automated checks

- Frontend: 28 tests passed; TypeScript check passed. Covers blocker rules, full project export/import, evidence availability, pending-to-draft proposal acceptance, original/edited response preservation, stale proposal rejection, immutable baseline contents, real restore/recovery, revalidation after answer changes and rejecting incomplete evidence coverage even when its displayed percentage rounds to 100.
- Backend: 27 tests passed. Covers extraction/originals, local origin/session boundary, secret exclusion, workspace revision conflicts, structured output rejection, cloud permission/confidentiality, context omissions, evaluation configuration changes and provider HTTP contracts.
- Ollama/OpenAI/Gemini/OpenRouter/Hugging Face HTTP contract tests use controlled fake HTTP responses. They do not establish current external provider availability or model quality.
- Both updated Mermaid sources parsed successfully with the installed Mermaid library in a DOM environment.
- Production frontend build passed. A large Mermaid-related bundle warning remains; feature loading is already split but low-end device performance needs measurement.
- Frontend production dependency audit: zero reported vulnerabilities after updating the transitive nanoid dependency. Two moderate development-only Vitest/mocker advisories remain on the current test runner. The suggested major upgrade requires a supported Node runtime; this machine's Node 23 is outside Vitest 5's supported engine range. Do not expose the test runner as a server. This is not a comprehensive dependency/security audit.

## Real local inference rehearsal

Environment: existing Ollama with `qwen2.5:3b`; no weights downloaded, no paid API key used. Data directory: `tmp/integration-workspace`, separate from the normal workspace. Synthetic case: library reservations.

1. Imported an actual text fixture. Checked extracted text/original retention and approved the source manually.
2. Ran clarification generation through the interface. The model returned questions in approximately 17.9 seconds. The BA edited and accepted one blocking question, then recorded a fixed 48-hour expiry and librarian responsibility. The blocker cleared only after saving the answer. Reload retained source and clarification data.
3. Ran requirement/story generation. A response in approximately 12.9 seconds ignored the fixed answer and invented configurable expiry. Rejected it; retained its original output.
4. Strengthened the prompt's handling of answered decisions. A second response in approximately 13.4 seconds included 48 hours but still invented configuration and omitted the clarification citation. This remained substantively incorrect.
5. Added recorded-answer reminders and editable evidence references to proposal review, plus advisory reminders for missing confirmed quantities and uncited answers. The BA corrected the requirement and acceptance criterion, cited the source and clarification, selected only that requirement and accepted it as a draft. The original AI response remains separately available in the full project package.

6. Diagram attempts initially failed task-scope and Mermaid checks. Refined the task-specific schema and clarified that the diagram `source` field contains Mermaid code. Prompt version `evidence-workflow-3` then returned syntactically valid Mermaid in approximately 11.6 seconds, but invented notification steps despite contrary instructions. This required BA correction; valid rendering was not treated as semantic correctness. Invalid Mermaid responses are retained as rejected attempts in the updated interface. Original and reviewed proposals can be inspected in task history. Proposal previews now show the exact diagram being reviewed. Removed the unsupported notification steps in the review form, accepted only the diagram, and verified its three-step flow and Draft status in Diagram Studio.

The rehearsal demonstrates an operating model-to-review-to-draft path and exposes an important model-quality failure. It does not show that low-parameter models are sufficiently precise, that the framework eliminates hallucination, or that the framework improves outcome measures.

A subsequent quality-review task completed while the interface was on Settings. Its proposal and assistant-request event remained attached to the originating synthetic project and workbench, verifying navigation-safe recording. No evaluation run was active for that developer check.

## Packaging and outstanding verification

A native Apple Silicon macOS app was built with Electron and a PyInstaller Python sidecar. The final package launched its bundled service on a loopback port and displayed an empty workspace. Its configuration endpoint reported `ba-framework-0.4.0` and `evidence-workflow-3`. The package contains application resources only, not local test workspaces or API keys. It is unsigned and has not been notarized or tested on a clean participant device.

Live OpenRouter/Hugging Face calls, Windows/Linux builds, signed distribution, multi-user hosting, full peripheral-feature completion, large-workspace performance and external blinded BA quality assessment remain unverified. See PILOT_GUIDE.md for the controlled rehearsal and release boundaries.
