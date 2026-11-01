import { createPortal } from "react-dom";
import { ChatContextDisclosure } from "./ChatContextDisclosure";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  AtSign,
  ChevronRight,
  Code2,
  FileText,
  GitBranch,
  Link2,
  LockKeyhole,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import type {
  ArtifactReference,
  ModelContextReceipt,
  Project,
} from "./types";
import { artifactRoute, projectReferences } from "./references";
import { MentionTextarea } from "./ChatComposer";
import { useChatRequest } from "./useChatRequest";
import { assistantSessions, type AssistantMessage } from "./assistantSessions";
import { blockers } from "./store";
import { buildModelRequest, modelContextFingerprint, projectEvidence, requestModelCompletion } from "./modelGateway";
import { modelSourceProblems, sourceCheckFingerprint } from "./sourceScope";
import { verifyGoalSourceOriginals } from "./workspaceFiles";
import { notify, useDialogAccessibility } from "./ui";

const referenceUrl = (projectId: string, reference: ArtifactReference) =>
  `/projects/${projectId}/${reference.route ?? artifactRoute(reference.type)}?artifact=${encodeURIComponent(reference.id)}`;

export function AssistantDrawer({
  project,
  onClose,
  onNavigate,
  pinned,
  onPin,
  context,
  onOpenConversation,
  evaluationActive = false,
}: {
  project: Project;
  evaluationActive?: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  pinned: boolean;
  onPin: () => void;
  context?: ArtifactReference;
  onOpenConversation?: () => void;
}) {
  const saved = assistantSessions.get(project.id);
  const [prompt, setPrompt] = useState(saved?.prompt ?? "");
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [contexts, setContexts] = useState<ArtifactReference[]>(
    saved?.contexts ?? (context ? [context] : []),
  );
  const [messages, setMessages] = useState<AssistantMessage[]>(saved?.messages ?? []);
  const requestState = useChatRequest(project.id);
  const { sending } = requestState;
  const [requestError, setRequestError] = useState(saved?.requestError ?? "");
  const [failedPrompt, setFailedPrompt] = useState(saved?.failedPrompt ?? "");
  useEffect(() => { assistantSessions.set(project.id, { prompt, contexts, messages, requestError, failedPrompt }); }, [project.id, prompt, contexts, messages, requestError, failedPrompt]);
  const thread = useRef<HTMLDivElement>(null);
  const followThread = useRef(true);
  useEffect(() => { if (thread.current && followThread.current && (messages.length > 0 || sending)) thread.current.scrollTop = thread.current.scrollHeight; }, [messages.length, sending]);
  const submitted = useRef("");
  const root = useRef<HTMLElement>(null);
  const latestProject = useRef(project);
  const latestContexts = useRef(contexts);
  latestProject.current = project;
  latestContexts.current = contexts;
  const allReferences = useMemo(() => projectReferences(project), [project]);
  const filtered = allReferences
    .filter((item) =>
      `${item.id} ${item.label} ${item.type}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 8);

  useEffect(() => {
    if (context)
      setContexts((current) =>
        current.some((item) => item.id === context.id)
          ? current
          : [context, ...current],
      );
  }, [context?.id]);

  const pickerRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(root, onClose, !pinned && !picker);
  useDialogAccessibility(pickerRef, () => setPicker(false), picker);
  useEffect(() => {
    if (!pinned || picker) return;
    const closePinned = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && root.current?.contains(document.activeElement)) onClose();
    };
    document.addEventListener("keydown", closePinned);
    return () => document.removeEventListener("keydown", closePinned);
  }, [onClose, picker, pinned]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLElement>("textarea")?.focus();
    return () => { requestAnimationFrame(() => { if (previous?.isConnected) previous.focus(); }); };
  }, []);

  const attach = (reference: ArtifactReference) => {
    setContexts((current) =>
      current.some((item) => item.id === reference.id)
        ? current
        : [...current, reference],
    );
    setPicker(false);
    setQuery("");
  };

  const send = async () => {
    if (evaluationActive) { notify("Use the task workbench during evaluation so model activity is recorded consistently.", "warning"); return; }
    if (!prompt.trim() || sending) return;
    const submittedText = prompt;
    submitted.current = submittedText;
    const submittedPrompt = submittedText.trim();
    const pending = requestState.begin();
    if (!pending) return;
    const checkedSources = sourceCheckFingerprint(project);
    const checkedContext = modelContextFingerprint(projectEvidence(project, contexts));
    const selectedContexts = JSON.stringify(contexts);
    const unavailable = contexts.filter(item => item.id !== 'PROJECT-BRIEF' && !allReferences.some(current => current.id === item.id));
    if (unavailable.length) { requestState.finish(pending); setRequestError(`Attached context is no longer available: ${unavailable.map(item => item.id).join(', ')}. Remove it or attach a current project item before sending.`); return; }
    const sourceProblems = modelSourceProblems(project, contexts);
    if (sourceProblems.length) { requestState.finish(pending); setRequestError(`Review and select current source revisions in Sources: ${sourceProblems.join(', ')}.`); notify(`Review and select current revisions in Sources before using these sources: ${sourceProblems.join(', ')}.`, "warning"); return; }
    try { await verifyGoalSourceOriginals(project, contexts); }
    catch (error) { if (requestState.isCurrent(pending)) { const reason = error instanceof Error ? error.message : "The selected sources could not be checked."; setFailedPrompt(submittedText); setRequestError(reason); requestState.finish(pending); notify(reason, "warning"); } return; }
    if (!requestState.isCurrent(pending)) return;
    const current = latestProject.current;
    if (current.id !== project.id || current.activeGoalId !== project.activeGoalId || current.cloudAllowed !== project.cloudAllowed ||
      sourceCheckFingerprint(current) !== checkedSources || modelContextFingerprint(projectEvidence(current, contexts)) !== checkedContext || JSON.stringify(latestContexts.current) !== selectedContexts) {
      const reason = "The project or selected context changed while sources were being checked. Review the current context and send your message again.";
      setFailedPrompt(submittedText); setRequestError(reason); requestState.finish(pending); notify(reason, "warning", "Message not sent"); return;
    }
    const request = buildModelRequest({
      project,
      references: contexts,
      prompt: submittedPrompt,
      task: "assistant-inspection",
      history: messages.flatMap(m => [{ role: "user" as const, content: m.prompt }, { role: "assistant" as const, content: m.answer }]),
      tokenBudget: 1800,
    });
    request.signal = pending.controller.signal;
    pending.requestId = request.requestId;
    setRequestError("");
    setFailedPrompt("");
    try {
      const response = await requestModelCompletion(request);
      if (!requestState.isCurrent(pending)) return;
    window.dispatchEvent(
      new CustomEvent("ba-mate-research-event", {
        detail: { type: "assistant-request", successful: true },
      }),
    );

      setMessages((current) => [
        ...current,
        {
          prompt: submittedPrompt,
          answer: modelContextFingerprint(projectEvidence(latestProject.current, contexts)) === checkedContext ? response.text : `${response.text}\n\nProject context changed while this answer was generated. Review the current context before relying on this response.`,
          references: contexts.filter((item) =>
            response.receipt.includedReferenceIds.includes(item.id),
          ),
          receipt: response.receipt,
        },
      ]);
      setPrompt(current => current === submittedText ? "" : current);
    } catch (error) {
      if (!requestState.isCurrent(pending)) return;
      const reason =
        error instanceof Error ? error.message : "The model provider failed.";
      setRequestError(reason);
      setFailedPrompt(submittedText);
      window.dispatchEvent(
        new CustomEvent("ba-mate-research-event", {
          detail: { type: "assistant-request", successful: false },
        }),
      );
      notify(reason, "danger", "BA Mate request failed");
    } finally {
      requestState.finish(pending);
    }
  };

  return (
    <aside
      className={`inspector ${pinned ? "pinned" : ""}`}
      ref={root}
      aria-label="BA Mate project assistant"
      role={pinned ? "complementary" : "dialog"}
      aria-modal={pinned ? undefined : true}
    >
      <header>
        <div>
          <Sparkles size={18} />
          <span>
            <b>BA Mate</b>
            <small>Evidence-grounded project assistant</small>
          </span>
        </div>
        <div>
          <button
            className="icon-button assistant-pin"
            aria-label={pinned ? "Unpin assistant" : "Pin assistant"}
            onClick={onPin}
          >
            {pinned ? <PinOff /> : <Pin />}
          </button>
          <button
            className="icon-button"
            aria-label="Close inspector"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
      </header>
      <div className="inspector-body" ref={thread} onScroll={event => { const el = event.currentTarget; followThread.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
        <section className="assistant-context-section">
          <header>
            <div>
              <h3>Conversation context</h3>
              <span>{contexts.length} attached</span>
            </div>
            <button onClick={() => setPicker(!picker)}>
              <Plus /> Add context
            </button>
          </header>
          {contexts.length ? (
            <div className="assistant-context-list">
              {contexts.map((item) => (
                <div key={`${item.type}-${item.id}`}>
                  <button
                    onClick={() =>
                      onNavigate(referenceUrl(project.id, item))
                    }
                  >
                    <Link2 />
                    <span>
                      <b>
                        {item.id} · {item.label}
                      </b>
                      <small>
                        {item.type}
                        {item.version ? ` · v${item.version}` : ""}
                        {item.id === context?.id ? " · automatic" : ""}
                      </small>
                    </span>
                    <ChevronRight />
                  </button>
                  <button
                    aria-label={`Remove ${item.id}`}
                    onClick={() =>
                      setContexts((current) =>
                        current.filter((entry) => entry.id !== item.id),
                      )
                    }
                  >
                    <X />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="assistant-empty-context">
              Attach sources, artifacts, diagrams or documents. BA Mate will
              disclose every item included in the model request.
            </p>
          )}
          {picker && createPortal(
            <>
            <div className="picker-modal-scrim" aria-hidden="true" onClick={() => setPicker(false)} />
            <div
              className="assistant-picker"
              ref={pickerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Add assistant context"
            >
              <div className="context-picker-heading"><strong>Add assistant context</strong><button aria-label="Close assistant context picker" onClick={() => setPicker(false)}><X size={16} /></button></div>
              <div className="list-search">
                <Search />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Search assistant context"
                  placeholder="Search project context"
                />
              </div>
              <div>
                {filtered.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    disabled={contexts.some(entry => entry.id === item.id)}
                    onClick={() => attach(item)}
                  >
                    <i>
                      {item.type === "Diagram" ? (
                        <GitBranch />
                      ) : item.type === "Document" ? (
                        <FileText />
                      ) : (
                        <Paperclip />
                      )}
                    </i>
                    <span>
                      <b>
                        {item.id} · {item.label}
                      </b>
                      <small>
                        {item.type}
                        {item.version ? ` · v${item.version}` : ""}
                      </small>
                    </span>
                    <Plus />
                  </button>
                ))}
                {!filtered.length && (
                  <p className="picker-empty">No matching project context.</p>
                )}
              </div>
            </div>
            </>, document.body
          )}
        </section>
        <div className="context-note">
          <LockKeyhole />
          <div>
            <b>{project.cloudAllowed ? "External AI permitted" : "External AI off · local models available"}</b>
            <p>
              {project.sources.filter((source) => source.approved).length} approved
              sources · {project.governancePacks.length} policy packs. References
              are priority-compacted and every request produces a context receipt.
            </p><button className="assistant-conversation-link" onClick={() => onNavigate(`/projects/${project.id}/team`)}>Project AI settings</button>
          </div>
        </div>
        <h3>Current attention</h3>
        <button
          className="attention-row"
          onClick={() => onNavigate(`/projects/${project.id}/workflow`)}
        >
          <AlertTriangle />
          <span>
            <b>{blockers(project)} blocking items</b>
            <small>{blockers(project) ? "Resolve before approval" : "No current blockers"}</small>
          </span>
          <ChevronRight />
        </button>
        <button
          className="attention-row"
          onClick={() => onNavigate(`/projects/${project.id}/changes`)}
        >
          <RefreshCw />
          <span>
            <b>{project.changes.filter(change => !["Implemented", "Revalidated"].includes(change.status)).length} changes awaiting review</b>
            <small>Open changes and impact</small>
          </span>
          <ChevronRight />
        </button>
        <h3>Ask about this project</h3>
        <div className="suggestion-list">
          {[
            "Summarize unresolved decisions",
            "Summarize the active goal and next steps",
            ...(project.changes[0] ? [`Explain the recorded impacts of ${project.changes[0].id}`] : []),
          ].map((item) => (
            <button key={item} disabled={Boolean(prompt.trim())} onClick={() => setPrompt(item)}>
              {item}
            </button>
          ))}
        </div>
        {messages.map((message) => (
          <div className="mini-thread" key={message.receipt.requestId}>
            <b>You</b>
            <p>{message.prompt}</p>
            <b>BA Mate</b>
            <p>{message.answer}</p>
            <div className="context-receipt">
              <Code2 />
              <span>
                Estimated input {message.receipt.estimatedTokens}/{message.receipt.tokenBudget}
                {" tokens · "}
                {message.receipt.includedReferenceIds.length} references included
                {!!message.receipt.partialReferenceIds?.length && ` · ${message.receipt.partialReferenceIds.length} partial`}
                {!!message.receipt.omittedReferenceIds.length && ` · ${message.receipt.omittedReferenceIds.length} omitted`}
                {!!message.receipt.historyMessagesOmitted && ` · ${message.receipt.historyMessagesOmitted} earlier messages omitted`}
              </span>
            </div>
            <ChatContextDisclosure receipt={message.receipt} />
            <div className="assistant-used-context">
              {message.references.map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    onNavigate(referenceUrl(project.id, item))
                  }
                >
                  {item.id}
                </button>
              ))}
            </div>
          </div>
        ))}
        {requestError && (
          <div className="assistant-inline-error" role="alert">
            <AlertTriangle />
            <span>
              <b>Request not completed</b>
              <small>{requestError}</small>
              {failedPrompt && <details><summary>Show message from failed request</summary><p>{failedPrompt}</p></details>}
            </span>
            <button onClick={() => onNavigate("/settings")}>Settings</button>
            {failedPrompt && <button disabled={sending || Boolean(prompt && prompt !== failedPrompt)} onClick={() => { setPrompt(failedPrompt); setRequestError(""); }}>Use failed message</button>}
            <button onClick={() => setRequestError("")}>Dismiss</button>
          </div>
        )}
      </div>
      <div className="inspector-composer connected-assistant-composer">
        <MentionTextarea value={prompt} onChange={setPrompt} references={allReferences} onAttach={attach} onSend={() => void send()} />
        <div className="assistant-composer-actions">
          <small>{sending ? "BA Mate is thinking…" : "Enter to send · Shift+Enter for a new line"}</small>
          {sending && <button type="button" onClick={() => { requestState.stop(); setRequestError("Request stopped. Your draft is available to edit and send again."); setFailedPrompt(submitted.current); }}>Stop</button>}
        <button
          className="assistant-send"
          aria-label={sending ? "BA Mate is thinking" : "Send"}
          onClick={() => void send()}
          disabled={!prompt.trim() || sending}
        >
          {sending ? <Sparkles /> : <Send />}
        </button>
        </div>
        {prompt && <button className="assistant-conversation-link" onClick={() => setPrompt("")}>Discard unsent draft</button>}
        <small className="assistant-session-note">Assistant drafts and history stay here while BA Mate is open. They are not included in backups.</small>
        {onOpenConversation && <button className="assistant-conversation-link" onClick={onOpenConversation}>Open saved conversations <ChevronRight size={14} /></button>}
      </div>
    </aside>
  );
}
