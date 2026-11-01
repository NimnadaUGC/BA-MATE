import { get, set } from "idb-keyval";
import JSZip from "jszip";
import { api } from "./api";
import type {
  ArtifactRevisionReference,
  ArtifactType,
  AuditEvent,
  Clarification,
  ConversationContext,
  DocumentBlock,
  Project,
  TraceLink,
  VersionSnapshot,
  WorkspaceState,
} from "./types";
import { seedState } from "./data";
import { staleGoalSourceIds } from "./sourceScope";

const STORAGE_KEY = "ba-mate-workspace-v2";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export interface WorkspaceRepository {
  load(): Promise<WorkspaceState | null>;
  save(state: WorkspaceState): Promise<void>;
  exportProject(project: Project): Promise<Blob>;
  importProject(file: File): Promise<Project>;
}

export const migrateWorkspace = (input: unknown): WorkspaceState => {
  const state = clone((input as WorkspaceState) ?? seedState);
  const sourceSchemaVersion = state.schemaVersion ?? 1;
  state.schemaVersion = 8;
  state.evaluationRuns ??= [];
  state.telemetryEvents ??= [];
  state.stageFeedback ??= [];
  state.researchParticipation ??= { enrollment: { status: "not-enrolled" }, queue: [] };
  state.projects = (state.projects ?? []).map((project) => {
    project.briefVersion ??= 1;
    project.documentSyncProposals ??= [];
    project.documentSyncProposals = project.documentSyncProposals.map((proposal) => ({
      ...proposal,
      status: proposal.status === "stale" ? "stale" : proposal.status,
      targetDocumentRevision: proposal.targetDocumentRevision ?? (proposal.targetDocumentId ? (project.documents ?? []).find(document => document.id === proposal.targetDocumentId)?.version : undefined),
      changes: proposal.changes.map((change) => ({
        ...change,
        sourceRevision: change.sourceRevision ?? revisionOf(project, change.artifactId),
      })),
    }));
    project.changes = (project.changes ?? []).map((change) => ({ ...change, patches: change.patches ?? [], baselineId: change.baselineId ?? project.versions?.find(version => version.type === "Baseline")?.id }));
    project.aiRuns ??= [];
    project.cloudAllowed ??= false;
    const shouldRestoreDemonstrationGoal =
      project.goals == null ||
      (sourceSchemaVersion < 5 &&
        ["loan", "leave", "returns"].includes(project.id) &&
        project.goals.length === 0);
    project.goals = (
      shouldRestoreDemonstrationGoal
        ? [
            {
              id: "GOAL-01",
              title: "Primary project delivery",
              kind: "New discovery" as const,
              status: "Active" as const,
              description:
                "Establish and deliver the initial governed business-analysis scope.",
              createdAt: "Migrated workspace",
              gate: project.gate ?? "Setup",
              gateIndex: project.gateIndex ?? 0,
              sourceIds: (project.sources ?? [])
                .filter((source) => source.approved)
                .map((source) => source.id),
              deliverables: [],
              conversationId: project.conversations?.[0]?.id,
            },
          ]
        : (project.goals ?? [])
    ).map((goal) => ({
      ...goal,
      gate: goal.gate ?? project.gate ?? "Setup",
      gateIndex: goal.gateIndex ?? project.gateIndex ?? 0,
      sourceIds: goal.sourceIds ?? [],
      sourceRevisionPins: goal.sourceRevisionPins ?? Object.fromEntries((goal.sourceIds ?? []).flatMap(id => {
        const source = (project.sources ?? []).find(item => item.id === id);
        return source?.approved && source.status === "Analyzed" && source.sha256 ? [[id, source.sha256]] : [];
      })),
      deliverables: goal.deliverables ?? [],
    }));
    if (
      !project.activeGoalId ||
      !project.goals.some((goal) => goal.id === project.activeGoalId)
    )
      project.activeGoalId = project.goals.find(
        (goal) => goal.status === "Active",
      )?.id;
    if (project.activeGoalId) {
      const owned = [
        ...project.requirements,
        ...project.stories,
        ...project.diagrams,
        ...project.documents,
        ...project.changes,
      ];
      // Only legacy single-goal workspaces have an unambiguous owner. A later
      // active goal must not silently claim previously unassigned records.
      if (sourceSchemaVersion < 5 && project.goals.length === 1) owned.forEach((artifact) => {
        artifact.goalId ??= project.activeGoalId;
      });
      const goal = project.goals.find(
        (item) => item.id === project.activeGoalId,
      );
      if (goal)
        goal.deliverables = [
          ...new Set([
            ...goal.deliverables,
            ...owned.filter((artifact) => artifact.goalId === goal.id).map((artifact) => artifact.id),
          ]),
        ];
    }
    project.requirements = (project.requirements ?? []).map((r) => ({
      ...r,
      rationale: r.rationale ?? "Business rationale pending confirmation.",
      businessValue: r.businessValue ?? "Business value pending confirmation.",
      businessRules: r.businessRules ?? [],
      fitCriteria: r.fitCriteria ?? [],
      dependencies: r.dependencies ?? [],
      stakeholders: r.stakeholders ?? [],
      openQuestions: r.openQuestions ?? [],
      comments: r.comments ?? [],
      syncStatus: r.syncStatus ?? "Not included",
    }));
    project.sources = (project.sources ?? []).map((source) => ({ ...source, version: source.version ?? 1 }));
    project.clarifications = (project.clarifications ?? []).map((question) => ({ ...question, version: question.version ?? 1 }));
    project.registers = (project.registers ?? []).map((item) => ({ ...item, version: item.version ?? 1 }));
    project.checks = (project.checks ?? []).map((item) => ({ ...item, version: item.version ?? 1 }));
    project.stories = (project.stories ?? []).map((s) => ({
      ...s,
      epic: s.epic ?? "Project delivery",
      feature: s.feature ?? s.goal,
      owner: s.owner ?? "Business analyst",
      dependencies: s.dependencies ?? [],
      sourceIds: s.sourceIds ?? [],
      comments: s.comments ?? [],
      syncStatus: s.syncStatus ?? "Not included",
    }));
    project.diagrams = (project.diagrams ?? []).map((d) => ({
      ...d,
      approvalStatus:
        d.approvalStatus ?? (d.status === "Current" ? "Approved" : "Draft"),
      comments: d.comments ?? [],
      versions: d.versions ?? [
        {
          version: d.version,
          source: d.source,
          at: "Migrated",
          actor: "Workspace migration",
          note: "Preserved existing diagram",
        },
      ],
    }));
    project.documents = (project.documents ?? []).map((doc) => ({
      ...doc,
      template:
        (doc.template as string) === "Organization SRS v2"
          ? "Software Requirements Specification"
          : doc.template,
      receipts: doc.receipts ?? [],
      comments: doc.comments ?? [],
      sections: (doc.sections ?? []).map((section) => ({
        ...section,
        comments: section.comments ?? [],
        blocks:
          section.blocks ??
          ([
            {
              id: `BLK-${section.id}`,
              type: "paragraph",
              content: section.content,
              linkedIds: section.linkedIds,
            },
          ] as DocumentBlock[]),
      })),
    }));
    project.conversations = (project.conversations ?? []).map(
      (conversation) => ({
        ...conversation,
        context: (conversation.context ?? []).map(
          (item: string | ConversationContext) =>
            typeof item === "string"
              ? {
                  id: item,
                  type: item.startsWith("SRC")
                    ? "Source"
                    : item.startsWith("FR") || item.startsWith("NFR")
                      ? "Requirement"
                      : "Document",
                  label: item,
                  origin: "attached",
                  removable: true,
                }
              : item,
        ),
      }),
    );
    // Old workspaces did not pin the endpoints reviewed by a trace link.  Pin
    // their current revisions during migration; later content changes make the
    // link Pending until a BA verifies the new endpoints.
    project.traceLinks = (project.traceLinks ?? []).map((link) => ({
      ...link,
      fromRevision: link.fromRevision ?? revisionOf(project, link.from),
      toRevision: link.toRevision ?? revisionOf(project, link.to),
    }));
    return project;
  });
  return state;
};

