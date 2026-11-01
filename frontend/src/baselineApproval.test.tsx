// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityView } from './App';
import { verifyBaselineSources } from './baselineSources';
import { freshState, revisionOf, baselineIssues, captureSnapshot, restoreSnapshot } from './store';
import { canCreateBaseline } from './workflowReadiness';
import { pinSyntheticSources } from './testSourceFixtures';
import type { Project } from './types';

vi.mock('./baselineSources', () => ({ verifyBaselineSources: vi.fn() }));
const verify = vi.mocked(verifyBaselineSources);
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let notices: { message: string; tone: string }[];
const listener = (event: Event) => notices.push((event as CustomEvent).detail);
function readyProject(): Project {
  const project = freshState().projects[0];
  pinSyntheticSources(project);
  const goal = project.goals[0]; project.activeGoalId = goal.id; goal.status = 'Active'; goal.gate = 'Approve';
  project.requirements = [project.requirements[0]]; project.stories = []; project.documents = []; project.diagrams = []; project.changes = [];
  project.checks = []; project.clarifications = []; project.versions = [];
  const requirement = project.requirements[0]; requirement.goalId = goal.id; requirement.status = 'in-review';
  project.traceLinks = [{ id: 'test-link', from: 'PROJECT-BRIEF', to: requirement.id, fromRevision: 1, toRevision: requirement.version, relation: 'supports', status: 'Verified' }];
  expect(canCreateBaseline(project)).toBe(true);
  return project;
}
function Harness() {
  const [project, setProject] = useState(readyProject);
  return <MemoryRouter><button onClick={() => setProject(current => ({ ...current, description: 'Changed while checking' }))}>Change project during check</button>
    <output aria-label="baseline count">{project.versions.filter(item => item.type === 'Baseline').length}</output><output aria-label="baseline actor">{project.versions.find(item => item.type === 'Baseline')?.actor ?? ''}</output><output aria-label="approval audit">{project.audit.find(item => item.action === 'Approved baseline')?.detail ?? ''}</output>
    <ActivityView project={project} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} /></MemoryRouter>;
}
async function render() {
  notices = []; window.addEventListener('ba-mate-notice', listener);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<Harness />); });
}
function button(text: string) { return [...container.querySelectorAll('button')].find(item => item.textContent?.includes(text))!; }
function count() { return container.querySelector('[aria-label="baseline count"]')?.textContent; }
async function prepareApproval() {
  await act(async () => { button('Approve new baseline').click(); });
  const field = container.querySelector<HTMLInputElement>('[aria-label="Confirm baseline approval"] input:not([type="checkbox"])')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, 'Synthetic approver'); field.dispatchEvent(new Event('input', { bubbles: true })); container.querySelector<HTMLInputElement>('[aria-label="Confirm baseline approval"] input[type="checkbox"]')!.click(); });
}
async function submitApproval() { await prepareApproval(); await act(async () => { button('Record approval').click(); }); }
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); window.removeEventListener('ba-mate-notice', listener); verify.mockReset(); });

describe('baseline approval while source checks run', () => {
  it('blocks a baseline when its verified evidence passage no longer exists', () => {
    const project = readyProject(), source = project.sources[0], requirement = project.requirements[0];
    source.approved = true; source.status = 'Analyzed'; source.passages = [{ locator: 'Page 1', text: 'Synthetic evidence' }];
    const link = project.traceLinks[0]; link.from = source.id; link.fromRevision = revisionOf(project, source.id);
    link.sourcePassage = { sourceId: source.id, sourceRevision: link.fromRevision, locator: 'Page 1' };
    expect(canCreateBaseline(project)).toBe(true);
    link.sourcePassage.locator = 'Page missing';
    expect(canCreateBaseline(project)).toBe(false);
    expect(baselineIssues(project)).toContain('Reverify trace links against current artifact revisions.');
    expect(project.traceLinks[0].status).toBe('Verified');
    expect(project.versions).toHaveLength(0);
    expect(requirement.status).toBe('in-review');
  });
  it('retains a passage in a snapshot and reopens its link on restore', () => {
    const project = readyProject(), source = project.sources[0], link = project.traceLinks[0];
    source.passages = [{ locator: 'Page 1', text: 'Synthetic evidence' }];
    link.from = source.id; link.fromRevision = revisionOf(project, source.id);
    link.sourcePassage = { sourceId: source.id, sourceRevision: link.fromRevision, locator: 'Page 1' };
    const version = { id: 'test-snapshot', label: 'Synthetic', version: 'S1', at: 'now', actor: 'Synthetic tester', type: 'Snapshot' as const, locked: false, changes: '', snapshot: captureSnapshot(project) };
    link.sourcePassage.locator = 'Changed in working state';
    restoreSnapshot(project, version);
    expect(project.traceLinks[0].sourcePassage?.locator).toBe('Page 1');
    expect(project.traceLinks[0].status).toBe('Pending');
  });
  it('requires a name and explicit acknowledgement before checking sources', async () => {
    await render(); await act(async () => { button('Approve new baseline').click(); });
    expect(button('Record approval').disabled).toBe(true);
    expect(verify).not.toHaveBeenCalled(); expect(count()).toBe('0');
  });
  it('does not approve a scope changed while the confirmation is open', async () => {
    await render(); await prepareApproval();
    await act(async () => { button('Change project during check').click(); });
    await act(async () => { button('Record approval').click(); });
    expect(count()).toBe('0'); expect(verify).not.toHaveBeenCalled();
    expect(notices.at(-1)).toMatchObject({ tone: 'warning', message: expect.stringContaining('project changed') });
  });
  it('refuses approval when a source check fails', async () => {
    verify.mockRejectedValue(new Error('notes.txt: The original changed since extraction.'));
    await render();
    await submitApproval();
    expect(count()).toBe('0');
    expect(notices.at(-1)).toMatchObject({ tone: 'warning', message: expect.stringContaining('original changed') });
    expect(container.querySelector('[aria-label="Confirm baseline approval"] [role="alert"]')?.textContent).toContain('original changed');
    expect(button('Approve new baseline').disabled).toBe(false);
  });
  it('does not approve a project changed during the source check', async () => {
    let resolveCheck!: () => void;
    verify.mockImplementation(() => new Promise<void>(resolve => { resolveCheck = resolve; }));
    await render();
    await submitApproval();
    expect(button('Checking sources').disabled).toBe(true);
    await act(async () => { button('Change project during check').click(); });
    await act(async () => { resolveCheck(); });
    expect(count()).toBe('0');
    expect(notices.at(-1)).toMatchObject({ tone: 'warning', message: expect.stringContaining('project changed while its sources were checked') });
  });
  it('creates one baseline only when source checks and the project remain current', async () => {
    verify.mockResolvedValue(undefined);
    await render();
    await submitApproval();
    expect(count()).toBe('1');
    expect(container.querySelector('[aria-label="baseline actor"]')?.textContent).toBe('Synthetic approver');
    expect(container.querySelector('[aria-label="approval audit"]')?.textContent).toContain('Self-attested approval');
    expect(notices.at(-1)).toMatchObject({ tone: 'success', message: expect.stringContaining('locked as a new') });
  });
  it('ignores a second approval click while the first check is pending', async () => {
    let resolveCheck!: () => void;
    verify.mockImplementation(() => new Promise<void>(resolve => { resolveCheck = resolve; }));
    await render();
    await prepareApproval();
    await act(async () => { const approve = button('Record approval'); approve.click(); approve.click(); });
    expect(verify).toHaveBeenCalledTimes(1);
    await act(async () => { resolveCheck(); });
    expect(count()).toBe('1');
  });
});
