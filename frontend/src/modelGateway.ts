import { storyNarrative } from "./storyNarrative";
import type { ArtifactProposal, ArtifactReference, ModelContextReceipt, Project } from './types';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { revisionOf } from './store';
import { api } from './api';
import { goalSourceCurrent } from './sourceScope';

export interface ModelContextItem {
  id: string; type: string; version?: number; provenance: string; content: string;
  priority: number; estimatedTokens: number; confidential?: boolean;
}
export interface ModelRequest {
  requestId: string; task: 'project-conversation' | 'assistant-inspection' | 'conversation-action'; prompt: string;
  projectId: string; goalId?: string; context: ModelContextItem[]; governance: string[];
  receipt: ModelContextReceipt; history?: { role: 'user' | 'assistant'; content: string }[];
  cloudAllowed?: boolean; signal?: AbortSignal;
}
export interface ModelResponse { text: string; receipt: ModelContextReceipt; provider: string; actionProposal?: {
  action_kind: 'none' | 'requirement-revision' | 'clarification-question' | 'clarification-answer' | 'governance-revision' | 'goal-direction' | 'source-selection';
  target_id: string; before: string; after: string; rationale: string; reference_ids: string[];
} }
const estimateTokens = (text: string) => Math.ceil(text.length / 3);

/** A saved goal conversation keeps its own evidence scope when another goal is active or it is completed. */
export function conversationProjectContext(project: Project, conversationId?: string): Project {
  const goal = conversationId ? project.goals.find(item => item.conversationId === conversationId) : undefined;
  return goal && goal.id !== project.activeGoalId ? { ...project, activeGoalId: goal.id } : project;
}

