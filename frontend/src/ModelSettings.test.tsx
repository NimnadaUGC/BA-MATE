// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelSettings } from './ModelSettings';
import { api } from './api';
vi.mock('./api', () => ({ api: vi.fn() }));
const request = vi.mocked(api);
const settings = { provider: 'ollama', model: 'saved-model', base_url: 'http://localhost', timeout_seconds: 180, context_tokens: 8192, output_tokens: 2048, temperature: .2 };
const report = { at: '2026-01-01T00:00:00Z', profile: { provider: 'ollama', model: 'saved-model', context_tokens: 8192, output_tokens: 2048 }, qualified_for_pilot: false, structured_tasks_passed: true, results: [{ task: 'clarify', status: 'passed', latency_ms: 10, synthetic_proposal: { summary: 'Synthetic response to review' }, human_corrections: null, human_reviewed: false }], known_limits: [] };
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); request.mockReset(); });
async function render() { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => { root.render(<ModelSettings />); }); }
function button(label: string) { return [...container.querySelectorAll('button')].find(item => item.textContent?.includes(label))!; }
describe('AI settings review safeguards', () => {
  it('does not expose default settings while the saved configuration is loading', async () => {
    let resolveSettings!: (value: unknown) => void;
    request.mockImplementation(path => path === '/api/settings' ? new Promise(resolve => { resolveSettings = resolve; }) : Promise.resolve({ report: null }));
    await render();
    expect(container.textContent).toContain('Loading saved AI settings');
    expect(button('Save settings')).toBeUndefined();
    await act(async () => { resolveSettings(settings); });
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('saved-model');
    expect(button('Save settings').disabled).toBe(false);
  });
  it('shows the proposal and requires an explicit correction count before approval', async () => {
    request.mockImplementation(path => Promise.resolve(path === '/api/settings' ? settings : { report }));
    await render();
    expect(container.textContent).toContain('Synthetic response to review');
    const count = container.querySelector('input[placeholder="Enter a count"]') as HTMLInputElement;
    const approve = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(count.value).toBe('');
    expect(approve.disabled).toBe(true);
    expect(button('Save human review').disabled).toBe(true);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(count, '0'); count.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(approve.disabled).toBe(false);
    expect(button('Save human review').disabled).toBe(false);
  });
  it('does not offer a save action when loading settings fails', async () => {
    request.mockImplementation(path => path === '/api/settings' ? Promise.reject(new Error('offline')) : Promise.resolve({ report: null }));
    await render();
    expect(container.textContent).toContain('Could not load the saved AI settings');
    expect(button('Save settings')).toBeUndefined();
    expect(button('Try loading again')).toBeTruthy();
  });
  it('requires saving edited settings before qualifying the profile', async () => {
    request.mockImplementation(path => Promise.resolve(path === '/api/settings' ? settings : { report: null }));
    await render();
    expect(button('Run synthetic qualification').disabled).toBe(false);
    const model = container.querySelector('input') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(model, 'another-model');
      model.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(button('Run synthetic qualification').disabled).toBe(true);
    expect(container.textContent).toContain('Save the connection settings before running qualification');
    expect(container.textContent).toContain('Connection changes are not saved');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await act(async () => { button('Discard changes').click(); });
    expect(model.value).toBe('saved-model');
    expect(button('Run synthetic qualification').disabled).toBe(false);
    const cleanUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);
  });
  it('does not treat legacy default counts as a new review', async () => {
    const old = { ...report, qualified_for_pilot: true, results: [{ ...report.results[0], human_reviewed: true, human_corrections: 0 }] };
    request.mockImplementation(path => Promise.resolve(path === '/api/settings' ? settings : { report: old }));
    await render();
    expect((container.querySelector('input[placeholder="Enter a count"]') as HTMLInputElement).value).toBe('');
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).disabled).toBe(true);
    expect(container.textContent).toContain('Earlier reviews may have recorded default correction counts');
  });
  it('saves only explicitly entered counts for partial reviews', async () => {
    const partial = { ...report, results: [...report.results, { ...report.results[0], task: 'document' }] };
    request.mockImplementation(path => Promise.resolve(path === '/api/settings' ? settings : { report: partial }));
    await render();
    const count = container.querySelector('input[placeholder="Enter a count"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(count, '0');
      count.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).disabled).toBe(true);
    await act(async () => { button('Save human review').click(); });
    const review = request.mock.calls.find(([path]) => path === '/api/settings/qualification/review');
    expect(JSON.parse(String(review?.[1]?.body))).toEqual({ reviews: [{ task: 'clarify', correction_count: 0 }], approved_for_pilot: false });
  });
});
