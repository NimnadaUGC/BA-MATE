import { describe, expect, it } from 'vitest';
import { freshState } from './store';
import { conversationProjectContext, chatProposalContextCurrent, modelContextFingerprint, projectEvidence } from './modelGateway';
import type { ArtifactProposal } from './types';

function proposalFor(project: ReturnType<typeof freshState>['projects'][number]): ArtifactProposal {
  const contextReferences: ArtifactProposal['references'] = [];
  return { id: 'test', kind: 'clarification-question', target: 'Project', before: '', after: 'What happens next?', status: 'pending', references: [], impact: [], goalId: project.activeGoalId, contextReferences, contextFingerprint: modelContextFingerprint(projectEvidence(project, contextReferences)) };
}

describe('conversation proposal evidence', () => {
  it('permits a proposal only while its goal and evidence remain unchanged', () => {
    const project = freshState().projects[0];
    const proposal = proposalFor(project);
    expect(chatProposalContextCurrent(project, proposal)).toBe(true);
    expect(proposal.contextFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(proposal.contextFingerprint).not.toContain(project.description);
    project.description += ' Changed after the request.';
    expect(chatProposalContextCurrent(project, proposal)).toBe(false);
  });
  it('continues to check older exact snapshots for compatibility', () => {
    const project = freshState().projects[0];
    const proposal = proposalFor(project);
    proposal.contextFingerprint = JSON.stringify(projectEvidence(project, proposal.contextReferences));
    expect(chatProposalContextCurrent(project, proposal)).toBe(true);
    project.description += ' changed';
    expect(chatProposalContextCurrent(project, proposal)).toBe(false);
  });
  it('blocks proposals when the goal changes or the evidence snapshot is missing', () => {
    const project = freshState().projects[0];
    const proposal = proposalFor(project);
    project.activeGoalId = 'different-goal';
    expect(chatProposalContextCurrent(project, proposal)).toBe(false);
    delete proposal.contextFingerprint;
    expect(chatProposalContextCurrent(project, proposal)).toBe(false);
  });
});

it('includes an attached change request and invalidates its proposal when the change is edited', () => {
  const project = freshState().projects[0];
  const change = project.changes[0];
  const references = [{ id: change.id, label: change.title, type: 'Change request' as const }];
  const context = projectEvidence(project, references);
  expect(context.find(item => item.id === change.id)?.content).toContain(change.rationale);
  const proposal = { ...proposalFor(project), contextReferences: references, contextFingerprint: modelContextFingerprint(context) };
  expect(chatProposalContextCurrent(project, proposal)).toBe(true);
  change.rationale += ' Changed after the request.';
  expect(chatProposalContextCurrent(project, proposal)).toBe(false);
});

it('retains confidentiality through derived documents, diagrams, stories and change requests', () => {
  const project = freshState().projects[0]; project.goals[0].sourceIds = [];
  const source = project.sources[0]; source.classification = 'Confidential';
  const requirement = project.requirements[0]; requirement.sourceIds = [source.id];
  const story = project.stories[0]; story.sourceIds = []; story.requirementIds = [requirement.id];
  const diagram = project.diagrams[0]; diagram.linkedIds = [story.id];
  const document = project.documents[0]; document.sections[0].linkedIds = [diagram.id];
  const change = project.changes[0]; change.impacts = [{ id: document.id, type:'Document', reason:'Test', selected:true }];
  const references = [diagram, document, change].map(item => ({id:item.id, label:item.id, type:'Document' as const}));
  const evidence = projectEvidence(project, references);
  for (const id of [requirement.id, story.id, diagram.id, document.id, change.id]) expect(evidence.find(item => item.id === id)?.confidential).toBe(true);
});

it('keeps an older goal conversation scoped to that goal while another goal is active', () => {
  const project=freshState().projects[0], original=project.goals[0];
  original.conversationId='older-chat';original.status='Completed';original.sourceIds=[project.sources[0].id];
  const other={...structuredClone(original),id:'OTHER-GOAL',conversationId:'other-chat',status:'Active' as const,sourceIds:[project.sources[1].id]};
  project.goals=[original,other];project.activeGoalId=other.id;
  for(const goal of project.goals){goal.sourceRevisionPins={};for(const id of goal.sourceIds){const source=project.sources.find(item=>item.id===id)!;source.approved=true;source.status='Analyzed';source.sha256=`hash-${id}`;source.relativePath=`${id}.txt`;source.content=`Synthetic source ${id}`;source.passages=[];goal.sourceRevisionPins[id]=source.sha256;}}
  project.requirements[0].goalId=original.id;project.requirements[1].goalId=other.id;
  const scoped=conversationProjectContext(project,'older-chat');
  expect(scoped.activeGoalId).toBe(original.id);expect(project.activeGoalId).toBe(other.id);
  const ids=projectEvidence(scoped).map(item=>item.id);
  expect(ids).toContain(project.sources[0].id);expect(ids).not.toContain(project.sources[1].id);
  expect(ids).toContain(project.requirements[0].id);expect(ids).not.toContain(project.requirements[1].id);
});
