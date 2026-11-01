# BA Mate Installation and AI Setup
Application guide 1 | BA-MATE 1.0.0-beta.3 | 1 November 2026

This guide helps beta testers install BA Mate, open the correct workspace and connect an AI model. Finish the checks here before following Guide 2, Complete Workflow. You can create and review BA work manually if AI is unavailable.

The application implements F4-draft.1 (v1.0.0) and accompanies BA-MATE-SKILL v1.0.5. These are separate deliverables: installing the SKILL does not install the application. Use the application version supplied by the researcher for your beta session.

## Choose your setup path
| Your situation | Start here |
| --- | --- |
| Apple Silicon Mac and researcher supplied application | Packaged Mac installation on page 2. Python and Node are not required. |
| Researcher assigned a source checkout | Source installation on page 3. Requires development tools and internet for setup. |
| Windows or Linux tester | Ask for the assigned source setup. This release has no qualified Windows installer. |

## In this guide
- Packaged Mac installation and first launch — page 2
- Optional installation from source — page 3
- Connect an external AI provider — page 4
- Connect a local Ollama model — page 5
- Project permission and safe context — page 6
- Qualification and final setup checks — page 7

**Before you begin.** Obtain the release and any assigned study instructions directly from the researcher. Use the fictional practice source in this guide pack for familiarisation. Keep your own API key private. External AI requests may use paid credits.

**Release boundary.** Beta.3 is intended for a small supervised Apple Silicon Mac beta. The supplied Mac preview is unsigned and not notarised; clean-device installation and Windows distribution remain unqualified. Record installation problems rather than working around security controls.

<!-- page -->
## Packaged Mac installation
**Path:** Finder → researcher supplied release → BA Mate.app

1. Confirm your Mac uses Apple Silicon in Apple menu → About This Mac. Obtain the beta.3 archive or application from the researcher and expand the archive if necessary.
2. Copy **BA Mate.app** into Applications, or the installation folder agreed with the researcher. Launch the copy from that folder. Avoid running it from inside an archive or replacing an application that is still open.
3. If macOS blocks an unidentified developer or an unnotarised app, first confirm that this is the unchanged copy supplied by the researcher. After attempting to open it, macOS may offer **System Settings → Privacy & Security → Open Anyway**, followed by **Open**.
4. If macOS reports malware, a damaged app, or an organisation policy restriction, stop and send the warning text to the researcher or your IT contact. Do not disable Gatekeeper or run security-removal commands.
5. Wait for the local service to start. BA Mate should open the Projects workspace. Confirm the release shown in the app is **1.0.0-beta.3** before using it for the assigned test.

**Expected result.** You can open Projects and Settings. The application starts its own local service; you do not need to start Python, Node or a web server. Its internal loopback address can change on each launch. Open the app normally instead of bookmarking that address.

## First launch and closing
Open **Settings** to configure AI using pages 4 or 5. Creating a project does not require a successful AI connection. Existing demonstration projects are examples; create a separate practice project for this exercise.

Wait for **Saved on this device** before quitting. If a close warning says the latest changes have not finished saving, choose **Keep working**, wait and retry. Use the recovery guidance in Guide 3 if saving continues to fail. Quitting the native app stops its local service and clears any key entered for that service session.

**Stop and check.** Do not proceed with real project material until the researcher has approved your setup and the source-handling arrangements.

