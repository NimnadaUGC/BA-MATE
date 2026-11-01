import { describe, expect, it } from 'vitest';
import { buildDeveloperMarkdown, buildMarkdown, resolveExport } from './exporters';
import { captureSnapshot, freshState, revisionManifest } from './store';

describe('controlled exports', () => {
  it('exports an immutable baseline rather than substituting newer working text', () => {
    const project = freshState().projects[0];
    const document = project.documents[0];
    document.status = 'approved';
    [...project.requirements, ...project.stories].forEach(item => { item.status = 'approved'; });
    project.diagrams.forEach(item => { item.status = 'Approved'; item.approvalStatus = 'Approved'; });
    const baseline = { id: 'BASE-EXPORT', label: 'Export baseline', version: 'B-export', at: 'now', actor: 'BA', type: 'Baseline' as const, locked: true, changes: 'approved', snapshot: captureSnapshot(project), manifest: revisionManifest(project) };
    project.versions.unshift(baseline);
    document.version += 1;
    document.sections[0].blocks[0].content = 'NEWER WORKING CONTENT MUST NOT APPEAR';
    const markdown = buildMarkdown(resolveExport(project, document.id, { kind: 'baseline', baselineId: baseline.id }));
    expect(markdown).toContain('Approved baseline B-export');
    expect(markdown).toContain('This specification describes the approved scope');
    expect(markdown).not.toContain('NEWER WORKING CONTENT MUST NOT APPEAR');
    expect(markdown).toContain('Acceptance criteria');
    expect(markdown).toContain('Selected revision manifest');
  });
  it('captures a separate identified working package when linked records change without a document revision', () => {
    const project = freshState().projects[0], document = project.documents[0], story = project.stories[0];
    document.sections[0].blocks[0].linkedIds = [story.id];
    const first = resolveExport(project, document.id);
    const original = buildMarkdown(first);
    story.value = 'A changed linked record';
    story.version++;
    const second = resolveExport(project, document.id);
    expect(first.document.version).toBe(second.document.version);
    expect(first.exportId).toMatch(/^[0-9a-f]{32}$/);
    expect(second.exportId).not.toBe(first.exportId);
    expect(buildMarkdown(first)).toBe(original);
    expect(original).toContain(`export_id: "${first.exportId}"`);
    expect(buildDeveloperMarkdown(first)).toContain(`export_id: "${first.exportId}"`);
    expect(buildMarkdown(second)).toContain('A changed linked record');
    expect(original).not.toContain('A changed linked record');
  });
  it('labels working handovers as drafts and does not invent architecture', () => {
    const project = freshState().projects[0];
    const handover = buildDeveloperMarkdown(resolveExport(project, project.documents[0].id));
    expect(handover).toContain('Working draft — not approved');
    expect(handover).toContain('Acceptance criteria');
    expect(handover).toContain('does not prescribe architecture');
    expect(handover).toContain('Unresolved decisions');
  });
  it('shows manual relationships and their review status in the handover', () => {
    const project = freshState().projects[0], requirement = project.requirements[0], story = project.stories[0];
    requirement.sourceIds = []; story.sourceIds = [];
    project.traceLinks = [
      { id: 'TR-source', from: 'PROJECT-BRIEF', to: requirement.id, relation: 'supports', status: 'Pending' },
      { id: 'TR-story', from: requirement.id, to: story.id, relation: 'supports', status: 'Verified', fromRevision: requirement.version, toRevision: story.version },
    ];
    const handover = buildDeveloperMarkdown(resolveExport(project, project.documents[0].id));
    expect(handover).toContain('PROJECT-BRIEF — supports (Pending');
    expect(handover).toContain(`${requirement.id} — supports (Verified`);
    project.traceLinks[1].fromRevision!--;
    expect(buildDeveloperMarkdown(resolveExport(project, project.documents[0].id))).toContain('Verified at older or unspecified revisions; review needed');
  });
  it('limits approved handovers to the baseline manifest, even if the snapshot has other goal artifacts', () => {
    const project = freshState().projects[0], doc = project.documents[0];
    const included = project.requirements[0], omitted = project.requirements[1];
    included.status = 'approved'; omitted.status = 'draft';
    doc.status = 'approved'; doc.sections.forEach(section => { section.linkedIds = []; section.blocks.forEach(block => { block.linkedIds = []; delete block.embedding; }); });
    const manifest = revisionManifest(project).filter(item => item.id === doc.id || item.id === included.id);
    project.versions = [{ id: 'scope', label: 'Test', version: 'B', at: '', actor: 'BA', type: 'Baseline', locked: true, changes: '', snapshot: captureSnapshot(project), manifest }];
    const handover = buildDeveloperMarkdown(resolveExport(project, doc.id, { kind: 'baseline', baselineId: 'scope' }));
    expect(handover).toContain(included.statement);
    expect(handover).not.toContain(omitted.statement);
  });
  it('includes cross-goal changes that affected a manifest artifact', () => {
    const project = freshState().projects[0], doc = project.documents[0], requirement = project.requirements[0];
    requirement.status = 'approved'; doc.status = 'approved'; doc.goalId = 'initial';
    doc.sections.forEach(section => { section.linkedIds = []; section.blocks.forEach(block => { block.linkedIds = []; delete block.embedding; }); });
    project.changes = [{ id: 'CR-cross', title: 'Change in later goal', rationale: 'Test reason', source: 'Test', status: 'Revalidated', goalId: 'later', impacts: [{ id: requirement.id, type: 'Requirement', reason: 'Affected', selected: true }] }];
    const manifest = [{ id: doc.id, type: 'Document' as const, revision: doc.version }, { id: requirement.id, type: 'Requirement' as const, revision: requirement.version }];
    project.versions = [{ id: 'cross', label: 'Test', version: 'B', at: '', actor: 'BA', type: 'Baseline', locked: true, changes: '', snapshot: captureSnapshot(project), manifest }];
    expect(buildDeveloperMarkdown(resolveExport(project, doc.id, { kind: 'baseline', baselineId: 'cross' }))).toContain('CR-cross: Change in later goal');
  });
  it('includes unresolved items from each included goal without adding unrelated goal records', () => {
    const project = freshState().projects[0], doc = project.documents[0], requirement = project.requirements[0];
    doc.goalId = 'initial'; doc.status = 'approved'; requirement.goalId = 'later'; requirement.status = 'approved';
    doc.sections.forEach(section => { section.linkedIds = []; section.blocks.forEach(block => { block.linkedIds = []; delete block.embedding; }); });
    const base = project.clarifications[0];
    project.clarifications = [
      { ...base, id: 'Q-later', goalId: 'later', status: 'Unanswered', question: 'Later goal unresolved?', affects: [] },
      { ...base, id: 'Q-other', goalId: 'other', status: 'Unanswered', question: 'Unrelated goal question?', affects: [] },
      { ...base, id: 'Q-linked', goalId: 'other', status: 'Deferred', question: 'Explicitly affects this requirement?', affects: [requirement.id] },
    ];
    const manifest = [{ id: doc.id, type: 'Document' as const, revision: doc.version }, { id: requirement.id, type: 'Requirement' as const, revision: requirement.version }];
    project.versions = [{ id: 'goals', label: 'Test', version: 'B', at: '', actor: 'BA', type: 'Baseline', locked: true, changes: '', snapshot: captureSnapshot(project), manifest }];
    const pkg = resolveExport(project, doc.id, { kind: 'baseline', baselineId: 'goals' });
    for (const output of [buildMarkdown(pkg), buildDeveloperMarkdown(pkg)]) {
      expect(output).toContain('Later goal unresolved? (Unanswered; goal later)');
      expect(output).toContain('Explicitly affects this requirement? (Deferred; goal other)');
      expect(output).not.toContain('Unrelated goal question?');
    }
  });
  it('renders linked source, project and goal records instead of falsely claiming they are missing', () => {
    const project = freshState().projects[0], document = project.documents[0];
    document.sections[0].blocks[0].linkedIds = [project.sources[0].id, 'PROJECT-BRIEF', 'PROJECT-GOVERNANCE', project.goals[0].id];
    const markdown = buildMarkdown(resolveExport(project, document.id));
    expect(markdown).toContain(`### ${project.sources[0].id} — ${project.sources[0].name}`);
    expect(markdown).toContain('PROJECT-BRIEF — Project brief');
    expect(markdown).toContain('PROJECT-GOVERNANCE — Selected governance packs');
    expect(markdown).toContain(`### ${project.goals[0].id} — ${project.goals[0].title}`);
  });
  it('rejects a baseline without an immutable manifest', () => {
    const project = freshState().projects[0];
    project.versions.unshift({ id: 'BASE-BAD', label: 'Bad', version: 'B-bad', at: 'now', actor: 'BA', type: 'Baseline', locked: true, changes: 'bad', snapshot: captureSnapshot(project), manifest: [] });
    expect(() => resolveExport(project, project.documents[0].id, { kind: 'baseline', baselineId: 'BASE-BAD' })).toThrow('immutable content manifest');
  });
  it('rejects old baselines with omitted or unapproved document dependencies', () => {
    const project = freshState().projects[0];
    const document = project.documents[0], requirement = project.requirements[0];
    project.requirements = [requirement]; project.stories = []; project.diagrams = [];
    document.status = 'approved'; requirement.status = 'draft';
    document.sections = [document.sections[0]];
    document.sections[0].linkedIds = [];
    document.sections[0].blocks = [document.sections[0].blocks[0]];
    document.sections[0].blocks[0].linkedIds = [requirement.id];
    const snapshot = captureSnapshot(project);
    const manifest = revisionManifest(project);
    project.versions = [{ id: 'incomplete', label: 'Old', version: 'B-old', at: '', actor: 'BA', type: 'Baseline', locked: true, changes: '', snapshot, manifest: manifest.filter(item => item.id !== requirement.id) }];
    expect(() => resolveExport(project, document.id, { kind: 'baseline', baselineId: 'incomplete' })).toThrow(/incomplete.*referenced artifact/i);
    project.versions[0].manifest = manifest;
    expect(() => resolveExport(project, document.id, { kind: 'baseline', baselineId: 'incomplete' })).toThrow(/unapproved referenced artifact/i);
  });
});
