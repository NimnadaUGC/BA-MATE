// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { SourcesView } from './App';
import { freshState } from './store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });
it('selects the cited source and does not silently substitute a missing one', async () => {
  const project = freshState().projects[0];
  const second = { ...structuredClone(project.sources[0]), id: 'SRC-SECOND', name: 'Second source' };
  project.sources.push(second);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter initialEntries={['/sources?artifact=SRC-SECOND']}><SourcesView project={project} update={() => {}} /></MemoryRouter>); });
  expect(container.querySelector('.source-detail h2')?.textContent).toBe('Second source');
  await act(async () => { root.unmount(); }); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter initialEntries={['/sources?artifact=SRC-MISSING']}><SourcesView project={project} update={() => {}} /></MemoryRouter>); });
  expect(container.textContent).toContain('SRC-MISSING is no longer available');
  expect(container.querySelector('.source-detail')).toBeNull();
});
