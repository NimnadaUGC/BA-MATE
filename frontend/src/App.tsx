import { ProjectProcessingPreference } from "./ProjectProcessingPreference";
import { assistantSessions } from "./assistantSessions";
import { EvaluationContext } from "./EvaluationContext";
import { conversationDrafts } from "./conversationDrafts";
import { api, importSource } from "./api";
import { ModelSettings } from "./ModelSettings";
import { WorkflowWorkbench } from "./WorkflowWorkbench";
import { searchSourcePassages } from "./sourceSearch";
import { similarQuestions } from "./similarQuestions";
import { passageIsCurrent, passageLabel, traceDisplayStatus, traceEndpointExists, traceReviewFingerprint } from "./tracePassage";
import { captureSnapshot, enforceWorkingVersions, approvalAllowed, baselineIssues, restoreSnapshot, revisionManifest, revisionOf } from "./store";
import { recordsOnlyRecoveryProject, sourcePassagePins } from "./store";
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
  recordGovernanceDisposition,
  repository,
  traceCoverage,
} from "./store";
import {
  activeEvaluationRun,
  DATASET_VERSION,
  formatDuration,
  PROMPT_VERSION,
  PROTOTYPE_VERSION,
  FRAMEWORK_VERSION,
  summarizeStageResearch,
} from "./research";
import { buildResearchUpload, queueUpload, RESEARCH_CONSENT_VERSION, RESEARCH_INSTRUMENT_VERSION, RETENTION_NOTICE, retryDelayMs, validateResearchUpload, type LocalResearchParticipation } from "./researchBoundary";
import { applyAcceptedPatches, validateAcceptedPatches, changeAffectedIds, changeRevalidationIsCurrent, changeRevalidationIssues, changesNeedingRevalidation, baselineManifestWithChanges, baselineDependencyIssues } from "./controlledChanges";
import {
  canAdvanceStage,
  canCompleteGoal,
  canCreateBaseline,
  stageReadiness,
  stageReadinessIssues,
  type StageReadinessItem,
} from "./workflowReadiness";
import {
  notify,
  useDialogAccessibility,
  onTabListKeyDown,
  type AppNoticeDetail,
  type NoticeTone,
} from "./ui";
import {
  SOURCE_ACCEPT,
  chooseProjectFolder,
  createProjectWorkspace,
  createProjectDirectories,
  ensureProjectWorkspace,
  isSupportedSourceName,
  relativePathForFile,
  sourceTypeForName,
  writeProjectFiles,
  readFileForWorkspace,
  readProjectOriginal,
  getProjectAnalysis,
  prepareProjectBackup,
  restoreProjectWorkspace,
  missingRestoredOriginalCount,
  copyProjectToWorkspace,
  verifySourceOriginal,
  reattachSourceOriginal,
  type WorkspaceCandidate,
} from "./workspaceFiles";
import { goalSelectableSource, goalSourceCurrent, mergeProjectAnalysis, requestProjectAgentRun, surfaceBackgroundQuestion } from "./projectSources";
import { verifyBaselineSources } from "./baselineSources";
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
  ["/guide", "Beta guide", BookOpen],
  ["/research", "Study participation", BarChart3],
  ["/settings", "Settings", Settings],
] as const;
const primaryProjectItems = [
  ["overview", "Overview", LayoutDashboard],
  ["workflow", "Guided workflow", SplitSquareVertical],
] as const;
const projectGroups = [
  {
    id: "materials",
    label: "Project materials",
    icon: Database,
    items: [
      ["sources", "Sources", Database],
      ["artifacts", "Requirements & stories", ListChecks],
      ["registers", "Registers", Table2],
    ] as const,
  },
  {
    id: "deliverables",
    label: "Deliverables",
    icon: FileText,
    items: [
      ["diagrams", "Diagrams", GitBranch],
      ["documents", "Documents", FileText],
    ] as const,
  },
  {
    id: "review",
    label: "Review & approval",
    icon: ShieldCheck,
    items: [
      ["traceability", "Evidence links", Network],
      ["changes", "Changes & impact", RefreshCw],
      ["governance", "Checks & safeguards", ShieldCheck],
      ["activity", "History & approved versions", History],
    ] as const,
  },
  {
    id: "more",
    label: "More tools",
    icon: Boxes,
    items: [
      ["goals", "Goals", Boxes],
      ["conversations", "Ask BA Mate", MessageSquareText],
      ["team", "Project settings", Settings],
    ] as const,
  },
] as const;
const projectItems = [
  ...primaryProjectItems,
  ...projectGroups[0].items,
  ...projectGroups[1].items,
  ...projectGroups[2].items,
  ...projectGroups[3].items,
  ["evaluation", "Stage evaluation", BarChart3] as const,
] as const;

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const classNames = (...items: (string | false | undefined)[]) =>
  items.filter(Boolean).join(" ");
const formatWorkspaceTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};
const appNotice = (
  message: string,
  tone: NoticeTone = "info",
  title?: string,
) => notify(message, tone, title);
const activeGoal = (project: Project) =>
  project.goals.find((goal) => goal.id === project.activeGoalId) ??
  project.goals.find((goal) => goal.status === "Active");

export const projectChoiceLabel = (project: Project, projects: Project[]) =>
  projects.filter(item => item.name.trim().toLocaleLowerCase() === project.name.trim().toLocaleLowerCase()).length > 1
    ? `${project.name} · ${project.folderName || "No folder"} · ${project.id}`
    : project.name;

