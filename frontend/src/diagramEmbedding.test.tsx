// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ConnectedDiagrams } from './connected';
import { baselineDependencyIssues } from './controlledChanges';
import { buildMarkdown, resolveExport } from './exporters';
import { freshState } from './store';
import type { Project } from './types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function initial(): Project {
  const p = freshState().projects[0]; p.activeGoalId = p.goals[0].id;
  const diagram = p.diagrams[0]; diagram.goalId = p.activeGoalId; diagram.status = 'Draft'; diagram.approvalStatus = 'Draft';
  const doc = p.documents[0]; doc.goalId = p.activeGoalId; doc.status = 'draft'; doc.sections = [];
  p.documents = [doc, { ...structuredClone(doc), id: 'DOC-SECOND', name: 'Second working document' }, { ...structuredClone(doc), id: 'DOC-APPROVED', name: 'Approved document', status: 'approved' }];
  return p;
}
function Harness() {
  const [project, setProject] = useState(initial);
  const chosen = project.documents.find(d => d.id === 'DOC-SECOND')!;
  return <MemoryRouter><button onClick={() => setProject(current => { const next = structuredClone(current); next.documents[1].version++; return next; })}>Change chosen document</button>
    <output aria-label="embedding count">{chosen.sections.flatMap(s => s.blocks).filter(b => b.embedding).length}</output>
    <output aria-label="review issues">{baselineDependencyIssues(project).join(' ')}</output>
    <output aria-label="markdown">{buildMarkdown(resolveExport(project, chosen.id))}</output>
    <ConnectedDiagrams project={project} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} />
  </MemoryRouter>;
}
async function render() { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => { root.render(<Harness />); }); }
function button(text: string) { return [...container.querySelectorAll('button')].find(item => item.textContent?.includes(text))!; }
async function selectSecond() { const select = container.querySelector<HTMLSelectElement>('[aria-label="Add diagram to a working document"] select')!; await act(async () => { select.value = 'DOC-SECOND'; select.dispatchEvent(new Event('change', { bubbles: true })); }); }
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });

describe('draft diagram embedding', () => {
  it('adds a draft figure to the selected working document and labels its review status', async () => {
    await render();
    await act(async () => { button('Add to document').click(); });
    expect(container.querySelector('[aria-label="Add diagram to a working document"]')?.textContent).toContain('must be reviewed');
    expect([...container.querySelectorAll('option')].some(option => option.value === 'DOC-APPROVED')).toBe(false);
    await selectSecond();
    await act(async () => { button('Add diagram').click(); });
    expect(container.querySelector('[aria-label="embedding count"]')?.textContent).toBe('1');
    expect(container.querySelector('[aria-label="markdown"]')?.textContent).toMatch(/Diagram — .* · Draft/);
    expect(container.querySelector('[aria-label="review issues"]')?.textContent).toContain('submit the included artifact for review');
  });
  it('does not insert into a document changed after selection', async () => {
    await render(); await act(async () => { button('Add to document').click(); }); await selectSecond();
    await act(async () => { button('Change chosen document').click(); button('Add diagram').click(); });
    expect(container.querySelector('[aria-label="embedding count"]')?.textContent).toBe('0');
  });
  it('does not insert a duplicate figure into the same document', async () => {
    await render(); await act(async () => { button('Add to document').click(); }); await selectSecond();
    await act(async () => { button('Add diagram').click(); });
    await act(async () => { button('Add to document').click(); }); await selectSecond();
    await act(async () => { button('Add diagram').click(); });
    expect(container.querySelector('[aria-label="embedding count"]')?.textContent).toBe('1');
  });
});
