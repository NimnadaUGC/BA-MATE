// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectedDiagrams, diagramPdfHeading } from './connected';
import { freshState } from './store';

vi.mock('mermaid', () => ({ default: { initialize: () => {}, parse: async () => true, render: async () => ({ svg: '<svg></svg>' }) } }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function Harness() {
  const [project, setProject] = useState(() => { const project = freshState().projects[0]; project.diagrams.push({ ...structuredClone(project.diagrams[0]), id: 'DGM-OTHER', name: 'Other diagram', source: 'flowchart TD\nZ[Other]' }); return project; });
  return <MemoryRouter><button onClick={() => setProject(current => { const next = structuredClone(current); next.diagrams[0].version++; next.diagrams[0].source = 'flowchart TD\nA[Changed saved version]'; return next; })}>Change saved diagram</button><ConnectedDiagrams project={project} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} /></MemoryRouter>;
}
function button(name: string) { return [...host.querySelectorAll('button')].find(item => item.textContent?.trim() === name)!; }
afterEach(() => { if (root) act(() => root.unmount()); host?.remove(); sessionStorage.clear(); });

describe('diagram export and approval safety', () => {
  it('does not create a new version when the diagram has no source changes', async () => {
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => { root.render(<Harness />); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 320)); });
    expect(button('Save version').disabled).toBe(true);
  });
  it('requires the edited source to be saved before approval or export', async () => {
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => { root.render(<Harness />); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 320)); });
    expect(button('SVG').disabled).toBe(false);
    const input = host.querySelector('textarea')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'flowchart TD\nA[Edited]'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    for (const name of ['Mermaid', 'SVG', 'PNG', 'PDF', 'Approve']) expect(button(name).disabled).toBe(true);
    expect(host.textContent).toContain('Save a valid diagram version before approval or export.');
    expect(host.textContent).toContain('Saved version:');
  });
  it('uses the recorded diagram status in the PDF heading', () => {
    const diagram = freshState().projects[0].diagrams[0];
    diagram.approvalStatus = 'Draft';
    expect(diagramPdfHeading(diagram)).toContain('Draft');
    expect(diagramPdfHeading(diagram)).not.toContain('approved');
    diagram.approvalStatus = 'Approved';
    expect(diagramPdfHeading(diagram)).toContain('Approved');
  });
  it('retains an unsaved edit while switching between diagrams', async () => {
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => { root.render(<Harness />); });
    const firstName = freshState().projects[0].diagrams[0].name;
    const input = host.querySelector('textarea')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'flowchart TD\nA[Unsaved]'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { [...host.querySelectorAll('button')].find(item => item.textContent?.includes('Other diagram'))!.click(); });
    expect(host.querySelector('textarea')?.value).toContain('Z[Other]');
    expect([...host.querySelectorAll('button')].find(item => item.textContent?.includes(firstName))?.textContent).toContain('Unsaved edit');
    await act(async () => { [...host.querySelectorAll('button')].find(item => item.textContent?.includes(firstName))!.click(); });
    expect(host.querySelector('textarea')?.value).toContain('A[Unsaved]');
    expect(button('PDF').disabled).toBe(true);
  });
  it('recovers an unsaved edit after leaving and reopening the studio in the same tab', async () => {
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => { root.render(<Harness />); });
    const input = host.querySelector('textarea')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'flowchart TD\nA[Recovered]'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { root.unmount(); }); root = createRoot(host);
    await act(async () => { root.render(<Harness />); });
    expect(host.querySelector('textarea')?.value).toContain('A[Recovered]');
    expect(button('PDF').disabled).toBe(true);
    await act(async () => { button('Discard unsaved edit').click(); });
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('The saved diagram and its linked records will not change.');
    await act(async () => { button('Discard edit').click(); });
    expect(host.querySelector('textarea')?.value).toBe(freshState().projects[0].diagrams[0].source);
    await act(async () => { root.unmount(); }); root = createRoot(host);
    await act(async () => { root.render(<Harness />); });
    expect(host.querySelector('textarea')?.value).toBe(freshState().projects[0].diagrams[0].source);
  });
  it('does not automatically apply an edit based on a different saved revision', async () => {
    const project = freshState().projects[0], diagram = project.diagrams[0];
    sessionStorage.setItem(`ba-mate-diagram-drafts:${project.id}`, JSON.stringify({ [diagram.id]: { source: 'flowchart TD\nA[Old edit]', baseSource: 'different source', baseVersion: 1 } }));
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => { root.render(<Harness />); });
    expect(host.querySelector('textarea')?.value).toBe(diagram.source);
    expect(host.textContent).toContain('based on a different saved version');
    await act(async () => { button('Restore edit to editor').click(); });
    expect(host.querySelector('textarea')?.value).toContain('A[Old edit]');
    expect(button('PDF').disabled).toBe(true);
  });
  it('warns when a temporary recovery copy cannot be stored', async () => {
    const failing = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage unavailable'); });
    try {
      host = document.createElement('div'); document.body.append(host); root = createRoot(host);
      await act(async () => { root.render(<Harness />); });
      const input = host.querySelector('textarea')!;
      await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'flowchart TD\nA[At risk]'); input.dispatchEvent(new Event('input', { bubbles: true })); });
      expect(host.querySelector('[role="alert"]')?.textContent).toContain('could not be stored');
    } finally { failing.mockRestore(); }
  });
  it('blocks saving an edit when its saved base changes while the editor is open', async () => {
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => { root.render(<Harness />); });
    const input = host.querySelector('textarea')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'flowchart TD\nA[My edit]'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 320)); });
    expect(button('Save version').disabled).toBe(false);
    await act(async () => { button('Change saved diagram').click(); });
    expect(button('Save version').disabled).toBe(true);
    expect(host.textContent).toContain('Changed saved version');
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'flowchart TD\nA[My edited edit]'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 320)); });
    expect(button('Save version').disabled).toBe(true);
    await act(async () => { button('Use edit against current version').click(); });
    expect(button('Save version').disabled).toBe(false);
  });
});
