// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewProjectModal, WorkspaceTemplates } from './App';
import { freshState } from './store';
import { createProjectWorkspace, createProjectDirectories, writeProjectFiles } from './workspaceFiles';
import type { Project, WorkspaceState } from './types';

vi.mock('./workspaceFiles', async importOriginal => ({ ...await importOriginal<typeof import('./workspaceFiles')>(), createProjectWorkspace: vi.fn(), createProjectDirectories: vi.fn(), writeProjectFiles: vi.fn() }));
const createFolder = vi.mocked(createProjectWorkspace);
const createDirs = vi.mocked(createProjectDirectories);
const writeFiles = vi.mocked(writeProjectFiles);
const reference = { workspaceId: 'synthetic-id', workspaceKind: 'managed' as const, folderName: 'synthetic-folder', displayPath: '/tmp/synthetic-folder' };
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onCreate = vi.fn<(project: Project) => void>();
const onClose = vi.fn();
function TemplatesHarness() {
  const [state, setState] = useState<WorkspaceState>(() => ({ ...freshState(), projects: [] }));
  return <MemoryRouter><output aria-label="projects">{state.projects.length}</output><output aria-label="policy">{state.projects[0]?.governancePacks.join(', ')}</output><WorkspaceTemplates setState={setState} /></MemoryRouter>;
}
async function render(kind: 'wizard' | 'templates') { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => { root.render(kind === 'wizard' ? <NewProjectModal onCreate={onCreate} onClose={onClose} /> : <TemplatesHarness />); }); }
function button(text: string) { return [...container.querySelectorAll('button')].find(item => item.textContent?.includes(text))!; }
async function gotoCreate() { await act(async () => { button('Continue').click(); }); await act(async () => { button('Continue').click(); }); }
beforeEach(() => { createDirs.mockResolvedValue(undefined); writeFiles.mockResolvedValue([]); });
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); vi.clearAllMocks(); createFolder.mockReset(); createDirs.mockReset(); writeFiles.mockReset(); });

describe('new project creation', () => {
  it('returns each step to the top and announces its heading when navigating', async () => {
    await render('wizard');
    const body = container.querySelector<HTMLElement>('.new-project-modal .modal-body')!;
    body.scrollTop = 180;
    await act(async () => { button('Continue').click(); });
    expect(body.scrollTop).toBe(0);
    expect(document.activeElement?.textContent).toBe('Build the knowledge base');
    body.scrollTop = 100;
    await act(async () => { button('Back').click(); });
    expect(body.scrollTop).toBe(0);
    expect(document.activeElement?.textContent).toBe('Define the project');
  });
  it('prevents duplicate submissions and closing during folder creation', async () => {
    let resolve!: (ref: typeof reference) => void;
    createFolder.mockImplementation(() => new Promise(done => { resolve = done; }));
    await render('wizard'); await gotoCreate();
    await act(async () => { const submit = button('Create local project'); submit.click(); submit.click(); });
    expect(createFolder).toHaveBeenCalledTimes(1);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Close"]')?.disabled).toBe(true);
    expect(button('Back').disabled).toBe(true);
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { resolve(reference); });
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
  it('reports a partial folder failure in the dialog and allows retry', async () => {
    createFolder.mockResolvedValue(reference); createDirs.mockRejectedValueOnce(new Error('Could not create a subfolder.'));
    await render('wizard'); await gotoCreate();
    await act(async () => { button('Create local project').click(); });
    expect(onCreate).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain('/tmp/synthetic-folder');
    expect(button('Create local project').disabled).toBe(false);
    await act(async () => { button('Create local project').click(); });
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});

describe('template preview', () => {
  it('shows the product policy consistently and guards a pending creation', async () => {
    let resolve!: (ref: typeof reference) => void;
    createFolder.mockImplementation(() => new Promise(done => { resolve = done; }));
    await render('templates');
    const card = [...container.querySelectorAll('article')].find(item => item.textContent?.includes('Controlled product change'))!;
    expect(card.querySelector('button')?.getAttribute('aria-label')).toBe('Preview Controlled product change template');
    await act(async () => { card.querySelector('button')!.click(); });
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Product data responsibility');
    await act(async () => { const submit = button('Create project'); submit.click(); submit.click(); });
    expect(createFolder).toHaveBeenCalledTimes(1);
    expect(button('Cancel').disabled).toBe(true);
    await act(async () => { resolve(reference); });
    expect(container.querySelector('[aria-label="projects"]')?.textContent).toBe('1');
    expect(container.querySelector('[aria-label="policy"]')?.textContent).toContain('Product data responsibility');
  });
  it('keeps the preview open and exposes a creation failure', async () => {
    createFolder.mockRejectedValue(new Error('Folder unavailable'));
    await render('templates');
    const card = [...container.querySelectorAll('article')].find(item => item.textContent?.includes('Controlled product change'))!;
    await act(async () => { card.querySelector('button')!.click(); });
    await act(async () => { button('Create project').click(); });
    expect(container.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain('Folder unavailable');
    expect(container.querySelector('[aria-label="projects"]')?.textContent).toBe('0');
    expect(button('Create project').disabled).toBe(false);
  });
});
