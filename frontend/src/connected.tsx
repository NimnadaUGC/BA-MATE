import { useEvaluation } from "./EvaluationContext";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  AtSign,
  Bold,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  Download,
  FilePlus2,
  FileText,
  GitBranch,
  Italic,
  Link2,
  List,
  MessageSquareText,
  Maximize2,
  Minimize2,
  Network,
  Paperclip,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash2,
  Underline,
  Undo2,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type {
  ArtifactReference,
  ConversationContext,
  Diagram,
  DocumentBlock,
  DocumentBlockType,
  DocumentSyncProposal,
  DocumentTemplate,
  Project,
  ProjectDocument,
  Requirement,
  SyncStatus,
  UserStory as Story,
} from "./types";
import { addAudit, approvalIssuesForArtifact, downloadBlob, eligibleForDocumentSync } from "./store";
import { srsContent, syncProposalIsStale, syncProvenance } from "./controlledChanges";
import { exportDeveloperMarkdown, exportDocx, exportJson, exportMarkdown, exportPdf, type ExportSelection } from "./exporters";
import { buildModelRequest, requestModelCompletion } from "./modelGateway";
import { artifactRoute, projectReferences } from "./references";
import { notify, useDialogAccessibility } from "./ui";

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
const templates: DocumentTemplate[] = [
  "Software Requirements Specification",
  "Business Requirements Document",
  "Requirements Addendum",
  "Change Impact Report",
  "Traceability Report",
  "Workshop Summary",
];
const Button = ({
  children,
  onClick,
  primary = false,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  className?: string;
}) => (
  <button
    type="button"
    className={`button ${primary ? "primary" : "secondary"} ${className}`}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);
