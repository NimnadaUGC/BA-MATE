// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectedConversations } from './connected';
import { modelContextFingerprint, projectEvidence, requestModelCompletion, type ModelResponse } from './modelGateway';
import { freshState } from './store';
import { verifyGoalSourceOriginals } from './workspaceFiles';
import type { Project } from './types';
import { conversationDrafts } from './conversationDrafts';

vi.mock('./modelGateway', async importOriginal => ({ ...await importOriginal<typeof import('./modelGateway')>(), requestModelCompletion: vi.fn() }));
vi.mock('./workspaceFiles', async importOriginal => ({ ...await importOriginal<typeof import('./workspaceFiles')>(), verifyGoalSourceOriginals: vi.fn() }));
const verify = vi.mocked(verifyGoalSourceOriginals);
const complete = vi.mocked(requestModelCompletion);
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let notices: { message: string; tone: string }[];
const listener = (event: Event) => notices.push((event as CustomEvent).detail);
function initialProject(answer = false): Project {
  const p = freshState().projects[0];
  const goal = p.goals[0]; p.activeGoalId = goal.id; goal.conversationId = 'test-chat'; goal.sourceIds = [];
  const requirement = p.requirements[0];
  p.conversations = [{ id: 'test-chat', title: 'Test chat', context: [], updated: 'Today', messages: [{ id: 'test-message', role: 'assistant', text: 'A proposal', proposal: {
    id: 'test-proposal', kind: 'requirement-revision', target: requirement.id, before: requirement.statement, after: 'Updated requirement', status: 'pending', references: [], impact: [], goalId: p.activeGoalId, contextReferences: [], contextFingerprint: modelContextFingerprint(projectEvidence(p, [])),
  } }] }];
  if (answer) {
    const question = p.clarifications[0];
    question.answer = ''; question.status = 'Unanswered';
    const proposal = p.conversations[0].messages[0].proposal!;
    proposal.kind = 'clarification-answer'; proposal.target = question.id; proposal.before = ''; proposal.after = 'Synthetic answer';
    proposal.contextFingerprint = modelContextFingerprint(projectEvidence(p, []));
  }
  return p;
}
function Harness({ answer = false }: { answer?: boolean }) {
  const [project, setProject] = useState(() => initialProject(answer));
  return <MemoryRouter><button onClick={() => setProject(current => ({ ...current, description: current.description + ' changed' }))}>Change context</button>
    <output aria-label="proposal status">{project.conversations[0].messages[0].proposal?.status}</output>
    <output aria-label="requirement">{project.requirements[0].statement}</output>
    <output aria-label="answer">{project.clarifications[0]?.answer}</output>
    <ConnectedConversations project={project} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} onNavigate={() => {}} />
  </MemoryRouter>;
}
async function render(answer = false) {
  notices = []; window.addEventListener('ba-mate-notice', listener);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<Harness answer={answer} />); });
}
function button(text: string) { return [...container.querySelectorAll('button')].find(item => item.textContent?.includes(text))!; }
function status() { return container.querySelector('[aria-label="proposal status"]')?.textContent; }
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); window.removeEventListener('ba-mate-notice', listener); verify.mockReset(); complete.mockReset(); conversationDrafts.clear(); });

