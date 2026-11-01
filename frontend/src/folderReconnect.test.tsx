// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { TeamView } from './App';
import { freshState } from './store';
import { chooseProjectFolder, copyProjectToWorkspace } from './workspaceFiles';

vi.mock('./workspaceFiles', async original => ({ ...await original<typeof import('./workspaceFiles')>(), chooseProjectFolder: vi.fn(), copyProjectToWorkspace: vi.fn() }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); vi.clearAllMocks(); });

it('does not switch folders or overwrite a source changed while a folder is being copied', async () => {
  const notices: { title?: string; message?: string }[] = [];
  const listener = (event: Event) => notices.push((event as CustomEvent).detail);
  window.addEventListener('ba-mate-notice', listener);
  vi.mocked(chooseProjectFolder).mockResolvedValue({ kind: 'managed', path: '/tmp/synthetic-destination' } as never);
  vi.mocked(copyProjectToWorkspace).mockImplementation(async project => ({ ...structuredClone(project), workspaceId: 'new-folder', workspaceKind: 'managed', workspacePath: '/tmp/synthetic-destination', folderName: 'synthetic-destination' }));
  function Harness() {
    const [project, setProject] = useState(() => { const p = freshState().projects[0]; p.id = 'folder-race'; p.workspaceId = 'original-folder'; return p; });
    return <><output aria-label="folder">{project.workspaceId}</output><TeamView project={project} update={fn => setProject(current => { const next = structuredClone(current); next.sources[0].sha256 = 'new-revision'; fn(next); return next; })} /></>;
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><Harness /></MemoryRouter>); });
  await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Choose or change project folder'))!.click(); });
  expect(container.querySelector('[aria-label="folder"]')?.textContent).toBe('original-folder');
  expect(notices.some(item => item.title === 'Folder connection needs review' && item.message?.includes('/tmp/synthetic-destination'))).toBe(true);
  expect(notices.some(item => item.title === 'Project folder connected')).toBe(false);
  window.removeEventListener('ba-mate-notice', listener);
});

it('warns when the connected copy has unavailable source originals', async () => {
  const notices: { title?: string; message?: string; tone?: string }[] = [];
  const listener = (event: Event) => notices.push((event as CustomEvent).detail);
  window.addEventListener('ba-mate-notice', listener);
  vi.mocked(chooseProjectFolder).mockResolvedValue({ kind: 'managed', path: '/tmp/synthetic-destination' } as never);
  vi.mocked(copyProjectToWorkspace).mockImplementation(async project => {
    const copy = structuredClone(project); copy.workspaceId = 'new-folder'; copy.workspaceKind = 'managed'; copy.workspacePath = '/tmp/synthetic-destination'; copy.folderName = 'synthetic-destination';
    copy.sources.forEach(source => { source.relativePath = undefined; source.originalBase64 = undefined; source.approved = false; source.status = 'Needs review'; });
    return copy;
  });
  function Harness() {
    const [project, setProject] = useState(() => { const p = freshState().projects[0]; p.id = 'folder-missing'; return p; });
    return <TeamView project={project} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} />;
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><Harness /></MemoryRouter>); });
  await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Choose or change project folder'))!.click(); });
  expect(notices.some(item => item.title === 'Project folder connected' && item.tone === 'warning' && item.message?.includes('unavailable'))).toBe(true);
  window.removeEventListener('ba-mate-notice', listener);
});