export class IndexedDbWorkspaceRepository implements WorkspaceRepository {
  async load() {
    const saved = await get<WorkspaceState>(STORAGE_KEY);
    return saved ? migrateWorkspace(saved) : null;
  }
  async save(state: WorkspaceState) {
    await set(STORAGE_KEY, state);
  }
  async exportProject(project: Project) {
    const zip = new JSZip();
    // Version 4 prevents older importers from silently accepting relationships
    // whose multiple passage pins they do not understand.
    zip.file("ba-mate-project.json", JSON.stringify({ format: "ba-mate-project", formatVersion: 4, schemaVersion: 8, exportedAt: new Date().toISOString(), project }, null, 2));
    return zip.generateAsync({ type: "blob" });
  }
  async importProject(file: File) {
    if (file.size > 150 * 1024 * 1024) throw new Error("Project package exceeds 150 MB.");
    let zip: JSZip;
    try { zip = await JSZip.loadAsync(file); }
    catch { throw new Error("This file is not a valid project backup ZIP. Choose a BA Mate project backup and try again."); }
    const entry = zip.file("ba-mate-project.json");
    if (!entry) throw new Error("This legacy package cannot be restored completely. Open the original workspace and export it with BA Mate 0.4 first.");
    const text = await entry.async("string");
    if (text.length > 200 * 1024 * 1024) throw new Error("Expanded project exceeds the import limit.");
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error("The project data in this backup is damaged or invalid. Nothing was imported."); }
    if (data?.format === "ba-mate-project" && (data.formatVersion > 4 || data.schemaVersion > 8)) throw new Error("This backup was created by a newer BA Mate version. Update BA Mate before restoring it.");
    const supportedVersion = ([2, 3].includes(data?.formatVersion) && [6, 7].includes(data?.schemaVersion)) || (data?.formatVersion === 4 && data?.schemaVersion === 8);
    if (!data || typeof data !== "object" || data.format !== "ba-mate-project" || !supportedVersion || !data.project || typeof data.project.name !== "string") throw new Error("Unsupported or invalid BA Mate project package.");
    const project = data.project as Project;
    for (const key of ["sources", "requirements", "stories", "registers", "traceLinks", "checks", "diagrams", "documents", "changes", "audit", "versions", "clarifications", "conversations", "members", "goals"] as const) {
      if (!Array.isArray(project[key])) throw new Error(`Project package is missing ${key}; nothing was imported.`);
    }
    project.id = `imported-${crypto.randomUUID()}`;
    project.cloudAllowed = false;
    addAudit(project, "Imported project package", project.id, "Project records, history and baselines restored. Sources without retained originals require review. External processing disabled on this device.");
    return migrateWorkspace({ schemaVersion: data.schemaVersion, projects: [project], evaluationRuns: [], telemetryEvents: [], stageFeedback: [] }).projects[0];
  }
}

