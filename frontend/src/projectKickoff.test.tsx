// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectKickoff } from './App';
import { freshState } from './store';
import { verifySourceOriginal } from './workspaceFiles';
import type { Project } from './types';

vi.mock('./workspaceFiles', async importOriginal => ({ ...await importOriginal<typeof import('./workspaceFiles')>(), verifySourceOriginal: vi.fn() }));
const verify = vi.mocked(verifySourceOriginal);
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let notices: { message: string; tone: string }[];
const listener = (event: Event) => notices.push((event as CustomEvent).detail);
function makeProject(): Project {
  const p = freshState().projects[0];
  p.goals = []; p.activeGoalId = undefined;
  p.sources = [p.sources[0]];
  Object.assign(p.sources[0], { approved: true, status: 'Analyzed', sha256: 'checked-hash', relativePath: 'synthetic.txt' });
  return p;
}
function Harness() {
  const [project, setProject] = useState(makeProject);
  const [visible, setVisible] = useState(true);
  return <><button onClick={() => setProject(current => { const next = structuredClone(current); next.sources[0].sha256 = 'new-hash'; return next; })}>Change source</button>
    <output aria-label="goal count">{project.goals.length}</output>
    <output aria-label="source pin">{project.goals[0]?.sourceRevisionPins?.[project.sources[0].id] ?? ''}</output>
    {visible && <ProjectKickoff project={project} onCancel={() => setVisible(false)} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} />}
  </>;
}
async function render() { notices = []; window.addEventListener('ba-mate-notice', listener); container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => { root.render(<Harness />); }); }
function button(text: string) { return [...container.querySelectorAll('button')].find(item => item.textContent?.includes(text))!; }
function count() { return container.querySelector('[aria-label="goal count"]')?.textContent; }
async function selectSource() { await act(async () => { container.querySelector<HTMLInputElement>('.kickoff-source-option input')!.click(); }); }
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); window.removeEventListener('ba-mate-notice', listener); verify.mockReset(); });

describe('starting a project goal', () => {
  it('keeps explicitly entered goal details visible when the goal type changes', async () => {
    await render();
    const description = container.querySelector<HTMLTextAreaElement>('.kickoff-goal-details textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(description, 'Earlier goal description');
      description.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { button('Improve existing SRS').click(); });
    expect(description.value).toBe('Earlier goal description');
    expect(description.placeholder).toContain('Review available documentation');
    expect(count()).toBe('0');
  });
  it('selects and clears reviewed sources without starting a goal', async () => {
    await render();
    await act(async () => { button('Select all reviewed').click(); });
    expect(container.querySelector<HTMLInputElement>('.kickoff-source-option input')!.checked).toBe(true);
    expect(count()).toBe('0'); expect(verify).not.toHaveBeenCalled();
    await act(async () => { button('Clear selection').click(); });
    expect(container.querySelector<HTMLInputElement>('.kickoff-source-option input')!.checked).toBe(false);
  });
  it('starts one goal from a single click without selected sources', async () => {
    await render();
    await act(async () => { button('Start this goal').click(); });
    expect(count()).toBe('1'); expect(verify).not.toHaveBeenCalled();
  });
  it('ignores repeated clicks while the source check is pending', async () => {
    let resolve!: () => void;
    verify.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    await render(); await selectSource();
    await act(async () => { const start = button('Start this goal'); start.click(); start.click(); });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(container.querySelector<HTMLInputElement>('.kickoff-source-option input')?.disabled).toBe(true);
    await act(async () => { resolve(); });
    expect(count()).toBe('1');
    expect(container.querySelector('[aria-label="source pin"]')?.textContent).toBe('checked-hash');
  });
  it('does not create a goal with a source revision that changed during verification', async () => {
    let resolve!: () => void;
    verify.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    await render(); await selectSource();
    await act(async () => { button('Start this goal').click(); });
    await act(async () => { button('Change source').click(); });
    await act(async () => { resolve(); });
    expect(count()).toBe('0');
    expect(notices.at(-1)).toMatchObject({ tone: 'warning', message: expect.stringContaining('selected source changed') });
  });
  it('cancels goal creation while sources are being checked', async () => {
    let resolve!: () => void;
    verify.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    await render(); await selectSource();
    await act(async () => { button('Start this goal').click(); });
    await act(async () => { button('Cancel').click(); });
    await act(async () => { resolve(); });
    expect(count()).toBe('0');
    expect(container.querySelector('[aria-label="Create a project goal"]')).toBeNull();
  });
  it('does not create a goal when the original cannot be verified', async () => {
    verify.mockRejectedValue(new Error('Synthetic source changed on disk.'));
    await render(); await selectSource();
    await act(async () => { button('Start this goal').click(); });
    expect(count()).toBe('0');
    expect(notices.at(-1)).toMatchObject({ tone: 'warning', message: expect.stringContaining('changed on disk') });
    expect(container.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain('changed on disk');
  });
});