/** Returns only reviewed, goal-scoped evidence. An empty goal source list means no source is selected. */
export function projectEvidence(project: Project, references: ArtifactReference[] = []): ModelContextItem[] {
  const explicit = new Set(references.map(item => item.id));
  const goal = project.goals.find(item => item.id === project.activeGoalId);
  const activeGoalId = project.activeGoalId;
  const entries: ModelContextItem[] = [];
  const scoped = (item: { goalId?: string }) => !activeGoalId || !item.goalId || item.goalId === activeGoalId;
  const selectedSources = new Set(goal?.sourceIds ?? []);
  const sourceInScope = (id: string) => selectedSources.has(id) || explicit.has(id);
  const sourceText = (source: Project['sources'][number]) => source.passages?.length
    ? source.passages.map(passage => `[${passage.locator}] ${passage.text}`).join('\n\n')
    : source.content ?? '';
  const contextHasConfidentialEvidence = project.sources.some(source =>
    source.classification === 'Confidential' && source.approved && source.status !== 'Excluded' && sourceInScope(source.id),
  );
  const sensitiveIds = new Set(project.sources.filter(source => source.classification === 'Confidential').map(source => source.id));
  const dependencies: [string, string[]][] = [
    ...project.requirements.map(item => [item.id, item.sourceIds] as [string, string[]]),
    ...project.stories.map(item => [item.id, [...item.sourceIds, ...item.requirementIds]] as [string, string[]]),
    ...project.clarifications.map(item => [item.id, item.sourceIds?.length ? item.sourceIds : [item.sourceId]] as [string, string[]]),
    ...project.diagrams.map(item => [item.id, item.linkedIds] as [string, string[]]),
    ...project.documents.map(item => [item.id, item.sections.flatMap(section => [...section.linkedIds, ...section.blocks.flatMap(block => [...block.linkedIds, ...(block.embedding ? [block.embedding.diagramId] : [])])])] as [string, string[]]),
    ...project.changes.map(item => [item.id, [item.source, ...item.impacts.map(impact => impact.id), ...(item.patches ?? []).map(patch => patch.artifactId)]] as [string, string[]]),
    ...project.traceLinks.map(link => [link.to, [link.from]] as [string, string[]]),
  ];
  // Resolve transitive sensitivity before sending derived content to a provider.
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const [id, linked] of dependencies) if (!sensitiveIds.has(id) && linked.some(link => sensitiveIds.has(link))) { sensitiveIds.add(id); expanded = true; }
  }
  const sensitiveArtifact = (sourceIds: string[]) => sourceIds.some(id => sensitiveIds.has(id));
  const add = (id: string, type: string, content: string, version?: number, confidential = false, provenance = id, priority = 50) => {
    if (content.trim()) entries.push({ id, type, content, version, provenance, confidential: confidential || contextHasConfidentialEvidence || sensitiveIds.has(id), priority: explicit.has(id) ? 100 : priority, estimatedTokens: estimateTokens(content) });
  };
  // The brief is BA-authored project context, not a substitute for a selected source.
  add('PROJECT-BRIEF', 'Brief', `${project.description}\nGoal: ${goal?.title ?? 'No active goal'}\n${goal?.description ?? ''}`, revisionOf(project, 'PROJECT-BRIEF'), false, 'BA-authored project brief', 90);
  if (goal) add(goal.id, 'Goal', `${goal.title}\nKind: ${goal.kind}\nDescription: ${goal.description}\nStatus: ${goal.status}`, 1, false, 'Active BA goal', 89);
  add('PROJECT-GOVERNANCE', 'Governance', project.governancePacks.join('\n'), 1, false, 'Project policy list; human review remains required', 88);
  for (const source of project.sources) if (goal && goalSourceCurrent(goal, source)) {
    add(source.id, 'Source', sourceText(source), revisionOf(project, source.id), source.classification === 'Confidential', `${source.name} (reviewed source)`, 70);
  }
  for (const item of project.clarifications) {
    const sourceIds = item.sourceIds?.length ? item.sourceIds : [item.sourceId];
    if (scoped(item) && (item.status === 'Answered' || sourceIds.includes('PROJECT-BRIEF') || sourceIds.some(id => selectedSources.has(id)) || explicit.has(item.id))) {
      add(item.id, 'Clarification', `${item.question}\nStatus: ${item.status}\n${item.status === 'Unanswered' && item.answer ? 'Previous answer — needs reconfirmation' : 'Answer'}: ${item.answer ?? 'Unanswered'}\nAnswer confirmed by: ${item.answerAuthority || 'Not recorded'}\nRecorded context: ${sourceIds.join(', ')}`, revisionOf(project, item.id), sensitiveArtifact(sourceIds), `Clarification linked to ${sourceIds.join(', ')}`, 85);
    }
  }
  for (const item of project.requirements) if (scoped(item) || explicit.has(item.id)) {
    add(item.id, 'Requirement', `${item.title}\n${item.statement}\nAcceptance criteria: ${item.fitCriteria.join('; ')}\nBusiness rules: ${item.businessRules.join('; ')}\nStatus: ${item.status}\nEvidence: ${item.sourceIds.join(', ')}`, item.version, sensitiveArtifact(item.sourceIds), `Requirement ${item.id}`, 65);
  }
  for (const item of project.stories) if (scoped(item) || explicit.has(item.id)) {
    add(item.id, 'User story', `${storyNarrative(item)}\nAcceptance criteria: ${item.criteria.join('; ')}\nEvidence: ${item.sourceIds.join(', ')}`, item.version, sensitiveArtifact(item.sourceIds), `User story ${item.id}`, 60);
  }
  for (const item of project.registers) if (scoped(item)) {
    add(item.id, item.type, `${item.type}: ${item.title}\nStatus: ${item.status}\nOwner: ${item.owner}\nSeverity: ${item.severity ?? 'Not recorded'}`, revisionOf(project, item.id), false, `${item.type} register`, item.type === 'Decision' ? 82 : 55);
  }
  for (const item of project.checks) if (scoped(item)) {
    add(item.id, 'Governance check', `${item.title}\nStatus: ${item.status}\nRationale: ${item.rationale}\nOwner: ${item.owner}`, revisionOf(project, item.id), false, `Governance check ${item.id}`, 75);
  }
  for (const item of project.diagrams) if (explicit.has(item.id)) add(item.id, 'Diagram', item.source, item.version, false, `Diagram ${item.name}`, 45);
  for (const item of project.documents) if (explicit.has(item.id)) add(item.id, 'Document', item.sections.map(section => `${section.title}\n${section.blocks.map(block => block.content).join('\n')}`).join('\n'), item.version, false, `Document ${item.name}`, 45);
  for (const item of project.changes) if (explicit.has(item.id)) {
    add(item.id, 'Change request', JSON.stringify({ title: item.title, rationale: item.rationale, source: item.source, status: item.status, baselineId: item.baselineId, impacts: item.impacts, patches: item.patches ?? [] }), undefined, false, `Change request ${item.id}`, 75);
  }
  return entries.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