class ServiceWorkspaceRepository extends IndexedDbWorkspaceRepository {
  private revision = 0;
  private saveQueue: Promise<void> = Promise.resolve();
  private failed = false;
  async load() {
    const remote = await api<{ revision: number; state: WorkspaceState | null }>("/api/workspace");
    this.revision = remote.revision;
    if (remote.state) return migrateWorkspace(remote.state);
    // One-time migration retains the original browser copy until a service save succeeds.
    return super.load();
  }
  async save(state: WorkspaceState) {
    const snapshot = clone(state);
    const job = this.saveQueue.then(async () => {
      if (this.failed) throw new Error("Saving is paused after a storage conflict. Export a backup and reopen BA Mate.");
      try {
        const result = await api<{ revision: number }>("/api/workspace", { method: "PUT", body: JSON.stringify({ expected_revision: this.revision, state: snapshot }) });
        this.revision = result.revision;
      } catch (error) { this.failed = true; throw error; }
    });
    this.saveQueue = job.catch(() => {});
    return job;
  }
}
export const repository: WorkspaceRepository = new ServiceWorkspaceRepository();

export const freshState = () => migrateWorkspace(seedState);

export const addAudit = (
  project: Project,
  action: string,
  object: string,
  detail: string,
  actor = "Business analyst",
) => {
  const event: AuditEvent = {
    id: `EV-${crypto.randomUUID()}`,
    at: new Date().toISOString(),
    actor,
    action,
    object,
    detail,
  };
  project.audit = [event, ...project.audit];
};

