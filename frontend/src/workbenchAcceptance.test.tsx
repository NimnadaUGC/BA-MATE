// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeProposalSelection, WorkflowWorkbench } from './WorkflowWorkbench';
import { freshState } from './store';
import { evidenceFingerprint, type SavedRun } from './workflow';
import { pinSyntheticSources } from './testSourceFixtures';
import { verifyGoalSourceOriginals } from './workspaceFiles';
import type { Project } from './types';
vi.mock('./workspaceFiles', async original => ({ ...await original<typeof import('./workspaceFiles')>(), verifyGoalSourceOriginals: vi.fn() }));
const verify = vi.mocked(verifyGoalSourceOriginals);
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
function makeProject(): Project {
  const p = freshState().projects[0]; pinSyntheticSources(p); p.aiRuns = [];
  const run = { id:'TEST-RUN', at:'', goalId:p.activeGoalId, status:'pending', fingerprint:evidenceFingerprint(p),
    proposal:{summary:'test',questions:[{question:'Synthetic question?',rationale:'test',source_ids:['PROJECT-BRIEF'],priority:'Important'}],requirements:[],stories:[],findings:[],diagrams:[],sections:[],limitations:[]},
    metadata:{request_id:'TEST-RUN',provider:'test',model:'test',framework_version:'test',prompt_version:'test',condition:'Proposed workflow',task:'clarify',elapsed_ms:0,usage:{input_tokens:0,output_tokens:0,cost:null},temperature:0,context_tokens:100,output_tokens:20,retries:0,context_hash:''},
    receipt:{included_reference_ids:['PROJECT-BRIEF'],omitted_reference_ids:[],partial_reference_ids:[],context_hash:''} } as SavedRun;
  p.aiRuns.push(run); return p;
}
function Harness() {
  const [project, setProject] = useState(makeProject);
  return <><button onClick={() => setProject(current => ({ ...current, description: current.description + " changed" }))}>Change evidence</button><button onClick={() => setProject(current => { const next = structuredClone(current); next.sources[0].relativePath = 'changed/path.txt'; return next; })}>Change source path</button>
    <output aria-label="run status">{project.aiRuns?.[0].status}</output><output aria-label="question count">{project.clarifications.length}</output>
    <WorkflowWorkbench project={project} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} /></>;
}
async function render() { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => { root.render(<Harness />); }); await act(async () => { container.querySelector<HTMLInputElement>('.proposal-item input[type=checkbox]')!.click(); }); }
function button(text: string) { return [...container.querySelectorAll('button')].find(item => item.textContent?.includes(text))!; }
function status() { return container.querySelector('[aria-label="run status"]')?.textContent; }
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); verify.mockReset(); });
describe('workbench proposal source checks', () => {
  it('explains the required change before enabling impact analysis', async () => {
    const project = makeProject(); project.aiRuns = [];
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    await act(async () => { root.render(<WorkflowWorkbench project={project} update={() => {}} initialTask="impact" />); });
    expect(container.textContent).toContain('Describe the proposed change above to enable the impact analysis');
    expect(button('Run selected task').disabled).toBe(true);
    const input = container.querySelector('textarea')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Change the checkout flow'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(button('Run selected task').disabled).toBe(false);
  });
  it('describes saved selections using the reviewed content and handles missing entries', () => {
    const proposal = makeProject().aiRuns![0].proposal;
    expect(describeProposalSelection(proposal, 'questions:0')).toBe('Clarification: Synthetic question?');
    expect(describeProposalSelection(proposal, 'questions:99')).toContain('details unavailable');
    expect(describeProposalSelection(proposal, 'unknown:0')).toContain('details unavailable');
  });
  it('can select and clear suggestions without adopting them', async () => {
    await render();
    await act(async () => { button('Clear selection').click(); });
    expect(container.querySelector<HTMLInputElement>('.proposal-item input[type=checkbox]')!.checked).toBe(false);
    expect(status()).toBe('pending');
    await act(async () => { button('Select all suggestions').click(); });
    expect(container.querySelector<HTMLInputElement>('.proposal-item input[type=checkbox]')!.checked).toBe(true);
    expect(status()).toBe('pending'); expect(verify).not.toHaveBeenCalled();
  });
  it('leaves the proposal pending when an original is changed', async () => {
    verify.mockRejectedValue(new Error('Original changed since extraction.')); await render();
    const count = container.querySelector('[aria-label="question count"]')?.textContent;
    await act(async () => { button('Add 1 items').click(); });
    expect(status()).toBe('pending'); expect(container.querySelector('[aria-label="question count"]')?.textContent).toBe(count);
    expect(container.textContent).toContain('Original changed since extraction.');
  });
  it('blocks repeated clicks and changes to the checked source path', async () => {
    let resolve!: () => void; verify.mockImplementation(() => new Promise<void>(done => { resolve = done; })); await render();
    await act(async () => { const add = button('Add 1 items'); add.click(); add.click(); });
    expect(verify).toHaveBeenCalledTimes(1); expect(button('Checking sources').disabled).toBe(true);
    await act(async () => { button('Change source path').click(); });
    await act(async () => { resolve(); });
    expect(status()).toBe('pending'); expect(container.textContent).toContain('changed while they were checked');
  });
  it('shows stale proposals before acceptance and allows rejection', async () => {
    verify.mockResolvedValue(undefined); await render();
    await act(async () => { button('Change evidence').click(); });
    expect(container.textContent).toContain('Project evidence changed since this proposal was generated');
    expect(button('Add 1 items').disabled).toBe(true);
    await act(async () => { button('Reject proposal').click(); });
    expect(status()).toBe('rejected'); expect(verify).not.toHaveBeenCalled();
  });
  it('adds the selected item after an unchanged successful check', async () => {
    verify.mockResolvedValue(undefined); await render(); await act(async () => { button('Add 1 items').click(); });
    expect(status()).toBe('accepted'); expect(verify).toHaveBeenCalledTimes(1);
  });
});
