import type { Project } from './types';
import { baselineManifestWithChanges } from './controlledChanges';
import { verifyGoalSourceOriginals, verifySourceOriginal } from './workspaceFiles';

/** Check the active goal and every goal owning an artifact in the baseline. */
export async function verifyBaselineSources(project: Project, activeGoalId: string): Promise<void> {
  const included = new Set(baselineManifestWithChanges(project, activeGoalId).map(item => item.id));
  const artifactGoals = [...project.requirements, ...project.stories, ...project.diagrams, ...project.documents]
    .filter(item => included.has(item.id) && item.goalId).map(item => item.goalId!);
  for (const goalId of new Set([activeGoalId, ...artifactGoals])) {
    if (!project.goals.some(goal => goal.id === goalId)) throw new Error(`The goal ${goalId} is unavailable; review the baseline scope.`);
    await verifyGoalSourceOriginals({ ...project, activeGoalId: goalId });
  }
  // A manually verified evidence link or document reference may cite a source
  // outside the owning goal's AI selection. Its original must still be current.
  const referenced = new Set<string>();
  const evidenceIds = new Set<string>();
  for (const item of [...project.requirements, ...project.stories]) {
    if (included.has(item.id)) item.sourceIds.forEach(id => { referenced.add(id); evidenceIds.add(id); });
  }
  for (const diagram of project.diagrams) if (included.has(diagram.id)) diagram.linkedIds.forEach(id => referenced.add(id));
  for (const document of project.documents) if (included.has(document.id)) for (const section of document.sections) {
    section.linkedIds.forEach(id => referenced.add(id));
    section.blocks.forEach(block => block.linkedIds.forEach(id => referenced.add(id)));
  }
  const visited = new Set<string>();
  const followEvidence = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const link of project.traceLinks) if (link.to === id && link.status === 'Verified') {
      referenced.add(link.from);
      evidenceIds.add(link.from);
      followEvidence(link.from);
    }
  };
  included.forEach(followEvidence);
  const known = new Set(['PROJECT-BRIEF', 'PROJECT-GOVERNANCE', ...project.goals.map(item => item.id),
    ...project.sources.map(item => item.id), ...project.clarifications.map(item => item.id), ...project.registers.map(item => item.id),
    ...project.checks.map(item => item.id), ...project.changes.map(item => item.id), ...project.requirements.map(item => item.id),
    ...project.stories.map(item => item.id), ...project.diagrams.map(item => item.id), ...project.documents.map(item => item.id)]);
  const missing = [...evidenceIds].filter(id => !known.has(id));
  if (missing.length) throw new Error(`Evidence records are missing: ${missing.join(', ')}. Review the affected links before approving the baseline.`);
  for (const source of project.sources.filter(item => referenced.has(item.id))) {
    if (!source.approved || source.status !== 'Analyzed') throw new Error(`${source.name}: Review and accept this referenced source before approving the baseline.`);
    try { await verifySourceOriginal(project, source); }
    catch (error) { throw new Error(`${source.name}: ${error instanceof Error ? error.message : 'The original could not be checked.'}`); }
  }
}