/** Preserve unsaved project records even if source files or the service are unavailable. */
export function recordsOnlyRecoveryProject(project: Project): Project {
  const recovery = clone(project);
  recovery.name = `${project.name} — recovered records`;
  recovery.sources.forEach(source => { source.originalBase64 = undefined; });
  recovery.cloudAllowed = false;
  addAudit(recovery, "Created records-only recovery copy", recovery.id,
    "Project records were recovered without original source files. Reattach and review sources after restore.");
  return recovery;
}

export const canApprove = (project: Project, memberId = "MEM-01") =>
  project.members.some(
    (member) =>
      member.id === memberId && member.approval && member.status === "Active",
  );
export const blockers = (project: Project, goalId?: string) =>
  project.checks.filter(
    (check) =>
      check.status === "Blocking" &&
      (!goalId || !check.goalId || check.goalId === goalId),
  ).length +
  project.clarifications.filter(
    (q) =>
      q.priority === "Blocking" &&
      (q.status !== "Answered" || !q.answer?.trim()) &&
      (!goalId || !q.goalId || q.goalId === goalId),
  ).length;
const supportedArtifactCount = (project: Project, goalId?: string, onlyId?: string) => {
  const artifacts = [...project.requirements, ...project.stories].filter(item => inScope(item, goalId) && (!onlyId || item.id === onlyId));
  if (!artifacts.length) return 0;
  const evidence = new Set(["PROJECT-BRIEF", ...project.sources.filter(s => s.approved && s.status !== 'Excluded').map(s => s.id), ...project.clarifications.filter(q => q.status === "Answered" && q.answer?.trim()).map(q => q.id)]);
  const supported = (id: string, seen = new Set<string>()): boolean => {
    if (evidence.has(id)) return true;
    if (seen.has(id)) return false;
    const next = new Set(seen).add(id);
    return project.traceLinks.some(link => {
      return link.to === id && link.status === "Verified" && link.fromRevision === revisionOf(project, link.from) && link.toRevision === revisionOf(project, link.to) && sourcePassageCurrent(project, link) && supported(link.from, next);
    });
  };
  return artifacts.filter(a => supported(a.id)).length;
};
export const traceCoverage = (project: Project) => {
  const total = project.requirements.length + project.stories.length;
  return total ? Math.round(100 * supportedArtifactCount(project) / total) : 0;
};

export const safeEvaluationExport = (state: WorkspaceState) =>
  state.evaluationRuns.map((run) => ({
    run_id: run.id,
    case_id: run.caseId,
    condition: run.condition,
    evaluator_code: run.evaluatorCode,
    dataset_version: run.datasetVersion,
    prototype_version: run.prototypeVersion,
    model: run.model,
    prompt_version: run.promptVersion,
    duration: run.duration,
    status: run.status,
  }));

export const governanceCanDisable = (check: { immutable?: boolean }) =>
  !check.immutable;

/** Record only the rationale actually supplied by the analyst. */
export function recordGovernanceDisposition(project: Project, id: string, status: "Passed" | "Not applicable", rationale: string) {
  const check = project.checks.find(item => item.id === id);
  if (!check) throw new Error("The governance check no longer exists.");
  if (!rationale.trim()) throw new Error("Enter a rationale before recording this decision.");
  if (status === "Not applicable" && !governanceCanDisable(check)) throw new Error("This core safeguard cannot be marked not applicable.");
  check.status = status;
  check.resolution = rationale.trim();
  addAudit(project, status === "Passed" ? "Resolved governance check" : "Marked check not applicable", id, check.resolution);
}
export const impactedIds = (project: Project, changeId: string) =>
  project.changes
    .find((change) => change.id === changeId)
    ?.impacts.map((impact) => impact.id) ?? [];

export const transitionClarification = (
  item: Clarification,
  status: Clarification["status"],
  answer?: string,
): Clarification => ({
  ...item,
  status,
  answer: status === "Answered" ? (answer ?? item.answer) : item.answer,
});

