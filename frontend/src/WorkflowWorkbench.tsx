import { DiagramPreview } from "./DiagramPreview";
import { useEvaluation } from "./EvaluationContext";
import { useEffect, useRef, useState } from 'react';
import type { Project } from './types';
import { api } from './api';
import { projectEvidence } from './modelGateway';
import { applyProposal, evidenceFingerprint, type Proposal, type RunMetadata, type SavedRun, type TaskKind } from './workflow';
import { addAudit, blockers } from './store';
import { notify } from './ui';
const tasks: Record<TaskKind, { label: string; prompt: string }> = {
  clarify: { label: 'Find gaps and ask questions', prompt: 'Identify the most consequential missing facts or conflicts. Ask up to five targeted questions. Do not repeat questions already answered.' },
  requirements: { label: 'Draft requirements and user stories', prompt: 'Draft up to three requirements and related user stories from reviewed evidence and clarification answers. Include acceptance criteria and disclose assumptions. If essential information is missing, ask questions instead.' },
  validate: { label: 'Review quality and evidence', prompt: 'Review current requirements for ambiguity, consistency, testability, unsupported assumptions, stakeholder omissions and traceability. Return actionable findings supported by evidence, not generic checklist reminders.' },
  diagram: { label: 'Draft a process diagram', prompt: 'Create one Mermaid flowchart grounded in the reviewed requirements and business rules. Explain any unresolved assumptions.' },
  document: { label: 'Draft document sections', prompt: 'Draft concise SRS sections from the reviewed requirements. Identify gaps instead of inventing details. Cite evidence identifiers.' },
  impact: { label: 'Assess a proposed change', prompt: 'Assess the change described below against current evidence and artifacts. Identify affected requirement IDs, conflicting rules and necessary revalidation.' },
};
const emptyProposal: Proposal = { summary: '', questions: [], requirements: [], stories: [], findings: [], diagrams: [], sections: [], limitations: [] };
const failureCategory = (error: unknown): NonNullable<SavedRun['failure']>['category'] => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('abort')) return 'cancelled';
  if (message.includes('too long') || message.includes('timeout')) return 'timeout';
  if (message.includes('key') || message.includes('credential')) return 'credentials';
  if (message.includes('quota') || message.includes('busy')) return 'quota';
  if (message.includes('schema') || message.includes('format') || message.includes('unreadable')) return 'schema';
  if (message.includes('cannot reach') || message.includes('unavailable') || message.includes('connection')) return 'unavailable';
  return 'unknown';
};
function ProposalRecord({ proposal }: { proposal: Proposal }) {
  return <div className="proposal-record"><p>{proposal.summary}</p>
    {proposal.questions.map((q, i) => <p key={`q${i}`}><b>Question:</b> {q.question} <small>({q.source_ids.join(', ')})</small></p>)}
    {proposal.requirements.map((r, i) => <div key={`r${i}`}><b>{r.title}</b><p>{r.statement}</p><ul>{r.acceptance_criteria.map((c, n) => <li key={n}>{c}</li>)}</ul><small>Evidence: {r.source_ids.join(', ')}</small></div>)}
    {proposal.stories.map((r, i) => <p key={`s${i}`}>As a {r.role}, I want {r.goal}, so that {r.value}. <small>Evidence: {r.source_ids.join(', ')}</small></p>)}
    {proposal.findings.map((r, i) => <p key={`f${i}`}><b>{r.title}:</b> {r.explanation}</p>)}
    {proposal.diagrams.map((r, i) => <details key={`d${i}`}><summary>{r.name} — saved diagram code</summary><pre>{r.source}</pre><small>Evidence: {r.source_ids.join(', ')}</small></details>)}
    {proposal.sections.map((r, i) => <div key={`c${i}`}><b>{r.title}</b><p>{r.content}</p></div>)}
    {!!proposal.limitations.length && <ul>{proposal.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>}
  </div>;
}
export function WorkflowWorkbench({ project, update, initialTask = 'clarify' }: { project: Project; update: (fn: (p: Project) => void) => void; initialTask?: TaskKind }) {
  const evaluation = useEvaluation();
  const [task, setTask] = useState<TaskKind>(initialTask);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [condition, setCondition] = useState<'Generic AI' | 'Proposed workflow'>('Proposed workflow');
  const [selected, setSelected] = useState<string[]>([]);
  const controller = useRef<AbortController | undefined>(undefined);
  const mounted = useRef(true);
  const pending = [...(project.aiRuns ?? [])].reverse().find(r => r.status === 'pending' && r.goalId === project.activeGoalId);
  const [edited, setEdited] = useState<Proposal | null>(null);
  useEffect(() => { setEdited(pending ? structuredClone(pending.proposal) : null); setSelected([]); }, [pending?.id]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, [project.id, project.activeGoalId]);
  const run = async () => {
    if (evaluation?.condition === 'Manual') return;
    setError(''); setBusy(true);
    const started = Date.now();
    const runId = crypto.randomUUID();
    const goalId = project.activeGoalId;
    const fingerprint = evidenceFingerprint(project);
    const requestController = new AbortController();
    controller.current = requestController;
    try {
      const context = projectEvidence(project);
      const response = await api<{ metadata: RunMetadata; result: { proposal: Proposal; context_receipt: SavedRun['receipt'] } }>('/api/v1/workflow/run', { method: 'POST', signal: requestController.signal, body: JSON.stringify({ request_id: runId, expected_configuration: evaluation?.connectionSignature, project_id: project.id, goal_id: goalId, task, prompt: `${(evaluation?.condition ?? condition) === 'Generic AI' ? `Please help with this BA task: ${tasks[task].label}.` : tasks[task].prompt}\n${instruction}`, context, condition: evaluation?.condition ?? condition, cloud_allowed: project.cloudAllowed ?? false }) });
      // Validate Mermaid using the actual renderer before offering it as a change.
      let validationError: string | undefined;
      if (response.result.proposal.diagrams.length) {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
        try { for (const d of response.result.proposal.diagrams) await mermaid.parse(d.source); }
        catch { validationError = "The model did not return a valid Mermaid diagram. This attempt was retained in history; no draft was added. Try a simpler diagram or another model."; }
      }
      const saved: SavedRun = { id: response.metadata.request_id, at: new Date().toISOString(), goalId, evaluationRunId: evaluation?.id, status: validationError ? 'rejected' : 'pending', validationError, fingerprint, proposal: response.result.proposal, metadata: response.metadata, receipt: response.result.context_receipt };
      if (!mounted.current || requestController.signal.aborted) return;
      update(p => {
        p.aiRuns ??= [];
        if (p.activeGoalId !== goalId || evidenceFingerprint(p) !== fingerprint) {
          p.aiRuns.push({ ...saved, status: 'rejected', failure: { category: 'stale', message: 'The context changed while the model was running; this response was retained but cannot be applied.', at: new Date().toISOString() } });
          addAudit(p, 'Retained stale AI response', saved.id, 'No project artifact was changed.');
          return;
        }
        p.aiRuns.push(saved); addAudit(p, 'Generated AI proposal', saved.id, `${task}; ${saved.metadata.model}; ${validationError ?? "awaiting human review"}.`);
      });
      if (validationError) throw new Error(validationError);
      window.dispatchEvent(new CustomEvent('ba-mate-research-event', { detail: { type: 'assistant-request', projectId: project.id, goalId: project.activeGoalId, runId: evaluation?.id ?? null, stage: project.goals.find(g => g.id === project.activeGoalId)?.gate ?? project.gate, section: 'workflow-workbench', successful: true, durationMs: Date.now() - started } }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The model request failed.';
      if (mounted.current) {
        const category = failureCategory(e);
        update(p => {
          if (p.activeGoalId !== goalId) return;
          p.aiRuns ??= [];
          p.aiRuns.push({ id: runId, at: new Date().toISOString(), goalId, evaluationRunId: evaluation?.id, status: category === 'cancelled' ? 'cancelled' : 'failed', fingerprint, proposal: emptyProposal, metadata: { request_id: runId, provider: 'unavailable', model: 'unavailable', framework_version: 'unavailable', prompt_version: 'unavailable', condition: evaluation?.condition ?? condition, task, elapsed_ms: Date.now() - started, usage: { input_tokens: null, output_tokens: null, cost: null }, temperature: 0, context_tokens: 0, output_tokens: 0, retries: 0, context_hash: '' }, receipt: { included_reference_ids: [], omitted_reference_ids: [], partial_reference_ids: [], context_hash: '' }, failure: { category, message, at: new Date().toISOString() } });
          addAudit(p, category === 'cancelled' ? 'Cancelled AI request' : 'AI request failed', runId, `${category}: ${message}`);
        });
        setError(category === 'cancelled' ? 'The model request was cancelled. Your BA work is unchanged; you can continue manually or retry once the connection is ready.' : message);
      }
      window.dispatchEvent(new CustomEvent('ba-mate-research-event', { detail: { type: 'assistant-request', projectId: project.id, goalId: project.activeGoalId, runId: evaluation?.id ?? null, stage: project.goals.find(g => g.id === project.activeGoalId)?.gate ?? project.gate, section: 'workflow-workbench', successful: false, durationMs: Date.now() - started } }));
    } finally { if (controller.current === requestController) controller.current = undefined; if (mounted.current) setBusy(false); }
  };
  const apply = async () => {
    if (!pending || !edited) return;
    try {
      if (edited.diagrams.length) {
        const mermaid = (await import('mermaid')).default;
        for (const d of edited.diagrams) await mermaid.parse(d.source);
      }
      // Validate against a copy before entering a React state updater.
      applyProposal(structuredClone(project), pending.id, selected, edited);
      update(p => applyProposal(p, pending.id, selected, edited));
      notify('Selected items added as working drafts. Review their evidence links before approval.', 'success');
    } catch (e) { setError((e as Error).message); }
  };
  const toggle = (key: string) => setSelected(current => current.includes(key) ? current.filter(x => x !== key) : [...current, key]);
  const edit = (group: keyof Proposal, index: number, key: string, value: string) => setEdited(current => {
    if (!current) return current;
    const copy = structuredClone(current);
    const item = (copy[group] as unknown as Record<string, unknown>[])[index];
    item[key] = Array.isArray(item[key]) ? value.split('\n').filter(Boolean) : value;
    return copy;
  });
  return <section className="card workflow-workbench" aria-labelledby="workbench-title">
    <header><div><span className="eyebrow">Evidence → proposal → BA review</span><h2 id="workbench-title">Work with BA Mate</h2></div><a href="/settings">AI connection settings</a></header>
    <p>Run one focused task, inspect its evidence, and choose what to add. Accepted suggestions become drafts; approval remains a separate decision.</p>
    <div className="workbench-controls"><label>Task<select value={task} onChange={e => setTask(e.target.value as TaskKind)}>{Object.entries(tasks).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}</select></label>
    <label>Additional instructions<textarea value={instruction} onChange={e => setInstruction(e.target.value)} placeholder={task === 'impact' ? 'Describe the change to assess…' : 'Optional: explain the specific outcome you need…'} /></label></div>
    <label className="workbench-check"><input type="checkbox" checked={project.cloudAllowed ?? false} disabled={project.sources.some(s => s.classification === 'Confidential')} onChange={e => update(p => { p.cloudAllowed = e.target.checked; addAudit(p, 'Changed processing preference', p.id, p.cloudAllowed ? 'External model processing enabled for non-confidential project context.' : 'Local model processing only.'); })} />Allow this project’s non-confidential context to be sent to the configured external model service</label>
    <details><summary>Comparison mode and included evidence</summary><label>AI comparison condition<select disabled={!!evaluation} value={evaluation?.condition === "Manual" ? condition : evaluation?.condition ?? condition} onChange={e => setCondition(e.target.value as typeof condition)}><option>Proposed workflow</option><option>Generic AI</option></select></label><p>Generic AI uses a simple task instruction with the same available evidence and output format. Manual comparison tasks should be completed without running AI. Only reviewed sources explicitly selected for this goal are included; an empty source selection means no source is sent.</p><ul>{projectEvidence(project).map(e => <li key={e.id}>{e.id} v{e.version ?? 1} · {e.provenance} · {e.content.length.toLocaleString()} characters{e.confidential ? ' · local processing only' : ''}</li>)}</ul></details>
    {blockers(project, project.activeGoalId) > 0 && <p className="context-note">There are unresolved blockers. You can investigate them here; final approval stays blocked.</p>}
    <button className="primary-button" disabled={evaluation?.condition === "Manual" || busy || !!pending || !project.activeGoalId || (task === 'impact' && !instruction.trim())} onClick={() => void run()}>{busy ? 'Preparing a proposal…' : 'Run selected task'}</button>
    {busy && <><p role="status">Waiting for the model. Local models may take several minutes. Your existing artifacts are unchanged.</p><button onClick={() => controller.current?.abort()}>Cancel request</button></>}
    {evaluation && <p className="context-note">Evaluation {evaluation.caseId} · {evaluation.condition}{evaluation.condition === "Manual" ? " — AI is disabled for this run." : " — the comparison condition is fixed for this run."}</p>}
    {error && <div role="alert" className="form-error recovery-actions"><p>{error}</p><a href="/settings">Check AI connection settings</a><span>Or continue editing sources, questions and artifacts manually; existing work is unchanged.</span></div>}
    {pending && edited && <div className="proposal-review"><h3>Review the proposal</h3><p>{edited.summary}</p><p className="muted">{pending.metadata.model} · {pending.metadata.condition} · {(pending.metadata.elapsed_ms / 1000).toFixed(1)} seconds</p>
      {project.clarifications.some(q => q.status === 'Answered' && q.answer?.trim()) && <aside className="context-note"><strong>Check against recorded answers</strong>{project.clarifications.filter(q => q.status === 'Answered' && q.answer?.trim()).map(q => <p key={q.id}><b>{q.id}</b>: {q.answer}</p>)}<p>Check the business rule, actor and exceptions as well as any numbers. A valid format or source identifier does not prove the draft is correct.</p></aside>}
      {(pending.receipt.omitted_reference_ids.length > 0 || pending.receipt.partial_reference_ids.length > 0) && <p className="context-note warning">Not fully included: {[...pending.receipt.omitted_reference_ids, ...pending.receipt.partial_reference_ids].join(', ')}. Review whether essential context is missing.</p>}
      {(['questions', 'requirements', 'stories', 'findings', 'diagrams', 'sections'] as const).map(group => edited[group].map((item, index) => {
        const key = `${group}:${index}`;
        const values = item as unknown as Record<string, unknown>;
        return <article className="proposal-item" key={key}><label className="workbench-check"><input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} /><strong>{({ questions: 'Clarification', requirements: 'Requirement', stories: 'User story', findings: 'Finding', diagrams: 'Diagram', sections: 'Document section' })[group]} {index + 1}</strong></label>
          {Object.entries(values).filter(([field]) => !['source_ids', 'kind', 'priority', 'severity'].includes(field)).map(([field, value]) => <label key={field}>{field === 'source' ? 'Diagram code (Mermaid)' : field.replaceAll('_', ' ')}<textarea rows={field === 'source' ? 8 : 2} value={Array.isArray(value) ? value.join('\n') : String(value)} onChange={e => edit(group, index, field, e.target.value)} /></label>)}
          {group === 'diagrams' && <DiagramPreview source={String(values.source)} />}
          <label>Evidence identifiers (one per line)<textarea rows={2} value={(values.source_ids as string[]).join('\n')} onChange={e => edit(group, index, 'source_ids', e.target.value)} /></label><small>Use supplied evidence only: {pending.receipt.included_reference_ids.join(', ')}. Verify that it supports this item.</small>
        </article>;
      }))}
      {!!edited.limitations.length && <ul>{edited.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      <div className="workbench-actions"><button className="primary-button" disabled={!selected.length} onClick={() => void apply()}>Add {selected.length || 'selected'} items as drafts</button><button onClick={() => { update(p => { const r = p.aiRuns?.find(x => x.id === pending.id); if (r) { r.status = 'rejected'; r.reviewedAt = new Date().toISOString(); } addAudit(p, 'Rejected AI proposal', pending.id, 'Original proposal retained for review.'); }); setError(''); }}>Reject proposal</button></div>
    </div>}
    {!!project.aiRuns?.length && <details><summary>Previous AI tasks ({project.aiRuns.length})</summary>{[...project.aiRuns].reverse().map(r => <details className="saved-run-review" key={r.id}><summary>{new Date(r.at).toLocaleString()} · {r.metadata.task} · {r.metadata.model} · {r.status}</summary>
        <p>{r.metadata.condition} · {r.metadata.prompt_version} · {(r.metadata.elapsed_ms / 1000).toFixed(1)} seconds · {r.selected?.length ?? 0} selected items</p>
        {r.validationError && <p role="note">{r.validationError}</p>}
        <details><summary>Original model proposal</summary><ProposalRecord proposal={r.proposal} /></details>
        {r.reviewedProposal && <details><summary>BA-reviewed proposal</summary><p>Accepted selections: {r.selected?.join(', ')}. Unselected items in this review were not added.</p><ProposalRecord proposal={r.reviewedProposal} /></details>}
      </details>)}</details>}
  </section>;
}
