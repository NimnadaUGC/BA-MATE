// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { ClarificationCard, WorkflowView } from './App';
import { MemoryRouter } from 'react-router-dom';
import { freshState } from './store';
import type { Clarification } from './types';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
function Harness() {
  const [item, setItem] = useState(() => ({ ...freshState().projects[0].clarifications[0], status: 'Unanswered', answer: undefined, answerAuthority: undefined } as Clarification));
  return <><output aria-label="answer status">{item.status}</output><ClarificationCard item={item} onUpdate={patch => setItem(current => ({ ...current, ...patch }))} /></>;
}
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });
it('does not record a suggestion until an answer and confirming person are entered', async () => {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<Harness />); });
  const suggestion = [...container.querySelectorAll('button')].find(button => button.textContent === 'All high-risk cases')!;
  await act(async () => { suggestion.click(); });
  expect(container.querySelector('[aria-label="answer status"]')?.textContent).toBe('Unanswered');
  const save = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Save answer'))!;
  expect(save.disabled).toBe(true);
  const authority = container.querySelector<HTMLInputElement>('input[placeholder="Stakeholder name or role"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(authority, 'Synthetic stakeholder'); authority.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(save.disabled).toBe(false);
  await act(async () => { save.click(); });
  expect(container.querySelector('[aria-label="answer status"]')?.textContent).toBe('Answered');
  expect(container.textContent).toContain('Answer confirmed by: Synthetic stakeholder');
});

it('reopens an answered question after its wording changes and retains the previous answer for review', async () => {
  function AnsweredHarness() {
    const [item, setItem] = useState(() => ({ ...freshState().projects[0].clarifications[0], status: 'Answered', answer: 'Original answer', answerAuthority: 'Original stakeholder' } as Clarification));
    return <><output aria-label="answer status">{item.status}</output><ClarificationCard item={item} onUpdate={patch => setItem(current => ({ ...current, ...patch }))} /></>;
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<AnsweredHarness />); });
  await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Edit'))!.click(); });
  const question = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Question for CQ-01"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(question, 'A revised question?');
    question.dispatchEvent(new Event('input', { bubbles: true }));
    question.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
  expect(container.querySelector('[aria-label="answer status"]')?.textContent).toBe('Unanswered');
  expect(container.textContent).toContain('Previous answer needs reconfirmation');
  expect(container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Answer for CQ-01"]')?.value).toBe('Original answer');
  expect([...container.querySelectorAll('button')].find(button => button.textContent?.includes('Save answer'))?.disabled).toBe(true);
});

it('preserves an unfinished answer when changing the priority filter', async () => {
  const project = freshState().projects[0];
  project.clarifications[0].priority = 'Blocking';
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><WorkflowView project={project} update={() => {}} go={() => {}} stageFeedback={[]} /></MemoryRouter>); });
  const input = container.querySelector<HTMLTextAreaElement>(`[aria-label="Answer for ${project.clarifications[0].id}"]`)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Unfinished note'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  const filters = container.querySelector('[aria-label="Filter clarifications by priority"]')!;
  const choose = (label: string) => [...filters.querySelectorAll('button')].find(button => button.textContent === label)!;
  await act(async () => { choose('Optional').click(); });
  expect(input.closest('[hidden]')).toBeTruthy();
  await act(async () => { choose('All').click(); });
  expect(input.value).toBe('Unfinished note');
  expect(input.closest('[hidden]')).toBeNull();
});

it('keeps an unsaved answer when leaving and returning to the workflow, and can discard it', async () => {
  const project = freshState().projects[0];
  project.id = 'clarification-draft-navigation-test';
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const view = () => <MemoryRouter><WorkflowView project={project} update={() => {}} go={() => {}} stageFeedback={[]} /></MemoryRouter>;
  await act(async () => { root.render(view()); });
  const label = `Answer for ${project.clarifications[0].id}`;
  const input = container.querySelector<HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Unfinished stakeholder answer'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => { root.render(<div>Another page</div>); });
  await act(async () => { root.render(view()); });
  expect(container.querySelector<HTMLTextAreaElement>(`[aria-label="${label}"]`)?.value).toBe('Unfinished stakeholder answer');
  expect(container.textContent).toContain('Answer not saved');
  await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent === 'Discard answer draft')!.click(); });
  expect(container.querySelector<HTMLTextAreaElement>(`[aria-label="${label}"]`)?.value).not.toBe('Unfinished stakeholder answer');
});
