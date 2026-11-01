// @vitest-environment jsdom
import { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDialogAccessibility } from './ui';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, host: HTMLDivElement;
beforeEach(()=>{
  vi.spyOn(HTMLElement.prototype,'getClientRects').mockImplementation(()=>[{width:100,height:40}] as unknown as DOMRectList);
  vi.spyOn(window,'requestAnimationFrame').mockImplementation(callback=>{callback(0);return 1;});
  vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();});
function Dialog({close,children}:{close:()=>void;children:React.ReactNode}){
  const ref=useRef<HTMLDivElement>(null);useDialogAccessibility(ref,close);
  return <div ref={ref} role="dialog">{children}</div>;
}
function press(key:string,shiftKey=false){document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key,shiftKey,bubbles:true,cancelable:true}));}
it('closes only the upper dialog with Escape and restores focus to its opener',async()=>{
  function Harness(){const [parent,setParent]=useState(true),[child,setChild]=useState(false);return parent?<Dialog close={()=>setParent(false)}><button onClick={()=>setChild(true)}>Open child</button>{child&&<Dialog close={()=>setChild(false)}><button>Child action</button></Dialog>}</Dialog>:<p>Closed parent</p>;}
  await act(async()=>root.render(<Harness/>));
  const opener=host.querySelector('button')!;opener.focus();await act(async()=>opener.click());
  expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(2);
  await act(async()=>press('Escape'));
  expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(1);expect(document.activeElement).toBe(opener);
  await act(async()=>press('Escape'));expect(host.textContent).toContain('Closed parent');
});
it('wraps focus through disclosures while excluding controls in closed details',async()=>{
  await act(async()=>root.render(<Dialog close={()=>{}}><button>First</button><details><summary>Advanced</summary><button>Hidden option</button></details></Dialog>));
  const first=host.querySelector('button')!,summary=host.querySelector('summary')!;
  summary.focus();await act(async()=>press('Tab'));expect(document.activeElement).toBe(first);
  await act(async()=>press('Tab',true));expect(document.activeElement).toBe(summary);
});
it('recaptures keyboard focus that has moved outside an open dialog',async()=>{
  await act(async()=>root.render(<><button>Outside</button><Dialog close={()=>{}}><button>Inside</button></Dialog></>));
  const buttons=host.querySelectorAll('button');buttons[0].focus();await act(async()=>press('Tab'));expect(document.activeElement).toBe(buttons[1]);
});
