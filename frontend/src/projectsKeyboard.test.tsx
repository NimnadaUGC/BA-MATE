// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ProjectsHome, projectChoiceLabel } from './App';
import { freshState } from './store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });
function Location() { return <output>{useLocation().pathname}</output>; }
it('does not open a project when keyboard events originate on its child buttons', async () => {
  const state = freshState(); state.projects = [state.projects[0]];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><Location /><ProjectsHome state={state} onCreate={vi.fn()} onDelete={vi.fn()} /></MemoryRouter>); });
  const card = container.querySelector('[role="link"]')!;
  const action = card.querySelector('button')!;
  for (const key of ['Enter', ' ']) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    await act(async () => { action.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
    expect(container.querySelector('output')?.textContent).toBe('/');
  }
  await act(async () => { card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
  expect(container.querySelector('output')?.textContent).toBe(`/projects/${state.projects[0].id}/overview`);
});

it('distinguishes same-named projects and identifies the chosen folder in the delete confirmation', async () => {
  const state = freshState();
  const first = state.projects[0], second = structuredClone(first);
  first.folderName = 'primary-folder'; first.workspacePath = '/tmp/primary-folder';
  second.id = 'different-id'; second.folderName = 'recovered-folder'; second.workspacePath = '/tmp/recovered-folder';
  state.projects = [first, second];
  expect(projectChoiceLabel(first, [first])).toBe(first.name);
  expect(projectChoiceLabel(first, state.projects)).not.toBe(projectChoiceLabel(second, state.projects));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><ProjectsHome state={state} onCreate={vi.fn()} onDelete={vi.fn()} /></MemoryRouter>); });
  const deleteButton = [...container.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === `Delete ${projectChoiceLabel(second, state.projects)}`)!;
  await act(async () => { deleteButton.click(); });
  const dialog = container.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('/tmp/recovered-folder');
  expect(dialog.textContent).toContain('Original files remain');
  expect(dialog.textContent).toContain('older local workspace revisions');
  expect(dialog.textContent).not.toContain('/tmp/primary-folder');
});

it('filters projects by name or folder and restores the list after clearing', async () => {
  const state = freshState(), first = state.projects[0], second = structuredClone(first);
  first.name = 'Alpha project'; first.folderName = 'alpha-folder';
  second.id = 'second'; second.name = 'Beta project'; second.folderName = 'beta-folder';
  state.projects = [first, second];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><ProjectsHome state={state} onCreate={vi.fn()} onDelete={vi.fn()} /></MemoryRouter>); });
  const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
  const search = async (value: string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await search('BETA-FOLDER');
  expect(container.querySelectorAll('.project-card')).toHaveLength(1);
  expect(container.textContent).toContain('Beta project');
  await search('missing');
  expect(container.textContent).toContain('No matching projects');
  await act(async () => { [...container.querySelectorAll('button')].find(item => item.textContent?.includes('Clear search'))!.click(); });
  expect(container.querySelectorAll('.project-card')).toHaveLength(2);
});
