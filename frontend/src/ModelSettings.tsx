import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { api, type ProviderSettings } from './api';
const initial: ProviderSettings = { provider: 'ollama', model: 'qwen3:8b', base_url: 'http://127.0.0.1:11434', timeout_seconds: 180, context_tokens: 8192, output_tokens: 2048, temperature: .2 };
type Qualification = { at: string; profile: { provider: string; model: string; context_tokens: number; output_tokens: number }; qualified_for_pilot: boolean; structured_tasks_passed: boolean; results: { task: string; status: string; latency_ms: number; error_category?: string; message?: string; human_corrections: number | null; human_reviewed: boolean }[]; known_limits: string[] };
const providerDetails: Record<ProviderSettings['provider'], { label: string; modelPlaceholder: string; keyHelp?: string }> = {
  ollama: { label: 'Local or organisation Ollama', modelPlaceholder: 'For example: qwen3:8b' },
  openai: { label: 'OpenAI (direct API key)', modelPlaceholder: 'Enter an OpenAI API model identifier', keyHelp: 'Use an OpenAI Platform project API key. A ChatGPT subscription or sign-in is not an API key.' },
  gemini: { label: 'Google Gemini (direct API key)', modelPlaceholder: 'Enter a Gemini API model identifier', keyHelp: 'Use a Gemini API key created in Google AI Studio or the associated Google Cloud project.' },
  openrouter: { label: 'OpenRouter', modelPlaceholder: 'Enter an OpenRouter model identifier', keyHelp: 'Use an OpenRouter API key; native OpenAI and Gemini keys do not work here.' },
  huggingface: { label: 'Hugging Face Inference Providers', modelPlaceholder: 'Enter a Hugging Face model identifier', keyHelp: 'Use a Hugging Face access token with permission for Inference Providers.' },
};
export function ModelSettings() {
  const [config, setConfig] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [qualification, setQualification] = useState<Qualification | null>(null);
  const [approveProfile, setApproveProfile] = useState(false);
  const friendlyError = (reason: unknown) => {
    const detail = reason instanceof Error ? reason.message : String(reason);
    if (/failed to fetch|network|connection/i.test(detail)) {
      return config.provider === 'ollama'
        ? `BA Mate could not reach Ollama at ${config.base_url}. Start Ollama, confirm the address, then try the connection again.`
        : `BA Mate could not reach the selected AI provider. Check the connection and provider details, then try again.`;
    }
    return detail;
  };
  useEffect(() => {
    api<ProviderSettings>('/api/settings').then(setConfig).catch(e => setError(friendlyError(e)));
    api<{ report: Qualification | null }>('/api/settings/qualification').then(result => setQualification(result.report)).catch(() => undefined);
  }, []);
  const save = async (test: boolean) => {
    setBusy(true); setMessage(''); setError('');
    try {
      const saved = await api<ProviderSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(config) });
      setConfig({ ...saved, api_key: '' });
      if (test) {
        const result = await api<{ model: string; message: string }>('/api/settings/test', { method: 'POST' });
        setMessage(`Connected to ${result.model}. ${result.message}`);
      } else setMessage('Connection settings saved. Project content is sent only when you start an AI task.');
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const clearCredential = async () => {
    setBusy(true); setMessage(''); setError('');
    try { const saved = await api<ProviderSettings>('/api/settings/credential', { method: 'DELETE' }); setConfig({ ...saved, api_key: '' }); setMessage('The key entered for this session was removed. Environment-managed keys are outside BA Mate and may still be available.'); }
    catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const qualify = async () => {
    setBusy(true); setMessage(''); setError('');
    try { const result = await api<{ report: Qualification }>('/api/settings/qualification', { method: 'POST' }); setQualification(result.report); setApproveProfile(false); setMessage(result.report.structured_tasks_passed ? 'Every supported task returned a valid synthetic structured proposal. Record a human correction count for each task before deciding whether this profile can enter a pilot.' : 'The qualification suite found failures. This profile is not qualified for a pilot; manual BA work remains available.'); }
    catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const saveReview = async () => {
    if (!qualification) return;
    setBusy(true); setMessage(''); setError('');
    try { const result = await api<{ report: Qualification }>('/api/settings/qualification/review', { method: 'POST', body: JSON.stringify({ reviews: qualification.results.map(item => ({ task: item.task, correction_count: item.human_corrections ?? 0 })), approved_for_pilot: approveProfile }) }); setQualification(result.report); setMessage(result.report.qualified_for_pilot ? 'Human review was recorded and this profile is marked suitable for the pilot protocol.' : 'Human review was recorded. This profile remains unqualified until every task is reviewed and a BA explicitly approves it.'); }
    catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  return <section className="card model-setup" aria-labelledby="model-settings-title">
    <header className="model-setup__header">
      <div>
        <h2 id="model-settings-title">AI connection</h2>
        <p>Choose where BA Mate runs AI tasks. Project files remain in your workspace until you deliberately run a task.</p>
      </div>
    </header>
    <div className="model-setup__fields">
    <label>Provider<select value={config.provider} onChange={e => { const provider = e.target.value as ProviderSettings['provider']; setConfig({ ...config, provider, model: provider === 'ollama' ? 'qwen3:8b' : '', api_key: '', has_key: false }); }}>
      {(Object.keys(providerDetails) as ProviderSettings['provider'][]).map(provider => <option key={provider} value={provider}>{providerDetails[provider].label}</option>)}
    </select></label>
    <label>Model identifier<input value={config.model} placeholder={providerDetails[config.provider].modelPlaceholder} onChange={e => setConfig({ ...config, model: e.target.value })} /></label>
    {config.provider === 'ollama' ? <><label>Ollama address<input value={config.base_url} onChange={e => setConfig({ ...config, base_url: e.target.value })} /></label><p className="field-help">Start Ollama and download the selected model first. For Qwen3 8B: <code>ollama pull qwen3:8b</code>. Local hardware must support the selected model and context size.</p></> : <><label>{providerDetails[config.provider].label} key<input type="password" autoComplete="off" value={config.api_key ?? ''} placeholder={config.has_key ? 'Key is available; leave blank to keep it' : 'Paste this provider’s API key'} onChange={e => setConfig({ ...config, api_key: e.target.value })} /></label><p className="field-help">{providerDetails[config.provider].keyHelp} Keys entered here stay only in the local service’s memory until it closes. They are excluded from settings files, project backups and research exports.</p>{config.has_key && <button className="button secondary" onClick={() => void clearCredential()} disabled={busy}>Remove session key</button>}</>}
    </div>
    <details className="model-limits"><summary>Advanced model limits</summary><div className="model-limit-grid">
      {(['context_tokens', 'output_tokens', 'timeout_seconds'] as const).map(key => <label key={key}>{({ context_tokens: 'Context capacity (tokens)', output_tokens: 'Maximum output (tokens)', timeout_seconds: 'Timeout (seconds)' })[key]}<input type="number" value={config[key]} onChange={e => setConfig({ ...config, [key]: Number(e.target.value) })} /></label>)}
    </div></details>
    <div className="model-setup__actions"><button className="button primary" disabled={busy || !config.model} onClick={() => void save(true)}>{busy ? 'Checking connection…' : 'Save and test connection'}</button><button className="button secondary" disabled={busy || !config.model} onClick={() => void save(false)}>Save settings</button><button className="button secondary" disabled={busy || !config.model} onClick={() => void qualify()}>Run synthetic qualification</button></div>
    <aside className="qualification-note"><strong>About qualification</strong><p>Uses a fixed synthetic leave-request case—never project content. It checks supported tasks, latency and structured output. Passing confirms compatibility, not model quality or equivalence.</p></aside>
    {qualification && <details className="qualification-results" open><summary>Latest qualification · {qualification.profile.provider} / {qualification.profile.model} · {qualification.qualified_for_pilot ? 'Approved for pilot' : qualification.structured_tasks_passed ? 'Human review required' : 'Not qualified'}</summary><p>Completed {new Date(qualification.at).toLocaleString()} · context {qualification.profile.context_tokens} · output {qualification.profile.output_tokens}</p><ul>{qualification.results.map(result => <li key={result.task}><b>{result.task}</b>: {result.status} · {(result.latency_ms / 1000).toFixed(1)} seconds{result.error_category ? ` · ${result.error_category}` : ''}{result.message ? ` — ${result.message}` : ''}<label> Human corrections<input type="number" min="0" disabled={busy || result.status !== 'passed'} value={result.human_corrections ?? 0} onChange={event => setQualification(current => current ? { ...current, results: current.results.map(item => item.task === result.task ? { ...item, human_corrections: Number(event.target.value) } : item) } : current)} /></label></li>)}</ul><label className="review-approval"><input type="checkbox" checked={approveProfile} onChange={event => setApproveProfile(event.target.checked)} disabled={busy} /> <span>I reviewed every synthetic proposal and approve this exact profile for the pilot protocol.</span></label><button className="button secondary" disabled={busy || !qualification.results.every(result => result.status === 'passed')} onClick={() => void saveReview()}>Save human review</button><ul>{qualification.known_limits.map(limit => <li key={limit}>{limit}</li>)}</ul></details>}
    {message && <div role="status" className="model-setup__status success"><CheckCircle2 /><span><strong>Connection updated</strong><small>{message}</small></span></div>}
    {error && <div role="alert" className="model-setup__status error"><AlertTriangle /><span><strong>AI connection unavailable</strong><small>{error}</small></span><button className="button secondary" disabled={busy || !config.model} onClick={() => void save(true)}><RefreshCw /> Try again</button></div>}
  </section>;
}
