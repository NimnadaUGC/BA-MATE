import { describe, expect, it } from 'vitest';
import { freshState, enforceWorkingVersions, revisionOf, traceCoverage, approvalIssuesForArtifact } from './store';
import { passageIsCurrent, passageLabel, traceDisplayStatus, traceEndpointExists, traceReviewFingerprint } from './tracePassage';
import { evidenceReferences } from './evidenceReferences';
import { verifySourceOriginal } from './workspaceFiles';
import { stageReadiness } from './workflowReadiness';

describe('source passage traceability', () => {
  it('does not describe pending endpoint revisions as reviewed evidence', () => {
    const project = freshState().projects[0], link = project.traceLinks[0];
    link.status = 'Pending'; link.fromRevision = 1; link.toRevision = 1;
    const pending = evidenceReferences(project, link.to, []).join(' ');
    expect(pending).toContain('recorded endpoint revisions (not verified)');
    expect(pending).not.toContain('reviewed revisions');
    link.status = 'Verified';
    expect(evidenceReferences(project, link.to, []).join(' ')).toContain('reviewed revisions');
  });
  it('retains legacy and multiple passages and requires every selected location to be current', () => {
    const project = freshState().projects[0], source = project.sources[0], link = project.traceLinks[0];
    source.passages = [{ locator: 'Page 2', text: 'First' }, { locator: 'Page 3', text: 'Second' }];
    link.from = source.id; link.to = project.requirements[0].id;
    link.fromRevision = revisionOf(project, source.id); link.toRevision = revisionOf(project, link.to); link.status = 'Verified';
    link.sourcePassage = { sourceId: source.id, sourceRevision: link.fromRevision, locator: 'Page 2' };
    link.sourcePassages = [{ sourceId: source.id, sourceRevision: link.fromRevision, locator: 'Page 3' }];
    expect(passageIsCurrent(project, link)).toBe(true);
    expect(passageLabel(project, link)).toContain('Page 2');
    expect(passageLabel(project, link)).toContain('Page 3');
    const after = structuredClone(project);
    after.traceLinks[0].sourcePassages![0].locator = 'Page 4';
    expect(traceDisplayStatus(after, after.traceLinks[0])).toBe('Pending');
    expect(passageLabel(after, after.traceLinks[0])).toContain('review needed');
    enforceWorkingVersions(project, after);
    expect(after.traceLinks[0].status).toBe('Pending');
  });
  it('pins an unambiguous passage to the current source revision and describes stale pins', () => {
    const project = freshState().projects[0], source = project.sources[0], link = project.traceLinks[0];
    source.passages = [{ locator: 'Page 3', text: 'Source content' }]; link.from = source.id;
    link.sourcePassage = { sourceId: source.id, sourceRevision: revisionOf(project, source.id), locator: 'Page 3' };
    expect(passageIsCurrent(project, link)).toBe(true);
    expect(evidenceReferences(project, link.to, []).join(' ')).toContain('Page 3');
    source.version = revisionOf(project, source.id) + 1;
    expect(passageIsCurrent(project, link)).toBe(false);
    expect(passageLabel(project, link)).toContain('review needed');
    link.sourcePassage.sourceRevision = revisionOf(project, source.id);
    source.passages.push({ locator: 'Page 3', text: 'Ambiguous' });
    expect(passageIsCurrent(project, link)).toBe(false);
  });
  it('returns a verified relationship to pending when its selected passage changes', () => {
    const before = freshState().projects[0], link = before.traceLinks[0], source = before.sources[0];
    link.from = source.id; link.status = 'Verified';
    const after = structuredClone(before);
    after.traceLinks[0].sourcePassage = { sourceId: source.id, sourceRevision: revisionOf(before, source.id), locator: 'Page 1' };
    enforceWorkingVersions(before, after);
    expect(after.traceLinks[0].status).toBe('Pending');
  });
  it('detects a changed source path or evidence selection while review is in flight', () => {
    const project = freshState().projects[0], link = project.traceLinks[0], source = project.sources[0];
    link.from = source.id;
    const original = traceReviewFingerprint(project, link);
    source.relativePath = 'a-new-original.pdf';
    expect(traceReviewFingerprint(project, link)).not.toBe(original);
    const changedPath = traceReviewFingerprint(project, link);
    link.sourcePassage = { sourceId: source.id, sourceRevision: revisionOf(project, source.id), locator: 'Page 1' };
    expect(traceReviewFingerprint(project, link)).not.toBe(changedPath);
  });
  it('detects a missing endpoint even when the revision helper would default to one', () => {
    const project = freshState().projects[0], link = project.traceLinks[0];
    expect(traceEndpointExists(project, 'PROJECT-BRIEF')).toBe(true);
    link.to = 'FR-MISSING';
    link.status = 'Verified';
    expect(revisionOf(project, link.to)).toBe(1);
    expect(traceEndpointExists(project, link.to)).toBe(false);
    expect(traceDisplayStatus(project, link)).toBe('Broken');
    const missingFingerprint = traceReviewFingerprint(project, link);
    project.requirements.push({ ...structuredClone(project.requirements[0]), id: link.to });
    expect(traceEndpointExists(project, link.to)).toBe(true);
    expect(traceDisplayStatus(project, link)).toBe('Verified');
    expect(traceReviewFingerprint(project, link)).not.toBe(missingFingerprint);
  });
  it('does not display stale verification as current', () => {
    const project = freshState().projects[0], link = project.traceLinks[0];
    link.from = project.sources[0].id; link.to = project.requirements[0].id;
    link.fromRevision = revisionOf(project, link.from); link.toRevision = revisionOf(project, link.to); link.status = 'Verified';
    expect(traceDisplayStatus(project, link)).toBe('Verified');
    link.toRevision = 0;
    expect(traceDisplayStatus(project, link)).toBe('Pending');
    link.toRevision = revisionOf(project, link.to);
    link.sourcePassage = { sourceId: link.from, sourceRevision: link.fromRevision, locator: 'Missing page' };
    expect(traceDisplayStatus(project, link)).toBe('Pending');
  });
  it('excludes a verified link with a stale passage from evidence coverage', () => {
    const project = freshState().projects[0], source = project.sources[0], requirement = project.requirements[0];
    project.requirements = [requirement]; project.stories = [];
    source.approved = true; source.status = 'Analyzed'; source.passages = [{ locator: 'Page 1', text: 'Evidence' }];
    const link = project.traceLinks[0]; link.from = source.id; link.to = requirement.id; link.status = 'Verified';
    link.fromRevision = revisionOf(project, source.id); link.toRevision = revisionOf(project, requirement.id);
    link.sourcePassage = { sourceId: source.id, sourceRevision: link.fromRevision, locator: 'Page 1' }; project.traceLinks = [link];
    expect(traceCoverage(project)).toBe(100);
    link.sourcePassage.locator = 'Page 9';
    expect(traceCoverage(project)).toBe(0);
  });
  it('blocks artifact review and Validate readiness when a verified passage is stale', () => {
    const project = freshState().projects[0], source = project.sources[0], requirement = project.requirements[0], goal = project.goals[0];
    project.activeGoalId = goal.id; goal.status = 'Active'; requirement.goalId = goal.id;
    project.requirements = [requirement]; project.stories = [];
    source.approved = true; source.status = 'Analyzed'; source.passages = [{ locator: 'Page 1', text: 'Evidence' }];
    const link = project.traceLinks[0]; link.from = source.id; link.to = requirement.id; link.status = 'Verified';
    link.fromRevision = revisionOf(project, source.id); link.toRevision = revisionOf(project, requirement.id);
    link.sourcePassage = { sourceId: source.id, sourceRevision: link.fromRevision, locator: 'Page 1' }; project.traceLinks = [link];
    expect(stageReadiness(project, 'Validate').find(item => item.id === 'evidence-verified')?.complete).toBe(true);
    link.sourcePassage.locator = 'Page 9';
    expect(stageReadiness(project, 'Validate').find(item => item.id === 'evidence-verified')?.complete).toBe(false);
    expect(approvalIssuesForArtifact(project, requirement.id)).toContain('Reverify trace links against the current artifact revisions before approval.');
  });
  it('blocks approval of an artifact with a link to a missing record', () => {
    const project = freshState().projects[0], requirement = project.requirements[0], goal = project.goals[0];
    project.activeGoalId = goal.id; goal.status = 'Active'; requirement.goalId = goal.id;
    project.traceLinks.push({ id: 'TR-missing', from: 'SRC-DOES-NOT-EXIST', to: requirement.id, fromRevision: 1, toRevision: revisionOf(project, requirement.id), relation: 'supports', status: 'Verified' });
    expect(approvalIssuesForArtifact(project, requirement.id)).toContain('Resolve trace links with missing records before approval.');
  });
  it('rejects different original bytes when a source is checked', async () => {
    const project = freshState().projects[0], source = project.sources[0];
    source.relativePath = undefined;
    source.originalBase64 = btoa('original');
    const bytes = new TextEncoder().encode('original');
    source.sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(byte => byte.toString(16).padStart(2, '0')).join('');
    await expect(verifySourceOriginal(project, source)).resolves.toBeUndefined();
    source.originalBase64 = btoa('modified');
    await expect(verifySourceOriginal(project, source)).rejects.toThrow('original changed since extraction');
  });
});
