import type { Project, Requirement, UserStory } from './types';
import { addAudit, revisionOf } from './store';
import { projectEvidence } from './modelGateway';
export type TaskKind = 'clarify' | 'requirements' | 'validate' | 'diagram' | 'document' | 'impact';
export interface Proposal {
  summary: string;
  questions: { question: string; rationale: string; source_ids: string[]; priority: 'Blocking' | 'Important' | 'Optional' }[];
  requirements: { title: string; statement: string; kind: 'Functional' | 'Non-functional'; rationale: string; acceptance_criteria: string[]; source_ids: string[]; assumptions: string[] }[];
  stories: { role: string; goal: string; value: string; acceptance_criteria: string[]; source_ids: string[] }[];
  findings: { title: string; category: string; severity: 'Warning' | 'Blocking'; explanation: string; source_ids: string[] }[];
  diagrams: { name: string; source: string; source_ids: string[] }[];
  sections: { title: string; content: string; source_ids: string[] }[];
  limitations: string[];
}
export interface RunMetadata {
  request_id: string; provider: string; model: string; serving_provider?: string; framework_version: string; prompt_version: string;
  condition: string; task: string; elapsed_ms: number; usage: { input_tokens: number | null; output_tokens: number | null; cost: number | null };
  temperature: number; context_tokens: number; output_tokens: number; retries: number; context_hash: string;
}
export interface SavedRun {
  id: string; at: string; goalId?: string; evaluationRunId?: string; status: 'pending' | 'accepted' | 'rejected' | 'failed' | 'cancelled'; fingerprint: string;
  proposal: Proposal; reviewedProposal?: Proposal; reviewedAt?: string; validationError?: string; metadata: RunMetadata; selected?: string[];
  receipt: { included_reference_ids: string[]; omitted_reference_ids: string[]; partial_reference_ids: string[]; context_hash: string };
  failure?: { category: 'cancelled' | 'timeout' | 'unavailable' | 'credentials' | 'quota' | 'schema' | 'stale' | 'unknown'; message: string; at: string };
}
export const evidenceFingerprint = (p: Project) => JSON.stringify(projectEvidence(p));
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
export function applyProposal(project: Project, runId: string, selected: string[], edited: Proposal) {
  const run = project.aiRuns?.find(r => r.id === runId);
  if (!run || run.status !== 'pending') throw new Error('This proposal has already been reviewed.');
  if (run.goalId !== project.activeGoalId || run.fingerprint !== evidenceFingerprint(project)) throw new Error('The project evidence or working artifacts changed after this proposal was generated. Generate a fresh proposal before applying it.');
  if (!selected.length) throw new Error('Select at least one item to add to the working draft.');
  const allowed = new Set(run.receipt.included_reference_ids);
  const selectedItem = (group: string, index: number, sources: string[]) => {
    if (!selected.includes(`${group}:${index}`)) return false;
    if (sources.some(id => !allowed.has(id))) throw new Error('A proposal references unavailable evidence.');
    return true;
  };
  const trace = (target: string, sources: string[]) => sources.forEach(from => project.traceLinks.push({ id: uid('TR'), from, to: target, fromRevision: revisionOf(project, from), toRevision: revisionOf(project, target), relation: 'Proposed evidence support — verify meaning', status: 'Pending', goalId: project.activeGoalId }));
  edited.questions.forEach((q, i) => {
    if (!selectedItem('questions', i, q.source_ids)) return;
    project.clarifications.push({ id: uid('CQ'), priority: q.priority, question: q.question, rationale: q.rationale, sourceId: q.source_ids[0] ?? 'PROJECT-BRIEF', owner: 'Business analyst', status: 'Unanswered', suggestions: [], affects: [], version: 1, goalId: project.activeGoalId });
  });
  edited.requirements.forEach((r, i) => {
    if (!selectedItem('requirements', i, r.source_ids)) return;
    const id = uid(r.kind === 'Functional' ? 'FR' : 'NFR');
    const requirement: Requirement = { id, kind: r.kind, title: r.title, statement: r.statement, rationale: r.rationale, priority: 'Should', status: 'draft', owner: 'Business analyst', sourceIds: r.source_ids, storyIds: [], checkIds: [], version: 1, businessValue: '', businessRules: [], fitCriteria: r.acceptance_criteria, dependencies: [], stakeholders: [], openQuestions: r.assumptions, comments: [], syncStatus: 'Not included', goalId: project.activeGoalId };
    project.requirements.push(requirement); trace(id, r.source_ids);
    r.assumptions.forEach(title => project.registers.push({ id: uid('ASM'), type: 'Assumption', title, owner: 'Business analyst', status: 'open', severity: 'Medium', version: 1, goalId: project.activeGoalId }));
  });
  edited.stories.forEach((s, i) => {
    if (!selectedItem('stories', i, s.source_ids)) return;
    const id = uid('US');
    const story: UserStory = { id, role: s.role, goal: s.goal, value: s.value, criteria: s.acceptance_criteria, priority: 'Should', status: 'draft', requirementIds: [], version: 1, epic: '', feature: s.goal, owner: 'Business analyst', dependencies: [], sourceIds: s.source_ids, comments: [], syncStatus: 'Not included', goalId: project.activeGoalId };
    project.stories.push(story); trace(id, s.source_ids);
  });
  edited.findings.forEach((f, i) => {
    if (!selectedItem('findings', i, f.source_ids)) return;
    project.checks.push({ id: uid('CHK'), category: f.category, title: f.title, status: f.severity, source: `AI suggestion ${run.metadata.model}`, rationale: f.explanation, owner: 'Business analyst', version: 1, goalId: project.activeGoalId });
  });
  edited.diagrams.forEach((d, i) => {
    if (!selectedItem('diagrams', i, d.source_ids)) return;
    const id = uid('DGM');
    const type = d.source.trim().startsWith('sequenceDiagram') ? 'Sequence' : d.source.trim().startsWith('erDiagram') ? 'Entity relationship' : d.source.trim().startsWith('stateDiagram') ? 'State' : d.source.trim().startsWith('journey') ? 'User journey' : 'Flowchart';
    project.diagrams.push({ id, name: d.name, source: d.source, type, linkedIds: d.source_ids, version: 1, status: 'Draft', approvalStatus: 'Draft', comments: [], versions: [{ version: 1, source: d.source, at: new Date().toISOString(), actor: 'Business analyst', note: 'Reviewed AI proposal accepted as a draft' }], goalId: project.activeGoalId }); trace(id, d.source_ids);
  });
  const sections = edited.sections.filter((s, i) => selectedItem('sections', i, s.source_ids));
  if (sections.length) project.documents.push({ id: uid('DOC'), name: 'Reviewed requirements draft', template: 'Software Requirements Specification', status: 'draft', version: 1, receipts: [], comments: [], goalId: project.activeGoalId, sections: sections.map(s => ({ id: uid('SEC'), title: s.title, content: s.content, linkedIds: s.source_ids, comments: [], blocks: [{ id: uid('BLK'), type: 'paragraph', content: s.content, linkedIds: s.source_ids }] })) });
  run.reviewedProposal = structuredClone(edited); run.reviewedAt = new Date().toISOString(); run.status = 'accepted'; run.selected = selected;
  const goal = project.goals.find(g => g.id === project.activeGoalId);
  if (goal) goal.deliverables = [...new Set([...goal.deliverables, ...project.requirements.filter(r => r.goalId === goal.id).map(r => r.id), ...project.stories.filter(r => r.goalId === goal.id).map(r => r.id), ...project.diagrams.filter(r => r.goalId === goal.id).map(r => r.id), ...project.documents.filter(r => r.goalId === goal.id).map(r => r.id)])];
  addAudit(project, 'Accepted AI proposal as working drafts', run.id, `${selected.length} items reviewed. Evidence links require verification; final approval is separate.`);
}
