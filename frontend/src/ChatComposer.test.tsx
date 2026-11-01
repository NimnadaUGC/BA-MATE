// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { MentionTextarea } from './ChatComposer';
import type { ArtifactReference } from './types';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });
const refs: ArtifactReference[] = [{id:'FR-01', type:'Requirement', label:'Checkout requirements'}, {id:'FR-02', type:'Requirement', label:'Checkout confirmation'}];
async function mount() {
  const send = vi.fn(), attach = vi.fn();
  function Harness() { const [value, change] = useState(''); return <MentionTextarea value={value} onChange={change} references={refs} onAttach={attach} onSend={send} />; }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<Harness />));
  return {send, attach, input: container.querySelector('textarea')!};
}
async function fill(input: HTMLTextAreaElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', {bubbles:true})); }); }
async function key(input: HTMLTextAreaElement, key: string) { await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles:true, cancelable:true})); }); }
it('selects mentions by name with arrows and Enter without sending the message', async () => {
  const {input, send, attach} = await mount();
  await fill(input, 'Explain @Checkout');
  expect(container.querySelectorAll('[role="option"]')).toHaveLength(2);
  await key(input, 'ArrowDown'); await key(input, 'Enter');
  expect(attach).toHaveBeenCalledWith(refs[1]);
  expect(input.value).toBe('Explain @FR-02 ');
  expect(send).not.toHaveBeenCalled();
  await key(input, 'Enter'); expect(send).toHaveBeenCalledTimes(1);
});
it('replaces a mention at the caret while preserving the rest of the message', async () => {
  const {input, attach} = await mount();
  await fill(input, 'Explain @Checkout requirements before approval');
  await act(async () => { input.setSelectionRange('Explain @Checkout requirements'.length, 'Explain @Checkout requirements'.length); input.dispatchEvent(new MouseEvent('click', {bubbles:true})); });
  await key(input, 'Tab');
  expect(attach).toHaveBeenCalledWith(refs[0]);
  expect(input.value).toBe('Explain @FR-01  before approval');
});
it('dismisses with Escape and does not send an unmatched mention on the first Enter', async () => {
  const {input, send} = await mount();
  await fill(input, '@no-match'); await key(input, 'Enter');
  expect(send).not.toHaveBeenCalled();
  expect(input.getAttribute('aria-expanded')).toBe('false');
  await fill(input, '@Checkout'); await key(input, 'Escape');
  expect(container.querySelector('[role="listbox"]')).toBeNull();
  expect(input.value).toBe('@Checkout');
});
it('keeps Shift+Enter and IME confirmation from sending', async () => {
  const {input, send} = await mount();
  await fill(input, 'Draft');
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', shiftKey:true, bubbles:true})));
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', isComposing:true, bubbles:true})));
  expect(send).not.toHaveBeenCalled();
});

it('does not reopen suggestions for an already completed identifier when the caret returns', async () => {
  const {input, send} = await mount();
  await fill(input, 'Explain @FR-01 ');
  await act(async () => input.dispatchEvent(new MouseEvent('click', {bubbles:true})));
  expect(container.querySelector('[role="listbox"]')).toBeNull();
  await key(input, 'Enter'); expect(send).toHaveBeenCalledOnce();
});
