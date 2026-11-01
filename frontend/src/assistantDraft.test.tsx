// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AssistantDrawer } from './AssistantDrawer';
import { requestModelCompletion, type ModelResponse } from './modelGateway';
import { verifyGoalSourceOriginals } from './workspaceFiles';
import { assistantSessions } from './assistantSessions';
import { freshState } from './store';

vi.mock('./modelGateway', async original => ({ ...await original<typeof import('./modelGateway')>(), requestModelCompletion: vi.fn() }));
vi.mock('./workspaceFiles', async original => ({ ...await original<typeof import('./workspaceFiles')>(), verifyGoalSourceOriginals: vi.fn() }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); vi.clearAllMocks(); assistantSessions.clear(); });

it('keeps text typed while an assistant request is running', async () => {
  const project = freshState().projects[0];
  project.goals[0].sourceIds = [];
  vi.mocked(verifyGoalSourceOriginals).mockResolvedValue(undefined);
  let resolve!: (response: ModelResponse) => void;
  vi.mocked(requestModelCompletion).mockImplementation(() => new Promise(done => { resolve = done; }));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<AssistantDrawer project={project} pinned={false} onClose={() => {}} onNavigate={() => {}} onPin={() => {}} />); });
  const input = container.querySelector<HTMLTextAreaElement>('textarea')!;
  const type = (value: string) => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); };
  await act(async () => { type('First question'); });
  await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Send"]')!.click(); });
  await act(async () => { type('Next question'); });
  await act(async () => { resolve({ text: 'Response', provider: 'test', receipt: { requestId: 'test', provider: 'test', strategy: 'priority-budget-compaction', generatedAt: '', tokenBudget: 100, estimatedTokens: 0, includedReferenceIds: [], omittedReferenceIds: [], governanceIncluded: true } }); });
  expect(input.value).toBe('Next question');
  expect(container.textContent).toContain('First question');
});

it('retains the failed request text as well as a newer composer draft', async () => {
  const project = freshState().projects[0]; project.goals[0].sourceIds = [];
  vi.mocked(verifyGoalSourceOriginals).mockResolvedValue(undefined);
  let reject!: (error: Error) => void;
  vi.mocked(requestModelCompletion).mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<AssistantDrawer project={project} pinned={false} onClose={() => {}} onNavigate={() => {}} onPin={() => {}} />); });
  const input = container.querySelector<HTMLTextAreaElement>('textarea')!;
  const type = (value: string) => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); };
  await act(async () => { type('Original question'); });
  await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Send"]')!.click(); });
  await act(async () => { type('Newer draft'); });
  await act(async () => { reject(new Error('Model unavailable')); });
  expect(input.value).toBe('Newer draft');
  expect(container.textContent).toContain('Original question');
  expect(container.textContent).toContain('Model unavailable');
});

it('does not send an assistant request after project context changes during source checking', async () => {
  const project = freshState().projects[0]; project.goals[0].sourceIds = [];
  let resolve!: () => void;
  vi.mocked(verifyGoalSourceOriginals).mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const render = (value: typeof project) => <AssistantDrawer project={value} pinned={false} onClose={() => {}} onNavigate={() => {}} onPin={() => {}} />;
  await act(async () => { root.render(render(project)); });
  const input = container.querySelector<HTMLTextAreaElement>('textarea')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Synthetic message'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Send"]')!.click(); });
  await act(async () => { root.render(render({ ...project, description: project.description + ' changed' })); });
  await act(async () => { resolve(); });
  expect(requestModelCompletion).not.toHaveBeenCalled();
  expect(input.value).toBe('Synthetic message');
  expect(container.textContent).toContain('project or selected context changed');
});

