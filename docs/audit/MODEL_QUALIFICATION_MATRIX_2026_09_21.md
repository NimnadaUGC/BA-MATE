# BA Mate model qualification matrix — 2026-09-21

This matrix distinguishes an adapter that connects from a profile that has completed BA-task qualification. A profile is eligible for the pilot only when every synthetic task passes, a BA records correction counts for every task, and the BA explicitly approves that exact provider/model/settings combination.

| Provider/profile | Fixed case | Clarify | Requirements | Validate | Diagram | Document | Impact | Status / known limit |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Ollama / qwen2.5:3b / local http://127.0.0.1:11434 / 8,192 context / 1,024 output / temperature 0.2 | Synthetic leave request, 48-hour expiry | Pass, 3.36s | Pass, 8.43s | Pass, 3.25s | Pass, 3.11s | Pass, 4.75s | Pass, 6.41s | Structured-task pass only. Human correction review is still required; do not claim quality/equivalence. |
| OpenAI / direct BYOK | Not run | — | — | — | — | — | — | Unqualified: native adapter and fault-path tests pass; no live participant/researcher key or model profile was supplied. |
| Gemini / direct BYOK | Not run | — | — | — | — | — | — | Unqualified: native adapter and fault-path tests pass; no live participant/researcher key or model profile was supplied. |
| OpenRouter / BYOK | Not run | — | — | — | — | — | — | Unqualified: no participant key or live test was supplied. Adapter and fault-path tests pass. |
| Hugging Face Inference Providers / BYOK | Not run | — | — | — | — | — | — | Unqualified: no participant key or live test was supplied. Adapter and fault-path tests pass. |

## What was measured

The local run used only the fixed synthetic case, never project material. Each task went through the normal context construction, strict provider schema, evidence-ID validation, response validation, latency/usage receipt and local model-run recording. The local device reported the installed Ollama profile; accelerator memory is intentionally not guessed by the service and can be added to the local qualification report by the researcher.

The app’s AI connection page now retains a local report with provider/model, context/output/temperature/timeout settings, framework and prompt version, latency, reported token/cost values (or unavailable values), failure category, system memory, and human correction count per task. It also provides explicit session-key removal.

## Fault coverage and limits

Automated provider contract tests cover unavailable endpoint, invalid key, quota/busy response, timeout, output truncation and unreadable/unsupported structured output. The long-context path records included, omitted and partial evidence identifiers; the workbench exposes those omissions for BA review.

No smaller-model equivalence or provider quality claim is made from this matrix. A pass means only that the profile produced a valid structured proposal on this fixed synthetic case. Real-study use requires the recorded human review and any provider-specific live recheck immediately before the study.
