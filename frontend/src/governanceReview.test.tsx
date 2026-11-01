// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { GovernanceView } from './App';
import { freshState } from './store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });

it('keeps an unfinished rationale when switching findings without recording a decision', async () => {
  const project = freshState().projects[0];
  project.checks = [
    { id: 'CHK-one', title: 'First finding', category: 'Review', status: 'Warning', source: 'Review', rationale: 'First issue', owner: 'Analyst', version: 1 },
    { id: 'CHK-two', title: 'Second finding', category: 'Review', status: 'Warning', source: 'Review', rationale: 'Second issue', owner: 'Analyst', version: 1 },
  ];
  const update = vi.fn();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><GovernanceView project={project} update={update} /></MemoryRouter>); });
  const resolutionButtons = () => [...container.querySelectorAll('button')].filter(button => button.textContent?.includes('Record resolution'));
  await act(async () => { resolutionButtons()[0].click(); });
  const input = container.querySelector<HTMLTextAreaElement>('[aria-label="Rationale for CHK-one"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Unfinished review note'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => { resolutionButtons()[1].click(); });
  expect(container.querySelector('[aria-label="Rationale for CHK-two"]')).toBeTruthy();
  await act(async () => { resolutionButtons()[0].click(); });
  expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Rationale for CHK-one"]')!.value).toBe('Unfinished review note');
  expect(update).not.toHaveBeenCalled();
});

it('focuses a linked governance finding', async () => {
  const project = freshState().projects[0];
  const id = project.checks[0].id;
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter initialEntries={[`/governance?artifact=${id}`]}><GovernanceView project={project} update={() => {}} /></MemoryRouter>); });
  expect(document.activeElement?.id).toBe(`governance-${id}`);
  expect(scroll).toHaveBeenCalled();
});
