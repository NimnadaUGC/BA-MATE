# Model integration — BA Mate 0.4

The default model boundary now performs real inference. There is no mock fallback. `POST /api/v1/workflow/run` accepts actual evidence content, task, condition, history and external-processing preference. The backend budgets context, calls one configured provider, validates structure and supplied evidence IDs, and returns a proposal plus context receipt and run metadata. Accepted items become drafts in the frontend.

## Connections

- **Ollama:** `/api/chat`, with JSON schema in `format`, a configured context capacity, output budget and timeout. One local inference request runs at a time to limit pressure on modest hardware.
- **OpenAI:** `https://api.openai.com/v1/responses`, using the participant's OpenAI Platform project API key. Requests set `store: false`; structured tasks use strict `text.format` JSON Schema. ChatGPT subscriptions and sign-in credentials are not OpenAI API keys.
- **Gemini:** `https://generativelanguage.googleapis.com/v1/interactions`, using a Gemini API key. Requests set `store: false`; structured tasks use a JSON response format and schema. `GEMINI_API_KEY` is preferred for environment-managed use, with `GOOGLE_API_KEY` accepted as a fallback.
- **OpenRouter:** `/api/v1/chat/completions`, strict JSON schema and endpoints required to support requested parameters; provider fallback disabled for structured tasks.
- **Hugging Face:** `https://router.huggingface.co/v1/chat/completions`, strict JSON schema. Selected model/provider must support this feature.

Cloud keys remain in service memory or the process environment (`OPENAI_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`, `OPENROUTER_API_KEY`, `HF_TOKEN`). They are not written into workspace exports or settings files. Source content is transmitted only when the BA initiates a task and allows external processing. Any supplied confidential item blocks external inference. External organisational Ollama requires HTTPS and external-processing permission; an authenticated gateway is not yet implemented.

Provider support and pricing vary. Do not assume a free model identifier is currently available or suitable. The settings connection test checks reachability and a plain reply; a successful structured workbench task is also required before selecting a provider for a pilot. Native OpenAI, native Gemini, OpenRouter and Hugging Face adapters have provider-contract and fault-path tests but have not been qualified with live credentials in this implementation session. A successful connection test is not a model-quality result.

## Evaluation interpretation

Each successful proposal records requested/returned model, serving provider, framework/prompt version, condition, sampling configuration, latency, reported tokens/cost (null when absent), context hash and omitted/partial references. Original and reviewed proposals remain separately in the full project package. Rejected proposals remain in history. Failed attempts appear in UI research telemetry; the service does not yet retain a complete request/response archive for failures.

Configuration signatures prevent newly prepared evaluation runs from silently switching settings. Existing old run records have no signature. Generic AI uses a simpler prompt with the same evidence, schema, review interface and deterministic safeguards. This comparison estimates the effect of the prompt/workflow guidance within BA Mate; it is not a clean comparison of the entire product against unrestricted generic chat. Use a separate controlled condition/protocol to study that question.

The live Qwen2.5 3B synthetic check returned valid JSON but repeatedly invented an expiry configuration feature despite a recorded fixed 48-hour answer. Recorded-answer reminders, editable evidence references and advisory omissions checks help the BA review such errors. They are not a semantic correctness guarantee. Do not claim equivalence between small and advanced models without repeated, blinded quality assessment.

## Official interfaces

- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
- [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Gemini Interactions API](https://ai.google.dev/api/interactions-api-v1)
- [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)
- [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
- [Hugging Face chat completion](https://huggingface.co/docs/inference-providers/tasks/chat-completion)

These are integration references; provider availability must be checked at the time of each evaluation round.