it('preserves the assistant draft, context and completed history after closing and reopening', async () => {
  const project = freshState().projects[0]; project.goals[0].sourceIds = [];
  vi.mocked(verifyGoalSourceOriginals).mockResolvedValue(undefined);
  vi.mocked(requestModelCompletion).mockResolvedValue({ text: 'Retained answer', provider: 'test', receipt: { requestId: 'retained', provider: 'test', strategy: 'priority-budget-compaction', generatedAt: '', tokenBudget: 100, estimatedTokens: 0, includedReferenceIds: [], omittedReferenceIds: [], governanceIncluded: true } });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const render = () => <AssistantDrawer key={project.id} project={project} context={{id: project.requirements[0].id, type: 'Requirement', label: 'Context'}} pinned={false} onClose={() => {}} onNavigate={() => {}} onPin={() => {}} />;
  await act(async () => { root.render(render()); });
  const fill = (value: string) => { const input = container.querySelector('textarea')!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', {bubbles: true})); };
  await act(async () => { fill('First retained question'); });
  await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Send"]')!.click(); });
  await act(async () => { fill('Unsent follow up'); });
  await act(async () => { root.render(<div>Closed</div>); });
  await act(async () => { root.render(render()); });
  expect(container.querySelector('textarea')?.value).toBe('Unsent follow up');
  expect(container.textContent).toContain('Retained answer');
  expect(container.textContent).toContain('Context');
  const other = {...project, id: 'separate-project'};
  await act(async () => { root.render(<AssistantDrawer key={other.id} project={other} pinned={false} onClose={() => {}} onNavigate={() => {}} onPin={() => {}} />); });
  expect(container.querySelector('textarea')?.value).toBe('');
  expect(container.textContent).not.toContain('Retained answer');
});

it('stops during source verification without starting inference', async () => {
  const project = freshState().projects[0]; project.goals[0].sourceIds = [];
  let checked!: () => void;
  vi.mocked(verifyGoalSourceOriginals).mockImplementation(() => new Promise<void>(resolve => { checked = resolve; }));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<AssistantDrawer project={project} pinned={false} onClose={() => {}} onNavigate={() => {}} onPin={() => {}} />); });
  await act(async () => { const input = container.querySelector('textarea')!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Keep this draft'); input.dispatchEvent(new Event('input', {bubbles:true})); });
  await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Send"]')!.click(); });
  await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent === 'Stop')!.click(); });
  await act(async () => { checked(); });
  expect(requestModelCompletion).not.toHaveBeenCalled();
  expect(container.querySelector('textarea')?.value).toBe('Keep this draft');
});

it('aborts inference and ignores late output after the assistant closes', async () => {
  const project = freshState().projects[0]; project.goals[0].sourceIds = [];
  vi.mocked(verifyGoalSourceOriginals).mockResolvedValue(undefined);
  let resolve!: (response: ModelResponse) => void;
  vi.mocked(requestModelCompletion).mockImplementation(() => new Promise(done => { resolve = done; }));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<AssistantDrawer project={project} pinned={false} onClose={() => {}} onNavigate={() => {}} onPin={() => {}} />); });
  await act(async () => { const input = container.querySelector('textarea')!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Question before closing'); input.dispatchEvent(new Event('input', {bubbles:true})); });
  await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Send"]')!.click(); });
  const request = vi.mocked(requestModelCompletion).mock.calls[0][0];
  await act(async () => { root.render(<div>Closed</div>); });
  expect(request.signal?.aborted).toBe(true);
  await act(async () => { resolve({ text: 'Late response', provider: 'test', receipt: request.receipt }); });
  expect(assistantSessions.get(project.id)?.messages).toEqual([]);
  expect(assistantSessions.get(project.id)?.prompt).toBe('Question before closing');
});


it('dismisses assistant context before closing the assistant and keeps its draft', async()=>{
  const project=freshState().projects[0],close=vi.fn();container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<AssistantDrawer project={project} pinned={false} onClose={close} onNavigate={()=>{}} onPin={()=>{}} />));
  const input=container.querySelector<HTMLTextAreaElement>('textarea')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,'Keep this draft');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>{[...container.querySelectorAll('button')].find(button=>button.textContent?.trim()==='Add context')!.click();});
  expect(document.querySelector('[aria-label="Add assistant context"]')).toBeTruthy();
  await act(async()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});
  expect(document.querySelector('[aria-label="Add assistant context"]')).toBeNull();expect(close).not.toHaveBeenCalled();expect(input.value).toBe('Keep this draft');
  await act(async()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});expect(close).toHaveBeenCalledOnce();
});
