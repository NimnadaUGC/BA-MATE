import type { Project, ProjectGoal, Source } from "./types";
import { addAudit, enforceWorkingVersions } from "./store";
import { sourceTypeForName, type WorkspaceAnalysis } from "./workspaceFiles";
import { api } from "./api";

export function goalSelectableSource(source: Source): boolean {
  return source.approved && source.status === "Analyzed" && Boolean(source.sha256 && source.relativePath);
}

export function goalSourceCurrent(goal: ProjectGoal, source: Source): boolean {
  return goal.sourceIds.includes(source.id) && goalSelectableSource(source) &&
    goal.sourceRevisionPins?.[source.id] === source.sha256;
}

export function requestProjectAgentRun(project: Project, analysis: WorkspaceAnalysis, retry = false) {
  const goal = project.goals.find(item => item.id === project.activeGoalId && item.status === "Active");
  const decisions = project.clarifications.filter(question => question.status === "Answered" && question.answer);
  const approved = goal ? project.sources.filter(source => goalSourceCurrent(goal, source)) : [];
  const browserSources = project.workspaceKind === "browser" ? Object.values(analysis.sources) : [];
  return api<NonNullable<Project["agentRun"]>>("/api/project-agents", {
    method: "POST",
    body: JSON.stringify({ project_id: project.id, workspace_id: project.workspaceId,
      brief: project.description, governance: project.governancePacks, retry,
      active_goal: goal ? { title: goal.title, kind: goal.kind, description: goal.description, gate: goal.gate } : {},
      confirmed_decisions: decisions.slice(-20).map(question => ({ question: question.question, answer: question.answer, owner: question.owner })),
      omitted_confirmed_decisions: Math.max(0, decisions.length - 20),
      approved_sources: approved.slice(0, 100).map(source => ({ path: source.relativePath ?? source.name, sha256: source.sha256 })),
      omitted_approved_source_selections: Math.max(0, approved.length - 100),
      browser_workspace: project.workspaceKind === "browser",
      browser_sources: browserSources.slice(0, 20).map(source => ({ ...source,
        available_characters: source.content?.length ?? 0, content: source.content?.slice(0, 5000) })),
      omitted_browser_sources: Math.max(0, browserSources.length - 20),
    }),
  });
}

/** Surface one unanswered background question in the active conversation for BA adoption. */
export function surfaceBackgroundQuestion(project: Project, run: NonNullable<Project["agentRun"]>): boolean {
  if (run.status !== "ready" || !run.signature) return false;
  const goal = project.goals.find(item => item.id === project.activeGoalId && item.status === "Active");
  const conversation = project.conversations.find(item => item.id === goal?.conversationId);
  if (!conversation) return false;
  const suggestions = [
    ...((run.roles.requirement_drafting?.proposal?.open_questions as string[] | undefined) ?? []),
    ...((run.roles.planning?.proposal?.clarification_questions as string[] | undefined) ?? []),
    ...((run.roles.source_intake?.proposal?.review_questions as string[] | undefined) ?? []),
  ];
  const question = suggestions.find(value => typeof value === "string" && value.trim() &&
    !project.clarifications.some(existing => existing.question === value) &&
    !conversation.messages.some(message => message.proposal?.kind === "clarification-question" && message.proposal.after === value) &&
    !(project.dismissedAgentSuggestions ?? []).includes(`${run.signature}:question:${value}`));
  if (!question) return false;
  const key = `${run.signature}:question:${question}`;
  conversation.messages.push({ id: `MSG-${crypto.randomUUID()}`, role: "assistant", backgroundSuggestionKey: key,
    text: "BA Mate found a question in the current project context. Review it before tracking it for a responsible person to answer.",
    proposal: { id: `PROP-${crypto.randomUUID()}`, kind: "clarification-question", target: goal!.id, before: "",
      after: question, status: "pending", references: [],
      impact: ["A person must confirm the answer before it becomes a project decision."] } });
  conversation.updated = "Just now";
  addAudit(project, "BA Mate proposed clarification in chat", key, question);
  return true;
}

/** Merge discovered folder revisions without promoting extraction to approved evidence. */
export function mergeProjectAnalysis(project: Project, analysis: WorkspaceAnalysis): boolean {
  const before = structuredClone(project);
  let changed = project.sourceAnalysisStatus !== analysis.status;
  project.sourceAnalysisStatus = analysis.status;
  if (analysis.status === "ready" && analysis.folders && JSON.stringify(project.workspaceFolders ?? []) !== JSON.stringify(analysis.folders)) {
    project.workspaceFolders = analysis.folders;
    changed = true;
  }
  const present = new Set(Object.keys(analysis.sources));
  for (const candidate of Object.values(analysis.sources)) {
    const existing = project.sources.find(source => source.relativePath === candidate.relative_path)
      ?? project.sources.find(source => !source.analysisSignature && source.name === candidate.name && source.sha256 === candidate.sha256);
    if (existing && existing.analysisSignature === candidate.signature && existing.sha256 === candidate.sha256) continue;
    const limitations = candidate.status === "needs_review" ? candidate.limitations : [candidate.error ?? "This file could not be extracted. Review the original before using it as evidence."];
    if (existing) {
      const firstExtraction = !existing.analysisSignature && !existing.sha256 && !existing.content;
      const sameContent = Boolean(candidate.sha256) && existing.sha256 === candidate.sha256;
      existing.relativePath = candidate.relative_path;
      existing.analysisSignature = candidate.signature;
      if (sameContent) { changed = true; continue; }
      existing.content = candidate.content;
      existing.passages = candidate.passages;
      existing.sha256 = candidate.sha256;
      existing.originalBase64 = undefined;
      existing.extractionLimitations = limitations;
      existing.status = "Needs review";
      existing.approved = false;
      existing.version = firstExtraction ? (existing.version ?? 1) : (existing.version ?? 1) + 1;
      addAudit(project, firstExtraction ? "Source analyzed for review" : "Source changed; review required", existing.id, candidate.relative_path);
      changed = true;
    } else {
      const id = `SRC-${crypto.randomUUID()}`;
      project.sources.push({ id, name: candidate.name ?? candidate.relative_path.split("/").at(-1)!,
        relativePath: candidate.relative_path, analysisSignature: candidate.signature,
        type: sourceTypeForName(candidate.name ?? candidate.relative_path), status: "Needs review",
        classification: "Project only", provenance: `Discovered in project folder: ${candidate.relative_path}`,
        concepts: [], content: candidate.content, passages: candidate.passages, sha256: candidate.sha256,
        extractionLimitations: limitations, approved: false, immutable: true, version: 1 });
      addAudit(project, "Discovered source for review", id, candidate.relative_path);
      changed = true;
    }
  }
  if (analysis.status === "ready") for (const source of project.sources) {
    if (!source.analysisSignature || !source.relativePath || present.has(source.relativePath) || source.status === "Excluded") continue;
    source.status = "Excluded";
    source.approved = false;
    source.originalBase64 = undefined;
    source.version = (source.version ?? 1) + 1;
    source.extractionLimitations = ["The original file is no longer in the project folder. Review the impact before using this source again."];
    addAudit(project, "Source removed from folder", source.id, source.relativePath);
    changed = true;
  }
  if (changed) enforceWorkingVersions(before, project);
  return changed;
}
