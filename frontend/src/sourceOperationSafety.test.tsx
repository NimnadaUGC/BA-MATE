// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SourcesView } from './App';
import { importSource } from './api';
import { ensureProjectWorkspace, reattachSourceOriginal, writeProjectFiles } from './workspaceFiles';
import { freshState } from './store';

vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), importSource: vi.fn() }));
vi.mock('./workspaceFiles', async original => ({ ...await original<typeof import('./workspaceFiles')>(), ensureProjectWorkspace: vi.fn(), writeProjectFiles: vi.fn(), reattachSourceOriginal: vi.fn() }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); vi.clearAllMocks(); });

it.each([false, true])('only reports source import when the destination remains current (folder changes: %s)', async changeFolder => {
  const notices: { title?: string; message?: string }[] = [];
  const listener = (event: Event) => notices.push((event as CustomEvent).detail);
  window.addEventListener('ba-mate-notice', listener);
  vi.mocked(importSource).mockResolvedValue({ content: 'Synthetic source', passages: [], sha256: 'hash', original_base64: 'dGVzdA==', limitations: [], media_kind: 'document', extractable: true });
  vi.mocked(ensureProjectWorkspace).mockResolvedValue({ workspaceId: 'original', workspaceKind: 'managed', folderName: 'original', displayPath: '/tmp/original' });
  vi.mocked(writeProjectFiles).mockResolvedValue(['Uploaded Sources/test.txt']);
  function Harness() {
    const [project, setProject] = useState(() => { const p = freshState().projects[0]; p.id = 'source-import-race'; p.workspaceId = 'original'; p.workspaceKind = 'managed'; p.workspacePath = '/tmp/original'; p.sources = []; return p; });
    return <><output aria-label="source count">{project.sources.length}</output><output aria-label="folder">{project.workspaceId}</output><SourcesView project={project} update={fn => setProject(current => { const next = structuredClone(current); if (changeFolder) next.workspaceId = 'newer-folder'; fn(next); return next; })} /></>;
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><Harness /></MemoryRouter>); });
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Add project source"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['test'], 'test.txt', { type: 'text/plain' })] });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(container.querySelector('[aria-label="source count"]')?.textContent).toBe(changeFolder ? '0' : '1');
  expect(container.querySelector('[aria-label="folder"]')?.textContent).toBe(changeFolder ? 'newer-folder' : 'original');
  expect(notices.some(item => item.title === 'Source import needs review')).toBe(changeFolder);
  if (changeFolder) expect(notices.find(item => item.title === 'Source import needs review')?.message).toContain('/tmp/original');
  window.removeEventListener('ba-mate-notice', listener);
});

it('does not attach an original to a source when its folder changes during the copy', async () => {
  const notices: { title?: string; message?: string }[] = [];
  const listener = (event: Event) => notices.push((event as CustomEvent).detail);
  window.addEventListener('ba-mate-notice', listener);
  vi.mocked(reattachSourceOriginal).mockResolvedValue('Uploaded Sources/test.txt');
  function Harness() {
    const [project, setProject] = useState(() => { const p = freshState().projects[0]; p.id = 'reattach-race'; p.workspaceId = 'original'; p.workspaceKind = 'managed'; p.workspacePath = '/tmp/original'; p.sources = [p.sources[0]]; p.sources[0].relativePath = undefined; p.sources[0].originalBase64 = undefined; p.sources[0].sha256 = 'hash'; return p; });
    return <><output aria-label="source path">{project.sources[0].relativePath || 'missing'}</output><SourcesView project={project} update={fn => setProject(current => { const next = structuredClone(current); next.workspaceId = 'newer-folder'; fn(next); return next; })} /></>;
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><Harness /></MemoryRouter>); });
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Choose matching original"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['test'], 'test.txt')] });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(container.querySelector('[aria-label="source path"]')?.textContent).toBe('missing');
  expect(notices.some(item => item.title === 'Original needs review' && item.message?.includes('/tmp/original'))).toBe(true);
  expect(notices.some(item => item.title === 'Original reattached')).toBe(false);
  window.removeEventListener('ba-mate-notice', listener);
});