export const restoreVersionAsDraft = (
  version: VersionSnapshot,
  index: number,
): VersionSnapshot => ({
  ...version,
  id: `RESTORE-${index}`,
  label: `Restored from ${version.version}`,
  version: `draft-${index}`,
  at: "Just now",
  type: "Snapshot",
  locked: false,
});

type GovernedArtifact = Project["requirements"][number] | Project["stories"][number] | Project["diagrams"][number] | Project["documents"][number];

const scopeId = (project: Project, goalId?: string) => goalId ?? project.activeGoalId;
const inScope = (item: { goalId?: string }, goalId?: string) => !goalId || !item.goalId || item.goalId === goalId;
const governedArtifacts = (project: Project, goalId = scopeId(project)) => [
  ...project.requirements.filter(item => inScope(item, goalId)),
  ...project.stories.filter(item => inScope(item, goalId)),
  ...project.diagrams.filter(item => inScope(item, goalId)),
  ...project.documents.filter(item => inScope(item, goalId)),
];

export function artifactTypeOf(project: Project, id: string): ArtifactType {
  if (id === "PROJECT-BRIEF") return "Source";
  if (project.sources.some(item => item.id === id)) return "Source";
  if (project.clarifications.some(item => item.id === id)) return "Clarification";
  if (project.requirements.some(item => item.id === id)) return "Requirement";
  if (project.stories.some(item => item.id === id)) return "User story";
  if (project.diagrams.some(item => item.id === id)) return "Diagram";
  if (project.documents.some(item => item.id === id)) return "Document";
  if (project.changes.some(item => item.id === id)) return "Change request";
  if (project.checks.some(item => item.id === id)) return "Governance check";
  return "Register item";
}

export function revisionOf(project: Project, id: string): number {
  if (id === "PROJECT-BRIEF") return project.briefVersion ?? 1;
  const item = [
    ...project.sources,
    ...project.clarifications,
    ...project.requirements,
    ...project.stories,
    ...project.registers,
    ...project.checks,
    ...project.diagrams,
    ...project.documents,
  ].find((candidate) => candidate.id === id) as { version?: number } | undefined;
  return item?.version ?? 1;
}

export const sourcePassagePins = (link: TraceLink) => [...(link.sourcePassage ? [link.sourcePassage] : []), ...(link.sourcePassages ?? [])];
export function sourcePassageCurrent(project: Project, link: TraceLink): boolean {
  return sourcePassagePins(link).every(pin => {
    const source = project.sources.find(item => item.id === pin.sourceId);
    return !!source && (link.from === source.id || link.to === source.id) && revisionOf(project, source.id) === pin.sourceRevision && (source.passages ?? []).filter(item => item.locator === pin.locator).length === 1;
  });
}

const artifactExists = (project: Project, id: string) => id === "PROJECT-BRIEF" || id === "PROJECT-GOVERNANCE" || [
  ...project.sources, ...project.clarifications, ...project.requirements,
  ...project.stories, ...project.registers, ...project.checks,
  ...project.diagrams, ...project.documents, ...project.changes, ...project.goals,
].some(item => item.id === id);

export const revisionManifest = (project: Project, goalId = scopeId(project)): ArtifactRevisionReference[] =>
  governedArtifacts(project, goalId).map((item) => ({
    id: item.id,
    type: artifactTypeOf(project, item.id),
    revision: revisionOf(project, item.id),
  }));

const staleDiagramEmbed = (document: Project["documents"][number], project: Project) =>
  document.sections.some(section => section.blocks.some(block =>
    !!block.embedding && (block.embedding.stale || revisionOf(project, block.embedding.diagramId) !== block.embedding.version),
  ));

