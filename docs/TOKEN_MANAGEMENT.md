# Model-aware token management

Implemented 29 October 2026. This change covers token budgets, not processing-permission redesign, retrieval, summaries, or automatic document batching.

## Settings

In Settings → AI connection → Advanced model limits, OpenRouter offers **Use full model context capacity** or a smaller manual budget. Model discovery reads the public OpenRouter catalogue without sending project content or credentials. The model/top-provider context limit and published maximum completion limit are displayed; individual endpoints and account quotas may differ. The prototype 65,536 context and 8,192 output ceilings have been removed. Existing saved profiles retain their manual budgets until changed, and choosing OpenRouter for a new connection selects model-capacity mode. Output remains an explicit allowance so a model's entire window is not inadvertently reserved for generation.

Discovery is cached for one hour, can be refreshed, and reports unavailable or stale data. Unknown automatic capacities stop a request with an actionable error; manual profiles remain available when discovery is unavailable. Model changes use their own discovered limits, not the previous model's. Ollama and other existing providers use manually specified limits; larger local Ollama windows require suitable device memory.

## Request preparation

Workflow and chat context now uses a cached reference tokenizer estimate with 20 percent overhead, a separate safety margin, and explicit output reservation. Instructions, JSON serialization/escaping and the separate structured-output schema are accounted for. This is not an exact tokenizer for every provider: estimates are labelled and successful provider-reported usage remains authoritative. Without cached tokenizer data, the service uses a conservative UTF-8-byte estimate and does not download tokenizer data during a project request. Source setup warms the tokenizer cache; the desktop build script includes the encoding with its service.

Evidence is still selected by priority and truncated or omitted when needed. Recent history uses remaining space. The old fixed 100-reference and 30-history-message request limits and the frontend's silent last-20-message cutoffs have been removed; the token budget determines inclusion. Existing per-item extraction limits still apply. The workbench, conversation and inspector disclose estimate/partial/omitted context, including omitted history. The shared provider boundary also checks that direct setup/background requests fit their budget; it refuses oversized material rather than silently dropping it.

All providers preserve explicit errors for cut-off outputs. Those errors now include the allowance used and explain that model reasoning can consume output space. There is no automatic paid retry or automatic project mutation.

## Verification boundaries

Automated coverage includes million-token capability discovery/cache, independent output validation, model changes, unknown/offline discovery, Unicode/escaped JSON/schema budgeting, large-reference/history collections, and oversized output reservations. A live synthetic request on NVIDIA Nemotron via OpenRouter used 223,756 provider-reported input tokens and retrieved an end marker with all four sources included. That verifies use beyond the old context ceiling; it is not an exhaustive one-million-token accuracy benchmark. Published one-million-token capacity was discovered, not fully stress-tested.

Retrieval by relevance, original-document chunking, provider-exact token counting, a pre-send coverage preview, automatic output continuation, and financial spending caps remain separate work. More available context does not guarantee that every project artifact is selected or that model output is factually correct.