describe('conversation proposal acceptance', () => {
  it('opens a cited source at its specific record', async () => {
    const project = initialProject(), navigate = vi.fn();
    project.conversations[0].messages[0].references = [{ id: 'SRC-02', type: 'Source', label: 'Second source', route: 'sources' }];
    notices = []; window.addEventListener('ba-mate-notice', listener);
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => { root.render(<MemoryRouter><ConnectedConversations project={project} update={() => {}} onNavigate={navigate} /></MemoryRouter>); });
    await act(async () => { button('SRC-02').click(); });
    expect(navigate).toHaveBeenCalledWith(`/projects/${project.id}/sources?artifact=SRC-02`);
  });
  it('keeps an unsent message in its own conversation', async () => {
    function MultiChat() {
      const [project, setProject] = useState(() => { const p = initialProject(); p.conversations.push({ id: 'other-chat', title: 'Other chat', context: [], updated: 'Today', messages: [] }); return p; });
      return <MemoryRouter><ConnectedConversations project={project} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} onNavigate={() => {}} /></MemoryRouter>;
    }
    notices = []; window.addEventListener('ba-mate-notice', listener);
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => { root.render(<MultiChat />); });
    const input = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message BA Mate"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Draft for first conversation'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { button('Other chat').click(); });
    expect(input.value).toBe('');
    await act(async () => { button('Test chat').click(); });
    expect(input.value).toBe('Draft for first conversation');
  });
  it('preserves an unsent message after leaving and returning to Ask BA Mate', async () => {
    await render();
    const input = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message BA Mate"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Unsent analyst note'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { root.render(<div>Another section</div>); });
    await act(async () => { root.render(<Harness />); });
    expect(container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message BA Mate"]')?.value).toBe('Unsent analyst note');
    expect(container.textContent).toContain('not included in backups');
  });
  it('marks attached context and lets the picker close with Escape', async () => {
    await render();
    await act(async () => { button('Add context').click(); });
    const picker = container.querySelector<HTMLElement>('[aria-label="Add project context"]')!;
    const firstReference = picker.querySelector<HTMLButtonElement>(':scope > button')!;
    const referenceText = firstReference.textContent!;
    await act(async () => { firstReference.click(); });
    await act(async () => { button('Add context').click(); });
    const reopened = container.querySelector<HTMLElement>('[aria-label="Add project context"]')!;
    const attached = [...reopened.querySelectorAll<HTMLButtonElement>(':scope > button')].find(item => item.textContent?.includes(referenceText));
    expect(attached?.disabled).toBe(true);
    expect(attached?.textContent).toContain('Attached');
    await act(async () => { reopened.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(container.querySelector('[aria-label="Add project context"]')).toBeNull();
  });
  it('retains a delayed response without attaching an action when the project changed', async () => {
    verify.mockResolvedValue(undefined);
    let resolve!: (response: ModelResponse) => void;
    complete.mockImplementation(() => new Promise<ModelResponse>(done => { resolve = done; }));
    await render();
    const input = container.querySelector<HTMLTextAreaElement>('textarea[placeholder^="Ask BA Mate"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Suggest a question');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { button('Send').click(); });
    await act(async () => { button('Change context').click(); });
    await act(async () => { resolve({ text: 'Delayed response', provider: 'synthetic', receipt: { requestId: 'test', provider: 'synthetic', strategy: 'priority-budget-compaction', generatedAt: '', tokenBudget: 100, estimatedTokens: 0, includedReferenceIds: [], omittedReferenceIds: [], governanceIncluded: true }, actionProposal: { action_kind: 'clarification-question', target_id: 'Project', before: '', after: 'Synthetic question?', rationale: 'Test only', reference_ids: [] } }); });
    expect(container.textContent).toContain('Delayed response');
    expect(container.textContent).toContain('Project context changed while this response was generated');
    expect(container.querySelectorAll('.diff-card')).toHaveLength(1);
  });
  it('does not send a message when the project changes during source verification', async () => {
    let resolve!: () => void;
    verify.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    await render();
    const input = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message BA Mate"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Draft message'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { button('Send').click(); });
    await act(async () => { button('Change context').click(); });
    await act(async () => { resolve(); });
    expect(complete).not.toHaveBeenCalled();
    expect(input.value).toBe('Draft message');
    expect(notices.at(-1)).toMatchObject({ title: 'Message not sent', tone: 'warning' });
  });
  it('does not apply a proposal when an original source changed', async () => {
    verify.mockRejectedValue(new Error('BRD: The original changed since extraction.'));
    await render();
    await act(async () => { button('Accept reviewed change').click(); });
    expect(status()).toBe('pending');
    expect(notices.at(-1)).toMatchObject({ tone: 'warning', message: expect.stringContaining('original changed') });
  });
  it('does not apply a proposal if project context changes while sources are checked', async () => {
    let resolve!: () => void;
    verify.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    await render();
    await act(async () => { button('Accept reviewed change').click(); });
    expect(button('Accept reviewed change').disabled).toBe(true);
    await act(async () => { button('Change context').click(); });
    await act(async () => { resolve(); });
    expect(status()).toBe('pending');
    expect(notices.at(-1)).toMatchObject({ tone: 'warning', message: expect.stringContaining('context changed') });
  });
  it('checks originals again when a clarification answer is confirmed', async () => {
    verify.mockRejectedValue(new Error('BRD: The original changed since extraction.'));
    await render(true);
    await act(async () => { button('Accept reviewed change').click(); });
    const authority = container.querySelector<HTMLInputElement>('input[placeholder="Stakeholder name or role"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(authority, 'Synthetic stakeholder');
      authority.dispatchEvent(new Event('input', { bubbles: true }));
      container.querySelector<HTMLInputElement>('.connected-confirm-modal input[type="checkbox"]')!.click();
    });
    expect(button('Record confirmed answer').disabled).toBe(false);
    await act(async () => { button('Record confirmed answer').click(); });
    expect(status()).toBe('pending');
    expect(container.querySelector('[aria-label="answer"]')?.textContent).toBe('');
    expect(notices.at(-1)).toMatchObject({ tone: 'warning', message: expect.stringContaining('original changed') });
  });
  it('applies the reviewed change when source checks pass and context is unchanged', async () => {
    verify.mockResolvedValue(undefined);
    await render();
    await act(async () => { button('Accept reviewed change').click(); });
    expect(status()).toBe('accepted');
    expect(container.querySelector('[aria-label="requirement"]')?.textContent).toBe('Updated requirement');
  });
});
