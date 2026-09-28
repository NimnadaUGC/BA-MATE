import { EvaluationContext } from "./EvaluationContext";
import { api, importSource } from "./api";
import { ModelSettings } from "./ModelSettings";
import { WorkflowWorkbench } from "./WorkflowWorkbench";
import { captureSnapshot, enforceWorkingVersions, approvalAllowed, baselineIssues, restoreSnapshot, revisionManifest, revisionOf } from "./store";
import {
  useEffect,
  lazy,
  useMemo,
  useRef,
  useState,
  Suspense,
  type Dispatch,
  type MouseEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Code2,
  Database,
  Download,
  Eye,
  FileCheck2,
  FileClock,
  FileDown,
  FileInput,
  FileJson,
  FilePlus2,
  FileText,
  Folder,
  FolderKanban,
  GitBranch,
  History,
  Home,
  Inbox,
  Layers3,
  LayoutDashboard,
  Link2,
  ListChecks,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Network,
  PanelRight,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  SplitSquareVertical,
  Table2,
  Tags,
  Trash2,
  Upload,
  UserCheck,
  Users,
  WandSparkles,
  X,
  XCircle,
} from "lucide-react";
import type {
  ArtifactReference,
  Clarification,
  Project,
  ProjectGoal,
  ResearchEventType,
  StageFeedback,
  Tone,
  WorkflowGate,
  WorkspaceState,
} from "./types";
import {
  addAudit,
  blockers,
  canApprove,
  downloadBlob,
  freshState,
  governanceCanDisable,
  repository,
  traceCoverage,
} from "./store";
import {
  activeEvaluationRun,
  DATASET_VERSION,
  formatDuration,
  PROMPT_VERSION,
  PROTOTYPE_VERSION,
  summarizeStageResearch,
} from "./research";
import { buildResearchUpload, queueUpload, RESEARCH_CONSENT_VERSION, RESEARCH_INSTRUMENT_VERSION, RETENTION_NOTICE, retryDelayMs, validateResearchUpload, type LocalResearchParticipation } from "./researchBoundary";
import { applyAcceptedPatches, patchIsCurrent, validateAcceptedPatches } from "./controlledChanges";
import {
  notify,
  useDialogAccessibility,
  type AppNoticeDetail,
  type NoticeTone,
} from "./ui";
const ConnectedArtifacts = lazy(() =>
  import("./connected").then((module) => ({
    default: module.ConnectedArtifacts,
  })),
);
const ConnectedConversations = lazy(() =>
  import("./connected").then((module) => ({
    default: module.ConnectedConversations,
  })),
);
const ConnectedDiagrams = lazy(() =>
  import("./connected").then((module) => ({
    default: module.ConnectedDiagrams,
  })),
);
const ConnectedDocuments = lazy(() =>
  import("./connected").then((module) => ({
    default: module.ConnectedDocuments,
  })),
);
const AssistantDrawer = lazy(() =>
  import("./AssistantDrawer").then((module) => ({
    default: module.AssistantDrawer,
  })),
);

const gates: WorkflowGate[] = [
  "Setup",
  "Discover",
  "Clarify",
  "Define",
  "Validate",
  "Approve",
];
const globalItems = [
  ["/projects", "Projects", FolderKanban],
  ["/recent", "Recent work", Clock3],
  ["/templates", "Templates", Layers3],
  ["/research", "Research console", BarChart3],
  ["/settings", "Settings", Settings],
] as const;
const projectItems = [
  ["overview", "Overview", LayoutDashboard],
  ["goals", "Goals", Boxes],
  ["workflow", "Workflow", SplitSquareVertical],
  ["conversations", "Conversations", MessageSquareText],
  ["sources", "Sources & context", Database],
  ["artifacts", "Requirements & stories", ListChecks],
  ["registers", "Registers", Table2],
  ["traceability", "Traceability", Network],
  ["diagrams", "Diagrams", GitBranch],
  ["documents", "Documents", FileText],
  ["changes", "Changes & impact", RefreshCw],
  ["governance", "Governance & checks", ShieldCheck],
  ["activity", "Activity & baselines", History],
  ["evaluation", "Stage evaluation", BarChart3],
  ["team", "Team & settings", Users],
] as const;

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const classNames = (...items: (string | false | undefined)[]) =>
  items.filter(Boolean).join(" ");
const mockNotice = (
  message: string,
  tone: NoticeTone = "info",
  title?: string,
) => notify(message, tone, title);
const activeGoal = (project: Project) =>
  project.goals.find((goal) => goal.id === project.activeGoalId) ??
  project.goals.find((goal) => goal.status === "Active");

function IconButton({
  label,
  onClick,
  children,
  className = "",
}: {
  label: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      onClick={
        onClick ??
        (() =>
          mockNotice(`${label} is represented as a safe local mock action.`))
      }
    >
      {children}
    </button>
  );
}
function Button({
  children,
  onClick,
  kind = "secondary",
  disabled = false,
  type = "button",
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      className={`button ${kind} ${className}`}
      disabled={disabled}
      onClick={
        onClick ??
        (() =>
          mockNotice(
            "This action is simulated locally in the final prototype.",
          ))
      }
    >
      {children}
    </button>
  );
}
function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function StatusBadge({ value }: { value: string }) {
  const tone: Tone =
    /approved|passed|verified|analyzed|active|complete|current|resolved/i.test(
      value,
    )
      ? "success"
      : /block|reject|broken/i.test(value)
        ? "danger"
        : /warning|review|open|pending|stale|deferred/i.test(value)
          ? "warning"
          : "neutral";
  return <Badge tone={tone}>{value}</Badge>;
}
function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
function Card({
  children,
  className = "",
  title,
  description,
  actions,
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
function Metric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: Tone;
}) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmIcon,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useDialogAccessibility(root, onCancel);
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        ref={root}
        className="modal confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <span className="eyebrow">Confirmation required</span>
            <h2>{title}</h2>
          </div>
          <IconButton label="Close confirmation" onClick={onCancel}>
            <X />
          </IconButton>
        </header>
        <div className="modal-body">
          <div className="context-note warning">
            <AlertTriangle />
            <div>
              <b>Review this irreversible local action</b>
              <p>{description}</p>
            </div>
          </div>
        </div>
        <footer>
          <Button onClick={onCancel}>Cancel</Button>
          <Button kind="danger" onClick={onConfirm}>
            {confirmIcon ?? <Trash2 size={16} />} {confirmLabel}
          </Button>
        </footer>
      </div>
    </div>
  );
}

interface NoticeItem extends AppNoticeDetail {
  id: string;
  tone: NoticeTone;
}

function ToastViewport({
  notices,
  onDismiss,
}: {
  notices: NoticeItem[];
  onDismiss: (id: string) => void;
}) {
  if (!notices.length) return null;
  return (
    <div className="toast-viewport" aria-label="Notifications">
      {notices.map((notice) => {
        const Icon =
          notice.tone === "danger"
            ? XCircle
            : notice.tone === "warning"
              ? AlertTriangle
              : notice.tone === "info"
                ? CircleHelp
                : CheckCircle2;
        return (
          <div
            className={`app-notice ${notice.tone}`}
            role={notice.tone === "danger" ? "alert" : "status"}
            key={notice.id}
          >
            <Icon size={18} />
            <span>
              {notice.title && <b>{notice.title}</b>}
              <small>{notice.message}</small>
            </span>
            <IconButton
              label="Dismiss notification"
              onClick={() => onDismiss(notice.id)}
            >
              <X size={16} />
            </IconButton>
          </div>
        );
      })}
    </div>
  );
}

