import { describe, expect, it } from 'vitest';
import { approvalIssuesForArtifact, baselineIssues, restoreSnapshot, captureSnapshot, enforceWorkingVersions, freshState, IndexedDbWorkspaceRepository, revisionManifest, traceCoverage } from './store';
import { applyProposal, evidenceFingerprint, type SavedRun, type Proposal } from './workflow';
import { projectEvidence } from './modelGateway';
const empty: Proposal = { summary: 'Review', questions: [], requirements: [], stories: [], findings: [], diagrams: [], sections: [], limitations: [] };
function prepared() {
  const p = freshState().projects[0];
  p.aiRuns = [];
  const run = { id: 'RUN', at: new Date().toISOString(), goalId: p.activeGoalId, status: 'pending', fingerprint: evidenceFingerprint(p), proposal: { ...empty, requirements: [{ title: 'Record a request', statement: 'The system shall retain the submitted request identifier.', kind: 'Functional', rationale: 'Stakeholder need', acceptance_criteria: ['Submitting a valid request returns an identifier.'], source_ids: ['PROJECT-BRIEF'], assumptions: [] }] }, metadata: { request_id: 'RUN', provider: 'ollama', model: 'test-only', framework_version: 'test', prompt_version: 'test', condition: 'Proposed workflow', task: 'requirements', elapsed_ms: 1, usage: {input_tokens: 1, output_tokens: 1, cost: null}, temperature: .2, context_tokens: 8192, output_tokens: 2048, retries: 0, context_hash: 'test' }, receipt: { included_reference_ids: ['PROJECT-BRIEF'], omitted_reference_ids: [], partial_reference_ids: [], context_hash: 'test' } } as SavedRun;
  p.aiRuns.push(run); return { p, run };
}
describe('research workflow invariants', () => {
  it('accepts selected proposals as drafts and pending evidence links', () => {
    const { p, run } = prepared();
    const before = p.requirements.length;
    applyProposal(p, run.id, ['requirements:0'], run.proposal);
    expect(p.requirements).toHaveLength(before + 1);
    expect(p.requirements.at(-1)?.status).toBe('draft');
    expect(p.traceLinks.at(-1)?.status).toBe('Pending');
    expect(() => applyProposal(p, run.id, ['requirements:0'], run.proposal)).toThrow('already been reviewed');
  });
  it('retains original model output separately from human revisions', () => {
    const { p, run } = prepared();
    const edited = structuredClone(run.proposal);
    edited.requirements[0].statement = 'BA corrected statement';
    applyProposal(p, run.id, ['requirements:0'], edited);
    expect(run.proposal.requirements[0].statement).not.toBe('BA corrected statement');
    expect(run.reviewedProposal?.requirements[0].statement).toBe('BA corrected statement');
  });
  it('restores real content and retains the previous working state for recovery', () => {
    const { p } = prepared();
    const saved = captureSnapshot(p);
    const version = { id: 'B', label: 'Saved', version: 'B1', at: '', actor: 'BA', type: 'Baseline' as const, locked: true, changes: '', snapshot: saved };
    p.description = 'New working scope';
    restoreSnapshot(p, version);
    expect(p.description).toBe(saved.description);
    expect(p.versions[0].snapshot?.description).toBe('New working scope');
    expect(p.requirements.every(r => r.status === 'draft')).toBe(true);
    expect(p.traceLinks.every(l => l.status === 'Pending')).toBe(true);
  });
  it('rejects a proposal when its source evidence has changed', () => {
    const { p, run } = prepared(); p.description += ' Updated business scope.';
    expect(() => applyProposal(p, run.id, ['requirements:0'], run.proposal)).toThrow('changed');
  });
  it('keeps approved baseline contents when working artifacts are revised', () => {
    const before = freshState().projects[0];
    before.versions.unshift({ id: 'B', label: 'Baseline', version: '1', at: new Date().toISOString(), actor: 'BA', type: 'Baseline', locked: true, changes: '', snapshot: captureSnapshot(before) });
    const after = structuredClone(before);
    after.requirements[0].statement = 'Changed working statement';
    after.versions[0].snapshot = {};
    enforceWorkingVersions(before, after);
    expect(after.versions[0].snapshot).toEqual(before.versions[0].snapshot);
    expect(after.requirements[0].status).toBe('draft');
    expect(after.requirements[0].syncStatus).toBe('Out of sync');
    expect(after.requirements[0].version).toBeGreaterThan(before.requirements[0].version);
  });
  it('round-trips originals, clarification answers, audit and baselines without importing seed records', async () => {
    const p = freshState().projects[0]; p.cloudAllowed = true; p.sources[0].originalBase64 = btoa('Original document');
    p.requirements = []; p.stories = []; p.audit = []; p.clarifications = [];
    const repo = new IndexedDbWorkspaceRepository();
    const blob = await repo.exportProject(p);
    // JSZip accepts binary buffers in the node test runner; browsers pass a File.
    const buffer = await blob.arrayBuffer();
    const restored = await repo.importProject(buffer as unknown as File);
    expect(restored.sources[0].originalBase64).toBe(p.sources[0].originalBase64);
    expect(restored.requirements).toEqual([]); expect(restored.clarifications).toEqual([]);
    expect(restored.versions).toEqual(p.versions);
    expect(restored.cloudAllowed).toBe(false);
    expect(restored.audit).toHaveLength(1);
  });
  it('invalidates reviewed evidence paths after a stakeholder answer changes', () => {
    const { p } = prepared();
    const q = p.clarifications[0]; q.status = 'Answered'; q.answer = '48 hours';
    p.requirements[0].status = 'approved';
    p.traceLinks = [{ id: 'TR', from: q.id, to: p.requirements[0].id, status: 'Verified', relation: 'Confirms deadline' }];
    const after = structuredClone(p); after.clarifications[0].answer = '72 hours';
    enforceWorkingVersions(p, after);
    expect(after.traceLinks[0].status).toBe('Pending');
    expect(after.requirements[0].status).toBe('draft');
  });
  it('discovers a direct requirement edit before invalidating every dependent artifact', () => {
    const before = freshState().projects[0];
    before.checks.forEach(check => { if (check.status === 'Blocking') check.status = 'Passed'; });
    before.clarifications.forEach(question => { if (question.priority === 'Blocking') { question.status = 'Answered'; question.answer = 'Confirmed'; } });
    before.requirements[0].status = 'approved';
    before.stories[0].status = 'approved';
    before.documents[0].status = 'approved';
    const after = structuredClone(before);
    after.requirements[0].statement = 'The system shall record the confirmed request and a review status.';
    enforceWorkingVersions(before, after);
    expect(after.requirements[0].status).toBe('draft');
    expect(after.stories[0].status).toBe('draft');
    expect(after.documents[0].status).toBe('draft');
    expect(after.diagrams[0].status).toBe('Draft');
    expect(after.traceLinks.some(link => link.status === 'Pending')).toBe(true);
  });
  it('rejects direct artifact approval when its verified trace was not reviewed at the current revision', () => {
    const project = freshState().projects[0];
    project.checks.forEach(check => { if (check.status === 'Blocking') check.status = 'Passed'; });
    project.clarifications.forEach(question => { if (question.priority === 'Blocking') { question.status = 'Answered'; question.answer = 'Confirmed'; } });
    project.traceLinks = [{ id: 'TR-current', from: 'PROJECT-BRIEF', fromRevision: 1, to: 'FR-01', toRevision: 1, relation: 'supports', status: 'Verified' }];
    expect(approvalIssuesForArtifact(project, 'FR-01')).toContain('Reverify trace links against the current artifact revisions before approval.');
  });
  it('advances evidence and project-brief revisions so a link cannot verify a later edit by accident', () => {
    const before = freshState().projects[0];
    const after = structuredClone(before);
    after.description += ' Clarified delivery boundary.';
    after.clarifications[0].answer = 'A recorded answer';
    after.clarifications[0].status = 'Answered';
    const previousClarificationVersion = before.clarifications[0].version;
    enforceWorkingVersions(before, after);
    expect(after.briefVersion).toBe((before.briefVersion ?? 1) + 1);
    expect(after.clarifications[0].version).toBe((previousClarificationVersion ?? 1) + 1);
  });
  it('uses a scoped manifest rather than silently adding another goal to a baseline', () => {
    const project = freshState().projects[0];
    project.goals.push({ ...project.goals[0], id: 'GOAL-LATER', title: 'Later change', status: 'Planned', deliverables: [] });
    project.requirements.push({ ...project.requirements[0], id: 'FR-LATER', goalId: 'GOAL-LATER' });
    const manifest = revisionManifest(project);
    expect(manifest.some(item => item.id === 'FR-LATER')).toBe(false);
  });
  it('requires a testable criterion for direct requirement approval and baseline approval', () => {
    const project = freshState().projects[0];
    project.requirements[0].fitCriteria = [];
    expect(approvalIssuesForArtifact(project, project.requirements[0].id)).toContain('Add at least one testable acceptance criterion before approval.');
    expect(baselineIssues(project)).toContain('Add testable acceptance criteria before approval.');
  });
  it('does not allow a reviewed artifact set to baseline while a scoped diagram is still a draft', () => {
    const project = freshState().projects[0];
    project.diagrams[0].status = 'Draft';
    project.diagrams[0].approvalStatus = 'Draft';
    expect(baselineIssues(project)).toContain('Submit every required diagram for review.');
  });
  it('counts unlinked requirements against traceability coverage', () => {
    const p = freshState().projects[0];
    p.requirements.push({ ...p.requirements[0], id: 'UNLINKED' });
    expect(traceCoverage(p)).toBeLessThan(100);
  });
  it('does not approve a rounded 100 percent coverage with an unlinked artifact', () => {
    const p = freshState().projects[0];
    p.stories = [];
    p.requirements = Array.from({ length: 201 }, (_, i) => ({ ...p.requirements[0], id: `FR-${i}`, status: 'in-review' as const }));
    p.traceLinks = p.requirements.slice(0, 200).map(r => ({ id: `TR-${r.id}`, from: 'PROJECT-BRIEF', to: r.id, relation: 'Verified evidence', status: 'Verified' as const }));
    expect(traceCoverage(p)).toBe(100);
    expect(baselineIssues(p)).toContain('Verify an evidence path for every requirement and user story.');
  });
  it('excludes unreviewed source contents from model evidence', () => {
    const p = freshState().projects[0]; p.sources[0].content = 'UNREVIEWED'; p.sources[0].approved = false;
    expect(projectEvidence(p).some(e => e.content.includes('UNREVIEWED'))).toBe(false);
  });
  it('keeps an empty source selection empty and excludes another goal’s evidence', () => {
    const project = freshState().projects[0];
    project.sources[0].content = 'SELECTED ONLY WHEN GOAL LINKS IT';
    project.sources[1].content = 'OTHER GOAL SECRET';
    project.goals[0].sourceIds = [];
    project.goals.push({ ...project.goals[0], id: 'GOAL-OTHER', title: 'Other goal', sourceIds: ['SRC-02'], deliverables: [] });
    project.requirements.push({ ...project.requirements[0], id: 'FR-OTHER', goalId: 'GOAL-OTHER', statement: 'OTHER GOAL REQUIREMENT' });
    const evidence = projectEvidence(project);
    expect(evidence.some(item => item.id === 'SRC-01')).toBe(false);
    expect(evidence.some(item => item.id === 'SRC-02')).toBe(false);
    expect(evidence.some(item => item.content.includes('OTHER GOAL REQUIREMENT'))).toBe(false);
    expect(evidence.some(item => item.id === 'PROJECT-BRIEF')).toBe(true);
  });
  it('pins source revisions and includes scoped decisions and governance', () => {
    const project = freshState().projects[0];
    project.sources[0].content = 'Reviewed workshop evidence';
    project.goals[0].sourceIds = ['SRC-01'];
    project.registers.push({ id: 'DEC-1', type: 'Decision', title: 'Manager decides exceptions', owner: 'Owner', status: 'approved', version: 4, goalId: project.activeGoalId });
    const evidence = projectEvidence(project);
    expect(evidence.find(item => item.id === 'SRC-01')).toMatchObject({ version: project.sources[0].version ?? 1, provenance: expect.stringContaining('reviewed source') });
    expect(evidence.find(item => item.id === 'DEC-1')).toMatchObject({ version: 4, type: 'Decision' });
    expect(evidence.some(item => item.type === 'Governance check')).toBe(true);
  });
  it('marks derived artifacts from confidential evidence as local-only context', () => {
    const project = freshState().projects[0];
    project.sources[0].classification = 'Confidential';
    project.goals[0].sourceIds = [];
    project.requirements[0].sourceIds = ['SRC-01'];
    expect(projectEvidence(project).find(item => item.id === 'FR-01')?.confidential).toBe(true);
  });
});
