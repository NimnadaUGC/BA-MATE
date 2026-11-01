// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ConnectedDocuments } from './connected';
import { freshState } from './store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });
it('keeps document undo unavailable in review mode, including the keyboard shortcut', async () => {
  function Harness() {
    const [project, setProject] = useState(() => freshState().projects[0]);
    return <MemoryRouter><output aria-label="section count">{project.documents[0].sections.length}</output><ConnectedDocuments project={project} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} /></MemoryRouter>;
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<Harness />); });
  const button = (name: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === name)!;
  await act(async () => { button('Add section').click(); });
  const count = container.querySelector('[aria-label="section count"]')!.textContent;
  expect(button('Undo').disabled).toBe(false);
  await act(async () => { button('Review').click(); });
  expect(button('Undo').disabled).toBe(true);
  expect(button('Review').getAttribute('aria-pressed')).toBe('true');
  await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true })); });
  expect(container.querySelector('[aria-label="section count"]')!.textContent).toBe(count);
  await act(async () => { button('Edit').click(); });
  await act(async () => { button('Undo').click(); });
  expect(container.querySelector('[aria-label="section count"]')!.textContent).not.toBe(count);
});

it('opens comments without creating one and preserves an authored note through undo', async () => {
  function Harness() {
    const [project, setProject] = useState(() => freshState().projects[0]);
    return <MemoryRouter><ConnectedDocuments project={project} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} /></MemoryRouter>;
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<Harness />); });
  const button = (name: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === name)!;
  await act(async () => { button('Add section').click(); button('Comments (0)').click(); });
  expect(container.textContent).toContain('No comments yet.');
  expect(button('Add comment').disabled).toBe(true);
  const input = container.querySelector<HTMLTextAreaElement>('.document-comments textarea')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Check the receipt format'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => { button('Add comment').click(); });
  expect(container.textContent).toContain('Check the receipt format');
  await act(async () => { button('Undo').click(); });
  expect(container.textContent).toContain('Check the receipt format');
  await act(async () => { button('Mark resolved').click(); });
  expect(container.textContent).toContain('Resolved');
});

it('opens and focuses the document containing a linked section', async () => {
  const project = freshState().projects[0];
  const second = structuredClone(project.documents[0]); second.id = 'DOC-OTHER'; second.name = 'Other document'; second.sections[0].id = 'SEC-OTHER'; project.documents.push(second);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter initialEntries={['/documents?artifact=SEC-OTHER']}><ConnectedDocuments project={project} update={() => {}} /></MemoryRouter>); });
  expect(container.querySelector<HTMLInputElement>('[aria-label="Document name"]')?.value).toBe('Other document');
  expect(document.activeElement?.id).toBe('SEC-OTHER');
});

it('reflects document status and requires a working revision instead of resubmitting approved content', async () => {
  let current=freshState().projects[0];
  function Harness(){const [project,set]=useState(()=>{const p=freshState().projects[0];p.documents[0].status='approved';return p;});current=project;return <MemoryRouter><ConnectedDocuments project={project} update={fn=>set(previous=>{const next=structuredClone(previous);fn(next);return next;})}/></MemoryRouter>;}
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<Harness/>));
  const button=(name:string)=>[...container.querySelectorAll('button')].find(item=>item.textContent?.trim()===name)!;
  const version=current.documents[0].version;
  await act(async()=>button('Create working revision').click());
  expect(current.documents[0].status).toBe('draft');
  expect(current.documents[0].version).toBe(version);
  await act(async()=>button('Submit for review').click());
  expect(current.documents[0].status).toBe('in-review');
  expect(button('In review').disabled).toBe(true);
  const audits=current.audit.length;
  await act(async()=>button('In review').click());
  expect(current.audit).toHaveLength(audits);
  await act(async()=>button('Return to draft').click());
  expect(current.documents[0].status).toBe('draft');
});
