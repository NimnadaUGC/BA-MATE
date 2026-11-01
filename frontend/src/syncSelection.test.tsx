// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { SyncReview } from './connected';
import { freshState } from './store';
import type { DocumentSyncProposal } from './types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });

it('selects and clears proposed updates without applying or closing the review', async () => {
  const close = vi.fn();
  const proposal: DocumentSyncProposal = {
    id: 'test-sync', mode: 'new-srs', status: 'pending', createdAt: 'now',
    changes: ['FR-1', 'FR-2'].map((artifactId, index) => ({
      id: `change-${index}`, artifactId, action: 'add', sectionTitle: 'Requirements',
      before: '', after: `Proposed ${index}`, accepted: true, provenance: [], sourceRevision: 1,
    })),
  };
  function Harness() {
    const [project, setProject] = useState(() => {
      const p = freshState().projects[0]; p.documentSyncProposals = [proposal]; return p;
    });
    return <><output aria-label="document count">{project.documents.length}</output><SyncReview project={project} proposal={project.documentSyncProposals[0]} onClose={close} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} /></>;
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<Harness />));
  const count = container.querySelector('[aria-label="document count"]')!.textContent;
  const button = (text: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.includes(text))!;
  await act(async () => { button('Clear selection').click(); });
  expect(container.textContent).toContain('0 of 2 selected');
  expect(button('Apply selected updates').disabled).toBe(true);
  await act(async () => { button('Select all updates').click(); });
  expect(container.textContent).toContain('2 of 2 selected');
  expect([...container.querySelectorAll<HTMLInputElement>('.sync-changes input')].every(input => input.checked)).toBe(true);
  expect(container.querySelector('[aria-label="document count"]')!.textContent).toBe(count);
  expect(close).not.toHaveBeenCalled();
});

it('adds a dedicated block without overwriting a manually linked paragraph', async () => {
  const close = vi.fn();
  function Harness() {
    const [project, setProject] = useState(() => {
      const p = freshState().projects[0];
      const requirement = p.requirements[0]; requirement.status = 'approved';
      const document = p.documents[0]; const section = document.sections[0];
      section.blocks = [{ id: 'manual', type: 'paragraph', content: 'Keep the original paragraph', linkedIds: [requirement.id] }];
      p.documentSyncProposals = [{ id: 'safe-sync', mode: 'update-srs', status: 'pending', createdAt: 'now', targetDocumentId: document.id, targetDocumentRevision: document.version,
        changes: [{ id: 'change', artifactId: requirement.id, action: 'add', sectionTitle: section.title, targetSectionId: section.id, before: '', after: 'New controlled content', accepted: true, provenance: [], sourceRevision: requirement.version }] }];
      return p;
    });
    const proposal = project.documentSyncProposals[0];
    return <><output aria-label="document blocks">{JSON.stringify(project.documents[0].sections[0].blocks)}</output><output aria-label="receipt">{JSON.stringify(project.documents[0].receipts[0])}</output><SyncReview project={project} proposal={proposal} onClose={close} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} /></>;
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<Harness />));
  await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Apply selected updates'))!.click(); });
  const blocks = JSON.parse(container.querySelector('[aria-label="document blocks"]')!.textContent!);
  expect(blocks[0].content).toBe('Keep the original paragraph');
  expect(blocks[1]).toMatchObject({ content: 'New controlled content', syncArtifactId: 'FR-01', linkedIds: ['FR-01'] });
  const receipt = JSON.parse(container.querySelector('[aria-label="receipt"]')!.textContent!);
  expect(receipt.acceptedBlockIds).toEqual([blocks[1].id]);
  expect(close).toHaveBeenCalledTimes(1);
});
