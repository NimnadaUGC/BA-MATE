// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { ConnectedDiagrams } from './connected';
import { freshState } from './store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });
it('opens diagram comments without adding a note and supports review of authored comments', async () => {
  function Harness() {
    const [project, setProject] = useState(() => freshState().projects[0]);
    return <MemoryRouter><ConnectedDiagrams project={project} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} /></MemoryRouter>;
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<Harness />); });
  const button = (text: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === text)!;
  await act(async () => { button('Comments (0)').click(); });
  expect(container.textContent).toContain('No comments yet.');
  expect(button('Add comment').disabled).toBe(true);
  const input = container.querySelector<HTMLTextAreaElement>('#diagram-comments textarea')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Review the exception path'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => { button('Add comment').click(); });
  expect(container.textContent).toContain('Review the exception path');
  await act(async () => { button('Mark resolved').click(); });
  expect(button('Reopen')).toBeTruthy();
});


it('keeps embedding above focus mode and dismisses one dialog at a time', async()=>{
  const project=freshState().projects[0];container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<MemoryRouter><ConnectedDiagrams project={project} update={()=>{}} /></MemoryRouter>));
  await act(async()=>{container.querySelector<HTMLButtonElement>('[aria-label="Open diagram focus mode"]')!.click();});
  expect(container.querySelector('[aria-label="Diagram focus view"]')?.textContent).toContain('Exit focus');
  await act(async()=>{[...container.querySelectorAll('button')].find(button=>button.textContent?.includes('Add to document'))!.click();});
  expect(container.querySelector('[aria-label="Add diagram to a working document"]')).toBeTruthy();
  await act(async()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});
  expect(container.querySelector('[aria-label="Add diagram to a working document"]')).toBeNull();expect(container.querySelector('[aria-label="Diagram focus view"]')).toBeTruthy();
  await act(async()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});
  expect(container.querySelector('[aria-label="Diagram focus view"]')).toBeNull();
});