export const approvalIssuesForArtifact = (project: Project, id: string, goalId = scopeId(project)): string[] => {
  const artifact = governedArtifacts(project, goalId).find(item => item.id === id);
  if (!artifact) return ["The artifact is outside the active approval scope."];
  const issues: string[] = [];
  if (!canApprove(project)) issues.push("An active member with approval authority is required.");
  if (blockers(project, goalId)) issues.push("Resolve blocking clarifications and governance findings in this scope.");
  if (project.requirements.some(item => item.id === id) || project.stories.some(item => item.id === id)) {
    if (!supportedArtifactCount(project, goalId, id)) issues.push("Verify a current evidence path before approval.");
  }
  const requirement = project.requirements.find(item => item.id === id);
  if (requirement && !requirement.fitCriteria.some(criterion => criterion.trim())) issues.push("Add at least one testable acceptance criterion before approval.");
  const story = project.stories.find(item => item.id === id);
  if (story && !story.criteria.some(criterion => criterion.trim())) issues.push("Add at least one testable acceptance criterion before approval.");
  if (project.diagrams.some(item => item.id === id)) {
    const diagram = artifact as Project["diagrams"][number];
    if (!diagram.linkedIds.length) issues.push("Link the diagram to reviewed BA artifacts before approval.");
    if (diagram.linkedIds.some(linked => !artifactExists(project, linked))) issues.push("Resolve missing diagram references before approval.");
  }
  if (project.documents.some(item => item.id === id) && staleDiagramEmbed(artifact as Project["documents"][number], project)) {
    issues.push("Refresh or remove stale embedded diagrams before approval.");
  }
  if (project.traceLinks.some(link => (link.from === id || link.to === id) && link.status === "Verified" &&
    (link.fromRevision !== revisionOf(project, link.from) || link.toRevision !== revisionOf(project, link.to) || !sourcePassageCurrent(project, link)))) {
    issues.push("Reverify trace links against the current artifact revisions before approval.");
  }
  if (project.traceLinks.some(link => (link.from === id || link.to === id) && (!artifactExists(project, link.from) || !artifactExists(project, link.to)))) {
    issues.push("Resolve trace links with missing records before approval.");
  }
  if (project.traceLinks.some(link => (link.from === id || link.to === id) && link.status === "Pending")) {
    issues.push("Resolve pending trace links before approval.");
  }
  if (project.traceLinks.some(link => (link.from === id || link.to === id) && link.status === "Broken")) {
    issues.push("Resolve broken trace links before approval.");
  }
  return issues;
};

export const baselineIssues = (project: Project, goalId = scopeId(project)): string[] => {
  const issues: string[] = [];
  const goal = project.goals.find(item => item.id === goalId);
  if (goal) {
    const stale = staleGoalSourceIds(project, goal);
    if (stale.length) issues.push(`Review and reselect current source revisions for this goal: ${stale.join(', ')}.`);
  }
  if (!canApprove(project)) issues.push('An active member with approval authority is required.');
  if (blockers(project, goalId)) issues.push('Resolve blocking clarifications and governance findings.');
  const artifacts = [...project.requirements.filter(item => inScope(item, goalId)), ...project.stories.filter(item => inScope(item, goalId))];
  const diagrams = project.diagrams.filter(item => inScope(item, goalId));
  const documents = project.documents.filter(item => inScope(item, goalId));
  if (!artifacts.length) issues.push('Add requirements or user stories before creating a baseline.');
  if ([...artifacts, ...documents].some(a => !['in-review', 'approved'].includes(a.status))) issues.push('Submit every requirement, user story and document for review.');
  if (diagrams.some(diagram => !['In review', 'Approved', 'Current'].includes(diagram.status) || diagram.approvalStatus === 'Draft')) issues.push('Submit every required diagram for review.');
  if (documents.some(document => staleDiagramEmbed(document, project))) issues.push('Refresh or remove stale embedded diagrams before approval.');
  if (artifacts.length && supportedArtifactCount(project, goalId) !== artifacts.length) issues.push('Verify an evidence path for every requirement and user story.');
  for (const artifact of governedArtifacts(project, goalId)) {
    const approvalIssues = approvalIssuesForArtifact(project, artifact.id, goalId);
    for (const issue of approvalIssues) {
      const normalized = issue.includes('current artifact revisions') ? 'Reverify trace links against current artifact revisions.'
        : issue.includes('pending trace links') ? 'Resolve pending trace links before approval.'
        : issue.includes('acceptance criterion') ? 'Add testable acceptance criteria before approval.'
        : issue;
      if (!issues.includes(normalized)) issues.push(normalized);
    }
  }
  return issues;
};
export const approvalAllowed = (project: Project, goalId = scopeId(project)) => baselineIssues(project, goalId).length === 0;
export const eligibleForDocumentSync = (project: Project, ids: string[]) =>
  [...project.requirements, ...project.stories].filter(
    (item) => ids.includes(item.id) && item.status === "approved",
  );