function IconButton({
  label,
  onClick,
  children,
  className = "",
  disabled = false,
}: {
  label: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
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
  label,
}: {
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
  label?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      aria-label={label}
      className={`button ${kind} ${className}`}
      disabled={disabled}
      onClick={onClick}
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
function SetupTip({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    setOpen(true);
    const timer = window.setTimeout(() => setOpen(false), 6500);
    return () => window.clearTimeout(timer);
  }, [step]);
  return <div className={classNames("setup-tip", open && "open")}>
    <button type="button" aria-expanded={open} aria-label={`${title} information`} onClick={() => setOpen(value => !value)}>
      <CircleHelp size={18} /><span>{title}</span>
    </button>
    <div className="setup-tip-content" aria-hidden={!open}><p>{children}</p></div>
  </div>;
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
  evaluationActive,
  onCollapse,
  onClose,
}: {
  state: WorkspaceState;
  project?: Project;
  collapsed: boolean;
  mobileOpen: boolean;
  evaluationActive: boolean;
  onCollapse: () => void;
  onClose: () => void;
}) {
  const nav = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef<HTMLElement>(null);
  const [mobileViewport, setMobileViewport] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const sync = () => setMobileViewport(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  useDialogAccessibility(sidebarRef, onClose, mobileViewport && mobileOpen);
  const go = (path: string) => {
    nav(path);
    onClose();
  };
  const projectItem = (
    [section, label, Icon]: (typeof projectItems)[number],
  ) => {
    if (section === "evaluation" && !evaluationActive) return null;
    const path = `/projects/${project!.id}/${section}`;
    return (
      <button
        key={section}
        title={label}
        aria-label={label}
        className={location.pathname === path ? "active" : ""}
        aria-current={location.pathname === path ? "page" : undefined}
        onClick={() => go(path)}
      >
        <Icon size={18} />
        <span>{label}</span>
        {section === "workflow" && blockers(project!) > 0 && (
          <em>{blockers(project!)}</em>
        )}
      </button>
    );
  };
  return (
    <aside
      ref={sidebarRef}
      className={classNames(
        "sidebar",
        collapsed && "collapsed",
        mobileOpen && "mobile-open",
      )}
      aria-hidden={mobileViewport && !mobileOpen ? true : undefined}
      inert={mobileViewport && !mobileOpen ? true : undefined}
      role={mobileViewport ? "dialog" : undefined}
      aria-modal={mobileViewport && mobileOpen ? true : undefined}
      aria-label={mobileViewport ? "Navigation" : undefined}
    >
      <div className="brand-row">
        <button className="brand-button" aria-label="BA Mate projects" title="BA Mate projects" onClick={() => go("/projects")}>
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
            title={label}
            aria-label={label}
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
          <button className="project-switcher" aria-label={`Choose project, current project ${project.name}`} title={`Choose project, current project ${project.name}`} onClick={() => go("/projects")}>
            <i style={{ background: project.color }}>{project.name[0]}</i>
            <span>
              <b>{project.name}</b>
              <small>{project.domain}</small>
            </span>
            <ChevronDown size={16} />
          </button>
          <div className="nav-label">Project workspace</div>
          <nav className="project-nav primary-project-nav" aria-label="Primary project navigation">
            {primaryProjectItems.map(projectItem)}
          </nav>
          <div className="project-nav-groups">
            {projectGroups.map((group) => {
              const GroupIcon = group.icon;
              const active = group.items.some(
                ([section]) =>
                  location.pathname === `/projects/${project.id}/${section}`,
              );
              return (
                <details className="project-nav-group" key={group.id} open={active || undefined}>
                  <summary title={group.label} aria-label={group.label}>
                    <GroupIcon size={18} />
                    <span>{group.label}</span>
                    <ChevronDown size={15} />
                  </summary>
                  <nav className="project-nav" aria-label={group.label}>
                    {group.items.map(projectItem)}
                  </nav>
                </details>
              );
            })}
            {evaluationActive && (
              <nav className="project-nav evaluation-project-nav" aria-label="Active study task">
                {projectItem(["evaluation", "Stage evaluation", BarChart3])}
              </nav>
            )}
          </div>
        </>
      ) : (
        <div className="sidebar-projects">
          <div className="nav-label">Your projects</div>
          {state.projects.map((p) => (
            <button key={p.id} aria-label={`Open ${projectChoiceLabel(p, state.projects)}, ${p.gate}, ${traceCoverage(p)} percent evidence coverage`} title={projectChoiceLabel(p, state.projects)} onClick={() => go(`/projects/${p.id}/overview`)}>
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
        <button onClick={onCollapse} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed}>
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
  saveStatus,
  onMenu,
  onInspector,
  inspectorOpen,
  assistantAvailable = true,
}: {
  project?: Project;
  saveStatus: string;
  onMenu: () => void;
  onInspector: () => void;
  inspectorOpen: boolean;
  assistantAvailable?: boolean;
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
            <span title={project.name}>{project.name}</span>
            {goal && (
              <>
                <ChevronRight size={14} />
                <span title={goal.title}>{goal.title}</span>
                <Badge tone="purple">{goal.gate}</Badge>
              </>
            )}
          </>
        ) : (
          <span>Workspace</span>
        )}
      </div>
      <div className="topbar-actions">
        <span
          className={classNames(
            "local-status",
            saveStatus === "Saving…" && "saving",
            saveStatus === "Saving paused" && "save-error",
          )}
          title={
            saveStatus === "Saving paused"
              ? "Recent changes could not be persisted. Export a backup before closing BA Mate."
              : "This workspace is stored locally on this device"
          }
          role="status"
        >
          {saveStatus === "Saving…" ? <Clock3 size={15} /> : saveStatus === "Saving paused" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {saveStatus}
        </span>
        {project && assistantAvailable && (
          <button className={`button topbar-assistant ${inspectorOpen ? "active" : ""}`} aria-label={inspectorOpen ? "Close BA Mate inspector" : "Open BA Mate inspector"} aria-expanded={inspectorOpen} onClick={onInspector}>
            <Sparkles size={17} /> <span>Ask BA Mate</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function ProjectOverview({
  project,
  go,
  update,
}: {
  project: Project;
  go: (section: string) => void;
  update: (fn: (p: Project) => void) => void;
}) {
  const coverage = traceCoverage(project);
  const openClarifications = project.clarifications.filter(
    (q) => q.status !== "Answered" && q.status !== "Discarded",
  ).length;
  const goal = activeGoal(project);
  const [retryingSuggestions, setRetryingSuggestions] = useState(false);
  const [pastAgentRuns, setPastAgentRuns] = useState<NonNullable<Project["agentRun"]>[] | null>(null);
  const [pastAgentRunError, setPastAgentRunError] = useState("");
  const [pastAgentRunsOpen, setPastAgentRunsOpen] = useState(false);
  useEffect(() => {
    if (!pastAgentRunsOpen || !project.workspaceId) return;
    let active = true;
    setPastAgentRuns(null);
    setPastAgentRunError("");
    void api<NonNullable<Project["agentRun"]>[]>(`/api/project-agents/${encodeURIComponent(project.workspaceId)}/history`)
      .then(runs => { if (active) setPastAgentRuns([...(project.agentHistory ?? []), ...runs]); })
      .catch(error => { if (active) setPastAgentRunError(error instanceof Error ? error.message : "Earlier proposals could not be loaded."); });
    return () => { active = false; };
  }, [project.workspaceId, project.agentRun?.signature, pastAgentRunsOpen]);
  const failedRole = Object.values(project.agentRun?.roles ?? {}).some(role => role.status === "failed");
  const retrySuggestions = async () => {
    if (!project.workspaceId || !project.workspaceKind || retryingSuggestions) return;
    setRetryingSuggestions(true);
    try {
      const analysis = await getProjectAnalysis({ workspaceId: project.workspaceId, workspaceKind: project.workspaceKind,
        folderName: project.folderName, displayPath: project.workspacePath });
      const run = await requestProjectAgentRun(project, analysis, true);
      update(p => { p.agentRun = run; });
      appNotice("BA Mate is retrying the background suggestions with the current project context.", "info", "Suggestions restarted");
    } catch (error) {
      appNotice(error instanceof Error ? error.message : "The suggestions could not be restarted.", "warning", "Retry unavailable");
    } finally { setRetryingSuggestions(false); }
  };
  const planning = project.agentRun?.roles.planning?.proposal as { goals?: { title: string; kind: string; reason: string }[]; clarification_questions?: string[] } | undefined;
  const intake = project.agentRun?.roles.source_intake?.proposal as { review_questions?: string[] } | undefined;
  const governanceReview = project.agentRun?.roles.governance_review?.proposal as { review_points?: string[] } | undefined;
  const drafting = project.agentRun?.roles.requirement_drafting?.proposal as { requirements?: {
    title: string; statement: string; kind: "Functional" | "Non-functional"; priority: "Must" | "Should" | "Could";
    rationale: string; source_paths: string[];
  }[]; open_questions?: string[] } | undefined;
  const suggestionKey = (role: string, value: string) => `${project.agentRun?.signature ?? "unsaved"}:${role}:${value}`;
  const dismissed = new Set(project.dismissedAgentSuggestions ?? []);
  const suggestedQuestions = [...new Set([...(intake?.review_questions ?? []), ...(planning?.clarification_questions ?? []), ...(drafting?.open_questions ?? [])])]
    .filter(question => !dismissed.has(suggestionKey("question", question)) && !project.clarifications.some(item => item.question === question) &&
      !project.conversations.some(conversation => conversation.messages.some(message => message.proposal?.kind === "clarification-question" && message.proposal.after === question && message.proposal.status === "pending")));
  const suggestedDrafts = (drafting?.requirements ?? []).filter(draft =>
    !dismissed.has(suggestionKey("draft", `${draft.title}:${draft.statement}`)) &&
    !project.requirements.some(item => item.title === draft.title && item.statement === draft.statement && item.goalId === goal?.id));
  const suggestedGoals = (planning?.goals ?? []).filter(item => !dismissed.has(suggestionKey("goal", `${item.kind}:${item.title}`)));
  const suggestedPolicies = (governanceReview?.review_points ?? []).filter(item => !dismissed.has(suggestionKey("governance", item)));
  const pendingSuggestionCount = suggestedQuestions.length + suggestedDrafts.length + suggestedGoals.length + suggestedPolicies.length;
  const dismissSuggestion = (role: string, value: string) => update(p => {
    const key = suggestionKey(role, value);
    p.dismissedAgentSuggestions = [...new Set([...(p.dismissedAgentSuggestions ?? []), key])];
    addAudit(p, "Rejected BA Mate suggestion", role, value);
  });
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
              {goal ? "Active goal" : project.goals.length ? "Project goals" : "Project setup"}
            </span>
            <h2>{goal?.title ?? (project.goals.length ? "No active goal" : "Define the first project goal")}</h2>
            <p>
              {goal?.description ?? (project.goals.length
                ? "Your saved goals and deliverables remain available. Review an existing goal or start a new one for further work."
                : hasArtifacts ? "Start a goal to organize the existing deliverables into a governed workflow."
                : "Start a BA Mate goal conversation to establish the first governed workflow. This fresh project contains no generated artifacts yet.")}
            </p>
            <Button
              kind="primary"
              onClick={() => go(goal ? "workflow" : "goals")}
            >
              {goal ? `Open ${goal.gate} workflow` : project.goals.length ? "Manage goals" : "Create first goal"}{" "}
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
              tone={hasArtifacts ? "warning" : "neutral"}
            />
            <Metric
              label="Traceability"
              value={`${coverage}%`}
              detail={`${project.traceLinks.filter((l) => traceDisplayStatus(project, l) === "Verified").length} verified links`}
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
      <div className="project-background-status" role="status">
        <Sparkles size={18} />
        <span><b>BA Mate background work</b><small>{project.sourceAnalysisStatus === "ready" ? `${project.sources.length} project source${project.sources.length === 1 ? "" : "s"} discovered; ${project.sources.filter(source => source.status === "Needs review").length} need BA review.` : project.sourceAnalysisStatus === "failed" ? "The project folder is unavailable. Reconnect it in project settings." : "Project folder discovery is starting or still running."} {project.agentRun?.status === "ready" ? failedRole ? "Some suggestions paused; retry is available." : "Suggestions are ready for review." : project.agentRun?.status === "running" ? "Task roles are preparing suggestions." : project.agentRun?.status === "waiting_for_sources" ? project.agentRun.message ?? "Waiting for the project folder scan." : project.agentRun?.status === "failed" ? `Suggestions paused: ${project.agentRun.error ?? "manual work is available."}` : ""}</small></span>
        {(project.agentRun?.status === "failed" || failedRole) && project.sourceAnalysisStatus === "ready" &&
          <Button onClick={() => void retrySuggestions()} disabled={retryingSuggestions}>{retryingSuggestions ? "Retrying…" : "Retry suggestions"}</Button>}
        <Button onClick={() => go(project.sourceAnalysisStatus === "failed" ? "team" : "sources")}>{project.sourceAnalysisStatus === "failed" ? "Reconnect folder" : "Review sources"}</Button>
      </div>
      {project.agentRun?.context_manifest && <details className="agent-context-review">
        <summary>What BA Mate used for these suggestions</summary>
        <p>{project.agentRun.context_manifest.processing_location} · {project.agentRun.context_manifest.model} · {project.agentRun.context_manifest.confirmed_decision_count} recorded human decisions used{project.agentRun.context_manifest.omitted_confirmed_decision_count ? `, ${project.agentRun.context_manifest.omitted_confirmed_decision_count} older decisions omitted` : ""}</p>
        <p>Source review: {project.agentRun.context_manifest.source_intake.sources.length} tentative extracts used, {project.agentRun.context_manifest.source_intake.omitted_count} omitted. Requirement drafting: {project.agentRun.context_manifest.requirement_drafting.sources.length} BA selected revisions used, {project.agentRun.context_manifest.requirement_drafting.omitted_count} omitted.</p>
        {!!project.agentRun.context_manifest.omitted_approved_source_selection_count && <p>{project.agentRun.context_manifest.omitted_approved_source_selection_count} additional BA selected sources were outside this run's input limit.</p>}
        {!!project.agentRun.context_manifest.unmatched_selected_source_count && <p>{project.agentRun.context_manifest.unmatched_selected_source_count} selected source revisions no longer match the current folder and were excluded from drafting.</p>}
        {[...project.agentRun.context_manifest.source_intake.sources, ...project.agentRun.context_manifest.requirement_drafting.sources]
          .filter((source, index, all) => all.findIndex(item => item.path === source.path && item.sha256 === source.sha256) === index)
          .map(source => <div className="agent-context-source" key={`${source.path}:${source.sha256}`}><span>{source.path}</span><small>{source.sent_characters < source.available_characters ? `First ${source.sent_characters} of ${source.available_characters} characters used` : "Full extracted text used"} · revision {source.sha256?.slice(0, 12) || "unavailable"}</small></div>)}
        <p>{project.agentRun.context_manifest.note}</p>
      </details>}
      {project.workspaceId && <details className="agent-context-review" onToggle={event => setPastAgentRunsOpen(event.currentTarget.open)}>
        <summary>Earlier BA Mate proposals</summary>
        {pastAgentRunError && <p role="alert">{pastAgentRunError}</p>}
        {!pastAgentRuns && !pastAgentRunError && <p>Loading earlier runs…</p>}
        {pastAgentRuns?.length === 0 && <p>No earlier proposals for this project.</p>}
        {pastAgentRuns?.slice().reverse().map((run, index) => <details className="agent-prior-run" key={`${run.signature}:${index}`}>
          <summary>{run.context_manifest?.created_at ? new Date(run.context_manifest.created_at).toLocaleString() : "Earlier run"} · {Object.values(run.roles).filter(role => role.status === "ready").length} completed roles</summary>
          <p>{run.context_manifest ? `${run.context_manifest.source_intake.sources.length} tentative source extracts · ${run.context_manifest.requirement_drafting.sources.length} selected source revisions` : "Context details were not captured for this earlier run."}</p>
          {Object.entries(run.roles).filter(([, role]) => role.proposal).map(([name, role]) => <details className="agent-prior-proposal" key={name}><summary>{name.replaceAll("_", " ")}</summary><pre>{JSON.stringify(role.proposal, null, 2)}</pre></details>)}
        </details>)}
      </details>}
      {project.agentRun?.status === "ready" && pendingSuggestionCount > 0 &&
        <details className="overview-agent-review" aria-label="BA Mate suggestions for review">
          <summary><span className="eyebrow">Background task roles</span><strong>Suggestions awaiting your direction</strong><small>{pendingSuggestionCount} proposals · Open to review and adopt</small></summary>
          {suggestedDrafts.length > 0 && <details className="setup-agent-suggestions agent-suggestion-group"><summary>Working requirement drafts <small>{suggestedDrafts.length}</small></summary><p>Adoption creates an editable draft and pending source links. Review support and criteria before approval.</p>{suggestedDrafts.map(draft => {
            const staleSource = draft.source_paths.some(path => !goal || !project.sources.some(source => source.relativePath === path && goalSourceCurrent(goal, source)));
            return <div className="setup-agent-question" key={`${draft.title}:${draft.statement}`}><span><strong>{draft.title}</strong><small>{draft.statement}</small></span><div className="agent-suggestion-actions"><Button disabled={!goal || staleSource} onClick={() => update(p => {
              const currentGoal = activeGoal(p);
              if (!currentGoal) return;
              const sourceIds = draft.source_paths.map(path => p.sources.find(source => source.relativePath === path && goalSourceCurrent(currentGoal, source))?.id).filter((id): id is string => Boolean(id));
              if (sourceIds.length !== draft.source_paths.length) return;
              const id = uid(draft.kind === "Functional" ? "FR" : "NFR");
              p.requirements.push({ id, kind: draft.kind, title: draft.title, statement: draft.statement,
                priority: draft.priority, status: "draft", owner: "Business analyst", sourceIds, storyIds: [], checkIds: [],
                version: 1, rationale: draft.rationale, businessValue: "", businessRules: [], fitCriteria: [],
                dependencies: [], stakeholders: [], openQuestions: [], comments: [], syncStatus: "Not included", goalId: currentGoal.id });
              sourceIds.forEach(sourceId => p.traceLinks.push({ id: uid("TR"), from: sourceId, to: id,
                relation: "Proposed support", status: "Pending", goalId: currentGoal.id }));
              addAudit(p, "Adopted AI requirement draft", id, `${draft.title}; ${sourceIds.length} source links await human verification.`);
            })}>{staleSource ? "Review sources first" : "Adopt draft"}</Button><Button onClick={() => dismissSuggestion("draft", `${draft.title}:${draft.statement}`)}>Reject</Button></div></div>;
          })}</details>}
          {suggestedQuestions.length > 0 && <details className="setup-agent-suggestions agent-suggestion-group"><summary>Questions for people to answer <small>{suggestedQuestions.length}</small></summary><p>Compare suggested questions with existing ones before tracking them. <button className="text-button" onClick={() => go("workflow")}>Open clarification queue</button></p>{suggestedQuestions.map(question => {
            const matches = similarQuestions(question, project.clarifications);
            return <div className="setup-agent-question" key={question}><span>{question}{matches.length > 0 && <small className="suggestion-similar">Possible overlap: {matches.map(({ item }) => `${item.id} (${item.status}): ${item.question}`).join(" · ")}</small>}</span><div className="agent-suggestion-actions"><Button label={`Track question: ${question}`} onClick={() => update(p => {
              const id = uid("CQ"); p.clarifications.push({ id, priority: "Important", question,
                rationale: "Suggested by BA Mate from tentative project context; confirm with the responsible person.",
                sourceId: "PROJECT-BRIEF", owner: "Business analyst", status: "Unanswered", suggestions: [], affects: [], goalId: goal?.id });
              addAudit(p, "Adopted clarification question", id, question);
            })}>Track question</Button><Button label={`Reject question: ${question}`} onClick={() => dismissSuggestion("question", question)}>Reject</Button></div></div>;
          })}</details>}
          {suggestedGoals.length > 0 && <details className="setup-agent-suggestions agent-suggestion-group"><summary>Possible next work <small>{suggestedGoals.length}</small></summary><p>Open goal setup and select a suggestion there to use it.</p>{suggestedGoals.map(suggestion =>
            <div className="setup-agent-question" key={`${suggestion.kind}:${suggestion.title}`}><span><strong>{suggestion.title}</strong><small>{suggestion.reason}</small></span><div className="agent-suggestion-actions"><Button onClick={() => go("goals?new=1")}>Open goal setup</Button><Button onClick={() => dismissSuggestion("goal", `${suggestion.kind}:${suggestion.title}`)}>Reject</Button></div></div>)}</details>}
          {suggestedPolicies.length > 0 && <details className="setup-agent-suggestions agent-suggestion-group"><summary>Governance to review <small>{suggestedPolicies.length}</small></summary>{suggestedPolicies.map(point =>
            <div className="setup-agent-question" key={point}><span>{point}</span><div className="agent-suggestion-actions"><Button onClick={() => go("team")}>Review settings</Button><Button onClick={() => dismissSuggestion("governance", point)}>Reject</Button></div></div>)}</details>}
        </details>}
      <WorkflowStrip project={project} onSelect={() => go(goal ? "workflow" : "goals")} />
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
                  {e.detail && <small className="activity-detail" title={e.detail}>{e.detail}</small>}
                  <small>{e.actor} · {formatWorkspaceTime(e.at)}</small>
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
  if (!goal) return <Card className="workflow-card" title="Goal workflow" description={project.goals.length ? "No active goal. Open saved goals to review completed work or start a new goal." : "Start a goal to initialize its workflow."}><Button onClick={onSelect}>{project.goals.length ? "Manage goals" : "Start a goal"}</Button></Card>;
  const gateIndex = goal.gateIndex;
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
            aria-label={`${gate}: ${index < gateIndex ? "complete" : index === gateIndex ? "in progress" : "not started"}. Open current workflow`}
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

function StageReadinessChecklist({
  gate,
  items,
  onNavigate,
}: {
  gate: WorkflowGate;
  items: StageReadinessItem[];
  onNavigate: (route: string) => void;
}) {
  const complete = items.filter((item) => item.complete).length;
  return (
    <Card
      className="stage-readiness-card"
      title={`${gate} completion checklist`}
      description="Complete these required outcomes before moving to the next stage."
      actions={
        <Badge tone={complete === items.length ? "success" : "warning"}>
          {complete} of {items.length} complete
        </Badge>
      }
    >
      <div className="stage-readiness-list">
        {items.map((item) => (
          <div className={item.complete ? "complete" : "incomplete"} key={item.id}>
            {item.complete ? <CheckCircle2 /> : <Clock3 />}
            <span>
              <b>{item.label}</b>
              <small>{item.description}</small>
            </span>
            {!item.complete && (
              <Button kind="ghost" label={`Open ${item.label}`} onClick={() => onNavigate(item.route)}>
                Open <ArrowRight size={15} />
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function WorkflowView({
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
  const clarificationQueueRef = useRef<HTMLDivElement>(null);
  const goal = activeGoal(project);
  const goalQuestions = project.clarifications.filter(q => !goal || !q.goalId || q.goalId === goal.id);
  const visible = goalQuestions.filter(q => filter === "All" || q.priority === filter);
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
        patch.status === "Answered" ? `Answer recorded; confirmed by ${patch.answerAuthority?.trim() || "not recorded"} (self-reported).` : `Status changed to ${patch.status ?? q?.status}.`,
      );
    });
    const label =
      patch.status === "Unanswered" && patch.question
        ? "Question changed — answer needs reconfirmation"
        : patch.status === "Answered"
        ? "Answer recorded"
        : patch.status === "Deferred"
          ? "Clarification deferred"
          : patch.status === "Discarded"
            ? "Clarification discarded"
            : patch.status === "Unanswered"
              ? "Clarification restored"
              : "Clarification updated";
    appNotice(`${id} was updated in the active goal.`, "success", label);
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
  const readinessItems: StageReadinessItem[] = [
    ...stageReadiness(project, goal?.gate ?? project.gate),
    ...(evaluationRunId
      ? [
          {
            id: "stage-feedback",
            label: "Stage feedback submitted",
            description:
              "Complete the study ratings for this stage before continuing.",
            complete: hasStageFeedback,
            route: "evaluation",
          },
        ]
      : []),
  ];
  const readinessIssues = readinessItems
    .filter((item) => !item.complete)
    .map((item) => item.label);
  const advance = () => {
    if (!canAdvanceStage(project) || readinessIssues.length) {
      notify(
        `Complete: ${readinessIssues.join(", ") || stageReadinessIssues(project).join(", ")}.`,
        "warning",
        "Stage is not ready",
      );
      return;
    }
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
    appNotice("The active goal advanced to its next governed stage.", "success", "Workflow advanced");
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
          <>
          <a className="button" href="#workbench-title"><Sparkles size={16} /> AI assistance</a>
          {goal && currentGateIndex === 5 ? <Button onClick={() => go("goals")}>Manage goal completion <ArrowRight size={17} /></Button> :
          <Button
            kind="primary"
            disabled={
              !goal || currentGateIndex === 5 || readinessIssues.length > 0
            }
            title={
              readinessIssues.length
                ? `Complete before advancing: ${readinessIssues.join(", ")}`
                : undefined
            }
            onClick={advance}
          >
            {`Advance to ${gates[Math.min(5, currentGateIndex + 1)]}`}{" "}
            <ArrowRight size={17} />
          </Button>}
          </>
        }
      />
      <StageReadinessChecklist
        gate={goal?.gate ?? project.gate}
        items={readinessItems}
        onNavigate={route => { if (route === "workflow") { setFilter("All"); clarificationQueueRef.current?.scrollIntoView({ block: "start" }); clarificationQueueRef.current?.focus({ preventScroll: true }); } else go(route); }}
      />
      <div className="workspace-split">
        <div ref={clarificationQueueRef} tabIndex={-1}>
          <Card
            title="Clarification queue"
            description="Accept, edit, answer, defer or discard suggestions for the active goal."
            actions={
              <div className="segmented" role="group" aria-label="Filter clarifications by priority">
                {(["All", "Blocking", "Important", "Optional"] as const).map(
                  (x) => (
                    <button
                      className={filter === x ? "active" : ""}
                      aria-pressed={filter === x}
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
              {goalQuestions.map((q) => (
                <div key={`${project.id}:${q.id}`} hidden={filter !== "All" && q.priority !== filter}><ClarificationCard
                  item={q}
                  projectId={project.id}
                  onUpdate={(patch) => updateQuestion(q.id, patch)}
                /></div>
              ))}
            </div>
            {visible.length === 0 && (
              <EmptyState
                icon={<CircleHelp />}
                title={filter === "All" ? "No clarifications yet" : `No ${filter.toLowerCase()} clarifications`}
                description={filter === "All" ? "Add a clarification or use AI assistance to identify questions for this goal." : "Choose another priority or show all clarifications."}
                action={filter !== "All" ? <Button onClick={() => setFilter("All")}>Show all clarifications</Button> : undefined}
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
                appNotice(
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
                  <b>{goal?.sourceIds.filter(id => project.sources.some(source => source.id === id && goalSourceCurrent(goal, source))).length ?? 0} current sources</b>
                  <small>{goal && goal.sourceIds.some(id => !project.sources.some(source => source.id === id && goalSourceCurrent(goal, source)))
                    ? "Some selected sources need review" : "Goal-specific context scope"}</small>
                </span>
              </div>
            </div>
            <Button className="full" onClick={() => go("goals")}>
              Manage project goals
            </Button>
          </Card>
        </aside>
      </div>
      <WorkflowStrip project={project} onSelect={() => {}} />
      <WorkflowWorkbench project={project} update={update} />
    </>
  );
}

const clarificationDrafts = new Map<string, { answer: string; authority: string; base: string }>();

export function ClarificationCard({
  item,
  onUpdate,
  projectId,
}: {
  item: Clarification;
  onUpdate: (patch: Partial<Clarification>) => void;
  projectId?: string;
}) {
  const draftKey = projectId ? JSON.stringify([projectId, item.id]) : undefined;
  const base = JSON.stringify([item.question, item.answer, item.answerAuthority, item.status, item.version]);
  const cached = draftKey ? clarificationDrafts.get(draftKey) : undefined;
  const initialAnswer = item.answer ?? "";
  const initialAuthority = item.status === "Answered" ? item.answerAuthority ?? "" : "";
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(item.question);
  const [custom, setCustom] = useState(cached?.answer ?? initialAnswer);
  const [authority, setAuthority] = useState(cached?.authority ?? initialAuthority);
  const updateDraft = (answer: string, confirmedBy: string) => {
    setCustom(answer);
    setAuthority(confirmedBy);
    if (draftKey) {
      if (answer === initialAnswer && confirmedBy === initialAuthority) clarificationDrafts.delete(draftKey);
      else clarificationDrafts.set(draftKey, { answer, authority: confirmedBy, base });
    }
  };
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
        <textarea
          aria-label={`Question for ${item.id}`}
          className="title-input"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onBlur={() => {
            const revised = question.trim();
            if (!revised) setQuestion(item.question);
            else if (revised !== item.question) {
              if (item.status === "Answered") {
                setAuthority("");
                onUpdate({ question: revised, status: "Unanswered" });
              } else onUpdate({ question: revised });
            }
            setEditing(false);
          }}
          autoFocus
        />
      ) : (
        <h3>{item.question}</h3>
      )}
      <p>{item.rationale}</p>
      <div className="provenance">
        <Link2 size={14} /> Recorded context: {(item.sourceIds?.length ? item.sourceIds : [item.sourceId]).join(", ")}
        <span>Owner: {item.owner}</span>
        {item.status === "Answered" && <span>Answer confirmed by: {item.answerAuthority || "Not recorded"}</span>}
        {item.status === "Unanswered" && item.answer && <span>Previous answer needs reconfirmation; previously attributed to: {item.answerAuthority || "Not recorded"}</span>}
        {item.affects.length > 0 && <span>Affects: {item.affects.join(", ")}</span>}
      </div>
      {item.status !== "Discarded" && (
        <div className="answer-options">
          {item.suggestions.slice(0, 2).map((s) => (
            <button
              key={s}
              className={item.answer === s ? "selected" : ""}
              onClick={() => {
                updateDraft(s, authority);
              }}
            >
              {s}
            </button>
          ))}
          <div className="clarification-answer-form">
            <label className="clarification-answer-field">Answer
            <textarea
              value={custom}
              onChange={(e) => updateDraft(e.target.value, authority)}
              placeholder="Enter the confirmed answer…"
              aria-label={`Answer for ${item.id}`}
              rows={3}
            />
            </label>
            <label className="clarification-authority-field">Confirmed by <input value={authority} onChange={(e) => updateDraft(custom, e.target.value)} placeholder="Stakeholder name or role" aria-label={`Answer confirmed by for ${item.id}`} /></label>
            <small>Record who confirmed the answer; BA Mate does not authenticate that identity.</small>
            {draftKey && clarificationDrafts.has(draftKey) && <small role="status">Answer not saved or included in backups. It stays available while BA Mate is open; save it before closing or reloading.</small>}
            {cached && cached.base !== base && <small role="alert">This question or its saved answer changed since the draft was started. Review the answer and who confirmed it before saving.</small>}
            {draftKey && clarificationDrafts.has(draftKey) && <button type="button" onClick={() => { clarificationDrafts.delete(draftKey); setCustom(initialAnswer); setAuthority(initialAuthority); }}>Discard answer draft</button>}
            <Button
              kind="primary"
              disabled={!custom.trim() || !authority.trim()}
              onClick={() => { if (draftKey) clarificationDrafts.delete(draftKey); onUpdate({ answer: custom.trim(), answerAuthority: authority.trim(), status: "Answered" }); }}
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
        <button onClick={() => { if (draftKey) clarificationDrafts.delete(draftKey); onUpdate({ status: "Discarded" }); }}>
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

const folderSourceFingerprint = (project: Project) => JSON.stringify([project.id, project.workspaceId, project.workspaceKind, project.workspacePath, project.workspaceFolders, project.sources]);
const workspaceLocationFingerprint = (project: Project) => JSON.stringify([project.id, project.workspaceId, project.workspaceKind, project.workspacePath]);

function useFolderConnection(project: Project, update: (fn: (p: Project) => void) => void) {
  const [connecting, setConnecting] = useState(false);
  const [pending, setPending] = useState<{ workspaceId: string; folderName: string; path: string; missing: number }>();
  useEffect(() => {
    if (!pending) return;
    if (project.workspaceId === pending.workspaceId) {
      const message = pending.missing
        ? `${pending.folderName} is connected. ${pending.missing} source original${pending.missing === 1 ? " is" : "s are"} unavailable; reconnect and review ${pending.missing === 1 ? "it" : "them"} in Sources.`
        : `${pending.folderName} is connected and contains the available source originals.`;
      appNotice(message, pending.missing ? "warning" : "success", "Project folder connected");
    } else {
      appNotice(`The project or sources changed while copying. The project folder was not switched. A copy may be at ${pending.path}; review it before retrying.`, "warning", "Folder connection needs review");
    }
    setPending(undefined);
  }, [pending, project]);
  const connect = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      const original = folderSourceFingerprint(project);
      const candidate = await chooseProjectFolder();
      if (!candidate) return;
      const copy = await copyProjectToWorkspace(project, candidate);
      setPending({ workspaceId: copy.workspaceId!, folderName: copy.folderName, path: copy.workspacePath || copy.folderName, missing: copy.sources.filter(source => !source.relativePath && !source.originalBase64).length });
      update(p => {
        if (folderSourceFingerprint(p) !== original) return;
        p.folderName = copy.folderName;
        p.workspaceId = copy.workspaceId;
        p.workspaceKind = copy.workspaceKind;
        p.workspacePath = copy.workspacePath;
        p.workspaceFolders = copy.workspaceFolders;
        for (const source of p.sources) {
          const moved = copy.sources.find(item => item.id === source.id);
          if (moved) { source.relativePath = moved.relativePath; source.originalBase64 = moved.originalBase64; source.approved = moved.approved; source.status = moved.status; }
        }
        addAudit(p, "Connected project folder", copy.folderName, "Available source originals were copied to the connected folder; unavailable originals require review.");
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) appNotice(error instanceof Error ? error.message : "The folder could not be connected.", "danger", "Folder connection failed");
    } finally { setConnecting(false); }
  };
  return { connect, connecting };
}

export function SourcesView({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
}) {
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const reattachInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | undefined>(project.sources[0]?.id);
  const [missingSource, setMissingSource] = useState<string>();
  const source = project.sources.find((s) => s.id === selected);
  const goal = activeGoal(project);
  const [sourceQuery, setSourceQuery] = useState("");
  const [selectedPassage, setSelectedPassage] = useState<{ sourceId: string; locator: string; text: string }>();
  const passageRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const id = new URLSearchParams(location.search).get("artifact"); if (!id) { setMissingSource(undefined); return; } if (project.sources.some(item => item.id === id)) { setSelected(id); setMissingSource(undefined); setSourceQuery(""); } else { setSelected(undefined); setMissingSource(id); } }, [location.search, project.id]);
  useEffect(() => { if (!missingSource && !project.sources.some(item => item.id === selected)) setSelected(project.sources[0]?.id); }, [project.sources, selected, missingSource]);
  const searchResults = useMemo(() => {
    return searchSourcePassages(project.sources, sourceQuery);
  }, [project.sources, sourceQuery]);
  useEffect(() => { if (selectedPassage && selectedPassage.sourceId === source?.id) passageRef.current?.focus(); }, [selectedPassage, source?.id]);
  const [extracting, setExtracting] = useState(false);
  const { connect: chooseFolder, connecting: connectingFolder } = useFolderConnection(project, update);
  const [verifyingSource, setVerifyingSource] = useState<string>();
  const [pendingSourceOperation, setPendingSourceOperation] = useState<
    | { kind: "reattach"; id: string; hash?: string; path: string; workspaceId?: string; location: string }
    | { kind: "import"; ids: string[]; workspaceId: string; location: string; skipped: number }
  >();
  useEffect(() => {
    if (!pendingSourceOperation) return;
    if (pendingSourceOperation.kind === "reattach") {
      const item = project.sources.find(source => source.id === pendingSourceOperation.id);
      if (project.workspaceId === pendingSourceOperation.workspaceId && item?.relativePath === pendingSourceOperation.path && item.sha256 === pendingSourceOperation.hash) {
        appNotice("The matching original was copied into the project folder. Review the extraction and any affected evidence links before using it.", "info", "Original reattached");
      } else {
        appNotice(`The source or project folder changed while copying. The source was not reattached; check ${pendingSourceOperation.location} for the copied file before trying again.`, "warning", "Original needs review");
      }
    } else if (project.workspaceId === pendingSourceOperation.workspaceId && pendingSourceOperation.ids.every(id => project.sources.some(source => source.id === id))) {
      setSelected(pendingSourceOperation.ids.at(-1));
      notify("Sources imported and copied into the project folder. Review extracted text before approval.", "success");
      if (pendingSourceOperation.skipped) notify(`${pendingSourceOperation.skipped} unsupported or hidden file${pendingSourceOperation.skipped === 1 ? " was" : "s were"} skipped.`, "warning");
    } else {
      appNotice(`The project folder or its sources changed during import. The source records were not added; check ${pendingSourceOperation.location} for copied files before retrying.`, "warning", "Source import needs review");
    }
    setPendingSourceOperation(undefined);
  }, [pendingSourceOperation, project]);
  const reattach = async (file?: File) => {
    if (!file || !source || verifyingSource || extracting || connectingFolder || pendingSourceOperation) return;
    const targetId = source.id, expectedHash = source.sha256;
    const originalWorkspace = workspaceLocationFingerprint(project);
    const originalSource = JSON.stringify(source);
    setVerifyingSource(targetId);
    try {
      const path = await reattachSourceOriginal(project, source, file);
      setPendingSourceOperation({ kind: "reattach", id: targetId, hash: expectedHash, path, workspaceId: project.workspaceId, location: project.workspacePath || project.folderName });
      update(p => {
        const item = p.sources.find(candidate => candidate.id === targetId);
        if (!item || workspaceLocationFingerprint(p) !== originalWorkspace || JSON.stringify(item) !== originalSource || item.relativePath || item.originalBase64 || item.sha256 !== expectedHash) return;
        item.relativePath = path;
        item.analysisSignature = undefined;
        item.approved = false;
        item.status = "Needs review";
        for (const linkedGoal of p.goals) if (linkedGoal.sourceRevisionPins) delete linkedGoal.sourceRevisionPins[item.id];
        item.extractionLimitations = (item.extractionLimitations ?? []).filter(note => !note.startsWith("The original file is unavailable in this backup."));
        addAudit(p, "Reattached matching original", targetId, `${path}; extraction and linked evidence require review.`);
      });
    } catch (error) { appNotice(error instanceof Error ? error.message : "The original could not be reattached.", "warning", "Original not reattached"); }
    finally { setVerifyingSource(undefined); if (reattachInputRef.current) reattachInputRef.current.value = ""; }
  };
  const attach = async (files: FileList | null) => {
    if (!files?.length || extracting || verifyingSource || connectingFolder || pendingSourceOperation) return;
    const selectedFiles = Array.from(files).filter(file => isSupportedSourceName(file.name));
    const skipped = files.length - selectedFiles.length;
    if (!selectedFiles.length) { notify("This selection does not contain a supported source file.", "warning"); if (inputRef.current) inputRef.current.value = ""; if (folderInputRef.current) folderInputRef.current.value = ""; return; }
    setExtracting(true);
    const originalWorkspace = workspaceLocationFingerprint(project);
    try {
      const imported: { file: File; result: Awaited<ReturnType<typeof importSource>> }[] = [];
      for (const file of selectedFiles) {
        const result = await importSource(file);
        imported.push({ file, result });
      }
      const reference = await ensureProjectWorkspace(project);
      const written = await writeProjectFiles(reference, imported.map(({ file, result }) => ({ name: file.name, relativePath: file.webkitRelativePath || `Uploaded Sources/${file.name}`, data: result.original_base64 })));
      const created = imported.map((item, index) => ({ ...item, sourceId: uid("SRC"), storedPath: written[index] ?? (item.file.webkitRelativePath || `Uploaded Sources/${item.file.name}`) }));
      setPendingSourceOperation({ kind: "import", ids: created.map(item => item.sourceId), workspaceId: reference.workspaceId, location: reference.displayPath || reference.folderName, skipped });
      update(p => {
        if (workspaceLocationFingerprint(p) !== originalWorkspace || created.some(item => p.sources.some(source => source.relativePath === item.storedPath))) return;
        p.workspaceId = reference.workspaceId;
        p.workspaceKind = reference.workspaceKind;
        p.workspacePath = reference.displayPath;
        p.folderName = reference.folderName;
        for (const { file, result, sourceId, storedPath } of created) {
          p.sources.push({ id: sourceId, name: storedPath.split("/").at(-1) ?? file.name, relativePath: storedPath, type: sourceTypeForName(file.name), status: "Needs review", classification: "Project only", provenance: "Imported on " + new Date().toISOString(), concepts: [], approved: false, immutable: true, content: result.content, sha256: result.sha256, version: 1, passages: result.passages, extractionLimitations: result.limitations });
          addAudit(p, "Extracted source for review", sourceId, `${file.name}; original copied into the project folder and retained for review.`);
        }
      });
    } catch (e) { notify((e as Error).message, "danger", "Source import failed"); }
    finally { setExtracting(false); if (inputRef.current) inputRef.current.value = ""; if (folderInputRef.current) folderInputRef.current.value = ""; }
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
              multiple
              accept={SOURCE_ACCEPT}
              onChange={(e) => attach(e.target.files)}
            />
            <input
              ref={(node) => { folderInputRef.current = node; if (node) node.setAttribute("webkitdirectory", ""); }}
              hidden
              type="file"
              multiple
              aria-label="Add a folder of project sources"
              accept={SOURCE_ACCEPT}
              onChange={(e) => attach(e.target.files)}
            />
            <Button onClick={chooseFolder} disabled={connectingFolder || extracting || !!verifyingSource || !!pendingSourceOperation}>
              <Folder size={17} /> Connect folder
            </Button>
            <Button kind="primary" disabled={connectingFolder || extracting || !!verifyingSource || !!pendingSourceOperation} onClick={() => inputRef.current?.click()}>
              <Upload size={17} /> Add files
            </Button>
            <Button disabled={connectingFolder || extracting || !!verifyingSource || !!pendingSourceOperation} onClick={() => folderInputRef.current?.click()}>
              <Folder size={17} /> Add folder
            </Button>
          </>
        }
      />
      <div className="source-search-panel">
        <label><Search size={17} /><input aria-label="Search project source text" value={sourceQuery} onChange={event => setSourceQuery(event.target.value)} placeholder="Search files and extracted text across this project…" />{sourceQuery && <button type="button" onClick={() => setSourceQuery("")} aria-label="Clear source search"><X size={16} /></button>}</label>
        {sourceQuery.trim().length >= 2 && <div className="source-search-results" role="status">{searchResults.length ? searchResults.map(({ source: item, passage, before, match, after, nameMatch }, index) => <button key={`${item.id}:${passage.locator}:${index}`} onClick={() => { setMissingSource(undefined); setSelected(item.id); setSelectedPassage({ sourceId: item.id, locator: passage.locator, text: passage.text }); }}><b>{item.relativePath ?? item.name} · {passage.locator}</b><span>{before}{match && <mark>{match}</mark>}{after}</span><small>{nameMatch ? "Filename match · " : "Search preview; spacing normalized · "}{item.approved ? "Reviewed source" : "Unreviewed extraction — verify before using as evidence"}</small></button>) : <p>No matching extracted text. Files without readable text may need a transcript or OCR copy.</p>}</div>}
      </div>
      {extracting && <p role="status">Reading source contents…</p>}
      {missingSource && <p role="status" className="context-note warning">{missingSource} is no longer available. Choose another source from the list.</p>}
      <div className="source-layout">
        <Card
          title={`${project.sources.length} project ${project.sources.length === 1 ? "source" : "sources"}`}
          description={`${project.sources.filter((s) => s.approved).length} approved for retrieval`}
        >
          <div className="source-table">
            {project.sources.map((s) => (
              <button
                key={s.id}
                className={s.id === selected ? "active" : ""}
                onClick={() => { setMissingSource(undefined); setSelected(s.id); setSelectedPassage(undefined); }}
              >
                <i>
                  <FileText size={19} />
                </i>
                <span>
                  <b>{s.name}</b>
                  <small>
                    {s.id} · {s.type} · {s.relativePath ?? s.provenance}
                  </small>
                </span>
                <StatusBadge value={s.status} />
                <em>{s.approved ? "Included" : s.status === "Excluded" ? "Excluded" : "Awaiting review"}</em>
              </button>
            ))}
          </div>
        </Card>
        {source && (
          <Card className="source-detail">
            {!source.relativePath && !source.originalBase64 && <div className="context-note warning">
              <strong>Original source unavailable</strong>
              <p>{source.sha256 ? "Choose the exact original to reconnect it to this record. Its file hash must match; review is still required." : "This record has no file hash. Add the source as a new file and review the evidence links."}</p>
              <input ref={reattachInputRef} type="file" hidden aria-label="Choose matching original" onChange={event => void reattach(event.target.files?.[0])} />
              {source.sha256 && <Button disabled={!!verifyingSource || extracting || connectingFolder || !!pendingSourceOperation} onClick={() => reattachInputRef.current?.click()}>{verifyingSource === source.id ? "Checking original…" : "Reattach matching original"}</Button>}
            </div>}
            <header className="detail-heading">
              <div>
                <FileCheck2 />
                <span>
                  <h2>{source.name}</h2>
                  <p>{source.id} · {source.originalBase64 || source.relativePath && project.workspaceId ? "Original in project folder" : "Original unavailable"}</p>
                </span>
              </div>
              <div className="source-review-controls">
                <label className="switch-row source-approval">
                  <span><b>Accept extracted source for this project</b><small>Compare the extracted text with the original first. This does not confirm every claim in the file.</small></span>
                  <input type="checkbox" role="switch" checked={source.approved && source.status === "Analyzed"}
                    disabled={!source.content || !source.sha256 || verifyingSource === source.id}
                    onChange={event => { const include = event.target.checked; void (async () => {
                      if (include) {
                        setVerifyingSource(source.id);
                        try { await verifySourceOriginal(project, source); }
                        catch (error) { appNotice(error instanceof Error ? error.message : "The original could not be checked.", "warning", "Source review paused"); return; }
                        finally { setVerifyingSource(undefined); }
                      }
                      update(p => {
                        const item = p.sources.find(candidate => candidate.id === source.id);
                        if (!item || include && item.sha256 !== source.sha256) return;
                        item.approved = include;
                        item.status = include ? "Analyzed" : "Excluded";
                        if (!include) for (const linkedGoal of p.goals) {
                          linkedGoal.sourceIds = linkedGoal.sourceIds.filter(id => id !== item.id);
                          if (linkedGoal.sourceRevisionPins) delete linkedGoal.sourceRevisionPins[item.id];
                          const conversation = p.conversations.find(entry => entry.id === linkedGoal.conversationId);
                          if (conversation) conversation.context = conversation.context.filter(entry => entry.id !== item.id);
                        }
                        addAudit(p, include ? "Accepted source extraction" : "Excluded source context", item.id, item.relativePath ?? item.name);
                      });
                    })(); }} />
                </label>
                {goal && <label className="switch-row source-approval">
                  <span><b>Use for “{goal.title}”</b><small>{goal.sourceIds.includes(source.id) && !goalSourceCurrent(goal, source)
                    ? goalSelectableSource(source) ? "A new source revision is ready. Select it again for this goal." : "Previously selected; review the current file before BA Mate can use it again."
                    : "Choose this reviewed revision as evidence for the active goal."}</small></span>
                  <input type="checkbox" role="switch" checked={goalSourceCurrent(goal, source)}
                    disabled={!goalSelectableSource(source) || verifyingSource === source.id}
                    onChange={event => { const include = event.target.checked; void (async () => {
                      if (include) {
                        setVerifyingSource(source.id);
                        try { await verifySourceOriginal(project, source); }
                        catch (error) { appNotice(error instanceof Error ? error.message : "The original could not be checked.", "warning", "Goal source review paused"); return; }
                        finally { setVerifyingSource(undefined); }
                      }
                      update(p => {
                        const item = p.sources.find(candidate => candidate.id === source.id);
                        const currentGoal = activeGoal(p);
                        if (!item || !currentGoal || include && (!goalSelectableSource(item) || item.sha256 !== source.sha256)) return;
                        currentGoal.sourceIds = include ? [...new Set([...currentGoal.sourceIds, item.id])] : currentGoal.sourceIds.filter(id => id !== item.id);
                        currentGoal.sourceRevisionPins ??= {};
                        if (include) currentGoal.sourceRevisionPins[item.id] = item.sha256!;
                        else delete currentGoal.sourceRevisionPins[item.id];
                        const conversation = p.conversations.find(entry => entry.id === currentGoal.conversationId);
                        if (conversation) conversation.context = include
                          ? [...conversation.context.filter(entry => entry.id !== item.id), { id: item.id, type: "Source", label: item.name, origin: "attached", removable: true, route: "sources" }]
                          : conversation.context.filter(entry => entry.id !== item.id);
                        addAudit(p, include ? "Selected source for goal" : "Removed source from goal", currentGoal.id, item.relativePath ?? item.name);
                      });
                    })(); }} />
                </label>}
              </div>
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
            {selectedPassage?.sourceId === source.id && <div ref={passageRef} tabIndex={-1} className="source-selected-passage"><h3>Selected passage · {selectedPassage.locator}</h3><p>This is the original extracted passage. Compare it with the source before relying on it.</p><pre className="source-transcript">{selectedPassage.text}</pre><button type="button" onClick={() => setSelectedPassage(undefined)}>Close passage</button></div>}
            <h3>Extracted source text</h3>
            <pre className="source-transcript">{source.content || source.extractionLimitations?.[0] || "The original is stored, but no searchable text is available."}</pre>
            {(source.originalBase64 || source.relativePath && project.workspaceId && project.workspaceKind) && <Button onClick={() => { void (async () => {
              try {
                const original = source.relativePath && project.workspaceId && project.workspaceKind
                  ? await readProjectOriginal({ workspaceId: project.workspaceId, workspaceKind: project.workspaceKind,
                    folderName: project.folderName, displayPath: project.workspacePath }, source.relativePath)
                  : { name: source.name, data: source.originalBase64! };
                const bytes = Uint8Array.from(atob(original.data), c => c.charCodeAt(0));
                downloadBlob(new Blob([bytes]), original.name);
              } catch (error) { appNotice(error instanceof Error ? error.message : "The original could not be opened.", "danger"); }
            })(); }}>Download original source</Button>}
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
                  {source.extractionLimitations?.join(" ") || "Check the extracted text against the original file. Approve only sources suitable for this task."}
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
    appNotice(
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
      <div className="tabs" role="tablist" aria-label="Project registers" onKeyDown={onTabListKeyDown}>
        {types.map((type) => (
          <button
            role="tab"
            aria-selected={active === type}
            tabIndex={active === type ? 0 : -1}
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
              <b className="register-id">{item.id}</b>
              <textarea
                aria-label={`${item.id} title`}
                rows={2}
                value={item.title}
                onChange={(e) =>
                  update((p) => {
                    const x = p.registers.find((r) => r.id === item.id)!;
                    x.title = e.target.value;
                  })
                }
              />
              <span className="register-owner">{item.owner}</span>
              <span className="register-impact">
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
              <span className="register-status"><StatusBadge value={item.status} /></span>
              <button
                type="button"
                className="icon-button register-actions-toggle"
                aria-label={`Edit details for ${item.id}`}
                aria-expanded={actionsFor === item.id}
                onClick={() =>
                  setActionsFor((current) =>
                    current === item.id ? undefined : item.id,
                  )
                }
              >
                <span>Edit details</span>
                <ChevronDown size={17} />
              </button>
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
            appNotice("The register item was deleted.", "success");
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
  const location = useLocation();
  const [selectedLink, setSelectedLink] = useState<string | undefined>(project.traceLinks[0]?.id);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("artifact");
    if (!id) return;
    const links = project.traceLinks.filter(link => link.from === id || link.to === id);
    const match = links.find(link => link.status !== "Verified") ?? links[0];
    setSelectedLink(match?.id);
  }, [location.search, project.id]);
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string>();
  const [checkingLink, setCheckingLink] = useState(false);
  const checkingLinkRef = useRef(false);
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
  const inspectedSources = inspectedLink ? project.sources.filter(source => source.id === inspectedLink.from || source.id === inspectedLink.to) : [];
  const setLinkStatus = async (link: typeof project.traceLinks[number], status: typeof link.status) => {
    if (checkingLinkRef.current) return;
    if (status !== "Verified") {
      update(p => { const current = p.traceLinks.find(item => item.id === link.id); if (current) current.status = status; });
      return;
    }
    checkingLinkRef.current = true; setCheckingLink(true);
    try {
      if (!traceEndpointExists(project, link.from) || !traceEndpointExists(project, link.to)) throw new Error("A linked record is missing. Repair or remove this relationship before verification.");
      if (!passageIsCurrent(project, link)) throw new Error("Reselect the passage from the current source revision before verification.");
      const fingerprint = traceReviewFingerprint(project, link);
      for (const source of project.sources.filter(item => item.id === link.from || item.id === link.to)) {
        if (!source.approved || source.status !== "Analyzed") throw new Error(`${source.name}: review the source before verifying this link.`);
        try { await verifySourceOriginal(project, source); }
        catch (error) { throw new Error(`${source.name}: ${error instanceof Error ? error.message : "the original could not be checked."}`); }
      }
      update(p => {
        const current = p.traceLinks.find(item => item.id === link.id);
        if (!current || !traceEndpointExists(p, current.from) || !traceEndpointExists(p, current.to) || traceReviewFingerprint(p, current) !== fingerprint || !passageIsCurrent(p, current)) return;
        current.status = "Verified"; current.fromRevision = revisionOf(p, current.from); current.toRevision = revisionOf(p, current.to);
        addAudit(p, "Reviewed evidence link", current.id, "Marked verified after checking available source originals and current record revisions; semantic support is self-attested.");
      });
    } catch (error) {
      appNotice(error instanceof Error ? error.message : "The source original could not be checked.", "warning", "Link needs review");
    } finally { checkingLinkRef.current = false; setCheckingLink(false); }
  };
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
    appNotice(
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
    appNotice(
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
      {new URLSearchParams(location.search).get("artifact") && !project.traceLinks.some(link => link.from === new URLSearchParams(location.search).get("artifact") || link.to === new URLSearchParams(location.search).get("artifact")) && <p role="status" className="context-note">No evidence links were found for {new URLSearchParams(location.search).get("artifact")}. Add a link or choose an existing relationship below.</p>}
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
      <div className="metric-row trace-metrics">
        <Metric
          label="Coverage"
          value={`${traceCoverage(project)}%`}
          detail="Verified project links"
          tone="success"
        />
        <Metric
          label="Verified"
          value={
            project.traceLinks.filter((l) => traceDisplayStatus(project, l) === "Verified").length
          }
          detail="Healthy links"
          tone="success"
        />
        <Metric
          label="Pending"
          value={
            project.traceLinks.filter((l) => traceDisplayStatus(project, l) === "Pending").length
          }
          detail="Needs review"
          tone="warning"
        />
        <Metric
          label="Broken"
          value={project.traceLinks.filter((l) => traceDisplayStatus(project, l) === "Broken").length}
          detail="Must repair"
          tone="danger"
        />
      </div>
      <Card
        title="Traceability matrix"
        description="Select a relationship to review its evidence below. Scroll the list to see more links."
      >
        <div className="trace-table" role="region" aria-label="Traceability relationships" tabIndex={0}>
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
              <b className="trace-from">{link.from}</b>
              <span className="trace-relation">
                <ArrowRight size={14} />
                {link.relation}
              </span>
              <b className="trace-to">{link.to}</b>
              <span className="trace-status"><StatusBadge value={traceDisplayStatus(project, link)} /></span>
            </button>
          ))}
        </div>
        {inspectedLink && (
          <div className="trace-inspector">
            <Network />
            <div className="trace-summary">
              <b>
                {inspectedLink.id} · {inspectedLink.from}{" "}
                {inspectedLink.relation} {inspectedLink.to}
              </b>
              <p>
                Recorded review status: {inspectedLink.status}. The relationship is retained in the project traceability export and change-impact analysis.
              </p>
            </div>
            <span className="trace-inspector-status"><StatusBadge value={traceDisplayStatus(project, inspectedLink)} /></span>
            {(!traceEndpointExists(project, inspectedLink.from) || !traceEndpointExists(project, inspectedLink.to)) && <p role="alert">A linked record is missing. Repair or remove this relationship before verification.</p>}
            {inspectedLink.status === "Verified" && traceDisplayStatus(project, inspectedLink) === "Pending" && <p role="alert">The recorded verification is for older or incomplete evidence. Set the review status to Pending, then review the current records and verify again.</p>}
            {inspectedSources.map(inspectedSource => <div className="trace-source-review" key={inspectedSource.id}>
              <label><span>Add source passage from {inspectedSource.name} (optional)</span>
                <select value="" onChange={event => {
                  const locator = event.target.value;
                  if (!locator) return;
                  update(p => {
                    const link = p.traceLinks.find(item => item.id === inspectedLink.id);
                    const source = p.sources.find(item => item.id === inspectedSource.id);
                    if (!link || !source || (link.from !== source.id && link.to !== source.id) || (source.passages ?? []).filter(item => item.locator === locator).length !== 1) return;
                    const pins = sourcePassagePins(link).filter(pin => pin.sourceId !== source.id || pin.locator !== locator);
                    link.sourcePassage = undefined;
                    link.sourcePassages = [...pins, { sourceId: source.id, sourceRevision: revisionOf(p, source.id), locator }];
                    link.status = "Pending";
                    addAudit(p, "Changed evidence passage", link.id, `${source.id} ${locator}, revision ${revisionOf(p, source.id)} selected for review.`);
                  });
                }}>
                  <option value="">Select a passage</option>
                  {(inspectedSource.passages ?? []).filter((passage, _, all) => all.filter(item => item.locator === passage.locator).length === 1).map(passage => <option key={passage.locator} value={passage.locator}>{passage.locator}</option>)}
                </select>
              </label>
              <p>Selected locations record where to review, not proof that they support this link.</p>
              {sourcePassagePins(inspectedLink).map((pin, index) => pin.sourceId === inspectedSource.id && <div className="trace-passage" key={`${pin.sourceId}-${pin.locator}-${index}`}>
                <p>{passageLabel(project, { ...inspectedLink, sourcePassage: pin, sourcePassages: undefined })} <button className="button secondary" type="button" onClick={() => update(p => {
                  const link = p.traceLinks.find(item => item.id === inspectedLink.id);
                  if (!link) return;
                  const pins = sourcePassagePins(link);
                  if (JSON.stringify(pins[index]) !== JSON.stringify(pin)) return;
                  link.sourcePassages = pins.filter((_, i) => i !== index);
                  link.sourcePassage = undefined; link.status = "Pending";
                  addAudit(p, "Changed evidence passage", link.id, `${pin.sourceId} ${pin.locator} removed; review required.`);
                })}>Remove {pin.locator}</button></p>
                {passageIsCurrent(project, { ...inspectedLink, sourcePassage: pin, sourcePassages: undefined }) && <details><summary>Read {pin.locator}</summary><p>{inspectedSource.passages?.find(item => item.locator === pin.locator)?.text}</p></details>}
              </div>)}
              {!passageIsCurrent(project, inspectedLink) && <p role="alert">A selected passage no longer matches the current source revision. Reselect or remove it before verification.</p>}
            </div>)}
            <label>
              <span>Review status</span>
              <select
                value={inspectedLink.status}
                disabled={checkingLink}
                onChange={(event) => void setLinkStatus(inspectedLink, event.target.value as typeof inspectedLink.status)}
              >
                <option>Pending</option>
                <option disabled={!traceEndpointExists(project, inspectedLink.from) || !traceEndpointExists(project, inspectedLink.to) || !passageIsCurrent(project, inspectedLink)}>Verified</option>
                <option>Broken</option>
              </select>
              {checkingLink && <small>Checking source originals…</small>}
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
        title="Recorded relationships"
        description="These are the project's recorded links. Pending or broken links have not been verified; this list does not infer dependencies."
      >
        {project.traceLinks.length ? <ul className="recorded-relationships">
          {project.traceLinks.map(link => <li key={link.id}>
            <span>{link.from} → {link.to}</span> <span>{link.relation}</span> <StatusBadge value={traceDisplayStatus(project, link)} />
          </li>)}
        </ul> : <p className="context-note">No relationships have been recorded in this project.</p>}
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
            appNotice("The traceability relationship was deleted.", "success");
          }}
        />
      )}
    </>
  );
}

export function ChangesView({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
}) {
  const location = useLocation();
  const [selectedChange, setSelectedChange] = useState<string | undefined>(project.changes[0]?.id);
  const [missingChange, setMissingChange] = useState<string>();
  const [editing, setEditing] = useState(false);
  useEffect(() => { const id = new URLSearchParams(location.search).get("artifact"); setMissingChange(undefined); if (!id) return; setEditing(false); if (project.changes.some(item => item.id === id)) setSelectedChange(id); else { setSelectedChange(undefined); setMissingChange(id); } }, [location.search, project.id]);
  const [pendingDelete, setPendingDelete] = useState<string>();
  const [pendingChangeAction, setPendingChangeAction] = useState<{ kind: "accept" | "implement" | "revalidate"; changeId: string; patches: { id: string; after: string }[] }>();
  useEffect(() => {
    if (!pendingChangeAction) return;
    const current = project.changes.find(item => item.id === pendingChangeAction.changeId);
    const expectedStatus = pendingChangeAction.kind === "accept" ? "Accepted" : "Applied";
    const matches = current && pendingChangeAction.patches.every(expected => current.patches?.some(patch => patch.id === expected.id && patch.after === expected.after && patch.selected && patch.status === expectedStatus));
    const succeeded = matches && (pendingChangeAction.kind === "accept" ? current.status === "Approved" : pendingChangeAction.kind === "implement" ? current.status === "Implemented" : changeRevalidationIsCurrent(project, current));
    if (succeeded) {
      const message = pendingChangeAction.kind === "accept" ? `${current.id} is approved for implementation.`
        : pendingChangeAction.kind === "revalidate" ? "Revalidation was recorded. Create the new baseline from Activity & baselines."
        : activeGoal(project) ? `${current.id} created new working versions and returned the active goal to Validate.`
        : `${current.id} created new working versions. Start a goal to continue the workflow, and review the affected work before revalidation.`;
      appNotice(message, "success", pendingChangeAction.kind === "accept" ? "Patches approved" : pendingChangeAction.kind === "implement" ? "Change request applied" : "Change revalidated");
    } else {
      appNotice("The change or affected work changed during review. No confirmation was recorded; review the current state and try again.", "warning", "Change needs review");
    }
    setPendingChangeAction(undefined);
  }, [pendingChangeAction, project]);
  const impactOptions = [
    ...project.requirements.map((item) => ({ id: item.id, type: "Requirement" as const, name: item.title })),
    ...project.stories.map((item) => ({ id: item.id, type: "User story" as const, name: item.goal })),
    ...project.diagrams.map((item) => ({ id: item.id, type: "Diagram" as const, name: item.name })),
    ...project.documents.map((item) => ({ id: item.id, type: "Document" as const, name: item.name })),
  ];
  const [impactCandidate, setImpactCandidate] = useState(impactOptions[0]?.id ?? "");
  const selectedImpactOption = impactOptions.find(option => option.id === impactCandidate);
  const impactRuns = (project.aiRuns ?? []).filter(run => run.metadata.task === "impact" && run.status === "accepted");
  const [impactRunId, setImpactRunId] = useState(impactRuns[0]?.id ?? "");
  const change = missingChange ? undefined :
    project.changes.find((item) => item.id === selectedChange) ??
    project.changes[0];
  const implementedChange = !!change && ((change.patches ?? []).some(patch => patch.status === "Applied") || change.status === "Implemented" || change.status === "Revalidated");
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
    const initialFailure = change.status !== "Approved"
      ? "Review and accept the selected concrete patches before implementation."
      : !change.baselineId || !project.versions.some(version => version.id === change.baselineId && version.locked && version.type === "Baseline")
        ? "Select an existing approved baseline before implementing a change."
        : validateAcceptedPatches(project, change);
    if (initialFailure) { appNotice(initialFailure, "warning", "Change not implemented"); return; }
    const reviewedPatches = JSON.stringify((change.patches ?? []).filter(patch => patch.selected));
    setPendingChangeAction({ kind: "implement", changeId: change.id, patches: (change.patches ?? []).filter(patch => patch.selected && patch.status === "Accepted").map(({ id, after }) => ({ id, after })) });
    update((p) => {
      const cr = p.changes.find((c) => c.id === change.id);
      if (!cr || JSON.stringify((cr.patches ?? []).filter(patch => patch.selected)) !== reviewedPatches || cr.status !== "Approved" || !cr.baselineId || !p.versions.some(version => version.id === cr.baselineId && version.locked && version.type === "Baseline") || validateAcceptedPatches(p, cr)) return;
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
    appNotice(
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
                  baselineId: p.versions.find(version => version.type === "Baseline" && version.locked)?.id,
                  goalId: p.activeGoalId,
                }),
              );
              setSelectedChange(id);
              setEditing(true);
              appNotice(
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
      {missingChange && <p role="status" className="context-note warning">{missingChange} is no longer available. Choose another change request.</p>}
      {(project.changes.length > 1 || (missingChange && project.changes.length > 0)) && <div className="change-picker"><label>Change request <select value={change?.id ?? ""} onChange={event => { setMissingChange(undefined); setSelectedChange(event.target.value); setEditing(false); }}>
        {missingChange && <option value="">Choose a change request…</option>}
        {project.changes.map(item => <option key={item.id} value={item.id}>{item.title || "Untitled change request"} · {item.status} · {item.id}</option>)}
      </select></label><small>{project.changes.length} requests in this project</small></div>}
      {change ? (
        <div className="change-layout">
          <Card>
            <header className="change-title">
              <div>
                <Badge tone="purple">{change.id}</Badge>
                <StatusBadge value={implementedChange && !changeRevalidationIsCurrent(project, change) ? "Revalidation required" : change.status} />
                {editing ? (
                  <div className="change-edit-fields">
                    <label>Title
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
                    </label>
                    <label>Business reason
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
                    </label>
                    <label>Source
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
                    </label>
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
                      appNotice(
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
                <Button kind="danger" disabled={implementedChange} title={implementedChange ? "Implemented changes are retained as history." : undefined} onClick={() => setPendingDelete(change.id)}>
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
                <select disabled={implementedChange} value={change.baselineId ?? ""} onChange={(event) => update((p) => {
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
                <div className="impact-item" key={impact.id}>
                  <label className="impact-selection">
                  <input
                    type="checkbox"
                    checked={impact.selected}
                    disabled={implementedChange}
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
                      {impactOptions.find(option => option.id === impact.id)?.name || impact.id} · {impact.type} · {impact.id}
                    </b>
                    <small>{impact.reason}</small>
                  </span>
                  </label>
                  <StatusBadge value={impact.selected ? "Will update" : "Review only"} />
                  <div className="impact-actions">
                  {!(change.patches ?? []).some(patch => patch.artifactId === impact.id) && (
                    <Button disabled={implementedChange} onClick={() => update((p) => {
                      const cr = p.changes.find(item => item.id === change.id)!;
                      const patch = createPatch(p, impact.id, impact.type as "Requirement" | "User story" | "Diagram" | "Document");
                      if (patch) (cr.patches ??= []).push(patch);
                    })}>Draft content patch</Button>
                  )}
                  {impact.type === "Requirement" && !(change.patches ?? []).some(patch => patch.artifactId === impact.id && patch.field === "criteria") && (
                    <Button disabled={implementedChange} onClick={() => update(p => {
                      const cr = p.changes.find(item => item.id === change.id);
                      const requirement = p.requirements.find(item => item.id === impact.id);
                      if (!cr || !requirement || cr.patches?.some(patch => patch.artifactId === impact.id && patch.field === "criteria") || cr.patches?.some(patch => patch.status === "Applied")) return;
                      const before = requirement.fitCriteria.join("\n");
                      (cr.patches ??= []).push({ id: uid("CP"), artifactId: requirement.id, artifactType: "Requirement", field: "criteria", before, after: before, sourceRevision: requirement.version, selected: impact.selected, status: "Proposed" });
                      cr.status = "Impact review";
                    })}>Draft acceptance criteria patch</Button>
                  )}
                  </div>
                </div>
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
                      {option.name || "Untitled"} · {option.type} · {option.id}
                    </option>
                  ))}
                </select>
                {selectedImpactOption && <small className="selected-impact-name">{selectedImpactOption.name} · {selectedImpactOption.type}</small>}
              </label>
              <Button
                onClick={addImpact}
                disabled={
                  implementedChange || !impactCandidate ||
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
                  const proposed = { ...change, patches: (change.patches ?? []).map(patch => patch.selected ? { ...patch, status: "Accepted" as const } : patch) };
                  const validation = validateAcceptedPatches(project, proposed);
                  if (validation) { appNotice(validation, "warning", "Patches need review"); return; }
                  const reviewedPatches = JSON.stringify((change.patches ?? []).filter(patch => patch.selected));
                  setPendingChangeAction({ kind: "accept", changeId: change.id, patches: (change.patches ?? []).filter(patch => patch.selected).map(({ id, after }) => ({ id, after })) });
                  update((p) => {
                    const cr = p.changes.find(item => item.id === change.id);
                    if (!cr || JSON.stringify((cr.patches ?? []).filter(patch => patch.selected)) !== reviewedPatches || (cr.patches ?? []).some(patch => patch.status === "Applied")) return;
                    const patches = (cr.patches ?? []).filter(patch => patch.selected);
                    if (validateAcceptedPatches(p, { ...cr, patches: (cr.patches ?? []).map(patch => patch.selected ? { ...patch, status: "Accepted" as const } : patch) })) return;
                    patches.forEach(patch => { patch.status = "Accepted"; });
                    cr.status = "Approved";
                    cr.approvedAt = new Date().toISOString();
                    addAudit(p, "Approved change patches", cr.id, `${patches.length} concrete content patches were accepted for atomic implementation.`);
                  });
                }}
                disabled={implementedChange || !(change.patches ?? []).some(patch => patch.selected)}
              >
                Accept selected patches <Check size={16} />
              </Button>
              <Button kind="primary" onClick={apply} disabled={implementedChange || change.status !== "Approved"}>
                Implement accepted patches <ArrowRight size={16} />
              </Button>
              {implementedChange && !changeRevalidationIsCurrent(project, change) && <Button onClick={() => {
                const issues = changeRevalidationIssues(project, change);
                if (issues.length) { appNotice(issues.join(" "), "warning", "Revalidation blocked"); return; }
                const reviewedChange = JSON.stringify(change);
                const reviewedRevisions = JSON.stringify(changeAffectedIds(project, change).map(id => [id, revisionOf(project, id)]));
                update((p) => {
                  const cr = p.changes.find(item => item.id === change.id);
                  if (!cr || JSON.stringify(cr) !== reviewedChange || JSON.stringify(changeAffectedIds(p, cr).map(id => [id, revisionOf(p, id)])) !== reviewedRevisions || changeRevalidationIssues(p, cr).length) return;
                  cr.revalidationRevisions = Object.fromEntries(changeAffectedIds(p, cr).map(id => [id, revisionOf(p, id)]));
                  cr.status = "Revalidated";
                  cr.revalidatedAt = new Date().toISOString();
                  addAudit(p, "Recorded change revalidation", cr.id, "The implemented working revisions passed the current approval policy and are ready for a new baseline.");
                });
                setPendingChangeAction({ kind: "revalidate", changeId: change.id, patches: (change.patches ?? []).filter(patch => patch.selected && patch.status === "Applied").map(({ id, after }) => ({ id, after })) });
              }}>Record revalidation</Button>}
            </footer>
          </Card>
          <Card title="Reviewed content patches" description="Each patch is bound to its current source revision. Edit the proposed value; nothing is implemented from an example or version number alone.">
            {(change.patches ?? []).map((patch) => (
              <div className="side-diff" key={patch.id}>
                <label><input type="checkbox" checked={patch.selected} disabled={implementedChange} onChange={(event) => update((p) => { const item = p.changes.find(item => item.id === change.id)!.patches!.find(item => item.id === patch.id)!; item.selected = event.target.checked; if (item.status !== "Applied") item.status = "Proposed"; p.changes.find(item => item.id === change.id)!.status = "Impact review"; })} /> {patch.artifactId} · {patch.field} · source v{patch.sourceRevision}</label>
                {patch.artifactType === "Document" && <label className="change-block-target"><span>Document block to replace</span><select aria-label={`Target block for ${patch.id}`} disabled={implementedChange} value={patch.targetId ?? ""} onChange={event => {
                  const targetId = event.target.value;
                  update(p => {
                    const cr = p.changes.find(item => item.id === change.id);
                    const current = cr?.patches?.find(item => item.id === patch.id);
                    const doc = p.documents.find(item => item.id === patch.artifactId);
                    const block = doc?.sections.flatMap(section => section.blocks).find(item => item.id === targetId);
                    if (!cr || !current || !doc || !block || current.status === "Applied") return;
                    current.targetId = block.id; current.before = block.content; current.after = block.content; current.sourceRevision = doc.version; current.status = "Proposed"; cr.status = "Impact review";
                  });
                }}>{project.documents.find(item => item.id === patch.artifactId)?.sections.flatMap(section => section.blocks.map(block => <option key={block.id} value={block.id}>{section.title} · {block.syncArtifactId ?? block.type} · {block.content.slice(0, 100)}</option>))}</select><small>Changing the target resets the replacement to that block’s current content.</small></label>}
                <div><span>Current</span><pre>{patch.before}</pre></div>
                <ArrowRight />
                <label><span>Proposed replacement</span><textarea aria-label={`Proposed patch ${patch.id}`} value={patch.after} disabled={implementedChange} onChange={(event) => update((p) => { const item = p.changes.find(item => item.id === change.id)!.patches!.find(item => item.id === patch.id)!; item.after = event.target.value; item.status = "Proposed"; p.changes.find(item => item.id === change.id)!.status = "Impact review"; })} /><Button disabled={implementedChange} onClick={() => update((p) => { const cr = p.changes.find(item => item.id === change.id)!; const item = cr.patches!.find(item => item.id === patch.id)!; item.status = "Rejected"; item.selected = false; cr.status = "Impact review"; addAudit(p, "Rejected change patch", `${change.id}/${patch.id}`, "The proposed content patch was retained as rejected and was not implemented."); })}>Reject patch</Button></label>
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
      ) : missingChange ? null : (
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
            appNotice("The change request was deleted.", "success");
          }}
        />
      )}
    </>
  );
}

export function GovernanceView({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
}) {
  const location = useLocation();
  const referenceId = new URLSearchParams(location.search).get("artifact");
  const referenceExists = !referenceId || project.checks.some(check => check.id === referenceId);
  useEffect(() => {
    if (!referenceId || !referenceExists) return;
    const target = document.getElementById(`governance-${referenceId}`);
    target?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
  }, [referenceId, referenceExists, project.id]);
  const [configuring, setConfiguring] = useState(false);
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleOwner, setRuleOwner] = useState("Business analyst");
  const [pendingDelete, setPendingDelete] = useState<string>();
  const [disposition, setDisposition] = useState<{ id: string; status: "Passed" | "Not applicable" }>();
  const [dispositionDrafts, setDispositionDrafts] = useState<Record<string, string>>({});
  const dispositionKey = disposition ? `${disposition.id}:${disposition.status}` : "";
  const dispositionRationale = dispositionDrafts[dispositionKey] ?? "";
  const closeDisposition = () => {
    setDispositionDrafts(current => { const next = { ...current }; delete next[dispositionKey]; return next; });
    setDisposition(undefined);
  };
  const beginDisposition = (id: string, status: "Passed" | "Not applicable") => {
    setDisposition({ id, status });
  };
  return (
    <>
      <PageHeader
        eyebrow="Layered policy engine"
        title="Checks & safeguards"
        description="Core safeguards cannot be disabled; domain and project rules add contextual evidence."
        actions={
          <button type="button" className="button secondary" aria-expanded={configuring} onClick={() => setConfiguring(!configuring)}>
            <Settings size={17} /> {configuring ? "Close rule editor" : "Configure project rules"}
          </button>
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
                appNotice(
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
          tone={project.checks.some(c => c.status === "Blocking") ? "danger" : project.checks.some(c => c.status === "Warning") ? "warning" : "success"}
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
      {referenceId && !referenceExists && <p role="status" className="context-note warning">{referenceId} is no longer available. Review the current findings below.</p>}
      <h2 className="governance-findings-title">Review findings</h2>
      {!project.checks.length && <p className="context-note">No review findings have been recorded yet.</p>}
      <div className="check-grid">
        {project.checks.map((check) => (
          <div key={check.id} id={`governance-${check.id}`} tabIndex={-1}><Card
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
                  onClick={() => beginDisposition(check.id, "Not applicable")}
                >
                  Mark not applicable
                </button>
              )}
              {check.status !== "Passed" && (
                <Button kind="primary" onClick={() => beginDisposition(check.id, "Passed")}>
                  Record resolution
                </Button>
              )}
              {check.category === "Project rule" && (
                <Button kind="danger" onClick={() => setPendingDelete(check.id)}>
                  <Trash2 size={15} /> Delete rule
                </Button>
              )}
            </footer>
            {disposition?.id === check.id && (
              <div className="context-note governance-disposition">
                <div>
                  <label>
                    <span>{disposition.status === "Passed" ? "How was this resolved?" : "Why does this not apply?"}</span>
                    <textarea
                      aria-label={`Rationale for ${check.id}`}
                      value={dispositionRationale}
                      onChange={(event) => { const value = event.target.value; setDispositionDrafts(current => ({ ...current, [dispositionKey]: value })); }}
                      placeholder="Describe the actual decision and supporting evidence or owner, if known."
                    />
                  </label>
                  <p>Draft notes stay while this page is open. Saving records the rationale in project activity. Refer to a decision only if it exists.</p>
                  <div className="governance-disposition-actions"><Button kind="primary" disabled={!dispositionRationale.trim()} onClick={() => {
                    const rationale = dispositionRationale.trim();
                    update((p) => recordGovernanceDisposition(p, check.id, disposition.status, rationale));
                    closeDisposition();
                    appNotice(`${check.id} was recorded as ${disposition.status}.`, "success", "Governance status updated");
                  }}>Save rationale</Button>
                  <Button onClick={closeDisposition}>Cancel</Button></div>
                </div>
              </div>
            )}
          </Card></div>
        ))}
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
            appNotice("The project-specific governance rule was deleted.", "success");
          }}
        />
      )}
    </>
  );
}

export function ActivityView({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
}) {
  const navigate = useNavigate();
  const [approving, setApproving] = useState(false);
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [approvalName, setApprovalName] = useState("");
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [approvalScope, setApprovalScope] = useState("");
  const [approvalError, setApprovalError] = useState("");
  const approvalDialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(approvalDialogRef, () => { if (!approvalInProgress.current) setApprovalDialog(false); }, approvalDialog);
  const approvalInProgress = useRef(false);
  const approvalAttempt = useRef(0);
  const manifest = baselineManifestWithChanges(project);
  const dependencyIssues = baselineDependencyIssues(project);
  const policyIssues = baselineIssues(project);
  const pendingChanges = changesNeedingRevalidation(project);
  const openQuestions = project.clarifications.filter(item => item.status === "Unanswered" || item.status === "Deferred");
  const openChecks = project.checks.filter(item => item.status === "Warning" || item.status === "Blocking");
  const openReview = (route: string, id?: string) => navigate(`/projects/${project.id}/${route}${id ? `?artifact=${encodeURIComponent(id)}` : ""}`);
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
    appNotice(
      "A named snapshot of the current working state was recorded.",
      "success",
      "Snapshot created",
    );
  };
  const approveBaseline = async () => {
    if (approvalInProgress.current || !approvalName.trim() || !approvalConfirmed) return;
    if (JSON.stringify(project) !== approvalScope) { const message = "The project changed since this approval was opened. Close and review the latest scope before approving."; setApprovalError(message); notify(message, "warning", "Baseline scope changed"); return; }
    if (activeGoal(project)?.gate !== "Approve") {
      notify("Complete the Validate stage before creating an approved baseline.", "warning", "Baseline is not ready");
      return;
    }
    if (changesNeedingRevalidation(project).length) { notify("Review and revalidate implemented changes before creating a baseline.", "warning", "Baseline is not ready"); return; }
    if (!approvalAllowed(project)) { notify(baselineIssues(project).join(" "), "warning"); return; }
    if (baselineDependencyIssues(project).length) { notify(baselineDependencyIssues(project).join(" "), "warning", "Baseline is not ready"); return; }
    approvalInProgress.current = true;
    setApprovalError("");
    setApproving(true);
    const attempt = ++approvalAttempt.current;
    const checkedState = JSON.stringify(project);
    const checkedGoal = activeGoal(project);
    try {
      if (!checkedGoal) throw new Error("Choose an active goal before approving a baseline.");
      await verifyBaselineSources(project, checkedGoal.id);
    } catch (error) {
      approvalInProgress.current = false;
      setApproving(false);
      const message = error instanceof Error ? error.message : "The selected sources could not be checked.";
      setApprovalError(message);
      appNotice(message, "warning", "Baseline is not ready");
      return;
    }
    update((p) => {
      const finish = (message: string, success: boolean) => queueMicrotask(() => {
        if (approvalAttempt.current !== attempt) return;
        approvalAttempt.current += 1;
        approvalInProgress.current = false;
        setApproving(false);
        if (success) setApprovalDialog(false); else setApprovalError(message);
        appNotice(message, success ? "success" : "warning", success ? "Baseline approved" : "Baseline is not ready");
      });
      if (JSON.stringify(p) !== checkedState || !canCreateBaseline(p)) {
        finish("The project changed while its sources were checked. Review the current baseline scope and try again.", false);
        return;
      }
      const manifest = baselineManifestWithChanges(p);
      const included = new Set(manifest.map(item => item.id));
      p.requirements.forEach((r) => {
        if (r.status === "in-review" && included.has(r.id)) r.status = "approved";
      });
      p.documents.forEach((d) => {
        if (d.status === "in-review" && included.has(d.id)) d.status = "approved";
      });
      p.stories.forEach((story) => { if (story.status === "in-review" && included.has(story.id)) story.status = "approved"; });
      p.diagrams.forEach((diagram) => {
        if (["In review", "Current"].includes(diagram.status) && diagram.approvalStatus !== "Approved" && included.has(diagram.id)) {
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
        actor: approvalName.trim(),
        type: "Baseline",
        locked: true,
        changes: "Human-approved artifact, governance and traceability package",
        manifest,
      });
      addAudit(
        p,
        "Approved baseline",
        "Current project package",
        `Self-attested approval recorded; baseline locked against direct edits. Included revisions: ${manifest.map(item => `${item.id} v${item.revision}`).join(", ")}.`,
        approvalName.trim(),
      );
      finish("The reviewed artifact package was locked as a new human-approved baseline.", true);
    });
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
              onClick={() => { setApprovalName(""); setApprovalConfirmed(false); setApprovalError(""); setApprovalScope(JSON.stringify(project)); setApprovalDialog(true); }}
              disabled={approving || !canCreateBaseline(project)}
              title={activeGoal(project)?.gate !== "Approve" ? "Complete the Validate stage first." : changesNeedingRevalidation(project).length ? "Review and revalidate implemented changes first." : [...baselineIssues(project), ...baselineDependencyIssues(project)].join(" ")}
            >
              <LockKeyhole size={17} /> {approving ? "Checking sources…" : "Approve new baseline"}
            </Button>
          </>
        }
      />
      {approvalDialog && <div className="modal-backdrop" role="presentation"><div ref={approvalDialogRef} className="modal" role="dialog" aria-modal="true" aria-label="Confirm baseline approval"><header><div><span className="eyebrow">Record local approval</span><h2>Approve this baseline?</h2></div><IconButton label="Close baseline approval" disabled={approving} onClick={() => setApprovalDialog(false)}><X /></IconButton></header><div className="modal-body"><p>Confirm the listed artifact revisions and the unresolved items have been reviewed. BA Mate records the name or role you enter; it does not authenticate the approver.</p><details><summary>Revisions in this baseline ({manifest.length})</summary><ul>{manifest.map(item => <li key={item.id}>{item.type} {item.id} · v{item.revision}</li>)}</ul></details><details><summary>Open questions and checks across this project ({openQuestions.length + openChecks.length})</summary>{openQuestions.length + openChecks.length ? <ul>{openQuestions.map(item => <li key={item.id}>Question {item.id} · {item.status}: {item.question}</li>)}{openChecks.map(item => <li key={item.id}>Check {item.id} · {item.status}: {item.title}</li>)}</ul> : <p>No unanswered or deferred questions or open warning or blocking checks are recorded.</p>}<p>Some items may belong to another goal. Check their scope before approval.</p></details><label className="editor-field"><span>Approver name or role</span><input value={approvalName} disabled={approving} onChange={event => setApprovalName(event.target.value)} maxLength={160} /></label><label className="setup-remote-choice"><input type="checkbox" checked={approvalConfirmed} disabled={approving} onChange={event => setApprovalConfirmed(event.target.checked)} /> I reviewed the baseline scope and am authorized to record this approval.</label>{approvalError && <p className="context-note warning" role="alert">{approvalError}</p>}</div><footer><Button disabled={approving} onClick={() => setApprovalDialog(false)}>Cancel</Button><Button kind="primary" disabled={approving || !approvalName.trim() || !approvalConfirmed} onClick={() => void approveBaseline()}>{approving ? "Checking sources…" : "Record approval"}</Button></footer></div></div>}
      <div className="baseline-review-summary">
        <h2>Next baseline</h2>
        <p>Includes artifacts from the active goal, its revalidated changes and their linked artifacts. Review each item before approval.</p>
        {activeGoal(project)?.gate !== "Approve" && <p>Complete the Validate stage before approving a baseline. <button type="button" onClick={() => openReview("workflow")}>Open guided workflow</button></p>}
        {pendingChanges.length > 0 && <p>{pendingChanges.length} implemented {pendingChanges.length === 1 ? "change needs" : "changes need"} revalidation. <button type="button" onClick={() => openReview("changes")}>Open changes</button></p>}
        {policyIssues.length > 0 && <details><summary>Goal approval checks ({policyIssues.length})</summary><ul>{policyIssues.map(issue => <li key={issue}>{issue}</li>)}</ul><button type="button" onClick={() => openReview("governance")}>Open checks and safeguards</button> <button type="button" onClick={() => openReview("traceability")}>Open evidence links</button></details>}
        {manifest.length ? <details className="baseline-scope"><summary>Review baseline artifacts ({manifest.length})</summary><ul className="baseline-artifact-list">{manifest.map(item => {
          const issues = dependencyIssues.filter(issue => issue.startsWith(`${item.id}: `)).map(issue => issue.slice(item.id.length + 2));
          const route = item.type === "Diagram" ? "diagrams" : item.type === "Document" ? "documents" : "artifacts";
          const name = project.requirements.find(entry => entry.id === item.id)?.title ?? project.stories.find(entry => entry.id === item.id)?.goal ?? project.diagrams.find(entry => entry.id === item.id)?.name ?? project.documents.find(entry => entry.id === item.id)?.name ?? item.id;
          return <li key={item.id}><div><b>{name}</b> · {item.id} · {item.type} · v{item.revision} {issues.length ? <span>· Review needed</span> : <span>· Ready for baseline review</span>}</div>{issues.length > 0 && <details><summary>{issues.length} review {issues.length === 1 ? "item" : "items"}</summary><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}<button type="button" aria-label={`Open ${item.type} workspace to review ${item.id}`} onClick={() => openReview(route, item.id)}>Open {item.type === "Diagram" ? "diagrams" : item.type === "Document" ? "documents" : "requirements and stories"}</button>{issues.some(issue => /trace|evidence/i.test(issue)) && <> · <button type="button" aria-label={`Open evidence links to review ${item.id}`} onClick={() => openReview("traceability", item.id)}>Open evidence links</button></>}</li>;
        })}</ul></details> : <p>No artifacts are in scope yet.</p>}
      </div>
      <div className="version-layout">
        <Card
          title="Versions and baselines"
          description="Restoring an older version always creates a new working draft."
        >
          <div className="version-list">
            {project.versions.length === 0 && (
              <div className="empty-state version-empty-state">
                <History aria-hidden="true" />
                <h3>No saved versions yet</h3>
                <p>Create a snapshot when you reach a useful checkpoint. Approved baselines will also appear here.</p>
              </div>
            )}
            {project.versions.map((version) => (
              <div key={version.id}>
                <i className={version.type.toLowerCase()}>
                  {version.locked ? <LockKeyhole /> : <History />}
                </i>
                <span>
                  <b>{version.label}</b>
                  <small>
                    {version.version} · {version.actor} · {formatWorkspaceTime(version.at)}
                  </small>
                  <p>{version.changes}</p>
                </span>
                <StatusBadge value={version.type} />
                <Button
                  disabled={!version.snapshot}
                  title={version.snapshot ? "Current work will be retained in a recovery snapshot." : "This older milestone has no saved content."}
                  onClick={() => {
                    update((p) => restoreSnapshot(p, version));
                    appNotice(
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
          <div className="audit-list" role="region" aria-label="Audit trail entries" tabIndex={0}>
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
                    {event.actor} · {formatWorkspaceTime(event.at)}
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

type ProjectSettingsDraft = { name: string; domain: string; description: string; policies: string[] };
const projectSettingsDrafts = new Map<string, ProjectSettingsDraft>();
const coreProjectPolicies = ['Core responsible BA', 'Human oversight & traceability'];

export function PolicyProposalReview({ current, proposed, onUse, onDiscard }: { current: string[]; proposed: string[]; onUse: (policies: string[]) => void; onDiscard: () => void }) {
  const reviewed = [...new Set([...coreProjectPolicies, ...proposed.map(item => item.trim()).filter(Boolean)])];
  const added = reviewed.filter(item => !current.includes(item));
  const removed = current.filter(item => !reviewed.includes(item));
  return <div className="setup-policy-proposal"><b>Review suggested policy changes</b><p>Compare this proposal with the list above. Applying it changes the editable list; save separately when ready. Core policies remain locked.</p>
    <div className="policy-proposal-changes"><section><strong>Added ({added.length})</strong>{added.length ? <ul>{added.map(policy => <li key={policy}>{policy}</li>)}</ul> : <p>None</p>}</section><section><strong>Removed ({removed.length})</strong>{removed.length ? <ul>{removed.map(policy => <li key={policy}>{policy}</li>)}</ul> : <p>None</p>}</section></div>
    <details><summary>View proposed list ({reviewed.length})</summary><ul>{reviewed.map(policy => <li key={policy}>{policy}</li>)}</ul></details>
    <div className="policy-proposal-actions"><Button onClick={() => onUse(reviewed)}>Use this list for review</Button><Button onClick={onDiscard}>Discard proposal</Button></div>
  </div>;
}

export function TeamView({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
}) {
  const { connect: reconnectFolder, connecting: connectingFolder } = useFolderConnection(project, update);
  const navigate = useNavigate();
  const [pendingRemove, setPendingRemove] = useState<string>();
  const cachedDraft = projectSettingsDrafts.get(project.id);
  const [projectName, setProjectName] = useState(cachedDraft?.name ?? project.name);
  const [projectDomain, setProjectDomain] = useState(cachedDraft?.domain ?? project.domain);
  const [projectDescription, setProjectDescription] = useState(cachedDraft?.description ?? project.description);
  const [policyDraft, setPolicyDraft] = useState(cachedDraft?.policies ?? project.governancePacks);
  const setupChanged = projectName !== project.name || projectDomain !== project.domain || projectDescription !== project.description;
  const policiesChanged = JSON.stringify(policyDraft) !== JSON.stringify(project.governancePacks);
  useEffect(() => {
    if (setupChanged || policiesChanged) projectSettingsDrafts.set(project.id, { name: projectName, domain: projectDomain, description: projectDescription, policies: policyDraft });
    else projectSettingsDrafts.delete(project.id);
  }, [project.id, projectName, projectDomain, projectDescription, policyDraft, setupChanged, policiesChanged]);
  const [policyInstruction, setPolicyInstruction] = useState("");
  const [policyProposal, setPolicyProposal] = useState<string[] | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyError, setPolicyError] = useState("");
  const [policyRemoteAllowed, setPolicyRemoteAllowed] = useState(false);
  const askPolicyAssistant = async () => {
    if (!policyInstruction.trim() || policyBusy) return;
    setPolicyBusy(true); setPolicyError("");
    try {
      const result = await api<{ proposal: { policies: string[] } }>("/api/setup/propose", { method: "POST",
        body: JSON.stringify({ kind: "governance", description: policyInstruction, project_description: projectDescription,
          current_policies: policyDraft, cloud_allowed: policyRemoteAllowed }) });
      setPolicyProposal(result.proposal.policies);
    } catch (error) { setPolicyError(error instanceof Error ? error.message : "BA Mate could not prepare a policy proposal."); }
    finally { setPolicyBusy(false); }
  };
  return (
    <>
      <PageHeader
        eyebrow="Local collaboration model"
        title="Project settings"
        description="Manage project details, policies, local roles and the workspace folder. No invitations are sent."
      />
      <div className="team-layout">
        <Card title="Project setup" description="Update the project's working context. BA Mate uses the current description when proposing work.">
          <div className="project-settings-fields">
            <label className="editor-field"><span>Project name</span><input value={projectName} onChange={event => setProjectName(event.target.value)} /></label>
            <label className="editor-field"><span>Category or domain</span><input value={projectDomain} onChange={event => setProjectDomain(event.target.value)} /></label>
            <label className="editor-field"><span>Project description</span><textarea value={projectDescription} onChange={event => setProjectDescription(event.target.value)} /></label>
            {setupChanged && <p className="context-note" role="status">Project setup changes are not saved. They remain available while you move between pages in this session.</p>}
            <Button kind="primary" disabled={!projectName.trim() || !projectDomain.trim()} onClick={() => { const name = projectName.trim(), domain = projectDomain.trim(), description = projectDescription.trim(); setProjectName(name); setProjectDomain(domain); setProjectDescription(description); update(p => { p.name = name; p.domain = domain; p.description = description; addAudit(p, "Updated project setup", "Project brief", `${p.domain}: ${p.description}`); }); appNotice("Project context updated. Review any affected suggestions or artifacts.", "success"); }}><Save size={16} /> Save project setup</Button>
            {setupChanged && <Button onClick={() => { setProjectName(project.name); setProjectDomain(project.domain); setProjectDescription(project.description); }}>Discard setup changes</Button>}
          </div>
          <Button onClick={() => navigate(`/projects/${project.id}/governance`)}><ShieldCheck size={16} /> Review policies and safeguards</Button>
        </Card>
        <Card title="Project AI processing" description="Choose whether this project may use your configured external AI provider. This preference saves immediately."><ProjectProcessingPreference project={project} update={update} /></Card>
        <Card title="Governance & policy setup" description="Core policies are locked. Edit project policies or ask BA Mate for a reviewable proposal.">
          <div className="project-settings-fields">
            {policyDraft.map((policy, index) => <div className="project-policy-row" key={index}><input aria-label={`Policy ${index + 1}`} value={policy} readOnly={['Core responsible BA', 'Human oversight & traceability'].includes(policy)} onChange={event => setPolicyDraft(current => current.map((item, i) => i === index ? event.target.value : item))} />{['Core responsible BA', 'Human oversight & traceability'].includes(policy) ? <span className="project-policy-locked">Locked</span> : <IconButton label={`Remove ${policy}`} onClick={() => setPolicyDraft(current => current.filter((_, i) => i !== index))}><Trash2 size={15} /></IconButton>}</div>)}
            {policiesChanged && <p className="context-note" role="status">Policy changes are not saved. Review and save the list when ready.</p>}
            <Button onClick={() => setPolicyDraft(current => [...current, "New project policy"])}><Plus size={16} /> Add policy</Button>
            <label className="editor-field"><span>Describe a policy change to BA Mate</span><textarea value={policyInstruction} onChange={event => setPolicyInstruction(event.target.value)} placeholder="Explain what should be added, changed or removed…" /></label>
            <label className="setup-remote-choice"><input type="checkbox" checked={policyRemoteAllowed} onChange={event => setPolicyRemoteAllowed(event.target.checked)} /> Allow the configured remote model to process this description if selected</label>
            {policyError && <p className="setup-ai-error" role="alert">{policyError}</p>}
            <Button disabled={!policyInstruction.trim() || policyBusy} onClick={() => void askPolicyAssistant()}><Sparkles size={16} /> {policyBusy ? "Preparing proposal…" : "Ask BA Mate"}</Button>
            {policyProposal && <PolicyProposalReview current={policyDraft} proposed={policyProposal} onUse={policies => { setPolicyDraft(policies); setPolicyProposal(null); }} onDiscard={() => setPolicyProposal(null)} />}
            <Button kind="primary" onClick={() => { const policies = [...new Set(['Core responsible BA', 'Human oversight & traceability', ...policyDraft.map(item => item.trim()).filter(Boolean)])]; setPolicyDraft(policies); update(p => { p.governancePacks = policies; addAudit(p, "Updated project policies", "Project governance", p.governancePacks.join(" · ")); }); appNotice("The reviewed project policy list was saved.", "success"); }}><Save size={16} /> Save policy list</Button>
            {policiesChanged && <Button onClick={() => setPolicyDraft(project.governancePacks)}>Discard policy changes</Button>}
          </div>
        </Card>
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
                  aria-label={`Role for ${member.name}`}
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
                    aria-label={`Can ${member.name} approve baselines`}
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
              <dd>{project.workspacePath || project.folderName}</dd>
            </div>
            <div>
              <dt>Storage mode</dt>
              <dd>{project.workspaceKind === "selected" || project.workspaceKind === "browser" ? "Selected local folder" : "Managed local folder"}</dd>
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
          <Button
            className="full"
            disabled={connectingFolder}
            onClick={() => void reconnectFolder()}
          >
            {connectingFolder ? <RefreshCw size={17} /> : <Folder size={17} />}
            {connectingFolder ? "Connecting folder…" : "Choose or change project folder"}
          </Button>
        </Card>
      </div>
      {pendingRemove && (
        <ConfirmDialog
          title="Remove this project member?"
          description="The local member and their approval permission will be removed from this project. No external account is affected."
          confirmLabel="Remove member"
          onCancel={() => setPendingRemove(undefined)}
          onConfirm={() => {
            const member = project.members.find((item) => item.id === pendingRemove);
            update((p) => {
              p.members = p.members.filter((item) => item.id !== pendingRemove);
              addAudit(p, "Removed project member", pendingRemove, `${member?.name ?? "Member"} was removed from the local collaboration model.`);
            });
            setPendingRemove(undefined);
            appNotice("The project member was removed.", "success");
          }}
        />
      )}
    </>
  );
}

export function ProjectsHome({
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
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase();
  const visibleProjects = state.projects.filter(project => [project.name, project.description, project.folderName, project.domain, project.gate].some(value => value?.toLocaleLowerCase().includes(search)));
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
      {state.projects.length > 0 && <div className="project-filter"><label>Find a project<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, folder, domain or stage" /></label><span role="status">{visibleProjects.length} of {state.projects.length} {state.projects.length === 1 ? "project" : "projects"}</span>{query && visibleProjects.length > 0 && <button className="text-button" type="button" onClick={() => setQuery("")}>Clear search</button>}</div>}
      {visibleProjects.length ? (
        <div className="project-card-grid">
          {visibleProjects.map((project) => (
            <article
              key={project.id}
              className="project-card"
              role="link"
              tabIndex={0}
              aria-label={`Open ${projectChoiceLabel(project, state.projects)}`}
              onClick={() => nav(`/projects/${project.id}/overview`)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
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
                  label={`Project setup for ${projectChoiceLabel(project, state.projects)}`}
                  className="project-setup-button"
                  onClick={(event) => { event.stopPropagation(); nav(`/projects/${project.id}/team`); }}
                ><Settings size={17} /></IconButton>
                <IconButton
                  label={`Delete ${projectChoiceLabel(project, state.projects)}`}
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
      ) : state.projects.length ? (
        <EmptyState icon={<Search />} title="No matching projects" description="Try a different name, folder, domain or stage." action={<Button onClick={() => setQuery("")}>Clear search</Button>} />
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
          description={`Remove this project's records from the current workspace? Project: ${projectChoiceLabel(pendingDelete, state.projects)}. Folder: ${pendingDelete.workspacePath || pendingDelete.folderName || "not recorded"}. Original files remain in the project folder, and older local workspace revisions may retain records. Export a backup first if you may need this project again.`}
          confirmLabel="Delete project"
          onCancel={() => setPendingDelete(undefined)}
          onConfirm={() => {
            onDelete(pendingDelete);
            setPendingDelete(undefined);
            appNotice("The local project was deleted.", "success");
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
  const run = activeEvaluationRun(state.evaluationRuns);
  const recordedForStage = projectFeedback.some(
    (entry) =>
      entry.stage === stage &&
      entry.runId === run?.id &&
      entry.goalId === goal?.id,
  );
  const complete = accuracy && usefulness && usability && confidence;
  const save = () => {
    if (!complete) return;
    if (recordedForStage) {
      notify(
        "This stage already has a submitted response for the active study run.",
        "warning",
        "Feedback already recorded",
      );
      return;
    }
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
    appNotice(`${stage} stage feedback recorded pseudonymously.`);
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
              disabled={
                Boolean(run) &&
                gates.indexOf(item) > (goal?.gateIndex ?? project.gateIndex)
              }
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
        description={
          recordedForStage
            ? "Feedback for this stage is already recorded for the active study run."
            : "Submit one response after completing the assigned stage task."
        }
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
            <Button kind="primary" disabled={!complete || recordedForStage} onClick={save}>
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
  const [pendingRevoke, setPendingRevoke] = useState<{ account_code: string; study_pseudonym?: string }>();
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
    return <section className="recovery-screen"><h1>Study participation is not connected</h1><p>Local BA work and backups remain available. The study service must be connected before participants can sign in; no local password can unlock collection or administration.</p></section>;
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
        id: uid("EVAL"), connectionSignature: settings.configuration_signature, projectId: runProject, caseId: caseCode.trim(), condition: runCondition, evaluatorCode: participantCode.trim(), datasetVersion: DATASET_VERSION, prototypeVersion: PROTOTYPE_VERSION, frameworkVersion: FRAMEWORK_VERSION, model: runCondition === "Manual" ? "none" : settings.model, promptVersion: PROMPT_VERSION, duration: "00:00", status: "Ready",
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
    appNotice(
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
      <div className="research-tabs" role="tablist" aria-label="Research console" onKeyDown={onTabListKeyDown}>
        {([
          ["overview", "Overview"],
          ["stages", "Stage analytics"],
          ["feedback", "Participant feedback"],
          ["runs", "Runs & reproducibility"],
        ] as const).map(([value, label]) => (
          <button
            role="tab"
            aria-selected={tab === value}
            tabIndex={tab === value ? 0 : -1}
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
            <div className="stage-analytics">{participants.map(participant => <div key={participant.account_code}><span><b>{participant.study_pseudonym ?? "Pseudonym pending"}</b><small>{participant.account_code.slice(0, 8)}</small></span><span><b>{participant.status}</b><small>account</small></span><span><b>{participant.consent_state ?? "No consent"}</b><small>collection consent</small></span>{participant.status === "active" && <Button kind="danger" onClick={() => setPendingRevoke(participant)}>Revoke</Button>}</div>)}</div>
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
      {pendingRevoke && <ConfirmDialog title={`Revoke ${pendingRevoke.study_pseudonym ?? "this participant"}?`} description="This revokes research account access. Their local BA work will not be changed." confirmLabel="Revoke access" onCancel={() => setPendingRevoke(undefined)} onConfirm={() => { void revokeParticipant(pendingRevoke.account_code); setPendingRevoke(undefined); }} />}
    </>
  );
}

function RecentWork({ state }: { state: WorkspaceState }) {
  const navigate = useNavigate();
  const items = state.projects
    .flatMap((project) =>
      project.audit.slice(0, 6).map((event) => ({ project, event })),
    )
    .sort((a, b) => new Date(b.event.at).getTime() - new Date(a.event.at).getTime())
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
                      <strong>{project.name}</strong>
                      <span title={event.detail}>{event.detail || event.object}</span>
                    </small>
                  </span>
                  <time dateTime={event.at}>{formatWorkspaceTime(event.at)}</time>
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
    governance: ["Core responsible BA", "Product data responsibility"],
    icon: <RefreshCw />,
  },
] as const;

export function WorkspaceTemplates({
  setState,
}: {
  setState: Dispatch<SetStateAction<WorkspaceState>>;
}) {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<(typeof workspaceTemplates)[number]>();
  const [projectName, setProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState("");
  const creatingRef = useRef(false);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closePreview = () => { if (!creatingRef.current) { setPreview(undefined); setCreationError(""); window.requestAnimationFrame(() => previewTrigger.current?.focus()); } };
  useDialogAccessibility(dialogRef, closePreview, Boolean(preview));
  const useTemplate = async (template: (typeof workspaceTemplates)[number]) => {
    if (creatingRef.current || !projectName.trim()) return;
    creatingRef.current = true;
    setCreating(true);
    setCreationError("");
    const project = JSON.parse(
      JSON.stringify(freshState().projects[0]),
    ) as Project;
    project.id = template.id + "-" + Date.now().toString(36);
    project.name = projectName.trim();
    project.domain = template.domain;
    project.description = template.description;
    project.folderName = "BA-Mate/" + project.id + "-workspace";
    project.template = template.name;
    project.governancePacks = [...new Set(["Core responsible BA", "Human oversight & traceability", ...template.governance])];
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
    try {
      const reference = await createProjectWorkspace(project.id, project.name);
      project.workspaceId = reference.workspaceId;
      project.workspaceKind = reference.workspaceKind;
      project.workspacePath = reference.displayPath;
      project.folderName = reference.folderName;
      addAudit(project, "Materialized project folder", reference.folderName, "Empty local folder created for background project discovery.");
      setState((current) => ({ ...current, projects: [project, ...current.projects] }));
      appNotice(`${project.name} was created with an empty local folder and no copied evidence.`, "success", "Template workspace created");
      navigate("/projects/" + project.id + "/overview");
    } catch (error) {
      setCreationError(error instanceof Error ? error.message : "The project folder could not be created.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
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
            <Button kind="primary" label={`Preview ${template.name} template`} onClick={(event) => { previewTrigger.current = event.currentTarget; setProjectName(template.name); setCreationError(""); setPreview(template); }}>
              <Plus /> Preview template
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
      {preview && <div className="modal-backdrop" role="presentation">
        <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
          <header><div><span className="eyebrow">New local project</span><h2 id="template-preview-title">Start with {preview.name}</h2></div><IconButton label="Close template preview" onClick={closePreview} disabled={creating}><X /></IconButton></header>
          <div className="modal-body template-preview-body">
            <label className="editor-field"><span>Project name</span><input autoFocus value={projectName} onChange={event => setProjectName(event.target.value)} maxLength={120} /></label>
            <p>{preview.description}</p>
            <p><b>Domain:</b> {preview.domain}</p>
            <p><b>Starting safeguards:</b> {[...new Set(["Core responsible BA", "Human oversight & traceability", ...preview.governance])].join(", ")}.</p>
            <p>A new local folder will be created. Add your own sources after creation; no project evidence is copied.</p>
            {creationError && <p role="alert" className="template-preview-error">{creationError}</p>}
          </div>
          <footer><Button onClick={closePreview} disabled={creating}>Cancel</Button><Button kind="primary" disabled={creating || !projectName.trim()} onClick={() => void useTemplate(preview)}>{creating ? "Creating project…" : "Create project"}</Button></footer>
        </div>
      </div>}
    </>
  );
}

function UnsavedRecovery({ projects, activeProjectId }: { projects: Project[]; activeProjectId?: string }) {
  const [selected, setSelected] = useState(activeProjectId ?? projects[0]?.id ?? "");
  const [exporting, setExporting] = useState(false);
  const chosen = projects.find(project => project.id === selected) ?? projects.find(project => project.id === activeProjectId) ?? projects[0];
  const exportRecovery = async () => {
    if (!chosen || exporting) return;
    setExporting(true);
    try {
      const backup = recordsOnlyRecoveryProject(chosen);
      downloadBlob(await repository.exportProject(backup), `${chosen.id}-records-recovery.zip`);
      appNotice(`A records-only recovery copy of ${chosen.name} is downloading. After reopening BA Mate, restore it from Settings and review its missing source originals.`, "warning", "Recovery copy exported");
    } catch (error) {
      appNotice(error instanceof Error ? error.message : "The recovery copy could not be created.", "danger", "Recovery failed");
    } finally { setExporting(false); }
  };
  return <section className="unsaved-recovery" aria-labelledby="recovery-title">
    <div><strong id="recovery-title">Saving is paused</strong><p>Your latest edits are still in this window. Download a recovery copy before closing or reloading; another window may contain different saved work.</p>
      <p>The recovery ZIP preserves project records but does not include source originals. After reopening, use Settings → Restore project backup, then reconnect matching originals in Sources and review the affected evidence. Repeat for each project with unsaved edits.</p></div>
    {chosen && <div className="unsaved-recovery__actions"><label>Project to recover <select value={chosen.id} onChange={event => setSelected(event.target.value)}>{projects.map(project => <option key={project.id} value={project.id}>{projectChoiceLabel(project, projects)}</option>)}</select></label>
      <button type="button" onClick={() => void exportRecovery()} disabled={exporting}>{exporting ? "Preparing recovery…" : "Download recovery copy"}</button></div>}
  </section>;
}

function WorkspaceSettings({
  state,
  setState,
  active,
}: {
  state: WorkspaceState;
  setState: Dispatch<SetStateAction<WorkspaceState>>;
  active: boolean;
}) {
  const [reducedMotion, setReducedMotion] = useState(
    () => localStorage.getItem("ba-mate-reduced-motion") === "true",
  );
  const [comfortable, setComfortable] = useState(
    () => localStorage.getItem("ba-mate-comfortable-density") === "true",
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [backupProjectId, setBackupProjectId] = useState(state.projects[0]?.id ?? "");
  const selectedBackupProjectId = state.projects.some(project => project.id === backupProjectId) ? backupProjectId : state.projects[0]?.id ?? "";
  const restoreInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!active) setConfirmReset(false); }, [active]);
  useEffect(() => {
    localStorage.setItem("ba-mate-reduced-motion", String(reducedMotion));
    localStorage.setItem("ba-mate-comfortable-density", String(comfortable));
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
    document.documentElement.dataset.density = comfortable
      ? "comfortable"
      : "compact";
  }, [reducedMotion, comfortable]);
  const exportWorkspace = async () => {
    try {
      const projects = await Promise.all(state.projects.map(prepareProjectBackup));
      downloadBlob(
        new Blob([JSON.stringify({ ...state, projects }, null, 2)], { type: "application/json" }),
        "ba-mate-local-workspace-backup.json",
      );
      const unavailable = projects.flatMap(project => project.sources.filter(source => !source.originalBase64));
      appNotice(unavailable.length
        ? `The workspace backup is downloading. ${unavailable.length} source${unavailable.length === 1 ? " has" : "s have"} no available original; their records are included and will need review after restore.`
        : "The complete local workspace backup download has started.",
      unavailable.length ? "warning" : "success", "Backup exported");
    } catch (error) {
      appNotice(error instanceof Error ? error.message : "The workspace backup could not be created.", "danger", "Backup failed");
    }
  };
  const exportProjectBackup = async () => {
    const project = state.projects.find((item) => item.id === selectedBackupProjectId);
    if (!project) return;
    try {
      const backup = await prepareProjectBackup(project);
      downloadBlob(await repository.exportProject(backup), `${project.id}-ba-mate-backup.zip`);
      const unavailable = backup.sources.filter(source => !source.originalBase64).length;
      appNotice(unavailable
        ? `${project.name} backup is downloading. ${unavailable} source${unavailable === 1 ? " has" : "s have"} no available original and will need review after restore.`
        : `A complete backup of ${project.name} is downloading. It includes its sources, artifacts, audit history and baselines.`,
      unavailable ? "warning" : "success", "Project backup exported");
    } catch (error) {
      appNotice(error instanceof Error ? error.message : "The project backup could not be created.", "danger", "Backup failed");
    }
  };
  const restoreProjectBackup = async (file?: File) => {
    if (!file) return;
    try {
      const imported = await repository.importProject(file);
      imported.name = `${imported.name} — restored copy`;
      const restored = await restoreProjectWorkspace(imported);
      setState((current) => ({ ...current, projects: [restored, ...current.projects] }));
      const unavailable = missingRestoredOriginalCount(restored);
      appNotice(`${restored.name} was restored as a separate local project. Existing work was not replaced.${unavailable ? ` ${unavailable} source${unavailable === 1 ? " has" : "s have"} no original and require review.` : ""}`,
        unavailable ? "warning" : "success", "Project restored");
    } catch (error) {
      appNotice(error instanceof Error ? error.message : "The selected backup is not valid.", "danger", "Restore failed");
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
          className="settings-section"
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
          className="settings-section local-data-card"
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
          <div className="setting-list backup-settings">
            <label>
              <span>
                <b>Project backup</b>
                <small>Creates a portable ZIP containing available originals, artifacts, audit history and baselines. Sources without available originals are identified on export.</small>
              </span>
              <select aria-label="Project for backup" value={selectedBackupProjectId} onChange={(event) => setBackupProjectId(event.target.value)}>
                {state.projects.map((project) => <option key={project.id} value={project.id}>{projectChoiceLabel(project, state.projects)}</option>)}
              </select>
            </label>
            <div className="page-actions backup-actions">
              <Button onClick={exportProjectBackup} disabled={!selectedBackupProjectId}>
                <Download /> Export project backup
              </Button>
              <input ref={restoreInput} type="file" accept=".zip,application/zip,application/x-zip-compressed" hidden onChange={(event) => void restoreProjectBackup(event.target.files?.[0])} />
              <Button onClick={() => restoreInput.current?.click()}>
                <Upload /> Restore project backup
              </Button>
            </div>
            <small>Restoring validates the package first and adds a separate project; it never overwrites current work.</small>
          </div>
          <section className="danger-zone" aria-labelledby="reset-demo-title">
            <div>
              <h3 id="reset-demo-title">Reset demonstration workspace</h3>
              <p>Replace current local changes and research observations with the original demonstration dataset.</p>
            </div>
            <Button kind="danger" onClick={() => setConfirmReset(true)}>
              <RotateCcw /> Reset demonstration data
            </Button>
          </section>
        </Card>
      </div>
      {active && confirmReset && (
        <ConfirmDialog
          title="Reset demonstration data?"
          description="All current local workspace changes and research observations will be replaced with the original demonstration dataset. Export a backup first if you need to retain them."
          confirmLabel="Reset local data"
          confirmIcon={<RotateCcw size={16} />}
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            setState(freshState());
            setConfirmReset(false);
            appNotice(
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
  if (page === "recent") return <RecentWork state={state} />;
  if (page === "guide")
    return (
      <>
        <PageHeader
          eyebrow="Five-minute orientation"
          title="Beta guide"
          description="Use BA Mate as a guided analysis workspace: you remain responsible for evidence, edits and approval."
        />
        <div className="guide-grid">
          <Card title="1. Start with one goal" description="Keep the test focused and measurable."><p>Create or open a project, define one outcome, then follow Guided workflow. The readiness checklist shows exactly what is still required.</p></Card>
          <Card title="2. Review sources" description="Nothing becomes evidence automatically."><p>Import material, compare extracted text with the original, then explicitly include suitable sources in the active goal.</p></Card>
          <Card title="3. Review every proposal" description="BA Mate prepares drafts, not decisions."><p>Edit suggested questions, requirements, diagrams and documents before submitting them for review. Evidence links and checks remain visible.</p></Card>
          <Card title="4. Approve in order" description="Stages cannot be skipped."><p>Resolve the checklist, advance through Validate, create an approved baseline in History & approved versions, then complete the goal.</p></Card>
          <Card title="5. Give study feedback" description="Only when an evaluation run is active."><p>Use Stage evaluation after each assigned stage. Ratings are pseudonymous; do not enter client names, project content or credentials.</p></Card>
          <Card title="Chat and context" description="Use Ask BA Mate from any project page."><p>Type @ and choose a project item with the arrow keys and Enter. Enter sends a message; Shift+Enter adds a line. Stop cancels a request. The assistant keeps temporary drafts while the app is open; use saved conversations for a lasting message history.</p></Card>
          <Card title="Review selected artifacts" description="Selection can span tabs and searches."><p>Select all applies to shown items. The selection bar counts hidden items and lets you submit drafts or return reviews to draft. Approval stays individual; expand the approval checks to see what remains.</p></Card>
          <Card title="Connect external AI" description="Provider connection and project permission are separate."><p>Configure your model and session key in Settings, then enable external AI under Project settings → Project AI processing. Confidential sources require a local model. These controls also apply to chat.</p></Card>
          <Card title="If something fails" description="Your local work remains available."><p>Retry the action, check Settings for model or connection status, and export a project backup before any reset or device change.</p></Card>
        </div>
      </>
    );
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
  project.audit = project.audit.filter((event) => [
    "Created project", "Applied BA Mate project context", "Queued knowledge base analysis",
    "Configured governance pack", "Materialized project folder", "Created project from template",
  ].includes(event.action));
  return project;
}

export function ProjectKickoff({
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
    | "Stakeholder clarification"
    | "Policy & governance review"
  >("New discovery");
  const [description, setDescription] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const startInProgress = useRef(false);
  const startAttempt = useRef(0);
  const [describeOpen, setDescribeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState("");
  const kickoffRef = useRef<HTMLDivElement>(null);
  const describeRef = useRef<HTMLDivElement>(null);
  const cancel = () => {
    startAttempt.current += 1;
    startInProgress.current = false;
    setStarting(false);
    onCancel?.();
  };
  useEffect(() => () => { startAttempt.current += 1; }, []);
  useDialogAccessibility(kickoffRef, () => { if (onCancel) cancel(); }, !describeOpen);
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
    ["Stakeholder clarification", "Resolve stakeholder questions", "Collect answers and record the people or decisions that confirm them."],
    ["Policy & governance review", "Review policies and safeguards", "Assess project rules, uncertainty and approval needs before further work."],
  ];
  const planning = project.agentRun?.roles.planning?.proposal as { goals?: { title: string; kind: typeof kind; reason: string }[]; clarification_questions?: string[] } | undefined;
  const intake = project.agentRun?.roles.source_intake?.proposal as { review_questions?: string[] } | undefined;
  const suggestedQuestions = [...new Set([...(intake?.review_questions ?? []), ...(planning?.clarification_questions ?? [])])];
  const start = async () => {
    if (startInProgress.current) return;
    startInProgress.current = true;
    setStarting(true);
    setStartError("");
    const attempt = ++startAttempt.current;
    const finish = (error?: string) => queueMicrotask(() => {
      if (startAttempt.current !== attempt) return;
      startAttempt.current += 1;
      startInProgress.current = false;
      setStarting(false);
      if (error) { setStartError(error); notify(error, "warning", "Review goal sources"); }
      else onStarted?.();
    });
    try {
      const selected = project.sources.filter(source => selectedSourceIds.includes(source.id));
      if (selected.length !== selectedSourceIds.length || selected.some(source => !goalSelectableSource(source)))
        throw new Error("A selected source changed. Review the current source revision before starting this goal.");
      for (const source of selected) await verifySourceOriginal(project, source);
      if (startAttempt.current !== attempt) return;
      const goalState = JSON.stringify([project.activeGoalId, project.goals.map(goal => [goal.id, goal.status])]);
      const workspaceState = JSON.stringify([project.workspaceId, project.workspaceKind, project.workspacePath, project.folderName]);
      update((p) => {
        if (startAttempt.current !== attempt) return;
        const sourcesStillMatch = selected.every(checked => p.sources.some(source =>
          source.id === checked.id && goalSelectableSource(source) && source.sha256 === checked.sha256 && source.relativePath === checked.relativePath));
        if (!sourcesStillMatch || JSON.stringify([p.workspaceId, p.workspaceKind, p.workspacePath, p.folderName]) !== workspaceState ||
            JSON.stringify([p.activeGoalId, p.goals.map(goal => [goal.id, goal.status])]) !== goalState) {
          finish("The project or a selected source changed while it was checked. Review the current selection and try again.");
          return;
        }
        p.goals.forEach((existing) => {
          if (existing.status === "Active") existing.status = "Planned";
        });
        const goalId = uid("GOAL");
        const conversationId = uid("CONV");
        const sourceIds = p.sources
          .filter((source) => goalSelectableSource(source) && selectedSourceIds.includes(source.id))
          .map((source) => source.id);
        const baseTitle = goalTitle.trim() || (kind === "New discovery" ? "Initial project discovery" : kind);
        let title = baseTitle;
        for (let number = 2; p.goals.some(existing => existing.title.toLowerCase() === title.toLowerCase()); number++)
          title = `${baseTitle} (${number})`;
        const goal: ProjectGoal = {
          id: goalId,
          title,
          kind,
          status: "Active",
          description:
            description.trim() || options.find((x) => x[0] === kind)![2],
          createdAt: "Just now",
          gate: "Setup",
          gateIndex: 0,
          conversationId,
          sourceIds,
          sourceRevisionPins: Object.fromEntries(p.sources.filter(source => sourceIds.includes(source.id) && source.sha256)
            .map(source => [source.id, source.sha256!])),
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
              origin: "attached" as const,
              removable: true,
              route: "sources",
            })),
          updated: "Just now",
          messages: [
            {
              id: uid("MSG"),
              role: "assistant",
              text: `Goal setup complete. Your active goal is “${goal.title}”. BA Mate may continue preparing suggestions in the background. Its Setup → Discover → Clarify → Define → Validate → Approve workflow is isolated from other goals.`,
            },
          ],
        });
        addAudit(
          p,
          "Started project goal",
          goal.id,
          `${goal.kind}: ${goal.description}; ${sourceIds.length} BA-selected sources for this goal.`,
        );
        finish();
      });
    } catch (error) {
      finish(error instanceof Error ? error.message : "The goal could not be started with the selected sources.");
    }
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
              BA Mate · Project goal
            </span>
            <h2>{project.goals.length ? "What would you like to work on?" : "What should we work on first?"}</h2>
            <p>
              Choose a goal, or describe it to BA Mate to receive and apply a proposed setup.
            </p>
          </div>
          {onCancel && (
            <IconButton label="Close goal creation" onClick={cancel}>
              <X size={18} />
            </IconButton>
          )}
        </header>
        <div className="modal-body">
          <div className="context-note">
            <Sparkles />
            <div>
              <b>{project.sourceAnalysisStatus === "ready" ? project.sources.length ? "Sources discovered; review before using as evidence" : "No sources found in the project folder" : project.sourceAnalysisStatus === "failed" ? "Project folder discovery paused" : "BA Mate is preparing project context"}</b>
              <p>
                {project.sources.length
                  ? `${project.sources.length} source${project.sources.length === 1 ? "" : "s"} found. Only sources you review and select can support this goal.`
                  : project.sourceAnalysisStatus === "ready" ? "Add sources from the Sources page when you are ready. You can start a goal now." : project.sourceAnalysisStatus === "failed" ? "Reconnect the project folder in project settings. You can still start a goal." : "Folder discovery and optional local AI planning continue in the background. You can choose a goal now or wait for suggestions."}
              </p>
            </div>
          </div>
          <div className="kickoff-source-selection">
            <div><b>Sources for this goal</b><small>Select reviewed sources that are relevant to this goal. You can change the selection later.</small></div>
            {project.sources.some(goalSelectableSource) && <div className="bulk-selection-controls">
              <span>{selectedSourceIds.length} selected</span>
              <button type="button" disabled={starting} onClick={() => setSelectedSourceIds(project.sources.filter(goalSelectableSource).map(source => source.id))}>Select all reviewed</button>
              <button type="button" disabled={starting || !selectedSourceIds.length} onClick={() => setSelectedSourceIds([])}>Clear selection</button>
            </div>}
            {project.sources.some(goalSelectableSource) ? project.sources.filter(goalSelectableSource).map(source =>
              <label key={source.id} className="kickoff-source-option">
                <input type="checkbox" disabled={starting} checked={selectedSourceIds.includes(source.id)} onChange={event => setSelectedSourceIds(current =>
                  event.target.checked ? [...new Set([...current, source.id])] : current.filter(id => id !== source.id))} />
                <span><strong>{source.relativePath ?? source.name}</strong><small>{source.type} · Reviewed revision {source.sha256?.slice(0, 12) ?? "unavailable"}</small></span>
              </label>) : <p>No current reviewed source revisions are available yet. You can start the goal and add sources after reviewing them.</p>}
            {project.sources.some(source => source.approved && !goalSelectableSource(source)) && <p>Some older source approvals have no usable folder revision. Review those files in Sources before selecting them for new work.</p>}
          </div>
          {project.agentRun?.status === "running" && <p className="setup-agent-status" role="status"><RefreshCw size={15} /> BA Mate's source, planning and governance roles are preparing suggestions…</p>}
          {project.agentRun?.status === "failed" && <p className="setup-agent-status" role="status">Background suggestions are unavailable: {project.agentRun.error}. You can continue manually.</p>}
          {project.agentRun?.status === "local_model_required" && <p className="setup-agent-status" role="status">{project.agentRun.message}</p>}
          <div className="kickoff-options">
            {options.map(([value, title, detail]) => (
              <button
                key={value}
                className={kind === value ? "selected" : ""}
                disabled={starting}
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
                  ) : value === "Stakeholder clarification" ? (
                    <CircleHelp />
                  ) : value === "Policy & governance review" ? (
                    <ShieldCheck />
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
          <div className="kickoff-goal-details">
            <label>Goal name <input value={goalTitle} disabled={starting} onChange={event => setGoalTitle(event.target.value)} placeholder={kind === "New discovery" ? "Initial project discovery" : kind} /></label>
            <label>Goal description <textarea value={description} disabled={starting} onChange={event => setDescription(event.target.value)} placeholder={options.find(option => option[0] === kind)?.[2]} rows={3} /></label>
            <small>Leave a field blank to use the selected goal type's default.</small>
          </div>
          {!!planning?.goals?.length && <details className="setup-agent-suggestions"><summary>Suggested goals ({planning.goals.length})</summary><p>These are proposals from tentative project context. You choose the work to start.</p>{planning.goals.map(goal => <button disabled={starting} key={`${goal.kind}:${goal.title}`} aria-pressed={kind === goal.kind && goalTitle === goal.title && description === goal.reason} onClick={() => { setKind(goal.kind); setGoalTitle(goal.title); setDescription(goal.reason); }}><Sparkles size={16} /><span><strong>{goal.title}</strong><small>{goal.reason}</small>{kind === goal.kind && goalTitle === goal.title && description === goal.reason && <small>Selected — review the goal details above.</small>}</span><ChevronRight size={16} /></button>)}</details>}
          {suggestedQuestions.length > 0 && <details className="setup-agent-suggestions"><summary>Suggested questions ({suggestedQuestions.length})</summary><p>Adopt a question to track it. BA Mate cannot answer for a stakeholder.</p>{suggestedQuestions.map(question => <div className="setup-agent-question" key={question}><span>{question}</span><Button disabled={project.clarifications.some(item => item.question === question)} onClick={() => update(p => { const id = uid("CQ"); p.clarifications.push({ id, priority: "Important", question, rationale: "BA Mate suggested this from tentative project context; confirm with the responsible person.", sourceId: "PROJECT-BRIEF", owner: "Business analyst", status: "Unanswered", suggestions: [], affects: [] }); addAudit(p, "Adopted clarification question", id, question); })}>{project.clarifications.some(item => item.question === question) ? "Added" : "Add question"}</Button></div>)}</details>}
          <div className="ba-mate-action">
            <div>
              <Sparkles size={19} />
              <span>
                <b>Describe this goal to BA Mate</b>
                <small>
                  {description
                    ? "You can ask BA Mate to refine the description above."
                    : "Ask BA Mate to interpret the goal and choose the appropriate workflow."}
                </small>
              </span>
            </div>
            <Button
              kind="primary"
              disabled={starting}
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
        {startError && <p className="context-note warning" role="alert">{startError}</p>}
        <footer>
          <span className="kickoff-note">
            <ShieldCheck size={15} /> This creates one active goal; future
            addenda and deliverables remain separate goals.
          </span>
          <div className="modal-footer-actions">
            {onCancel && <Button onClick={cancel}>Cancel</Button>}
            <Button kind="primary" onClick={() => void start()} disabled={starting}>
              <Sparkles size={16} /> {starting ? "Checking sources…" : "Start this goal"}
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
                    aria-label="Goal description for BA Mate"
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

export function GoalsView({
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
  const location = useLocation();
  const [creating, setCreating] = useState(() => new URLSearchParams(location.search).has("new"));
  useEffect(() => { if (new URLSearchParams(location.search).has("new")) setCreating(true); }, [location.search]);
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
  const hasCompletionFeedback = (goalId: string) =>
    !evaluationRunId ||
    stageFeedback.some(
      (entry) =>
        entry.runId === evaluationRunId &&
        entry.projectId === project.id &&
        entry.goalId === goalId &&
        entry.stage === "Approve",
    );
  const goalCanComplete = (goalId: string) =>
    canCompleteGoal(project, goalId) && hasCompletionFeedback(goalId);
  const complete = (goalId: string) =>
    goalCanComplete(goalId)
      ? update((p) => {
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
        })
      : notify(
          evaluationRunId && !hasCompletionFeedback(goalId)
            ? "Submit the Approve-stage study feedback before completing this evaluated goal."
            : "Reach Approve, create the goal-scoped approved baseline and revalidate implemented changes before completing this goal.",
          "warning",
          "Goal is not ready to complete",
        );
  const deleteGoal = (goal: ProjectGoal) =>
    update((p) => {
      const removedDocumentIds = new Set(p.documents.filter(item => item.goalId === goal.id).map(item => item.id));
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
          !removedDocumentIds.has(item.targetDocumentId),
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
              <div className="goal-workflow-mini" role="list" aria-label={`Workflow stages for ${goal.title}`}>
                {gates.map((gate, index) => (
                  <span
                    key={gate}
                    role="listitem"
                    aria-label={`${gate}: ${goal.status === "Completed" || index < goal.gateIndex ? "complete" : index === goal.gateIndex ? "current stage" : "not started"}`}
                    className={classNames(
                      (goal.status === "Completed" || index < goal.gateIndex) && "complete",
                      goal.status !== "Completed" && index === goal.gateIndex && "current",
                    )}
                    title={gate}
                  >
                    {goal.status === "Completed" || index < goal.gateIndex ? <Check size={12} /> : index + 1}
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
                  <dd>{goal.sourceIds.filter(id => project.sources.some(source => source.id === id && goalSourceCurrent(goal, source))).length} current
                    {goal.sourceIds.some(id => !project.sources.some(source => source.id === id && goalSourceCurrent(goal, source))) && " · review needed"}</dd>
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
                  <Button
                    kind="ghost"
                    disabled={!goalCanComplete(goal.id)}
                    title={
                      goalCanComplete(goal.id)
                        ? undefined
                        : evaluationRunId && !hasCompletionFeedback(goal.id)
                          ? "Submit Approve-stage feedback first."
                          : "Complete the governed workflow and approved baseline first."
                    }
                    onClick={() => complete(goal.id)}
                  >
                    Mark complete
                  </Button>
                )}
              </footer>
              {goal.status !== "Completed" && !goalCanComplete(goal.id) && <p className="goal-completion-hint">
                {evaluationRunId && !hasCompletionFeedback(goal.id) && goal.gate === "Approve"
                  ? "Submit Approve-stage feedback before completing this goal."
                  : goal.gate !== "Approve"
                    ? "Complete the workflow through Approve before marking this goal complete."
                    : `Complete before finishing: ${stageReadiness({ ...project, activeGoalId: goal.id }, "Approve").filter(item => !item.complete).map(item => item.label).join(", ")}.`}
              </p>}
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
            appNotice("The project goal and its scoped work were deleted.", "success");
          }}
        />
      )}
    </>
  );
}

export function NewProjectModal({
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
    | "Health & care"
    | "Education"
    | "Nonprofit & community"
    | "Operations & logistics"
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
    "Health & care": {
      description: "Patient safety, clinical review and sensitive records.", icon: <ShieldCheck />,
      seed: 1, domain: "Health & care", pack: "Health information and safety",
    },
    Education: {
      description: "Learner access, safeguarding and academic decisions.", icon: <BookOpen />,
      seed: 1, domain: "Education", pack: "Learner privacy and fairness",
    },
    "Nonprofit & community": {
      description: "Community outcomes, consent and responsible case work.", icon: <Users />,
      seed: 1, domain: "Nonprofit & community", pack: "Community consent and inclusion",
    },
    "Operations & logistics": {
      description: "Operational handoffs, safety and exception handling.", icon: <Boxes />,
      seed: 2, domain: "Operations & logistics", pack: "Operational safety and accountability",
    },
    Blank: {
      description:
        "Start with core safeguards and shape the workspace yourself.",
      icon: <Plus />,
      seed: 0,
      domain: "General",
      pack: "",
    },
  };
  const [step, setStep] = useState(1);
  const setupBodyRef = useRef<HTMLDivElement>(null);
  const setupHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousSetupStep = useRef(step);
  useEffect(() => {
    if (previousSetupStep.current === step) return;
    previousSetupStep.current = step;
    if (setupBodyRef.current) setupBodyRef.current.scrollTop = 0;
    setupHeadingRef.current?.focus({ preventScroll: true });
  }, [step]);
  const [name, setName] = useState("New BA project");
  const [template, setTemplate] = useState<TemplateName>("Financial services");
  const [folder, setFolder] = useState("Managed project folder");
  const [workspaceCandidate, setWorkspaceCandidate] = useState<WorkspaceCandidate>();
  const [projectBrief, setProjectBrief] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [filePlans, setFilePlans] = useState<Record<string, { name: string; folder: string }>>({});
  const [newFolder, setNewFolder] = useState("");
  const [createdFolders, setCreatedFolders] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [creationError, setCreationError] = useState("");
  const [policyPacks, setPolicyPacks] = useState<string[]>([
    "Core responsible BA",
    "Human oversight & traceability",
    "Privacy & data handling",
    "Financial services fairness",
  ]);
  const [aiDialog, setAiDialog] = useState<"project" | "governance" | null>(
    null,
  );
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiProposal, setAiProposal] = useState<{
    template: TemplateName;
    domain: string;
    policies: string[];
    summary: string;
  } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [allowRemoteDescription, setAllowRemoteDescription] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderFileRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const aiDialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(modalRef, () => { if (!creatingRef.current) onClose(); }, !aiDialog);
  useDialogAccessibility(
    aiDialogRef,
    () => setAiDialog(null),
    Boolean(aiDialog),
  );
  const meta = templates[template];
  const fileKey = (file: File) => relativePathForFile(file);
  const addFiles = async (selected: FileList | null) => {
    if (!selected?.length) return;
    const selectedFiles = Array.from(selected).filter(file => isSupportedSourceName(file.name));
    const skipped = selected.length - selectedFiles.length;
    if (!selectedFiles.length) { notify("This selection does not contain a supported source file.", "warning"); if (fileRef.current) fileRef.current.value = ""; if (folderFileRef.current) folderFileRef.current.value = ""; return; }
    for (const file of selectedFiles) {
      const key = fileKey(file);
      setFiles(current => [...current.filter(existing => fileKey(existing) !== key), file]);
      setFilePlans(current => ({ ...current, [key]: { name: file.name,
        folder: file.webkitRelativePath ? file.webkitRelativePath.split("/").slice(0, -1).join("/") : "Uploaded Sources" } }));
    }
    if (skipped) notify(`${skipped} unsupported or hidden file${skipped === 1 ? " was" : "s were"} skipped.`, "warning");
    if (fileRef.current) fileRef.current.value = "";
    if (folderFileRef.current) folderFileRef.current.value = "";
  };
  const removeFile = (key: string) => {
    setFiles((current) => current.filter((file) => fileKey(file) !== key));
    setFilePlans(current => { const next = { ...current }; delete next[key]; return next; });
  };
  const chooseFolder = async () => {
    try {
      const selected = await chooseProjectFolder();
      if (!selected) return;
      setWorkspaceCandidate(selected);
      setFolder(selected.name);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      appNotice(
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
    setAiError("");
    setAiDialog(mode);
  };
  const generateAiProposal = async () => {
    if (!aiDialog || !aiPrompt.trim() || aiBusy) return;
    setAiBusy(true); setAiError("");
    try {
      const result = await api<{ proposal: { template: TemplateName; domain: string; policies: string[]; summary: string } }>("/api/setup/propose", {
        method: "POST", body: JSON.stringify({ kind: aiDialog, description: aiPrompt,
          project_description: projectBrief, current_policies: policyPacks,
          cloud_allowed: allowRemoteDescription }),
      });
      setAiProposal(result.proposal);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "BA Mate could not prepare a proposal.");
    } finally { setAiBusy(false); }
  };
  const applyAiProposal = () => {
    if (!aiProposal || !aiDialog) return;
    if (aiDialog === "project") {
      setProjectBrief(aiPrompt);
      setTemplate(aiProposal.template);
      setCustomDomain(aiProposal.domain);
      setPolicyPacks(aiProposal.policies);
      if (aiProposal.template === "Blank")
        appNotice(
          "BA Mate created a blank foundation because the description did not match a guided template.",
        );
      else
        appNotice(
          `BA Mate applied the ${aiProposal.template} foundation to your project.`,
        );
    } else {
      setPolicyPacks(aiProposal.policies);
      appNotice(
        "BA Mate's full governance proposal is now in the editable policy pack.",
      );
    }
    setAiDialog(null);
  };
  const create = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setCreationError("");
    const p = JSON.parse(
      JSON.stringify(freshState().projects[meta.seed]),
    ) as Project;
    p.id = `project-${Date.now()}`;
    p.name = name.trim() || "Untitled BA project";
    p.domain = customDomain.trim() || meta.domain;
    p.description =
      projectBrief.trim() ||
      `A ${p.domain.toLowerCase()} project created with the ${template} template.`;
    p.folderName = folder.trim() || "Managed project folder";
    p.workspaceFolders = createdFolders;
    p.gate = "Setup";
    p.gateIndex = 0;
    p.template = template;
    p.governancePacks = [
      ...new Set(["Core responsible BA", "Human oversight & traceability", ...policyPacks.filter(Boolean)]),
    ];
    let uploads: { file: File; plan: { name: string; folder: string }; destination: string; data: string }[];
    try { uploads = await Promise.all(files.map(async file => {
      const plan = filePlans[fileKey(file)] ?? { name: file.name, folder: "Uploaded Sources" };
      const destination = [plan.folder.trim().replace(/^\/+|\/+$/g, ""), plan.name.trim()].filter(Boolean).join("/");
      if (!plan.name.trim() || /[\\/]/.test(plan.name) || !isSupportedSourceName(plan.name) || plan.folder.split("/").some(part => part === ".."))
        throw new Error(`Choose a valid supported file name and folder for ${file.name}.`);
      return { file, plan, destination, data: await readFileForWorkspace(file) };
    })); } catch (error) {
      creatingRef.current = false;
      setCreating(false);
      const message = error instanceof Error ? error.message : "Source files could not be read.";
      setCreationError(message);
      appNotice(message, "danger", "Project creation paused");
      return;
    }
    p.sources = uploads.map(({ file, plan, destination, data }, index) => ({
      id: `SRC-${String(index + 1).padStart(2, "0")}`,
      name: plan.name,
      relativePath: destination,
      type: sourceTypeForName(plan.name),
      status: "Needs review" as const,
      classification: "Project only" as const,
      provenance: "Added during project setup",
      concepts: ["Queued for background extraction and BA review"],
      originalBase64: data,
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
        "Queued knowledge base analysis",
        `${files.length} source${files.length === 1 ? "" : "s"}`,
        "Source materials will be extracted after project creation and require BA review.",
      );
    addAudit(
      p,
      "Configured governance pack",
      "Project policy pack",
      p.governancePacks.join(" · "),
    );
    p.cloudAllowed = false; p.aiRuns = [];
    let createdFolder: string | undefined;
    try {
      const reference = await createProjectWorkspace(p.id, p.name, workspaceCandidate);
      createdFolder = reference.displayPath ?? reference.folderName;
      await createProjectDirectories(reference, createdFolders);
      const written = await writeProjectFiles(reference, uploads.map(({ plan, destination, data }) => ({ name: plan.name, relativePath: destination, data })));
      written.forEach((path, index) => { if (p.sources[index]) { p.sources[index].relativePath = path; p.sources[index].name = path.split("/").at(-1) ?? p.sources[index].name; p.sources[index].originalBase64 = undefined; } });
      p.workspaceId = reference.workspaceId;
      p.workspaceKind = reference.workspaceKind;
      p.workspacePath = reference.displayPath;
      p.folderName = reference.folderName;
      addAudit(p, "Materialized project folder", reference.folderName, `${files.length} uploaded source${files.length === 1 ? " was" : "s were"} copied to the selected locations; existing folder contents will be discovered in the background.`);
      onCreate(p);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "The project folder could not be created.";
      const message = createdFolder ? `${reason} The folder ${createdFolder} may already contain copied files. It was not removed; check it before retrying.` : reason;
      setCreationError(message);
      appNotice(message, "danger", "Project creation failed");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
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
            <h2 ref={setupHeadingRef} tabIndex={-1}>{stageTitles[step - 1]}</h2>
          </div>
          <IconButton label="Close" onClick={onClose} disabled={creating}>
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
        <div className="modal-body" ref={setupBodyRef}>
          {step === 1 && (
            <div className="setup-step">
              <div className="setup-intro">
                <Sparkles size={20} />
                <div>
                  <b>Give BA Mate the right starting context</b>
                </div>
                <SetupTip step={1} title="About the project foundation">Choose a template or describe the work. BA Mate can propose a suitable foundation, domain and safeguards. You can review them before creating the project.</SetupTip>
              </div>
              <div className="setup-two-column setup-name-only">
                <label className="editor-field">
                  <span>Project name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Student support service"
                  />
                </label>
              </div>
              <div className="field-heading">
                <b>Choose a template</b>
                <span>9 guided foundations plus a blank workspace</span>
              </div>
              <div className="template-cards expanded">
                {(Object.keys(templates) as TemplateName[]).map((option) => (
                  <button
                    key={option}
                    className={template === option ? "selected" : ""}
                    aria-pressed={template === option}
                    onClick={() => {
                      setTemplate(option);
                      setCustomDomain("");
                      const defaults = new Set(Object.values(templates).map(item => item.pack));
                      setPolicyPacks(current => [...new Set([...current.filter(pack => !defaults.has(pack)), ...(option === "Blank" ? [] : [templates[option].pack])])]);
                    }}
                  >
                    <i>{templates[option].icon}</i>
                    <b>{option}</b>
                    <span>{templates[option].description}</span>
                    {template === option && <CheckCircle2 size={16} />}
                  </button>
                ))}
              </div>
              {template === "Blank" && <label className="editor-field"><span>Project category or domain</span><input value={customDomain} onChange={event => setCustomDomain(event.target.value)} placeholder="e.g. Environmental services" /></label>}
              {template !== "Blank" && customDomain && customDomain !== meta.domain && <p className="setup-domain-note">BA Mate classified this project as <b>{customDomain}</b>.</p>}
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
                </div>
                <SetupTip step={2} title="About workspace and sources">Create a folder named for this project or select an existing one. BA Mate needs read and write access. All supported files in that folder, including nested folders, are discovered after creation and held for BA review.</SetupTip>
              </div>
              <div className="folder-path">
                <Folder size={19} />
                <div>
                  <b>{workspaceCandidate ? folder : name.trim() || "Untitled BA project"}</b>
                  <small>{workspaceCandidate ? "Existing folder · read and write access required" : "New managed folder named from this project"}</small>
                </div>
                <Button onClick={() => { setWorkspaceCandidate(undefined); setFolder("Managed project folder"); }}><Plus size={16} /> Create new</Button>
                <Button onClick={chooseFolder}><Folder size={16} /> Choose existing</Button>
              </div>
              <input
                ref={fileRef}
                hidden
                type="file"
                aria-label="Add project knowledge-base files"
                multiple
                accept={SOURCE_ACCEPT}
                onChange={(e) => addFiles(e.target.files)}
              />
              <input
                ref={(node) => { folderFileRef.current = node; if (node) node.setAttribute("webkitdirectory", ""); }}
                hidden
                type="file"
                aria-label="Add a folder of project knowledge-base files"
                multiple
                accept={SOURCE_ACCEPT}
                onChange={(e) => addFiles(e.target.files)}
              />
              <button
                className="knowledge-drop"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={24} />
                <b>Add project files</b>
                <span>
                  PDF, DOCX, text, Markdown, CSV, Excel, images, audio and video
                </span>
                <span className="drop-action">Browse files</span>
              </button>
              <Button onClick={() => folderFileRef.current?.click()}>
                <Folder size={16} /> Add or create folders
              </Button>
              <div className="setup-folder-creator">
                <input aria-label="New folder in project" value={newFolder} onChange={event => setNewFolder(event.target.value)} placeholder="New folder path, e.g. Interviews" />
                <Button onClick={() => { const clean = newFolder.trim().replace(/^\/+|\/+$/g, ""); if (!clean || clean.split("/").some(part => part === ".." || part === ".")) { appNotice("Enter a folder name inside the project.", "warning"); return; } setCreatedFolders(current => [...new Set([...current, clean])]); setNewFolder(""); }}>Create folder</Button>
              </div>
              {createdFolders.length > 0 && <p className="setup-folder-list">Created for this project: {createdFolders.join(" · ")}</p>}
              {files.length > 0 ? (
                <>
                  <div className="analysis-status">
                    <span><Clock3 size={17} /></span>
                    <div>
                      <b>Ready for background analysis</b>
                      <small>
                        {files.length} uploaded item{files.length === 1 ? "" : "s"}; existing folder contents will also be discovered after creation.
                      </small>
                    </div>
                    <Badge tone="warning">Queued</Badge>
                  </div>
                  <div className="knowledge-file-list">
                    {files.map((file) => (
                      <div key={fileKey(file)}>
                        <i>
                          <FileText size={17} />
                        </i>
                        <span className="setup-file-fields">
                          <input aria-label={`Name for ${file.name}`} value={filePlans[fileKey(file)]?.name ?? file.name} onChange={event => setFilePlans(current => ({ ...current, [fileKey(file)]: { ...(current[fileKey(file)] ?? { folder: "Uploaded Sources", name: file.name }), name: event.target.value } }))} />
                          <input aria-label={`Destination folder for ${file.name}`} list="setup-folder-options" value={filePlans[fileKey(file)]?.folder ?? "Uploaded Sources"} onChange={event => setFilePlans(current => ({ ...current, [fileKey(file)]: { ...(current[fileKey(file)] ?? { folder: "Uploaded Sources", name: file.name }), folder: event.target.value } }))} />
                          <small>{Math.max(1, Math.round(file.size / 1024))} KB · Analysis starts after project creation</small>
                        </span>
                        <StatusBadge value="Queued" />
                        <IconButton
                          label={`Remove ${file.name}`}
                          onClick={() => removeFile(fileKey(file))}
                        >
                          <X size={16} />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                  <datalist id="setup-folder-options"><option value="Uploaded Sources" />{createdFolders.map(item => <option key={item} value={item} />)}</datalist>
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
                </div>
                <SetupTip step={3} title="About governance">BA Mate can suggest a policy set from your project description and further instructions. Review every addition, edit or removal. Core human approval, privacy and evidence safeguards remain in force.</SetupTip>
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
                    {files.length ? `${files.length} upload${files.length === 1 ? "" : "s"} queued` : "Workspace will be scanned"}
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
                <Button disabled={creating} onClick={() => describeToBaMate("governance")}>
                  <Sparkles size={16} /> Describe to BA Mate
                </Button>
              </div>
              <div className="policy-editor">
                <header>
                  <div>
                    <b>Governance & policy pack</b>
                    <p>
                      Core policies are locked; other policies can be edited after recommendations are applied.
                    </p>
                  </div>
                  <Button disabled={creating} onClick={addPolicy}>
                    <Plus size={15} /> Add policy
                  </Button>
                </header>
                {policyPacks.map((pack, index) => (
                  <label key={`${pack}-${index}`}>
                    <ShieldCheck size={16} />
                    <input
                      aria-label={`Policy ${index + 1}`}
                      value={pack}
                      disabled={creating}
                      readOnly={['Core responsible BA', 'Human oversight & traceability'].includes(pack)}
                      onChange={(e) =>
                        setPolicyPacks((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? e.target.value : item,
                          ),
                        )
                      }
                    />
                    {['Core responsible BA', 'Human oversight & traceability'].includes(pack) ? <span className="project-policy-locked">Locked</span> : (
                      <IconButton
                        label={`Remove ${pack}`}
                        disabled={creating}
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
                  <b>Governance uses layered safeguards</b>
                  <p>
                    Human approval, privacy, uncertainty disclosure and
                    traceability remain core safeguards.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        {creationError && <p role="alert" className="context-note warning">{creationError}</p>}
        <footer>
          <Button disabled={creating} onClick={step === 1 ? onClose : () => setStep(step - 1)}>
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 3 ? (
            <Button kind="primary" onClick={() => setStep(step + 1)}>
              Continue <ArrowRight size={16} />
            </Button>
          ) : (
            <Button kind="primary" onClick={() => void create()} disabled={creating}>
              {creating ? <RefreshCw size={16} /> : <Check size={16} />} {creating ? "Creating project folder…" : "Create local project"}
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
                    aria-label={aiDialog === "project" ? "Project description for BA Mate" : "Governance needs for BA Mate"}
                    autoFocus
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder={
                      aiDialog === "project"
                        ? "Example: Create a student-support platform handling personal records and approval decisions."
                        : "Example: Student data must be private, retention must be clear, and any decision needs human review."
                    }
                  />
                  <label className="setup-remote-choice"><input type="checkbox" checked={allowRemoteDescription} onChange={event => setAllowRemoteDescription(event.target.checked)} /> Allow the configured remote AI provider to process this description if one is selected</label>
                  {aiError && <p className="setup-ai-error" role="alert">{aiError}</p>}
                  <footer>
                    <Button onClick={() => setAiDialog(null)}>Cancel</Button>
                    <Button
                      kind="primary"
                      disabled={!aiPrompt.trim() || aiBusy}
                      onClick={() => void generateAiProposal()}
                    >
                      <Sparkles size={16} /> {aiBusy ? "Preparing proposal…" : "Ask BA Mate"}
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
                        {aiProposal.policies.map((item) => (
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
                          ? `No close template was found. BA Mate proposes a blank ${aiProposal.domain} foundation.`
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
                        : "Apply reviewed policy list"}
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

export default function App() {
  const [state, setState] = useState<WorkspaceState>(() => ({ schemaVersion: 7, projects: [], evaluationRuns: [], telemetryEvents: [], stageFeedback: [] }));
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState("Saved on this device");
  const savedState = useRef<WorkspaceState | null>(null);
  const currentState = useRef(state);
  const saveFailureNotified = useRef(false);
  const folderFailureNotified = useRef(new Set<string>());
  const pageContentRef = useRef<HTMLElement>(null);
  currentState.current = state;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inspector, setInspector] = useState(false);
  const [inspectorPinned, setInspectorPinned] = useState(
    () => localStorage.getItem("ba-mate-assistant-pinned") === "true",
  );
  const [activeReference, setActiveReference] = useState<ArtifactReference>();
  const [referenceProjectId, setReferenceProjectId] = useState<string>();
  const [newProject, setNewProject] = useState(false);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const settingsVisited = useRef(false);
  if (location.pathname === "/settings") settingsVisited.current = true;
  useEffect(() => {
    if (pageContentRef.current) {
      pageContentRef.current.scrollTop = 0;
      pageContentRef.current.scrollLeft = 0;
    }
  }, [location.pathname, ready]);
  useEffect(() => {
    repository
      .load()
      .then((saved) => {
        savedState.current = saved ?? currentState.current;
        if (saved) setState(saved);
        setReady(true);
      })
      .catch((error) => { setLoadError(error.message || "The saved workspace could not be loaded."); });
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (saveFailureNotified.current) { setSaveStatus("Saving paused"); return; }
    if (state === savedState.current) return;
    setSaveStatus("Saving…");
    const timer = window.setTimeout(() => {
      repository.save(state).then(() => {
        savedState.current = state;
        saveFailureNotified.current = false;
        if (currentState.current === state) setSaveStatus("Saved on this device");
      }).catch((error) => {
        setSaveStatus("Saving paused");
        if (!saveFailureNotified.current) {
          saveFailureNotified.current = true;
          notify(`Recent changes could not be saved. ${error.message} Use the recovery panel before closing.`, "danger", "Saving paused");
        }
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [state, ready]);
  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    let running = false;
    const refresh = async () => {
      if (running || stopped) return;
      running = true;
      try {
        for (const item of currentState.current.projects) {
          if (!item.workspaceId || !item.workspaceKind || stopped) continue;
          try {
            const analysis = await getProjectAnalysis({ workspaceId: item.workspaceId, workspaceKind: item.workspaceKind, folderName: item.folderName, displayPath: item.workspacePath });
            if (stopped) return;
            if (analysis.status === "ready") folderFailureNotified.current.delete(item.id);
            if (analysis.status === "ready") {
              const currentProject = currentState.current.projects.find(project => project.id === item.id && project.workspaceId === item.workspaceId);
              if (currentProject) {
                const revised = Object.values(analysis.sources).filter(candidate => {
                  const prior = currentProject.sources.find(source => source.relativePath === candidate.relative_path)
                    ?? currentProject.sources.find(source => !source.analysisSignature && source.name === candidate.name && source.sha256 === candidate.sha256);
                  return !prior || prior.sha256 !== candidate.sha256;
                }).length;
                const removed = currentProject.sources.filter(source => source.analysisSignature && source.relativePath &&
                  !analysis.sources[source.relativePath] && source.status !== "Excluded").length;
                if (revised || removed) appNotice(
                  `${revised + removed} project source${revised + removed === 1 ? "" : "s"} ${revised + removed === 1 ? "needs" : "need"} review in ${item.name}. Existing approvals for changed files are withdrawn.`,
                  "warning", "Project sources changed",
                );
              }
            }
            setState(current => {
              const target = current.projects.find(project => project.id === item.id && project.workspaceId === item.workspaceId);
              if (!target) return current;
              const next = structuredClone(current);
              const matching = next.projects.find(project => project.id === item.id)!;
              return mergeProjectAnalysis(matching, analysis) ? next : current;
            });
            if (analysis.status === "ready") {
              const agentRun = await requestProjectAgentRun(item, analysis);
              if (stopped) return;
              const previouslyReady = currentState.current.projects.find(project => project.id === item.id)?.agentRun;
              if (agentRun.status === "ready" && (previouslyReady?.signature !== agentRun.signature || previouslyReady?.status !== "ready"))
                appNotice(`BA Mate has new source, planning and governance suggestions for ${item.name}.`, "info", "Suggestions ready for review");
              setState(current => {
                const target = current.projects.find(project => project.id === item.id && project.workspaceId === item.workspaceId);
                if (!target || JSON.stringify(target.agentRun) === JSON.stringify(agentRun)) return current;
                const next = structuredClone(current);
                const updated = next.projects.find(project => project.id === item.id)!;
                updated.agentRun = agentRun;
                surfaceBackgroundQuestion(updated, agentRun);
                return next;
              });
            }
          } catch (error) {
            if (stopped) return;
            setState(current => {
              const target = current.projects.find(project => project.id === item.id && project.workspaceId === item.workspaceId);
              if (!target || target.sourceAnalysisStatus === "failed") return current;
              const next = structuredClone(current);
              next.projects.find(project => project.id === item.id)!.sourceAnalysisStatus = "failed";
              return next;
            });
            if (!folderFailureNotified.current.has(item.id)) {
              folderFailureNotified.current.add(item.id);
              appNotice(`${item.name}: ${error instanceof Error ? error.message : "the project folder could not be read"}. Reconnect it in project settings.`, "warning", "Project folder unavailable");
            }
          }
        }
      } finally { running = false; }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10000);
    return () => { stopped = true; window.clearInterval(interval); };
  }, [ready]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (ready && (savedState.current !== currentState.current || projectSettingsDrafts.size > 0 || clarificationDrafts.size > 0 || conversationDrafts.size > 0 || [...assistantSessions.values()].some(session => session.prompt.trim()))) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    for (const id of projectSettingsDrafts.keys()) if (!state.projects.some(project => project.id === id)) projectSettingsDrafts.delete(id);
    for (const key of clarificationDrafts.keys()) {
      const [projectId, questionId] = JSON.parse(key) as [string, string];
      if (!state.projects.some(project => project.id === projectId && project.clarifications.some(question => question.id === questionId))) clarificationDrafts.delete(key);
    }
    for (const id of assistantSessions.keys()) if (!state.projects.some(project => project.id === id)) assistantSessions.delete(id);
    for (const key of conversationDrafts.keys()) {
      const [projectId, conversationId] = JSON.parse(key) as [string, string];
      if (!state.projects.some(project => project.id === projectId && project.conversations.some(conversation => conversation.id === conversationId))) conversationDrafts.delete(key);
    }
  }, [ready, state.projects]);
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
  useEffect(() => { setActiveReference(undefined); setInspector(false); }, [project?.id]);
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
    const projectEvaluationRun = state.evaluationRuns.find(
      (run) => run.status === "Running" && run.projectId === project.id,
    );
    switch (section) {
      case "overview":
        return <ProjectOverview project={project} go={go} update={update} />;
      case "goals":
        return (
          <GoalsView
            {...props}
            go={go}
            evaluationRunId={projectEvaluationRun?.id}
            stageFeedback={state.stageFeedback}
          />
        );
      case "workflow":
        return (
          <WorkflowView
            {...props}
            go={go}
            evaluationRunId={projectEvaluationRun?.id}
            stageFeedback={state.stageFeedback}
          />
        );
      case "conversations":
        return (
          <ConnectedConversations
            key={project.id}
            {...props}
            automaticContext={referenceProjectId === project.id ? activeReference : undefined}
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
              setReferenceProjectId(project.id);
              setInspector(true);
            }}
            onOpenConversation={(ref) => {
              setActiveReference(ref);
              setReferenceProjectId(project.id);
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
        return <TeamView key={project.id} {...props} />;
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
      {(["artifacts", "diagrams", "documents", "changes", "governance"] as string[]).includes(section) && <details className="studio-ai-panel" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}><summary><span>Task AI</span><span className="studio-ai-close">Close</span></summary><WorkflowWorkbench key={`${project.id}:${section}`} project={project} update={update} initialTask={section === "diagrams" ? "diagram" : section === "documents" ? "document" : section === "changes" ? "impact" : section === "governance" ? "validate" : "requirements"} /></details>}
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
  ) : globalPage === "settings" ? null : globalPage === "research" ? (
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
        inspector && project && "inspector-open",
        inspector && project && inspectorPinned && "inspector-pinned",
      )}
    >
      <Sidebar
        state={state}
        project={project}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        evaluationActive={state.evaluationRuns.some(
          (run) => run.status === "Running" && run.projectId === project?.id,
        )}
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
          saveStatus={saveStatus}
          onMenu={() => setMobileOpen(true)}
          onInspector={() => setInspector(!inspector)}
          inspectorOpen={inspector}
          assistantAvailable={section !== "conversations"}
        />
        <main className={classNames("page-content", Boolean(project && section === "conversations") && "conversation-page")} ref={pageContentRef}>
          {saveStatus === "Saving paused" && <UnsavedRecovery projects={state.projects} activeProjectId={project?.id} />}
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
          {settingsVisited.current && <div hidden={location.pathname !== "/settings"}><WorkspaceSettings state={state} setState={setState} active={location.pathname === "/settings"} /></div>}
        </main>
      </div>
      {project && section !== "conversations" && inspector && !inspectorPinned && (
        <button
          className="assistant-scrim"
          aria-label="Close BA Mate assistant"
          onClick={() => setInspector(false)}
        />
      )}{" "}
      {project && section !== "conversations" && inspector && (
        <Suspense fallback={null}>
          <AssistantDrawer
            key={project.id}
            onOpenConversation={() => { setInspector(false); navigate(`/projects/${project.id}/conversations`); }}
            project={project}
            context={referenceProjectId === project.id ? activeReference : undefined}
            evaluationActive={state.evaluationRuns.some(r => r.status === "Running" && r.projectId === project.id)}
            pinned={inspectorPinned}
            onPin={() => setInspectorPinned(!inspectorPinned)}
            onClose={() => setInspector(false)}
            onNavigate={(path) => { if (!inspectorPinned) setInspector(false); navigate(path); }}
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
            appNotice(
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
