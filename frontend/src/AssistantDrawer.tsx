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
import { projectReferences } from "./references";
import { blockers } from "./store";
import { buildModelRequest, requestModelCompletion } from "./modelGateway";
import { notify } from "./ui";

const routeFor = (reference: ArtifactReference) =>
  reference.route ??
  (reference.type === "Source"
    ? "sources"
    : reference.type === "Diagram"
      ? "diagrams"
      : reference.type === "Document"
        ? "documents"
        : "artifacts");

interface DrawerMessage {
  prompt: string;
  answer: string;
  references: ArtifactReference[];
  receipt: ModelContextReceipt;
}

export function AssistantDrawer({
  project,
  onClose,
  onNavigate,
  pinned,
  onPin,
  context,
  evaluationActive = false,
}: {
  project: Project;
  evaluationActive?: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  pinned: boolean;
  onPin: () => void;
  context?: ArtifactReference;
}) {
  const [prompt, setPrompt] = useState("");
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [contexts, setContexts] = useState<ArtifactReference[]>(
    context ? [context] : [],
  );
  const [messages, setMessages] = useState<DrawerMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [requestError, setRequestError] = useState("");
  const root = useRef<HTMLElement>(null);
  const allReferences = useMemo(() => projectReferences(project), [project]);
  const mention = prompt.match(/@([\w-]*)$/)?.[1]?.toLowerCase();
  const filtered = allReferences
    .filter((item) =>
      `${item.id} ${item.label} ${item.type}`
        .toLowerCase()
        .includes((mention ?? query).toLowerCase()),
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

  useEffect(() => {
    root.current?.querySelector<HTMLElement>("textarea")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (picker) setPicker(false);
        else onClose();
        return;
      }
      if (event.key !== "Tab" || !root.current || pinned) return;
      const focusable = [
        ...root.current.querySelectorAll<HTMLElement>("button,textarea,input"),
      ].filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          getComputedStyle(element).display !== "none",
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [onClose, picker, pinned]);

  const attach = (reference: ArtifactReference) => {
    setContexts((current) =>
      current.some((item) => item.id === reference.id)
        ? current
        : [...current, reference],
    );
    if (mention !== undefined)
      setPrompt((current) => current.replace(/@[\w-]*$/, `@${reference.id} `));
    setPicker(false);
    setQuery("");
  };

  const send = async () => {
    if (evaluationActive) { notify("Use the task workbench during evaluation so model activity is recorded consistently.", "warning"); return; }
    if (!prompt.trim() || sending) return;
    const submittedPrompt = prompt.trim();
    const request = buildModelRequest({
      project,
      references: contexts,
      prompt: submittedPrompt,
      task: "assistant-inspection",
      history: messages.slice(-10).flatMap(m => [{ role: "user" as const, content: m.prompt }, { role: "assistant" as const, content: m.answer }]),
      tokenBudget: 1800,
    });
    setPrompt("");
    setSending(true);
    setRequestError("");
    try {
      const response = await requestModelCompletion(request);
    window.dispatchEvent(
      new CustomEvent("ba-mate-research-event", {
        detail: { type: "assistant-request", successful: true },
      }),
    );

      setMessages((current) => [
        ...current,
        {
          prompt: submittedPrompt,
          answer: response.text,
          references: contexts.filter((item) =>
            response.receipt.includedReferenceIds.includes(item.id),
          ),
          receipt: response.receipt,
        },
      ]);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "The model provider failed.";
      setPrompt(submittedPrompt);
      setRequestError(reason);
      window.dispatchEvent(
        new CustomEvent("ba-mate-research-event", {
          detail: { type: "assistant-request", successful: false },
        }),
      );
      notify(reason, "danger", "BA Mate request failed");
    } finally {
      setSending(false);
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
      <div className="inspector-body">
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
                      onNavigate(`/projects/${project.id}/${routeFor(item)}`)
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
          {picker && (
            <div
              className="assistant-picker"
              role="dialog"
              aria-label="Add assistant context"
            >
              <div className="list-search">
                <Search />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search project context"
                />
              </div>
              <div>
                {filtered.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
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
          )}
        </section>
        <div className="context-note">
          <LockKeyhole />
          <div>
            <b>Budgeted, governed context</b>
            <p>
              {project.sources.filter((source) => source.approved).length} approved
              sources · {project.governancePacks.length} policy packs. References
              are priority-compacted and every request produces a context receipt.
            </p>
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
            <small>Resolve before approval</small>
          </span>
          <ChevronRight />
        </button>
        <button
          className="attention-row"
          onClick={() => onNavigate(`/projects/${project.id}/changes`)}
        >
          <RefreshCw />
          <span>
            <b>{project.changes.length} impact review</b>
            <small>Linked artifacts may change</small>
          </span>
          <ChevronRight />
        </button>
        <h3>Ask about this project</h3>
        <div className="suggestion-list">
          {[
            "Summarize unresolved decisions",
            "Explain the blocking privacy check",
            "Show artifacts affected by CR-01",
          ].map((item) => (
            <button key={item} onClick={() => setPrompt(item)}>
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
                {message.receipt.estimatedTokens}/{message.receipt.tokenBudget}
                {" tokens · "}
                {message.receipt.includedReferenceIds.length} references included
              </span>
            </div>
            <div className="assistant-used-context">
              {message.references.map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    onNavigate(`/projects/${project.id}/${routeFor(item)}`)
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
            </span>
            <button onClick={() => onNavigate("/settings")}>Settings</button>
            <button onClick={() => setRequestError("")}>Dismiss</button>
          </div>
        )}
      </div>
      <div className="inspector-composer connected-assistant-composer">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="Ask BA Mate or type @ to mention context…"
        />
        {mention !== undefined && (
          <div
            className="assistant-mention-menu"
            role="listbox"
            aria-label="Context mentions"
          >
            {filtered.map((item) => (
              <button
                role="option"
                aria-selected="false"
                key={`${item.type}-${item.id}`}
                onClick={() => attach(item)}
              >
                <AtSign />
                <span>
                  <b>{item.id}</b>
                  <small>{item.label}</small>
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          className="assistant-send"
          aria-label={sending ? "BA Mate is thinking" : "Send"}
          onClick={() => void send()}
          disabled={!prompt.trim() || sending}
        >
          {sending ? <Sparkles /> : <Send />}
        </button>
      </div>
    </aside>
  );
}