export const diagramEmbeddingNeedsRefresh = (
  project: Project,
  diagramId: string,
  insertedVersion: number,
) => {
  const current = project.diagrams.find((diagram) => diagram.id === diagramId);
  return current ? current.version > insertedVersion : false;
};

export const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function enforceWorkingVersions(before: Project, after: Project) {
  const changed = new Set<string>();
  if (before.description !== after.description) {
    changed.add("PROJECT-BRIEF");
    after.briefVersion = (before.briefVersion ?? 1) + 1;
  }
  if (JSON.stringify(before.governancePacks) !== JSON.stringify(after.governancePacks)) {
    // A new policy can change the eligibility of every working deliverable.
    // Keep historical baselines, but require a fresh human impact review.
    for (const item of [...after.requirements, ...after.stories, ...after.diagrams, ...after.documents, ...after.checks]) changed.add(item.id);
  }
  for (const goal of after.goals) {
    const previous = before.goals.find(item => item.id === goal.id);
    if (!previous || previous.description === goal.description && JSON.stringify(previous.sourceIds) === JSON.stringify(goal.sourceIds) &&
        JSON.stringify(previous.sourceRevisionPins ?? {}) === JSON.stringify(goal.sourceRevisionPins ?? {})) continue;
    for (const item of [...after.requirements, ...after.stories, ...after.clarifications, ...after.checks, ...after.diagrams, ...after.documents])
      if (item.goalId === goal.id || !item.goalId && after.activeGoalId === goal.id) changed.add(item.id);
  }
  const content = (value: unknown) => JSON.stringify(value, (key, item) =>
    ["status", "approvalStatus", "version", "comments", "syncStatus", "versions", "receipts"].includes(key) ? undefined : item,
  );
  const collections = ["sources", "clarifications", "requirements", "stories", "registers", "checks", "diagrams", "documents"] as const;
  for (const key of collections) {
    const oldItems = before[key] as { id: string }[];
    const newItems = after[key] as { id: string; version?: number }[];
    const oldById = new Map(oldItems.map(item => [item.id, item]));
    const newById = new Map(newItems.map(item => [item.id, item]));
    for (const id of new Set([...oldById.keys(), ...newById.keys()])) {
      const oldItem = oldById.get(id), newItem = newById.get(id);
      // A check's resolution is a review decision, not an edit to the check
      // itself. The decision is preserved in the audit log; editing the check
      // or its dependencies still invalidates a previous Passed status.
      const comparable = (item: { id: string } | undefined) => item && (key === "checks" || key === "sources")
        ? content(Object.fromEntries(Object.entries(item).filter(([field]) => key === "checks" ? field !== "resolution" : !["analysisSignature", "originalBase64"].includes(field))))
        : content(item);
      const oldSource = key === "sources" ? oldItem as Project["sources"][number] | undefined : undefined;
      const newSource = key === "sources" ? newItem as Project["sources"][number] | undefined : undefined;
      const embeddedBytesChanged = !!oldSource?.originalBase64 && (
        newSource?.originalBase64 ? oldSource.originalBase64 !== newSource.originalBase64
          : !(after.workspaceId && (after.workspaceKind === "managed" || after.workspaceKind === "selected") && newSource?.relativePath)
      );
      if (!oldItem || !newItem || embeddedBytesChanged || comparable(oldItem) !== comparable(newItem)) {
        changed.add(id);
        if (oldItem && newItem && "version" in newItem && (newItem.version ?? 1) <= revisionOf(before, id)) newItem.version = revisionOf(before, id) + 1;
      }
    }
  }
  const beforeLinks = new Map(before.traceLinks.map(link => [link.id, link]));
  const afterLinks = new Map(after.traceLinks.map(link => [link.id, link]));
  for (const id of new Set([...beforeLinks.keys(), ...afterLinks.keys()])) {
    const oldLink = beforeLinks.get(id), newLink = afterLinks.get(id);
    // Editing a relationship affects its destination, not the source content.
    // Verification stamps and status are review decisions, not relationship edits.
    if (!oldLink || !newLink || oldLink.from !== newLink.from || oldLink.to !== newLink.to || oldLink.relation !== newLink.relation || JSON.stringify(sourcePassagePins(oldLink)) !== JSON.stringify(sourcePassagePins(newLink))) {
      if (oldLink) changed.add(oldLink.to);
      if (newLink) changed.add(newLink.to);
    }
  }
  // Detect all direct edits first, then propagate them across declared
  // relationships. This avoids the old order-dependent approval bypass.
  let previousSize = -1;
  while (previousSize !== changed.size) {
    previousSize = changed.size;
    for (const link of [...before.traceLinks, ...after.traceLinks]) if (changed.has(link.from)) changed.add(link.to);
    for (const answer of after.clarifications) if (changed.has(answer.id)) answer.affects.forEach(id => changed.add(id));
    for (const item of [...after.requirements, ...after.stories]) {
      const references = "sourceIds" in item ? item.sourceIds : [];
      const related = "storyIds" in item ? item.storyIds : item.requirementIds;
      if ([...references, ...related, ...item.dependencies].some(id => changed.has(id))) changed.add(item.id);
    }
    for (const diagram of after.diagrams) if (diagram.linkedIds.some(id => changed.has(id))) changed.add(diagram.id);
    for (const document of after.documents) if (document.sections.some(section =>
      section.linkedIds.some(id => changed.has(id)) || section.blocks.some(block =>
        block.linkedIds.some(id => changed.has(id)) || !!block.embedding && changed.has(block.embedding.diagramId),
      ),
    )) changed.add(document.id);
  }
  after.traceLinks.filter(link => changed.has(link.from) || changed.has(link.to)).forEach(link => { link.status = "Pending"; });
  for (const item of [...after.requirements, ...after.stories, ...after.documents]) {
    if (changed.has(item.id) && item.status !== "draft") item.status = "draft";
  }
  for (const item of [...after.requirements, ...after.stories]) {
    if (changed.has(item.id) && item.syncStatus === "Synced") item.syncStatus = "Out of sync";
  }
  for (const diagram of after.diagrams) if (changed.has(diagram.id)) { diagram.status = "Draft"; diagram.approvalStatus = "Draft"; }
  for (const check of after.checks) if (changed.has(check.id) && check.status === "Passed") check.status = "Warning";
  // Old snapshot payloads are immutable even when a UI edit changes working records.
  for (const snapshot of before.versions.filter(v => v.locked)) {
    const index = after.versions.findIndex(v => v.id === snapshot.id);
    if (index >= 0) after.versions[index] = clone(snapshot);
    else after.versions.push(clone(snapshot));
  }
}
export function captureSnapshot(project: Project): Record<string, unknown> {
  const { versions, aiRuns, ...content } = project;
  return clone(content) as unknown as Record<string, unknown>;
}

