import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { api, type ProviderSettings } from './api';
type ModelLimits = { provider: string; model: string; status: string; context_tokens: number | null; output_tokens: number | null; note: string };
const initial: ProviderSettings = { provider: 'ollama', model: 'qwen3:8b', base_url: 'http://127.0.0.1:11434', timeout_seconds: 180, context_tokens: 8192, output_tokens: 2048, temperature: .2 };
type Qualification = { at: string; profile: { provider: string; model: string; context_tokens: number; output_tokens: number }; qualified_for_pilot: boolean; structured_tasks_passed: boolean; results: { task: string; status: string; latency_ms: number; error_category?: string; message?: string; synthetic_proposal?: unknown; human_corrections: number | null; human_reviewed: boolean; review_flow_version?: number }[]; known_limits: string[] };
function reviewableReport(report: Qualification | null): Qualification | null {
  return report && { ...report, results: report.results.map(item => item.human_reviewed && item.review_flow_version !== 1 ? { ...item, human_corrections: null } : item) };
}
const taskInstructions: Record<string, string> = {
  clarify: 'Identify one material gap in the synthetic leave-request rule.',
  requirements: 'Draft one requirement with testable criteria from the supplied rule.',
  validate: 'Identify one ambiguity or verification concern in the supplied rule.',
  diagram: 'Draft one Mermaid flowchart for the supplied leave-request rule.',
  document: 'Draft one concise SRS section from the supplied rule.',
  impact: 'Assess a change from 48 hours to 72 hours for the supplied rule.',
};
function ProposalValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) return <ul>{value.map((item, index) => <li key={index}><ProposalValue value={item} /></li>)}</ul>;
  if (value && typeof value === 'object') return <dl>{Object.entries(value).map(([key, item]) => <div key={key}><dt>{key.replace(/_/g, ' ')}</dt><dd><ProposalValue value={item} /></dd></div>)}</dl>;
  return <span>{value == null ? 'Not provided' : String(value)}</span>;
}
export function validCorrectionCount(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0 && value <= 10000;
}
function comparableSettings(config: ProviderSettings) {
  const { api_key: _key, has_key: _hasKey, key_storage: _storage, ...settings } = config;
  return JSON.stringify(settings);
}
const providerDetails: Record<ProviderSettings['provider'], { label: string; modelPlaceholder: string; keyHelp?: string }> = {
  ollama: { label: 'Local or organisation Ollama', modelPlaceholder: 'For example: qwen3:8b' },
  openai: { label: 'OpenAI (direct API key)', modelPlaceholder: 'Enter an OpenAI API model identifier', keyHelp: 'Use an OpenAI Platform project API key. A ChatGPT subscription or sign-in is not an API key.' },
  gemini: { label: 'Google Gemini (direct API key)', modelPlaceholder: 'Enter a Gemini API model identifier', keyHelp: 'Use a Gemini API key created in Google AI Studio or the associated Google Cloud project.' },
  openrouter: { label: 'OpenRouter', modelPlaceholder: 'Enter an OpenRouter model identifier', keyHelp: 'Use an OpenRouter API key; native OpenAI and Gemini keys do not work here.' },
  huggingface: { label: 'Hugging Face Inference Providers', modelPlaceholder: 'Enter a Hugging Face model identifier', keyHelp: 'Use a Hugging Face access token with permission for Inference Providers.' },
};
export function ModelSettings() {
  const [config, setConfig] = useState(initial);
  const [savedSettings, setSavedSettings] = useState('');
  const [savedConfig, setSavedConfig] = useState<ProviderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [qualification, setQualification] = useState<Qualification | null>(null);
  const [approveProfile, setApproveProfile] = useState(false);
  const [limits, setLimits] = useState<ModelLimits | null>(null);
  const [checkingLimits, setCheckingLimits] = useState(false);
  const [limitRefresh, setLimitRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    setLimits(null);
    setCheckingLimits(false);
    if (loading || loadError || config.provider !== 'openrouter' || !config.model.trim()) return;
    setCheckingLimits(true);
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ provider: config.provider, model: config.model, refresh: String(limitRefresh > 0) });
      api<ModelLimits>(`/api/settings/capabilities?${query}`).then(value => { if (current) setLimits(value); })
        .catch(() => { if (current) setLimits({ provider: config.provider, model: config.model, status: 'unavailable', context_tokens: null, output_tokens: null, note: 'Could not discover model limits. Retry or use manual limits.' }); })
        .finally(() => { if (current) setCheckingLimits(false); });
    }, 400);
    return () => { current = false; clearTimeout(timer); };
  }, [config.provider, config.model, limitRefresh, loading, loadError]);
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
    let current = true;
    setLoading(true); setLoadError('');
    api<ProviderSettings>('/api/settings').then(value => { if (current) { setConfig(value); setSavedConfig(value); setSavedSettings(comparableSettings(value)); } })
      .catch(() => { if (current) setLoadError('Could not load the saved AI settings. Check that BA Mate is running, then try again.'); })
      .finally(() => { if (current) setLoading(false); });
    api<{ report: Qualification | null }>('/api/settings/qualification').then(result => { if (current) setQualification(reviewableReport(result.report)); }).catch(() => undefined);
    return () => { current = false; };
  }, [loadAttempt]);
  const save = async (test: boolean) => {
    setBusy(true); setMessage(''); setError('');
    try {
      const saved = await api<ProviderSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(config) });
      setConfig({ ...saved, api_key: '' });
      setSavedConfig({ ...saved, api_key: '' });
      setSavedSettings(comparableSettings(saved));
      if (test) {
        const result = await api<{ model: string; message: string }>('/api/settings/test', { method: 'POST' });
        setMessage(`Connected to ${result.model}. ${result.message}`);
      } else setMessage('Connection settings saved. Project content is sent only when you start an AI task.');
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const clearCredential = async () => {
    setBusy(true); setMessage(''); setError('');
    try { const saved = await api<ProviderSettings>('/api/settings/credential', { method: 'DELETE' }); setConfig({ ...saved, api_key: '' }); setSavedConfig({ ...saved, api_key: '' }); setSavedSettings(comparableSettings(saved)); setMessage('The key entered for this session was removed. Environment-managed keys are outside BA Mate and may still be available.'); }
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
    try { const result = await api<{ report: Qualification }>('/api/settings/qualification/review', { method: 'POST', body: JSON.stringify({ reviews: qualification.results.filter(item => item.status === 'passed' && item.synthetic_proposal != null && validCorrectionCount(item.human_corrections)).map(item => ({ task: item.task, correction_count: item.human_corrections })), approved_for_pilot: approveProfile }) }); setQualification(reviewableReport(result.report)); setMessage(result.report.qualified_for_pilot ? 'Human review was recorded and this profile is marked suitable for the pilot protocol.' : 'Human review was recorded. This profile remains unqualified until every task is reviewed and a BA explicitly approves it.'); }
    catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const settingsChanged = !loading && !loadError && (!!config.api_key || comparableSettings(config) !== savedSettings);
  useEffect(() => {
    if (!settingsChanged) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [settingsChanged]);
  if (loading || loadError) return <section className="card model-setup" aria-labelledby="model-settings-title"><h2 id="model-settings-title">AI connection</h2>{loading ? <p role="status">Loading saved AI settings…</p> : <div role="alert"><p>{loadError}</p><button className="button secondary" onClick={() => setLoadAttempt(value => value + 1)}>Try loading again</button></div>}</section>;
  const canApproveReview = !!qualification && qualification.results.length > 0 && qualification.results.every(item => item.status === 'passed' && item.synthetic_proposal != null && validCorrectionCount(item.human_corrections));
  const canSaveReview = !!qualification && qualification.results.some(item => item.status === 'passed' && item.synthetic_proposal != null && validCorrectionCount(item.human_corrections));
  return <section className="card model-setup" aria-labelledby="model-settings-title">
    <header className="model-setup__header">
      <div>
        <h2 id="model-settings-title">AI connection</h2>
        <p>Choose where BA Mate runs AI tasks. Project files remain in your workspace until you deliberately run a task.</p>
      </div>
    </header>
    <div className="model-setup__fields">
    <label>Provider<select value={config.provider} onChange={e => { const provider = e.target.value as ProviderSettings['provider']; setConfig({ ...config, provider, model: provider === 'ollama' ? 'qwen3:8b' : '', api_key: '', has_key: false, context_mode: provider === 'openrouter' ? 'model' : 'manual', output_tokens: provider === 'openrouter' ? 16384 : 2048 }); }}>
      {(Object.keys(providerDetails) as ProviderSettings['provider'][]).map(provider => <option key={provider} value={provider}>{providerDetails[provider].label}</option>)}
    </select></label>
    <label>Model identifier<input value={config.model} placeholder={providerDetails[config.provider].modelPlaceholder} onChange={e => setConfig({ ...config, model: e.target.value })} /></label>
    {config.provider === 'ollama' ? <><label>Ollama address<input value={config.base_url} onChange={e => setConfig({ ...config, base_url: e.target.value })} /></label><p className="field-help">Start Ollama and download the selected model first. For Qwen3 8B: <code>ollama pull qwen3:8b</code>. Local hardware must support the selected model and context size.</p></> : <><label>{providerDetails[config.provider].label} key<input type="password" autoComplete="off" value={config.api_key ?? ''} placeholder={config.has_key ? 'Key is available; leave blank to keep it' : 'Paste this provider’s API key'} onChange={e => setConfig({ ...config, api_key: e.target.value })} /></label><p className="field-help">{providerDetails[config.provider].keyHelp} Keys entered here stay only in the local service’s memory until it closes. They are excluded from settings files, project backups and research exports.</p>{config.has_key && <><button className="button secondary" onClick={() => void clearCredential()} disabled={busy || settingsChanged}>Remove session key</button>{settingsChanged && <p className="field-help">Save or discard connection changes before removing the session key.</p>}</>}</>}
    </div>
    {config.provider === 'openrouter' && <p className="field-help" role="status">{checkingLimits ? 'Checking published model limits…' : limits?.context_tokens ? `Model capacity: ${limits.context_tokens.toLocaleString()} context tokens${limits.output_tokens ? ` · up to ${limits.output_tokens.toLocaleString()} output tokens` : ''}${limits.status === 'cached' ? ' (cached)' : ''}. ${config.context_mode === 'model' ? 'Using the model’s full context capacity.' : 'Using your manual context budget.'}` : limits?.note ?? 'Enter a model identifier to discover its capacity.'}</p>}
    <details className="model-limits"><summary>Advanced model limits</summary>
    {config.provider === 'openrouter' && <><label>Context budget<select value={config.context_mode ?? 'manual'} onChange={event => setConfig({ ...config, context_mode: event.target.value as 'manual' | 'model' })}><option value="model">Use full model context capacity</option><option value="manual">Set a smaller manual budget</option></select></label><button type="button" className="button secondary" disabled={checkingLimits} onClick={() => setLimitRefresh(value => value + 1)}>Refresh model limits</button></>}
    <div className="model-limit-grid">
      <label>Context capacity (tokens)<input type="number" min="2048" step="1" max={limits?.context_tokens ?? undefined} disabled={config.provider === 'openrouter' && config.context_mode === 'model'} value={config.provider === 'openrouter' && config.context_mode === 'model' ? limits?.context_tokens ?? config.context_tokens : config.context_tokens} onChange={event => setConfig({ ...config, context_tokens: Number(event.target.value) })} /></label>
      <label>Maximum output (tokens)<input type="number" min="256" step="1" max={limits?.output_tokens ?? undefined} value={config.output_tokens} onChange={event => setConfig({ ...config, output_tokens: Number(event.target.value) })} /></label>
      <label>Timeout (seconds)<input type="number" min="10" max="600" step="1" value={config.timeout_seconds} onChange={event => setConfig({ ...config, timeout_seconds: Number(event.target.value) })} /></label>
    </div><p className="field-help">Output space is reserved inside the context window and may also cover model reasoning. Larger allowances do not generate extra text by themselves. Input counts are estimates; actual provider usage is recorded after a successful request. {limits?.note}</p></details>
    <div className="model-setup__actions"><button className="button primary" disabled={busy || !config.model} onClick={() => void save(true)}>{busy ? 'Checking connection…' : 'Save and test connection'}</button><button className="button secondary" disabled={busy || !config.model} onClick={() => void save(false)}>Save settings</button><button className="button secondary" disabled={busy || !config.model || settingsChanged} onClick={() => void qualify()}>Run synthetic qualification</button></div>
    {settingsChanged && <div className="model-unsaved" role="status"><span>Connection changes are not saved. They stay here while you navigate this workspace. Save the connection settings before running qualification; the test uses the saved profile.</span><button type="button" className="button secondary" disabled={busy} onClick={() => { if (savedConfig) setConfig({ ...savedConfig, api_key: '' }); setMessage(''); setError(''); }}>Discard changes</button></div>}
    <aside className="qualification-note"><strong>About qualification</strong><p>Uses a fixed synthetic leave-request case—never project content. It checks supported tasks, latency and structured output. Passing confirms compatibility, not model quality or equivalence.</p></aside>
    {qualification && <details className="qualification-results" open><summary>Latest qualification · {qualification.profile.provider} / {qualification.profile.model} · {qualification.qualified_for_pilot ? 'Previously marked approved for pilot' : qualification.structured_tasks_passed ? 'Human review required' : 'Not qualified'}</summary><p>Completed {new Date(qualification.at).toLocaleString()} · context {qualification.profile.context_tokens} · output {qualification.profile.output_tokens}</p>{qualification.results.some(item => item.human_reviewed && item.review_flow_version !== 1) && <p>Earlier reviews may have recorded default correction counts without displaying proposals. Revisit the proposals and record a fresh review before relying on this approval.</p>}<p>Synthetic case: Employees submit leave requests for manager approval. A confirmed policy decision says pending requests expire after 48 hours. Compare each response with its task and record the number of corrections needed; enter 0 explicitly if none are needed.</p><ul>{qualification.results.map(result => <li key={result.task}><b>{result.task}</b>: {result.status} · {(result.latency_ms / 1000).toFixed(1)} seconds{result.error_category ? ` · ${result.error_category}` : ''}{result.message ? ` — ${result.message}` : ''}<p>{taskInstructions[result.task]}</p>{result.synthetic_proposal != null ? <details><summary>View synthetic proposal</summary><ProposalValue value={result.synthetic_proposal} /></details> : <p>No proposal is available to review. Run qualification again to capture one.</p>}<label> Human corrections<input type="number" min="0" max="10000" step="1" disabled={busy || result.status !== 'passed' || result.synthetic_proposal == null} value={result.human_corrections ?? ''} placeholder="Enter a count" onChange={event => { const value = event.target.value === '' ? null : Number(event.target.value); setApproveProfile(false); setQualification(current => current ? { ...current, results: current.results.map(item => item.task === result.task ? { ...item, human_corrections: value } : item) } : current); }} /></label>{result.human_reviewed && <small>Previously recorded</small>}</li>)}</ul><label className="review-approval"><input type="checkbox" checked={approveProfile && canApproveReview} onChange={event => setApproveProfile(event.target.checked)} disabled={busy || !canApproveReview} /> <span>I reviewed every synthetic proposal and approve this exact profile for the pilot protocol.</span></label>{!canApproveReview && <p>To approve, review every passing proposal and enter a valid correction count for each task.</p>}<button className="button secondary" disabled={busy || !canSaveReview} onClick={() => void saveReview()}>Save human review</button><ul>{qualification.known_limits.map(limit => <li key={limit}>{limit}</li>)}</ul></details>}
    {message && <div role="status" className="model-setup__status success"><CheckCircle2 /><span><strong>Connection updated</strong><small>{message}</small></span></div>}
    {error && <div role="alert" className="model-setup__status error"><AlertTriangle /><span><strong>AI connection unavailable</strong><small>{error}</small></span><button className="button secondary" disabled={busy || !config.model} onClick={() => void save(true)}><RefreshCw /> Try again</button></div>}
  </section>;
}
