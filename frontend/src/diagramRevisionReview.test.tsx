// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ConnectedDocuments } from './connected';
import { freshState } from './store';
import type { Project } from './types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function setup(): Project {
 const p = freshState().projects[0], diagram = p.diagrams[0], doc = p.documents[0];
 diagram.version = 2; diagram.source = 'flowchart TD\nA[New] --> B[End]'; diagram.approvalStatus = 'Draft'; diagram.status = 'Draft';
 diagram.versions = [{ version: 1, source: 'flowchart TD\nA[Old] --> B[End]', at: '', actor: 'BA', note: '' }];
 doc.sections = [{ id: 'SEC-test', title: 'Diagram', content: '', linkedIds: [diagram.id], comments: [], blocks: [{ id: 'BLK-test', type: 'diagram', content: diagram.name, linkedIds: [diagram.id], embedding: { diagramId: diagram.id, version: 1, insertedAt: '', stale: true } }] }];
 return p;
}
function Harness({ missing = false }: { missing?: boolean }) {
 const [project, setProject] = useState(() => { const p = setup(); if (missing) p.diagrams[0].versions = []; return p; });
 return <MemoryRouter><button onClick={() => setProject(old => { const p = structuredClone(old); p.diagrams[0].version++; p.diagrams[0].source += '\nC[Changed]'; return p; })}>Change diagram</button>
 <output aria-label="pinned revision">{project.documents[0].sections[0].blocks[0].embedding?.version}</output>
 <ConnectedDocuments project={project} update={fn => setProject(old => { const p = structuredClone(old); fn(p); return p; })} /></MemoryRouter>;
}
async function render(missing = false) { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => { root.render(<Harness missing={missing} />); }); }
function button(text: string) { return [...container.querySelectorAll('button')].find(item => item.textContent?.includes(text))!; }
function pin() { return container.querySelector('[aria-label="pinned revision"]')?.textContent; }
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });

describe('reviewing a changed embedded diagram', () => {
 it('compares the old and current sources before updating the pin', async () => {
  await render(); await act(async () => { button('Review and refresh').click(); });
  const dialog = container.querySelector('[aria-label="Review diagram revision"]')!;
  expect(dialog.textContent).toContain('A[Old]'); expect(dialog.textContent).toContain('A[New]'); expect(pin()).toBe('1');
  await act(async () => { button('Use current revision').click(); }); expect(pin()).toBe('2');
 });
 it('refuses to update if the diagram changes while the comparison is open', async () => {
  await render(); await act(async () => { button('Review and refresh').click(); });
  await act(async () => { button('Change diagram').click(); }); await act(async () => { button('Use current revision').click(); });
  expect(pin()).toBe('1'); expect(container.querySelector('[aria-label="Review diagram revision"]')).not.toBeNull();
 });
 it('requires an explicit review when the previous source is unavailable', async () => {
  await render(true); await act(async () => { button('Review and refresh').click(); });
  const dialog = container.querySelector('[aria-label="Review diagram revision"]')!;
  expect(dialog.textContent).toContain('previous source is unavailable');
  expect(button('Use current revision').disabled).toBe(true);
  await act(async () => { dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(); });
  expect(button('Use current revision').disabled).toBe(false);
  await act(async () => { button('Use current revision').click(); }); expect(pin()).toBe('2');
 });
 it('prevents refresh in review mode', async () => {
  await render(); await act(async () => { button('Review').click(); });
  expect(button('Switch to Edit to refresh').disabled).toBe(true); expect(pin()).toBe('1');
 });
});