export function restoreSnapshot(project: Project, version: VersionSnapshot) {
  if (!version.snapshot) throw new Error('This older milestone contains no saved content and cannot be restored.');
  const current = captureSnapshot(project);
  const { id, cloudAllowed, versions, audit, aiRuns } = project;
  Object.assign(project, clone(version.snapshot), { id, cloudAllowed, versions, audit, aiRuns });
  for (const item of [...project.requirements, ...project.stories, ...project.documents]) item.status = 'draft';
  for (const diagram of project.diagrams) { diagram.status = 'Draft'; diagram.approvalStatus = 'Draft'; }
  project.traceLinks.forEach(l => { l.status = 'Pending'; });
  project.gate = 'Validate'; project.gateIndex = 4;
  const goal = project.goals.find(g => g.id === project.activeGoalId);
  if (goal) { goal.gate = 'Validate'; goal.gateIndex = 4; }
  project.versions.unshift({ id: `VER-${crypto.randomUUID()}`, label: 'Before restoring a milestone', version: `recovery-${project.versions.length + 1}`, at: new Date().toISOString(), actor: 'Business analyst', type: 'Snapshot', locked: false, changes: `Working copy preserved before restoring ${version.version}`, snapshot: current });
  addAudit(project, 'Restored saved content as working drafts', version.id, 'Previous working content saved in a recovery snapshot. Evidence links require revalidation.');
}
