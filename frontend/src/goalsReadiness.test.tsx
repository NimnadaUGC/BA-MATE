// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { GoalsView, WorkflowView, ProjectOverview } from './App';
import { freshState } from './store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });
it('explains why an unfinished goal cannot yet be completed', async () => {
  const project = freshState().projects[0];
  project.goals[0].gate = 'Clarify'; project.goals[0].gateIndex = 2;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><GoalsView project={project} update={() => {}} go={() => {}} stageFeedback={[]} /></MemoryRouter>); });
  expect(container.textContent).toContain('Complete the workflow through Approve before marking this goal complete.');
  expect(container.querySelector('[aria-label="Clarify: current stage"]')).toBeTruthy();
  expect([...container.querySelectorAll('button')].find(button => button.textContent?.includes('Mark complete'))?.disabled).toBe(true);
});

it('offers goal completion instead of advancing to the current Approve stage', async () => {
  const project = freshState().projects[0];
  project.goals[0].gate = 'Approve'; project.goals[0].gateIndex = 5;
  let destination = '';
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><WorkflowView project={project} update={() => {}} go={route => { destination = route; }} stageFeedback={[]} /></MemoryRouter>); });
  const action = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Manage goal completion'))!;
  expect(action).toBeTruthy();
  expect([...container.querySelectorAll('button')].some(button => button.textContent?.includes('Advance to Approve'))).toBe(false);
  await act(async () => { action.click(); });
  expect(destination).toBe('goals');
});


it('shows saved work without a false in-progress workflow after the final goal is completed', async () => {
  const project=freshState().projects[0];project.goals.forEach(goal=>{goal.status='Completed';});project.activeGoalId=undefined;
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>{root.render(<MemoryRouter><ProjectOverview project={project} update={()=>{}} go={()=>{}} /></MemoryRouter>);});
  expect(container.textContent).toContain('Your saved goals and deliverables remain available.');
  expect(container.textContent).not.toContain('This fresh project contains no generated artifacts yet');
  expect(container.querySelector('[aria-label*="in progress. Open current workflow"]')).toBeNull();
  expect(container.textContent).toContain('Manage goals');
});
