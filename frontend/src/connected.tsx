import { ChatContextDisclosure } from "./ChatContextDisclosure";
import { MentionTextarea } from "./ChatComposer";
import { useChatRequest } from "./useChatRequest";
import { storyNarrative } from "./storyNarrative";
import { conversationDraftKey, conversationDrafts } from "./conversationDrafts";
import { useEvaluation } from "./EvaluationContext";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useLocation } from "react-router-dom";
import { normalizeSearchText } from "./sourceSearch";
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
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type {
  ArtifactProposal,
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
import { goalSelectableSource } from "./projectSources";
import { verifySourceOriginal } from "./workspaceFiles";
import { findSyncBlock, srsContent, syncProposalIsStale, syncProvenance } from "./controlledChanges";
import { exportDeveloperMarkdown, exportDocx, exportJson, exportMarkdown, exportPdf, renderedDiagram, svgToPng, type ExportSelection } from "./exporters";
import { buildModelRequest, conversationProjectContext, chatProposalContextCurrent, modelContextFingerprint, projectEvidence, requestModelCompletion } from "./modelGateway";
import { modelSourceProblems, sourceCheckFingerprint } from "./sourceScope";
import { verifyGoalSourceOriginals } from "./workspaceFiles";
import { artifactRoute, projectReferences } from "./references";
import { notify, useDialogAccessibility, onTabListKeyDown } from "./ui";

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
  children, className = "", elementRef, dialogLabel,
}: {
  children: ReactNode; className?: string;
  elementRef?: RefObject<HTMLElement | null>; dialogLabel?: string;
}) => <section ref={elementRef} className={`card ${className}`} role={dialogLabel ? "dialog" : undefined} aria-modal={dialogLabel ? true : undefined} aria-label={dialogLabel}>{children}</section>;
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

