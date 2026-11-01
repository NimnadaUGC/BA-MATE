// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ConnectedConversations } from './connected';
import { freshState } from './store';
import { conversationDrafts } from './conversationDrafts';
import { requestModelCompletion, type ModelResponse } from './modelGateway';
import { verifyGoalSourceOriginals } from './workspaceFiles';
vi.mock('./modelGateway', async original => ({...await original<typeof import('./modelGateway')>(), requestModelCompletion: vi.fn()}));
vi.mock('./workspaceFiles', async original => ({...await original<typeof import('./workspaceFiles')>(), verifyGoalSourceOriginals: vi.fn()}));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
const complete = vi.mocked(requestModelCompletion);
let project = freshState().projects[0];
afterEach(() => { if(root) act(() => root.unmount()); container?.remove(); conversationDrafts.clear(); vi.clearAllMocks(); });
async function mount(configure?: (value: typeof project) => void) {
  vi.mocked(verifyGoalSourceOriginals).mockResolvedValue(undefined);
  const initial = freshState().projects[0]; initial.goals[0].sourceIds = []; initial.goals[0].conversationId = 'first'; initial.activeGoalId=initial.goals[0].id;
  initial.conversations = [{id:'first',title:'First chat',messages:[],context:[],updated:'now'}, {id:'second',title:'Second chat',messages:[],context:[],updated:'now'}];
  configure?.(initial);
  function Harness() { const [value, set] = useState(initial); project = value; return <MemoryRouter><ConnectedConversations project={value} update={fn => set(previous => { const next=structuredClone(previous); fn(next); return next; })} onNavigate={() => {}} /></MemoryRouter>; }
  container=document.createElement('div'); document.body.append(container); root=createRoot(container);
  await act(async () => root.render(<Harness/>));
}
async function click(text: string) { await act(async () => { [...container.querySelectorAll('button')].find(button=>button.textContent?.trim()===text)!.click(); }); }
async function fill(text: string) { await act(async () => { const input=container.querySelector('textarea')!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,text); input.dispatchEvent(new Event('input',{bubbles:true})); }); }
const response = (text: string): ModelResponse => ({text,provider:'test',receipt:{requestId:crypto.randomUUID(),provider:'test',strategy:'priority-budget-compaction',generatedAt:'',tokenBudget:8192,estimatedTokens:1,includedReferenceIds:[],omittedReferenceIds:[],governanceIncluded:true}});
it('keeps conversation history for a successful follow-up request', async () => {
  complete.mockImplementation(async () => response('First answer'));
  await mount(); await fill('First question'); await click('Send');
  await fill('Follow-up'); await click('Send');
  expect(complete.mock.calls[1][0].history).toEqual([{role:'user',content:'First question'},{role:'assistant',content:'First answer'}]);
});
it('cancels on conversation switch and discards a provider response that arrives late', async () => {
  let resolve!: (value: ModelResponse) => void;
  complete.mockImplementation(() => new Promise(done => {resolve=done;}));
  await mount(); await fill('First question'); await click('Send');
  const request=complete.mock.calls[0][0];
  await act(async () => { [...container.querySelectorAll('button')].find(button=>button.textContent?.startsWith('Second chat'))!.click(); });
  expect(request.signal?.aborted).toBe(true);
  await act(async () => {resolve(response('Late answer'));});
  expect(project.conversations[0].messages.map(message=>message.text)).toEqual(['First question']);
  expect(project.conversations[1].messages).toEqual([]);
});
it('keeps a newer draft when a request fails and offers an explicit retry without fabricated assistant messages', async () => {
  let reject!: (error: Error) => void;
  complete.mockImplementation(() => new Promise((_done,fail)=>{reject=fail;}));
  await mount(); await fill('Original question'); await click('Send'); await fill('Newer question');
  await act(async ()=>{reject(new Error('Credits exhausted'));});
  expect(container.querySelector('textarea')?.value).toBe('Newer question');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Credits exhausted');
  expect(project.conversations[0].messages).toHaveLength(1);
  expect([...container.querySelectorAll('button')].find(button=>button.textContent==='Use previous message')?.disabled).toBe(true);
  await fill(''); await click('Use previous message');
  expect(container.querySelector('textarea')?.value).toBe('Original question');
});
it('stops an active conversation request and ignores its late result', async () => {
  let resolve!: (value: ModelResponse) => void;
  complete.mockImplementation(() => new Promise(done=>{resolve=done;}));
  await mount(); await fill('Question to stop'); await click('Send'); await click('Stop');
  expect(complete.mock.calls[0][0].signal?.aborted).toBe(true);
  await act(async ()=>{resolve(response('Discard me'));});
  expect(project.conversations[0].messages).toHaveLength(1);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Request stopped');
});

it('continues a completed goal conversation with its own sources and no mutation proposal', async () => {
  complete.mockImplementation(async () => ({...response('The current confirmed limit is 300.'), actionProposal:{action_kind:'requirement-revision',target_id:project.requirements[0].id,before:project.requirements[0].statement,after:'Must not be offered',rationale:'Test',reference_ids:[]}}));
  let completedGoalId='';
  await mount(p=>{
    const goal=p.goals[0];completedGoalId=goal.id;goal.status='Completed';p.activeGoalId=undefined;
    const source=p.sources[0];source.approved=true;source.status='Analyzed';source.sha256='synthetic-source';source.relativePath='fixtures/synthetic.txt';source.content='Synthetic cash checkout source.';source.passages=[];
    goal.sourceIds=[source.id];goal.sourceRevisionPins={[source.id]:source.sha256};
    p.conversations[0].context=[{id:source.id,type:'Source',label:source.name,origin:'attached',removable:true}];
  });
  await fill('What is the confirmed limit?');await click('Send');
  expect(complete).toHaveBeenCalledOnce();
  const request=complete.mock.calls[0][0];
  expect(request.goalId).toBe(completedGoalId);expect(request.task).toBe('project-conversation');
  expect(request.context.some(item=>item.id===project.sources[0].id)).toBe(true);
  expect(project.conversations[0].messages.at(-1)?.proposal).toBeUndefined();
  expect(container.textContent).toContain('Answers only');
});
