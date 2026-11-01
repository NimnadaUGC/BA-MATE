import type { Project, ProjectGoal, Source } from './types';

/** A goal uses only the exact source revision a person selected for it. */
export function goalSelectableSource(source: Source): boolean {
  return source.approved && source.status === 'Analyzed' && Boolean(source.sha256 && source.relativePath);
}
export function goalSourceCurrent(goal: ProjectGoal, source: Source): boolean {
  return goal.sourceIds.includes(source.id) && goalSelectableSource(source) && goal.sourceRevisionPins?.[source.id] === source.sha256;
}
export function staleGoalSourceIds(project: Project, goal: ProjectGoal): string[] {
  return goal.sourceIds.filter(id => !project.sources.some(source => source.id === id && goalSourceCurrent(goal, source)));
}
export function modelSourceProblems(project: Project, references: { id: string; type: string }[] = []): string[] {
  const goal = project.goals.find(item => item.id === project.activeGoalId);
  const stale = goal ? staleGoalSourceIds(project, goal) : [];
  const unavailableReferences = references.filter(ref => ref.type === 'Source' && ref.id !== 'PROJECT-BRIEF' &&
    !project.sources.some(source => source.id === ref.id && goal && goalSourceCurrent(goal, source))).map(ref => ref.id);
  return [...new Set([...stale, ...unavailableReferences])];
}

/** Identify the selected originals and location checked before an asynchronous operation. */
export function sourceCheckFingerprint(project: Project): string {
  const goal = project.goals.find(item => item.id === project.activeGoalId);
  const ids = new Set(goal?.sourceIds ?? []);
  return JSON.stringify({ workspaceId: project.workspaceId, workspaceKind: project.workspaceKind,
    workspacePath: project.workspacePath, folderName: project.folderName, goalId: project.activeGoalId,
    sourceIds: goal?.sourceIds, pins: goal?.sourceRevisionPins,
    sources: project.sources.filter(source => ids.has(source.id)).map(source => ({ id: source.id, sha256: source.sha256,
      version: source.version, approved: source.approved, status: source.status, relativePath: source.relativePath,
      classification: source.classification, originalBase64: source.originalBase64 })) });
}