export function buildModelRequest({ project, references, prompt, task, tokenBudget = 8192, history = [] }: { project: Project; references: ArtifactReference[]; prompt: string; task: ModelRequest['task']; tokenBudget?: number; history?: ModelRequest['history'] }): ModelRequest {
  const context = projectEvidence(project, references);
  return { requestId: crypto.randomUUID(), task, prompt, projectId: project.id, goalId: project.activeGoalId, context,
    cloudAllowed: project.cloudAllowed ?? false, history, governance: ['Human approval is required.'],
    receipt: { requestId: '', provider: 'configured-provider', strategy: 'priority-budget-compaction', generatedAt: new Date().toISOString(), tokenBudget, estimatedTokens: 0, includedReferenceIds: [], omittedReferenceIds: [], governanceIncluded: false } };
}
export interface ModelProvider { id: string; generate(request: ModelRequest): Promise<ModelResponse> }
export class ApiModelProvider implements ModelProvider {
  id = 'configured-provider';
  async generate(request: ModelRequest): Promise<ModelResponse> {
    const payload = await api<{ metadata: { provider: string }; result: { text: string; proposal?: ModelResponse['actionProposal']; context_receipt: { estimated_tokens: number; included_reference_ids: string[]; omitted_reference_ids: string[]; partial_reference_ids: string[]; governance_included: boolean; token_budget: number; counting_method?: string; output_reservation?: number; history_messages_omitted?: number } } }>('/api/v1/workflow/run', { method: 'POST', signal: request.signal, body: JSON.stringify({ request_id: request.requestId, project_id: request.projectId, goal_id: request.goalId, task: request.task === 'conversation-action' ? 'conversation-action' : 'conversation', prompt: request.prompt, context: request.context, history: request.history ?? [], cloud_allowed: request.cloudAllowed }) });
    const receipt = payload.result.context_receipt;
    return { provider: payload.metadata.provider, text: payload.result.text, actionProposal: payload.result.proposal, receipt: { ...request.receipt, requestId: request.requestId, provider: payload.metadata.provider, countingMethod: receipt.counting_method, outputReservation: receipt.output_reservation, historyMessagesOmitted: receipt.history_messages_omitted, estimatedTokens: receipt.estimated_tokens, tokenBudget: receipt.token_budget, includedReferenceIds: receipt.included_reference_ids, omittedReferenceIds: receipt.omitted_reference_ids, partialReferenceIds: receipt.partial_reference_ids, governanceIncluded: receipt.governance_included } };
  }
}
export const configuredModelProvider = new ApiModelProvider();
export const requestModelCompletion = (request: ModelRequest, provider: ModelProvider = configuredModelProvider) => provider.generate(request);

export function modelContextFingerprint(context: ModelContextItem[]): string {
  return `sha256:${bytesToHex(sha256(utf8ToBytes(JSON.stringify(context))))}`;
}

/** Legacy chat proposals have no evidence snapshot and must be regenerated before acceptance. */
export function chatProposalContextCurrent(project: Project, proposal: ArtifactProposal): boolean {
  return proposal.contextFingerprint !== undefined && proposal.contextReferences !== undefined &&
    proposal.goalId === project.activeGoalId &&
    (proposal.contextFingerprint.startsWith('sha256:')
      ? proposal.contextFingerprint === modelContextFingerprint(projectEvidence(project, proposal.contextReferences))
      : proposal.contextFingerprint === JSON.stringify(projectEvidence(project, proposal.contextReferences)));
}