export function SyncReview({
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
        .find((s) => s.id === proposal.id && s.status === "pending")
        ?.changes.find((c) => c.id === id);
      if (x) x.accepted = !x.accepted;
    });
  const setAll = (accepted: boolean) => update((p) => {
    const current = p.documentSyncProposals.find((item) => item.id === proposal.id);
    if (current?.status === "pending") current.changes.forEach((change) => { change.accepted = accepted; });
  });
  const apply = (): string | undefined => {
    let failure: string | undefined;
    update((p) => {
      const sync = p.documentSyncProposals.find((x) => x.id === proposal.id)!;
      if (!sync || sync.status !== "pending") { failure = "This proposal is no longer pending. Open a current review before applying updates."; return; }
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
      const acceptedBlockIds: string[] = [];
      accepted.forEach((change) => {
        let section = document.sections.find(item => item.id === change.targetSectionId);
        if (!section) section = document.sections.find(item => /requirements/i.test(item.title));
        if (!section) {
          section = { id: uid("SEC"), title: change.sectionTitle || "Requirements", content: "", linkedIds: [], comments: [], blocks: [] };
          document.sections.push(section);
        }
        const existing = change.targetBlockId ? findSyncBlock(document, change.artifactId)?.block : undefined;
        if (existing) {
          existing.content = change.after;
          acceptedBlockIds.push(existing.id);
        } else {
          const block: DocumentBlock = {
            id: uid("BLK"),
            type: change.artifactId.startsWith("US")
              ? "stories-table"
              : "requirements-table",
            content: change.after,
            linkedIds: [change.artifactId],
            syncArtifactId: change.artifactId,
          };
          section.blocks.push(block);
          acceptedBlockIds.push(block.id);
        }
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
        acceptedBlockIds,
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
        <div className="sync-selection-controls">
          <span>{proposal.changes.filter(change => change.accepted).length} of {proposal.changes.length} selected. Review each update before applying.</span>
          <button type="button" disabled={proposal.status !== "pending" || proposal.changes.every(change => change.accepted)} onClick={() => setAll(true)}>Select all updates</button>
          <button type="button" disabled={proposal.status !== "pending" || !proposal.changes.some(change => change.accepted)} onClick={() => setAll(false)}>Clear selection</button>
        </div>
        <div className="sync-changes">
          {proposal.changes.map((change) => (
            <label
              key={change.id}
              className={change.accepted ? "selected" : ""}
            >
              <input
                type="checkbox"
                aria-label={`Select update for ${change.artifactId} in ${change.sectionTitle}`}
                checked={change.accepted}
                disabled={proposal.status !== "pending"}
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
                    {change.action === "add" ? "No dedicated synchronized block. Existing document content may already cover this item; check for duplication." : change.before || "Empty synchronized block"}
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
  detail = "Linked records are cleaned up to keep the workspace consistent.",
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  detail?: string;
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
            <small>{detail}</small>
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
  const location = useLocation();
  const [tab, setTab] = useState<"requirements" | "stories">("requirements");
  const [selected, setSelected] = useState<string | undefined>(
    project.requirements[0]?.id ?? project.stories[0]?.id,
  );
  const [query, setQuery] = useState("");
  const [missingArtifact, setMissingArtifact] = useState<string>();
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("artifact");
    setMissingArtifact(undefined);
    if (!id) return;
    if (project.requirements.some(item => item.id === id)) { setTab("requirements"); setSelected(id); setQuery(""); }
    else if (project.stories.some(item => item.id === id)) { setTab("stories"); setSelected(id); setQuery(""); }
    else { setSelected(undefined); setMissingArtifact(id); }
  }, [location.search, project.id]);
  const [checked, setChecked] = useState<string[]>([]);
  const [syncMode, setSyncMode] = useState<
    "new-srs" | "update-srs" | "addendum"
  >("update-srs");
  const [syncTargetId, setSyncTargetId] = useState<string>(() => project.documents.find(document => document.status === "draft" && document.template === "Software Requirements Specification")?.id ?? "");
  const [syncTargetSectionId, setSyncTargetSectionId] = useState<string>("");
  const [review, setReview] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selectedArtifacts = [...project.requirements, ...project.stories].filter(item => checked.includes(item.id));
  const eligibleCount = eligibleForDocumentSync(project, checked).length;
  const selectedDrafts = selectedArtifacts.filter(item => item.status === "draft").length;
  const selectedReviews = selectedArtifacts.filter(item => item.status === "in-review").length;
  const items = tab === "requirements" ? project.requirements : project.stories;
  const searchText = normalizeSearchText(query).trim().toLocaleLowerCase();
  const visible = items.filter((item) => {
    const details = "title" in item
      ? [item.title, item.statement, item.rationale, item.businessValue, ...(item.businessRules ?? []), ...(item.fitCriteria ?? [])]
      : [item.role, item.goal, item.value, item.epic, item.feature, ...(item.criteria ?? [])];
    return normalizeSearchText([item.id, item.owner, ...details].join(" ")).toLocaleLowerCase().includes(searchText);
  });
  const hiddenSelected = selectedArtifacts.filter(item => !visible.some(entry => entry.id === item.id)).length;
  const changeSelectedStatus = (from: "draft" | "in-review", to: "draft" | "in-review") => {
    const ids = new Set(checked);
    update(p => {
      const targets = [...p.requirements, ...p.stories].filter(item => ids.has(item.id) && item.status === from);
      targets.forEach(item => {
        item.status = to;
        item.rejectionReason = undefined;
        addAudit(p, "Changed artifact workflow status", item.id, `Status changed to ${to}; content revision remains ${item.version}. Bulk selection; approval remains a separate review.`);
      });
    });
  };
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
    const target = syncMode === "update-srs" ? project.documents.find(document => document.id === syncTargetId && document.status === "draft") : undefined;
    if (syncMode === "update-srs" && !target) {
      notify("Choose a draft document to update, or create a new SRS instead.", "warning", "Draft target required");
      return;
    }
    const targetSection = target?.sections.find(section => section.id === syncTargetSectionId) ?? target?.sections.find(section => /requirements/i.test(section.title)) ?? target?.sections[0];
    const proposalId = uid("DSP");
    update((p) => {
      p.documentSyncProposals.unshift({
        id: proposalId,
        targetDocumentId: target?.id,
        targetDocumentRevision: target?.version,
        mode: syncMode,
        status: "pending",
        createdAt: "Just now",
        changes: eligible.map((item) => {
          const existing = findSyncBlock(target, item.id);
          return ({
          id: uid("DSC"),
          artifactId: item.id,
          action: existing ? "update" : "add",
          sectionTitle: existing?.section.title ?? targetSection?.title ?? (item.id.startsWith("US") ? "User stories" : "Requirements"),
          targetSectionId: existing?.section.id ?? targetSection?.id,
          targetBlockId: existing?.block.id,
          before: existing?.block.content ?? "",
          after: srsContent(project, item.id),
          accepted: true,
          provenance: syncProvenance(project, item.id),
          sourceRevision: item.version,
        }); }),
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
  };
  const setStatus = (status: "draft" | "in-review" | "approved") => {
    if (!selected) return;
    if (status === "approved") {
      const artifact = [...project.requirements, ...project.stories].find(item => item.id === selected);
      const issues = approvalIssuesForArtifact(project, selected, artifact?.goalId);
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
      {missingArtifact && <p role="status" className="context-note warning">{missingArtifact} is no longer available in this project. Choose another item from the list.</p>}
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
          {eligibleCount > 0 && (
            <>
              <select aria-label="Synchronization mode" className="compact-select" value={syncMode} onChange={(e) => setSyncMode(e.target.value as typeof syncMode)}>
                <option value="update-srs">Update existing SRS</option>
                <option value="new-srs">Create new SRS</option>
                <option value="addendum">Create addendum</option>
              </select>
              {syncMode === "update-srs" && <select aria-label="Synchronization target document" className="compact-select" value={syncTargetId} onChange={(e) => { setSyncTargetId(e.target.value); setSyncTargetSectionId(""); }}>
                <option value="">Choose a draft document…</option>
                {project.documents.filter(document => document.status === "draft").map(document => <option key={document.id} value={document.id}>{document.name} · v{document.version}</option>)}
              </select>}
              {syncMode === "update-srs" && syncTargetId && <select aria-label="Synchronization target section" className="compact-select" value={syncTargetSectionId} onChange={(e) => setSyncTargetSectionId(e.target.value)}>
                <option value="">Requirements section (recommended)</option>
                {project.documents.find(document => document.id === syncTargetId)?.sections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}
              </select>}
            </>
          )}
          <Button disabled={!activeRef} onClick={() => activeRef && onAsk(activeRef)}>
            <Sparkles size={16} /> Ask about open item
          </Button>
          <Button
            primary
            disabled={!eligibleCount}
            onClick={createSync}
          >
            <FilePlus2 size={16} /> Create/update SRS{" "}
            {checked.length ? `(${eligibleCount} approved)` : ""}
          </Button>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Artifact type" onKeyDown={onTabListKeyDown}>
        <button
          role="tab"
          aria-selected={tab === "requirements"}
          tabIndex={tab === "requirements" ? 0 : -1}
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
          tabIndex={tab === "stories" ? 0 : -1}
          className={tab === "stories" ? "active" : ""}
          onClick={() => {
            setTab("stories");
            setSelected(project.stories[0]?.id);
          }}
        >
          User stories <span>{project.stories.length}</span>
        </button>
      </div>
      {checked.length > 0 && <section className="artifact-bulk-toolbar" aria-label="Selected artifact actions">
        <div><strong>{selectedArtifacts.length} selected</strong><small>{selectedDrafts} draft · {selectedReviews} in review · {selectedArtifacts.filter(item => item.status === "approved").length} approved{hiddenSelected ? ` · ${hiddenSelected} outside this view` : ""}</small></div>
        <div><Button disabled={!selectedDrafts} onClick={() => changeSelectedStatus("draft", "in-review")}>Submit drafts ({selectedDrafts})</Button><Button disabled={!selectedReviews} onClick={() => changeSelectedStatus("in-review", "draft")}>Return reviews to draft ({selectedReviews})</Button><Button onClick={() => setChecked([])}>Clear selection</Button></div>
        <small>Actions include selected items across both tabs and searches. Approval requires individual review.</small>
      </section>}
      <div className="connected-artifact-layout">
        <Panel className="connected-backlog">
          <div className="list-search">
            <Search size={17} />
            <input
              aria-label={`Search ${tab}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${tab} and their content…`}
            />
          </div>
          <div className="backlog-filter">
            <span>{visible.length} shown · {checked.length} selected</span>
            <div className="backlog-selection-actions">
            <button aria-label="Select all visible" disabled={!visible.length} onClick={() => setChecked(current => [...new Set([...current, ...visible.map(item => item.id)])])}>Select all</button>
            <button
              aria-label="Select approved visible"
              disabled={!visible.some(item => item.status === "approved")}
              onClick={() =>
                setChecked(current => [...new Set([...current, ...visible.filter(x => x.status === "approved").map(x => x.id)])])
              }
            >
              Approved
            </button>
            <button aria-label="Deselect visible" disabled={!visible.some(item => checked.includes(item.id))} onClick={() => setChecked(current => current.filter(id => !visible.some(item => item.id === id)))}>Deselect shown</button>
            <button aria-label="Clear selection" disabled={!checked.length} onClick={() => setChecked([])}>Clear</button>
            </div>
          </div>
          <p className="backlog-selection-hint">Search includes item content and owner. Select all applies to shown items. Only approved items can update an SRS.</p>
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
              <button onClick={() => { setSelected(item.id); setMissingArtifact(undefined); }}>
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
          {query && activeRef && !visible.some(item => item.id === activeRef.id) && <div className="artifact-filter-notice" role="status">
            <span>The open item is outside the current search. Select a result to open it, or clear the search.</span>
            <button type="button" onClick={() => setQuery("")}>Clear search</button>
          </div>}
          {req && tab === "requirements" ? (
            <>
              <EditorHeader
                id={req.id}
                status={req.status}
                version={req.version}
                sync={req.syncStatus}
                approvalIssues={approvalIssuesForArtifact(project, req.id, req.goalId)}
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
                    {[...new Set([...req.sourceIds, ...project.traceLinks.filter(link => link.to === req.id && (link.from === "PROJECT-BRIEF" || project.sources.some(source => source.id === link.from) || project.clarifications.some(question => question.id === link.from))).map(link => link.from)])].map((x) => (
                      <Pill key={x}>{x}</Pill>
                    ))}
                  </div>
                  <small>Review link status in Evidence links.</small>
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
                approvalIssues={approvalIssuesForArtifact(project, story.id, story.goalId)}
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
                    {storyNarrative(story)}
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
                <div className="connected-field wide">
                  <span id="story-criteria-label">Acceptance criteria</span>
                  <div className="criteria-editor" role="group" aria-labelledby="story-criteria-label">
                    {story.criteria.map((c, i) => (
                      <div className="criterion-row" key={i}>
                        <span>{i + 1}</span>
                        <textarea
                          aria-label={`Acceptance criterion ${i + 1}`}
                          value={c}
                          onChange={(e) => {
                            const next = [...story.criteria];
                            next[i] = e.target.value;
                            saveStory({ criteria: next });
                          }}
                        />
                        <button
                          type="button"
                          aria-label={`Remove acceptance criterion ${i + 1}`}
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
                      </div>
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
                </div>
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
                    {[...new Set([...story.requirementIds, ...project.traceLinks.filter(link => link.to === story.id && project.requirements.some(requirement => requirement.id === link.from)).map(link => link.from)])].map((x) => (
                      <Pill key={x}>{x}</Pill>
                    ))}
                  </div>
                  <small>Review link status in Evidence links.</small>
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
  approvalIssues,
  onStatus,
  onReject,
  onConversation,
  onDelete,
}: {
  id: string;
  status: string;
  version: number;
  sync: SyncStatus;
  approvalIssues: string[];
  onStatus: (s: "draft" | "in-review" | "approved") => void;
  onReject: () => void;
  onConversation: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="editor-review-header">
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
    {status === "in-review" && approvalIssues.length > 0 && <details className="artifact-approval-checks"><summary>Approval needs {approvalIssues.length} {approvalIssues.length === 1 ? "check" : "checks"}</summary><ul>{approvalIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
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
  const [, setDraftRevision] = useState(0);
  const [picker, setPicker] = useState(false);
  const [contextQuery, setContextQuery] = useState("");
  const contextPickerRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(contextPickerRef, () => setPicker(false), picker);
  const requestState = useChatRequest(`${project.id}:${selected ?? ""}`);
  const { sending } = requestState;
  const [requestError, setRequestError] = useState("");
  const [retryText, setRetryText] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState<string>();
  const [answerAuthority, setAnswerAuthority] = useState("");
  const [answerConfirmed, setAnswerConfirmed] = useState(false);
  const [checkingProposal, setCheckingProposal] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const followThread = useRef(true);
  const proposalCheckInFlight = useRef(false);
  const latestProject = useRef(project);
  latestProject.current = project;
  const answerDialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(answerDialogRef, () => setPendingAnswer(undefined), Boolean(pendingAnswer));
  const convo = project.conversations.find((c) => c.id === selected);
  const conversationGoal = project.goals.find(goal => goal.conversationId === convo?.id);
  const modelProject = conversationProjectContext(project, convo?.id);
  const answersOnly = Boolean(conversationGoal && (conversationGoal.id !== project.activeGoalId || conversationGoal.status !== "Active"));
  const draft = selected ? conversationDrafts.get(conversationDraftKey(project.id, selected)) ?? "" : "";
  const setDraft = (value: string) => { if (selected) { const key = conversationDraftKey(project.id, selected); if (value) conversationDrafts.set(key, value); else conversationDrafts.delete(key); setDraftRevision(current => current + 1); } };
  const visibleConversations = project.conversations.filter((conversation) =>
    conversation.title.toLowerCase().includes(conversationQuery.toLowerCase()),
  );
  const refs = projectReferences(project);
  const referenceUrl = (ref: ArtifactReference) => {
    const route = ref.route ?? artifactRoute(ref.type);
    const supportsSelection = ["sources", "artifacts", "diagrams", "documents", "changes", "governance"].includes(route);
    return `/projects/${project.id}/${route}${supportsSelection ? `?artifact=${encodeURIComponent(ref.id)}` : ""}`;
  };
  useEffect(() => {
    setRequestError(""); setRetryText(""); setPicker(false);
    followThread.current = true;
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [selected]);
  useEffect(() => {
    const thread = threadRef.current;
    if (thread && followThread.current) thread.scrollTop = thread.scrollHeight;
  }, [convo?.messages.length]);
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
    conversationDrafts.delete(conversationDraftKey(project.id, deletedId));
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
    const pending = requestState.begin();
    if (!pending) return;
    const checkedSources = sourceCheckFingerprint(modelProject);
    const checkedContext = modelContextFingerprint(projectEvidence(modelProject, used));
    const checkedConversation = JSON.stringify([convo.context, convo.messages]);
    const unavailable = used.filter(item => item.id !== 'PROJECT-BRIEF' && !refs.some(current => current.id === item.id));
    if (unavailable.length) { requestState.finish(pending); setRequestError(`Attached context is no longer available: ${unavailable.map(item => item.id).join(', ')}. Remove it or attach a current project item before sending.`); return; }
    const sourceProblems = modelSourceProblems(modelProject, used);
    if (sourceProblems.length) { requestState.finish(pending); const reason = `Review and select current revisions in Sources before using these sources: ${sourceProblems.join(', ')}.`; setRequestError(reason); notify(reason, "warning"); return; }
    setRequestError("");
    setRetryText("");
    try { await verifyGoalSourceOriginals(modelProject, used); }
    catch (error) { if (requestState.isCurrent(pending)) { requestState.finish(pending); const reason = error instanceof Error ? error.message : "The selected sources could not be checked."; setRequestError(reason); notify(reason, "warning"); } return; }
    if (!requestState.isCurrent(pending)) return;
    const current = latestProject.current;
    const currentConversation = current.conversations.find(item => item.id === convo.id);
    if (current.id !== project.id || current.activeGoalId !== project.activeGoalId || current.cloudAllowed !== project.cloudAllowed ||
      sourceCheckFingerprint(conversationProjectContext(current, convo.id)) !== checkedSources || modelContextFingerprint(projectEvidence(conversationProjectContext(current, convo.id), used)) !== checkedContext ||
      !currentConversation || JSON.stringify([currentConversation.context, currentConversation.messages]) !== checkedConversation) {
      requestState.finish(pending);
      setRequestError("The project or conversation changed while sources were being checked. Review the current context and send your message again.");
      notify("The project or conversation changed while sources were being checked. Review the current context and send your message again.", "warning", "Message not sent");
      return;
    }
    const request = buildModelRequest({
      project: modelProject,
      references: used,
      prompt,
      task: answersOnly ? "project-conversation" : "conversation-action",
      history: convo.messages.map(m => ({ role: m.role, content: m.text })),
    });
    request.signal = pending.controller.signal;
    pending.requestId = request.requestId;
    setRetryText(prompt);
    const sentDraftKey = conversationDraftKey(project.id, convo.id);
    if (conversationDrafts.get(sentDraftKey) === draft) { conversationDrafts.delete(sentDraftKey); setDraftRevision(current => current + 1); }
    update((p) => {
      const c = p.conversations.find((x) => x.id === convo.id);
      if (!c) return;
      c.messages.push({ id: uid("M"), role: "user", text: prompt, references: used });
      c.updated = "Just now";
    });
    try {
      const response = await requestModelCompletion(request);
      if (!requestState.isCurrent(pending)) return;
      setRetryText("");
    window.dispatchEvent(
      new CustomEvent("ba-mate-research-event", {
        detail: { type: "assistant-request", successful: true },
      }),
    );

      update((p) => {
        const c = p.conversations.find((x) => x.id === convo.id);
        if (!c) return;
        const action = answersOnly ? undefined : response.actionProposal;
        const contextCurrent = !answersOnly && p.activeGoalId === request.goalId && JSON.stringify(projectEvidence(conversationProjectContext(p, convo.id), used)) === JSON.stringify(request.context);
        const validRequirement = action?.action_kind === "requirement-revision" && p.requirements.some(item => item.id === action.target_id && item.statement === action.before);
        const proposal = contextCurrent && action && action.action_kind !== "none" && (action.action_kind !== "requirement-revision" || validRequirement)
          ? { id: uid("PROP"), kind: action.action_kind, target: action.target_id || "Project",
              goalId: request.goalId, contextFingerprint: modelContextFingerprint(request.context), contextReferences: used,
              before: action.before, after: action.after, status: "pending" as const,
              references: used.filter(ref => action.reference_ids.includes(ref.id)),
              impact: [action.rationale] }
          : undefined;
        c.messages.push({
          id: uid("M"),
          role: "assistant",
          text: !contextCurrent && action && action.action_kind !== "none"
            ? `${response.text}\n\nProject context changed while this response was generated. Ask for a fresh proposal before applying changes.`
            : action?.action_kind === "requirement-revision" && !validRequirement
            ? `${response.text}\n\nThe suggested edit could not be attached because the requirement has changed or was not found. Ask for a fresh proposal.`
            : response.text,
          references: used.filter((reference) =>
            response.receipt.includedReferenceIds.includes(reference.id),
          ),
          contextReceipt: response.receipt,
          proposal,
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
      if (!requestState.isCurrent(pending)) return;
      const reason =
        error instanceof Error ? error.message : "The model provider failed.";
      setRequestError(reason);
      update((p) => {
        const c = p.conversations.find((x) => x.id === convo.id);
        if (!c) return;
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
      requestState.finish(pending);
    }
  };
  const verifyProposalSources = async (proposal: ArtifactProposal, backgroundKey?: string): Promise<boolean> => {
    if (proposalCheckInFlight.current) return false;
    proposalCheckInFlight.current = true;
    setCheckingProposal(true);
    try {
      await verifyGoalSourceOriginals(project, backgroundKey ? [] : proposal.contextReferences ?? []);
      if (proposal.kind === "source-selection" && proposal.after === "include") {
        const source = project.sources.find(item => item.id === proposal.target);
        if (!source || !goalSelectableSource(source)) throw new Error("Review the current source revision before selecting it for a goal.");
        await verifySourceOriginal(project, source);
      }
      const current = latestProject.current;
      const stillCurrent = current.id === project.id && (backgroundKey
        ? backgroundKey.startsWith(`${current.agentRun?.signature ?? ""}:`)
        : chatProposalContextCurrent(current, proposal));
      if (!stillCurrent) {
        notify("Project context changed while sources were checked. Ask for a fresh proposal.", "warning", "Proposal needs a fresh review");
        return false;
      }
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "The original sources could not be checked.", "warning", "Source review required");
      return false;
    } finally {
      proposalCheckInFlight.current = false;
      setCheckingProposal(false);
    }
  };
  const accept = async (messageId: string, status: "accepted" | "rejected") => {
    const incomingMessage = convo?.messages.find(message => message.id === messageId);
    const incoming = incomingMessage?.proposal;
    if (!incoming || incoming.status !== "pending") return;
    if (status === "accepted" && incomingMessage?.backgroundSuggestionKey &&
        !incomingMessage.backgroundSuggestionKey.startsWith(`${project.agentRun?.signature ?? ""}:`)) {
      notify("Project context changed after BA Mate asked this question. Review the latest suggestions before tracking it.", "warning", "Question needs a fresh review");
      return;
    }
    if (status === "accepted" && !incomingMessage?.backgroundSuggestionKey && !chatProposalContextCurrent(project, incoming)) {
      notify("Project evidence or the active goal changed, or this older proposal has no context snapshot. Ask for a fresh proposal.", "warning", "Proposal needs a fresh review");
      return;
    }
    if (status === "accepted" && incoming.kind === "requirement-revision" && !project.requirements.some(item => item.id === incoming.target && item.statement === incoming.before)) {
      notify("The requirement changed since BA Mate proposed this edit. Ask for a fresh proposal.", "warning", "Proposal is stale");
      return;
    }
    if (status === "accepted" && incoming.kind === "governance-revision" && (['Core responsible BA', 'Human oversight & traceability'].includes(incoming.before) || (incoming.before && !project.governancePacks.includes(incoming.before)))) {
      notify("This policy is protected or has changed. Review the policy list before applying a new proposal.", "warning", "Proposal is stale");
      return;
    }
    if (status === "accepted" && incoming.kind === "goal-direction" && !project.goals.some(goal => goal.id === incoming.target && goal.description === incoming.before)) {
      notify("The goal changed since this direction was proposed. Ask BA Mate to review the current goal.", "warning", "Proposal is stale"); return;
    }
    if (status === "accepted" && incoming.kind === "source-selection" && (!incoming.goalId || incoming.goalId !== project.activeGoalId)) {
      notify("The active goal changed since BA Mate proposed this source selection. Ask for a fresh proposal.", "warning", "Proposal is stale"); return;
    }
    if (status === "accepted" && incoming.kind === "clarification-answer") {
      const question = project.clarifications.find(item => item.id === incoming.target);
      if (!question || (question.answer ?? "") !== incoming.before) { notify("The clarification changed. Ask for a fresh proposal.", "warning", "Proposal is stale"); return; }
      setAnswerAuthority(""); setAnswerConfirmed(false); setPendingAnswer(messageId); return;
    }
    if (status === "accepted" && !await verifyProposalSources(incoming, incomingMessage?.backgroundSuggestionKey)) return;
    update((p) => {
      const c = p.conversations.find((x) => x.id === selected);
      const message = c?.messages.find((m) => m.id === messageId);
      const proposal = message?.proposal;
      if (!proposal || proposal.status !== "pending") return;
      if (status === "accepted" && (message?.backgroundSuggestionKey
          ? !message.backgroundSuggestionKey.startsWith(`${p.agentRun?.signature ?? ""}:`)
          : !chatProposalContextCurrent(p, proposal))) return;
      if (status === "accepted" && proposal.kind === "requirement-revision" && !p.requirements.some(item => item.id === proposal.target && item.statement === proposal.before)) return;
      if (status === "accepted" && proposal.kind === "goal-direction" && !p.goals.some(item => item.id === proposal.target && item.description === proposal.before)) return;
      if (status === "accepted" && proposal.kind === "governance-revision" && (['Core responsible BA', 'Human oversight & traceability'].includes(proposal.before) || (proposal.before && !p.governancePacks.includes(proposal.before)))) return;
      if (status === "accepted" && proposal.kind === "source-selection" &&
          (!proposal.goalId || proposal.goalId !== p.activeGoalId ||
            proposal.after === "include" && !p.sources.some(item => item.id === proposal.target &&
              goalSelectableSource(item) && item.sha256 === project.sources.find(original => original.id === item.id)?.sha256))) return;
      proposal.status = status;
      if (status === "accepted") {
        const req = proposal.kind === "requirement-revision" ? p.requirements.find((r) => r.id === proposal.target) : undefined;
        if (req && proposal.before === req.statement) {
          req.statement = proposal.after;
          req.status = "draft";
          req.version++;
          if (req.syncStatus === "Synced") req.syncStatus = "Out of sync";
          markDownstreamStale(p, req.id);
        }
        if (proposal.kind === "clarification-question" && proposal.after.trim()) {
          const id = uid("CQ");
          p.clarifications.push({ id, priority: "Important", question: proposal.after.trim(), rationale: proposal.impact[0] ?? "Proposed in project conversation.", sourceId: proposal.references[0]?.id ?? "PROJECT-BRIEF", sourceIds: proposal.references.length ? [...new Set(proposal.references.map(reference => reference.id))] : ["PROJECT-BRIEF"], owner: "Business analyst", status: "Unanswered", suggestions: [], affects: [], goalId: p.activeGoalId });
          addAudit(p, "Adopted chat clarification", id, proposal.after);
        }
        if (proposal.kind === "governance-revision") {
          if (proposal.before) p.governancePacks = p.governancePacks.filter(pack => pack !== proposal.before);
          if (proposal.after.trim()) p.governancePacks.push(proposal.after.trim());
          p.governancePacks = [...new Set(p.governancePacks)];
          addAudit(p, "Adopted chat governance change", "Project policies", `${proposal.before || "New policy"} → ${proposal.after || "Removed"}`);
        }
        if (proposal.kind === "goal-direction") {
          const goal = p.goals.find(item => item.id === proposal.target);
          if (goal && goal.description === proposal.before) {
            goal.description = proposal.after.trim();
            addAudit(p, "Steered goal from conversation", goal.id, proposal.after);
          }
        }
        if (proposal.kind === "source-selection") {
          const goal = p.goals.find(item => item.id === proposal.goalId && item.id === p.activeGoalId);
          if (goal && (proposal.after !== "include" || p.sources.some(item => item.id === proposal.target && goalSelectableSource(item) && item.sha256 === project.sources.find(original => original.id === item.id)?.sha256))) {
            const source = p.sources.find(item => item.id === proposal.target);
            goal.sourceIds = proposal.after === "include"
              ? [...new Set([...goal.sourceIds, proposal.target])]
              : goal.sourceIds.filter(id => id !== proposal.target);
            goal.sourceRevisionPins ??= {};
            if (proposal.after === "include" && source?.sha256) goal.sourceRevisionPins[source.id] = source.sha256;
            else delete goal.sourceRevisionPins[proposal.target];
            const goalConversation = p.conversations.find(entry => entry.id === goal.conversationId);
            if (goalConversation && source) goalConversation.context = proposal.after === "include"
              ? [...goalConversation.context.filter(entry => entry.id !== source.id), { id: source.id, type: "Source", label: source.name, origin: "attached", removable: true, route: "sources" }]
              : goalConversation.context.filter(entry => entry.id !== source.id);
            addAudit(p, "Updated goal source selection", goal.id, `${proposal.target}: ${proposal.after}`);
          }
        }
        addAudit(
          p,
          "Accepted connected BA Mate proposal",
          proposal.target,
          `Applied ${proposal.kind} as a working change; review dependent items before approval.`,
        );
      } else {
        if (message?.backgroundSuggestionKey)
          p.dismissedAgentSuggestions = [...new Set([...(p.dismissedAgentSuggestions ?? []), message.backgroundSuggestionKey])];
        addAudit(
          p,
          "Rejected connected BA Mate proposal",
          proposal.target,
          "Proposal retained without changing project artifacts.",
        );
      }
    });

  };
  const filtered = refs
    .filter((x) =>
      (x.id + " " + x.label + " " + x.type)
        .toLowerCase()
        .includes(contextQuery.toLowerCase()),
    )
    .slice(0, 10);
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Typed project context</span>
          <h1>Ask BA Mate</h1>
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
        <label className="conversation-mobile-picker">Conversation<select aria-label="Choose conversation" value={selected ?? ""} onChange={event => setSelected(event.target.value)}>{project.conversations.map(conversation => <option key={conversation.id} value={conversation.id}>{conversation.title}</option>)}{!project.conversations.length && <option value="">No conversations yet</option>}</select></label>
        <Panel className="conversation-list">
          <div className="list-search">
            <Search size={17} />
            <input
              aria-label="Search conversations"
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
                            onNavigate(referenceUrl(x))
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
                <>
                <div className="picker-modal-scrim" aria-hidden="true" onClick={() => setPicker(false)} />
                <div
                  className="context-picker"
                  ref={contextPickerRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Add project context"
                >
                  <header className="context-picker-heading"><strong>Add project context</strong><button type="button" aria-label="Close context picker" onClick={() => setPicker(false)}><X size={16} /></button></header>
                  <div className="list-search">
                    <Search size={16} />
                    <input
                      autoFocus
                      aria-label="Search project context"
                      value={contextQuery}
                      onChange={(e) => setContextQuery(e.target.value)}
                      placeholder="Search sources, artifacts, diagrams and documents"
                    />
                  </div>
                  {filtered.map((ref) => (
                    <button
                      key={`${ref.type}-${ref.id}`}
                      disabled={convo.context.some((item) => item.id === ref.id)}
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
                      {convo.context.some((item) => item.id === ref.id) ? <small>Attached</small> : <Plus />}
                    </button>
                  ))}
                  {!filtered.length && (
                    <p className="picker-empty">No matching project context.</p>
                  )}
                </div>
                </>
              )}
              <div className="chat-thread" ref={threadRef} role="region" aria-label="Conversation messages" tabIndex={0} onScroll={(event) => {
                const thread = event.currentTarget;
                followThread.current = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
              }}>
                {convo.messages.map((m) => (
                  <div className={`chat-message ${m.role}`} key={m.id}>
                    <i>
                      {m.role === "assistant" ? <Sparkles size={17} /> : "BA"}
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
                                onNavigate(referenceUrl(x))
                              }
                            >
                              {x.id}
                              {x.version ? ` v${x.version}` : ""}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {m.contextReceipt && (
                        <div className="context-receipt" title={m.contextReceipt.countingMethod ?? m.contextReceipt.requestId}>
                          <Code2 size={13} />
                          <span>
                            Estimated input {m.contextReceipt.estimatedTokens}/
                            {m.contextReceipt.tokenBudget} tokens · {m.contextReceipt.includedReferenceIds.length} included
                            {!!m.contextReceipt.partialReferenceIds?.length && ` · ${m.contextReceipt.partialReferenceIds.length} partial`}
                            {!!m.contextReceipt.historyMessagesOmitted && ` · ${m.contextReceipt.historyMessagesOmitted} earlier messages omitted`}
                            {m.contextReceipt.omittedReferenceIds.length
                              ? ` · ${m.contextReceipt.omittedReferenceIds.length} omitted`
                              : ""}
                          </span>
                        </div>
                      )}
                      {m.contextReceipt && <ChatContextDisclosure receipt={m.contextReceipt} />}
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
                              {m.proposal.before || "No previous content"}
                            </span>
                            <ChevronRight />
                            <span>
                              <small>After</small>
                              {m.proposal.after || "No proposed content"}
                            </span>
                          </div>
                          <p>Impact: {m.proposal.impact.join(", ")}</p>
                          {m.proposal.status === "pending" && (
                            <footer>
                              <Button onClick={() => void accept(m.id, "rejected")}>
                                Reject
                              </Button>
                              <Button
                                primary
                                disabled={checkingProposal || (m.backgroundSuggestionKey ? !m.backgroundSuggestionKey.startsWith(`${project.agentRun?.signature ?? ""}:`) : !chatProposalContextCurrent(project, m.proposal))}
                                onClick={() => void accept(m.id, "accepted")}
                              >
                                {(m.backgroundSuggestionKey ? !m.backgroundSuggestionKey.startsWith(`${project.agentRun?.signature ?? ""}:`) : !chatProposalContextCurrent(project, m.proposal)) ? "Ask for a fresh proposal" : m.proposal.kind === "clarification-question" ? "Track question" : "Accept reviewed change"}
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
                <div className="chat-processing-note"><span>{project.cloudAllowed ? "External AI permitted for non-confidential context" : "External AI off · local models available"}</span><button onClick={() => onNavigate(`/projects/${project.id}/team`)}>Project AI settings</button></div>
                {conversationGoal && <p className="chat-goal-note">Context: {conversationGoal.title} · {conversationGoal.status}{answersOnly ? ". Answers only; use an active goal to request artifact changes." : ""}</p>}
                {requestError && <div className="chat-request-error" role="alert"><strong>{requestError}</strong><div>{retryText && <Button disabled={Boolean(draft)} onClick={() => { setDraft(retryText); setRequestError(""); }}>Use previous message</Button>}<Button onClick={() => onNavigate("/settings")}>Model settings</Button></div>{draft && <small>Your newer draft is kept. Send or clear it before restoring the previous message.</small>}</div>}
                <MentionTextarea value={draft} onChange={setDraft} references={refs} onAttach={ref => attach(ref, "mentioned")} onSend={() => void send()} />
                {draft && <small role="status">Unsent message stays available while BA Mate is open. It is not included in backups and will be lost on reload or close.</small>}
                <div>
                  <span>
                    <ShieldCheck size={14} /> {sending ? "BA Mate is thinking…" : evaluation ? "Use Task AI during evaluation" : "Enter to send · Shift+Enter for a new line"}
                  </span>
                  {sending && <Button onClick={() => { requestState.stop(); setRequestError("Request stopped. You can edit and resend your previous message."); }}>Stop</Button>}
                  <Button primary disabled={!draft.trim() || sending || Boolean(evaluation)} onClick={send}>
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
      {pendingAnswer && convo && <div className="connected-modal-backdrop" role="presentation"><div ref={answerDialogRef} className="sync-modal connected-confirm-modal" role="dialog" aria-modal="true" aria-label="Confirm clarification answer"><header><div><span className="eyebrow">Human confirmation</span><h2>Record this clarification answer?</h2><p>BA Mate proposed how to record your message. Confirm the responsible person and the exact answer before it becomes a recorded decision.</p></div><button className="icon-button" aria-label="Close" onClick={() => setPendingAnswer(undefined)}><X /></button></header><div className="project-settings-fields" style={{ padding: 18 }}><p>{convo.messages.find(message => message.id === pendingAnswer)?.proposal?.after}</p><label className="editor-field"><span>Who confirmed this answer?</span><input value={answerAuthority} onChange={event => setAnswerAuthority(event.target.value)} placeholder="Stakeholder name or role" /></label><label className="setup-remote-choice"><input type="checkbox" checked={answerConfirmed} onChange={event => setAnswerConfirmed(event.target.checked)} /> I verified this answer with the responsible person</label></div><footer><Button onClick={() => setPendingAnswer(undefined)}>Cancel</Button><Button primary disabled={!answerAuthority.trim() || !answerConfirmed || checkingProposal} onClick={async () => { const messageId = pendingAnswer; const currentProposal = convo.messages.find(message => message.id === messageId)?.proposal; if (!currentProposal || !chatProposalContextCurrent(project, currentProposal)) { setPendingAnswer(undefined); notify("Project context changed. Ask for a fresh proposal before recording this answer.", "warning", "Proposal needs a fresh review"); return; } if (!await verifyProposalSources(currentProposal)) return; update(p => { const c = p.conversations.find(item => item.id === convo.id); const proposal = c?.messages.find(message => message.id === messageId)?.proposal; if (!proposal || proposal.status !== "pending") return; if (!chatProposalContextCurrent(p, proposal)) return; const question = p.clarifications.find(item => item.id === proposal.target); if (!question || (question.answer ?? "") !== proposal.before) return; question.answer = proposal.after.trim(); question.answerAuthority = answerAuthority.trim(); question.status = "Answered"; proposal.status = "accepted"; addAudit(p, "Recorded stakeholder clarification", question.id, `Confirmed by ${answerAuthority.trim()}: ${question.answer}`); }); setPendingAnswer(undefined); }}>{checkingProposal ? "Checking sources…" : "Record confirmed answer"}</Button></footer></div></div>}
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
  const location = useLocation();
  const [selected, setSelected] = useState<string | undefined>(
    project.diagrams[0]?.id,
  );
  const [missingArtifact, setMissingArtifact] = useState<string>();
  useEffect(() => { const id = new URLSearchParams(location.search).get("artifact"); setMissingArtifact(undefined); if (id) { const found = project.diagrams.some(item => item.id === id); setSelected(found ? id : undefined); if (!found) setMissingArtifact(id); } }, [location.search, project.id]);
  const diagram = project.diagrams.find((d) => d.id === selected);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  type DiagramDraft = { source: string; baseSource: string; baseVersion: number };
  const draftKey = `ba-mate-diagram-drafts:${project.id}`;
  const readDrafts = (): Record<string, DiagramDraft> => {
    try {
      const value = JSON.parse(sessionStorage.getItem(draftKey) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([, item]) => item && typeof item === "object" && typeof (item as DiagramDraft).source === "string" && typeof (item as DiagramDraft).baseSource === "string" && Number.isInteger((item as DiagramDraft).baseVersion))) as Record<string, DiagramDraft> : {};
    } catch { return {}; }
  };
  const [source, setEditorSource] = useState(diagram?.source ?? "");
  const draftSources = useRef<Record<string, DiagramDraft>>(readDrafts());
  const [draftStorageError, setDraftStorageError] = useState(false);
  const [, refreshDrafts] = useState(0);
  const persistDrafts = () => {
    try { sessionStorage.setItem(draftKey, JSON.stringify(draftSources.current)); setDraftStorageError(false); }
    catch { setDraftStorageError(true); }
    refreshDrafts(value => value + 1);
  };
  const setSource = (value: string | ((current: string) => string)) => {
    setEditorSource(current => {
      const next = typeof value === "function" ? value(current) : value;
      if (selected && diagram) {
        const previous = draftSources.current[selected];
        // Keep an unsaved edit's original base even if the saved diagram changes
        // while this editor is open. Rebase only after the edit was saved or the
        // analyst explicitly chooses to apply it to the new version.
        const unchangedBase = previous && (previous.baseVersion === diagram.version && previous.baseSource === diagram.source || previous.source !== diagram.source);
        draftSources.current[selected] = { source: next, baseSource: unchangedBase ? previous.baseSource : diagram.source, baseVersion: unchangedBase ? previous.baseVersion : diagram.version };
      }
      return next;
    });
  };
  const [svg, setSvg] = useState("");
  const [rendered, setRendered] = useState<{ id: string | undefined; source: string }>();
  const [lastValid, setLastValid] = useState<{ id: string | undefined; svg: string }>();
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(100);
  const [focusMode, setFocusMode] = useState(false);
  const focusModeRef = useRef<HTMLElement>(null);
  useDialogAccessibility(focusModeRef, () => setFocusMode(false), focusMode);
  const [proposal, setProposal] = useState<{
    before: string;
    after: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [confirmDiscardEdit, setConfirmDiscardEdit] = useState(false);
  const [embedTarget, setEmbedTarget] = useState("");
  const [embedSection, setEmbedSection] = useState("__new_section__");
  const embedDialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(embedDialogRef, () => setEmbedOpen(false), embedOpen);
  const previewRef = useRef<HTMLDivElement>(null);
  const proposalRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(proposalRef, () => setProposal(null), Boolean(proposal));
  useEffect(() => { draftSources.current = readDrafts(); }, [project.id]);
  useEffect(() => {
    const draft = selected ? draftSources.current[selected] : undefined;
    setEditorSource(draft && diagram && draft.baseVersion === diagram.version && draft.baseSource === diagram.source ? draft.source : diagram?.source ?? "");
  }, [selected, project.id]);
  useEffect(() => { if (selected && draftSources.current[selected]?.source === source) persistDrafts(); }, [source, selected]);
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
          setLastValid({ id: selected, svg: result.svg });
          setRendered({ id: selected, source });
          setError("");
        }
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message.split("\n")[0]
              : "Diagram syntax could not be parsed.",
          );
          setSvg(lastValid && lastValid.id === selected ? lastValid.svg : "");
          setRendered(undefined);
        }
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [source, selected]);
  const unsaved = !!diagram && source !== diagram.source;
  const activeDraft = diagram ? draftSources.current[diagram.id] : undefined;
  const staleEdit = !!(diagram && unsaved && (!activeDraft || activeDraft.baseVersion !== diagram.version || activeDraft.baseSource !== diagram.source));
  const previewCurrent = !!diagram && rendered?.id === diagram.id && rendered.source === source && !!svg && !error;
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
    if (!diagram || !unsaved || staleEdit || !previewCurrent) return;
    const expectedVersion = diagram.version, expectedSource = diagram.source;
    update((p) => {
      const d = p.diagrams.find((x) => x.id === diagram.id);
      if (!d || d.version !== expectedVersion || d.source !== expectedSource) return;
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
    if (!diagram || !previewCurrent || unsaved) return;
    try {
      const png = await svgToPng(await renderedDiagram(diagram.source, diagram.id));
      downloadBlob(png.blob, `${diagram.id}-v${diagram.version}.png`);
      notify("The PNG download has started.", "success", "Diagram exported");
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "The diagram could not be rasterized as PNG.", "danger", "Export failed");
    }
  };
  const eligibleDocuments = project.documents.filter(doc => doc.status === "draft" && (!doc.goalId || doc.goalId === project.activeGoalId));
  const openEmbed = () => {
    if (!diagram) return;
    if (source !== diagram.source) { notify("Save the diagram before adding it to a document.", "warning", "Save diagram first"); return; }
    setEmbedTarget(eligibleDocuments[0]?.id ?? "__new__");
    setEmbedSection("__new_section__");
    setEmbedOpen(true);
  };
  const embed = () => {
    if (!diagram) return;
    const checkedDiagram = { id: diagram.id, version: diagram.version, source: diagram.source };
    const checkedDoc = eligibleDocuments.find(item => item.id === embedTarget);
    const checkedGoal = project.activeGoalId;
    let settled = false;
    update((p) => {
      const finish = (message: string, success: boolean) => queueMicrotask(() => {
        if (settled) return;
        settled = true;
        if (success) setEmbedOpen(false);
        notify(message, success ? "success" : "warning", success ? "Diagram added to document" : "Review the diagram and document");
      });
      const current = p.diagrams.find(item => item.id === checkedDiagram.id);
      if (!current || current.version !== checkedDiagram.version || current.source !== checkedDiagram.source || p.activeGoalId !== checkedGoal) {
        finish("The diagram or active goal changed. Review the current versions and try again.", false); return;
      }
      let doc = embedTarget === "__new__" ? undefined : p.documents.find(item => item.id === embedTarget);
      if (embedTarget !== "__new__" && (!doc || !checkedDoc || doc.version !== checkedDoc.version || doc.status !== "draft" || (doc.goalId && doc.goalId !== p.activeGoalId))) {
        finish("The chosen working document changed or is no longer a draft. Choose a current draft and try again.", false); return;
      }
      if (doc?.sections.some(section => section.blocks.some(block => block.embedding?.diagramId === current.id))) {
        finish("This diagram is already embedded in the selected document.", false); return;
      }
      if (!doc) {
        doc = { id: uid("DOC"), name: `${p.name} visual models`, template: "Software Requirements Specification", status: "draft", version: 1, receipts: [], comments: [], goalId: p.activeGoalId, sections: [] };
        p.documents.push(doc);
        linkDeliverableToActiveGoal(p, doc.id);
      }
      let section = embedSection === "__new_section__" ? undefined : doc.sections.find(item => item.id === embedSection);
      if (embedSection !== "__new_section__" && !section) { finish("The selected section no longer exists. Choose a current section and try again.", false); return; }
      if (!section) { section = { id: uid("SEC"), title: "Solution and process models", content: "Linked visual models", linkedIds: [], comments: [], blocks: [] }; doc.sections.push(section); }
      section.blocks.push({ id: uid("BLK"), type: "diagram", content: current.name, linkedIds: [current.id], embedding: { diagramId: current.id, version: current.version, insertedAt: "Just now", stale: false } });
      section.linkedIds = [...new Set([...section.linkedIds, current.id])];
      doc.version++;
      addAudit(p, "Inserted version-pinned diagram", doc.id, `${current.id} v${current.version} inserted into ${doc.name}; diagram review status: ${current.approvalStatus}.`);
      finish(`${current.id} v${current.version} was added to ${doc.name}. ${current.approvalStatus === "Approved" ? "" : "The diagram remains a draft until reviewed."}`.trim(), true);
    });
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
    delete draftSources.current[deletedId];
    persistDrafts();
    setConfirmDelete(false);
    notify(
      `${deletedId} and its linked document blocks were removed.`,
      "success",
      "Diagram deleted",
    );
  };
  return (
    <>
      {missingArtifact && <p role="status" className="context-note warning">{missingArtifact} is no longer available in this project. Choose another diagram from the list.</p>}
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
          <Button onClick={save} disabled={!diagram || !unsaved || !previewCurrent || staleEdit}>
            <Save size={16} /> Save version
          </Button>
          <Button
            primary
            disabled={!diagram || unsaved || !previewCurrent}
            onClick={() => {
              if (!diagram) return;
              const issues = approvalIssuesForArtifact(project, diagram.id, diagram.goalId);
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
                  `Diagram v${d.version} approved under the current workspace approval policy.`,
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
              onClick={() => { setSelected(d.id); setMissingArtifact(undefined); }}
            >
              <GitBranch />
              <span>
                <b>{d.name}</b>
                <small>
                  {d.type} · v{d.version}
                  {draftSources.current[d.id] && draftSources.current[d.id].source !== d.source ? " · Unsaved edit" : ""}
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
            elementRef={focusModeRef}
            dialogLabel={focusMode ? "Diagram focus view" : undefined}
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
                <Pill>{unsaved ? `Saved version: ${diagram.approvalStatus}` : diagram.approvalStatus}</Pill>
                {error ? (
                  <Pill tone="danger">Syntax issue</Pill>
                ) : previewCurrent ? (
                  <Pill tone="success">Valid Mermaid</Pill>
                ) : <Pill>Preparing preview</Pill>}
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
                  {focusMode ? <><Minimize2 /> Exit focus</> : <Maximize2 />}
                </button>
                <button disabled={unsaved} onClick={exportSource}>Mermaid</button>
                <button disabled={unsaved || !previewCurrent} onClick={exportSvg}>SVG</button>
                <button disabled={unsaved || !previewCurrent} onClick={exportPng}>PNG</button>
                <button
                  disabled={unsaved || !previewCurrent}
                  onClick={() =>
                    void generateDiagramPdf(diagram)
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
                  onClick={openEmbed}
                >
                  <FilePlus2 /> Add to document
                </button>
              </div>
            </div>
            <p className="context-note" role="status">{unsaved ? "Save a valid diagram version before approval or export. A temporary recovery copy is kept in this browser tab when available." : !previewCurrent ? "Preparing the current diagram preview before approval or image export." : "Image exports show the diagram; use the PDF or project record to retain its review status."}</p>
            {staleEdit && <div className="context-note warning" role="alert"><p>The saved diagram changed while this edit was open. Compare the current saved source with your edit before choosing whether to use your edit against the new version.</p><details><summary>Show current saved source</summary><pre>{diagram.source}</pre></details><button onClick={() => { draftSources.current[diagram.id] = { source, baseSource: diagram.source, baseVersion: diagram.version }; persistDrafts(); }}>Use edit against current version</button></div>}
            {unsaved && <button onClick={() => setConfirmDiscardEdit(true)}>Discard unsaved edit</button>}
            {draftStorageError && <p role="alert" className="context-note warning">The temporary recovery copy could not be stored in this browser tab. Save before leaving Diagram studio.</p>}
            {diagram && draftSources.current[diagram.id] && draftSources.current[diagram.id].source !== diagram.source && (draftSources.current[diagram.id].baseVersion !== diagram.version || draftSources.current[diagram.id].baseSource !== diagram.source) && !unsaved && <div className="context-note warning"><p>A recovered unsaved edit was based on a different saved version. Review it before restoring; it will not overwrite the current version until you save.</p><pre>{draftSources.current[diagram.id].source}</pre><button onClick={() => setSource(draftSources.current[diagram.id].source)}>Restore edit to editor</button><button onClick={() => { delete draftSources.current[diagram.id]; persistDrafts(); }}>Discard recovered edit</button></div>}
            {error && (
              <div className="diagram-error">
                <Code2 />
                <span>
                  <b>Mermaid validation issue</b>
                  <small>
                    {error}. {lastValid?.id === selected ? "The last valid preview remains visible." : "No valid preview is available for this diagram."}
                  </small>
                </span>
              </div>
            )}
            <div className="hybrid-editor">
              <div className="mermaid-preview" ref={previewRef} role="region" aria-label="Diagram preview" tabIndex={0}>
                <div
                  className="diagram-preview-scale"
                  style={{ transform: `scale(${zoom / 100})` }}
                  dangerouslySetInnerHTML={{ __html: (rendered && rendered.id === selected && rendered.source === source) || (error && lastValid?.id === selected) ? svg : "" }}
                />
              </div>
              <aside className="node-inspector" aria-label="Structured node editor" tabIndex={0}>
                <h3>Structured node editor</h3>
                <p>
                  Edit common flowchart node labels while source stays
                  synchronized.
                </p>
                {diagram.linkedIds.length > 0 && <div className="diagram-reference-summary"><strong>Linked to this diagram</strong><div className="reference-row">{diagram.linkedIds.map(id => <Pill key={id}>{id}</Pill>)}</div><small>These links apply to the diagram as a whole.</small></div>}
                {nodes.map((node) => (
                  <label key={node.id}>
                    <span>{node.id}</span>
                    <input
                      aria-label={`Label for node ${node.id}`}
                      value={node.label}
                      onChange={(e) => renameNode(node.id, e.target.value)}
                    />
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
              <button type="button" className="button secondary" aria-expanded={commentsOpen} aria-controls="diagram-comments" onClick={() => setCommentsOpen(open => !open)}>
                <MessageSquareText /> Comments ({diagram.comments.length})
              </button>
              <Button className="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </Button>
              <span>
                {diagram.versions.length} retained versions ·{" "}
                {diagram.linkedIds.length} artifact links
              </span>
            </div>
            {commentsOpen && <section id="diagram-comments" className="document-comments" aria-label="Diagram comments">
              <h2>Diagram comments</h2>
              <p>Review notes for this diagram. Adding a comment does not approve or change its content.</p>
              {diagram.comments.length ? <ul>{diagram.comments.map(comment => <li key={comment.id}>
                <div><strong>{comment.author}</strong><small>{comment.at} · {comment.resolved ? "Resolved" : "Open"}</small></div>
                <p>{comment.text}</p>
                <button type="button" className="button secondary" onClick={() => update(p => {
                  const item = p.diagrams.find(d => d.id === diagram.id)?.comments.find(c => c.id === comment.id);
                  if (!item) return;
                  item.resolved = !item.resolved;
                  addAudit(p, item.resolved ? "Resolved diagram comment" : "Reopened diagram comment", diagram.id, `Comment ${item.id} marked ${item.resolved ? "resolved" : "open"}.`);
                })}>{comment.resolved ? "Reopen" : "Mark resolved"}</button>
              </li>)}</ul> : <p>No comments yet.</p>}
              <label>New comment<textarea value={commentDrafts[diagram.id] ?? ""} onChange={event => { const value = event.target.value; setCommentDrafts(current => ({ ...current, [diagram.id]: value })); }} placeholder="Describe a question or review note" /></label>
              <Button disabled={!(commentDrafts[diagram.id] ?? "").trim()} onClick={() => {
                const text = (commentDrafts[diagram.id] ?? "").trim();
                if (!text) return;
                update(p => {
                  const target = p.diagrams.find(d => d.id === diagram.id);
                  if (!target) return;
                  target.comments.push({ id: uid("COM"), author: "Business analyst", text, at: new Date().toISOString(), resolved: false });
                  addAudit(p, "Commented on diagram", target.id, "Diagram review comment added.");
                });
                setCommentDrafts(current => ({ ...current, [diagram.id]: "" }));
              }}>Add comment</Button>
            </section>}
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
      {embedOpen && diagram && <div className="connected-modal-backdrop" role="presentation"><div ref={embedDialogRef} className="sync-modal connected-confirm-modal" role="dialog" aria-modal="true" aria-label="Add diagram to a working document">
        <header><div><span className="eyebrow">Version-pinned diagram</span><h2>Add to a working document</h2><p>Choose a draft document. The diagram keeps its own review status and must be reviewed before an approved baseline.</p></div><button className="icon-button" aria-label="Close" onClick={() => setEmbedOpen(false)}><X /></button></header>
        <div className="project-settings-fields" style={{ padding: 18 }}><p><b>{diagram.name}</b> · v{diagram.version} · {diagram.approvalStatus}</p><label className="editor-field"><span>Working document</span><select value={embedTarget} onChange={event => { setEmbedTarget(event.target.value); setEmbedSection("__new_section__"); }}>{eligibleDocuments.map(item => <option key={item.id} value={item.id}>{item.name} · {item.id} · v{item.version}</option>)}<option value="__new__">Create a new visual models document</option></select></label>{embedTarget !== "__new__" && <label className="editor-field"><span>Document section</span><select value={embedSection} onChange={event => setEmbedSection(event.target.value)}><option value="__new_section__">Create a solution and process models section</option>{eligibleDocuments.find(item => item.id === embedTarget)?.sections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label>}</div>
        <footer><Button onClick={() => setEmbedOpen(false)}>Cancel</Button><Button primary onClick={embed}>Add diagram</Button></footer>
      </div></div>}
      {confirmDelete && diagram && (
        <ConfirmActionDialog
          title={`Delete “${diagram.name}”?`}
          description="The diagram, its trace links and any version-pinned document blocks will be removed from this local project."
          confirmLabel="Delete diagram"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={deleteDiagram}
        />
      )}
      {confirmDiscardEdit && diagram && <ConfirmActionDialog
        title="Discard unsaved diagram edit?"
        description="The temporary edit and its recovery copy will be removed. The saved diagram version will remain."
        detail="The saved diagram and its linked records will not change."
        confirmLabel="Discard edit"
        onCancel={() => setConfirmDiscardEdit(false)}
        onConfirm={() => { delete draftSources.current[diagram.id]; setEditorSource(diagram.source); persistDrafts(); setConfirmDiscardEdit(false); }}
      />}
    </>
  );
}

export const diagramPdfHeading = (diagram: Diagram) => `${diagram.name} · v${diagram.version} · ${diagram.approvalStatus}`;

async function generateDiagramPdf(diagram: Diagram) {
  const png = await svgToPng(await renderedDiagram(diagram.source, diagram.id));
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: png.height > png.width ? "portrait" : "landscape", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth(), pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40, textWidth = pageWidth - margin * 2;
  let y = 40;
  const writeLines = (text: string, size: number, lineHeight: number) => {
    pdf.setFontSize(size);
    for (const line of pdf.splitTextToSize(text, textWidth) as string[]) {
      if (y > pageHeight - margin) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y); y += lineHeight;
    }
  };
  writeLines(diagramPdfHeading(diagram), 18, 22);
  if (y > pageHeight - 270) { pdf.addPage(); y = margin; writeLines("Diagram (continued)", 12, 16); }
  y += 5;
  const ratio = Math.min(textWidth / png.width, (pageHeight - y - 70) / png.height);
  pdf.addImage(png.data, "PNG", margin, y, png.width * ratio, png.height * ratio);
  y += png.height * ratio + 18;
  writeLines(`Artifact ${diagram.id} · linked: ${diagram.linkedIds.join(", ") || "None"} · version-pinned export`, 9, 12);
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
  const location = useLocation();
  const [selected, setSelected] = useState<string | undefined>(
    project.documents[0]?.id,
  );
  const [missingArtifact, setMissingArtifact] = useState<string>();
  useEffect(() => { const id = new URLSearchParams(location.search).get("artifact"); setMissingArtifact(undefined); if (id) { const found = project.documents.find(item => item.id === id || item.sections.some(section => section.id === id)); setSelected(found?.id); if (!found) setMissingArtifact(id); } }, [location.search, project.id]);
  const [documentMode, setDocumentMode] = useState<"edit" | "review">("edit");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [exportSelection, setExportSelection] = useState<ExportSelection>({ kind: "working" });
  const document = project.documents.find((d) => d.id === selected);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("artifact");
    if (!id || !document?.sections.some(section => section.id === id)) return;
    const target = window.document.getElementById(id);
    target?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
  }, [location.search, document?.id]);
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
  const blockLinkPickerRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(blockLinkPickerRef, () => setLinkPicker(undefined), Boolean(linkPicker));
  useEffect(() => { setLinkPicker(undefined); }, [selected, documentMode]);
  const [pendingBlockDelete, setPendingBlockDelete] = useState<{
    sectionId: string;
    blockId: string;
  }>();
  const [confirmDocumentDelete, setConfirmDocumentDelete] = useState(false);
  const [diagramReview, setDiagramReview] = useState<{ documentId: string; documentVersion: number; sectionId: string; blockId: string; diagramId: string; fromVersion: number; toVersion: number; oldSource?: string; newSource: string }>();
  const diagramReviewRef = useRef<HTMLDivElement>(null);
  const [missingHistoryReviewed, setMissingHistoryReviewed] = useState(false);
  useDialogAccessibility(diagramReviewRef, () => setDiagramReview(undefined), Boolean(diagramReview));
  const runExport = async (format: string, action: () => void | Promise<void>) => {
    try {
      await action();
      notify(
        `The ${format} download has started.`,
        "success",
        "Export started",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : `The ${format} export failed.`,
        "danger",
        "Export failed",
      );
    }
  };
  const documentSearch = normalizeSearchText(query).toLowerCase();
  const visibleBlocks =
    document?.sections
      .flatMap((s) => s.blocks.map((b) => ({ section: s, block: b })))
      .filter((x) =>
        normalizeSearchText(`${x.section.title} ${x.block.content} ${x.block.linkedIds.join(" ")} ${project.diagrams.find(item => item.id === x.block.embedding?.diagramId)?.name ?? ""}`).toLowerCase().includes(documentSearch),
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
  const refreshDiagram = (sectionId: string, blockId: string) => {
    if (!document || documentMode === "review") return;
    const block = document.sections.find(item => item.id === sectionId)?.blocks.find(item => item.id === blockId);
    const diagram = project.diagrams.find(item => item.id === block?.embedding?.diagramId);
    if (!diagram || !block?.embedding) return;
    setMissingHistoryReviewed(false);
    setDiagramReview({ documentId: document.id, documentVersion: document.version, sectionId, blockId, diagramId: diagram.id, fromVersion: block.embedding.version, toVersion: diagram.version, oldSource: diagram.versions.find(item => item.version === block.embedding!.version)?.source, newSource: diagram.source });
  };
  const confirmDiagramRefresh = () => {
    if (!diagramReview || (!diagramReview.oldSource && !missingHistoryReviewed)) return;
    const checked = diagramReview;
    let settled = false;
    update(p => {
      const doc = p.documents.find(item => item.id === checked.documentId);
      const block = doc?.sections.find(item => item.id === checked.sectionId)?.blocks.find(item => item.id === checked.blockId);
      const diagram = p.diagrams.find(item => item.id === checked.diagramId);
      const current = doc && doc.version === checked.documentVersion && block?.embedding?.diagramId === checked.diagramId && block.embedding.version === checked.fromVersion && diagram && diagram.version === checked.toVersion && diagram.source === checked.newSource;
      if (current && diagram && block?.embedding && doc) {
        block.embedding.version = diagram.version; block.embedding.stale = false; block.content = diagram.name; doc.version++;
        addAudit(p, "Refreshed pinned diagram", doc.id, `${diagram.id} v${checked.fromVersion} → v${diagram.version} reviewed in document v${doc.version}.`);
      }
      queueMicrotask(() => { if (settled) return; settled = true; if (current) setDiagramReview(undefined); notify(current ? "The diagram revision was updated in the working document." : "The diagram or document changed again. Close this review and open the latest version.", current ? "success" : "warning", current ? "Diagram revision updated" : "Review needs to be refreshed"); });
    });
  };
  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous || !document || documentMode === "review") return;
    setRedoStacks((stacks) => ({ ...stacks, [document.id]: [cloneDoc(document), ...(stacks[document.id] ?? [])].slice(0, 20) }));
    setUndoStacks((stacks) => ({ ...stacks, [document.id]: (stacks[document.id] ?? []).slice(0, -1) }));
    update((p) => {
      const index = p.documents.findIndex((d) => d.id === document.id);
      if (index < 0) return;
      p.documents[index] = { ...cloneDoc(previous), comments: p.documents[index].comments };
    });
  };
  const redo = () => {
    const next = redoStack[0];
    if (!next || !document || documentMode === "review") return;
    setUndoStacks((stacks) => ({ ...stacks, [document.id]: [...(stacks[document.id] ?? []), cloneDoc(document)].slice(-20) }));
    setRedoStacks((stacks) => ({ ...stacks, [document.id]: (stacks[document.id] ?? []).slice(1) }));
    update((p) => {
      const index = p.documents.findIndex((d) => d.id === document.id);
      if (index < 0) return;
      p.documents[index] = { ...cloneDoc(next), comments: p.documents[index].comments };
    });
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (documentMode === "review" || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z")
        return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea")) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [document?.id, documentMode, undoStack, redoStack]);
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
      {missingArtifact && <p role="status" className="context-note warning">{missingArtifact} is no longer available in this project. Choose another document from the list.</p>}
      <div className="page-header document-studio-header">
        <div>
          <span className="eyebrow">Structured BA deliverables</span>
          <h1>Document studio</h1>
          <p>
            Template-led documents with governed artifact synchronization and
            version-pinned diagrams.
          </p>
        </div>
        {document && (
          <details className="document-exports">
            <summary><Download size={16} /> Export document or project</summary>
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
            <Button onClick={() => void runExport("project JSON", () => exportJson(project))}>
              <Download /> Project JSON
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
          <p className="context-note">Project JSON contains current project records regardless of the selected export revision. Each working document export has its own export ID; the document revision alone does not identify linked records.</p>
          </details>
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
            aria-label="Find within document"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find within document"
          />
          {documentSearch && <button type="button" onClick={() => setQuery("")} aria-label="Clear document search"><X size={16} /></button>}
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
              onClick={() => { setSelected(d.id); setMissingArtifact(undefined); }}
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
                  readOnly={documentMode === "review"}
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
                <div className="segmented document-mode" role="group" aria-label="Document mode">
                  <button aria-pressed={documentMode === "edit"} className={documentMode === "edit" ? "active" : ""} onClick={() => setDocumentMode("edit")}>Edit</button>
                  <button aria-pressed={documentMode === "review"} className={documentMode === "review" ? "active" : ""} onClick={() => setDocumentMode("review")}>Review</button>
                </div>
                <Button onClick={undo} disabled={documentMode === "review" || !undoStack.length}>
                  <Undo2 /> Undo
                </Button>
                <Button onClick={redo} disabled={documentMode === "review" || !redoStack.length}>
                  <Redo2 /> Redo
                </Button>
                <button type="button" className="button secondary" aria-expanded={commentsOpen} aria-controls="document-comments" onClick={() => setCommentsOpen(open => !open)}>
                  <MessageSquareText /> Comments ({document.comments.length})
                </button>
                <Button
                  disabled={document.status === "in-review"}
                  onClick={() => {
                    const expectedStatus = document.status;
                    update(p => {
                      const current = p.documents.find(item => item.id === document.id);
                      if (!current || current.status !== expectedStatus || current.status === "in-review") return;
                      const revision = current.status === "approved";
                      current.status = revision ? "draft" : "in-review";
                      addAudit(p, revision ? "Started document working revision" : "Submitted document for review", current.id, revision ? `Document v${current.version} returned to draft; earlier baselines remain locked.` : `Document v${current.version} awaits human review.`);
                    });
                  }}
                >
                  {document.status === "approved" ? "Create working revision" : document.status === "in-review" ? "In review" : "Submit for review"}
                </Button>
                {document.status === "in-review" && <Button onClick={() => update(p => {
                  const current = p.documents.find(item => item.id === document.id);
                  if (!current || current.status !== "in-review") return;
                  current.status = "draft";
                  addAudit(p, "Returned document to draft", current.id, `Document v${current.version} returned for further editing.`);
                })}>Return to draft</Button>}
                <Button
                  className="danger"
                  onClick={() => setConfirmDocumentDelete(true)}
                >
                  <Trash2 /> Delete
                </Button>
              </div>
            </div>
            {commentsOpen && <section id="document-comments" className="document-comments" aria-label="Document comments">
              <h2>Document comments</h2>
              <p>Review notes for this document. Adding a comment does not approve or change its content.</p>
              {document.comments.length ? <ul>{document.comments.map(comment => <li key={comment.id}>
                <div><strong>{comment.author}</strong><small>{comment.at} · {comment.resolved ? "Resolved" : "Open"}</small></div>
                <p>{comment.text}</p>
                <button type="button" className="button secondary" onClick={() => update(p => {
                  const item = p.documents.find(d => d.id === document.id)?.comments.find(c => c.id === comment.id);
                  if (!item) return;
                  item.resolved = !item.resolved;
                  addAudit(p, item.resolved ? "Resolved document comment" : "Reopened document comment", document.id, `Comment ${item.id} marked ${item.resolved ? "resolved" : "open"}.`);
                })}>{comment.resolved ? "Reopen" : "Mark resolved"}</button>
              </li>)}</ul> : <p>No comments yet.</p>}
              <label>New comment<textarea value={commentDrafts[document.id] ?? ""} onChange={event => { const value = event.target.value; setCommentDrafts(current => ({ ...current, [document.id]: value })); }} placeholder="Describe a question or review note" /></label>
              <Button disabled={!(commentDrafts[document.id] ?? "").trim()} onClick={() => {
                const text = (commentDrafts[document.id] ?? "").trim();
                if (!text) return;
                update(p => {
                  const target = p.documents.find(d => d.id === document.id);
                  if (!target) return;
                  target.comments.push({ id: uid("COM"), author: "Business analyst", text, at: new Date().toISOString(), resolved: false });
                  addAudit(p, "Commented on document", target.id, "Document review comment added.");
                });
                setCommentDrafts(current => ({ ...current, [document.id]: "" }));
              }}>Add comment</Button>
            </section>}
            <nav className="section-navigation">
              {document.sections.filter(s => !documentSearch || visibleBlocks.some(item => item.section.id === s.id)).map((s) => (
                <a key={s.id} href={`#${s.id}`}>
                  {s.title}
                </a>
              ))}
              <button onClick={addSection} disabled={documentMode === "review" || !!documentSearch}>
                <Plus /> Add section
              </button>
            </nav>
            <article className={`document-canvas ${documentMode === "review" ? "review-mode" : "edit-mode"}`}>
              <header>
                <span>BA MATE · CONTROLLED ARTIFACT</span>
                <h1>{document.name}</h1>
                <p>
                  {project.name} · {document.template} · Working version{" "}
                  {document.version}
                </p>
              </header>
              {documentSearch && <p role="status" className="document-search-status">{visibleBlocks.length ? `${visibleBlocks.length} matching ${visibleBlocks.length === 1 ? "block" : "blocks"}. Other content is temporarily hidden.` : "No matching content in this document. Other content is temporarily hidden."} <button type="button" onClick={() => setQuery("")}>Clear search</button></p>}
              {document.sections.filter(section => !documentSearch || visibleBlocks.some(item => item.section.id === section.id)).map((section) => (
                <section id={section.id} key={section.id} tabIndex={-1}>
                  <div className="section-heading">
                    <input
                      aria-label={`Section title: ${section.title}`}
                      readOnly={documentMode === "review"}
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
                    <span>{section.blocks.length} {section.blocks.length === 1 ? "block" : "blocks"}</span>
                  </div>
                  {section.blocks
                    .filter(
                      (block) =>
                        !documentSearch ||
                        visibleBlocks.some((x) => x.block.id === block.id),
                    )
                    .map((block) => (
                      <div
                        className={`document-block block-${block.type}`}
                        key={block.id}
                        draggable={documentMode === "edit" && !documentSearch}
                        onDragStart={() => setDragBlock(block.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => dropBlock(section.id, block.id)}
                      >
                        {documentMode === "edit" && <div className="block-toolbar">
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
                            disabled={section.blocks.findIndex(item => item.id === block.id) === 0 || !!documentSearch}
                          >
                            <ArrowUp />
                          </button>
                          <button
                            title="Move down"
                            onClick={() => move(section.id, block.id, 1)}
                            disabled={section.blocks.findIndex(item => item.id === block.id) === section.blocks.length - 1 || !!documentSearch}
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
                        </div>}
                        {block.type === "diagram" && block.embedding ? (
                          <DiagramBlock
                            block={block}
                            project={project}
                            readOnly={documentMode === "review"}
                            onRefresh={() =>
                              refreshDiagram(section.id, block.id)
                            }
                          />
                        ) : (
                          <textarea
                            aria-label={`${blockLabel[block.type]} content in ${section.title}`}
                            readOnly={documentMode === "review"}
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
                            disabled={documentMode === "review"}
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
                              <>
                              <div className="picker-modal-scrim" aria-hidden="true" onClick={() => setLinkPicker(undefined)} />
                              <div className="block-link-picker" ref={blockLinkPickerRef} role="dialog" aria-modal="true" aria-label={`Manage links in ${section.title}`}>
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
                              </>
                            )}
                        </footer>
                      </div>
                    ))}
                  {documentMode === "edit" && !documentSearch && <div className="add-block-menu">
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
                  </div>}
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
      {diagramReview && <div className="connected-modal-backdrop" role="presentation"><div ref={diagramReviewRef} className="sync-modal connected-confirm-modal diagram-review-modal" role="dialog" aria-modal="true" aria-label="Review diagram revision">
        <header><div><span className="eyebrow">Review diagram revision</span><h2>Update the diagram in this document?</h2><p>Compare the previously inserted and current diagrams. Updating the document does not approve the diagram.</p></div><button className="icon-button" aria-label="Close" onClick={() => setDiagramReview(undefined)}><X /></button></header>
        <div className="diagram-revision-compare">
          <DiagramRevisionPreview label={`Previously inserted · v${diagramReview.fromVersion}`} source={diagramReview.oldSource} />
          <DiagramRevisionPreview label={`Current working diagram · v${diagramReview.toVersion}`} source={diagramReview.newSource} />
        </div>
        {!diagramReview.oldSource && <label className="diagram-history-confirm"><input type="checkbox" checked={missingHistoryReviewed} onChange={event => setMissingHistoryReviewed(event.target.checked)} /> I reviewed the previous version using a retained baseline or diagram history.</label>}
        <footer><Button onClick={() => setDiagramReview(undefined)}>Cancel</Button><Button primary disabled={!diagramReview.oldSource && !missingHistoryReviewed} onClick={confirmDiagramRefresh}>Use current revision</Button></footer>
      </div></div>}
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

function DiagramRevisionPreview({ label, source }: { label: string; source?: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const id = useRef(uid("diagram-review"));
  useEffect(() => {
    let active = true;
    setSvg(""); setError("");
    if (!source) return () => { active = false; };
    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", fontFamily: "Inter, sans-serif" });
        const result = await mermaid.render(id.current, source);
        if (active) setSvg(result.svg);
      } catch {
        if (active) setError("The visual preview could not be rendered. Review the diagram source below or open its history before deciding.");
      }
    })();
    return () => { active = false; };
  }, [source]);
  return <section><b>{label}</b>{!source ? <p role="status">The previous source is unavailable. Review a retained baseline or diagram history before updating.</p> : <>
    {error ? <p role="status">{error}</p> : svg ? <div className="diagram-revision-preview" role="img" aria-label={`${label} visual preview`} dangerouslySetInnerHTML={{ __html: svg }} /> : <p role="status">Loading diagram preview…</p>}
    <details><summary aria-label={`View diagram source: ${label}`}>View diagram source</summary><pre>{source}</pre></details>
  </>}</section>;
}

function DiagramBlock({ block, project, readOnly, onRefresh }: { block: DocumentBlock; project: Project; readOnly: boolean; onRefresh: () => void }) {
  const diagram = project.diagrams.find(item => item.id === block.embedding?.diagramId);
  const stale = Boolean(block.embedding && diagram && (block.embedding.stale || block.embedding.version !== diagram.version));
  const [preview, setPreview] = useState("");
  const [previewError, setPreviewError] = useState("");
  const previewId = useRef(uid("document-diagram"));
  useEffect(() => {
    let active = true;
    setPreview(""); setPreviewError("");
    if (!diagram) return () => { active = false; };
    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", fontFamily: "Inter, sans-serif" });
        const rendered = await mermaid.render(previewId.current, diagram.source);
        if (active) setPreview(rendered.svg);
      } catch {
        if (active) setPreviewError("The diagram preview could not be rendered. Review its source in Diagram studio.");
      }
    })();
    return () => { active = false; };
  }, [diagram?.id, diagram?.source, diagram?.version]);
  return <div className="document-diagram-block">
    <div className={`embedded-diagram ${stale || !diagram ? "stale" : ""}`}>
      <GitBranch /><div><b>{diagram?.name ?? block.content}</b><small>{block.embedding?.diagramId} · inserted v{block.embedding?.version} · latest v{diagram?.version} · {diagram?.approvalStatus ?? "Missing"}</small></div>
      {!diagram ? <Pill tone="warning">Diagram missing</Pill> : stale ? <Button primary disabled={readOnly} onClick={onRefresh}><RefreshCw /> {readOnly ? "Switch to Edit to refresh" : "Review and refresh"}</Button> : <Pill tone={diagram.approvalStatus === "Approved" ? "success" : "warning"}><CheckCircle2 /> {diagram.approvalStatus === "Approved" ? "Current · approved" : "Current · review required"}</Pill>}
    </div>
    {stale && <p className="document-diagram-warning">The preview shows the latest diagram; the pinned document revision needs review.</p>}
    {previewError ? <p className="document-diagram-warning" role="status">{previewError}</p> : preview ? <div className="document-diagram-preview" role="img" aria-label={`${diagram?.name ?? "Diagram"}, ${diagram?.approvalStatus ?? "unknown status"}${stale ? ", latest version; document pin needs review" : ""}`} dangerouslySetInnerHTML={{ __html: preview }} /> : diagram ? <p role="status">Loading diagram preview…</p> : null}
  </div>;
}
