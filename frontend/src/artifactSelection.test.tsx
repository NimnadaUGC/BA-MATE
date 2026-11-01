// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ConnectedArtifacts } from './connected';
import { freshState } from './store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });
it('selects visible artifacts without treating draft selections as approved and clears across tabs', async () => {
  const project = freshState().projects[0];
  project.requirements.forEach(item => { item.status = 'draft'; });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<MemoryRouter><ConnectedArtifacts project={project} update={vi.fn()} onAsk={vi.fn()} onOpenConversation={vi.fn()} /></MemoryRouter>));
  const button = (name: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === name)!;
  await act(async () => { button('Select all').click(); });
  expect([...container.querySelectorAll<HTMLInputElement>('.backlog-item input')].every(item => item.checked)).toBe(true);
  expect(container.textContent).toContain(`${project.requirements.length} selected`);
  expect([...container.querySelectorAll('button')].find(item => item.textContent?.includes('Create/update SRS'))?.disabled).toBe(true);
  expect(container.querySelector('[aria-label="Synchronization mode"]')).toBeNull();
  await act(async () => { container.querySelector<HTMLButtonElement>('[role="tab"]:not([aria-selected="true"])')!.click(); });
  await act(async () => { button('Select all').click(); });
  expect(container.textContent).toContain(`${project.requirements.length + project.stories.length} selected`);
  await act(async () => { button('Clear').click(); });
  expect(container.textContent).toContain('0 selected');
  expect([...container.querySelectorAll<HTMLInputElement>('.backlog-item input')].every(item => !item.checked)).toBe(true);
});

it('explains a filtered-out open item and labels story criteria controls', async () => {
  const project = freshState().projects[0];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<MemoryRouter><ConnectedArtifacts project={project} update={vi.fn()} onAsk={vi.fn()} onOpenConversation={vi.fn()} /></MemoryRouter>));
  const search = container.querySelector<HTMLInputElement>('[aria-label="Search requirements"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'no matching artifact');
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(container.textContent).toContain('The open item is outside the current search');
  await act(async () => { [...container.querySelectorAll('button')].find(item => item.textContent === 'Clear search')!.click(); });
  expect(search.value).toBe('');
  await act(async () => { container.querySelector<HTMLButtonElement>('[role="tab"]:not([aria-selected="true"])')!.click(); });
  expect(container.querySelector('[role="group"][aria-labelledby="story-criteria-label"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Acceptance criterion 1"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Remove acceptance criterion 1"]')).not.toBeNull();
});

it('finds requirements and stories by their detailed content', async () => {
  const project = freshState().projects[0];
  project.requirements[0].statement = 'Distinctive checkout requirement';
  project.stories[0].criteria = ['Distinctive acceptance condition'];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<MemoryRouter><ConnectedArtifacts project={project} update={vi.fn()} onAsk={vi.fn()} onOpenConversation={vi.fn()} /></MemoryRouter>));
  const fill = async (name: string, value: string) => { const input = container.querySelector<HTMLInputElement>(`[aria-label="Search ${name}"]`)!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); };
  await fill('requirements', 'checkout requirement');
  expect(container.querySelectorAll('.backlog-item')).toHaveLength(1);
  await act(async () => { container.querySelector<HTMLButtonElement>('[role="tab"]:not([aria-selected="true"])')!.click(); });
  await fill('stories', 'acceptance condition');
  expect(container.querySelectorAll('.backlog-item')).toHaveLength(1);
  expect(container.querySelector('.backlog-item')?.textContent).toContain(project.stories[0].id);
});

it('submits selected drafts across tabs without approving items and deselects only shown items', async () => {
  const original = freshState().projects[0];
  original.requirements.forEach(item => { item.status = 'draft'; });
  original.requirements[1].status = 'approved';
  original.stories.forEach(item => { item.status = 'draft'; });
  let current = original;
  function Harness() {
    const [project, setProject] = useState(original); current = project;
    return <MemoryRouter><ConnectedArtifacts project={project} update={fn => setProject(previous => { const next = structuredClone(previous); fn(next); return next; })} onAsk={vi.fn()} onOpenConversation={vi.fn()} /></MemoryRouter>;
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<Harness />));
  const click = async (selector: string) => act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
  await click('[aria-label="Select all visible"]');
  await click('[role="tab"]:not([aria-selected="true"])');
  await click('[aria-label="Select all visible"]');
  expect(container.querySelector('.artifact-bulk-toolbar')?.textContent).toContain('outside this view');
  const versions = [...current.requirements, ...current.stories].map(item => item.version);
  await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('.artifact-bulk-toolbar button')].find(button => button.textContent?.startsWith('Submit drafts'))!.click(); });
  expect(current.requirements[1].status).toBe('approved');
  expect(current.requirements.filter((_,i) => i !== 1).every(item => item.status === 'in-review')).toBe(true);
  expect(current.stories.every(item => item.status === 'in-review')).toBe(true);
  expect([...current.requirements, ...current.stories].map(item => item.version)).toEqual(versions);
  await click('[aria-label="Deselect visible"]');
  expect(container.textContent).toContain(`${current.requirements.length} selected`);
  await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('.artifact-bulk-toolbar button')].find(button => button.textContent?.startsWith('Return reviews'))!.click(); });
  expect(current.requirements.filter((_,i) => i !== 1).every(item => item.status === 'draft')).toBe(true);
  expect(current.requirements[1].status).toBe('approved');
  expect(current.stories.every(item => item.status === 'in-review')).toBe(true);
});


it('supports arrow, Home and End navigation with one tab stop and preserved selections', async()=>{
  const project=freshState().projects[0];container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<MemoryRouter><ConnectedArtifacts project={project} update={vi.fn()} onAsk={vi.fn()} onOpenConversation={vi.fn()} /></MemoryRouter>));
  const tabs=container.querySelectorAll<HTMLButtonElement>('[role="tab"]');tabs[0].focus();
  const key=async(value:string)=>act(async()=>{document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));});
  await key('ArrowRight');expect(tabs[1].getAttribute('aria-selected')).toBe('true');expect(document.activeElement).toBe(tabs[1]);expect(tabs[0].tabIndex).toBe(-1);
  await key('ArrowRight');expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  await key('End');expect(document.activeElement).toBe(tabs[1]);await key('Home');expect(document.activeElement).toBe(tabs[0]);
});


it('targets a lowercase requirements section when the recommended synchronization section is used', async()=>{
  let project=freshState().projects[0];
  function Harness(){const [value,setValue]=useState(project);project=value;return <MemoryRouter><ConnectedArtifacts project={value} update={fn=>setValue(previous=>{const next=structuredClone(previous);fn(next);return next;})} onAsk={vi.fn()} onOpenConversation={vi.fn()} /></MemoryRouter>;}
  container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<Harness/>));
  await act(async()=>{[...container.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Select approved visible')!.click();});
  await act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent?.includes('Create/update SRS'))!.click();});
  const proposal=project.documentSyncProposals[0];expect(proposal.changes[0].targetSectionId).toBe('SEC-02');expect(proposal.changes[0].sectionTitle).toBe('2. Functional requirements');
});