const Pill = ({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) => <span className={`badge ${tone}`}>{children}</span>;
const Panel = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => <section className={`card ${className}`}>{children}</section>;
const ConnectedEmpty = ({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) => (
  <div className="connected-empty-state">
    {icon}
    <h2>{title}</h2>
    <p>{description}</p>
  </div>
);
const Field = ({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) => (
  <label className={`connected-field ${wide ? "wide" : ""}`}>
    <span>{label}</span>
    {children}
  </label>
);
const statusLabel = (status: string) =>
  status.replace("-", " ").replace(/^./, (x) => x.toUpperCase());
const linkDeliverableToActiveGoal = (project: Project, artifactId: string) => {
  const goal = project.goals.find((item) => item.id === project.activeGoalId);
  if (goal && !goal.deliverables.includes(artifactId))
    goal.deliverables.push(artifactId);
};

const markDownstreamStale = (project: Project, id: string) => {
  project.diagrams
    .filter((d) => d.linkedIds.includes(id))
    .forEach((d) => (d.status = "Possibly stale"));
  project.documents.forEach((document) =>
    document.sections.forEach((section) =>
      section.blocks.forEach((block) => {
        if (block.linkedIds.includes(id)) {
          const req = project.requirements.find((r) => r.id === id);
          if (req) req.syncStatus = "Out of sync";
          const story = project.stories.find((s) => s.id === id);
          if (story) story.syncStatus = "Out of sync";
        }
      }),
    ),
  );
};

function SyncReview({
  project,
  proposal,
  update,
  onClose,
}: {
  project: Project;
  proposal: DocumentSyncProposal;
  update: (fn: (p: Project) => void) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(dialogRef, onClose);
  const toggle = (id: string) =>
    update((p) => {
      const x = p.documentSyncProposals
        .find((s) => s.id === proposal.id)
        ?.changes.find((c) => c.id === id);
      if (x) x.accepted = !x.accepted;
    });
  const apply = (): string | undefined => {
    let failure: string | undefined;
    update((p) => {
      const sync = p.documentSyncProposals.find((x) => x.id === proposal.id)!;
      if (syncProposalIsStale(p, sync)) {
        sync.status = "stale";
        addAudit(p, "Blocked stale document synchronization", sync.id, "Source or target revisions changed after the proposal was created; no document content was changed.");
        failure = "The source artifact or target document changed. Refresh the proposal before applying it.";
        return;
      }
      const accepted = sync.changes.filter((c) => c.accepted);
      if (!accepted.length) { failure = "Select at least one proposed update."; return; }
      let document = p.documents.find((d) => d.id === sync.targetDocumentId);
      if (!document) {
        const template: DocumentTemplate =
          sync.mode === "addendum"
            ? "Requirements Addendum"
            : "Software Requirements Specification";
        document = {
          id: uid("DOC"),
          name:
            sync.mode === "addendum"
              ? `${p.name} requirements addendum`
              : `${p.name} SRS`,
          template,
          status: "draft",
          version: 1,
          receipts: [],
          comments: [],
          goalId: p.activeGoalId,
          sections: [
            {
              id: uid("SEC"),
              title: "Requirements",
              content: "Controlled artifact content",
              linkedIds: [],
              comments: [],
              blocks: [],
            },
          ],
        };
        p.documents.unshift(document);
        linkDeliverableToActiveGoal(p, document.id);
        sync.targetDocumentId = document.id;
        sync.targetDocumentRevision = document.version;
      }
      accepted.forEach((change) => {
        let section = document.sections.find(item => item.id === change.targetSectionId);
        if (!section) section = document.sections.find(item => item.title.includes("Requirements"));
        if (!section) {
          section = { id: uid("SEC"), title: change.sectionTitle || "Requirements", content: "", linkedIds: [], comments: [], blocks: [] };
          document.sections.push(section);
        }
        const existing = document.sections.flatMap(item => item.blocks).find(block => block.id === change.targetBlockId || block.linkedIds.includes(change.artifactId));
        if (existing) {
          existing.content = change.after;
        } else
          section.blocks.push({
            id: uid("BLK"),
            type: change.artifactId.startsWith("US")
              ? "stories-table"
              : "requirements-table",
            content: change.after,
            linkedIds: [change.artifactId],
          });
        if (!section.linkedIds.includes(change.artifactId)) section.linkedIds.push(change.artifactId);
        const req = p.requirements.find((r) => r.id === change.artifactId);
        if (req) req.syncStatus = "Synced";
        const story = p.stories.find((s) => s.id === change.artifactId);
        if (story) story.syncStatus = "Synced";
      });
      document.version++;
      document.status = "draft";
      document.receipts.unshift({
        id: uid("SYNC"),
        at: "Just now",
        documentVersion: document.version,
        artifactVersions: accepted.map((c) => ({
          id: c.artifactId,
          version:
            p.requirements.find((r) => r.id === c.artifactId)?.version ??
            p.stories.find((s) => s.id === c.artifactId)?.version ??
            1,
        })),
        acceptedBlockIds: document.sections.flatMap(section => section.blocks)
          .filter((b) => accepted.some((c) => b.linkedIds.includes(c.artifactId))).map((b) => b.id),
        targetDocumentRevision: document.version,
      });
      sync.status = "accepted";
      addAudit(
        p,
        "Accepted document synchronization",
        document.id,
        `${accepted.length} approved artifact updates applied to document v${document.version}.`,
      );
    });
    return failure;
  };
  return (
    <div className="connected-modal-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="sync-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Review document synchronization"
      >
        <header>
          <div>
            <span className="eyebrow">Reviewed synchronization</span>
            <h2>
              {proposal.mode === "new-srs"
                ? "Create controlled SRS"
                : proposal.mode === "addendum"
                  ? "Create requirements addendum"
                  : "Update existing SRS"}
            </h2>
            <p>
              Nothing enters the document until you accept the proposed blocks.
            </p>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close sync review"
          >
            <X />
          </button>
        </header>
        <div className="sync-summary">
          <ShieldCheck />
          <span>
            <b>{proposal.changes.length} approved artifact changes</b>
            <small>
              Provenance and artifact versions will be recorded in a sync
              receipt.
            </small>
          </span>
        </div>
        <div className="sync-changes">
          {proposal.changes.map((change) => (
            <label
              key={change.id}
              className={change.accepted ? "selected" : ""}
            >
              <input
                type="checkbox"
                checked={change.accepted}
                onChange={() => toggle(change.id)}
              />
              <div>
                <header>
                  <Pill tone="purple">{change.artifactId}</Pill>
                  <b>
                    {change.action.toUpperCase()} · {change.sectionTitle}
                  </b>
                </header>
                <div className="sync-diff">
                  <span>
                    <small>Current document</small>
                    {change.before || "Not included"}
                  </span>
                  <ChevronRight />
                  <span>
                    <small>Proposed content</small>
                    {change.after}
                  </span>
                </div>
                <small>
                  <Link2 size={13} />{" "}
                  {change.provenance
                    .map((x) => `${x.id}${x.version ? ` v${x.version}` : ""}`)
                    .join(" · ")}
                </small>
              </div>
            </label>
          ))}
        </div>
        <footer>
          <Button
            onClick={() => {
              update((p) => {
                p.documentSyncProposals.find(
                  (x) => x.id === proposal.id,
                )!.status = "rejected";
                addAudit(
                  p,
                  "Rejected document synchronization",
                  proposal.id,
                  "Proposal retained in history without changing documents.",
                );
              });
              notify(
                "The synchronization proposal was rejected without changing the document.",
                "info",
                "Proposal retained",
              );
              onClose();
            }}
          >
            Reject proposal
          </Button>
          <Button
            primary
            disabled={proposal.status !== "pending" || !proposal.changes.some((c) => c.accepted)}
            onClick={() => {
              const failure = apply();
              if (failure) {
                notify(failure, "warning", "Synchronization not applied");
                return;
              }
              notify(
                "Selected approved artifacts were synchronized and a version receipt was recorded.",
                "success",
                "Document updated",
              );
              onClose();
            }}
          >
            Apply selected updates
          </Button>
        </footer>
      </div>
    </div>
  );
}

function ConfirmActionDialog({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useDialogAccessibility(root, onCancel);
  return (
    <div className="connected-modal-backdrop" role="presentation">
      <div
        ref={root}
        className="sync-modal connected-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <span className="eyebrow">Confirmation required</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close confirmation"
            onClick={onCancel}
          >
            <X />
          </button>
        </header>
        <div className="sync-summary destructive-summary">
          <AlertTriangle />
          <span>
            <b>This local action cannot be undone</b>
            <small>Linked records are cleaned up to keep the workspace consistent.</small>
          </span>
        </div>
        <footer>
          <Button onClick={onCancel}>Cancel</Button>
          <Button className="danger" onClick={onConfirm}>
            <Trash2 /> {confirmLabel}
          </Button>
        </footer>
      </div>
    </div>
  );
}

export function ConnectedArtifacts({
  project,
  update,
  onAsk,
  onOpenConversation,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
  onAsk: (ref: ArtifactReference) => void;
  onOpenConversation: (ref: ArtifactReference) => void;
}) {
  const [tab, setTab] = useState<"requirements" | "stories">("requirements");
  const [selected, setSelected] = useState<string | undefined>(
    project.requirements[0]?.id ?? project.stories[0]?.id,
  );
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [syncMode, setSyncMode] = useState<
    "new-srs" | "update-srs" | "addendum"
  >("update-srs");
  const [syncTargetId, setSyncTargetId] = useState<string>(() => project.documents.find(document => document.template === "Software Requirements Specification")?.id ?? "");
  const [syncTargetSectionId, setSyncTargetSectionId] = useState<string>("");
  const [review, setReview] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const items = tab === "requirements" ? project.requirements : project.stories;
  const visible = items.filter((x) =>
    (x.id + " " + ("title" in x ? x.title : x.goal))
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const req = project.requirements.find((x) => x.id === selected);
  const story = project.stories.find((x) => x.id === selected);
  const saveReq = (patch: Partial<Requirement>) =>
    update((p) => {
      const r = p.requirements.find((x) => x.id === selected)!;
      const contentChanged = Object.keys(patch).some((key) => !["status", "rejectionReason", "syncStatus"].includes(key));
      Object.assign(r, patch);
      if (contentChanged) {
        r.version++;
        if (r.syncStatus === "Synced") r.syncStatus = "Out of sync";
        markDownstreamStale(p, r.id);
      }
      addAudit(
        p,
        contentChanged ? "Edited requirement" : "Changed requirement workflow status",
        r.id,
        contentChanged ? `Working version ${r.version} saved; linked content checked for staleness.` : `Status changed to ${r.status}; content revision remains ${r.version}.`,
      );
    });
  const saveStory = (patch: Partial<Story>) =>
    update((p) => {
      const s = p.stories.find((x) => x.id === selected)!;
      const contentChanged = Object.keys(patch).some((key) => !["status", "rejectionReason", "syncStatus"].includes(key));
      Object.assign(s, patch);
      if (contentChanged) {
        s.version++;
        if (s.syncStatus === "Synced") s.syncStatus = "Out of sync";
        markDownstreamStale(p, s.id);
      }
      addAudit(
        p,
        contentChanged ? "Edited user story" : "Changed user-story workflow status",
        s.id,
        contentChanged ? `Working version ${s.version} saved; linked content checked for staleness.` : `Status changed to ${s.status}; content revision remains ${s.version}.`,
      );
    });
  const createSync = () => {
    const eligible = eligibleForDocumentSync(project, checked);
    if (!eligible.length) return;
    const target = syncMode === "update-srs" ? project.documents.find(document => document.id === syncTargetId) : undefined;
    if (syncMode === "update-srs" && !target) {
      notify("Choose the controlled document to update, or create a new SRS instead.", "warning", "Target required");
      return;
    }
    const targetSection = target?.sections.find(section => section.id === syncTargetSectionId) ?? target?.sections.find(section => section.title.includes("Requirements")) ?? target?.sections[0];
    const proposalId = uid("DSP");
    update((p) => {
      p.documentSyncProposals.unshift({
        id: proposalId,
        targetDocumentId: target?.id,
        targetDocumentRevision: target?.version,
        mode: syncMode,
        status: "pending",
        createdAt: "Just now",
        changes: eligible.map((item) => ({
          id: uid("DSC"),
          artifactId: item.id,
          action: item.syncStatus === "Not included" ? "add" : "update",
          sectionTitle: targetSection?.title ?? (item.id.startsWith("US") ? "User stories" : "Requirements"),
          targetSectionId: targetSection?.id,
          targetBlockId: target?.sections.flatMap(section => section.blocks).find(block => block.linkedIds.includes(item.id))?.id,
          before: target?.sections.flatMap(section => section.blocks).find(block => block.linkedIds.includes(item.id))?.content ?? "",
          after: srsContent(project, item.id),
          accepted: true,
          provenance: syncProvenance(project, item.id),
          sourceRevision: item.version,
        })),
      });
      eligible.forEach((x) => {
        const target =
          p.requirements.find((r) => r.id === x.id) ??
          p.stories.find((s) => s.id === x.id);
        if (target) target.syncStatus = "Update proposed";
      });
      addAudit(
        p,
        "Created document synchronization proposal",
        proposalId,
        `${eligible.length} approved artifacts prepared for review.`,
      );
    });
    setReview(proposalId);
    notify(
      `${eligible.length} approved artifact${eligible.length === 1 ? "" : "s"} are ready for document review.`,
      "success",
      "Synchronization proposal created",
    );
  };
  const setStatus = (status: "draft" | "in-review" | "approved") => {
    if (!selected) return;
    if (status === "approved") {
      const issues = approvalIssuesForArtifact(project, selected);
      if (issues.length) {
        notify(issues.join(" "), "warning", "Approval needs review");
        return;
      }
    }
    tab === "requirements"
      ? saveReq({ status, rejectionReason: undefined })
      : saveStory({ status, rejectionReason: undefined });
    notify(
      `${selected} is now ${statusLabel(status)}.`,
      "success",
      "Artifact status updated",
    );
  };
  const reject = () => {
    tab === "requirements"
      ? saveReq({
          status: "draft",
          rejectionReason:
            "Reviewer requested clarification and stronger supporting evidence.",
        })
      : saveStory({
          status: "draft",
          rejectionReason:
            "Reviewer requested refined acceptance criteria and trace links.",
        });
    notify(
      `${selected} returned to its working draft with a reviewer note.`,
      "info",
      "Revision requested",
    );
  };
  const createArtifact = () => {
    const id = uid(tab === "requirements" ? "FR" : "US");
    update((p) => {
      if (tab === "requirements") {
        p.requirements.push({
          id,
          kind: "Functional",
          title: "Untitled requirement",
          statement: "The system shall…",
          priority: "Should",
          status: "draft",
          owner: "Business analyst",
          sourceIds: [],
          storyIds: [],
          checkIds: [],
          version: 1,
          rationale: "",
          businessValue: "",
          businessRules: [],
          fitCriteria: [],
          dependencies: [],
          stakeholders: [],
          openQuestions: [],
          comments: [],
          syncStatus: "Not included",
          goalId: p.activeGoalId,
        });
      } else {
        p.stories.push({
          id,
          role: "user",
          goal: "complete the business task",
          value: "the intended outcome is achieved",
          priority: "Should",
          status: "draft",
          requirementIds: [],
          criteria: [],
          version: 1,
          epic: "Project delivery",
          feature: "New feature",
          owner: "Business analyst",
          dependencies: [],
          sourceIds: [],
          comments: [],
          syncStatus: "Not included",
          goalId: p.activeGoalId,
        });
      }
      linkDeliverableToActiveGoal(p, id);
      addAudit(
        p,
        `Created ${tab === "requirements" ? "requirement" : "user story"}`,
        id,
        "Created a new governed working artifact.",
      );
    });
    setSelected(id);
    setQuery("");
    notify(
      `A new ${tab === "requirements" ? "requirement" : "user story"} is ready to edit.`,
      "success",
      "Artifact created",
    );
  };
  const deleteArtifact = () => {
    if (!activeRef) return;
    const id = activeRef.id;
    update((p) => {
      p.requirements = p.requirements.filter((item) => item.id !== id);
      p.stories = p.stories
        .filter((item) => item.id !== id)
        .map((item) => ({
          ...item,
          requirementIds: item.requirementIds.filter((linked) => linked !== id),
        }));
      p.requirements.forEach((item) => {
        item.storyIds = item.storyIds.filter((linked) => linked !== id);
      });
      p.traceLinks = p.traceLinks.filter(
        (link) => link.from !== id && link.to !== id,
      );
      p.diagrams.forEach((diagram) => {
        diagram.linkedIds = diagram.linkedIds.filter((linked) => linked !== id);
      });
      p.documents.forEach((document) =>
        document.sections.forEach((section) => {
          section.linkedIds = section.linkedIds.filter((linked) => linked !== id);
          section.blocks.forEach((block) => {
            block.linkedIds = block.linkedIds.filter((linked) => linked !== id);
          });
        }),
      );
      p.documentSyncProposals.forEach((proposal) => {
        proposal.changes = proposal.changes.filter(
          (change) => change.artifactId !== id,
        );
      });
      p.changes.forEach((change) => {
        change.impacts = change.impacts.filter((impact) => impact.id !== id);
      });
      p.conversations.forEach((conversation) => {
        conversation.context = conversation.context.filter((ref) => ref.id !== id);
      });
      p.goals.forEach((goal) => {
        goal.deliverables = goal.deliverables.filter((deliverable) => deliverable !== id);
      });
      addAudit(p, `Deleted ${activeRef.type.toLowerCase()}`, id, "Removed the working artifact and cleaned its active links.");
    });
    const remaining = items.find((item) => item.id !== id)?.id;
    setSelected(remaining);
    setChecked((current) => current.filter((item) => item !== id));
    setConfirmDelete(false);
    notify("The working artifact and its active links were deleted.", "success", "Artifact deleted");
  };
  const activeRef: ArtifactReference | undefined = req
    ? {
        id: req.id,
        type: "Requirement",
        label: req.title,
        version: req.version,
        route: "artifacts",
      }
    : story
      ? {
          id: story.id,
          type: "User story",
          label: story.goal,
          version: story.version,
          route: "artifacts",
        }
      : undefined;
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Connected artifact studio</span>
          <h1>Requirements & stories</h1>
          <p>
            Detailed governed artifacts with approved, reviewable movement into
            controlled documents.
          </p>
        </div>
        <div className="page-actions">
          {checked.length > 0 && (
            <>
              <select aria-label="Synchronization mode" className="compact-select" value={syncMode} onChange={(e) => setSyncMode(e.target.value as typeof syncMode)}>
                <option value="update-srs">Update existing SRS</option>
                <option value="new-srs">Create new SRS</option>
                <option value="addendum">Create addendum</option>
              </select>
              {syncMode === "update-srs" && <select aria-label="Synchronization target document" className="compact-select" value={syncTargetId} onChange={(e) => { setSyncTargetId(e.target.value); setSyncTargetSectionId(""); }}>
                <option value="">Choose document…</option>
                {project.documents.map(document => <option key={document.id} value={document.id}>{document.name} · v{document.version}</option>)}
              </select>}
              {syncMode === "update-srs" && syncTargetId && <select aria-label="Synchronization target section" className="compact-select" value={syncTargetSectionId} onChange={(e) => setSyncTargetSectionId(e.target.value)}>
                <option value="">Requirements section (recommended)</option>
                {project.documents.find(document => document.id === syncTargetId)?.sections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}
              </select>}
            </>
          )}
          <Button onClick={() => activeRef && onAsk(activeRef)}>
            <Sparkles size={16} /> Ask about selection
          </Button>
          <Button
            primary
            disabled={
              !checked.some((id) =>
                [...project.requirements, ...project.stories].some(
                  (x) => x.id === id && x.status === "approved",
                ),
              )
            }
            onClick={createSync}
          >
            <FilePlus2 size={16} /> Create/update SRS{" "}
            {checked.length ? `(${checked.length})` : ""}
          </Button>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Artifact type">
        <button
          role="tab"
          aria-selected={tab === "requirements"}
          className={tab === "requirements" ? "active" : ""}
          onClick={() => {
            setTab("requirements");
            setSelected(project.requirements[0]?.id);
          }}
        >
          Requirements <span>{project.requirements.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "stories"}
          className={tab === "stories" ? "active" : ""}
          onClick={() => {
            setTab("stories");
            setSelected(project.stories[0]?.id);
          }}
        >
          User stories <span>{project.stories.length}</span>
        </button>
      </div>
      <div className="connected-artifact-layout">
        <Panel className="connected-backlog">
          <div className="list-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${tab}…`}
            />
          </div>
          <div className="backlog-filter">
            <span>{visible.length} items</span>
            <button
              onClick={() =>
                setChecked(
                  visible
                    .filter((x) => x.status === "approved")
                    .map((x) => x.id),
                )
              }
            >
              Select approved
            </button>
          </div>
          {visible.map((item) => (
            <div
              className={`backlog-item ${selected === item.id ? "active" : ""}`}
              key={item.id}
            >
              <input
                aria-label={`Select ${item.id}`}
                type="checkbox"
                checked={checked.includes(item.id)}
                onChange={(e) =>
                  setChecked(
                    e.target.checked
                      ? [...checked, item.id]
                      : checked.filter((x) => x !== item.id),
                  )
                }
              />
              <button onClick={() => setSelected(item.id)}>
                <span>
                  <Pill tone="purple">{item.id}</Pill>
                  <Pill>{statusLabel(item.status)}</Pill>
                </span>
                <b>{"title" in item ? item.title : item.goal}</b>
                <small>
                  {item.owner} · v{item.version}
                </small>
                <em>{item.syncStatus}</em>
              </button>
            </div>
          ))}
          {!visible.length && (
            <ConnectedEmpty
              icon={<Search />}
              title={query ? "No matching artifacts" : `No ${tab} yet`}
              description={query ? "Try a broader search term." : "Create the first governed artifact for this project."}
            />
          )}
          <Button className="full" onClick={createArtifact}>
            <Plus size={16} /> New{" "}
            {tab === "requirements" ? "requirement" : "story"}
          </Button>
        </Panel>
        <Panel className="connected-artifact-editor">
          {req && tab === "requirements" ? (
            <>
              <EditorHeader
                id={req.id}
                status={req.status}
                version={req.version}
                sync={req.syncStatus}
                onStatus={setStatus}
                onReject={reject}
                onConversation={() => onOpenConversation(activeRef!)}
                onDelete={() => setConfirmDelete(true)}
              />
              <div className="connected-form">
                <Field label="Title" wide>
                  <input
                    value={req.title}
                    onChange={(e) => saveReq({ title: e.target.value })}
                  />
                </Field>
                <Field label="Requirement statement" wide>
                  <textarea
                    value={req.statement}
                    onChange={(e) => saveReq({ statement: e.target.value })}
                  />
                </Field>
                <Field label="Rationale">
                  <textarea
                    value={req.rationale}
                    onChange={(e) => saveReq({ rationale: e.target.value })}
                  />
                </Field>
                <Field label="Business value">
                  <textarea
                    value={req.businessValue}
                    onChange={(e) => saveReq({ businessValue: e.target.value })}
                  />
                </Field>
                <Field label="Business rules">
                  <textarea
                    value={req.businessRules.join("\n")}
                    onChange={(e) =>
                      saveReq({ businessRules: e.target.value.split("\n") })
                    }
                  />
                </Field>
                <Field label="Fit criteria">
                  <textarea
                    value={req.fitCriteria.join("\n")}
                    onChange={(e) =>
                      saveReq({ fitCriteria: e.target.value.split("\n") })
                    }
                  />
                </Field>
                <Field label="Dependencies">
                  <input
                    value={req.dependencies.join(", ")}
                    onChange={(e) =>
                      saveReq({
                        dependencies: e.target.value
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
                <Field label="Stakeholders">
                  <input
                    value={req.stakeholders.join(", ")}
                    onChange={(e) =>
                      saveReq({
                        stakeholders: e.target.value
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
                <Field label="Source evidence">
                  <div className="reference-row">
                    {req.sourceIds.map((x) => (
                      <Pill key={x}>{x}</Pill>
                    ))}
                  </div>
                </Field>
                <Field label="Open questions">
                  <textarea
                    value={req.openQuestions.join("\n")}
                    onChange={(e) =>
                      saveReq({
                        openQuestions: e.target.value
                          .split("\n")
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
              </div>
            </>
          ) : story && tab === "stories" ? (
            <>
              <EditorHeader
                id={story.id}
                status={story.status}
                version={story.version}
                sync={story.syncStatus}
                onStatus={setStatus}
                onReject={reject}
                onConversation={() => onOpenConversation(activeRef!)}
                onDelete={() => setConfirmDelete(true)}
              />
              <div className="connected-form">
                <Field label="Epic">
                  <input
                    value={story.epic}
                    onChange={(e) => saveStory({ epic: e.target.value })}
                  />
                </Field>
                <Field label="Feature">
                  <input
                    value={story.feature}
                    onChange={(e) => saveStory({ feature: e.target.value })}
                  />
                </Field>
                <Field label="Persona">
                  <input
                    value={story.role}
                    onChange={(e) => saveStory({ role: e.target.value })}
                  />
                </Field>
                <Field label="Owner">
                  <input
                    value={story.owner}
                    onChange={(e) => saveStory({ owner: e.target.value })}
                  />
                </Field>
                <Field label="Story narrative" wide>
                  <div className="story-narrative">
                    As a <b>{story.role}</b>, I want to <b>{story.goal}</b>, so
                    that <b>{story.value}</b>.
                  </div>
                </Field>
                <Field label="Goal">
                  <textarea
                    value={story.goal}
                    onChange={(e) => saveStory({ goal: e.target.value })}
                  />
                </Field>
                <Field label="Business value">
                  <textarea
                    value={story.value}
                    onChange={(e) => saveStory({ value: e.target.value })}
                  />
                </Field>
                <Field label="Acceptance criteria" wide>
                  <div className="criteria-editor">
                    {story.criteria.map((c, i) => (
                      <label key={i}>
                        <span>{i + 1}</span>
                        <textarea
                          value={c}
                          onChange={(e) => {
                            const next = [...story.criteria];
                            next[i] = e.target.value;
                            saveStory({ criteria: next });
                          }}
                        />
                        <button
                          onClick={() =>
                            saveStory({
                              criteria: story.criteria.filter(
                                (_, n) => n !== i,
                              ),
                            })
                          }
                        >
                          <X size={15} />
                        </button>
                      </label>
                    ))}
                    <Button
                      onClick={() =>
                        saveStory({
                          criteria: [
                            ...story.criteria,
                            "Given …, when …, then …",
                          ],
                        })
                      }
                    >
                      <Plus size={15} /> Add criterion
                    </Button>
                  </div>
                </Field>
                <Field label="Dependencies">
                  <input
                    value={story.dependencies.join(", ")}
                    onChange={(e) =>
                      saveStory({
                        dependencies: e.target.value
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
                <Field label="Linked requirements">
                  <div className="reference-row">
                    {story.requirementIds.map((x) => (
                      <Pill key={x}>{x}</Pill>
                    ))}
                  </div>
                </Field>
              </div>
            </>
          ) : (
            <ConnectedEmpty
              icon={<FileText />}
              title="Select an artifact"
              description="Choose an item from the backlog or create a new working artifact."
            />
          )}
        </Panel>
      </div>
      {review && (
        <SyncReview
          project={project}
          proposal={project.documentSyncProposals.find((x) => x.id === review)!}
          update={update}
          onClose={() => setReview(undefined)}
        />
      )}
      {confirmDelete && activeRef && (
        <ConfirmActionDialog
          title={`Delete ${activeRef.id}?`}
          description="This removes the working artifact and cleans its trace links, document references, proposal entries, goal delivery link, and conversation context."
          confirmLabel="Delete artifact"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={deleteArtifact}
        />
      )}
    </>
  );
}

function EditorHeader({
  id,
  status,
  version,
  sync,
  onStatus,
  onReject,
  onConversation,
  onDelete,
}: {
  id: string;
  status: string;
  version: number;
  sync: SyncStatus;
  onStatus: (s: "draft" | "in-review" | "approved") => void;
  onReject: () => void;
  onConversation: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="editor-toolbar connected-editor-toolbar">
      <div>
        <Pill tone="purple">{id}</Pill>
        <Pill>{statusLabel(status)}</Pill>
        <span>Working version {version}</span>
        <Pill
          tone={
            sync === "Synced"
              ? "success"
              : sync === "Out of sync"
                ? "warning"
                : ""
          }
        >
          {sync}
        </Pill>
      </div>
      <div>
        <Button onClick={onConversation}>
          <MessageSquareText size={15} /> Open in conversation
        </Button>
        {status === "draft" && (
          <Button primary onClick={() => onStatus("in-review")}>
            Submit for review
          </Button>
        )}
        {status === "in-review" && (
          <>
            <Button onClick={onReject}>Return to draft</Button>
            <Button primary onClick={() => onStatus("approved")}>
              <Check size={15} /> Approve
            </Button>
          </>
        )}
        {status === "approved" && (
          <Button onClick={() => onStatus("draft")}>
            Create working revision
          </Button>
        )}
        <Button className="danger" onClick={onDelete}>
          <Trash2 size={15} /> Delete
        </Button>
      </div>
    </div>
  );
}

export function ConnectedConversations({
  project,
  update,
  onNavigate,
  automaticContext,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
  onNavigate: (route: string) => void;
  automaticContext?: ArtifactReference;
}) {
  const activeGoalConversation = project.goals.find(
    (goal) => goal.id === project.activeGoalId,
  )?.conversationId;
  const [selected, setSelected] = useState<string | undefined>(
    activeGoalConversation ?? project.conversations[0]?.id,
  );
  const [draft, setDraft] = useState("");
  const [picker, setPicker] = useState(false);
  const [contextQuery, setContextQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationQuery, setConversationQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const convo = project.conversations.find((c) => c.id === selected);
  const visibleConversations = project.conversations.filter((conversation) =>
    conversation.title.toLowerCase().includes(conversationQuery.toLowerCase()),
  );
  const refs = projectReferences(project);
  const mention = draft.match(/@([\w-]*)$/)?.[1]?.toLowerCase();
  useEffect(() => {
    if (activeGoalConversation) setSelected(activeGoalConversation);
  }, [activeGoalConversation]);
  useEffect(() => {
    if (!convo && project.conversations.length)
      setSelected(project.conversations[0].id);
  }, [convo, project.conversations]);
  useEffect(() => {
    if (!convo || !automaticContext) return;
    update((p) => {
      const c = p.conversations.find((x) => x.id === convo.id)!;
      if (!c.context.some((x) => x.id === automaticContext.id))
        c.context.unshift({
          ...automaticContext,
          origin: "automatic",
          removable: true,
        });
    });
  }, [automaticContext?.id, selected]);
  const attach = (ref: ArtifactReference, origin: "attached" | "mentioned") => {
    if (!convo) return;
    update((p) => {
      const c = p.conversations.find((x) => x.id === convo.id)!;
      if (!c.context.some((x) => x.id === ref.id))
        c.context.push({ ...ref, origin, removable: true });
    });
    setDraft(draft.replace(/@[\w-]*$/, `@${ref.id} `));
    setPicker(false);
  };
  const createConversation = () => {
    const id = uid("CONV");
    update((p) =>
      p.conversations.unshift({
        id,
        title: "Untitled project conversation",
        context: [],
        updated: "Just now",
        messages: [],
      }),
    );
    setSelected(id);
    setConversationQuery("");
    notify(
      "A blank project conversation was created with no automatic context.",
      "success",
      "Conversation created",
    );
  };
  const deleteConversation = () => {
    if (!convo || convo.id === activeGoalConversation) return;
    const deletedId = convo.id;
    const nextId = project.conversations.find((item) => item.id !== deletedId)?.id;
    update((p) => {
      p.conversations = p.conversations.filter((item) => item.id !== deletedId);
      addAudit(
        p,
        "Deleted conversation",
        deletedId,
        "Removed the local conversation while retaining referenced project artifacts.",
      );
    });
    setSelected(nextId);
    setConfirmDelete(false);
    notify("The local project conversation was deleted.", "success");
  };
  const evaluation = useEvaluation();
  const send = async () => {
    if (evaluation) { notify("Use the task workbench for recorded AI comparisons; chat is disabled during evaluation.", "warning"); return; }
    if (!draft.trim() || !convo || sending) return;
    const prompt = draft.trim();
    const used = convo.context.map(({ origin, removable, ...ref }) => ref);
    const request = buildModelRequest({
      project,
      references: used,
      prompt,
      task: "project-conversation",
      history: convo.messages.slice(-20).map(m => ({ role: m.role, content: m.text })),
    });
    setSending(true);
    setDraft("");
    update((p) => {
      const c = p.conversations.find((x) => x.id === convo.id)!;
      c.messages.push({ id: uid("M"), role: "user", text: prompt, references: used });
      c.updated = "Just now";
    });
    try {
      const response = await requestModelCompletion(request);
    window.dispatchEvent(
      new CustomEvent("ba-mate-research-event", {
        detail: { type: "assistant-request", successful: true },
      }),
    );

      update((p) => {
        const c = p.conversations.find((x) => x.id === convo.id)!;
        c.messages.push({
          id: uid("M"),
          role: "assistant",
          text: response.text,
          references: used.filter((reference) =>
            response.receipt.includedReferenceIds.includes(reference.id),
          ),
          contextReceipt: response.receipt,
        });
        c.updated = "Just now";
        addAudit(
          p,
          "Completed model-ready conversation request",
          c.id,
          `${response.receipt.includedReferenceIds.length} references included; ${response.receipt.omittedReferenceIds.length} compacted out.`,
          "BA Mate",
        );
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "The model provider failed.";
      update((p) => {
        const c = p.conversations.find((x) => x.id === convo.id)!;
        c.messages.push({
          id: uid("M"),
          role: "assistant",
          text: "I could not complete that request. Your message and attached context are still available, so you can retry after checking the model provider.",
          references: [],
        });
        addAudit(
          p,
          "Model request failed",
          c.id,
          reason,
          "BA Mate",
        );
      });
      window.dispatchEvent(
        new CustomEvent("ba-mate-research-event", {
          detail: { type: "assistant-request", successful: false },
        }),
      );
      notify(
        reason,
        "danger",
        "BA Mate could not complete the request",
      );
    } finally {
      setSending(false);
    }
  };
  const accept = (messageId: string, status: "accepted" | "rejected") => {
    update((p) => {
      const c = p.conversations.find((x) => x.id === selected)!;
      const proposal = c.messages.find((m) => m.id === messageId)?.proposal;
      if (!proposal) return;
      proposal.status = status;
      if (status === "accepted") {
        const req = p.requirements.find((r) => r.id === proposal.target);
        if (req) {
          if (proposal.before !== req.statement) throw new Error("This proposal is stale. Generate a new revision.");
          req.statement = proposal.after;
          req.status = "draft";
          req.version++;
          if (req.syncStatus === "Synced") req.syncStatus = "Out of sync";
          markDownstreamStale(p, req.id);
        }
        addAudit(
          p,
          "Accepted connected BA Mate proposal",
          proposal.target,
          `Applied ${proposal.kind}; ${proposal.impact.length} downstream items checked.`,
        );
      } else
        addAudit(
          p,
          "Rejected connected BA Mate proposal",
          proposal.target,
          "Proposal retained without changing project artifacts.",
        );
    });
    notify(
      status === "accepted"
        ? "The reviewed proposal was applied to the working artifact; downstream links were checked."
        : "The proposal was retained in the conversation without changing project data.",
      status === "accepted" ? "success" : "info",
      status === "accepted" ? "Proposal accepted" : "Proposal rejected",
    );
  };
  const filtered = refs
    .filter((x) =>
      (x.id + " " + x.label + " " + x.type)
        .toLowerCase()
        .includes((mention ?? contextQuery).toLowerCase()),
    )
    .slice(0, 10);
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Typed project context</span>
          <h1>Conversations</h1>
          <p>
            Discuss any project object with visible provenance and reviewable
            changes.
          </p>
        </div>
        <Button
          primary
          onClick={createConversation}
        >
          <Plus size={16} /> New conversation
        </Button>
      </div>
      <div className="conversation-layout connected-conversations">
        <Panel className="conversation-list">
          <div className="list-search">
            <Search size={17} />
            <input
              value={conversationQuery}
              onChange={(event) => setConversationQuery(event.target.value)}
              placeholder="Search conversations"
            />
          </div>
          {visibleConversations.map((c) => (
            <button
              className={c.id === selected ? "active" : ""}
              key={c.id}
              onClick={() => setSelected(c.id)}
            >
              <MessageSquareText size={18} />
              <span>
                <b>{c.title}</b>
                <small>
                  {c.context.length} references · {c.updated}
                </small>
              </span>
            </button>
          ))}
          {!visibleConversations.length && (
            <ConnectedEmpty
              icon={<MessageSquareText />}
              title={conversationQuery ? "No matching conversations" : "No conversations yet"}
              description={conversationQuery ? "Try a different search term." : "Create a conversation to discuss project context with BA Mate."}
            />
          )}
        </Panel>
        <Panel className="chat-workspace">
          {convo && (
            <>
              <header className="chat-header">
                <div>
                  <input
                    className="conversation-title-input"
                    aria-label="Conversation title"
                    value={convo.title}
                    onChange={(event) =>
                      update((p) => {
                        p.conversations.find((item) => item.id === convo.id)!.title =
                          event.target.value;
                      })
                    }
                  />
                  <div className="context-chips connected-chips">
                    {convo.context.map((x) => (
                      <span key={x.id} title={`${x.type} · ${x.origin}`}>
                        <button
                          onClick={() =>
                            onNavigate(
                              `/projects/${project.id}/${x.route ?? artifactRoute(x.type)}`,
                            )
                          }
                        >
                          <Link2 size={12} />
                          {x.id}
                          <small>{x.origin}</small>
                        </button>
                        {x.removable && (
                          <button
                            aria-label={`Remove ${x.id}`}
                            onClick={() =>
                              update((p) => {
                                const c = p.conversations.find(
                                  (z) => z.id === convo.id,
                                )!;
                                c.context = c.context.filter(
                                  (z) => z.id !== x.id,
                                );
                              })
                            }
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    ))}
                    <button onClick={() => setPicker(!picker)}>
                      <Plus size={13} /> Add context
                    </button>
                  </div>
                </div>
                <Button
                  className="danger"
                  disabled={convo.id === activeGoalConversation}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 /> Delete
                </Button>
              </header>
              {picker && (
                <div
                  className="context-picker"
                  role="dialog"
                  aria-label="Add project context"
                >
                  <div className="list-search">
                    <Search size={16} />
                    <input
                      autoFocus
                      value={contextQuery}
                      onChange={(e) => setContextQuery(e.target.value)}
                      placeholder="Search sources, artifacts, diagrams and documents"
                    />
                  </div>
                  {filtered.map((ref) => (
                    <button
                      key={`${ref.type}-${ref.id}`}
                      onClick={() => attach(ref, "attached")}
                    >
                      <i>
                        {ref.type === "Diagram" ? (
                          <GitBranch />
                        ) : ref.type === "Document" ? (
                          <FileText />
                        ) : (
                          <Paperclip />
                        )}
                      </i>
                      <span>
                        <b>
                          {ref.id} · {ref.label}
                        </b>
                        <small>
                          {ref.type}
                          {ref.version ? ` · v${ref.version}` : ""}
                        </small>
                      </span>
                      <Plus />
                    </button>
                  ))}
                  {!filtered.length && (
                    <p className="picker-empty">No matching project context.</p>
                  )}
                </div>
              )}
              <div className="chat-thread">
                {convo.messages.map((m) => (
                  <div className={`chat-message ${m.role}`} key={m.id}>
                    <i>
                      {m.role === "assistant" ? <Sparkles size={17} /> : "NK"}
                    </i>
                    <div>
                      <b>{m.role === "assistant" ? "BA Mate" : "You"}</b>
                      <p>{m.text}</p>
                      {m.references?.length ? (
                        <div className="message-references">
                          Used:{" "}
                          {m.references.map((x) => (
                            <button
                              key={x.id}
                              onClick={() =>
                                onNavigate(
                                  `/projects/${project.id}/${x.route ?? artifactRoute(x.type)}`,
                                )
                              }
                            >
                              {x.id}
                              {x.version ? ` v${x.version}` : ""}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {m.contextReceipt && (
                        <div className="context-receipt" title={m.contextReceipt.requestId}>
                          <Code2 size={13} />
                          <span>
                            Context {m.contextReceipt.estimatedTokens}/
                            {m.contextReceipt.tokenBudget} tokens · {m.contextReceipt.includedReferenceIds.length} included
                            {m.contextReceipt.omittedReferenceIds.length
                              ? ` · ${m.contextReceipt.omittedReferenceIds.length} compacted`
                              : ""}
                          </span>
                        </div>
                      )}
                      {m.proposal && (
                        <div className={`diff-card ${m.proposal.status}`}>
                          <header>
                            <GitBranch />
                            <b>
                              {m.proposal.kind} · {m.proposal.target}
                            </b>
                            <Pill>{m.proposal.status}</Pill>
                          </header>
                          <div>
                            <span>
                              <small>Before</small>
                              {m.proposal.before}
                            </span>
                            <ChevronRight />
                            <span>
                              <small>After</small>
                              {m.proposal.after}
                            </span>
                          </div>
                          <p>Impact: {m.proposal.impact.join(", ")}</p>
                          {m.proposal.status === "pending" && (
                            <footer>
                              <Button onClick={() => accept(m.id, "rejected")}>
                                Reject
                              </Button>
                              <Button
                                primary
                                onClick={() => accept(m.id, "accepted")}
                              >
                                Accept reviewed change
                              </Button>
                            </footer>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="chat-composer connected-composer">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask BA Mate or type @ to reference project work…"
                />
                {mention !== undefined && (
                  <div className="mention-menu" role="listbox" aria-label="Context mentions">
                    {filtered.map((ref) => (
                      <button
                        role="option"
                        aria-selected="false"
                        key={ref.id}
                        onClick={() => attach(ref, "mentioned")}
                      >
                        <AtSign />
                        {ref.id}
                        <span>{ref.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div>
                  <span>
                    <ShieldCheck size={14} /> Visible project context · BA
                    acceptance required
                  </span>
                  <Button primary disabled={!draft.trim() || sending} onClick={send}>
                    {sending ? "Thinking…" : "Send"}
                  </Button>
                </div>
              </div>
            </>
          )}
          {!convo && (
            <ConnectedEmpty
              icon={<MessageSquareText />}
              title="Select a conversation"
              description="Choose a conversation from the list or create a new one."
            />
          )}
        </Panel>
      </div>
      {confirmDelete && convo && (
        <ConfirmActionDialog
          title={`Delete “${convo.title}”?`}
          description="The local message history and attached conversation context will be removed. Referenced project artifacts will not be changed."
          confirmLabel="Delete conversation"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={deleteConversation}
        />
      )}
    </>
  );
}

const diagramTemplates: Record<Diagram["type"], string> = {
  Flowchart:
    "flowchart TD\n  A[Start] --> B[Review input]\n  B --> C{Decision}\n  C -->|Approved| D[Complete]\n  C -->|Exception| E[Human review]",
  Sequence:
    "sequenceDiagram\n  actor BA\n  participant System\n  BA->>System: Submit reviewed input\n  System-->>BA: Return governed proposal",
  State:
    "stateDiagram-v2\n  [*] --> Draft\n  Draft --> InReview\n  InReview --> Approved\n  Approved --> [*]",
  "Entity relationship":
    "erDiagram\n  PROJECT ||--o{ REQUIREMENT : contains\n  REQUIREMENT ||--o{ STORY : realizes",
  "User journey":
    "journey\n  title BA review journey\n  section Define\n    Review context: 5: BA\n    Approve artifact: 4: BA",
};

export function ConnectedDiagrams({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
}) {
  const [selected, setSelected] = useState<string | undefined>(
    project.diagrams[0]?.id,
  );
  const diagram = project.diagrams.find((d) => d.id === selected);
  const [source, setSource] = useState(diagram?.source ?? "");
  const [svg, setSvg] = useState("");
  const [lastValid, setLastValid] = useState("");
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(100);
  const [focusMode, setFocusMode] = useState(false);
  const [proposal, setProposal] = useState<{
    before: string;
    after: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const proposalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!proposal) return;
    proposalRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProposal(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [proposal]);
  useEffect(() => setSource(diagram?.source ?? ""), [selected]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "Inter, sans-serif",
        });
        await mermaid.parse(source);
        const result = await mermaid.render(`mermaid-${Date.now()}`, source);
        if (active) {
          setSvg(result.svg);
          setLastValid(result.svg);
          setError("");
        }
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message.split("\n")[0]
              : "Diagram syntax could not be parsed.",
          );
          setSvg(lastValid);
        }
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [source]);
  const nodes = useMemo(
    () =>
      Array.from(source.matchAll(/\b([A-Za-z][\w-]*)[\[{]([^\]}]+)[\]}]/g)).map(
        (m) => ({ id: m[1], label: m[2] }),
      ),
    [source],
  );
  const renameNode = (id: string, label: string) =>
    setSource((current) =>
      current.replace(
        new RegExp(`(${id}[\\[{])([^\\]}]+)([\\]}])`),
        `$1${label}$3`,
      ),
    );
  const save = () => {
    if (!diagram) return;
    update((p) => {
      const d = p.diagrams.find((x) => x.id === diagram.id)!;
      d.source = source;
      d.version++;
      d.approvalStatus = "Draft";
      d.status = "Draft";
      d.versions.unshift({
        version: d.version,
        source,
        at: "Just now",
        actor: "Business analyst",
        note: "Manual hybrid-editor revision",
      });
      p.documents.forEach((doc) =>
        doc.sections.forEach((sec) =>
          sec.blocks.forEach((block) => {
            if (
              block.embedding?.diagramId === d.id &&
              block.embedding.version < d.version
            )
              block.embedding.stale = true;
          }),
        ),
      );
      addAudit(
        p,
        "Saved diagram working version",
        d.id,
        `Version ${d.version} saved; pinned document embeds checked.`,
      );
    });
    notify(
      `${diagram.name} was saved as a new working version and returned to Draft for review.`,
      "success",
      "Diagram version saved",
    );
  };
  const exportSource = () => {
    if (!diagram) return;
    downloadBlob(
      new Blob([source], { type: "text/plain" }),
      `${diagram.id}-v${diagram.version}.mmd`,
    );
    notify("The Mermaid source download has started.", "success", "Diagram exported");
  };
  const exportSvg = () => {
    if (!diagram) return;
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml" }),
      `${diagram.id}-v${diagram.version}.svg`,
    );
    notify("The SVG download has started.", "success", "Diagram exported");
  };
  const exportPng = async () => {
    if (!diagram || !svg) return;
    const image = new window.Image();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || 1200;
      canvas.height = image.naturalHeight || 800;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
      canvas.toBlob(
        (png) => {
          if (!png) {
            notify("The browser could not create a PNG image.", "danger", "Export failed");
            return;
          }
          downloadBlob(png, `${diagram.id}-v${diagram.version}.png`);
          notify("The PNG download has started.", "success", "Diagram exported");
        },
      );
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      notify("The diagram could not be rasterized as PNG.", "danger", "Export failed");
    };
    image.src = url;
  };
  const embed = () => {
    if (!diagram) return;
    update((p) => {
      let doc = p.documents[0];
      if (!doc) {
        doc = {
          id: uid("DOC"),
          name: `${p.name} visual models`,
          template: "Software Requirements Specification",
          status: "draft",
          version: 1,
          receipts: [],
          comments: [],
          goalId: p.activeGoalId,
          sections: [],
        };
        p.documents.push(doc);
        linkDeliverableToActiveGoal(p, doc.id);
      }
      let section = doc.sections.find((s) =>
        s.title.toLowerCase().includes("design"),
      );
      if (!section) {
        section = {
          id: uid("SEC"),
          title: "Solution and process models",
          content: "Linked visual models",
          linkedIds: [],
          comments: [],
          blocks: [],
        };
        doc.sections.push(section);
      }
      section.blocks.push({
        id: uid("BLK"),
        type: "diagram",
        content: diagram.name,
        linkedIds: [diagram.id],
        embedding: {
          diagramId: diagram.id,
          version: diagram.version,
          insertedAt: "Just now",
          stale: false,
        },
      });
      section.linkedIds.push(diagram.id);
      doc.version++;
      addAudit(
        p,
        "Inserted version-pinned diagram",
        doc.id,
        `${diagram.id} v${diagram.version} inserted into ${doc.name}.`,
      );
    });
    notify(
      `${diagram.id} v${diagram.version} was inserted as a version-pinned document block.`,
      "success",
      "Diagram added to document",
    );
  };
  const deleteDiagram = () => {
    if (!diagram) return;
    const deletedId = diagram.id;
    const nextId = project.diagrams.find((item) => item.id !== deletedId)?.id;
    update((p) => {
      p.diagrams = p.diagrams.filter((item) => item.id !== deletedId);
      p.traceLinks = p.traceLinks.filter(
        (link) => link.from !== deletedId && link.to !== deletedId,
      );
      p.documents.forEach((document) =>
        document.sections.forEach((section) => {
          section.blocks = section.blocks.filter(
            (block) => block.embedding?.diagramId !== deletedId,
          );
          section.linkedIds = section.linkedIds.filter((id) => id !== deletedId);
        }),
      );
      p.goals.forEach(
        (goal) =>
          (goal.deliverables = goal.deliverables.filter((id) => id !== deletedId)),
      );
      addAudit(
        p,
        "Deleted diagram",
        deletedId,
        "Removed the visual model, its trace links and version-pinned document blocks.",
      );
    });
    setSelected(nextId);
    setConfirmDelete(false);
    notify(
      `${deletedId} and its linked document blocks were removed.`,
      "success",
      "Diagram deleted",
    );
  };
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Governed visual models</span>
          <h1>Diagram studio</h1>
          <p>
            Generate, inspect, edit, approve and publish traceable Mermaid
            diagrams.
          </p>
        </div>
        <div className="page-actions">
          <Button
            onClick={() =>
              setProposal({
                before: source,
                after: source.replace(
                  "Human review",
                  "Human review and record rationale",
                ),
              })
            }
          >
            <WandSparkles size={16} /> Example wording revision
          </Button>
          <Button onClick={save}>
            <Save size={16} /> Save version
          </Button>
          <Button
            primary
            disabled={!diagram || !!error}
            onClick={() => {
              if (!diagram) return;
              const issues = approvalIssuesForArtifact(project, diagram.id);
              if (issues.length) {
                notify(issues.join(" "), "warning", "Approval needs review");
                return;
              }
              update((p) => {
                const d = p.diagrams.find((x) => x.id === diagram!.id)!;
                d.approvalStatus = "Approved";
                d.status = "Approved";
                addAudit(
                  p,
                  "Approved diagram",
                  d.id,
                  `Diagram v${d.version} approved by Lead BA.`,
                );
              });
              notify(
                `${diagram?.name ?? "The diagram"} is approved and available for document embedding.`,
                "success",
                "Diagram approved",
              );
            }}
          >
            <Check size={16} /> Approve
          </Button>
        </div>
      </div>
      <div className="connected-diagram-layout">
        <Panel className="diagram-library">
          <header>
            <h2>Project diagrams</h2>
            <p>{project.diagrams.length} linked visual models</p>
          </header>
          {project.diagrams.map((d) => (
            <button
              className={d.id === selected ? "active" : ""}
              key={d.id}
              onClick={() => setSelected(d.id)}
            >
              <GitBranch />
              <span>
                <b>{d.name}</b>
                <small>
                  {d.type} · v{d.version}
                </small>
              </span>
              <Pill>{d.status}</Pill>
            </button>
          ))}
          <div className="new-diagram-row">
            <select id="new-diagram-type" aria-label="New diagram type">
              {Object.keys(diagramTemplates).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <Button
              onClick={() => {
                const el = document.getElementById(
                  "new-diagram-type",
                ) as HTMLSelectElement;
                const type = el.value as Diagram["type"];
                const id = uid("DGM");
                update((p) => {
                  p.diagrams.push({
                    id,
                    name: `Untitled ${type.toLowerCase()}`,
                    type,
                    source: diagramTemplates[type],
                    linkedIds: [],
                    version: 1,
                    status: "Draft",
                    approvalStatus: "Draft",
                    comments: [],
                    versions: [],
                    goalId: p.activeGoalId,
                  });
                  linkDeliverableToActiveGoal(p, id);
                });
                setSelected(id);
                notify(
                  `A new ${type.toLowerCase()} was added as an editable draft.`,
                  "success",
                  "Diagram created",
                );
              }}
            >
              <Plus /> New
            </Button>
          </div>
        </Panel>
        {diagram && (
          <Panel
            className={`diagram-workbench ${focusMode ? "diagram-focus-mode" : ""}`}
          >
            <div className="diagram-commandbar">
              <div>
                <Pill tone="purple">{diagram.id}</Pill>
                <input
                  aria-label="Diagram name"
                  value={diagram.name}
                  onChange={(e) =>
                    update((p) => {
                      p.diagrams.find((d) => d.id === diagram.id)!.name =
                        e.target.value;
                    })
                  }
                />
                <Pill>{diagram.approvalStatus}</Pill>
                {error ? (
                  <Pill tone="danger">Syntax issue</Pill>
                ) : (
                  <Pill tone="success">Valid Mermaid</Pill>
                )}
              </div>
              <div className="export-menu">
                <button
                  title="Zoom out"
                  aria-label="Zoom diagram out"
                  disabled={zoom <= 50}
                  onClick={() => setZoom((value) => Math.max(50, value - 10))}
                >
                  <ZoomOut />
                </button>
                <button
                  className="zoom-value"
                  title="Reset zoom"
                  onClick={() => setZoom(100)}
                >
                  {zoom}%
                </button>
                <button
                  title="Zoom in"
                  aria-label="Zoom diagram in"
                  disabled={zoom >= 200}
                  onClick={() => setZoom((value) => Math.min(200, value + 10))}
                >
                  <ZoomIn />
                </button>
                <button
                  title={focusMode ? "Exit focus mode" : "Open focus mode"}
                  aria-label={focusMode ? "Exit diagram focus mode" : "Open diagram focus mode"}
                  onClick={() => setFocusMode(!focusMode)}
                >
                  {focusMode ? <Minimize2 /> : <Maximize2 />}
                </button>
                <button onClick={exportSource}>Mermaid</button>
                <button onClick={exportSvg}>SVG</button>
                <button onClick={exportPng}>PNG</button>
                <button
                  onClick={() =>
                    void mockPdf(svg, diagram)
                      .then(() =>
                        notify(
                          "The PDF download has started.",
                          "success",
                          "Diagram exported",
                        ),
                      )
                      .catch((reason) =>
                        notify(
                          reason instanceof Error
                            ? reason.message
                            : "The diagram PDF could not be created.",
                          "danger",
                          "Export failed",
                        ),
                      )
                  }
                >
                  PDF
                </button>
                <button
                  onClick={embed}
                  disabled={diagram.approvalStatus !== "Approved"}
                >
                  <FilePlus2 /> Add to document
                </button>
              </div>
            </div>
            {error && (
              <div className="diagram-error">
                <Code2 />
                <span>
                  <b>Mermaid validation issue</b>
                  <small>
                    {error}. The last valid preview remains visible.
                  </small>
                </span>
              </div>
            )}
            <div className="hybrid-editor">
              <div className="mermaid-preview" ref={previewRef}>
                <div
                  className="diagram-preview-scale"
                  style={{ transform: `scale(${zoom / 100})` }}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </div>
              <aside className="node-inspector">
                <h3>Structured node editor</h3>
                <p>
                  Edit common flowchart node labels while source stays
                  synchronized.
                </p>
                {nodes.map((node) => (
                  <label key={node.id}>
                    <span>{node.id}</span>
                    <input
                      value={node.label}
                      onChange={(e) => renameNode(node.id, e.target.value)}
                    />
                    <div className="reference-row">
                      {diagram.linkedIds.map((id) => (
                        <Pill key={id}>{id}</Pill>
                      ))}
                    </div>
                  </label>
                ))}
                {!nodes.length && (
                  <div className="empty-mini">
                    This diagram type is edited through Mermaid source.
                  </div>
                )}
              </aside>
              <label className="mermaid-source">
                <span>
                  <Code2 /> Mermaid source
                </span>
                <textarea
                  spellCheck={false}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </label>
            </div>
            <div className="diagram-footer">
              <Button
                onClick={() =>
                  update((p) => {
                    const d = p.diagrams.find((x) => x.id === diagram.id)!;
                    const copy = {
                      ...d,
                      id: uid("DGM"),
                      name: `${d.name} copy`,
                      approvalStatus: "Draft" as const,
                      status: "Draft" as const,
                      version: 1,
                      versions: [],
                    };
                    p.diagrams.push(copy);
                    addAudit(
                      p,
                      "Duplicated diagram",
                      copy.id,
                      `Created from ${d.id} v${d.version}.`,
                    );
                  })
                }
              >
                <Copy /> Duplicate
              </Button>
              <Button
                onClick={() =>
                  update((p) => {
                    const d = p.diagrams.find((x) => x.id === diagram.id)!;
                    d.comments.push({
                      id: uid("COM"),
                      author: "Business analyst",
                      text: "Review node labels and linked exception paths.",
                      at: "Just now",
                      resolved: false,
                    });
                    addAudit(
                      p,
                      "Commented on diagram",
                      d.id,
                      "Diagram review comment added.",
                    );
                  })
                }
              >
                <MessageSquareText /> Comments ({diagram.comments.length})
              </Button>
              <Button className="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </Button>
              <span>
                {diagram.versions.length} retained versions ·{" "}
                {diagram.linkedIds.length} artifact links
              </span>
            </div>
          </Panel>
        )}
        {!diagram && (
          <Panel className="diagram-workbench">
            <ConnectedEmpty
              icon={<GitBranch />}
              title="No diagram selected"
              description="Choose a diagram from the library or create a new governed visual model."
            />
          </Panel>
        )}
      </div>
      {proposal && (
        <div
          ref={proposalRef}
          className="proposal-drawer"
          role="dialog"
          aria-label="Review proposed diagram revision"
        >
          <header>
            <Sparkles />
            <div>
              <b>Proposed diagram revision</b>
              <small>
                Template example · requires review · BA acceptance required
              </small>
            </div>
            <button
              type="button"
              aria-label="Close proposed diagram revision"
              onClick={() => setProposal(null)}
            >
              <X />
            </button>
          </header>
          <div className="sync-diff">
            <span>
              <small>Before</small>
              {proposal.before}
            </span>
            <ChevronRight />
            <span>
              <small>After</small>
              {proposal.after}
            </span>
          </div>
          <div className="context-note warning">
            <Network />
            <div>
              <b>Potential impact</b>
              <p>
                Linked requirements, stories and pinned document embeds will be
                checked after acceptance.
              </p>
            </div>
          </div>
          <footer>
            <Button
              onClick={() => {
                setProposal(null);
                notify(
                  "The proposed revision was rejected without changing the working source.",
                  "info",
                  "Proposal rejected",
                );
              }}
            >
              Reject
            </Button>
            <Button
              primary
              onClick={() => {
                setSource(proposal.after);
                setProposal(null);
                notify(
                  "The revision was accepted into the working draft and still requires an explicit save and approval.",
                  "success",
                  "Proposal accepted",
                );
              }}
            >
              Accept into working draft
            </Button>
          </footer>
        </div>
      )}
      {confirmDelete && diagram && (
        <ConfirmActionDialog
          title={`Delete “${diagram.name}”?`}
          description="The diagram, its trace links and any version-pinned document blocks will be removed from this local project."
          confirmLabel="Delete diagram"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={deleteDiagram}
        />
      )}
    </>
  );
}

async function mockPdf(svg: string, diagram: Diagram) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const item = new window.Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    item.onload = () => {
      URL.revokeObjectURL(url);
      resolve(item);
    };
    item.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to rasterize diagram"));
    };
    item.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || 1200;
  canvas.height = image.naturalHeight || 800;
  canvas.getContext("2d")?.drawImage(image, 0, 0);
  const png = canvas.toDataURL("image/png");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  pdf.setFontSize(18);
  pdf.text(
    `${diagram.name} · v${diagram.version} · BA-approved visual model`,
    40,
    36,
  );
  const maxW = 760,
    maxH = 500,
    ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
  pdf.addImage(png, "PNG", 40, 55, canvas.width * ratio, canvas.height * ratio);
  pdf.setFontSize(9);
  pdf.text(
    `Artifact ${diagram.id} · linked: ${diagram.linkedIds.join(", ") || "None"} · version-pinned export`,
    40,
    575,
  );
  pdf.save(`${diagram.id}-v${diagram.version}.pdf`);
}

const blockLabel: Record<DocumentBlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  "bullet-list": "Bullet list",
  "numbered-list": "Numbered list",
  table: "Table",
  callout: "Callout",
  "requirements-table": "Requirements table",
  "stories-table": "Stories table",
  "traceability-matrix": "Traceability matrix",
  diagram: "Diagram",
  "artifact-reference": "Artifact reference",
};
const initialSections = (template: DocumentTemplate) =>
  template === "Software Requirements Specification"
    ? [
        "Purpose and scope",
        "Stakeholders and context",
        "Functional requirements",
        "Non-functional requirements",
        "User stories and acceptance criteria",
        "Solution and process models",
        "Governance and traceability",
      ]
    : template === "Business Requirements Document"
      ? [
          "Executive summary",
          "Business objectives",
          "Scope",
          "Stakeholders",
          "Business requirements",
          "Risks and decisions",
        ]
      : template === "Requirements Addendum"
        ? [
            "Addendum summary",
            "Changed requirements",
            "Impact assessment",
            "Approval",
          ]
        : template === "Change Impact Report"
          ? [
              "Change summary",
              "Affected artifacts",
              "Proposed updates",
              "Revalidation",
            ]
          : template === "Traceability Report"
            ? [
                "Coverage summary",
                "Traceability matrix",
                "Broken and pending links",
              ]
            : [
                "Workshop details",
                "Participants",
                "Discussion summary",
                "Decisions",
                "Actions and open questions",
              ];

export function ConnectedDocuments({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
}) {
  const [selected, setSelected] = useState<string | undefined>(
    project.documents[0]?.id,
  );
  const [exportSelection, setExportSelection] = useState<ExportSelection>({ kind: "working" });
  const document = project.documents.find((d) => d.id === selected);
  const [query, setQuery] = useState("");
  const [newTemplate, setNewTemplate] = useState<DocumentTemplate>(
    "Software Requirements Specification",
  );
  // History belongs to the document identity, never to the currently selected
  // editor tab. Otherwise undoing after selecting B can overwrite B with A.
  const [undoStacks, setUndoStacks] = useState<Record<string, ProjectDocument[]>>({});
  const [redoStacks, setRedoStacks] = useState<Record<string, ProjectDocument[]>>({});
  const [dragBlock, setDragBlock] = useState<string>();
  const [linkPicker, setLinkPicker] = useState<{
    sectionId: string;
    blockId: string;
  }>();
  const [pendingBlockDelete, setPendingBlockDelete] = useState<{
    sectionId: string;
    blockId: string;
  }>();
  const [confirmDocumentDelete, setConfirmDocumentDelete] = useState(false);
  const runExport = async (format: string, action: () => void | Promise<void>) => {
    try {
      await action();
      notify(
        `The ${format} document download has started.`,
        "success",
        "Document exported",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : `The ${format} export failed.`,
        "danger",
        "Export failed",
      );
    }
  };
  const visibleBlocks =
    document?.sections
      .flatMap((s) => s.blocks.map((b) => ({ section: s, block: b })))
      .filter((x) =>
        (x.section.title + " " + x.block.content)
          .toLowerCase()
          .includes(query.toLowerCase()),
      ) ?? [];
  const cloneDoc = (doc: ProjectDocument) =>
    JSON.parse(JSON.stringify(doc)) as ProjectDocument;
  const undoStack = document ? undoStacks[document.id] ?? [] : [];
  const redoStack = document ? redoStacks[document.id] ?? [] : [];
  const checkpoint = () => {
    if (document) {
      setUndoStacks((stacks) => ({ ...stacks, [document.id]: [...(stacks[document.id] ?? []), cloneDoc(document)].slice(-20) }));
      setRedoStacks((stacks) => ({ ...stacks, [document.id]: [] }));
    }
  };
  const editBlock = (
    sectionId: string,
    blockId: string,
    patch: Partial<DocumentBlock>,
  ) => {
    checkpoint();
    update((p) => {
      const doc = p.documents.find((d) => d.id === selected)!;
      const block = doc.sections
        .find((s) => s.id === sectionId)!
        .blocks.find((b) => b.id === blockId)!;
      Object.assign(block, patch);
      doc.version++;
      addAudit(
        p,
        "Edited structured document block",
        `${doc.id}/${block.id}`,
        `Document working version advanced to ${doc.version}.`,
      );
    });
  };
  const move = (sectionId: string, blockId: string, direction: -1 | 1) => {
    checkpoint();
    update((p) => {
      const doc = p.documents.find((d) => d.id === selected)!;
      const blocks = doc.sections.find((s) => s.id === sectionId)!.blocks;
      const index = blocks.findIndex((b) => b.id === blockId);
      const next = index + direction;
      if (next >= 0 && next < blocks.length) {
        [blocks[index], blocks[next]] = [blocks[next], blocks[index]];
        doc.version++;
      }
    });
  };
  const create = () => {
    const id = uid("DOC");
    update((p) => {
      p.documents.unshift({
        id,
        name: `${p.name} ${newTemplate}`,
        template: newTemplate,
        status: "draft",
        version: 1,
        receipts: [],
        comments: [],
        goalId: p.activeGoalId,
        sections: initialSections(newTemplate).map((title, index) => ({
          id: uid("SEC"),
          title: `${index + 1}. ${title}`,
          content: "",
          linkedIds: [],
          comments: [],
          blocks: [
            {
              id: uid("BLK"),
              type: index === 0 ? "heading" : "paragraph",
              content:
                index === 0
                  ? title
                  : "Start authoring this controlled section.",
              linkedIds: [],
            },
          ],
        })),
      });
      linkDeliverableToActiveGoal(p, id);
    });
    setSelected(id);
    notify(
      `${newTemplate} was created with a governed section structure.`,
      "success",
      "Document created",
    );
  };
  const deleteDocument = () => {
    if (!document) return;
    const deletedId = document.id;
    const nextId = project.documents.find((item) => item.id !== deletedId)?.id;
    update((p) => {
      p.documents = p.documents.filter((item) => item.id !== deletedId);
      p.documentSyncProposals = p.documentSyncProposals.filter(
        (proposal) => proposal.targetDocumentId !== deletedId,
      );
      p.traceLinks = p.traceLinks.filter(
        (link) => link.from !== deletedId && link.to !== deletedId,
      );
      p.goals.forEach(
        (goal) =>
          (goal.deliverables = goal.deliverables.filter((id) => id !== deletedId)),
      );
      addAudit(
        p,
        "Deleted document",
        deletedId,
        "Removed the controlled document and its pending synchronization proposals.",
      );
    });
    setSelected(nextId);
    setConfirmDocumentDelete(false);
    notify(
      `${deletedId} and its pending synchronization proposals were removed.`,
      "success",
      "Document deleted",
    );
  };
  const addBlock = (sectionId: string, type: DocumentBlockType) => {
    checkpoint();
    update((p) => {
      const doc = p.documents.find((d) => d.id === selected)!;
      doc.sections
        .find((s) => s.id === sectionId)!
        .blocks.push({
          id: uid("BLK"),
          type,
          content:
            type === "table"
              ? "Column A | Column B\nValue A | Value B"
              : type === "callout"
                ? "Important reviewed note"
                : `New ${blockLabel[type].toLowerCase()}`,
          linkedIds: [],
        });
      doc.version++;
    });
  };
  const addSection = () => {
    if (!document) return;
    checkpoint();
    update((p) => {
      const doc = p.documents.find((d) => d.id === selected)!;
      const sectionNumber = doc.sections.length + 1;
      doc.sections.push({
        id: uid("SEC"),
        title: `${sectionNumber}. New section`,
        content: "",
        linkedIds: [],
        comments: [],
        blocks: [
          {
            id: uid("BLK"),
            type: "paragraph",
            content: "Start authoring this controlled section.",
            linkedIds: [],
          },
        ],
      });
      doc.version++;
      addAudit(
        p,
        "Added document section",
        doc.id,
        `Section ${sectionNumber} added to document v${doc.version}.`,
      );
    });
    notify(
      "A new editable section was appended to the working document.",
      "success",
      "Section added",
    );
  };
  const deleteBlock = (sectionId: string, blockId: string) => {
    checkpoint();
    update((p) => {
      const doc = p.documents.find((d) => d.id === document?.id)!;
      const blocks = doc.sections.find((s) => s.id === sectionId)!.blocks;
      blocks.splice(
        blocks.findIndex((block) => block.id === blockId),
        1,
      );
      doc.version++;
    });
    setPendingBlockDelete(undefined);
    notify(
      "The document block was removed and a new working version was recorded.",
      "success",
      "Block deleted",
    );
  };
  const toggleBlockLink = (
    sectionId: string,
    blockId: string,
    artifactId: string,
  ) => {
    const block = document?.sections
      .find((section) => section.id === sectionId)
      ?.blocks.find((item) => item.id === blockId);
    if (!block) return;
    editBlock(sectionId, blockId, {
      linkedIds: block.linkedIds.includes(artifactId)
        ? block.linkedIds.filter((id) => id !== artifactId)
        : [...block.linkedIds, artifactId],
    });
  };
  const refreshDiagram = (sectionId: string, blockId: string) =>
    update((p) => {
      const doc = p.documents.find((d) => d.id === selected)!;
      const block = doc.sections
        .find((s) => s.id === sectionId)!
        .blocks.find((b) => b.id === blockId)!;
      const diagram = p.diagrams.find(
        (d) => d.id === block.embedding?.diagramId,
      );
      if (diagram && block.embedding) {
        block.embedding.version = diagram.version;
        block.embedding.stale = false;
        block.content = diagram.name;
        doc.version++;
        addAudit(
          p,
          "Refreshed pinned diagram",
          doc.id,
          `${diagram.id} v${diagram.version} accepted into document v${doc.version}.`,
        );
      }
    });
  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous || !document) return;
    setRedoStacks((stacks) => ({ ...stacks, [document.id]: [cloneDoc(document), ...(stacks[document.id] ?? [])].slice(0, 20) }));
    setUndoStacks((stacks) => ({ ...stacks, [document.id]: (stacks[document.id] ?? []).slice(0, -1) }));
    update((p) => {
      p.documents[p.documents.findIndex((d) => d.id === document.id)] =
        cloneDoc(previous);
    });
  };
  const redo = () => {
    const next = redoStack[0];
    if (!next || !document) return;
    setUndoStacks((stacks) => ({ ...stacks, [document.id]: [...(stacks[document.id] ?? []), cloneDoc(document)].slice(-20) }));
    setRedoStacks((stacks) => ({ ...stacks, [document.id]: (stacks[document.id] ?? []).slice(1) }));
    update((p) => {
      p.documents[p.documents.findIndex((d) => d.id === document.id)] =
        cloneDoc(next);
    });
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z")
        return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea")) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [document?.id, undoStack, redoStack]);
  const dropBlock = (sectionId: string, targetId: string) => {
    if (!dragBlock || dragBlock === targetId) return;
    checkpoint();
    update((p) => {
      const blocks = p.documents
        .find((d) => d.id === selected)!
        .sections.find((s) => s.id === sectionId)!.blocks;
      const from = blocks.findIndex((b) => b.id === dragBlock),
        to = blocks.findIndex((b) => b.id === targetId);
      if (from < 0 || to < 0) return;
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved);
      p.documents.find((d) => d.id === selected)!.version++;
    });
    setDragBlock(undefined);
  };
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Structured BA deliverables</span>
          <h1>Document studio</h1>
          <p>
            Template-led documents with governed artifact synchronization and
            version-pinned diagrams.
          </p>
        </div>
        {document && (
          <div className="page-actions">
            <label>
              Export revision
              <select
                aria-label="Export revision"
                value={exportSelection.kind === "working" ? "working" : exportSelection.baselineId}
                onChange={(event) =>
                  setExportSelection(
                    event.target.value === "working"
                      ? { kind: "working" }
                      : { kind: "baseline", baselineId: event.target.value },
                  )
                }
              >
                <option value="working">Working revision {document.version} — not approved</option>
                {project.versions
                  .filter((version) => version.type === "Baseline" && version.locked)
                  .map((version) => (
                    <option key={version.id} value={version.id}>
                      Approved baseline {version.version}
                    </option>
                  ))}
              </select>
            </label>
            <Button onClick={() => void runExport("JSON", () => exportJson(project))}>
              <Download /> JSON
            </Button>
            <Button
              onClick={() =>
                void runExport("Markdown", () => exportMarkdown(project, document.id, exportSelection))
              }
            >
              Markdown
            </Button>
            <Button
              onClick={() =>
                void runExport("developer handover", () => exportDeveloperMarkdown(project, document.id, exportSelection))
              }
            >
              Developer handover
            </Button>
            <Button
              onClick={() =>
                void runExport("DOCX", () => exportDocx(project, document.id, exportSelection))
              }
            >
              DOCX
            </Button>
            <Button
              primary
              onClick={() =>
                void runExport("PDF", () => exportPdf(project, document.id, exportSelection))
              }
            >
              PDF
            </Button>
          </div>
        )}
      </div>
      <div className="document-catalog">
        <select
          aria-label="New document template"
          value={newTemplate}
          onChange={(e) => setNewTemplate(e.target.value as DocumentTemplate)}
        >
          {templates.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <Button primary onClick={create}>
          <FilePlus2 /> New from template
        </Button>
        <div className="list-search">
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find within document"
          />
        </div>
      </div>
      <div className="connected-document-layout">
        <Panel className="document-library">
          <header>
            <h2>Project documents</h2>
            <p>{project.documents.length} controlled deliverables</p>
          </header>
          {project.documents.map((d) => (
            <button
              className={selected === d.id ? "active" : ""}
              key={d.id}
              onClick={() => setSelected(d.id)}
            >
              <FileText />
              <span>
                <b>{d.name}</b>
                <small>
                  {d.template} · v{d.version}
                </small>
              </span>
              <Pill>{d.status}</Pill>
            </button>
          ))}
        </Panel>
        {document && (
          <Panel className="structured-document">
            <div className="document-meta">
              <div>
                <Pill tone="purple">{document.id}</Pill>
                <input
                  aria-label="Document name"
                  value={document.name}
                  onChange={(e) =>
                    update((p) => {
                      p.documents.find((d) => d.id === document.id)!.name =
                        e.target.value;
                    })
                  }
                />
                <Pill>{document.status}</Pill>
                <span>v{document.version}</span>
              </div>
              <div>
                <Button onClick={undo} disabled={!undoStack.length}>
                  <Undo2 /> Undo
                </Button>
                <Button onClick={redo} disabled={!redoStack.length}>
                  <Redo2 /> Redo
                </Button>
                <Button
                  onClick={() => {
                    update((p) => {
                      const d = p.documents.find((x) => x.id === document.id)!;
                      d.comments.push({
                        id: uid("COM"),
                        author: "Business analyst",
                        text: "Verify this document against the latest approved artifact set.",
                        at: "Just now",
                        resolved: false,
                      });
                      addAudit(
                        p,
                        "Commented on document",
                        d.id,
                        "Document review comment added.",
                      );
                    });
                    notify(
                      "A review comment was added to the document history.",
                      "success",
                      "Comment added",
                    );
                  }}
                >
                  <MessageSquareText /> Comments ({document.comments.length})
                </Button>
                <Button
                  onClick={() => {
                    update((p) => {
                      const d = p.documents.find((x) => x.id === document.id)!;
                      d.status = "in-review";
                      addAudit(
                        p,
                        "Submitted document for review",
                        d.id,
                        `Document v${d.version} awaits human review.`,
                      );
                    });
                    notify(
                      `${document.name} is now awaiting human review.`,
                      "success",
                      "Document submitted",
                    );
                  }}
                >
                  Submit for review
                </Button>
                <Button
                  className="danger"
                  onClick={() => setConfirmDocumentDelete(true)}
                >
                  <Trash2 /> Delete
                </Button>
              </div>
            </div>
            <nav className="section-navigation">
              {document.sections.map((s) => (
                <a key={s.id} href={`#${s.id}`}>
                  {s.title}
                </a>
              ))}
              <button onClick={addSection}>
                <Plus /> Add section
              </button>
            </nav>
            <article className="document-canvas">
              <header>
                <span>BA MATE · CONTROLLED ARTIFACT</span>
                <h1>{document.name}</h1>
                <p>
                  {project.name} · {document.template} · Working version{" "}
                  {document.version}
                </p>
              </header>
              {document.sections.map((section) => (
                <section id={section.id} key={section.id}>
                  <div className="section-heading">
                    <input
                      aria-label={`Section title: ${section.title}`}
                      value={section.title}
                      onChange={(e) =>
                        update((p) => {
                          p.documents
                            .find((d) => d.id === document.id)!
                            .sections.find((s) => s.id === section.id)!.title =
                            e.target.value;
                        })
                      }
                    />
                    <span>{section.blocks.length} blocks</span>
                  </div>
                  {section.blocks
                    .filter(
                      (block) =>
                        !query ||
                        visibleBlocks.some((x) => x.block.id === block.id),
                    )
                    .map((block, index) => (
                      <div
                        className={`document-block block-${block.type}`}
                        key={block.id}
                        draggable
                        onDragStart={() => setDragBlock(block.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => dropBlock(section.id, block.id)}
                      >
                        <div className="block-toolbar">
                          <select
                            aria-label={`Block type in ${section.title}`}
                            value={block.type}
                            onChange={(e) =>
                              editBlock(section.id, block.id, {
                                type: e.target.value as DocumentBlockType,
                              })
                            }
                          >
                            {Object.entries(blockLabel).map(
                              ([value, label]) => (
                                <option value={value} key={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                          <button
                            title="Bold"
                            onClick={() =>
                              editBlock(section.id, block.id, {
                                style:
                                  block.style === "bold" ? "normal" : "bold",
                              })
                            }
                          >
                            <Bold />
                          </button>
                          <button
                            title="Italic"
                            onClick={() =>
                              editBlock(section.id, block.id, {
                                style:
                                  block.style === "italic"
                                    ? "normal"
                                    : "italic",
                              })
                            }
                          >
                            <Italic />
                          </button>
                          <button
                            title="Underline"
                            onClick={() =>
                              editBlock(section.id, block.id, {
                                style:
                                  block.style === "underline"
                                    ? "normal"
                                    : "underline",
                              })
                            }
                          >
                            <Underline />
                          </button>
                          <button
                            title="Align left"
                            onClick={() =>
                              editBlock(section.id, block.id, {
                                alignment: "left",
                              })
                            }
                          >
                            <AlignLeft />
                          </button>
                          <button
                            title="Align center"
                            onClick={() =>
                              editBlock(section.id, block.id, {
                                alignment: "center",
                              })
                            }
                          >
                            <AlignCenter />
                          </button>
                          <button
                            title="Align right"
                            onClick={() =>
                              editBlock(section.id, block.id, {
                                alignment: "right",
                              })
                            }
                          >
                            <AlignRight />
                          </button>
                          <button
                            title="Move up"
                            onClick={() => move(section.id, block.id, -1)}
                            disabled={index === 0}
                          >
                            <ArrowUp />
                          </button>
                          <button
                            title="Move down"
                            onClick={() => move(section.id, block.id, 1)}
                            disabled={index === section.blocks.length - 1}
                          >
                            <ArrowDown />
                          </button>
                          <button
                            title="Delete block"
                            aria-label="Delete document block"
                            onClick={() =>
                              setPendingBlockDelete({
                                sectionId: section.id,
                                blockId: block.id,
                              })
                            }
                          >
                            <Trash2 />
                          </button>
                        </div>
                        {block.type === "diagram" && block.embedding ? (
                          <DiagramBlock
                            block={block}
                            project={project}
                            onRefresh={() =>
                              refreshDiagram(section.id, block.id)
                            }
                          />
                        ) : (
                          <textarea
                            aria-label={`${blockLabel[block.type]} content in ${section.title}`}
                            className={block.style ?? "normal"}
                            style={{ textAlign: block.alignment ?? "left" }}
                            value={block.content}
                            onChange={(e) =>
                              editBlock(section.id, block.id, {
                                content: e.target.value,
                              })
                            }
                          />
                        )}
                        <footer>
                          <Link2 />{" "}
                          {block.linkedIds.length
                            ? block.linkedIds.join(", ")
                            : "No artifact links"}{" "}
                          <button
                            aria-expanded={
                              linkPicker?.sectionId === section.id &&
                              linkPicker?.blockId === block.id
                            }
                            onClick={() =>
                              setLinkPicker((current) =>
                                current?.sectionId === section.id &&
                                current.blockId === block.id
                                  ? undefined
                                  : { sectionId: section.id, blockId: block.id },
                              )
                            }
                          >
                            Manage links
                          </button>
                          {linkPicker?.sectionId === section.id &&
                            linkPicker.blockId === block.id && (
                              <div className="block-link-picker">
                                <header>
                                  <b>Linked project artifacts</b>
                                  <button
                                    aria-label="Close artifact link picker"
                                    onClick={() => setLinkPicker(undefined)}
                                  >
                                    <X />
                                  </button>
                                </header>
                                {projectReferences(project).map((reference) => (
                                  <label key={`${reference.type}-${reference.id}`}>
                                    <input
                                      type="checkbox"
                                      checked={block.linkedIds.includes(reference.id)}
                                      onChange={() =>
                                        toggleBlockLink(
                                          section.id,
                                          block.id,
                                          reference.id,
                                        )
                                      }
                                    />
                                    <span>
                                      <b>{reference.id}</b>
                                      <small>{reference.label}</small>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                        </footer>
                      </div>
                    ))}
                  <div className="add-block-menu">
                    <Button onClick={() => addBlock(section.id, "paragraph")}>
                      <Plus /> Paragraph
                    </Button>
                    <Button onClick={() => addBlock(section.id, "bullet-list")}>
                      <List /> List
                    </Button>
                    <Button onClick={() => addBlock(section.id, "table")}>
                      <Table2 /> Table
                    </Button>
                    <Button onClick={() => addBlock(section.id, "callout")}>
                      <BookOpen /> Callout
                    </Button>
                  </div>
                </section>
              ))}
            </article>
          </Panel>
        )}
        {!document && (
          <Panel className="structured-document">
            <ConnectedEmpty
              icon={<FileText />}
              title="No document selected"
              description="Choose a controlled document or create one from the selected template."
            />
          </Panel>
        )}
      </div>
      {pendingBlockDelete && (
        <ConfirmActionDialog
          title="Delete this document block?"
          description="The block content and its artifact links will be removed from the current working document version."
          confirmLabel="Delete block"
          onCancel={() => setPendingBlockDelete(undefined)}
          onConfirm={() =>
            deleteBlock(
              pendingBlockDelete.sectionId,
              pendingBlockDelete.blockId,
            )
          }
        />
      )}
      {confirmDocumentDelete && document && (
        <ConfirmActionDialog
          title={`Delete “${document.name}”?`}
          description="The controlled document and any pending synchronization proposals targeting it will be removed from this local project."
          confirmLabel="Delete document"
          onCancel={() => setConfirmDocumentDelete(false)}
          onConfirm={deleteDocument}
        />
      )}
    </>
  );
}

function DiagramBlock({
  block,
  project,
  onRefresh,
}: {
  block: DocumentBlock;
  project: Project;
  onRefresh: () => void;
}) {
  const diagram = project.diagrams.find(
    (d) => d.id === block.embedding?.diagramId,
  );
  return (
    <div
      className={`embedded-diagram ${block.embedding?.stale ? "stale" : ""}`}
    >
      <GitBranch />
      <div>
        <b>{diagram?.name ?? block.content}</b>
        <small>
          {block.embedding?.diagramId} · inserted v{block.embedding?.version} ·
          latest v{diagram?.version}
        </small>
      </div>
      {block.embedding?.stale ? (
        <Button primary onClick={onRefresh}>
          <RefreshCw /> Review and refresh
        </Button>
      ) : (
        <Pill tone="success">
          <CheckCircle2 /> Current
        </Pill>
      )}
    </div>
  );
}
