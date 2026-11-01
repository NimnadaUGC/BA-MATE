// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { PolicyProposalReview, TeamView } from './App';
import { freshState } from './store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });
it('retains unsaved setup and policy drafts when leaving and returning', async () => {
  const project = freshState().projects[0]; project.id = 'test-settings-drafts';
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const render = async () => act(async () => { root.render(<MemoryRouter><TeamView project={project} update={() => {}} /></MemoryRouter>); });
  await render();
  const inputs = container.querySelectorAll<HTMLInputElement>('.project-settings-fields input');
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(inputs[0], 'Unsaved name'); inputs[0].dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Add policy'))!.click(); });
  await act(async () => { root.unmount(); }); root = createRoot(container); await render();
  expect(container.querySelector<HTMLInputElement>('.project-settings-fields input')!.value).toBe('Unsaved name');
  expect([...container.querySelectorAll('input')].some(input => input.value === 'New project policy')).toBe(true);
  expect(container.textContent).toContain('Project setup changes are not saved');
  expect([...container.querySelectorAll('select')].some(select => select.getAttribute('aria-label') === `Role for ${project.members[0].name}`)).toBe(true);
  expect([...container.querySelectorAll('input')].some(input => input.getAttribute('aria-label') === `Can ${project.members[0].name} approve baselines`)).toBe(true);
  await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Discard setup changes'))!.click(); });
  await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Discard policy changes'))!.click(); });
});

it('shows added and removed policies before applying a proposal and retains core policies', async () => {
  const use = vi.fn(), discard = vi.fn();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<PolicyProposalReview current={['Core responsible BA', 'Human oversight & traceability', 'Old policy']} proposed={['New policy']} onUse={use} onDiscard={discard} />); });
  expect(container.textContent).toContain('Added (1)');
  expect(container.textContent).toContain('Removed (1)');
  expect(container.textContent).toContain('Old policy');
  expect(use).not.toHaveBeenCalled();
  await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Use this list'))!.click(); });
  expect(use).toHaveBeenCalledWith(['Core responsible BA', 'Human oversight & traceability', 'New policy']);
});