function Sidebar({
  state,
  project,
  collapsed,
  mobileOpen,
  onCollapse,
  onClose,
}: {
  state: WorkspaceState;
  project?: Project;
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapse: () => void;
  onClose: () => void;
}) {
  const nav = useNavigate();
  const location = useLocation();
  const go = (path: string) => {
    nav(path);
    onClose();
  };
  return (
    <aside
      className={classNames(
        "sidebar",
        collapsed && "collapsed",
        mobileOpen && "mobile-open",
      )}
    >
      <div className="brand-row">
        <button className="brand-button" onClick={() => go("/projects")}>
          <img src="/bamate_logo.png" alt="" />
          <span>
            <b>BA Mate</b>
            <small>BA Workspace</small>
          </span>
        </button>
        <IconButton
          label="Close navigation"
          className="mobile-only"
          onClick={onClose}
        >
          <X size={20} />
        </IconButton>
      </div>
      <nav className="global-nav" aria-label="Global navigation">
        {globalItems.map(([path, label, Icon]) => (
          <button
            key={path}
            className={location.pathname === path ? "active" : ""}
            aria-current={location.pathname === path ? "page" : undefined}
            onClick={() => go(path)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-divider" />
      {project ? (
        <>
          <button className="project-switcher" onClick={() => go("/projects")}>
            <i style={{ background: project.color }}>{project.name[0]}</i>
            <span>
              <b>{project.name}</b>
              <small>{project.domain}</small>
            </span>
            <ChevronDown size={16} />
          </button>
          <div className="nav-label">Project workspace</div>
          <nav className="project-nav" aria-label="Project navigation">
            {projectItems.map(([section, label, Icon]) => {
              const path = `/projects/${project.id}/${section}`;
              return (
                <button
                  key={section}
                  className={location.pathname === path ? "active" : ""}
                  aria-current={location.pathname === path ? "page" : undefined}
                  onClick={() => go(path)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {section === "workflow" && blockers(project) > 0 && (
                    <em>{blockers(project)}</em>
                  )}
                </button>
              );
            })}
          </nav>
        </>
      ) : (
        <div className="sidebar-projects">
          <div className="nav-label">Your projects</div>
          {state.projects.map((p) => (
            <button key={p.id} onClick={() => go(`/projects/${p.id}/overview`)}>
              <i style={{ background: p.color }}>{p.name[0]}</i>
              <span>
                <b>{p.name}</b>
                <small>
                  {p.gate} · {traceCoverage(p)}% evidence coverage
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="sidebar-footer">
        <button onClick={onCollapse} aria-expanded={!collapsed}>
          <PanelRight size={18} />
          <span>{collapsed ? "Expand navigation" : "Collapse navigation"}</span>
        </button>
        <div className="profile">
          <i>BA</i>
          <span>
            <b>Local analyst</b>
            <small>Local workspace</small>
          </span>
        </div>
      </div>
    </aside>
  );
}

function AppTopbar({
  project,
  onMenu,
  onInspector,
  inspectorOpen,
}: {
  project?: Project;
  onMenu: () => void;
  onInspector: () => void;
  inspectorOpen: boolean;
}) {
  const goal = project ? activeGoal(project) : undefined;
  return (
    <div className="app-topbar">
      <IconButton
        label="Open navigation"
        className="mobile-only"
        onClick={onMenu}
      >
        <Menu size={21} />
      </IconButton>
      <div className="breadcrumbs">
        <span>BA Mate</span>
        <ChevronRight size={14} />
        {project ? (
          <>
            <span>{project.name}</span>
            {goal && (
              <>
                <ChevronRight size={14} />
                <span>{goal.title}</span>
                <Badge tone="purple">{goal.gate}</Badge>
              </>
            )}
          </>
        ) : (
          <span>Workspace</span>
        )}
      </div>
      <div className="topbar-actions">
        <span className="local-status">
          <CheckCircle2 size={15} /> Local workspace
        </span>
        {project && (
          <IconButton
            label={
              inspectorOpen
                ? "Close BA Mate inspector"
                : "Open BA Mate inspector"
            }
            className={inspectorOpen ? "active" : ""}
            onClick={onInspector}
          >
            <Sparkles size={19} />
          </IconButton>
        )}
      </div>
    </div>
  );
}

function ProjectOverview({
  project,
  go,
}: {
  project: Project;
  go: (section: string) => void;
}) {
  const coverage = traceCoverage(project);
  const openClarifications = project.clarifications.filter(
    (q) => q.status !== "Answered" && q.status !== "Discarded",
  ).length;
  const goal = activeGoal(project);
  const hasArtifacts =
    project.requirements.length +
      project.stories.length +
      project.diagrams.length +
      project.documents.length >
    0;
  return (
    <>
      <PageHeader
        eyebrow={`${project.domain} · ${project.folderName}`}
        title={project.name}
        description={project.description}
        actions={
          <>
            <Button
              onClick={() => go(goal ? "workflow" : "goals")}
              kind="primary"
            >
              <ArrowRight size={17} /> {goal ? "Continue goal" : "Start a goal"}
            </Button>
            <Button onClick={() => go("conversations")}>
              <MessageSquareText size={17} /> Ask BA Mate
            </Button>
          </>
        }
      />
      <div className="overview-grid">
        <Card className="next-action-card">
          <div className="gate-icon">
            <span>{goal ? goal.gateIndex + 1 : "—"}</span>
          </div>
          <div>
            <span className="eyebrow">
              {goal ? "Active goal" : "Project setup"}
            </span>
            <h2>{goal?.title ?? "Define the first project goal"}</h2>
            <p>
              {goal?.description ??
                "Start a BA Mate goal conversation to establish the first governed workflow. This fresh project contains no generated artifacts yet."}
            </p>
            <Button
              kind="primary"
              onClick={() => go(goal ? "workflow" : "goals")}
            >
              {goal ? `Open ${goal.gate} workflow` : "Create first goal"}{" "}
              <ArrowRight size={16} />
            </Button>
          </div>
        </Card>
        <Card
          title="Review readiness"
          description="Human review and evidence status"
        >
          <div className="metric-grid">
            <Metric
              label="Quality"
              value="Not assessed"
              detail={
                hasArtifacts ? "Requires independent BA assessment" : "No artifacts yet"
              }
              tone={hasArtifacts ? "success" : "neutral"}
            />
            <Metric
              label="Traceability"
              value={`${coverage}%`}
              detail={`${project.traceLinks.filter((l) => l.status === "Verified").length} verified links`}
              tone={
                project.traceLinks.length
                  ? coverage >= 75
                    ? "success"
                    : "warning"
                  : "neutral"
              }
            />
            <Metric
              label="Open questions"
              value={openClarifications}
              detail="Across all priorities"
              tone="warning"
            />
            <Metric
              label="Blocking"
              value={blockers(project)}
              detail="Approval gate"
              tone={blockers(project) ? "danger" : "success"}
            />
          </div>
        </Card>
      </div>
      <WorkflowStrip project={project} onSelect={() => go("workflow")} />
      <Card
        className="overview-goals-card"
        title="Project goals"
        description="One project can contain an initial delivery, later addenda and independent deliverables. Each goal keeps its own workflow state."
        actions={
          <button className="text-button" onClick={() => go("goals")}>
            Manage goals
          </button>
        }
      >
        {project.goals.length ? (
          <div className="overview-goal-list">
            {project.goals.map((item) => (
              <button
                key={item.id}
                className={item.id === goal?.id ? "active" : ""}
                onClick={() => go("goals")}
              >
                <i>
                  <Boxes size={16} />
                </i>
                <span>
                  <b>{item.title}</b>
                  <small>
                    {item.kind} · {item.gate}
                  </small>
                </span>
                <StatusBadge value={item.status} />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Boxes />}
            title="No goals yet"
            description="The first BA Mate kickoff will create the goal and its governed workflow."
            action={
              <Button onClick={() => go("goals")}>Start first goal</Button>
            }
          />
        )}
      </Card>
      <div className="three-column">
        <Card
          title="Recent changes"
          description="Append-only project activity"
          actions={
            <button className="text-button" onClick={() => go("activity")}>
              View all
            </button>
          }
        >
          <div className="activity-list">
            {project.audit.slice(0, 3).map((e) => (
              <div key={e.id}>
                <i>
                  <Activity size={15} />
                </i>
                <span>
                  <b>{e.action}</b>
                  <small>
                    {e.object} · {e.actor} · {e.at}
                  </small>
                </span>
              </div>
            ))}
            {!project.audit.length && (
              <EmptyState
                icon={<History />}
                title="No activity yet"
                description="Goal and artifact actions will appear here."
              />
            )}
          </div>
        </Card>
        <Card
          title="Sources & context"
          description={`${project.sources.filter((s) => s.approved).length} approved sources`}
          actions={
            <button className="text-button" onClick={() => go("sources")}>
              Manage
            </button>
          }
        >
          <div className="compact-list">
            {project.sources.map((s) => (
              <div key={s.id}>
                <FileText size={17} />
                <span>
                  <b>{s.name}</b>
                  <small>
                    {s.type} · {s.classification}
                  </small>
                </span>
                <StatusBadge value={s.status} />
              </div>
            ))}
            {!project.sources.length && (
              <EmptyState
                icon={<Database />}
                title="No sources yet"
                description="Add project material when it becomes available."
              />
            )}
          </div>
        </Card>
        <Card
          title="Artifacts"
          description="Current working set"
          actions={
            <button className="text-button" onClick={() => go("artifacts")}>
              Open studio
            </button>
          }
        >
          <div className="artifact-summary">
            <div>
              <ListChecks />
              <b>{project.requirements.length}</b>
              <span>Requirements</span>
            </div>
            <div>
              <UserCheck />
              <b>{project.stories.length}</b>
              <span>User stories</span>
            </div>
            <div>
              <GitBranch />
              <b>{project.diagrams.length}</b>
              <span>Diagrams</span>
            </div>
            <div>
              <FileText />
              <b>{project.documents.length}</b>
              <span>Documents</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function WorkflowStrip({
  project,
  onSelect,
}: {
  project: Project;
  onSelect: () => void;
}) {
  const goal = activeGoal(project);
  const gateIndex = goal?.gateIndex ?? project.gateIndex;
  return (
    <Card
      className="workflow-card"
      title={goal ? `${goal.title} workflow` : "Goal workflow"}
      description={
        goal
          ? `${goal.kind} · Each goal advances through its own governed gates.`
          : "Start a goal to initialize its workflow."
      }
    >
      <div className="workflow-strip">
        {gates.map((gate, index) => (
          <button
            key={gate}
            className={classNames(
              index < gateIndex && "complete",
              index === gateIndex && "current",
            )}
            onClick={onSelect}
          >
            <i>{index < gateIndex ? <Check size={15} /> : index + 1}</i>
            <span>
              <b>{gate}</b>
              <small>
                {index < gateIndex
                  ? "Complete"
                  : index === gateIndex
                    ? "In progress"
                    : "Not started"}
              </small>
            </span>
            {index < gates.length - 1 && <em />}
          </button>
        ))}
      </div>
    </Card>
  );
}

function WorkflowView({
  project,
  update,
  go,
  evaluationRunId,
  stageFeedback,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
  go: (section: string) => void;
  evaluationRunId?: string;
  stageFeedback: StageFeedback[];
}) {
  const [filter, setFilter] = useState<
    "All" | "Blocking" | "Important" | "Optional"
  >("All");
  const goal = activeGoal(project);
  const visible = project.clarifications.filter(
    (q) =>
      (!goal || !q.goalId || q.goalId === goal.id) &&
      (filter === "All" || q.priority === filter),
  );
  const updateQuestion = (id: string, patch: Partial<Clarification>) => {
    update((p) => {
      const q = p.clarifications.find((x) => x.id === id);
      if (q) {
        const candidate = { ...q, ...patch };
        if (candidate.status === "Answered" && !candidate.answer?.trim()) { notify("Enter the stakeholder answer before marking this question answered.", "warning"); return; }
        Object.assign(q, patch);
      }
      addAudit(
        p,
        "Updated clarification",
        id,
        `Status changed to ${patch.status ?? q?.status}.`,
      );
    });
    const label =
      patch.status === "Answered"
        ? "Answer recorded"
        : patch.status === "Deferred"
          ? "Clarification deferred"
          : patch.status === "Discarded"
            ? "Clarification discarded"
            : patch.status === "Unanswered"
              ? "Clarification restored"
              : "Clarification updated";
    mockNotice(`${id} was updated in the active goal.`, "success", label);
  };
  const currentGateIndex = goal?.gateIndex ?? project.gateIndex;
  const hasStageFeedback =
    !evaluationRunId ||
    stageFeedback.some(
      (entry) =>
        entry.runId === evaluationRunId &&
        entry.projectId === project.id &&
        entry.goalId === goal?.id &&
        entry.stage === (goal?.gate ?? project.gate),
    );
  const advance = () => {
    if (blockers(project, project.activeGoalId) > 0) { notify("Resolve the current blockers before advancing.", "warning"); return; }
    update((p) => {
      const target = activeGoal(p);
      if (target && target.gateIndex < 5) {
        target.gateIndex++;
        target.gate = gates[target.gateIndex];
        p.gate = target.gate;
        p.gateIndex = target.gateIndex;
        addAudit(
          p,
          "Advanced goal workflow",
          target.id,
          `${target.title} entered the ${target.gate} gate.`,
        );
      }
    });
    mockNotice("The active goal advanced to its next governed stage.", "success", "Workflow advanced");
  };
  return (
    <>
      <PageHeader
        eyebrow={goal ? `${goal.kind} · Active goal` : "No active goal"}
        title={goal?.title ?? "Start a goal"}
        description={
          goal?.description ??
          "Create or activate a goal before running the governed workflow."
        }
        actions={
          <Button
            kind="primary"
            disabled={
              !goal || blockers(project, goal.id) > 0 || currentGateIndex === 5
            }
            onClick={advance}
          >
            {`Advance to ${gates[Math.min(5, currentGateIndex + 1)]}`}{" "}
            <ArrowRight size={17} />
          </Button>
        }
      />
      <WorkflowWorkbench project={project} update={update} />
      {false && !hasStageFeedback && (
        <div className="context-note warning">
          <BarChart3 />
          <div>
            <b>Stage evaluation required for the active research run</b>
            <p>
              Submit accuracy, usefulness, usability and confidence ratings for{" "}
              {goal?.gate ?? project.gate} before advancing this goal.
            </p>
          </div>
          <Button onClick={() => go("evaluation")}>Open evaluation</Button>
        </div>
      )}
      <WorkflowStrip project={project} onSelect={() => {}} />
      <div className="workspace-split">
        <div>
          <Card
            title="Clarification queue"
            description="Accept, edit, answer, defer or discard suggestions for the active goal."
            actions={
              <div className="segmented">
                {(["All", "Blocking", "Important", "Optional"] as const).map(
                  (x) => (
                    <button
                      className={filter === x ? "active" : ""}
                      key={x}
                      onClick={() => setFilter(x)}
                    >
                      {x}
                    </button>
                  ),
                )}
              </div>
            }
          >
            <div className="question-list">
              {visible.map((q) => (
                <ClarificationCard
                  key={q.id}
                  item={q}
                  onUpdate={(patch) => updateQuestion(q.id, patch)}
                />
              ))}
            </div>
            {visible.length === 0 && (
              <EmptyState
                icon={<CircleHelp />}
                title="No clarifications yet"
                description="BA Mate will add questions as the active goal and its context are analyzed."
              />
            )}
            <Button
              onClick={() => {
                const clarificationId = uid("CQ");
                update((p) => {
                  p.clarifications.push({
                    id: clarificationId,
                    priority: "Important",
                    question: "New BA-authored clarification",
                    rationale: "Added manually for the active goal.",
                    sourceId: p.sources[0]?.id ?? "Manual",
                    owner: "Business analyst",
                    status: "Unanswered",
                    suggestions: [
                      "Confirm with stakeholder",
                      "Record as open issue",
                    ],
                    affects: [],
                    version: 1,
                    goalId: p.activeGoalId,
                  });
                  addAudit(
                    p,
                    "Created clarification",
                    clarificationId,
                    "Added a BA-authored clarification to the active goal.",
                  );
                });
                mockNotice(
                  `${clarificationId} was added to the active goal.`,
                  "success",
                  "Clarification created",
                );
              }}
            >
              <Plus size={16} /> Add clarification
            </Button>
          </Card>
        </div>
        <aside>
          <Card
            title="Goal readiness"
            description="The active goal advances independently through its workflow."
          >
            <div className="readiness">
              <div>
                <Boxes />
                <span>
                  <b>{goal?.title ?? "No active goal"}</b>
                  <small>{goal?.kind ?? "Create a goal first"}</small>
                </span>
              </div>
              <div
                className={goal && blockers(project, goal.id) ? "warning" : ""}
              >
                <AlertTriangle />
                <span>
                  <b>
                    {goal ? blockers(project, goal.id) : 0} blocking decisions
                  </b>
                  <small>Must be resolved before advancing</small>
                </span>
              </div>
              <div>
                <Link2 />
                <span>
                  <b>{goal?.sourceIds.length ?? 0} linked sources</b>
                  <small>Goal-specific context scope</small>
                </span>
              </div>
            </div>
            <Button className="full" onClick={() => go("goals")}>
              Manage project goals
            </Button>
          </Card>
        </aside>
      </div>
    </>
  );
}

function ClarificationCard({
  item,
  onUpdate,
}: {
  item: Clarification;
  onUpdate: (patch: Partial<Clarification>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(item.question);
  const [custom, setCustom] = useState(item.answer ?? "");
  return (
    <article
      className={classNames("question-card", item.priority.toLowerCase())}
    >
      <header>
        <div>
          <Badge
            tone={
              item.priority === "Blocking"
                ? "danger"
                : item.priority === "Important"
                  ? "warning"
                  : "neutral"
            }
          >
            {item.priority}
          </Badge>
          <span>{item.id}</span>
        </div>
        <StatusBadge value={item.status} />
      </header>
      {editing ? (
        <input
          className="title-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onBlur={() => {
            onUpdate({ question });
            setEditing(false);
          }}
          autoFocus
        />
      ) : (
        <h3>{item.question}</h3>
      )}
      <p>{item.rationale}</p>
      <div className="provenance">
        <Link2 size={14} /> {item.sourceId}
        <span>Owner: {item.owner}</span>
        <span>Affects: {item.affects.join(", ")}</span>
      </div>
      {item.status !== "Discarded" && (
        <div className="answer-options">
          {item.suggestions.slice(0, 2).map((s) => (
            <button
              key={s}
              className={item.answer === s ? "selected" : ""}
              onClick={() => {
                setCustom(s);
                onUpdate({ answer: s, status: "Answered" });
              }}
            >
              {s}
            </button>
          ))}
          <div>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Custom answer…"
            />
            <Button
              kind="primary"
              disabled={!custom.trim()}
              onClick={() => onUpdate({ answer: custom, status: "Answered" })}
            >
              Save answer
            </Button>
          </div>
        </div>
      )}
      <footer>
        <button onClick={() => setEditing(true)}>
          <Pencil size={15} /> Edit
        </button>
        <button onClick={() => onUpdate({ status: "Deferred" })}>
          <Clock3 size={15} /> Defer
        </button>
        <button onClick={() => onUpdate({ status: "Discarded" })}>
          <Trash2 size={15} /> Discard
        </button>
        {item.status === "Discarded" && (
          <button onClick={() => onUpdate({ status: "Unanswered" })}>
            <RotateCcw size={15} /> Restore
          </button>
        )}
      </footer>
    </article>
  );
}

function SourcesView({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(project.sources[0]?.id);
  const source = project.sources.find((s) => s.id === selected);
  const [extracting, setExtracting] = useState(false);
  const attach = async (files: FileList | null) => {
    if (!files?.length || extracting) return;
    setExtracting(true);
    try {
      for (const file of Array.from(files)) {
        const result = await importSource(file);
        const sourceId = uid("SRC");
        update(p => {
          p.sources.push({ id: sourceId, name: file.name, type: file.name.toLowerCase().endsWith(".pdf") ? "PDF" : file.name.toLowerCase().endsWith(".docx") ? "DOCX" : "TXT", status: "Needs review", classification: "Project only", provenance: "Imported on " + new Date().toISOString(), concepts: [], approved: false, immutable: true, content: result.content, originalBase64: result.original_base64, sha256: result.sha256, version: 1, passages: result.passages, extractionLimitations: result.limitations });
          addAudit(p, "Extracted source for review", sourceId, `${file.name}; original retained; excluded until BA review.`);
        });
        setSelected(sourceId);
      }
      notify("Sources extracted. Review the text and approve the sources you want to use.", "success");
    } catch (e) { notify((e as Error).message, "danger", "Source import failed"); }
    finally { setExtracting(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  const chooseFolder = async () => {
    const picker = (
      window as unknown as {
        showDirectoryPicker?: () => Promise<{ name: string }>;
      }
    ).showDirectoryPicker;
    if (!picker) {
      mockNotice(
        "Direct folder access is unavailable here. BA Mate will use its managed local workspace and ZIP export fallback.",
        "warning",
      );
      return;
    }
    try {
      const handle = await picker();
      update((p) => {
        p.folderName = handle.name;
        addAudit(
          p,
          "Connected local folder",
          handle.name,
          "Folder permission granted on this device.",
        );
      });
      mockNotice(
        `${handle.name} is now the local workspace label for this project.`,
        "success",
        "Folder connected",
      );
    } catch (error) {
      if ((error as DOMException).name !== "AbortError")
        mockNotice(
          "The folder could not be connected. The existing local workspace remains unchanged.",
          "danger",
        );
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Immutable evidence and approved context"
        title="Sources & context"
        description="Review exactly what BA Mate may retrieve. Original sources remain unchanged."
        actions={
          <>
            <input
              ref={inputRef}
              hidden
              type="file"
              aria-label="Add project source"
              accept=".pdf,.docx,.txt,image/*,.json"
              onChange={(e) => attach(e.target.files)}
            />
            <Button onClick={chooseFolder}>
              <Folder size={17} /> Connect folder
            </Button>
            <Button kind="primary" onClick={() => inputRef.current?.click()}>
              <Upload size={17} /> Add source
            </Button>
          </>
        }
      />
      {extracting && <p role="status">Reading source contents…</p>}
      <div className="source-layout">
        <Card
          title={`${project.sources.length} project sources`}
          description={`${project.sources.filter((s) => s.approved).length} approved for retrieval`}
        >
          <div className="source-table">
            {project.sources.map((s) => (
              <button
                key={s.id}
                className={s.id === selected ? "active" : ""}
                onClick={() => setSelected(s.id)}
              >
                <i>
                  <FileText size={19} />
                </i>
                <span>
                  <b>{s.name}</b>
                  <small>
                    {s.id} · {s.type} · {s.provenance}
                  </small>
                </span>
                <StatusBadge value={s.status} />
                <em>{s.approved ? "Included" : "Excluded"}</em>
              </button>
            ))}
          </div>
        </Card>
        {source && (
          <Card className="source-detail">
            <header className="detail-heading">
              <div>
                <FileCheck2 />
                <span>
                  <h2>{source.name}</h2>
                  <p>{source.id} · {source.originalBase64 ? "Original preserved" : "Demonstration metadata — attach the actual source"}</p>
                </span>
              </div>
              <label className="switch-row">
                <span>
                  <b>Use in project context</b>
                  <small>Requires BA approval</small>
                </span>
                <input
                  type="checkbox"
                  checked={source.approved && !!source.content}
                  disabled={!source.content}
                  onChange={(e) =>
                    update((p) => {
                      const item = p.sources.find((x) => x.id === source.id)!;
                      item.approved = e.target.checked;
                      item.status = e.target.checked ? "Analyzed" : "Excluded";
                      const goal = activeGoal(p);
                      if (goal) {
                        goal.sourceIds = e.target.checked
                          ? [...new Set([...goal.sourceIds, item.id])]
                          : goal.sourceIds.filter((id) => id !== item.id);
                      }
                      addAudit(
                        p,
                        e.target.checked
                          ? "Approved source context"
                          : "Excluded source context",
                        source.id,
                        source.name,
                      );
                    })
                  }
                />
              </label>
            </header>
            <dl className="detail-grid">
              <div>
                <dt>Classification</dt>
                <dd><select aria-label="Source classification" value={source.classification} onChange={e => update(p => { const item = p.sources.find(x => x.id === source.id)!; item.classification = e.target.value as typeof item.classification; if (item.classification === "Confidential") p.cloudAllowed = false; addAudit(p, "Changed source classification", item.id, item.classification); })}><option>Project only</option><option>Confidential</option><option>Public</option></select></dd>
              </div>
              <div>
                <dt>Provenance</dt>
                <dd>{source.provenance}</dd>
              </div>
              <div>
                <dt>Storage</dt>
                <dd>Local project workspace</dd>
              </div>
              <div>
                <dt>Integrity</dt>
                <dd>Immutable original</dd>
              </div>
            </dl>
            <h3>Extracted source text</h3>
            <pre className="source-transcript">{source.content ?? "No source text is stored. Import the actual file before using it as evidence."}</pre>
            {source.originalBase64 && <Button onClick={() => { const bytes = Uint8Array.from(atob(source.originalBase64!), c => c.charCodeAt(0)); downloadBlob(new Blob([bytes]), source.name); }}>Download original source</Button>}
            {source.sha256 && <small className="source-hash">SHA-256: {source.sha256}</small>}
            <h3>Source notes</h3>
            <div className="tag-list">
              {source.concepts.map((c) => (
                <span key={c}>
                  <Tags size={13} />
                  {c}
                  <Check size={13} />
                </span>
              ))}
            </div>
            <div className="context-note warning">
              <AlertTriangle />
              <div>
                <b>Human review required</b>
                <p>
                  Check the extracted text against the original file. Layout, images or text boxes may be missing. Approve only the sources suitable for this task.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

function RegistersView({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
}) {
  const types = [
    "Stakeholder",
    "Assumption",
    "Decision",
    "Risk",
    "Issue",
  ] as const;
  const [active, setActive] = useState<(typeof types)[number]>("Stakeholder");
  const [actionsFor, setActionsFor] = useState<string>();
  const [pendingDelete, setPendingDelete] = useState<string>();
  const items = project.registers.filter((i) => i.type === active);
  const addItem = () => {
    const id = uid(active.slice(0, 3).toUpperCase());
    update((p) =>
      p.registers.push({
        id,
        type: active,
        title: `New ${active.toLowerCase()}`,
        owner: "Business analyst",
        status: "open",
        version: 1,
        goalId: p.activeGoalId,
      }),
    );
    setActionsFor(id);
    mockNotice(
      `${id} was added and is ready to edit.`,
      "success",
      `${active} created`,
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="Structured project registers"
        title="Registers"
        description="Track stakeholders, assumptions, decisions, risks and issues with clear ownership."
        actions={
          <Button
            kind="primary"
            onClick={addItem}
          >
            <Plus size={17} /> Add {active.toLowerCase()}
          </Button>
        }
      />
      <div className="tabs" role="tablist" aria-label="Project registers">
        {types.map((type) => (
          <button
            role="tab"
            aria-selected={active === type}
            className={active === type ? "active" : ""}
            onClick={() => {
              setActive(type);
              setActionsFor(undefined);
            }}
            key={type}
          >
            {type}s{" "}
            <span>
              {project.registers.filter((i) => i.type === type).length}
            </span>
          </button>
        ))}
      </div>
      <Card>
        <div className="data-table">
          <div className="table-head">
            <span>ID</span>
            <span>Title</span>
            <span>Owner</span>
            <span>Impact</span>
            <span>Status</span>
            <span />
          </div>
          {items.map((item) => (
            <div className="table-row" key={item.id}>
              <b>{item.id}</b>
              <input
                aria-label={`${item.id} title`}
                value={item.title}
                onChange={(e) =>
                  update((p) => {
                    const x = p.registers.find((r) => r.id === item.id)!;
                    x.title = e.target.value;
                  })
                }
              />
              <span>{item.owner}</span>
              <span>
                {item.severity ? (
                  <Badge
                    tone={
                      item.severity === "High"
                        ? "danger"
                        : item.severity === "Medium"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {item.severity}
                  </Badge>
                ) : (
                  "—"
                )}
              </span>
              <StatusBadge value={item.status} />
              <IconButton
                label={`Actions for ${item.id}`}
                onClick={() =>
                  setActionsFor((current) =>
                    current === item.id ? undefined : item.id,
                  )
                }
              >
                <ChevronDown size={17} />
              </IconButton>
              {actionsFor === item.id && (
                <div
                  className="register-row-actions"
                  role="group"
                  aria-label={`Actions for ${item.id}`}
                >
                  <label>
                    <span>Status</span>
                    <select
                      value={item.status}
                      onChange={(event) =>
                        update((p) => {
                          p.registers.find(
                            (register) => register.id === item.id,
                          )!.status = event.target.value as typeof item.status;
                          addAudit(
                            p,
                            "Updated register status",
                            item.id,
                            `Status changed to ${event.target.value}.`,
                          );
                        })
                      }
                    >
                      {[
                        "draft",
                        "open",
                        "in-review",
                        "approved",
                        "rejected",
                        "resolved",
                      ].map((status) => (
                        <option key={status} value={status}>
                          {status.replace("-", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Owner</span>
                    <input
                      value={item.owner}
                      onChange={(event) =>
                        update((p) => {
                          p.registers.find(
                            (register) => register.id === item.id,
                          )!.owner = event.target.value;
                        })
                      }
                    />
                  </label>
                  {item.severity && (
                    <label>
                      <span>Impact</span>
                      <select
                        value={item.severity}
                        onChange={(event) =>
                          update((p) => {
                            p.registers.find(
                              (register) => register.id === item.id,
                            )!.severity = event.target
                              .value as typeof item.severity;
                          })
                        }
                      >
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                      </select>
                    </label>
                  )}
                  <Button
                    kind="danger"
                    onClick={() => setPendingDelete(item.id)}
                  >
                    <Trash2 size={15} /> Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
        {!items.length && (
          <EmptyState
            icon={<Inbox />}
            title={`No ${active.toLowerCase()} items`}
            description={`Add the first ${active.toLowerCase()} to this project register.`}
          />
        )}
      </Card>
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete}?`}
          description="This register item will be removed from the current local project. Other register entries and artifacts will remain unchanged."
          confirmLabel="Delete register item"
          onCancel={() => setPendingDelete(undefined)}
          onConfirm={() => {
            update((p) => {
              p.registers = p.registers.filter(
                (item) => item.id !== pendingDelete,
              );
              addAudit(
                p,
                "Deleted register item",
                pendingDelete,
                "The register entry was removed from the local working project.",
              );
            });
            setActionsFor(undefined);
            setPendingDelete(undefined);
            mockNotice("The register item was deleted.", "success");
          }}
        />
      )}
    </>
  );
}

function TraceabilityView({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
}) {
  const [selectedLink, setSelectedLink] = useState<string | undefined>(project.traceLinks[0]?.id);
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string>();
  const objectIds = [
    ...project.sources.map((item) => item.id),
    ...project.requirements.map((item) => item.id),
    ...project.stories.map((item) => item.id),
    ...project.diagrams.map((item) => item.id),
    ...project.documents.map((item) => item.id),
    ...project.checks.map((item) => item.id),
  ];
  const [draftFrom, setDraftFrom] = useState(objectIds[0] ?? "");
  const [draftTo, setDraftTo] = useState(objectIds[1] ?? "");
  const [draftRelation, setDraftRelation] = useState("supports");
  const inspectedLink = project.traceLinks.find(
    (link) => link.id === selectedLink,
  );
  const exportMatrix = () => {
    downloadBlob(
      new Blob(
        [
          JSON.stringify(
            {
              project: { id: project.id, name: project.name },
              coverage: traceCoverage(project),
              links: project.traceLinks,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      `${project.id}-traceability-matrix.json`,
    );
    mockNotice(
      "The traceability matrix download has started.",
      "success",
      "Matrix exported",
    );
  };
  const addLink = () => {
    if (!draftFrom || !draftTo || draftFrom === draftTo) return;
    const id = uid("TL");
    update((p) => {
      p.traceLinks.push({
        id,
        from: draftFrom,
        to: draftTo,
        fromRevision: revisionOf(p, draftFrom),
        toRevision: revisionOf(p, draftTo),
        relation: draftRelation,
        status: "Pending",
        goalId: p.activeGoalId,
      });
      addAudit(
        p,
        "Created traceability link",
        id,
        `${draftFrom} ${draftRelation} ${draftTo}.`,
      );
    });
    setSelectedLink(id);
    setAdding(false);
    mockNotice(
      `${id} was created as a pending relationship.`,
      "success",
      "Trace link created",
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="Source-to-decision evidence"
        title="Traceability"
        description="Follow every approved artifact back to sources, clarifications, checks and decisions."
        actions={
          <>
            <Button onClick={exportMatrix}>
              <Download size={17} /> Export matrix
            </Button>
            <Button kind="primary" onClick={() => setAdding(!adding)}>
              <Plus size={17} /> Add link
            </Button>
          </>
        }
      />
      {adding && (
        <Card
          className="trace-link-editor"
          title="Add traceability relationship"
          description="New links begin as Pending until they are reviewed."
        >
          <label>
            <span>From</span>
            <select value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)}>
              {objectIds.map((id) => <option key={`from-${id}`}>{id}</option>)}
            </select>
          </label>
          <label>
            <span>Relationship</span>
            <input value={draftRelation} onChange={(e) => setDraftRelation(e.target.value)} />
          </label>
          <label>
            <span>To</span>
            <select value={draftTo} onChange={(e) => setDraftTo(e.target.value)}>
              {objectIds.map((id) => <option key={`to-${id}`}>{id}</option>)}
            </select>
          </label>
          <div>
            <Button onClick={() => setAdding(false)}>Cancel</Button>
            <Button
              kind="primary"
              disabled={!draftFrom || !draftTo || draftFrom === draftTo || !draftRelation.trim()}
              onClick={addLink}
            >
              <Link2 size={16} /> Create pending link
            </Button>
          </div>
        </Card>
      )}
      <div className="metric-row">
        <Metric
          label="Coverage"
          value={`${traceCoverage(project)}%`}
          detail="Verified project links"
          tone="success"
        />
        <Metric
          label="Verified"
          value={
            project.traceLinks.filter((l) => l.status === "Verified").length
          }
          detail="Healthy links"
          tone="success"
        />
        <Metric
          label="Pending"
          value={
            project.traceLinks.filter((l) => l.status === "Pending").length
          }
          detail="Needs review"
          tone="warning"
        />
        <Metric
          label="Broken"
          value={project.traceLinks.filter((l) => l.status === "Broken").length}
          detail="Must repair"
          tone="danger"
        />
      </div>
      <Card
        title="Traceability matrix"
        description="Select a relationship to inspect provenance and history."
      >
        <div className="trace-table">
          <div className="table-head">
            <span>From</span>
            <span>Relationship</span>
            <span>To</span>
            <span>Status</span>
          </div>
          {project.traceLinks.map((link) => (
            <button
              key={link.id}
              className={selectedLink === link.id ? "active" : ""}
              aria-pressed={selectedLink === link.id}
              onClick={() => setSelectedLink(link.id)}
            >
              <b>{link.from}</b>
              <span>
                <ArrowRight size={14} />
                {link.relation}
              </span>
              <b>{link.to}</b>
              <StatusBadge value={link.status} />
            </button>
          ))}
        </div>
        {inspectedLink && (
          <div className="trace-inspector">
            <Network />
            <div>
              <b>
                {inspectedLink.id} · {inspectedLink.from}{" "}
                {inspectedLink.relation} {inspectedLink.to}
              </b>
              <p>
                This relationship is {inspectedLink.status.toLowerCase()} and
                retained in the project traceability export and change-impact
                analysis.
              </p>
            </div>
            <StatusBadge value={inspectedLink.status} />
            <label>
              <span>Review status</span>
              <select
                value={inspectedLink.status}
                onChange={(event) =>
                  update((p) => {
                    const link = p.traceLinks.find(
                      (item) => item.id === inspectedLink.id,
                    );
                    if (link) {
                      link.status = event.target.value as typeof link.status;
                      if (link.status === "Verified") {
                        link.fromRevision = revisionOf(p, link.from);
                        link.toRevision = revisionOf(p, link.to);
                      }
                    }
                  })
                }
              >
                <option>Pending</option>
                <option>Verified</option>
                <option>Broken</option>
              </select>
            </label>
            <Button kind="danger" onClick={() => setPendingDelete(inspectedLink.id)}>
              <Trash2 size={15} /> Delete
            </Button>
          </div>
        )}
        {!project.traceLinks.length && (
          <EmptyState
            icon={<Network />}
            title="No traceability links yet"
            description="Create the first source-to-artifact relationship to begin measuring coverage."
          />
        )}
      </Card>
      <Card
        title="Dependency map"
        description="A compact view of downstream change relationships"
      >
        <div className="dependency-map">
          <span className="source-node">
            SRC-01<small>Source</small>
          </span>
          <i>→</i>
          <span>
            FR-01<small>Requirement</small>
          </span>
          <i>→</i>
          <span>
            US-01<small>User story</small>
          </span>
          <i>→</i>
          <span>
            DGM-01<small>Diagram</small>
          </span>
          <b className="branch-line">↘</b>
          <span className="document-node">
            DOC-01<small>SRS</small>
          </span>
        </div>
      </Card>
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete}?`}
          description="This relationship will be removed from traceability coverage and change-impact analysis."
          confirmLabel="Delete trace link"
          onCancel={() => setPendingDelete(undefined)}
          onConfirm={() => {
            update((p) => {
              p.traceLinks = p.traceLinks.filter((link) => link.id !== pendingDelete);
              addAudit(p, "Deleted traceability link", pendingDelete, "Removed the relationship from the working traceability matrix.");
            });
            setSelectedLink(project.traceLinks.find((link) => link.id !== pendingDelete)?.id);
            setPendingDelete(undefined);
            mockNotice("The traceability relationship was deleted.", "success");
          }}
        />
      )}
    </>
  );
}

function ChangesView({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
}) {
  const [selectedChange, setSelectedChange] = useState<string | undefined>(project.changes[0]?.id);
  const [editing, setEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string>();
  const impactOptions = [
    ...project.requirements.map((item) => ({ id: item.id, type: "Requirement" as const })),
    ...project.stories.map((item) => ({ id: item.id, type: "User story" as const })),
    ...project.diagrams.map((item) => ({ id: item.id, type: "Diagram" as const })),
    ...project.documents.map((item) => ({ id: item.id, type: "Document" as const })),
  ];
  const [impactCandidate, setImpactCandidate] = useState(impactOptions[0]?.id ?? "");
  const impactRuns = (project.aiRuns ?? []).filter(run => run.metadata.task === "impact" && run.status === "accepted");
  const [impactRunId, setImpactRunId] = useState(impactRuns[0]?.id ?? "");
  const change =
    project.changes.find((item) => item.id === selectedChange) ??
    project.changes[0];
  const createPatch = (p: Project, artifactId: string, artifactType: "Requirement" | "User story" | "Diagram" | "Document") => {
    const requirement = p.requirements.find(item => item.id === artifactId);
    if (requirement) return { id: uid("CP"), artifactId, artifactType, field: "statement" as const, before: requirement.statement, after: requirement.statement, sourceRevision: requirement.version, selected: true, status: "Proposed" as const };
    const story = p.stories.find(item => item.id === artifactId);
    if (story) return { id: uid("CP"), artifactId, artifactType, field: "criteria" as const, before: story.criteria.join("\n"), after: story.criteria.join("\n"), sourceRevision: story.version, selected: true, status: "Proposed" as const };
    const diagram = p.diagrams.find(item => item.id === artifactId);
    if (diagram) return { id: uid("CP"), artifactId, artifactType, field: "source" as const, before: diagram.source, after: diagram.source, sourceRevision: diagram.version, selected: true, status: "Proposed" as const };
    const document = p.documents.find(item => item.id === artifactId);
    const block = document?.sections.flatMap(section => section.blocks).find(Boolean);
    return document && block ? { id: uid("CP"), artifactId, artifactType, targetId: block.id, field: "content" as const, before: block.content, after: block.content, sourceRevision: document.version, selected: true, status: "Proposed" as const } : undefined;
  };
  const apply = () => {
    if (!change) return;
    let failure: string | undefined;
    update((p) => {
      const cr = p.changes.find((c) => c.id === change.id)!;
      if (cr.status !== "Approved") { failure = "Review and accept the selected concrete patches before implementation."; return; }
      if (!cr.baselineId || !p.versions.some(version => version.id === cr.baselineId && version.locked && version.type === "Baseline")) { failure = "Select an existing approved baseline before implementing a change."; return; }
      failure = validateAcceptedPatches(p, cr);
      if (failure) return;
      applyAcceptedPatches(p, cr);
      cr.status = "Implemented";
      cr.implementedAt = new Date().toISOString();
      p.gate = "Validate";
      p.gateIndex = 4;
      const goal = activeGoal(p);
      if (goal) {
        goal.gate = "Validate";
        goal.gateIndex = 4;
      }
      addAudit(
        p,
        "Applied change request",
        cr.id,
        "Accepted content patches were applied atomically as working revisions; revalidation is required before a new baseline.",
      );
    });
    if (failure) { mockNotice(failure, "warning", "Change not implemented"); return; }
    mockNotice(
      `${change.id} created new working versions and returned the workflow to Validate.`,
      "success",
      "Change request applied",
    );
  };
  const addImpact = () => {
    if (!change || !impactCandidate) return;
    const option = impactOptions.find((item) => item.id === impactCandidate);
    if (!option || change.impacts.some((item) => item.id === option.id)) return;
    update((p) => {
      const target = p.changes.find((item) => item.id === change.id)!;
      target.impacts.push({
        id: option.id,
        type: option.type,
        reason: "Manually added for impact review",
        selected: true,
      });
      target.status = "Impact review";
      const patch = createPatch(p, option.id, option.type);
      if (patch) (target.patches ??= []).push(patch);
    });
    mockNotice(
      `${option.id} was added to the impact review.`,
      "success",
      "Affected artifact added",
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="Controlled maintenance loop"
        title="Changes & impact"
        description="Review downstream consequences before modifying an approved or linked artifact."
        actions={
          <Button
            kind="primary"
            onClick={() => {
              const id = uid("CR");
              update((p) =>
                p.changes.unshift({
                  id,
                  title: "Untitled change request",
                  rationale: "Describe the business reason.",
                  source: "BA-authored",
                  status: "Proposed",
                  impacts: [],
                  patches: [],
                  baselineId: p.versions.find(version => version.type === "Baseline")?.id,
                  goalId: p.activeGoalId,
                }),
              );
              setSelectedChange(id);
              setEditing(true);
              mockNotice(
                `${id} was created and is ready for impact analysis.`,
                "success",
                "Change request created",
              );
            }}
          >
            <Plus size={17} /> New change request
          </Button>
        }
      />
      {change ? (
        <div className="change-layout">
          <Card>
            <header className="change-title">
              <div>
                <Badge tone="purple">{change.id}</Badge>
                <StatusBadge value={change.status} />
                {editing ? (
                  <div className="change-edit-fields">
                    <input
                      aria-label="Change request title"
                      value={change.title}
                      onChange={(event) =>
                        update((p) => {
                          p.changes.find((item) => item.id === change.id)!.title =
                            event.target.value;
                        })
                      }
                    />
                    <textarea
                      aria-label="Change request rationale"
                      value={change.rationale}
                      onChange={(event) =>
                        update((p) => {
                          p.changes.find(
                            (item) => item.id === change.id,
                          )!.rationale = event.target.value;
                        })
                      }
                    />
                    <input
                      aria-label="Change request source"
                      value={change.source}
                      onChange={(event) =>
                        update((p) => {
                          p.changes.find(
                            (item) => item.id === change.id,
                          )!.source = event.target.value;
                        })
                      }
                    />
                  </div>
                ) : (
                  <>
                    <h2>{change.title}</h2>
                    <p>{change.rationale}</p>
                    <small>Source: {change.source}</small>
                  </>
                )}
              </div>
              <div className="change-title-actions">
                <Button
                  onClick={() => {
                    if (editing) {
                      update((p) =>
                        addAudit(
                          p,
                          "Updated change request",
                          change.id,
                          "Title, rationale and source were reviewed.",
                        ),
                      );
                      mockNotice(
                        `${change.id} details were saved.`,
                        "success",
                        "Change request updated",
                      );
                    }
                    setEditing(!editing);
                  }}
                >
                  {editing ? <Check size={16} /> : <Pencil size={16} />}
                  {editing ? "Save request" : "Edit request"}
                </Button>
                <Button kind="danger" onClick={() => setPendingDelete(change.id)}>
                  <Trash2 size={16} /> Delete
                </Button>
              </div>
            </header>
            <div className="impact-banner">
              <Network size={20} />
              <div>
                <b>{change.impacts.length} linked artifacts may be affected</b>
                <p>
                  Select the working updates to create. Approved baselines
                  remain locked.
                </p>
                <small>{change.baselineId ? `Source baseline: ${change.baselineId}` : "No approved baseline is attached; implementation is blocked."}</small>
              </div>
            </div>
            <div className="impact-add-row">
              <label>
                <span>Approved baseline affected</span>
                <select value={change.baselineId ?? ""} onChange={(event) => update((p) => {
                  const cr = p.changes.find(item => item.id === change.id)!;
                  cr.baselineId = event.target.value || undefined;
                  cr.status = "Impact review";
                })}>
                  <option value="">Choose approved baseline…</option>
                  {project.versions.filter(version => version.type === "Baseline" && version.locked).map(version => <option key={version.id} value={version.id}>{version.version} · {version.label}</option>)}
                </select>
              </label>
            </div>
            <div className="impact-add-row">
              <label>
                <span>AI impact analysis record</span>
                <select value={change.impactRunId ?? impactRunId} onChange={(event) => setImpactRunId(event.target.value)} disabled={!impactRuns.length}>
                  {!impactRuns.length && <option>No reviewed AI impact analysis available</option>}
                  {impactRuns.map(run => <option key={run.id} value={run.id}>{run.id} · {run.metadata.model} · {new Date(run.at).toLocaleString()}</option>)}
                </select>
              </label>
              <Button disabled={!impactRuns.length || !!change.impactRunId || !impactRunId} onClick={() => update((p) => {
                const cr = p.changes.find(item => item.id === change.id)!;
                cr.impactRunId = impactRunId;
                addAudit(p, "Attached reviewed AI impact analysis", cr.id, `AI run ${impactRunId} retained as advisory impact evidence; the BA still selects and approves concrete patches.`);
              })}>Attach analysis</Button>
              {change.impactRunId && <small>Attached run: {change.impactRunId}. It is advisory evidence, not an implementation action.</small>}
            </div>
            <div className="impact-list">
              {change.impacts.map((impact) => (
                <label key={impact.id}>
                  <input
                    type="checkbox"
                    checked={impact.selected}
                    onChange={(e) =>
                      update((p) => {
                        const cr = p.changes.find((c) => c.id === change.id)!;
                        cr.impacts.find((i) => i.id === impact.id)!.selected = e.target.checked;
                        (cr.patches ?? []).filter(patch => patch.artifactId === impact.id && patch.status !== "Applied").forEach(patch => {
                          patch.selected = e.target.checked;
                          patch.status = e.target.checked ? "Proposed" : "Rejected";
                        });
                      })
                    }
                  />
                  <i>
                    {impact.type === "Requirement" ? (
                      <ListChecks />
                    ) : impact.type === "Diagram" ? (
                      <GitBranch />
                    ) : (
                      <FileText />
                    )}
                  </i>
                  <span>
                    <b>
                      {impact.id} · {impact.type}
                    </b>
                    <small>{impact.reason}</small>
                  </span>
                  <StatusBadge
                    value={impact.selected ? "Will update" : "Review only"}
                  />
                  {!(change.patches ?? []).some(patch => patch.artifactId === impact.id) && (
                    <Button onClick={() => update((p) => {
                      const cr = p.changes.find(item => item.id === change.id)!;
                      const patch = createPatch(p, impact.id, impact.type as "Requirement" | "User story" | "Diagram" | "Document");
                      if (patch) (cr.patches ??= []).push(patch);
                    })}>Draft content patch</Button>
                  )}
                </label>
              ))}
            </div>
            <div className="impact-add-row">
              <label>
                <span>Add affected artifact</span>
                <select
                  value={impactCandidate}
                  onChange={(event) => setImpactCandidate(event.target.value)}
                >
                  {impactOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.id} · {option.type}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                onClick={addImpact}
                disabled={
                  !impactCandidate ||
                  change.impacts.some((item) => item.id === impactCandidate)
                }
              >
                <Plus size={15} /> Add to review
              </Button>
            </div>
            <footer className="approval-bar">
              <div>
                <ShieldCheck />
                <span>
                  <b>Human impact review required</b>
                  <small>
                    Changes create new working versions; they never overwrite
                    baselines.
                  </small>
                </span>
              </div>
              <Button
                kind="primary"
                onClick={() => {
                  let failure: string | undefined;
                  update((p) => {
                    const cr = p.changes.find(item => item.id === change.id)!;
                    const patches = (cr.patches ?? []).filter(patch => patch.selected);
                    if (!patches.length) { failure = "Create and select at least one concrete content patch."; return; }
                    const stale = patches.find(patch => !patchIsCurrent(p, patch));
                    if (stale) { failure = `${stale.id} is stale. Refresh its before value before accepting it.`; return; }
                    const unchanged = patches.find(patch => !patch.after.trim() || patch.after === patch.before);
                    if (unchanged) { failure = `${unchanged?.id} has no substantive proposed change.`; return; }
                    patches.forEach(patch => { patch.status = "Accepted"; });
                    cr.status = "Approved";
                    cr.approvedAt = new Date().toISOString();
                    addAudit(p, "Approved change patches", cr.id, `${patches.length} concrete content patches were accepted for atomic implementation.`);
                  });
                  if (failure) mockNotice(failure, "warning", "Patches need review");
                  else mockNotice(`${change.id} is approved for implementation.`, "success", "Patches approved");
                }}
                disabled={change.status === "Implemented" || change.status === "Revalidated" || !(change.patches ?? []).some(patch => patch.selected)}
              >
                Accept selected patches <Check size={16} />
              </Button>
              <Button kind="primary" onClick={apply} disabled={change.status !== "Approved"}>
                Implement accepted patches <ArrowRight size={16} />
              </Button>
              {change.status === "Implemented" && <Button onClick={() => {
                if (!approvalAllowed(project)) { mockNotice("Complete the required reviews and approvals before recording revalidation.", "warning", "Revalidation blocked"); return; }
                update((p) => {
                  const cr = p.changes.find(item => item.id === change.id)!;
                  cr.status = "Revalidated";
                  cr.revalidatedAt = new Date().toISOString();
                  addAudit(p, "Recorded change revalidation", cr.id, "The implemented working revisions passed the current approval policy and are ready for a new baseline.");
                });
                mockNotice("Revalidation was recorded. Create the new baseline from Activity & baselines.", "success", "Change revalidated");
              }}>Record revalidation</Button>}
            </footer>
          </Card>
          <Card title="Reviewed content patches" description="Each patch is bound to its current source revision. Edit the proposed value; nothing is implemented from an example or version number alone.">
            {(change.patches ?? []).map((patch) => (
              <div className="side-diff" key={patch.id}>
                <label><input type="checkbox" checked={patch.selected} disabled={patch.status === "Applied"} onChange={(event) => update((p) => { const item = p.changes.find(item => item.id === change.id)!.patches!.find(item => item.id === patch.id)!; item.selected = event.target.checked; if (item.status !== "Applied") item.status = "Proposed"; p.changes.find(item => item.id === change.id)!.status = "Impact review"; })} /> {patch.artifactId} · {patch.field} · source v{patch.sourceRevision}</label>
                <div><span>Current</span><pre>{patch.before}</pre></div>
                <ArrowRight />
                <label><span>Proposed replacement</span><textarea aria-label={`Proposed patch ${patch.id}`} value={patch.after} disabled={patch.status === "Applied"} onChange={(event) => update((p) => { const item = p.changes.find(item => item.id === change.id)!.patches!.find(item => item.id === patch.id)!; item.after = event.target.value; item.status = "Proposed"; p.changes.find(item => item.id === change.id)!.status = "Impact review"; })} /><Button disabled={patch.status === "Applied"} onClick={() => update((p) => { const cr = p.changes.find(item => item.id === change.id)!; const item = cr.patches!.find(item => item.id === patch.id)!; item.status = "Rejected"; item.selected = false; cr.status = "Impact review"; addAudit(p, "Rejected change patch", `${change.id}/${patch.id}`, "The proposed content patch was retained as rejected and was not implemented."); })}>Reject patch</Button></label>
              </div>
            ))}
            {(change.patches ?? []).length === 0 && <EmptyState icon={<FileText />} title="No content patches yet" description="Add an affected artifact, then define the actual replacement content before approval." />}
            <div className="context-note warning">
              <AlertTriangle />
              <div>
                <b>Revalidation required</b>
                <p>
                  Performance evidence, acceptance criteria and document
                  references must be reviewed before the next baseline.
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <EmptyState
          icon={<RefreshCw />}
          title="No change requests"
          description="Approved baselines can only change through a controlled request."
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete}?`}
          description="The change request and its impact selections will be removed. Existing artifact versions and approved baselines will remain unchanged."
          confirmLabel="Delete change request"
          onCancel={() => setPendingDelete(undefined)}
          onConfirm={() => {
            update((p) => {
              p.changes = p.changes.filter((item) => item.id !== pendingDelete);
              addAudit(p, "Deleted change request", pendingDelete, "Removed the proposed change and its working impact review.");
            });
            setSelectedChange(project.changes.find((item) => item.id !== pendingDelete)?.id);
            setPendingDelete(undefined);
            mockNotice("The change request was deleted.", "success");
          }}
        />
      )}
    </>
  );
}

function GovernanceView({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
}) {
  const [configuring, setConfiguring] = useState(false);
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleOwner, setRuleOwner] = useState("Business analyst");
  const [pendingDelete, setPendingDelete] = useState<string>();
  const resolve = (id: string) => {
    update((p) => {
      const check = p.checks.find((c) => c.id === id)!;
      check.status = "Passed";
      check.resolution =
        "Confirmed with the responsible policy owner and linked to decision DEC-02.";
      addAudit(p, "Resolved governance check", id, check.resolution);
    });
    mockNotice(
      `${id} was resolved with an auditable rationale.`,
      "success",
      "Governance check resolved",
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="Layered policy engine"
        title="Governance & checks"
        description="Core safeguards cannot be disabled; domain and project rules add contextual evidence."
        actions={
          <Button onClick={() => setConfiguring(!configuring)}>
            <Settings size={17} /> Configure project rules
          </Button>
        }
      />
      {configuring && (
        <Card
          className="governance-configurator"
          title="Add a project-specific governance rule"
          description="Project rules can add evidence checks but cannot disable immutable core safeguards."
        >
          <div>
            <label>
              <span>Rule title</span>
              <input
                value={ruleTitle}
                onChange={(event) => setRuleTitle(event.target.value)}
                placeholder="e.g. Confirm policy exception owner"
              />
            </label>
            <label>
              <span>Responsible owner</span>
              <input
                value={ruleOwner}
                onChange={(event) => setRuleOwner(event.target.value)}
              />
            </label>
            <Button
              kind="primary"
              disabled={!ruleTitle.trim() || !ruleOwner.trim()}
              onClick={() => {
                update((p) => {
                  const id = uid("CHK");
                  p.checks.push({
                    id,
                    category: "Project rule",
                    title: ruleTitle.trim(),
                    status: "Warning",
                    source: "Project-specific governance",
                    rationale:
                      "This project rule requires evidence before approval.",
                    owner: ruleOwner.trim(),
                    version: 1,
                    goalId: p.activeGoalId,
                  });
                  addAudit(
                    p,
                    "Configured project governance rule",
                    id,
                    "A reviewable project-specific check was added.",
                  );
                });
                setRuleTitle("");
                setConfiguring(false);
                mockNotice(
                  "The project-specific rule was added as a reviewable warning.",
                  "success",
                  "Governance rule added",
                );
              }}
            >
              <Plus /> Add governance rule
            </Button>
          </div>
        </Card>
      )}
      <div className="governance-summary">
        <Metric
          label="Open review findings"
          value={project.checks.filter(c => c.status === "Warning" || c.status === "Blocking").length}
          detail="Requires BA assessment"
          tone="success"
        />
        <Metric
          label="Passed"
          value={project.checks.filter((c) => c.status === "Passed").length}
          detail="Evidence accepted"
          tone="success"
        />
        <Metric
          label="Warnings"
          value={project.checks.filter((c) => c.status === "Warning").length}
          detail="Needs attention"
          tone="warning"
        />
        <Metric
          label="Blocking"
          value={project.checks.filter((c) => c.status === "Blocking").length}
          detail="Prevents approval"
          tone="danger"
        />
      </div>
      <Card
        title="Active governance layers"
        description="Project rules may strengthen, but never weaken, core safeguards."
      >
        <div className="pack-list">
          {project.governancePacks.map((pack, index) => (
            <div key={pack}>
              <i>{index === 0 ? <LockKeyhole /> : <ShieldCheck />}</i>
              <span>
                <b>{pack}</b>
                <small>
                  {index === 0
                    ? "Immutable · Human approval, privacy, uncertainty and traceability"
                    : "Domain or organization policy pack"}
                </small>
              </span>
              <StatusBadge value={index === 0 ? "Locked" : "Active"} />
            </div>
          ))}
        </div>
      </Card>
      <div className="check-grid">
        {project.checks.map((check) => (
          <Card
            key={check.id}
            className={`governance-check ${check.status.toLowerCase().replace(" ", "-")}`}
          >
            <header>
              <i>
                {check.status === "Passed" ? (
                  <CheckCircle2 />
                ) : (
                  <AlertTriangle />
                )}
              </i>
              <div>
                <span>
                  {check.category} · {check.id}
                </span>
                <h2>{check.title}</h2>
              </div>
              <StatusBadge value={check.status} />
            </header>
            <p>{check.rationale}</p>
            <dl>
              <div>
                <dt>Policy source</dt>
                <dd>{check.source}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{check.owner}</dd>
              </div>
            </dl>
            {check.resolution && (
              <div className="resolution">
                <Check size={15} />
                {check.resolution}
              </div>
            )}
            <footer>
              {check.immutable ? (
                <span>
                  <LockKeyhole size={14} /> Core safeguard cannot be disabled
                </span>
              ) : (
                <button
                  disabled={!governanceCanDisable(check)}
                  onClick={() => {
                    update((p) => {
                      const item = p.checks.find((c) => c.id === check.id)!;
                      item.status = "Not applicable";
                      item.resolution =
                        "Project owner recorded a scoped not-applicable rationale.";
                      addAudit(
                        p,
                        "Marked check not applicable",
                        item.id,
                        item.resolution,
                      );
                    });
                    mockNotice(
                      `${check.id} was marked not applicable with a recorded rationale.`,
                      "success",
                      "Governance status updated",
                    );
                  }}
                >
                  Mark not applicable
                </button>
              )}
              {check.status !== "Passed" && (
                <Button kind="primary" onClick={() => resolve(check.id)}>
                  Record resolution
                </Button>
              )}
              {check.category === "Project rule" && (
                <Button kind="danger" onClick={() => setPendingDelete(check.id)}>
                  <Trash2 size={15} /> Delete rule
                </Button>
              )}
            </footer>
          </Card>
        ))}
      </div>
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete}?`}
          description="This project-specific governance check will be removed. Core and domain safeguards cannot be deleted."
          confirmLabel="Delete governance rule"
          onCancel={() => setPendingDelete(undefined)}
          onConfirm={() => {
            update((p) => {
              p.checks = p.checks.filter((check) => check.id !== pendingDelete);
              addAudit(p, "Deleted project governance rule", pendingDelete, "Removed the project-specific check; core safeguards were unchanged.");
            });
            setPendingDelete(undefined);
            mockNotice("The project-specific governance rule was deleted.", "success");
          }}
        />
      )}
    </>
  );
}

function ActivityView({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
}) {
  const snapshot = () => {
    update((p) => {
      p.versions.unshift({
        id: uid("VER"),
        label: "Named review snapshot",
        snapshot: captureSnapshot(p),
        version: `v0.${p.versions.length + 4}`,
        at: new Date().toISOString(),
        actor: "Business analyst",
        type: "Snapshot",
        locked: false,
        changes: "Manual milestone created from current working state",
      });
      addAudit(
        p,
        "Created snapshot",
        "Current working state",
        "Named review milestone recorded.",
      );
    });
    mockNotice(
      "A named snapshot of the current working state was recorded.",
      "success",
      "Snapshot created",
    );
  };
  const approveBaseline = () => {
    if (!approvalAllowed(project)) { notify(baselineIssues(project).join(" "), "warning"); return; }
    update((p) => {
      p.gate = "Approve";
      p.gateIndex = 5;
      const goal = activeGoal(p);
      if (goal) {
        goal.gate = "Approve";
        goal.gateIndex = 5;
      }
      p.requirements.forEach((r) => {
        if (r.status === "in-review" && (!p.activeGoalId || !r.goalId || r.goalId === p.activeGoalId)) r.status = "approved";
      });
      p.documents.forEach((d) => {
        if (d.status === "in-review" && (!p.activeGoalId || !d.goalId || d.goalId === p.activeGoalId)) d.status = "approved";
      });
      p.stories.forEach((story) => { if (story.status === "in-review" && (!p.activeGoalId || !story.goalId || story.goalId === p.activeGoalId)) story.status = "approved"; });
      p.diagrams.forEach((diagram) => {
        if (diagram.status === "In review" && (!p.activeGoalId || !diagram.goalId || diagram.goalId === p.activeGoalId)) {
          diagram.status = "Approved";
          diagram.approvalStatus = "Approved";
        }
      });
      p.versions.unshift({
        id: uid("BASE"),
        label: "Approved requirements baseline",
        snapshot: captureSnapshot(p),
        version: `B${p.versions.filter((v) => v.type === "Baseline").length + 1}`,
        at: new Date().toISOString(),
        actor: "Business analyst",
        type: "Baseline",
        locked: true,
        changes: "Human-approved artifact, governance and traceability package",
        manifest: revisionManifest(p),
      });
      addAudit(
        p,
        "Approved baseline",
        "Current project package",
        "Named BA authority recorded; baseline locked against direct edits.",
      );
    });
    mockNotice(
      "The reviewed artifact package was locked as a new human-approved baseline.",
      "success",
      "Baseline approved",
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="Append-only evidence"
        title="Activity & baselines"
        description="Autosaves, named milestones, immutable baselines and human decisions remain auditable."
        actions={
          <>
            <Button onClick={snapshot}>
              <FileClock size={17} /> Create snapshot
            </Button>
            <Button
              kind="primary"
              onClick={approveBaseline}
              disabled={!approvalAllowed(project)} title={baselineIssues(project).join(" ")}
            >
              <LockKeyhole size={17} /> Approve new baseline
            </Button>
          </>
        }
      />
      <div className="version-layout">
        <Card
          title="Versions and baselines"
          description="Restoring an older version always creates a new working draft."
        >
          <div className="version-list">
            {project.versions.map((version) => (
              <div key={version.id}>
                <i className={version.type.toLowerCase()}>
                  {version.locked ? <LockKeyhole /> : <History />}
                </i>
                <span>
                  <b>{version.label}</b>
                  <small>
                    {version.version} · {version.actor} · {version.at}
                  </small>
                  <p>{version.changes}</p>
                </span>
                <StatusBadge value={version.type} />
                <Button
                  disabled={!version.snapshot}
                  title={version.snapshot ? "Current work will be retained in a recovery snapshot." : "This older milestone has no saved content."}
                  onClick={() => {
                    update((p) => restoreSnapshot(p, version));
                    mockNotice(
                      `${version.version} was restored as a new unlocked working snapshot.`,
                      "success",
                      "Version restored",
                    );
                  }}
                >
                  Restore as draft
                </Button>
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="Audit trail"
          description="Suggestions, edits, approvals and exports"
        >
          <div className="audit-list">
            {project.audit.map((event) => (
              <div key={event.id}>
                <i>
                  <Activity size={16} />
                </i>
                <span>
                  <b>
                    {event.action} · {event.object}
                  </b>
                  <p>{event.detail}</p>
                  <small>
                    {event.actor} · {event.at}
                  </small>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function TeamView({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
}) {
  const [editingFolder, setEditingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState(project.folderName);
  const [pendingRemove, setPendingRemove] = useState<string>();
  const invite = () => {
    update((p) =>
      p.members.push({
        id: uid("MEM"),
        name: "Invited reviewer",
        initials: "IR",
        role: "Reviewer",
        approval: false,
        status: "Invited",
      }),
    );
    mockNotice(
      "A mock reviewer was added locally; no invitation was transmitted.",
      "success",
      "Reviewer added",
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="Local collaboration model"
        title="Team & project settings"
        description="Roles are simulated locally; no invitation or project content is transmitted."
        actions={
          <Button kind="primary" onClick={invite}>
            <Plus size={17} /> Invite mock reviewer
          </Button>
        }
      />
      <div className="team-layout">
        <Card
          title="Project members"
          description="Only explicitly authorized BA roles can approve baselines."
        >
          <div className="member-list">
            {project.members.map((member) => (
              <div key={member.id}>
                <i>{member.initials}</i>
                <span>
                  <b>{member.name}</b>
                  <small>{member.status}</small>
                </span>
                <select
                  value={member.role}
                  onChange={(e) =>
                    update((p) => {
                      p.members.find((m) => m.id === member.id)!.role = e.target
                        .value as typeof member.role;
                    })
                  }
                >
                  {["Owner / Lead BA", "BA Editor", "Reviewer", "Viewer"].map(
                    (x) => (
                      <option key={x}>{x}</option>
                    ),
                  )}
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={member.approval}
                    onChange={(e) =>
                      update((p) => {
                        p.members.find((m) => m.id === member.id)!.approval =
                          e.target.checked;
                      })
                    }
                  />{" "}
                  Can approve
                </label>
                {member.role !== "Owner / Lead BA" && (
                  <IconButton
                    label={`Remove ${member.name}`}
                    onClick={() => setPendingRemove(member.id)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                )}
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="Local workspace"
          description="Project data remains on this device"
        >
          <dl className="settings-list">
            <div>
              <dt>Project folder</dt>
              <dd>{project.folderName}</dd>
            </div>
            <div>
              <dt>Storage mode</dt>
              <dd>Managed local workspace</dd>
            </div>
            <div>
              <dt>Cloud synchronization</dt>
              <dd>Off</dd>
            </div>
            <div>
              <dt>AI training</dt>
              <dd>Disabled</dd>
            </div>
          </dl>
          {editingFolder && (
            <label className="folder-path-editor">
              <span>Workspace label</span>
              <input
                value={folderDraft}
                onChange={(event) => setFolderDraft(event.target.value)}
              />
              <small>
                This changes the local workspace label; browser-managed storage
                remains in IndexedDB.
              </small>
            </label>
          )}
          <Button
            className="full"
            disabled={editingFolder && !folderDraft.trim()}
            onClick={() => {
              if (editingFolder) {
                update((p) => {
                  p.folderName = folderDraft.trim();
                  addAudit(
                    p,
                    "Updated workspace label",
                    p.id,
                    "The local project folder label was changed.",
                  );
                });
                mockNotice(
                  "The local workspace label was updated.",
                  "success",
                  "Workspace updated",
                );
              }
              setEditingFolder(!editingFolder);
            }}
          >
            {editingFolder ? <Check size={17} /> : <Folder size={17} />}
            {editingFolder ? "Save workspace label" : "Change workspace label"}
          </Button>
        </Card>
      </div>
      {pendingRemove && (
        <ConfirmDialog
          title="Remove this project member?"
          description="The local mock member and their approval permission will be removed from this project. No external account is affected."
          confirmLabel="Remove member"
          onCancel={() => setPendingRemove(undefined)}
          onConfirm={() => {
            const member = project.members.find((item) => item.id === pendingRemove);
            update((p) => {
              p.members = p.members.filter((item) => item.id !== pendingRemove);
              addAudit(p, "Removed project member", pendingRemove, `${member?.name ?? "Member"} was removed from the local collaboration model.`);
            });
            setPendingRemove(undefined);
            mockNotice("The project member was removed.", "success");
          }}
        />
      )}
    </>
  );
}

function ProjectsHome({
  state,
  onCreate,
  onDelete,
}: {
  state: WorkspaceState;
  onCreate: () => void;
  onDelete: (project: Project) => void;
}) {
  const nav = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<Project>();
  return (
    <>
      <PageHeader
        eyebrow="Local-first BA workspaces"
        title="Projects"
        description="Each project isolates its sources, conversations, artifacts, policies and audit history."
        actions={
          <Button kind="primary" onClick={onCreate}>
            <Plus size={17} /> New project
          </Button>
        }
      />
      {state.projects.length ? (
        <div className="project-card-grid">
          {state.projects.map((project) => (
            <article
              key={project.id}
              className="project-card"
              role="link"
              tabIndex={0}
              aria-label={`Open ${project.name}`}
              onClick={() => nav(`/projects/${project.id}/overview`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  nav(`/projects/${project.id}/overview`);
                }
              }}
            >
              <header>
                <i style={{ background: project.color }}>{project.name[0]}</i>
                <StatusBadge value={project.gate} />
              </header>
              <h2>{project.name}</h2>
              <p>{project.description}</p>
              <div className="project-meta">
                <span>
                  <Folder size={15} />
                  {project.folderName}
                </span>
                <span>
                  <ShieldCheck size={15} />
                  {project.governancePacks[1]}
                </span>
              </div>
              <footer>
                <span>
                  <b>{traceCoverage(project)}%</b> evidence coverage
                </span>
                <span>
                  <b>{blockers(project)}</b> blockers
                </span>
                <IconButton
                  label={`Delete ${project.name}`}
                  className="delete-project-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPendingDelete(project);
                  }}
                >
                  <Trash2 size={17} />
                </IconButton>
                <ArrowRight size={18} />
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FolderKanban />}
          title="No projects yet"
          description="Create a local BA workspace to begin."
          action={
            <Button kind="primary" onClick={onCreate}>
              <Plus size={16} /> New project
            </Button>
          }
        />
      )}{" "}
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete “${pendingDelete.name}”?`}
          description="Its sources, artifacts, governance settings and local activity history will be permanently removed from this browser workspace."
          confirmLabel="Delete project"
          onCancel={() => setPendingDelete(undefined)}
          onConfirm={() => {
            onDelete(pendingDelete);
            setPendingDelete(undefined);
            mockNotice("The local project was deleted.", "success");
          }}
        />
      )}
    </>
  );
}

function RatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <fieldset className="rating-input">
      <legend>{label}</legend>
      <div>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            type="button"
            key={score}
            className={value === score ? "selected" : ""}
            aria-label={`${label}: ${score} out of 5`}
            aria-pressed={value === score}
            onClick={() => onChange(score as 1 | 2 | 3 | 4 | 5)}
          >
            {score}
          </button>
        ))}
      </div>
      <small>1 = very low · 5 = excellent</small>
    </fieldset>
  );
}

function StageEvaluationView({
  project,
  state,
  setState,
}: {
  project: Project;
  state: WorkspaceState;
  setState: Dispatch<SetStateAction<WorkspaceState>>;
}) {
  const goal = activeGoal(project);
  const [stage, setStage] = useState<WorkflowGate>(goal?.gate ?? project.gate);
  const [taskCompleted, setTaskCompleted] = useState(true);
  const [accuracy, setAccuracy] = useState(0);
  const [usefulness, setUsefulness] = useState(0);
  const [usability, setUsability] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [comment, setComment] = useState("");
  const projectEvents = state.telemetryEvents.filter(
    (event) =>
      event.projectId === project.id &&
      (!goal?.id || !event.goalId || event.goalId === goal.id),
  );
  const projectFeedback = state.stageFeedback.filter(
    (entry) =>
      entry.projectId === project.id &&
      (!goal?.id || !entry.goalId || entry.goalId === goal.id),
  );
  const complete = accuracy && usefulness && usability && confidence;
  const save = () => {
    if (!complete) return;
    const run = activeEvaluationRun(state.evaluationRuns);
    const entry: StageFeedback = {
      id: uid("FDBK"),
      at: new Date().toISOString(),
      projectId: project.id,
      goalId: goal?.id,
      runId: run?.id,
      evaluatorCode: run?.evaluatorCode ?? "LOCAL-EVALUATOR",
      stage,
      taskCompleted,
      accuracyRating: accuracy as 1 | 2 | 3 | 4 | 5,
      usefulnessRating: usefulness as 1 | 2 | 3 | 4 | 5,
      usabilityRating: usability as 1 | 2 | 3 | 4 | 5,
      confidenceRating: confidence as 1 | 2 | 3 | 4 | 5,
      comment: comment.trim(),
    };
    setState((current) => ({
      ...current,
      stageFeedback: [...current.stageFeedback, entry],
    }));
    setAccuracy(0);
    setUsefulness(0);
    setUsability(0);
    setConfidence(0);
    setComment("");
    mockNotice(`${stage} stage feedback recorded pseudonymously.`);
  };
  return (
    <>
      <PageHeader
        eyebrow="Participant research instrument"
        title="Stage evaluation"
        description="Rate the quality of each workflow stage. Ratings are stored locally with pseudonymous run metadata and no project content."
      />
      <div className="context-note">
        <BarChart3 />
        <div>
          <b>Feedback is compulsory for evaluated stages</b>
          <p>
            Complete all four ratings after each assigned stage. Comments are
            optional, and names or contact details are never requested.
          </p>
        </div>
      </div>
      <div className="stage-evaluation-grid">
        {gates.map((item) => {
          const summary = summarizeStageResearch(
            projectEvents,
            projectFeedback,
            item,
          );
          return (
            <button
              key={item}
              className={classNames(
                "stage-evaluation-card",
                item === stage && "selected",
                item === goal?.gate && "current",
              )}
              aria-pressed={item === stage}
              onClick={() => setStage(item)}
            >
              <span>{item}</span>
              <b>{summary.feedbackCount ? `${summary.accuracy}/5` : "Not rated"}</b>
              <small>
                {formatDuration(summary.durationMs)} observed ·{" "}
                {summary.interactions} actions
              </small>
            </button>
          );
        })}
      </div>
      <Card
        title={`Rate ${stage}`}
        description="Submit one response after completing the assigned stage task."
      >
        <div className="stage-feedback-form">
          <div className="feedback-rating-grid">
            <RatingInput label="Output accuracy" value={accuracy} onChange={setAccuracy} />
            <RatingInput label="Usefulness" value={usefulness} onChange={setUsefulness} />
            <RatingInput label="Ease of use" value={usability} onChange={setUsability} />
            <RatingInput label="Confidence in result" value={confidence} onChange={setConfidence} />
          </div>
          <label className="task-completion-control">
            <input
              type="checkbox"
              checked={taskCompleted}
              onChange={(event) => setTaskCompleted(event.target.checked)}
            />
            <span>
              <b>I completed the assigned stage task</b>
              <small>Clear this if you could not reach the expected outcome.</small>
            </span>
          </label>
          <label className="feedback-comment">
            <span>Optional feedback</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="What helped, what was unclear, or what should change?"
              maxLength={1200}
            />
            <small>{comment.length}/1200</small>
          </label>
          <div className="feedback-submit-row">
            <span>
              {complete
                ? "All required ratings are complete."
                : "Complete all four ratings to submit."}
            </span>
            <Button kind="primary" disabled={!complete} onClick={save}>
              <Check size={16} /> Submit stage feedback
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}

function ResearchConsole({
  state,
  setState,
}: {
  state: WorkspaceState;
  setState: Dispatch<SetStateAction<WorkspaceState>>;
}) {
  const researchUrl = (import.meta.env.VITE_BA_MATE_RESEARCH_URL as string | undefined)?.replace(/\/$/, "");
  const [accessToken, setAccessToken] = useState(() => sessionStorage.getItem("ba-mate-research-access-token") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountToken, setAccountToken] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register" | "recover" | "reset">("login");
  const [account, setAccount] = useState<{ role: string; study_pseudonym?: string; offline_until?: string; consent?: { consent_version: string } | null }>();
  const [accountError, setAccountError] = useState("");
  const [participants, setParticipants] = useState<{ account_code: string; status: string; study_pseudonym?: string; consent_state?: string }[]>([]);
  const [batches, setBatches] = useState<{ study_pseudonym: string; consent_version: string; received_at: string; event_count: number }[]>([]);
  const [feedbackEntries, setFeedbackEntries] = useState<{ feedback_id: string; study_pseudonym: string; feedback_text: string; review_state: string; submitted_at: string }[]>([]);
  const [remoteRuns, setRemoteRuns] = useState<{ study_pseudonym: string; run_code: string; run_condition: string; latest_event_at: string }[]>([]);
  const [qualityAssessments, setQualityAssessments] = useState<{ assessment_id: string; study_pseudonym: string; run_code: string; instrument_version: string; quality_score: number; correction_effort_minutes: number | null; recorded_at: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteResult, setInviteResult] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackPreview, setFeedbackPreview] = useState(false);
  const [qualityRunKey, setQualityRunKey] = useState("");
  const [qualityScore, setQualityScore] = useState("5");
  const [correctionEffort, setCorrectionEffort] = useState("");
  const [tab, setTab] = useState<"overview" | "stages" | "feedback" | "runs">(
    "overview",
  );
  const [caseCode, setCaseCode] = useState("");
  const [participantCode, setParticipantCode] = useState("");
  const [runProject, setRunProject] = useState(state.projects[0]?.id ?? "");
  const [runCondition, setRunCondition] = useState<"Manual" | "Generic AI" | "Proposed workflow">("Proposed workflow");
  useEffect(() => {
    if (!researchUrl || !accessToken) return;
    fetch(`${researchUrl}/api/v1/me`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async response => response.ok ? response.json() : Promise.reject(new Error('Your research session has expired or been revoked.')))
      .then(setAccount).catch(error => { setAccount(undefined); setAccountError(error.message); sessionStorage.removeItem("ba-mate-research-access-token"); setAccessToken(""); });
  }, [researchUrl, accessToken]);
  useEffect(() => {
    const recoveryToken = new URLSearchParams(window.location.search).get("recovery_token");
    if (recoveryToken) { setAuthMode("reset"); setAccountToken(recoveryToken); }
  }, []);
  const participation: LocalResearchParticipation = state.researchParticipation ?? { enrollment: { status: "not-enrolled" }, queue: [] };
  const saveParticipation = (change: (current: LocalResearchParticipation) => LocalResearchParticipation) => setState(current => ({
    ...current, researchParticipation: change(current.researchParticipation ?? { enrollment: { status: "not-enrolled" }, queue: [] }),
  }));
  const researchRequest = async (path: string, method = "POST", payload?: unknown) => {
    const response = await fetch(`${researchUrl}${path}`, { method, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "The research service rejected this request.");
    return result;
  };
  const signOut = async () => {
    try { if (accessToken) await researchRequest("/api/v1/auth/logout"); }
    catch { /* A local sign-out must still work while offline or after a session has already expired. */ }
    finally {
      sessionStorage.removeItem("ba-mate-research-access-token");
      setAccessToken("");
      setAccount(undefined);
      notify("The research session was removed from this device. Local BA work and queued permitted measurements remain on this device.", "info");
    }
  };
  const consent = async () => {
    try {
      await researchRequest("/api/v1/consent", "POST", { consent_version: RESEARCH_CONSENT_VERSION, accepted: true });
      saveParticipation(current => ({ ...current, enrollment: { status: "active", studyPseudonym: account?.study_pseudonym, consentVersion: RESEARCH_CONSENT_VERSION, consentedAt: new Date().toISOString(), offlineUntil: account?.offline_until, uploadEndpoint: researchUrl }, sync: { state: "idle", attempts: 0 } }));
      setAccount(current => current ? { ...current, consent: { consent_version: RESEARCH_CONSENT_VERSION } } : current);
      notify("Consent was recorded. Only the permitted pseudonymous research measurements can be queued; local BA work remains private.", "success");
    } catch (error) { setAccountError(error instanceof Error ? error.message : "Consent could not be recorded."); }
  };
  const queueCurrent = () => {
    try {
      if (participation.enrollment.offlineUntil && Date.parse(participation.enrollment.offlineUntil) <= Date.now()) {
        saveParticipation(current => ({ ...current, enrollment: { ...current.enrollment, status: "expired" }, sync: { state: "failed", attempts: current.sync?.attempts ?? 0, message: "The offline collection grace period ended. Sign in again before collecting." } }));
        throw new Error("The offline collection grace period ended. Sign in again before collecting; local BA work is unchanged.");
      }
      const batch = validateResearchUpload(buildResearchUpload(state, participation.enrollment));
      saveParticipation(current => ({ ...current, queue: queueUpload(current.queue, batch), sync: { state: "idle", attempts: 0 } }));
      notify("A permitted measurement batch was added to the local queue. It contains no workspace content.", "success");
    } catch (error) { setAccountError(error instanceof Error ? error.message : "The permitted measurements could not be queued."); }
  };
  const sync = async () => {
    if (!participation.queue.length) return;
    if (participation.enrollment.offlineUntil && Date.parse(participation.enrollment.offlineUntil) <= Date.now()) {
      saveParticipation(current => ({ ...current, enrollment: { ...current.enrollment, status: "expired" }, sync: { state: "failed", attempts: current.sync?.attempts ?? 0, message: "The offline collection grace period ended. Sign in again before collecting." } }));
      setAccountError("The offline collection grace period ended. Sign in again before synchronizing; local BA work is unchanged.");
      return;
    }
    saveParticipation(current => ({ ...current, sync: { state: "syncing", attempts: current.sync?.attempts ?? 0 } }));
    let remaining = [...participation.queue];
    try {
      for (const batch of participation.queue) {
        await researchRequest("/api/v1/batches", "POST", batch);
        remaining = remaining.filter(item => item.batch_id !== batch.batch_id);
      }
      saveParticipation(current => ({ ...current, queue: remaining, enrollment: { ...current.enrollment, lastSyncAt: new Date().toISOString() }, sync: { state: "idle", attempts: 0 } }));
      notify("Permitted research measurements synchronized. Local BA projects were not sent.", "success");
    } catch (error) {
      const attempts = (participation.sync?.attempts ?? 0) + 1;
      const nextRetryAt = new Date(Date.now() + retryDelayMs(attempts)).toISOString();
      saveParticipation(current => ({ ...current, queue: remaining, sync: { state: "waiting", attempts, nextRetryAt, message: error instanceof Error ? error.message : "Sync failed." } }));
      setAccountError(error instanceof Error ? error.message : "Sync failed. The queue is retained locally and BA work is unaffected.");
    }
  };
  const withdraw = async () => {
    try {
      await researchRequest("/api/v1/withdraw");
      saveParticipation(current => ({ ...current, enrollment: { ...current.enrollment, status: "withdrawn" }, queue: [], sync: { state: "idle", attempts: 0, message: "Consent withdrawn; unsent batches discarded." } }));
      setAccount(current => current ? { ...current, consent: null } : current);
      notify("Consent was withdrawn and unsent local research batches were discarded. Your local BA work was not changed.", "success");
    } catch (error) { setAccountError(error instanceof Error ? error.message : "Consent withdrawal could not be recorded."); }
  };
  const submitFeedback = async () => {
    try {
      await researchRequest("/api/v1/feedback", "POST", { schema: "ba-mate-research-feedback-v1", feedback_id: crypto.randomUUID(), consent_version: RESEARCH_CONSENT_VERSION, study_pseudonym: account?.study_pseudonym, created_at: new Date().toISOString(), feedback_text: feedbackText, confirmed: true });
      setFeedbackText(""); setFeedbackPreview(false);
      notify("Your feedback was submitted for separate research review. It is not included in routine measurement exports.", "success");
    } catch (error) { setAccountError(error instanceof Error ? error.message : "Feedback could not be submitted."); }
  };
  const loadAdministration = async () => {
    if (account?.role !== "researcher") return;
    try {
      const [participantResult, batchResult, feedbackResult, runResult, qualityResult] = await Promise.all([researchRequest("/api/v1/admin/participants", "GET"), researchRequest("/api/v1/admin/batches", "GET"), researchRequest("/api/v1/admin/feedback", "GET"), researchRequest("/api/v1/admin/runs", "GET"), researchRequest("/api/v1/admin/quality-assessments", "GET")]);
      setParticipants(participantResult.participants ?? []); setBatches(batchResult.batches ?? []); setFeedbackEntries(feedbackResult.feedback ?? []); setRemoteRuns(runResult.runs ?? []); setQualityAssessments(qualityResult.assessments ?? []);
    } catch (error) { setAccountError(error instanceof Error ? error.message : "Research administration could not be loaded."); }
  };
  useEffect(() => { void loadAdministration(); }, [account?.role, accessToken]);
  const inviteParticipant = async () => {
    try {
      const result = await researchRequest("/api/v1/admin/invitations", "POST", { email: inviteEmail, role: "participant", expires_hours: 72 });
      setInviteResult(`Single-use invitation token: ${result.invite_token}. Deliver it only through the approved participant channel.`);
      setInviteEmail(""); await loadAdministration();
    } catch (error) { setAccountError(error instanceof Error ? error.message : "Invitation could not be created."); }
  };
  const reviewFeedback = async (feedbackId: string, reviewState: "reviewed" | "withheld") => {
    try { await researchRequest(`/api/v1/admin/feedback/${feedbackId}/review`, "POST", { review_state: reviewState }); await loadAdministration(); }
    catch (error) { setAccountError(error instanceof Error ? error.message : "Feedback review could not be recorded."); }
  };
  const revokeParticipant = async (accountCode: string) => {
    try { await researchRequest(`/api/v1/admin/accounts/${accountCode}/revoke`); await loadAdministration(); notify("The participant account and active sessions were revoked. Local BA projects remain outside the service.", "success"); }
    catch (error) { setAccountError(error instanceof Error ? error.message : "Participant revocation could not be completed."); }
  };
  const recordQualityAssessment = async () => {
    const selected = remoteRuns.find(run => `${run.study_pseudonym}/${run.run_code}` === qualityRunKey);
    if (!selected) { setAccountError("Choose an accepted pseudonymous run before recording an assessment."); return; }
    const minutes = correctionEffort.trim() === "" ? undefined : Number(correctionEffort);
    try {
      await researchRequest("/api/v1/admin/quality-assessments", "POST", { assessment_id: crypto.randomUUID(), study_pseudonym: selected.study_pseudonym, run_code: selected.run_code, instrument_version: RESEARCH_INSTRUMENT_VERSION, quality_score: Number(qualityScore), correction_effort_minutes: minutes });
      setQualityRunKey(""); setCorrectionEffort(""); await loadAdministration();
      notify("The independent quality assessment was recorded separately from participant ratings.", "success");
    } catch (error) { setAccountError(error instanceof Error ? error.message : "Quality assessment could not be recorded."); }
  };
  useEffect(() => {
    if (account?.role !== "participant" || !account.study_pseudonym || !account.consent?.consent_version) return;
    saveParticipation(current => ({ ...current, enrollment: { ...current.enrollment, status: "active", studyPseudonym: account.study_pseudonym, consentVersion: account.consent?.consent_version, offlineUntil: account.offline_until, uploadEndpoint: researchUrl } }));
  }, [account?.role, account?.study_pseudonym, account?.offline_until, account?.consent?.consent_version, researchUrl]);
  if (!researchUrl)
    return <section className="recovery-screen"><h1>Research collection is not connected</h1><p>Local BA work and backups remain available. Set the separately deployed research-service HTTPS address before inviting participants; no local password can unlock collection or administration.</p></section>;
  if (!account)
    return (
      <div className="research-lock-screen">
        <form
          className="research-lock-card"
          onSubmit={async (event) => {
            event.preventDefault();
            setAccountError("");
            try {
              const request = authMode === "login"
                ? { path: "/api/v1/auth/login", payload: { email, password } }
                : authMode === "register"
                  ? { path: "/api/v1/auth/register", payload: { invite_token: accountToken, email, password } }
                  : authMode === "recover"
                    ? { path: "/api/v1/auth/recovery", payload: { email } }
                    : { path: "/api/v1/auth/reset", payload: { recovery_token: accountToken, password } };
              const response = await fetch(`${researchUrl}${request.path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request.payload) });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error ?? "Account request failed.");
              if (authMode === "login") { sessionStorage.setItem("ba-mate-research-access-token", result.access_token); setAccessToken(result.access_token); setPassword(""); }
              else { setAccountToken(""); setPassword(""); setAuthMode("login"); setAccountError(authMode === "recover" ? "If this email is registered, a recovery link was sent." : authMode === "reset" ? "Password reset. Sign in with the new password." : "Registration complete. Sign in to record consent."); }
            } catch (error) { setAccountError(error instanceof Error ? error.message : "Account request failed."); }
          }}
        >
          <i>
            <LockKeyhole />
          </i>
          <span className="eyebrow">Research-service account</span>
          <h1>{authMode === "login" ? "Research console" : authMode === "register" ? "Register invited account" : authMode === "recover" ? "Recover account" : "Set new password"}</h1>
          <p>
            {authMode === "login" ? "Sign in with an invited participant or researcher account. This is not a BA approval identity and it never unlocks private project content." : authMode === "register" ? "Use the single-use invitation token supplied by the researcher. It cannot be reused after registration." : authMode === "recover" ? "Request a single-use recovery link. The service gives the same response whether or not an account exists." : "Paste the single-use recovery token from the approved recovery link and choose a new password."}
          </p>
          {authMode !== "reset" && <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" autoFocus />
          </label>}
          {(authMode === "register" || authMode === "reset") && <label><span>{authMode === "register" ? "Invitation token" : "Recovery token"}</span><input value={accountToken} onChange={event => setAccountToken(event.target.value)} autoComplete="one-time-code" /></label>}
          {authMode !== "recover" && <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setAccountError("");
              }}
              autoComplete="current-password"
              autoFocus
            />
          </label>}
          {accountError && <div className={accountError.startsWith("If this") || accountError.startsWith("Registration") || accountError.startsWith("Password reset") ? "success-message" : "form-error"}>{accountError}</div>}
          <Button type="submit" kind="primary" disabled={authMode === "recover" ? !email : authMode === "reset" ? !password || !accountToken : authMode === "register" ? !password || !email || !accountToken : !password || !email}>
            <LockKeyhole size={16} /> {authMode === "login" ? "Sign in" : authMode === "register" ? "Register account" : authMode === "recover" ? "Send recovery link" : "Reset password"}
          </Button>
          <div className="workbench-actions"><button type="button" onClick={() => { setAuthMode("login"); setAccountError(""); }}>Sign in</button><button type="button" onClick={() => { setAuthMode("register"); setAccountError(""); }}>Register invitation</button><button type="button" onClick={() => { setAuthMode("recover"); setAccountError(""); }}>Recover access</button><button type="button" onClick={() => { setAuthMode("reset"); setAccountError(""); }}>Use recovery token</button></div>
          <small>
            Participants use their own invitation, registration, consent and withdrawal routes. Local BA work is available even when this service is offline.
          </small>
        </form>
      </div>
    );
  if (account.role !== "researcher")
    return <section className="recovery-screen"><h1>Participant research connection</h1><p>Study pseudonym: {account.study_pseudonym ?? "available after enrolment"}. This identity is separate from your local BA projects and approval roles.</p><p>{account.consent ? `Active consent: ${account.consent.consent_version}` : "Collection is off until you explicitly record consent."} {account.offline_until ? `Offline grace ends: ${new Date(account.offline_until).toLocaleString()}.` : ""}</p><p>{RETENTION_NOTICE}</p>{accountError && <p role="alert">{accountError}</p>}<div className="workbench-actions">{!account.consent && <Button kind="primary" onClick={() => void consent()}>Record consent</Button>}{account.consent && <><Button onClick={queueCurrent}>Preview and queue permitted measurements</Button><Button kind="primary" disabled={!participation.queue.length || participation.sync?.state === "syncing"} onClick={() => void sync()}>Sync {participation.queue.length} queued batch{participation.queue.length === 1 ? "" : "es"}</Button><Button kind="danger" onClick={() => void withdraw()}>Withdraw consent</Button></>}<Button onClick={() => void signOut()}>Sign out</Button></div>{account.consent && <><details><summary>Submission preview and queue state</summary><p>{participation.queue.length} batch(es) waiting. {participation.sync?.state === "waiting" ? `Retry after ${participation.sync.nextRetryAt ? new Date(participation.sync.nextRetryAt).toLocaleString() : "connection recovery"}.` : participation.sync?.message ?? "No pending error."}</p><pre>{JSON.stringify(participation.queue[0] ?? { message: "Queue a batch to inspect its permitted fields before sync." }, null, 2)}</pre></details><details><summary>Optional free-text feedback — reviewed separately</summary><p>Do not include project names, client details, requirements, files, prompts, model responses or credentials. This feedback is never added to routine telemetry or the ordinary research export.</p><textarea value={feedbackText} onChange={event => { setFeedbackText(event.target.value); setFeedbackPreview(false); }} maxLength={1200} placeholder="Optional feedback for the researcher" />{feedbackPreview && <><p><b>Preview before sending:</b></p><pre>{feedbackText}</pre></>}<div className="workbench-actions"><Button disabled={!feedbackText.trim()} onClick={() => setFeedbackPreview(true)}>Preview feedback</Button><Button kind="primary" disabled={!feedbackPreview || !feedbackText.trim()} onClick={() => void submitFeedback()}>Submit reviewed feedback</Button></div></details></>}</section>;

  const stageSummaries = gates.map((stage) =>
    summarizeStageResearch(state.telemetryEvents, state.stageFeedback, stage),
  );
  const totalDuration = stageSummaries.reduce(
    (sum, summary) => sum + summary.durationMs,
    0,
  );
  const averageAccuracy = state.stageFeedback.length
    ? Math.round(
        (state.stageFeedback.reduce(
          (sum, entry) => sum + entry.accuracyRating,
          0,
        ) /
          state.stageFeedback.length) *
          10,
      ) / 10
    : 0;
  const completionRate = state.stageFeedback.length
    ? Math.round(
        (state.stageFeedback.filter((entry) => entry.taskCompleted).length /
          state.stageFeedback.length) *
          100,
      )
    : 0;
  const exportCentralDataset = async () => {
    try {
      const data = await researchRequest("/api/v1/admin/export", "GET");
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "ba-mate-central-research-data.json");
      notify("The protected central research export has started. It excludes private workspace content and separately reviewed feedback.", "success");
    } catch (error) { setAccountError(error instanceof Error ? error.message : "The central research export could not be created."); }
  };
  const createRun = async () => {
    if (!caseCode.trim() || !participantCode.trim() || !runProject) { notify("Enter a case code, participant code and project before creating a run.", "warning"); return; }
    try {
      const settings = await api<{ model: string; configuration_signature: string }>("/api/settings");
      setState(current => ({ ...current, evaluationRuns: [...current.evaluationRuns, {
        id: uid("EVAL"), connectionSignature: settings.configuration_signature, projectId: runProject, caseId: caseCode.trim(), condition: runCondition, evaluatorCode: participantCode.trim(), datasetVersion: DATASET_VERSION, prototypeVersion: PROTOTYPE_VERSION, model: runCondition === "Manual" ? "none" : settings.model, promptVersion: PROMPT_VERSION, duration: "00:00", status: "Ready",
      }] }));
      notify("Evaluation run created. Model execution details will be recorded with each AI task.", "success");
    } catch (e) { notify((e as Error).message, "danger"); }
  };
  const updateRun = (runId: string) => {
    if (state.evaluationRuns.some(r => r.status === "Running" && r.id !== runId)) { notify("Complete the running evaluation before starting another.", "warning"); return; }
    const currentStatus = state.evaluationRuns.find(
      (run) => run.id === runId,
    )?.status;
    setState((current) => ({
      ...current,
      evaluationRuns: current.evaluationRuns.map((run) => {
        if (run.id !== runId) return run;
        if (run.status === "Ready")
          return {
            ...run,
            status: "Running",
            startedAt: new Date().toISOString(),
          };
        if (run.status === "Running") {
          const completedAt = new Date().toISOString();
          const milliseconds = run.startedAt
            ? Date.now() - new Date(run.startedAt).getTime()
            : 0;
          return {
            ...run,
            status: "Complete",
            completedAt,
            duration: formatDuration(milliseconds),
          };
        }
        return run;
      }),
    }));
    mockNotice(
      currentStatus === "Ready"
        ? "Stage timing and interaction observation are now associated with this run."
        : "The evaluation run was completed and its elapsed time was recorded.",
      "success",
      currentStatus === "Ready" ? "Evaluation started" : "Evaluation completed",
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="Research administrator only"
        title="Evaluation console"
        description="Pseudonymous task performance, workflow timing, participant ratings and reproducibility metadata."
        actions={
          <>
            <Button
              onClick={() => void signOut()}
            >
              <LockKeyhole size={16} /> Lock
            </Button>
            <Button onClick={() => void exportCentralDataset()}>
              <Download size={17} /> Export central dataset
            </Button>
            <Button kind="primary" onClick={() => setTab("runs")}>
              <Plus size={17} /> New run
            </Button>
          </>
        }
      />
      <div className="context-note">
        <ShieldCheck />
        <div>
          <b>Data minimization is active</b>
          <p>
            The console stores pseudonymous evaluator codes, stages, timings,
            interaction counts and ratings. Source, requirement and document
            content is excluded from research views and exports.
          </p>
        </div>
      </div>
      {accountError && <p className="form-error" role="alert">{accountError}</p>}
      <div className="research-tabs" role="tablist" aria-label="Research console">
        {([
          ["overview", "Overview"],
          ["stages", "Stage analytics"],
          ["feedback", "Participant feedback"],
          ["runs", "Runs & reproducibility"],
        ] as const).map(([value, label]) => (
          <button
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? "active" : ""}
            key={value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <div className="metric-row">
            <Metric
              label="Evaluation runs"
              value={state.evaluationRuns.length}
              detail={`${state.evaluationRuns.filter((run) => run.status === "Running").length} active`}
              tone="info"
            />
            <Metric
              label="Observed time"
              value={formatDuration(totalDuration)}
              detail="Across workflow stages"
            />
            <Metric
              label="Accuracy rating"
              value={averageAccuracy ? `${averageAccuracy}/5` : "—"}
              detail={`${state.stageFeedback.length} responses`}
              tone="success"
            />
            <Metric
              label="Task completion"
              value={state.stageFeedback.length ? `${completionRate}%` : "—"}
              detail="Participant reported"
            />
          </div>
          <Card title="Participant and collection administration" description="Pseudonymous account/consent status and accepted measurement batches only. This service cannot retrieve local BA projects.">
            <div className="workbench-controls"><label>Invite participant email<input type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="participant@example.org" /></label><Button kind="primary" disabled={!inviteEmail} onClick={() => void inviteParticipant()}>Create 72-hour invitation</Button><Button onClick={() => void loadAdministration()}>Refresh status</Button></div>
            {inviteResult && <p className="context-note warning">{inviteResult}</p>}
            <p>{participants.length} participant account(s) · {batches.length} accepted batch(es)</p>
            <div className="stage-analytics">{participants.map(participant => <div key={participant.account_code}><span><b>{participant.study_pseudonym ?? "Pseudonym pending"}</b><small>{participant.account_code.slice(0, 8)}</small></span><span><b>{participant.status}</b><small>account</small></span><span><b>{participant.consent_state ?? "No consent"}</b><small>collection consent</small></span>{participant.status === "active" && <Button kind="danger" onClick={() => { if (window.confirm(`Revoke ${participant.study_pseudonym ?? "this participant"}? Their local BA work will not be changed.`)) void revokeParticipant(participant.account_code); }}>Revoke</Button>}</div>)}</div>
            <details><summary>Accepted batch status</summary><ul>{batches.map((batch, index) => <li key={index}>{batch.study_pseudonym} · {batch.event_count} event(s) · {batch.consent_version} · {new Date(batch.received_at).toLocaleString()}</li>)}</ul></details>
            <details><summary>Separately submitted feedback ({feedbackEntries.length})</summary><p>Read this optional free text separately. It is deliberately excluded from ordinary research exports.</p>{feedbackEntries.map(entry => <div className="context-note" key={entry.feedback_id}><div><b>{entry.study_pseudonym} · {entry.review_state}</b><p>{entry.feedback_text}</p>{entry.review_state === "unreviewed" || entry.review_state === "withdrawal_requested" ? <div className="workbench-actions"><Button onClick={() => void reviewFeedback(entry.feedback_id, "reviewed")}>Mark reviewed</Button><Button kind="danger" onClick={() => void reviewFeedback(entry.feedback_id, "withheld")}>Withhold</Button></div> : null}</div></div>)}</details>
            <details><summary>Independent quality assessment ({qualityAssessments.length})</summary><p>Record the researcher rubric score and optional correction effort separately from participant self-ratings. No project content or free-text assessment note is collected.</p><div className="workbench-controls"><label>Accepted pseudonymous run<select value={qualityRunKey} onChange={event => setQualityRunKey(event.target.value)}><option value="">Select run</option>{remoteRuns.map(run => <option key={`${run.study_pseudonym}/${run.run_code}`} value={`${run.study_pseudonym}/${run.run_code}`}>{run.study_pseudonym} · {run.run_code} · {run.run_condition}</option>)}</select></label><label>Independent quality (1–5)<select value={qualityScore} onChange={event => setQualityScore(event.target.value)}>{[1,2,3,4,5].map(score => <option key={score} value={score}>{score}</option>)}</select></label><label>Correction effort, minutes (optional)<input type="number" min="0" max="1440" value={correctionEffort} onChange={event => setCorrectionEffort(event.target.value)} /></label><Button kind="primary" disabled={!qualityRunKey} onClick={() => void recordQualityAssessment()}>Record assessment</Button></div><p>Instrument: {RESEARCH_INSTRUMENT_VERSION}</p><ul>{qualityAssessments.map(item => <li key={item.assessment_id}>{item.study_pseudonym} · {item.run_code} · quality {item.quality_score}/5 · correction effort {item.correction_effort_minutes ?? "not recorded"} minutes</li>)}</ul></details>
          </Card>
          <Card
            title="Project-level evaluation coverage"
            description="Counts only—project artifact content is never shown here."
          >
            <div className="project-research-grid">
              {state.projects.map((project) => {
                const events = state.telemetryEvents.filter(
                  (event) => event.projectId === project.id,
                );
                const feedback = state.stageFeedback.filter(
                  (entry) => entry.projectId === project.id,
                );
                const duration = events.reduce(
                  (sum, event) => sum + (event.durationMs ?? 0),
                  0,
                );
                return (
                  <div key={project.id}>
                    <i style={{ background: project.color }}>{project.name[0]}</i>
                    <span>
                      <b>{project.name}</b>
                      <small>{project.gate} stage</small>
                    </span>
                    <strong>{events.filter((event) => event.type === "interaction").length} actions</strong>
                    <strong>{formatDuration(duration)}</strong>
                    <strong>{feedback.length} ratings</strong>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
      {tab === "stages" && (
        <Card
          title="Workflow stage analytics"
          description="System-observed time and actions paired with participant-reported quality."
        >
          <div className="stage-analytics">
            {stageSummaries.map((summary) => (
              <div key={summary.stage}>
                <span>
                  <b>{summary.stage}</b>
                  <small>{summary.sessions} observed sessions</small>
                </span>
                <span>
                  <b>{formatDuration(summary.durationMs)}</b>
                  <small>{summary.interactions} interactions</small>
                </span>
                <span>
                  <b>{summary.accuracy ? `${summary.accuracy}/5` : "—"}</b>
                  <small>Accuracy</small>
                </span>
                <span>
                  <b>{summary.usability ? `${summary.usability}/5` : "—"}</b>
                  <small>Usability</small>
                </span>
                <span>
                  <b>{summary.feedbackCount ? `${summary.completionRate}%` : "—"}</b>
                  <small>Completion</small>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {tab === "feedback" && (
        <Card
          title="Participant feedback"
          description="Anonymous stage ratings and optional qualitative comments."
        >
          {state.stageFeedback.length ? (
            <div className="feedback-table">
              <div className="table-head">
                <span>Evaluator</span>
                <span>Stage</span>
                <span>Accuracy</span>
                <span>Useful</span>
                <span>Usability</span>
                <span>Confidence</span>
                <span>Completed</span>
                <span>Comment</span>
              </div>
              {[...state.stageFeedback].reverse().map((entry) => (
                <div key={entry.id}>
                  <code>{entry.evaluatorCode}</code>
                  <b>{entry.stage}</b>
                  <span>{entry.accuracyRating}/5</span>
                  <span>{entry.usefulnessRating}/5</span>
                  <span>{entry.usabilityRating}/5</span>
                  <span>{entry.confidenceRating}/5</span>
                  <StatusBadge value={entry.taskCompleted ? "Complete" : "Incomplete"} />
                  <p>{entry.comment || "No comment"}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BarChart3 />}
              title="No participant feedback yet"
              description="Responses appear after a participant submits ratings from a project’s Stage evaluation tab."
            />
          )}
        </Card>
      )}
      {tab === "runs" && (
        <Card
          title="Evaluation runs"
          description="Manual, generic-AI and proposed-workflow conditions with reproducibility versions."
        >
          <div className="workbench-controls">
            <label>Case code<input value={caseCode} onChange={e => setCaseCode(e.target.value)} placeholder="CASE-01" /></label>
            <label>Participant code<input value={participantCode} onChange={e => setParticipantCode(e.target.value)} placeholder="BA-001" /></label>
            <label>Project<select value={runProject} onChange={e => setRunProject(e.target.value)}>{state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label>Condition<select value={runCondition} onChange={e => setRunCondition(e.target.value as typeof runCondition)}><option>Manual</option><option>Generic AI</option><option>Proposed workflow</option></select></label>
            <Button onClick={() => void createRun()}>Create configured run</Button>
          </div>
          <div className="evaluation-table research-runs-table">
            <div className="table-head">
              <span>Run</span>
              <span>Case</span>
              <span>Condition</span>
              <span>Evaluator</span>
              <span>Versions</span>
              <span>Duration</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {[...state.evaluationRuns].reverse().map((run) => (
              <div key={run.id}>
                <b>{run.id}</b>
                <span>{run.caseId}</span>
                <span>{run.condition}</span>
                <code>{run.evaluatorCode}</code>
                <span>
                  <small>
                    {run.datasetVersion} · {run.promptVersion}
                    <br />
                    {run.model}
                  </small>
                </span>
                <b>{run.duration}</b>
                <StatusBadge value={run.status} />
                {run.status === "Complete" ? (
                  <span>Locked</span>
                ) : (
                  <Button
                    kind={run.status === "Running" ? "secondary" : "primary"}
                    onClick={() => updateRun(run.id)}
                  >
                    {run.status === "Ready" ? "Start" : "Complete"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function RecentWork({ state }: { state: WorkspaceState }) {
  const navigate = useNavigate();
  const items = state.projects
    .flatMap((project) =>
      project.audit.slice(0, 6).map((event) => ({ project, event })),
    )
    .slice(0, 18);
  return (
    <>
      <PageHeader
        eyebrow="BA Mate workspace"
        title="Recent work"
        description="Continue the latest governed edits, reviews and project decisions across local workspaces."
      />
      {items.length ? (
        <div className="recent-work-layout">
          <Card
            title="Workspace activity"
            description="The newest auditable events from every local project."
          >
            <div className="recent-activity-list">
              {items.map(({ project, event }) => (
                <button
                  key={project.id + "-" + event.id}
                  onClick={() =>
                    navigate("/projects/" + project.id + "/activity")
                  }
                >
                  <i style={{ background: project.color }}>{project.name[0]}</i>
                  <span>
                    <b>{event.action}</b>
                    <small>
                      {project.name} · {event.object} · {event.at}
                    </small>
                  </span>
                  <ChevronRight />
                </button>
              ))}
            </div>
          </Card>
          <Card
            title="Continue projects"
            description="Open the active goal for any workspace."
          >
            <div className="continue-project-list">
              {state.projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() =>
                    navigate("/projects/" + project.id + "/overview")
                  }
                >
                  <span>
                    <b>{project.name}</b>
                    <small>
                      {activeGoal(project)?.title ?? "Project setup"} ·{" "}
                      {project.gate}
                    </small>
                  </span>
                  <StatusBadge value={project.gate} />
                </button>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <EmptyState
          icon={<Clock3 />}
          title="No recent work yet"
          description="Create or open a project to begin recording governed activity."
          action={
            <Button kind="primary" onClick={() => navigate("/projects")}>
              Explore projects
            </Button>
          }
        />
      )}
    </>
  );
}

const workspaceTemplates = [
  {
    id: "retail-banking",
    name: "Retail banking discovery",
    domain: "Retail banking",
    description:
      "Responsible discovery with fairness, privacy, accessibility and human-review gates.",
    governance: ["Core responsible BA", "Financial services fairness"],
    icon: <ShieldCheck />,
  },
  {
    id: "people-operations",
    name: "People operations workflow",
    domain: "People operations",
    description:
      "Employee-service analysis with workforce privacy and delegated approval controls.",
    governance: ["Core responsible BA", "Workforce privacy"],
    icon: <Users />,
  },
  {
    id: "product-change",
    name: "Controlled product change",
    domain: "Digital product",
    description:
      "Traceable change impact, requirement updates and document synchronization.",
    governance: ["Core responsible BA", "Consumer fairness"],
    icon: <RefreshCw />,
  },
] as const;

function WorkspaceTemplates({
  setState,
}: {
  setState: Dispatch<SetStateAction<WorkspaceState>>;
}) {
  const navigate = useNavigate();
  const useTemplate = (template: (typeof workspaceTemplates)[number]) => {
    const project = JSON.parse(
      JSON.stringify(freshState().projects[0]),
    ) as Project;
    project.id = template.id + "-" + Date.now().toString(36);
    project.name = template.name;
    project.domain = template.domain;
    project.description = template.description;
    project.folderName = "BA-Mate/" + project.id + "-workspace";
    project.template = template.name;
    project.governancePacks = [...template.governance];
    prepareFreshProject(project);
    project.sources = [];
    project.audit = [
      {
        id: uid("EV"),
        at: new Date().toISOString(),
        actor: "Business analyst",
        action: "Created project from template",
        object: project.id,
        detail: template.name + " structure and governance defaults applied.",
      },
    ];
    setState((current) => ({
      ...current,
      projects: [project, ...current.projects],
    }));
    mockNotice(
      `${template.name} was created without copying any project evidence.`,
      "success",
      "Template workspace created",
    );
    navigate("/projects/" + project.id + "/overview");
  };
  return (
    <>
      <PageHeader
        eyebrow="Reusable BA structures"
        title="Templates"
        description="Start a clean local workspace with consistent workflow and governance defaults."
      />
      <div className="template-grid">
        {workspaceTemplates.map((template) => (
          <article key={template.id}>
            <i>{template.icon}</i>
            <StatusBadge value={template.domain} />
            <h2>{template.name}</h2>
            <p>{template.description}</p>
            <div>
              {template.governance.map((pack) => (
                <Badge key={pack}>{pack}</Badge>
              ))}
            </div>
            <Button kind="primary" onClick={() => useTemplate(template)}>
              <Plus /> Use template
            </Button>
          </article>
        ))}
      </div>
      <div className="context-note">
        <Layers3 />
        <div>
          <b>Templates never copy project evidence</b>
          <p>
            New workspaces receive structure and safeguards only. Sources,
            conversations, artifacts and research observations start empty.
          </p>
        </div>
      </div>
    </>
  );
}

function WorkspaceSettings({
  state,
  setState,
}: {
  state: WorkspaceState;
  setState: Dispatch<SetStateAction<WorkspaceState>>;
}) {
  const [reducedMotion, setReducedMotion] = useState(
    () => localStorage.getItem("ba-mate-reduced-motion") === "true",
  );
  const [comfortable, setComfortable] = useState(
    () => localStorage.getItem("ba-mate-comfortable-density") === "true",
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [backupProjectId, setBackupProjectId] = useState(state.projects[0]?.id ?? "");
  const restoreInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    localStorage.setItem("ba-mate-reduced-motion", String(reducedMotion));
    localStorage.setItem("ba-mate-comfortable-density", String(comfortable));
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
    document.documentElement.dataset.density = comfortable
      ? "comfortable"
      : "compact";
  }, [reducedMotion, comfortable]);
  const exportWorkspace = () => {
    downloadBlob(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
      "ba-mate-local-workspace-backup.json",
    );
    mockNotice(
      "The complete local workspace backup download has started.",
      "success",
      "Backup exported",
    );
  };
  const exportProjectBackup = async () => {
    const project = state.projects.find((item) => item.id === backupProjectId);
    if (!project) return;
    try {
      downloadBlob(await repository.exportProject(project), `${project.id}-ba-mate-backup.zip`);
      mockNotice(`A complete backup of ${project.name} is downloading. It includes its sources, artifacts, audit history and baselines.`, "success", "Project backup exported");
    } catch (error) {
      mockNotice(error instanceof Error ? error.message : "The project backup could not be created.", "danger", "Backup failed");
    }
  };
  const restoreProjectBackup = async (file?: File) => {
    if (!file) return;
    try {
      const restored = await repository.importProject(file);
      setState((current) => ({ ...current, projects: [restored, ...current.projects] }));
      mockNotice(`${restored.name} was restored as a separate local project. Existing work was not replaced.`, "success", "Project restored");
    } catch (error) {
      mockNotice(error instanceof Error ? error.message : "The selected backup is not valid.", "danger", "Restore failed");
    } finally {
      if (restoreInput.current) restoreInput.current.value = "";
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Local prototype configuration"
        title="Settings"
        description="Choose your AI connection, manage workspace backups and adjust display preferences."
        actions={
          <Button onClick={exportWorkspace}>
            <Download /> Export local backup
          </Button>
        }
      />
      <div className="settings-grid">
        <Card
          title="Accessibility & display"
          description="Preferences apply immediately and remain on this device."
        >
          <div className="setting-list">
            <label>
              <span>
                <b>Reduce motion</b>
                <small>Disables non-essential transitions and animations.</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={reducedMotion}
                onChange={(event) => setReducedMotion(event.target.checked)}
              />
            </label>
            <label>
              <span>
                <b>Comfortable density</b>
                <small>Adds more space to navigation and editor controls.</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={comfortable}
                onChange={(event) => setComfortable(event.target.checked)}
              />
            </label>
          </div>
        </Card>
        <ModelSettings />
        <Card
          title="Local data"
          description="The local BA Mate service saves workspace revisions in a database on this computer."
        >
          <div className="local-data-summary">
            <div>
              <b>{state.projects.length}</b>
              <span>Projects</span>
            </div>
            <div>
              <b>{state.telemetryEvents.length}</b>
              <span>Metric events</span>
            </div>
            <div>
              <b>{state.stageFeedback.length}</b>
              <span>Feedback records</span>
            </div>
          </div>
          <div className="setting-list">
            <label>
              <span>
                <b>Project backup</b>
                <small>Creates a portable ZIP containing the selected project’s originals, artifacts, audit history and baselines.</small>
              </span>
              <select value={backupProjectId} onChange={(event) => setBackupProjectId(event.target.value)}>
                {state.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <div className="page-actions">
              <Button onClick={exportProjectBackup} disabled={!backupProjectId}>
                <Download /> Export project backup
              </Button>
              <input ref={restoreInput} type="file" accept=".zip,application/zip,application/x-zip-compressed" hidden onChange={(event) => void restoreProjectBackup(event.target.files?.[0])} />
              <Button onClick={() => restoreInput.current?.click()}>
                <Upload /> Restore project backup
              </Button>
            </div>
            <small>Restoring validates the package first and adds a separate project; it never overwrites current work.</small>
          </div>
          <Button
            kind="danger"
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw /> Reset demonstration data
          </Button>
        </Card>
      </div>
      {confirmReset && (
        <ConfirmDialog
          title="Reset demonstration data?"
          description="All current local workspace changes and research observations will be replaced with the original demonstration dataset. Export a backup first if you need to retain them."
          confirmLabel="Reset local data"
          confirmIcon={<RotateCcw size={16} />}
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            setState(freshState());
            setConfirmReset(false);
            mockNotice(
              "The original demonstration workspace has been restored.",
              "success",
            );
          }}
        />
      )}
    </>
  );
}

function GlobalWorkspacePage({
  page,
  state,
  setState,
}: {
  page: string;
  state: WorkspaceState;
  setState: Dispatch<SetStateAction<WorkspaceState>>;
}) {
  if (page === "templates")
    return <WorkspaceTemplates setState={setState} />;
  if (page === "settings")
    return <WorkspaceSettings state={state} setState={setState} />;
  if (page === "recent") return <RecentWork state={state} />;
  return <NotFoundPage scope="page" />;
}

function NotFoundPage({
  scope,
}: {
  scope: "page" | "project" | "section";
}) {
  const navigate = useNavigate();
  const copy =
    scope === "project"
      ? {
          eyebrow: "Project unavailable",
          title: "This project could not be found",
          description:
            "It may have been deleted, imported under another identifier, or opened from an outdated local link.",
        }
      : scope === "section"
        ? {
            eyebrow: "Workspace section unavailable",
            title: "This project section does not exist",
            description:
              "Use the project navigation to open an available governed workspace section.",
          }
        : {
            eyebrow: "Page unavailable",
            title: "This BA Mate page does not exist",
            description:
              "The address may be incomplete or refer to an older prototype route.",
          };
  return (
    <div className="not-found-page">
      <span className="eyebrow">{copy.eyebrow}</span>
      <div className="empty-state">
        <CircleHelp />
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <Button kind="primary" onClick={() => navigate("/projects")}>
          <Home size={16} /> Back to projects
        </Button>
      </div>
    </div>
  );
}

function prepareFreshProject(project: Project) {
  project.health = 0;
  project.aiRuns = [];
  project.cloudAllowed = false;
  project.members = [{ id: "MEM-01", name: "Business analyst", initials: "BA", role: "Owner / Lead BA", approval: true, status: "Active" }];
  project.gate = "Setup";
  project.gateIndex = 0;
  project.activeGoalId = undefined;
  project.requirements = [];
  project.stories = [];
  project.registers = [];
  project.traceLinks = [];
  project.checks = [];
  project.diagrams = [];
  project.documents = [];
  project.documentSyncProposals = [];
  project.changes = [];
  project.clarifications = [];
  project.conversations = [];
  project.goals = [];
  project.versions = [];
  project.audit = project.audit.filter(
    (event) =>
      event.action === "Created project" ||
      event.action === "Applied BA Mate project context" ||
      event.action === "Analyzed knowledge base" ||
      event.action === "Configured governance pack",
  );
  return project;
}

function ProjectKickoff({
  project,
  update,
  onStarted,
  onCancel,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
  onStarted?: () => void;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<
    | "New discovery"
    | "Improve existing documentation"
    | "Requirements addendum"
    | "New deliverable"
  >("New discovery");
  const [description, setDescription] = useState("");
  const [describeOpen, setDescribeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState("");
  const kickoffRef = useRef<HTMLDivElement>(null);
  const describeRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(kickoffRef, () => onCancel?.(), !describeOpen);
  useDialogAccessibility(
    describeRef,
    () => setDescribeOpen(false),
    describeOpen,
  );
  const options: [typeof kind, string, string][] = [
    [
      "New discovery",
      "Start from new material",
      "Discover scope, stakeholders, requirements and safeguards from the project context.",
    ],
    [
      "Improve existing documentation",
      "Improve existing SRS / stories",
      "Review available documentation, find gaps and create controlled improvements.",
    ],
    [
      "Requirements addendum",
      "Create an addendum",
      "Define a later scope change without overwriting the approved baseline.",
    ],
    [
      "New deliverable",
      "Create a separate deliverable",
      "Run a distinct deliverable stream inside this project.",
    ],
  ];
  const start = () => {
    update((p) => {
      p.goals.forEach((existing) => {
        if (existing.status === "Active") existing.status = "Planned";
      });
      const goalId = uid("GOAL");
      const conversationId = uid("CONV");
      const sourceIds = p.sources
        .filter((source) => source.approved)
        .map((source) => source.id);
      const goal: ProjectGoal = {
        id: goalId,
        title: kind === "New discovery" ? "Initial project discovery" : kind,
        kind,
        status: "Active",
        description:
          description.trim() || options.find((x) => x[0] === kind)![2],
        createdAt: "Just now",
        gate: "Setup",
        gateIndex: 0,
        conversationId,
        sourceIds,
        deliverables: [],
      };
      p.goals.push(goal);
      p.activeGoalId = goal.id;
      p.gate = "Setup";
      p.gateIndex = 0;
      p.conversations.unshift({
        id: conversationId,
        title: goal.title,
        context: p.sources
          .filter((source) => sourceIds.includes(source.id))
          .map((source) => ({
            id: source.id,
            type: "Source" as const,
            label: source.name,
            origin: "automatic" as const,
            removable: true,
            route: "sources",
          })),
        updated: "Just now",
        messages: [
          {
            id: uid("MSG"),
            role: "assistant",
            text: `Goal setup complete. No AI analysis has run yet. Your active goal is “${goal.title}”. Its Setup → Discover → Clarify → Define → Validate → Approve workflow is now isolated from other project goals.`,
          },
        ],
      });
      addAudit(
        p,
        "Started project goal",
        goal.id,
        `${goal.kind}: ${goal.description}`,
      );
    });
    onStarted?.();
  };
  return (
    <div className="modal-backdrop kickoff-backdrop" role="presentation">
      <div
        ref={kickoffRef}
        className="modal large kickoff-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create a project goal"
      >
        <header>
          <div>
            <span className="eyebrow">
              BA Mate · Initial project conversation
            </span>
            <h2>What should we work on first?</h2>
            <p>
              Choose an initial goal, or describe it to BA Mate to receive and
              apply a proposed setup.
            </p>
          </div>
          {onCancel && (
            <IconButton label="Close goal creation" onClick={onCancel}>
              <X size={18} />
            </IconButton>
          )}
        </header>
        <div className="modal-body">
          <div className="context-note">
            <Sparkles />
            <div>
              <b>Review sources before AI analysis</b>
              <p>
                {project.sources.length
                  ? `${project.sources.length} source${project.sources.length === 1 ? "" : "s"} can inform this goal.`
                  : "This is a fresh workspace; begin from scratch or add material later."}
              </p>
            </div>
          </div>
          <div className="kickoff-options">
            {options.map(([value, title, detail]) => (
              <button
                key={value}
                className={kind === value ? "selected" : ""}
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
              >
                <i>
                  {value === "New discovery" ? (
                    <Search />
                  ) : value === "Improve existing documentation" ? (
                    <FileText />
                  ) : value === "Requirements addendum" ? (
                    <FilePlus2 />
                  ) : (
                    <Boxes />
                  )}
                </i>
                <span>
                  <b>{title}</b>
                  <small>{detail}</small>
                </span>
                {kind === value && <CheckCircle2 size={17} />}
              </button>
            ))}
          </div>
          <div className="ba-mate-action">
            <div>
              <Sparkles size={19} />
              <span>
                <b>Describe this goal to BA Mate</b>
                <small>
                  {description
                    ? "BA Mate’s goal setup is ready to start."
                    : "Ask BA Mate to interpret the goal and choose the appropriate workflow."}
                </small>
              </span>
            </div>
            <Button
              kind="primary"
              onClick={() => {
                setDraft(description);
                setReply("");
                setDescribeOpen(true);
              }}
            >
              <Sparkles size={16} /> Describe to BA Mate
            </Button>
          </div>
        </div>
        <footer>
          <span className="kickoff-note">
            <ShieldCheck size={15} /> This creates one active goal; future
            addenda and deliverables remain separate goals.
          </span>
          <div className="modal-footer-actions">
            {onCancel && <Button onClick={onCancel}>Cancel</Button>}
            <Button kind="primary" onClick={start}>
              <Sparkles size={16} /> Start this goal
            </Button>
          </div>
        </footer>
        {describeOpen && (
          <div className="ba-mate-dialog" role="presentation">
            <div
              ref={describeRef}
              className="ba-mate-dialog-card"
              role="dialog"
              aria-modal="true"
              aria-label="Describe the goal to BA Mate"
            >
              <header>
                <div>
                  <Badge tone="purple">BA Mate</Badge>
                  <h3>Describe the goal</h3>
                  <p>
                    Explain the outcome, existing documentation, required
                    addendum, or separate deliverable.
                  </p>
                </div>
                <IconButton
                  label="Close BA Mate"
                  onClick={() => setDescribeOpen(false)}
                >
                  <X />
                </IconButton>
              </header>
              {!reply ? (
                <>
                  <textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Example: Review and improve our existing SRS and user stories before the next release."
                  />
                  <footer>
                    <Button onClick={() => setDescribeOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      kind="primary"
                      disabled={!draft.trim()}
                      onClick={() => {
                        const value = draft.toLowerCase();
                        const proposed = value.includes("addendum")
                          ? "Requirements addendum"
                          : /srs|document|story|improve|fix/.test(value)
                            ? "Improve existing documentation"
                            : /deliverable|report|specification/.test(value)
                              ? "New deliverable"
                              : "New discovery";
                        setKind(proposed);
                        setReply(
                          `BA Mate recommends “${proposed}”. This will stay as a separate, auditable project goal and will not change governed artifacts until you approve changes.`,
                        );
                      }}
                    >
                      <Sparkles size={16} /> Ask BA Mate
                    </Button>
                  </footer>
                </>
              ) : (
                <>
                  <div className="ba-mate-response">
                    <Sparkles size={19} />
                    <div>
                      <b>BA Mate response</b>
                      <p>{reply}</p>
                    </div>
                  </div>
                  <footer>
                    <Button onClick={() => setReply("")}>
                      Edit description
                    </Button>
                    <Button
                      kind="primary"
                      onClick={() => {
                        setDescription(draft);
                        setDescribeOpen(false);
                      }}
                    >
                      <Check size={16} /> Apply goal setup
                    </Button>
                  </footer>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GoalsView({
  project,
  update,
  go,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
  go: (section: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectGoal>();
  const current = activeGoal(project);
  const activate = (goalId: string) =>
    update((p) => {
      p.goals.forEach((goal) => {
        if (goal.status === "Active") goal.status = "Planned";
      });
      const goal = p.goals.find((item) => item.id === goalId);
      if (!goal) return;
      goal.status = "Active";
      p.activeGoalId = goal.id;
      p.gate = goal.gate;
      p.gateIndex = goal.gateIndex;
      addAudit(
        p,
        "Activated project goal",
        goal.id,
        `${goal.title} is now the active workflow context.`,
      );
    });
  const complete = (goalId: string) =>
    update((p) => {
      const goal = p.goals.find((item) => item.id === goalId);
      if (!goal) return;
      goal.status = "Completed";
      goal.gate = "Approve";
      goal.gateIndex = gates.length - 1;
      if (p.activeGoalId === goalId) p.activeGoalId = undefined;
      addAudit(
        p,
        "Completed project goal",
        goal.id,
        `${goal.title} completed at the Approve gate.`,
      );
    });
  const deleteGoal = (goal: ProjectGoal) =>
    update((p) => {
      const removedDeliverableIds = new Set(goal.deliverables);
      p.goals = p.goals.filter((item) => item.id !== goal.id);
      p.clarifications = p.clarifications.filter(
        (item) => item.goalId !== goal.id,
      );
      p.requirements = p.requirements.filter((item) => item.goalId !== goal.id);
      p.stories = p.stories.filter((item) => item.goalId !== goal.id);
      p.registers = p.registers.filter((item) => item.goalId !== goal.id);
      p.traceLinks = p.traceLinks.filter((item) => item.goalId !== goal.id);
      p.checks = p.checks.filter((item) => item.goalId !== goal.id);
      p.diagrams = p.diagrams.filter((item) => item.goalId !== goal.id);
      p.documents = p.documents.filter((item) => item.goalId !== goal.id);
      p.changes = p.changes.filter((item) => item.goalId !== goal.id);
      p.documentSyncProposals = p.documentSyncProposals.filter(
        (item) =>
          !item.targetDocumentId ||
          !removedDeliverableIds.has(item.targetDocumentId),
      );
      if (goal.conversationId)
        p.conversations = p.conversations.filter(
          (item) => item.id !== goal.conversationId,
        );

      if (p.activeGoalId === goal.id) {
        const nextGoal =
          p.goals.find((item) => item.status === "Active") ??
          p.goals.find((item) => item.status === "Planned");
        if (nextGoal) {
          nextGoal.status = "Active";
          p.activeGoalId = nextGoal.id;
          p.gate = nextGoal.gate;
          p.gateIndex = nextGoal.gateIndex;
        } else {
          p.activeGoalId = undefined;
          p.gate = "Setup";
          p.gateIndex = 0;
        }
      }
      addAudit(
        p,
        "Deleted project goal",
        goal.id,
        "Removed goal-specific conversations and scoped artifacts. Shared sources and governance were retained.",
      );
    });
  return (
    <>
      <PageHeader
        eyebrow="Project → goals → governed workflows"
        title="Goals"
        description="Each goal owns its conversation context and six-stage workflow while sharing the project knowledge base and governance."
        actions={
          <Button kind="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> New goal
          </Button>
        }
      />
      <div className="goal-hierarchy">
        <div className="hierarchy-project">
          <FolderKanban />
          <span>
            <b>{project.name}</b>
            <small>
              {project.goals.length} goal{project.goals.length === 1 ? "" : "s"}{" "}
              · {project.sources.length} project sources
            </small>
          </span>
        </div>
        <ChevronDown />
        <div className="hierarchy-branches">
          {project.goals.map((goal) => (
            <article
              key={goal.id}
              className={classNames(
                "goal-card",
                goal.id === current?.id && "active",
              )}
            >
              <header>
                <div>
                  <i>
                    <Boxes />
                  </i>
                  <span>
                    <b>{goal.title}</b>
                    <small>{goal.kind}</small>
                  </span>
                </div>
                <div className="goal-card-actions">
                  <StatusBadge value={goal.status} />
                  <IconButton
                    label={`Delete ${goal.title}`}
                    className="delete-goal-button"
                    onClick={() => setPendingDelete(goal)}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </header>
              <p>{goal.description}</p>
              <div className="goal-workflow-mini">
                {gates.map((gate, index) => (
                  <span
                    key={gate}
                    className={classNames(
                      index < goal.gateIndex && "complete",
                      index === goal.gateIndex && "current",
                    )}
                    title={gate}
                  >
                    {index < goal.gateIndex ? <Check size={12} /> : index + 1}
                  </span>
                ))}
              </div>
              <dl>
                <div>
                  <dt>Current gate</dt>
                  <dd>{goal.gate}</dd>
                </div>
                <div>
                  <dt>Context</dt>
                  <dd>{goal.sourceIds.length} sources</dd>
                </div>
                <div>
                  <dt>Deliverables</dt>
                  <dd>{goal.deliverables.length}</dd>
                </div>
              </dl>
              <footer>
                {goal.status !== "Active" && goal.status !== "Completed" && (
                  <Button onClick={() => activate(goal.id)}>Make active</Button>
                )}
                {goal.status === "Active" && (
                  <Button kind="primary" onClick={() => go("workflow")}>
                    Open workflow <ArrowRight size={15} />
                  </Button>
                )}
                {goal.status !== "Completed" && (
                  <Button kind="ghost" onClick={() => complete(goal.id)}>
                    Mark complete
                  </Button>
                )}
              </footer>
            </article>
          ))}
        </div>
      </div>
      {project.goals.length === 0 && (
        <EmptyState
          icon={<Boxes />}
          title="No goals yet"
          description="Start the initial BA Mate conversation to create a goal and its workflow."
          action={
            <Button kind="primary" onClick={() => setCreating(true)}>
              Start first goal
            </Button>
          }
        />
      )}{" "}
      {creating && (
        <ProjectKickoff
          project={project}
          update={update}
          onStarted={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete “${pendingDelete.title}”?`}
          description="Its dedicated conversation and goal-specific artifacts will be removed. Shared project sources and governance settings will remain available to other goals."
          confirmLabel="Delete goal"
          onCancel={() => setPendingDelete(undefined)}
          onConfirm={() => {
            deleteGoal(pendingDelete);
            setPendingDelete(undefined);
            mockNotice("The project goal and its scoped work were deleted.", "success");
          }}
        />
      )}
    </>
  );
}

function NewProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (project: Project) => void;
}) {
  type TemplateName =
    | "Financial services"
    | "People & workplace"
    | "Commerce & customer"
    | "Public service"
    | "Digital product"
    | "Blank";
  const templates: Record<
    TemplateName,
    {
      description: string;
      icon: ReactNode;
      seed: number;
      domain: string;
      pack: string;
    }
  > = {
    "Financial services": {
      description: "Fair, explainable decisions with controlled exceptions.",
      icon: <ShieldCheck />,
      seed: 0,
      domain: "Financial services",
      pack: "Financial services fairness",
    },
    "People & workplace": {
      description: "Workforce privacy, access and inclusive employee journeys.",
      icon: <Users />,
      seed: 1,
      domain: "People operations",
      pack: "Workforce privacy",
    },
    "Commerce & customer": {
      description: "Customer outcomes, evidence handling and service recovery.",
      icon: <Archive />,
      seed: 2,
      domain: "Commerce & customer",
      pack: "Consumer fairness",
    },
    "Public service": {
      description:
        "Accessible, accountable services for citizens and case teams.",
      icon: <BookOpen />,
      seed: 1,
      domain: "Public service",
      pack: "Public sector accessibility",
    },
    "Digital product": {
      description:
        "Responsible product discovery, delivery and measurable outcomes.",
      icon: <Code2 />,
      seed: 2,
      domain: "Digital product",
      pack: "Product data responsibility",
    },
    Blank: {
      description:
        "Start with core safeguards and shape the workspace yourself.",
      icon: <Plus />,
      seed: 0,
      domain: "General",
      pack: "Project-defined safeguards",
    },
  };
  const [step, setStep] = useState(1);
  const [name, setName] = useState("New BA project");
  const [template, setTemplate] = useState<TemplateName>("Financial services");
  const [folder, setFolder] = useState("BA-Mate/new-project");
  const [projectBrief, setProjectBrief] = useState("");
  const [assist, setAssist] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [policyPacks, setPolicyPacks] = useState<string[]>([
    "Core responsible BA",
    "Privacy & data handling",
    "Human oversight & traceability",
  ]);
  const [aiDialog, setAiDialog] = useState<"project" | "governance" | null>(
    null,
  );
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiProposal, setAiProposal] = useState<{
    template: TemplateName;
    safeguards: string[];
    summary: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const aiDialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(modalRef, onClose, !aiDialog);
  useDialogAccessibility(
    aiDialogRef,
    () => setAiDialog(null),
    Boolean(aiDialog),
  );
  const meta = templates[template];
  const aiSuggestions = useMemo(() => {
    const context = `${template} ${projectBrief}`.toLowerCase();
    const suggestions = ["Evidence provenance & traceability"];
    if (/health|student|public|access|inclusive|disab/.test(context))
      suggestions.push("Accessibility & inclusive service design");
    if (/bank|finance|credit|decision|hr|people|employee|student/.test(context))
      suggestions.push("Human review for consequential decisions");
    if (/data|personal|customer|employee|student|privacy/.test(context))
      suggestions.push("Data minimization & retention review");
    return suggestions;
  }, [template, projectBrief]);
  const [extractedFiles, setExtractedFiles] = useState<Record<string, Awaited<ReturnType<typeof importSource>>>>({});
  const addFiles = async (selected: FileList | null) => {
    if (!selected?.length) return;
    setAnalysing(true); setAnalysisComplete(false);
    try {
      for (const file of Array.from(selected)) {
        const result = await importSource(file);
        setExtractedFiles(current => ({ ...current, [file.name]: result }));
        setFiles(current => [...current.filter(existing => existing.name !== file.name), file]);
      }
      setAnalysisComplete(true);
    } catch (e) { notify((e as Error).message, "danger", "Source import failed"); }
    finally { setAnalysing(false); }
  };
  const removeFile = (fileName: string) =>
    setFiles((current) => current.filter((file) => file.name !== fileName));
  const chooseFolder = async () => {
    const picker = (
      window as unknown as {
        showDirectoryPicker?: () => Promise<{ name: string }>;
      }
    ).showDirectoryPicker;
    if (!picker) {
      mockNotice(
        "Folder selection is unavailable in this browser. You can still set a local workspace path.",
      );
      return;
    }
    try {
      const handle = await picker();
      setFolder(handle.name);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      mockNotice(
        error instanceof Error
          ? error.message
          : "The folder could not be selected.",
        "danger",
        "Folder selection failed",
      );
    }
  };
  const describeToBaMate = (mode: "project" | "governance") => {
    setAiPrompt(mode === "project" ? projectBrief : "");
    setAiProposal(null);
    setAiDialog(mode);
  };
  const generateAiProposal = () => {
    const context = aiPrompt.toLowerCase();
    let recommended: TemplateName = "Blank";
    if (/bank|finance|loan|credit|payment|insurance/.test(context))
      recommended = "Financial services";
    else if (/employee|hr|workplace|leave|recruit|staff/.test(context))
      recommended = "People & workplace";
    else if (/shop|retail|customer|order|return|commerce/.test(context))
      recommended = "Commerce & customer";
    else if (
      /student|citizen|government|public|university|health/.test(context)
    )
      recommended = "Public service";
    else if (/app|platform|software|digital|saas|product/.test(context))
      recommended = "Digital product";
    const safeguards = ["Evidence provenance & traceability"];
    if (/personal|data|privacy|patient|student|employee|customer/.test(context))
      safeguards.push("Data minimization & retention review");
    if (/decision|approve|eligib|loan|hr|student/.test(context))
      safeguards.push("Human review for consequential decisions");
    if (/access|student|public|health|inclusive|disab/.test(context))
      safeguards.push("Accessibility & inclusive service design");
    setAiProposal({
      template: recommended,
      safeguards,
      summary:
        aiDialog === "project"
          ? `Template rules matched this brief to the ${recommended} foundation and prepared a project starting point.`
          : `Template rules identified ${safeguards.length} governance safeguards that can be added to this project.`,
    });
  };
  const applyAiProposal = () => {
    if (!aiProposal || !aiDialog) return;
    if (aiDialog === "project") {
      setProjectBrief(aiPrompt);
      setTemplate(aiProposal.template);
      setPolicyPacks((current) => [
        ...new Set([...current, ...aiProposal.safeguards]),
      ]);
      if (aiProposal.template === "Blank")
        mockNotice(
          "BA Mate created a blank foundation because the description did not match a guided template.",
        );
      else
        mockNotice(
          `BA Mate applied the ${aiProposal.template} foundation to your project.`,
        );
    } else {
      setPolicyPacks((current) => [
        ...new Set([...current, ...aiProposal.safeguards]),
      ]);
      setProjectBrief((current) => current || aiPrompt);
      mockNotice(
        "BA Mate added its governance recommendations to the editable policy pack.",
      );
    }
    setAiDialog(null);
  };
  const create = () => {
    const p = JSON.parse(
      JSON.stringify(freshState().projects[meta.seed]),
    ) as Project;
    p.id = `project-${Date.now()}`;
    p.name = name.trim() || "Untitled BA project";
    p.domain = meta.domain;
    p.description =
      projectBrief.trim() ||
      `A ${meta.domain.toLowerCase()} project created with the ${template} template.`;
    p.folderName = folder.trim() || "BA-Mate/new-project";
    p.gate = "Setup";
    p.gateIndex = 0;
    p.template = template;
    p.governancePacks = [
      ...new Set([...policyPacks.filter(Boolean), meta.pack]),
    ];
    p.sources = files.map((file, index) => ({
      id: `SRC-${String(index + 1).padStart(2, "0")}`,
      name: file.name,
      type: file.name.endsWith(".docx")
        ? "DOCX"
        : file.name.endsWith(".txt")
          ? "TXT"
          : file.type.includes("image")
            ? "Image"
            : file.name.endsWith(".json")
              ? "TXT"
              : "PDF",
      status: "Needs review" as const,
      classification: "Project only" as const,
      provenance: "Added during project setup",
      concepts: ["Extracted text awaits BA review"],
      content: extractedFiles[file.name]?.content,
      originalBase64: extractedFiles[file.name]?.original_base64,
      sha256: extractedFiles[file.name]?.sha256,
      passages: extractedFiles[file.name]?.passages,
      extractionLimitations: extractedFiles[file.name]?.limitations,
      version: 1,
      approved: false,
      immutable: true,
    }));
    if (template === "Blank") {
      p.requirements = [];
      p.stories = [];
      p.registers = [];
      p.traceLinks = [];
      p.checks = [];
      p.diagrams = [];
      p.documents = [];
      p.changes = [];
      p.clarifications = [];
    }
    addAudit(
      p,
      "Created project",
      p.id,
      `${template} template initialized in local workspace.`,
    );
    if (projectBrief.trim())
      addAudit(
        p,
        "Applied BA Mate project context",
        "Project brief",
        projectBrief.trim(),
      );
    if (files.length)
      addAudit(
        p,
        "Analyzed knowledge base",
        `${files.length} source${files.length === 1 ? "" : "s"}`,
        "Source materials were added to the project context during setup.",
      );
    addAudit(
      p,
      "Configured governance pack",
      "Project policy pack",
      p.governancePacks.join(" · "),
    );
    p.cloudAllowed = false; p.aiRuns = [];
    onCreate(p);
  };
  const addPolicy = () =>
    setPolicyPacks((current) => [...current, "New project policy"]);
  const stageTitles = [
    "Define the project",
    "Build the knowledge base",
    "Review governance & create",
  ];
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        ref={modalRef}
        className="modal large new-project-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create a new local project"
      >
        <header>
          <div>
            <span className="eyebrow">
              New local project · Step {step} of 3
            </span>
            <h2>{stageTitles[step - 1]}</h2>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X />
          </IconButton>
        </header>
        <div className="setup-progress" aria-label={`Step ${step} of 3`}>
          {stageTitles.map((label, index) => (
            <div
              key={label}
              className={classNames(
                index + 1 < step && "complete",
                index + 1 === step && "active",
              )}
            >
              <i>{index + 1 < step ? <Check size={13} /> : index + 1}</i>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="modal-body">
          {step === 1 && (
            <div className="setup-step">
              <div className="setup-intro">
                <Sparkles size={20} />
                <div>
                  <b>Give BA Mate the right starting context</b>
                  <p>
                    Choose a foundation manually, or let BA Mate turn your
                    description into a matching project foundation.
                  </p>
                </div>
              </div>
              <div className="setup-two-column">
                <label className="editor-field">
                  <span>Project name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Student support service"
                  />
                </label>
                <label className="editor-field">
                  <span>Project workspace</span>
                  <input
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    placeholder="BA-Mate/project-name"
                  />
                </label>
              </div>
              <div className="field-heading">
                <b>Choose a template</b>
                <span>5 guided foundations plus a blank workspace</span>
              </div>
              <div className="template-cards expanded">
                {(Object.keys(templates) as TemplateName[]).map((option) => (
                  <button
                    key={option}
                    className={template === option ? "selected" : ""}
                    aria-pressed={template === option}
                    onClick={() => setTemplate(option)}
                  >
                    <i>{templates[option].icon}</i>
                    <b>{option}</b>
                    <span>{templates[option].description}</span>
                    {template === option && <CheckCircle2 size={16} />}
                  </button>
                ))}
              </div>
              <div className="ba-mate-action">
                <div>
                  <Sparkles size={19} />
                  <span>
                    <b>Describe your project to BA Mate</b>
                    <small>
                      {projectBrief
                        ? "BA Mate has applied a project foundation from your description."
                        : "Get a recommended template, or a blank foundation when no template matches."}
                    </small>
                  </span>
                </div>
                <Button
                  kind="primary"
                  onClick={() => describeToBaMate("project")}
                >
                  <Sparkles size={16} />
                  {projectBrief ? "Review with BA Mate" : "Describe to BA Mate"}
                </Button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="setup-step">
              <div className="setup-intro">
                <Database size={20} />
                <div>
                  <b>Build the project knowledge base</b>
                  <p>
                    Add the materials BA Mate should understand. Analysis begins
                    locally as files are included.
                  </p>
                </div>
              </div>
              <div className="folder-path">
                <Folder size={19} />
                <div>
                  <b>{folder}</b>
                  <small>Local project workspace</small>
                </div>
                <Button onClick={chooseFolder}>
                  <Folder size={16} /> Choose folder
                </Button>
              </div>
              <input
                ref={fileRef}
                hidden
                type="file"
                aria-label="Add project knowledge-base files"
                multiple
                accept=".pdf,.docx,.txt,.json,image/*"
                onChange={(e) => addFiles(e.target.files)}
              />
              <button
                className="knowledge-drop"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={24} />
                <b>Add files or folders of project material</b>
                <span>
                  Text PDFs, DOCX, TXT, Markdown, CSV and JSON · originals remain unchanged
                </span>
                <span className="drop-action">Browse files</span>
              </button>
              {files.length > 0 ? (
                <>
                  <div className="analysis-status">
                    <span className={analysing ? "pulse" : ""}>
                      {analysing ? (
                        <RefreshCw size={17} />
                      ) : (
                        <CheckCircle2 size={17} />
                      )}
                    </span>
                    <div>
                      <b>
                        {analysing
                          ? "BA Mate is analyzing your knowledge base…"
                          : "Source extraction is complete"}
                      </b>
                      <small>
                        {files.length} item{files.length === 1 ? "" : "s"} will
                        remain as approved project context.
                      </small>
                    </div>
                    <Badge tone={analysing ? "warning" : "success"}>
                      {analysing ? "Analyzing" : "Awaiting review"}
                    </Badge>
                  </div>
                  <div className="knowledge-file-list">
                    {files.map((file) => (
                      <div key={file.name}>
                        <i>
                          <FileText size={17} />
                        </i>
                        <span>
                          <b>{file.name}</b>
                          <small>
                            {Math.max(1, Math.round(file.size / 1024))} KB ·{" "}
                            {analysing
                              ? "Queued for analysis"
                              : "Extracted — review required"}
                          </small>
                        </span>
                        <StatusBadge
                          value="Needs review"
                        />
                        <IconButton
                          label={`Remove ${file.name}`}
                          onClick={() => removeFile(file.name)}
                        >
                          <X size={16} />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="knowledge-empty">
                  <FileInput size={24} />
                  <div>
                    <b>No material added yet</b>
                    <p>
                      You can create now and add sources later from Sources &
                      context.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="setup-step">
              <div className="setup-intro">
                <ShieldCheck size={20} />
                <div>
                  <b>Review the creation summary</b>
                  <p>
                    Review and edit the governance context before creating the
                    workspace.
                  </p>
                </div>
              </div>
              <div className="review-project refined">
                <div>
                  <span>Project</span>
                  <b>{name || "Untitled BA project"}</b>
                </div>
                <div>
                  <span>Template</span>
                  <b>{template}</b>
                </div>
                <div>
                  <span>Knowledge base</span>
                  <b>
                    {files.length
                      ? `${files.length} extracted material${files.length === 1 ? "" : "s"}`
                      : "No material yet"}
                  </b>
                </div>
                <div>
                  <span>BA Mate context</span>
                  <b>
                    {projectBrief
                      ? "Applied to foundation"
                      : "Not requested yet"}
                  </b>
                </div>
              </div>
              <div className="ba-mate-action governance-action">
                <div>
                  <Sparkles size={19} />
                  <span>
                    <b>Describe governance to BA Mate</b>
                    <small>
                      Explain the ethical, privacy, safety or compliance needs,
                      then review BA Mate’s proposed pack.
                    </small>
                  </span>
                </div>
                <Button onClick={() => describeToBaMate("governance")}>
                  <Sparkles size={16} /> Describe to BA Mate
                </Button>
              </div>
              <div className="policy-editor">
                <header>
                  <div>
                    <b>Governance & policy pack</b>
                    <p>
                      Every policy remains editable after BA Mate applies
                      recommendations.
                    </p>
                  </div>
                  <Button onClick={addPolicy}>
                    <Plus size={15} /> Add policy
                  </Button>
                </header>
                {policyPacks.map((pack, index) => (
                  <label key={`${pack}-${index}`}>
                    <ShieldCheck size={16} />
                    <input
                      value={pack}
                      onChange={(e) =>
                        setPolicyPacks((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? e.target.value : item,
                          ),
                        )
                      }
                    />
                    {index > 0 && (
                      <IconButton
                        label={`Remove ${pack}`}
                        onClick={() =>
                          setPolicyPacks((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    )}
                  </label>
                ))}
              </div>
              <div className="context-note warning">
                <ShieldCheck />
                <div>
                  <b>Governance is layered and editable</b>
                  <p>
                    Human approval, privacy, uncertainty disclosure and
                    traceability remain core safeguards.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        <footer>
          <Button onClick={step === 1 ? onClose : () => setStep(step - 1)}>
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 3 ? (
            <Button kind="primary" onClick={() => setStep(step + 1)}>
              Continue <ArrowRight size={16} />
            </Button>
          ) : (
            <Button kind="primary" onClick={create} disabled={analysing}>
              <Check size={16} /> Create local project
            </Button>
          )}
        </footer>
        {aiDialog && (
          <div className="ba-mate-dialog" role="presentation">
            <div
              ref={aiDialogRef}
              className="ba-mate-dialog-card"
              role="dialog"
              aria-modal="true"
              aria-label={
                aiDialog === "project"
                  ? "Describe the project to BA Mate"
                  : "Describe governance needs to BA Mate"
              }
            >
              <header>
                <div>
                  <Badge tone="purple">BA Mate</Badge>
                  <h3>
                    {aiDialog === "project"
                      ? "Describe your project"
                      : "Describe governance needs"}
                  </h3>
                  <p>
                    {aiDialog === "project"
                      ? "Explain the outcome, users, data and constraints. BA Mate will recommend a matching template or a blank foundation."
                      : "Explain the ethics, privacy, security, compliance or accessibility needs for this project."}
                  </p>
                </div>
                <IconButton
                  label="Close BA Mate"
                  onClick={() => setAiDialog(null)}
                >
                  <X size={18} />
                </IconButton>
              </header>
              {!aiProposal ? (
                <>
                  <textarea
                    autoFocus
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder={
                      aiDialog === "project"
                        ? "Example: Create a student-support platform handling personal records and approval decisions."
                        : "Example: Student data must be private, retention must be clear, and any decision needs human review."
                    }
                  />
                  <footer>
                    <Button onClick={() => setAiDialog(null)}>Cancel</Button>
                    <Button
                      kind="primary"
                      disabled={!aiPrompt.trim()}
                      onClick={generateAiProposal}
                    >
                      <Sparkles size={16} /> Ask BA Mate
                    </Button>
                  </footer>
                </>
              ) : (
                <>
                  <div className="ba-mate-response">
                    <Sparkles size={19} />
                    <div>
                      <b>BA Mate response</b>
                      <p>{aiProposal.summary}</p>
                      <div className="tag-list">
                        {aiProposal.safeguards.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {aiDialog === "project" && (
                    <div className="ba-mate-match">
                      <span>Recommended foundation</span>
                      <b>{aiProposal.template}</b>
                      <small>
                        {aiProposal.template === "Blank"
                          ? "No close template was found, so BA Mate will create a blank workspace."
                          : "This template will supply the initial workspace structure."}
                      </small>
                    </div>
                  )}
                  <footer>
                    <Button onClick={() => setAiProposal(null)}>
                      Edit description
                    </Button>
                    <Button kind="primary" onClick={applyAiProposal}>
                      <Check size={16} />
                      {aiDialog === "project"
                        ? "Apply project foundation"
                        : "Add to governance pack"}
                    </Button>
                  </footer>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
  return (
    <div className="modal-backdrop">
      <div className="modal large new-project-modal">
        <header>
          <div>
            <span className="eyebrow">
              New local project · Step {step} of 3
            </span>
            <h2>{stageTitles[step - 1]}</h2>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X />
          </IconButton>
        </header>
        <div className="setup-progress" aria-label={`Step ${step} of 3`}>
          {stageTitles.map((label, index) => (
            <div
              key={label}
              className={classNames(
                index + 1 < step && "complete",
                index + 1 === step && "active",
              )}
            >
              <i>{index + 1 < step ? <Check size={13} /> : index + 1}</i>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="modal-body">
          {step === 1 && (
            <div className="setup-step">
              <div className="setup-intro">
                <Sparkles size={20} />
                <div>
                  <b>Give BA Mate the right starting context</b>
                  <p>
                    Choose a foundation, then describe the outcome, people and
                    constraints in your own words. Everything remains editable
                    after creation.
                  </p>
                </div>
              </div>
              <div className="setup-two-column">
                <label className="editor-field">
                  <span>Project name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Student support service"
                  />
                </label>
                <label className="editor-field">
                  <span>Project workspace</span>
                  <input
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    placeholder="BA-Mate/project-name"
                  />
                </label>
              </div>
              <div className="field-heading">
                <b>Choose a template</b>
                <span>5 guided foundations plus a blank workspace</span>
              </div>
              <div className="template-cards expanded">
                {(Object.keys(templates) as TemplateName[]).map((option) => (
                  <button
                    key={option}
                    className={template === option ? "selected" : ""}
                    onClick={() => setTemplate(option)}
                  >
                    <i>{templates[option].icon}</i>
                    <b>{option}</b>
                    <span>{templates[option].description}</span>
                    {template === option && <CheckCircle2 size={16} />}
                  </button>
                ))}
              </div>
              <label className="editor-field project-brief">
                <span>
                  Describe your project to BA Mate{" "}
                  <Badge tone="purple">Optional AI support</Badge>
                </span>
                <textarea
                  value={projectBrief}
                  onChange={(e) => setProjectBrief(e.target.value)}
                  placeholder="Describe the problem, users, goals, concerns or any rules BA Mate should understand…"
                />
                <small>
                  BA Mate will use this as editable project context and suggest
                  relevant ethics, privacy and governance considerations.
                </small>
              </label>
              <label className="assist-toggle">
                <input
                  type="checkbox"
                  checked={assist}
                  onChange={(e) => setAssist(e.target.checked)}
                />
                <Sparkles size={17} />
                <span>
                  <b>Ask BA Mate to shape the project context</b>
                  <small>
                    Creates editable suggested safeguards from your description
                    and selected template.
                  </small>
                </span>
              </label>
            </div>
          )}
          {step === 2 && (
            <div className="setup-step">
              <div className="setup-intro">
                <Database size={20} />
                <div>
                  <b>Build the project knowledge base</b>
                  <p>
                    Add the materials BA Mate should understand. Analysis begins
                    locally as files are included and their context stays
                    available across the workspace.
                  </p>
                </div>
              </div>
              <div className="knowledge-actions">
                <div className="folder-path">
                  <Folder size={19} />
                  <div>
                    <b>{folder}</b>
                    <small>Local project workspace</small>
                  </div>
                  <Button onClick={chooseFolder}>
                    <Folder size={16} /> Choose folder
                  </Button>
                </div>
                <input
                  ref={fileRef}
                  hidden
                  type="file"
                  aria-label="Add project knowledge-base files"
                  multiple
                  accept=".pdf,.docx,.txt,.json,image/*"
                  onChange={(e) => addFiles(e.target.files)}
                />
                <button
                  className="knowledge-drop"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={24} />
                  <b>Add files or folders of project material</b>
                  <span>
                    Text PDFs, DOCX, TXT, Markdown, CSV and JSON · originals remain unchanged
                  </span>
                  <span className="drop-action">Browse files</span>
                </button>
              </div>
              {files.length > 0 ? (
                <>
                  <div className="analysis-status">
                    <span className={analysing ? "pulse" : ""}>
                      {analysing ? (
                        <RefreshCw size={17} />
                      ) : (
                        <CheckCircle2 size={17} />
                      )}
                    </span>
                    <div>
                      <b>
                        {analysing
                          ? "BA Mate is analyzing your knowledge base…"
                          : "Source extraction is complete"}
                      </b>
                      <small>
                        {analysing
                          ? "Extracting concepts, topics and potential governance concerns in the background."
                          : `${files.length} item${files.length === 1 ? "" : "s"} will be available to BA Mate as approved project context.`}
                      </small>
                    </div>
                    <Badge tone={analysing ? "warning" : "success"}>
                      {analysing ? "Analyzing" : "Awaiting review"}
                    </Badge>
                  </div>
                  <div className="knowledge-file-list">
                    {files.map((file) => (
                      <div key={file.name}>
                        <i>
                          <FileText size={17} />
                        </i>
                        <span>
                          <b>{file.name}</b>
                          <small>
                            {Math.max(1, Math.round(file.size / 1024))} KB ·{" "}
                            {analysing
                              ? "Queued for analysis"
                              : "Extracted — review required"}
                          </small>
                        </span>
                        <StatusBadge
                          value="Needs review"
                        />
                        <IconButton
                          label={`Remove ${file.name}`}
                          onClick={() => removeFile(file.name)}
                        >
                          <X size={16} />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="knowledge-empty">
                  <FileInput size={24} />
                  <div>
                    <b>No material added yet</b>
                    <p>
                      You can create the workspace now and add sources later
                      from Sources & context.
                    </p>
                  </div>
                </div>
              )}
              <div className="context-note">
                <Sparkles />
                <div>
                  <b>Agentic, but under your control</b>
                  <p>
                    BA Mate prepares context in the background; you can later
                    inspect, include, exclude or edit every source and generated
                    suggestion.
                  </p>
                </div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="setup-step">
              <div className="setup-intro">
                <ShieldCheck size={20} />
                <div>
                  <b>Review the creation summary</b>
                  <p>
                    Skim the governance context before creating the workspace.
                    Policy packs and every project setting can be edited later.
                  </p>
                </div>
              </div>
              <div className="review-project refined">
                <div>
                  <span>Project</span>
                  <b>{name || "Untitled BA project"}</b>
                </div>
                <div>
                  <span>Template</span>
                  <b>{template}</b>
                </div>
                <div>
                  <span>Knowledge base</span>
                  <b>
                    {files.length
                      ? `${files.length} extracted material${files.length === 1 ? "" : "s"}`
                      : "No material yet"}
                  </b>
                </div>
                <div>
                  <span>AI project context</span>
                  <b>
                    {assist && projectBrief.trim()
                      ? "Enabled"
                      : "Manual configuration"}
                  </b>
                </div>
              </div>
              {assist && (
                <div className="ai-suggestion-row">
                  <Sparkles size={16} />
                  <span>
                    <b>BA Mate suggested safeguards</b>
                    <small>{aiSuggestions.join(" · ")}</small>
                  </span>
                </div>
              )}
              <div className="policy-editor">
                <header>
                  <div>
                    <b>Governance & policy pack</b>
                    <p>
                      Core safeguards are always retained; these packs add
                      project-specific guidance.
                    </p>
                  </div>
                  <Button onClick={addPolicy}>
                    <Plus size={15} /> Add policy
                  </Button>
                </header>
                {policyPacks.map((pack, index) => (
                  <label key={`${pack}-${index}`}>
                    <ShieldCheck size={16} />
                    <input
                      value={pack}
                      onChange={(e) =>
                        setPolicyPacks((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? e.target.value : item,
                          ),
                        )
                      }
                    />
                    {index > 0 && (
                      <IconButton
                        label={`Remove ${pack}`}
                        onClick={() =>
                          setPolicyPacks((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    )}
                  </label>
                ))}
              </div>
              <label className="editor-field project-brief compact">
                <span>
                  Refine governance with BA Mate{" "}
                  <Badge tone="purple">Optional</Badge>
                </span>
                <textarea
                  value={projectBrief}
                  onChange={(e) => setProjectBrief(e.target.value)}
                  placeholder="Add any ethical, privacy, security, accessibility or governance expectations…"
                />
                <small>
                  This project context remains editable from Governance & checks
                  and the BA Mate assistant.
                </small>
              </label>
              <div className="context-note warning">
                <ShieldCheck />
                <div>
                  <b>Governance is layered and editable</b>
                  <p>
                    Human approval, privacy, uncertainty disclosure and
                    traceability remain core safeguards. Your policy pack can
                    add or strengthen project rules.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        <footer>
          <Button onClick={step === 1 ? onClose : () => setStep(step - 1)}>
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 3 ? (
            <Button kind="primary" onClick={() => setStep(step + 1)}>
              Continue <ArrowRight size={16} />
            </Button>
          ) : (
            <Button kind="primary" onClick={create} disabled={analysing}>
              <Check size={16} /> Create local project
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<WorkspaceState>(() => ({ schemaVersion: 7, projects: [], evaluationRuns: [], telemetryEvents: [], stageFeedback: [] }));
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState("Saved on this device");
  const savedState = useRef<WorkspaceState | null>(null);
  const currentState = useRef(state);
  currentState.current = state;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inspector, setInspector] = useState(false);
  const [inspectorPinned, setInspectorPinned] = useState(
    () => localStorage.getItem("ba-mate-assistant-pinned") === "true",
  );
  const [activeReference, setActiveReference] = useState<ArtifactReference>();
  const [newProject, setNewProject] = useState(false);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    repository
      .load()
      .then((saved) => {
        if (saved) setState(saved);
        setReady(true);
      })
      .catch((error) => { setLoadError(error.message || "The saved workspace could not be loaded."); });
  }, []);
  useEffect(() => {
    if (!ready) return;
    setSaveStatus("Saving…");
    const timer = window.setTimeout(() => {
      repository.save(state).then(() => {
        savedState.current = state;
        if (currentState.current === state) setSaveStatus("Saved on this device");
      }).catch((error) => {
        setSaveStatus("Changes not saved — export a backup");
        notify(`Recent changes could not be saved. ${error.message} Export a project backup before closing.`, "danger", "Changes not persisted");
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [state, ready]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (ready && savedState.current !== currentState.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [ready]);
  useEffect(() => {
    const listener = (event: Event) => {
      const incoming = (event as CustomEvent<AppNoticeDetail | string>).detail;
      const detail: AppNoticeDetail =
        typeof incoming === "string" ? { message: incoming } : incoming;
      const id = uid("NOTICE");
      const item: NoticeItem = {
        id,
        message: detail.message,
        title: detail.title,
        tone: detail.tone ?? "info",
      };
      setNotices((current) => [...current.slice(-2), item]);
      window.setTimeout(
        () =>
          setNotices((current) =>
            current.filter((notice) => notice.id !== id),
          ),
        item.tone === "danger" ? 6500 : 4200,
      );
    };
    window.addEventListener("ba-mate-notice", listener);
    return () => window.removeEventListener("ba-mate-notice", listener);
  }, []);
  useEffect(() => {
    localStorage.setItem("ba-mate-assistant-pinned", String(inspectorPinned));
  }, [inspectorPinned]);
  const match = location.pathname.match(/^\/projects\/([^/]+)(?:\/([^/]+))?/);
  const project = state.projects.find((p) => p.id === match?.[1]);
  const section = match?.[2] ?? "overview";
  useEffect(() => {
    const globalLabel = globalItems.find(
      ([path]) => path === location.pathname,
    )?.[1];
    const sectionLabel = projectItems.find(([key]) => key === section)?.[1];
    document.title = project
      ? `${sectionLabel ?? "Section unavailable"} · ${project.name} · BA Mate`
      : match
        ? "Project unavailable · BA Mate"
        : `${globalLabel ?? (location.pathname === "/" ? "Projects" : "Page unavailable")} · BA Mate`;
  }, [location.pathname, project?.name, section]);
  useEffect(() => {
    const recordCompletedTask = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: ResearchEventType; projectId?: string; goalId?: string; runId?: string | null; stage?: WorkflowGate; section?: string; successful?: boolean; durationMs?: number }>).detail;
      if (detail?.type !== 'assistant-request' || !detail.projectId || !detail.stage) return;
      setState(current => ({ ...current, telemetryEvents: [...current.telemetryEvents, {
        id: uid('TLM'), at: new Date().toISOString(), projectId: detail.projectId!, goalId: detail.goalId, runId: detail.runId ?? undefined,
        stage: detail.stage!, section: detail.section ?? 'workflow-workbench', type: 'assistant-request', durationMs: detail.durationMs, successful: detail.successful ?? false,
      }] }));
    };
    window.addEventListener('ba-mate-research-event', recordCompletedTask);
    return () => window.removeEventListener('ba-mate-research-event', recordCompletedTask);
  }, []);
  useEffect(() => {
    if (!ready || !project) return;
    const projectId = project.id;
    const goalId = project.activeGoalId;
    const stage =
      project.goals.find((goal) => goal.id === goalId)?.gate ?? project.gate;
    let visibleAt = Date.now();
    let activeMs = 0;
    const onVisibility = () => { if (document.hidden) activeMs += Date.now() - visibleAt; else visibleAt = Date.now(); };
    document.addEventListener("visibilitychange", onVisibility);
    const appendEvent = (
      type: ResearchEventType,
      successful = true,
      durationMs?: number,
    ) =>
      setState((current) => {
        const candidate = activeEvaluationRun(current.evaluationRuns);
        const run = candidate?.projectId === projectId ? candidate : undefined;
        if (type === "page-view") {
          const previous = current.telemetryEvents.at(-1);
          if (
            previous?.type === "page-view" &&
            previous.projectId === projectId &&
            previous.section === section &&
            Date.now() - new Date(previous.at).getTime() < 1000
          )
            return current;
        }
        return {
          ...current,
          telemetryEvents: [
            ...current.telemetryEvents,
            {
              id: uid("TLM"),
              at: new Date().toISOString(),
              projectId,
              goalId,
              runId: run?.id,
              stage,
              section,
              type,
              durationMs,
              successful,
            },
          ],
        };
      });
    appendEvent("page-view");
    const onClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button || button.disabled) return;
      appendEvent("interaction");
    };
    const onResearchEvent = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          type?: ResearchEventType;
          projectId?: string;
          successful?: boolean;
          durationMs?: number;
        }>
      ).detail;
      if (detail?.projectId) return;
      appendEvent(
        detail?.type ?? "interaction",
        detail?.successful ?? true,
        detail?.durationMs,
      );
    };
    const onError = () => appendEvent("error", false);
    document.addEventListener("click", onClick);
    window.addEventListener("ba-mate-research-event", onResearchEvent);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onError);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("ba-mate-research-event", onResearchEvent);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onError);
      document.removeEventListener("visibilitychange", onVisibility);
      const durationMs = activeMs + (document.hidden ? 0 : Date.now() - visibleAt);
      if (durationMs >= 250 && section !== "evaluation") appendEvent("stage-session", true, durationMs);
    };
  }, [
    ready,
    project?.id,
    project?.activeGoalId,
    project?.gate,
    section,
  ]);
  useEffect(() => {
    if (project && project.goals.length === 0 && section === "overview")
      navigate(`/projects/${project.id}/conversations`);
  }, [project, section, navigate]);
  const update = (fn: (project: Project) => void) => {
    if (!project) return;
    setState((current) => {
      const next = JSON.parse(JSON.stringify(current)) as WorkspaceState;
      const target = next.projects.find((p) => p.id === project.id);
      // An in-flight AI response can arrive after project deletion or navigation.
      // Silently discard it rather than reviving or mutating another project.
      if (!target) return current;
      const before = structuredClone(target);
      fn(target);
      enforceWorkingVersions(before, target);
      return next;
    });
  };
  const go = (target: string) =>
    project && navigate(`/projects/${project.id}/${target}`);
  const renderProject = () => {
    if (!project) return null;
    const props = { project, update };
    switch (section) {
      case "overview":
        return <ProjectOverview project={project} go={go} />;
      case "goals":
        return <GoalsView {...props} go={go} />;
      case "workflow":
        return (
          <WorkflowView
            {...props}
            go={go}
            evaluationRunId={activeEvaluationRun(state.evaluationRuns)?.id}
            stageFeedback={state.stageFeedback}
          />
        );
      case "conversations":
        return (
          <ConnectedConversations
            {...props}
            automaticContext={activeReference}
            onNavigate={(path) => navigate(path)}
          />
        );
      case "sources":
        return <SourcesView {...props} />;
      case "artifacts":
        return (
          <ConnectedArtifacts
            {...props}
            onAsk={(ref) => {
              setActiveReference(ref);
              setInspector(true);
            }}
            onOpenConversation={(ref) => {
              setActiveReference(ref);
              navigate(`/projects/${project.id}/conversations`);
            }}
          />
        );
      case "registers":
        return <RegistersView {...props} />;
      case "traceability":
        return <TraceabilityView {...props} />;
      case "diagrams":
        return <ConnectedDiagrams {...props} />;
      case "documents":
        return <ConnectedDocuments {...props} />;
      case "changes":
        return <ChangesView {...props} />;
      case "governance":
        return <GovernanceView {...props} />;
      case "activity":
        return <ActivityView {...props} />;
      case "evaluation":
        return (
          <StageEvaluationView
            project={project}
            state={state}
            setState={setState}
          />
        );
      case "team":
        return <TeamView {...props} />;
      default:
        return <NotFoundPage scope="section" />;
    }
  };
  const globalPage = location.pathname.slice(1) || "projects";
  const content = !ready ? (
    <div className="route-loading" role="status">
      <Sparkles />
      <span>Opening the local workspace…</span>
    </div>
  ) : match && !project ? (
    <NotFoundPage scope="project" />
  ) : project ? (
    <EvaluationContext.Provider value={state.evaluationRuns.find(r => r.status === "Running" && r.projectId === project.id)}>
      {(["artifacts", "diagrams", "documents", "changes", "governance"] as string[]).includes(section) && <details className="studio-ai-panel"><summary>AI assistance for this task</summary><WorkflowWorkbench key={`${project.id}:${section}`} project={project} update={update} initialTask={section === "diagrams" ? "diagram" : section === "documents" ? "document" : section === "changes" ? "impact" : section === "governance" ? "validate" : "requirements"} /></details>}
      {["loan", "leave", "returns"].includes(project.id) && <p className="context-note warning">Demonstration project: prefilled artifacts and scores are synthetic examples, not research results. Create a fresh project for your own work.</p>}
      {renderProject()}
      {project.goals.length === 0 && (
        <ProjectKickoff project={project} update={update} />
      )}
    </EvaluationContext.Provider>
  ) : globalPage === "projects" ? (
    <ProjectsHome
      state={state}
      onCreate={() => setNewProject(true)}
      onDelete={(deleted) =>
        setState((current) => ({
          ...current,
          projects: current.projects.filter((item) => item.id !== deleted.id),
        }))
      }
    />
  ) : globalPage === "research" ? (
    <ResearchConsole state={state} setState={setState} />
  ) : (
    <GlobalWorkspacePage page={globalPage} state={state} setState={setState} />
  );
  if (loadError) return <div className="recovery-screen"><h1>Reconnect to your workspace</h1><p role="alert">{loadError}</p><p>Your saved data has not been replaced. Start the local BA Mate service, then retry.</p><button onClick={() => window.location.reload()}>Retry connection</button></div>;
  if (!ready) return <div className="recovery-screen" role="status">Opening your workspace…</div>;
  return (
    <div
      className={classNames(
        "app-shell",
        collapsed && "nav-collapsed",
        inspector && project && inspectorPinned && "inspector-pinned",
      )}
    >
      <Sidebar
        state={state}
        project={project}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCollapse={() => setCollapsed(!collapsed)}
        onClose={() => setMobileOpen(false)}
      />
      {mobileOpen && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className="app-main">
        <AppTopbar
          project={project}
          onMenu={() => setMobileOpen(true)}
          onInspector={() => setInspector(!inspector)}
          inspectorOpen={inspector}
        />
        <main className="page-content">
          <p className="workspace-save-status" role="status">{saveStatus}</p>
          <Suspense
            fallback={
              <div className="route-loading" role="status">
                <Sparkles />
                <span>Loading connected workspace…</span>
              </div>
            }
          >
            {content}
          </Suspense>
        </main>
      </div>
      {project && inspector && !inspectorPinned && (
        <button
          className="assistant-scrim"
          aria-label="Close BA Mate assistant"
          onClick={() => setInspector(false)}
        />
      )}{" "}
      {project && inspector && (
        <Suspense fallback={null}>
          <AssistantDrawer
            project={project}
            context={activeReference}
            evaluationActive={state.evaluationRuns.some(r => r.status === "Running" && r.projectId === project.id)}
            pinned={inspectorPinned}
            onPin={() => setInspectorPinned(!inspectorPinned)}
            onClose={() => setInspector(false)}
            onNavigate={(path) => navigate(path)}
          />
        </Suspense>
      )}{" "}
      {newProject && (
        <NewProjectModal
          onClose={() => setNewProject(false)}
          onCreate={(p) => {
            prepareFreshProject(p);
            setState((current) => ({
              ...current,
              projects: [p, ...current.projects],
            }));
            setNewProject(false);
            mockNotice(
              `${p.name} was created as a private local workspace.`,
              "success",
              "Project created",
            );
            navigate(`/projects/${p.id}/overview`);
          }}
        />
      )}
      <ToastViewport
        notices={notices}
        onDismiss={(id) =>
          setNotices((current) =>
            current.filter((notice) => notice.id !== id),
          )
        }
      />
    </div>
  );
}