**Official help:** [Apple guidance for apps from unidentified developers](https://support.apple.com/en-us/102445). The exact warning and available controls depend on macOS and device policy.

<!-- page -->
## Optional installation from source
Use this path only when the researcher supplies a source checkout. These instructions do not qualify a Windows or Linux release. Run commands in the **BA-MATE folder**, the folder containing start.py, backend and frontend.

1. Install Python **3.10 or later** and Node.js **22.12 or later on the 22.x line, or 24 or later**. Ensure npm is available. Open Terminal on macOS/Linux or PowerShell on Windows.
2. Change to your checkout. Replace the example path with the location on your computer; keep quotes around paths containing spaces.
```text
cd "/path/to/BA-MATE"
```
3. Run setup once. It creates backend/.venv, installs backend dependencies, installs frontend dependencies and builds the frontend. Downloads require internet access.
```text
python3 start.py --setup
```
4. Start BA Mate. Leave this terminal open while using the application.
```text
python3 start.py
```
5. Open **http://127.0.0.1:8000** if the browser does not open automatically. Stop the source service with **Ctrl+C** in its terminal when finished.

**Windows commands.** In PowerShell replace the example path and run:
```text
cd "C:\path\to\BA-MATE"
py start.py --setup
py start.py
```
If py is unavailable, use the Python command assigned during installation. Do not type the example paths literally.

**Port already in use.** Check whether your existing BA Mate session is already running. Otherwise choose another port, for example `python3 start.py --port 8001`, and open **http://127.0.0.1:8001**. Do not stop an unrelated service merely to free the default port.

**Expected result.** Projects and Settings load without a service error. The packaged app and source launch use the same default local data directory for your operating-system account. Close one before using the other; do not run different versions against the same workspace simultaneously.

**If setup fails.** Record the failing command and relevant error, without credentials. Check your tool versions and internet connection before retrying. A source installation does not download an Ollama model; page 5 covers that separately.

<!-- page -->
## Connect an external AI provider
**Path:** Global sidebar → Settings → model connection controls

1. Obtain an API key or token from the provider assigned for your test, with the required model access and credits. A provider account password is not an API key.
2. Choose **Provider** first. Changing provider clears the model and key fields. Enter the provider's exact **Model identifier**, including its organisation prefix where required.
3. Paste the key into the provider key field. Avoid screenshots containing the key. Do not place it in chat, a source file, project notes or feedback.
4. Choose **Save and test connection**. This saves the profile and sends a small fixed connection prompt, without project content. It can still consume provider credits.
5. Read the result. If it fails, resolve the stated error before running project AI. **Save settings** alone saves the profile without testing it.

| Provider choice | Credential and model identifier |
| --- | --- |
| OpenRouter | OpenRouter API key and an exact model slug such as author/model. The earlier beta test used google/gemini-2.5-flash-lite; use the model assigned for your session, as availability may change. |
| OpenAI direct API key | OpenAI API key and an API model ID available to your account. Use API credentials rather than a ChatGPT login. |
| Google Gemini direct API key | Gemini API key from Google AI Studio and an available Gemini model ID. |
| Hugging Face Inference Providers | Hugging Face token permitted to use Inference Providers, plus an accessible model ID. |

**Session keys.** Keys entered here remain in local service memory until the service closes. They are excluded from settings files, project backups and research exports. Re-enter your key after a fresh app/service launch. To clear an entered key, save or discard pending connection edits, then choose **Remove session key**. Environment-managed credentials may remain available outside this control.

**Checkpoint.** A successful connection proves connectivity for this profile. It does not grant permission to send a project's context or prove that the model can produce valid workflow proposals. Continue to pages 6 and 7.

**Provider setup references:** [OpenRouter](https://openrouter.ai/docs/quickstart), [OpenAI API](https://developers.openai.com/api/docs/quickstart), [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key), [Hugging Face](https://huggingface.co/docs/inference-providers/en/guides/first-api-call).

<!-- page -->
## Connect a local Ollama model
**Path:** Settings → Provider → Local or organisation Ollama

Choose this route when the assigned work requires local processing or when the researcher provides a suitable local model. The application does not bundle Ollama or model weights. Downloading a model requires internet; running a downloaded local model requires sufficient memory and processing capacity.

1. Install and start Ollama using its official instructions. Use a **local model**, rather than an Ollama cloud model, when material must stay on your computer.
2. Download the model assigned for your test. The application's default example is:
```text
ollama pull qwen3:8b
```
3. In BA Mate select **Local or organisation Ollama**. Enter **qwen3:8b**, or the exact identifier of the model you actually downloaded, in **Model identifier**.
4. For Ollama on the same computer, set **Ollama address** to:
```text
http://127.0.0.1:11434
```
5. Choose **Save and test connection**. If BA Mate cannot reach Ollama, confirm it is running and the address and model name match. If the model exhausts memory or times out, consult the researcher about a suitable smaller model or reduced context budget.

**Expected result.** The fixed connection test succeeds. No API key is needed for the ordinary local Ollama setup. Local inference can be much slower than a hosted model, particularly for the first request.

**Organisation server.** A server on another computer is a separate processing destination. Use the approved HTTPS address and confirm who operates it and which material may be sent there. Calling a service “Ollama” does not mean it runs on your own device.

**Background source processing.** Automatic source triage uses local Ollama rather than silently switching to the configured external provider. If that background model is unavailable, inspect and review the extraction manually. This does not prevent manual BA work or an explicitly requested external task with permission.

**Official setup:** [Ollama quickstart](https://docs.ollama.com/quickstart). Use the local model and hardware configuration agreed for the beta; this guide does not prescribe one model for every computer.

<!-- page -->
## Project permission and safe context
**Path:** Open project → More tools → Project settings → Project AI processing

Three separate decisions control AI use. Keep them separate during testing.

| Decision | What it means |
| --- | --- |
| Connection profile | Settings identifies a reachable provider and model. |
| Project processing permission | Project settings determines whether this project's context may be sent to the configured external provider. |
| Human review | You decide whether a suggestion is supported, acceptable and ready for approval. AI cannot make this decision for you. |

1. For practice, create the fictional checkout project described in Guide 2. Review the source classification in **Sources** before requesting AI.
2. If an external provider is assigned, enable the project's external processing preference only when authorised to send its material there. This preference saves immediately. Leave it disabled when external processing is not permitted.
3. Review and accept the extracted sources, then explicitly select the current reviewed sources for the active goal. A source being present in the project does not select it for every goal.
4. Before **Run selected task**, expand **Comparison mode and included evidence**. In chat, inspect the attached context. After a response, read the context receipt for included, omitted or partial evidence.

**Confidential material.** Confidential source classification blocks external processing, including derived project context. Removing a source from one selection is not a way to bypass this restriction. Use an approved local model or continue manually. Do not relabel material merely to make an AI request succeed.

**Context limits.** A large project is not automatically sent in full. The receipt records what fitted. If important evidence was omitted or only partly included, narrow the task, reduce attachments or use a profile approved for that context size. An evidence ID in a response is a reference to inspect, not proof that the claim is true.

**Stop and review.** If ownership, permission, classification or source currency is uncertain, resolve it before sending. The optional project-description AI control also has its own permission step; it is not a substitute for project-level processing permission.

<!-- page -->
## Qualification and final setup checks
**Path:** Settings → model connection → Run synthetic qualification

Run qualification when the researcher asks you to qualify a model profile. It makes multiple requests and may incur costs. For ordinary familiarisation, use the assigned profile and protocol rather than repeatedly qualifying it.

1. Save the intended provider, model and limits. Choose **Run synthetic qualification**. The app uses a fixed fictional leave-request case, without project content, to check six structured tasks: clarification, requirements, validation, diagram, document and change impact.
2. Inspect every result through **View synthetic proposal**. Compare it with the stated task and confirmed 48-hour expiry policy. Record an integer **Human corrections** count for each passing task; explicitly enter **0** if none are needed.
3. If all tasks passed and you judge the exact profile suitable, tick the profile approval statement and choose **Save human review**. If any task failed or evidence is insufficient, retain the unqualified state and discuss it with the researcher.
4. Revisit qualification when the provider, model or limits change. A previous report describes its recorded profile. Compatibility checks and a human review do not establish business correctness for a new project.

## Model limits
Open **Advanced model limits** only when necessary. **Context capacity** includes input and reserved output; **Maximum output** may also cover model reasoning. OpenRouter can discover published limits, use full capacity or a smaller manual budget, and **Refresh model limits**. Other profiles use manually configured limits. Larger numbers do not guarantee better answers.

Keep values within the provider's limits and the local hardware's capacity. On truncation or invalid structured output, preserve the error, narrow the task and consult the researcher before changing the assigned test profile. Use **Cancel request** or chat **Stop** if you need to stop waiting.

## Ready to begin Guide 2
- Correct beta.3 app opens, and Projects and Settings are usable.
- Source setup service is running, or the native app starts its own service.
- Assigned AI profile connects, or a manual practice route is agreed.
- You understand that project permission and human approval are separate.
- You have a safe practice source and know where to save a project backup.

**Next:** Guide 2 walks from a new project to an approved baseline and a controlled change. Guide 3 covers saving, backup, recovery and reporting beta feedback.
