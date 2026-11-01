// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkflowWorkbench } from './WorkflowWorkbench';
import { api } from './api';
import { verifyGoalSourceOriginals } from './workspaceFiles';
import { freshState } from './store';

vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), api: vi.fn() }));
vi.mock('./workspaceFiles', async original => ({ ...await original<typeof import('./workspaceFiles')>(), verifyGoalSourceOriginals: vi.fn() }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); vi.clearAllMocks(); });
function Harness() {
  const [project, setProject] = useState(() => { const p = freshState().projects[0]; p.aiRuns = []; p.goals[0].sourceIds = []; return p; });
  return <><button onClick={() => setProject(current => ({ ...current, description: current.description + ' changed' }))}>Change context</button><button onClick={() => setProject(current => ({ ...current, workspacePath: '/tmp/other-folder' }))}>Change folder</button><WorkflowWorkbench project={project} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} /></>;
}
async function render() { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => { root.render(<Harness />); }); }
const button = (label: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.includes(label))!;

it('cancels during source checking without sending a model request', async () => {
  let resolve!: () => void;
  vi.mocked(verifyGoalSourceOriginals).mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  await render();
  await act(async () => { button('Run selected task').click(); });
  await act(async () => { button('Cancel request').click(); });
  expect(container.textContent).toContain('The request was cancelled');
  expect(button('Run selected task').disabled).toBe(false);
  await act(async () => { resolve(); });
  expect(api).not.toHaveBeenCalled();
});

it('does not send after the checked source folder changes', async () => {
  let resolve!: () => void;
  vi.mocked(verifyGoalSourceOriginals).mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  await render();
  await act(async () => { button('Run selected task').click(); });
  await act(async () => { button('Change folder').click(); });
  await act(async () => { resolve(); });
  expect(api).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Project context changed while sources were being checked');
});

it('does not send stale context when the project changes during source checking', async () => {
  let resolve!: () => void;
  vi.mocked(verifyGoalSourceOriginals).mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  await render();
  await act(async () => { button('Run selected task').click(); });
  await act(async () => { button('Change context').click(); });
  await act(async () => { resolve(); });
  expect(api).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Project context changed while sources were being checked');
});

it('records a cancelled model request without adding a proposal', async () => {
  vi.mocked(verifyGoalSourceOriginals).mockResolvedValue(undefined);
  vi.mocked(api).mockImplementation((path, options) => path === '/api/v1/workflow/cancel' ? Promise.resolve({ cancelled: true }) : new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  await render();
  await act(async () => { button('Run selected task').click(); });
  expect(api).toHaveBeenCalledTimes(1);
  await act(async () => { button('Cancel request').click(); });
  expect(vi.mocked(api).mock.calls.some(([path]) => path === '/api/v1/workflow/cancel')).toBe(true);
  expect(container.textContent).toContain('cancelled');
  expect(container.textContent).toContain('Previous AI tasks (1)');
  expect(button('Run selected task').disabled).toBe(false);
});
