// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { ChangesView } from './App';
import { freshState } from './store';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });

it('opens earlier change requests and identifies affected artifacts by name', async () => {
  function Harness() {
    const [project, setProject] = useState(() => {
      const p = freshState().projects[0];
      p.changes = [
        { id: 'CR-new', title: 'New change', rationale: 'New reason', source: 'BA', status: 'Proposed', impacts: [] },
        { id: 'CR-old', title: 'Earlier change', rationale: 'Earlier reason', source: 'BA', status: 'Impact review', impacts: [] },
      ];
      return p;
    });
    return <ChangesView project={project} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} />;
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><Harness /></MemoryRouter>); });
  const picker = container.querySelector<HTMLSelectElement>('.change-picker select')!;
  expect(container.textContent).toContain('New reason');
  await act(async () => { picker.value = 'CR-old'; picker.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(container.textContent).toContain('Earlier reason');
  expect(container.textContent).not.toContain('New reason');
  const artifactPicker = [...container.querySelectorAll('select')].find(select => select.parentElement?.textContent?.includes('Add affected artifact'))!;
  expect(artifactPicker.options[0].textContent).toContain(freshState().projects[0].requirements[0].title);
});

it('opens a change request identified in a link', async () => {
  const project = freshState().projects[0];
  project.changes = [
    { id: 'CR-new', title: 'New change', rationale: 'New reason', source: 'BA', status: 'Proposed', impacts: [] },
    { id: 'CR-old', title: 'Earlier change', rationale: 'Earlier reason', source: 'BA', status: 'Impact review', impacts: [] },
  ];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter initialEntries={['/changes?artifact=CR-old']}><ChangesView project={project} update={() => {}} /></MemoryRouter>); });
  expect(container.textContent).toContain('Earlier reason');
  expect(container.textContent).not.toContain('New reason');
});

it('reports a rejected acceptance when content changes before the update is applied', async () => {
  const notices: { title?: string; tone?: string }[] = [];
  const listener = (event: Event) => notices.push((event as CustomEvent).detail);
  window.addEventListener('ba-mate-notice', listener);
  function Harness() {
    const [project, setProject] = useState(() => {
      const p = freshState().projects[0];
      const item = p.requirements[0];
      p.changes = [{ id: 'CR-race', title: 'Change', rationale: 'Reason', source: 'BA', status: 'Impact review', impacts: [], patches: [{ id: 'CP-race', artifactId: item.id, artifactType: 'Requirement', field: 'statement', before: item.statement, after: 'A proposed replacement', sourceRevision: item.version, selected: true, status: 'Proposed' }] }];
      return p;
    });
    return <ChangesView project={project} update={fn => setProject(current => { const next = structuredClone(current); next.requirements[0].version++; fn(next); return next; })} />;
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><Harness /></MemoryRouter>); });
  const button = [...container.querySelectorAll('button')].find(item => item.textContent?.includes('Accept selected patches'))!;
  await act(async () => { button.click(); });
  expect(notices.some(notice => notice.title === 'Patches approved')).toBe(false);
  expect(notices.some(notice => notice.title === 'Change needs review' && notice.tone === 'warning')).toBe(true);
  window.removeEventListener('ba-mate-notice', listener);
});

it('confirms acceptance and implementation only after the corresponding state changes', async () => {
  const notices: { title?: string; tone?: string }[] = [];
  const listener = (event: Event) => notices.push((event as CustomEvent).detail);
  window.addEventListener('ba-mate-notice', listener);
  function Harness() {
    const [project, setProject] = useState(() => {
      const p = freshState().projects[0];
      const item = p.requirements[0];
      p.versions = [{ id: 'baseline', label: 'Approved baseline', version: 'B1', at: 'now', actor: 'BA', type: 'Baseline', locked: true, changes: '' }];
      p.changes = [{ id: 'CR-positive', title: 'Change', rationale: 'Reason', source: 'BA', baselineId: 'baseline', status: 'Impact review', impacts: [], patches: [{ id: 'CP-positive', artifactId: item.id, artifactType: 'Requirement', field: 'statement', before: item.statement, after: 'A revised statement', sourceRevision: item.version, selected: true, status: 'Proposed' }] }];
      return p;
    });
    return <><output aria-label="statement">{project.requirements[0].statement}</output><ChangesView project={project} update={fn => setProject(current => { const next = structuredClone(current); fn(next); return next; })} /></>;
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<MemoryRouter><Harness /></MemoryRouter>); });
  const button = (label: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.includes(label))!;
  await act(async () => { button('Accept selected patches').click(); });
  expect(notices.some(notice => notice.title === 'Patches approved' && notice.tone === 'success')).toBe(true);
  await act(async () => { button('Implement accepted patches').click(); });
  expect(container.querySelector('[aria-label="statement"]')?.textContent).toBe('A revised statement');
  expect(notices.some(notice => notice.title === 'Change request applied' && notice.tone === 'success')).toBe(true);
  window.removeEventListener('ba-mate-notice', listener);
});

it('lets an analyst add requirement criteria and choose the exact document block', async () => {
  let current=freshState().projects[0];
  function Harness(){const [project,set]=useState(()=>{const p=freshState().projects[0],r=p.requirements[0],d=p.documents[0];d.sections[0].blocks=[{id:'unrelated',type:'paragraph',content:'Preserve unrelated text',linkedIds:[]},{id:'target',type:'paragraph',content:'Old maximum 500',linkedIds:[r.id]}];p.changes=[{id:'CR-fields',title:'Change',rationale:'Test',source:'BA',status:'Impact review',impacts:[{id:r.id,type:'Requirement',reason:'Rule change',selected:true},{id:d.id,type:'Document',reason:'Update exact block',selected:true}],patches:[{id:'doc-patch',artifactId:d.id,artifactType:'Document',field:'content',targetId:'unrelated',before:'Preserve unrelated text',after:'Pending edit',sourceRevision:d.version,selected:true,status:'Proposed'}]}];return p;});current=project;return <MemoryRouter><ChangesView project={project} update={fn=>set(previous=>{const next=structuredClone(previous);fn(next);return next;})}/></MemoryRouter>;}
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<Harness/>));
  await act(async()=>[...container.querySelectorAll('button')].find(item=>item.textContent==='Draft acceptance criteria patch')!.click());
  const criteria=current.changes[0].patches!.find(patch=>patch.field==='criteria')!;
  expect(criteria.before).toBe(current.requirements[0].fitCriteria.join('\n'));
  expect(criteria.sourceRevision).toBe(current.requirements[0].version);
  const select=container.querySelector<HTMLSelectElement>('[aria-label="Target block for doc-patch"]')!;
  await act(async()=>{select.value='target';select.dispatchEvent(new Event('change',{bubbles:true}));});
  const patch=current.changes[0].patches!.find(patch=>patch.id==='doc-patch')!;
  expect(patch.targetId).toBe('target');expect(patch.before).toBe('Old maximum 500');expect(patch.after).toBe('Old maximum 500');
  expect(current.documents[0].sections[0].blocks[0].content).toBe('Preserve unrelated text');
});
