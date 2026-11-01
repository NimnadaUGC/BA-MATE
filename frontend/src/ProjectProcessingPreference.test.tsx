// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { freshState } from './store';
import { ProjectProcessingPreference } from './ProjectProcessingPreference';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
afterEach(() => { if(root) act(()=>root.unmount()); container?.remove(); });
it('records project permission and blocks external processing for confidential sources', async () => {
  const initial=freshState().projects[0]; initial.cloudAllowed=false; initial.sources.forEach(source=>source.classification='Project only');
  let current=initial;
  function Harness(){ const [project,set]=useState(initial); current=project; return <><button onClick={()=>set(previous=>{const next=structuredClone(previous);next.sources[0].classification='Confidential';next.cloudAllowed=false;return next;})}>Classify confidential</button><ProjectProcessingPreference project={project} update={fn=>set(previous=>{const next=structuredClone(previous);fn(next);return next;})}/></>; }
  container=document.createElement('div'); document.body.append(container); root=createRoot(container);
  await act(async()=>root.render(<Harness/>));
  await act(async()=>container.querySelector('input')!.click());
  expect(current.cloudAllowed).toBe(true);
  expect(current.audit[0]?.action).toBe('Changed processing preference');
  await act(async()=>container.querySelector('button')!.click());
  expect(container.querySelector('input')?.disabled).toBe(true);
  expect(current.cloudAllowed).toBe(false);
  expect(container.textContent).toContain('Use a local model');
});
