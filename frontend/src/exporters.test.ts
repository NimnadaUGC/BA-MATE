import { describe, expect, it } from 'vitest';
import { buildDeveloperMarkdown, buildMarkdown, resolveExport } from './exporters';
import { captureSnapshot, freshState, revisionManifest } from './store';

describe('controlled exports', () => {
  it('exports an immutable baseline rather than substituting newer working text', () => {
    const project = freshState().projects[0];
    const document = project.documents[0];
    document.status = 'approved';
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
  it('labels working handovers as drafts and does not invent architecture', () => {
    const project = freshState().projects[0];
    const handover = buildDeveloperMarkdown(resolveExport(project, project.documents[0].id));
    expect(handover).toContain('Working draft — not approved');
    expect(handover).toContain('Acceptance criteria');
    expect(handover).toContain('does not prescribe architecture');
    expect(handover).toContain('Unresolved decisions');
  });
  it('rejects a baseline without an immutable manifest', () => {
    const project = freshState().projects[0];
    project.versions.unshift({ id: 'BASE-BAD', label: 'Bad', version: 'B-bad', at: 'now', actor: 'BA', type: 'Baseline', locked: true, changes: 'bad', snapshot: captureSnapshot(project), manifest: [] });
    expect(() => resolveExport(project, project.documents[0].id, { kind: 'baseline', baselineId: 'BASE-BAD' })).toThrow('immutable content manifest');
  });
});
