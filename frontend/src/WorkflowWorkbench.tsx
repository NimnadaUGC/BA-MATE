import { ProjectProcessingPreference } from "./ProjectProcessingPreference";
import { similarQuestions } from "./similarQuestions";
import { storyNarrative } from "./storyNarrative";
import { DiagramPreview } from "./DiagramPreview";
import { useEvaluation } from "./EvaluationContext";
import { useEffect, useRef, useState } from 'react';
import type { Project } from './types';
import { api } from './api';
import { projectEvidence } from './modelGateway';
import { modelSourceProblems, sourceCheckFingerprint } from './sourceScope';
import { verifyGoalSourceOriginals } from './workspaceFiles';
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
const acceptanceSourceKey = sourceCheckFingerprint;
const emptyProposal: Proposal = { summary: '', questions: [], requirements: [], stories: [], findings: [], diagrams: [], sections: [], limitations: [] };
export function describeProposalSelection(proposal: Proposal, key: string): string {
  const match = /^(questions|requirements|stories|findings|diagrams|sections):(\d+)$/.exec(key);
  if (!match) return `Saved selection ${key} (details unavailable)`;
  const index = Number(match[2]);
  switch (match[1]) {
    case 'questions': return proposal.questions[index] ? `Clarification: ${proposal.questions[index].question}` : `Saved selection ${key} (details unavailable)`;
    case 'requirements': return proposal.requirements[index] ? `Requirement: ${proposal.requirements[index].title}` : `Saved selection ${key} (details unavailable)`;
    case 'stories': return proposal.stories[index] ? `User story: ${storyNarrative(proposal.stories[index])}` : `Saved selection ${key} (details unavailable)`;
    case 'findings': return proposal.findings[index] ? `Finding: ${proposal.findings[index].title}` : `Saved selection ${key} (details unavailable)`;
    case 'diagrams': return proposal.diagrams[index] ? `Diagram: ${proposal.diagrams[index].name}` : `Saved selection ${key} (details unavailable)`;
    case 'sections': return proposal.sections[index] ? `Document section: ${proposal.sections[index].title}` : `Saved selection ${key} (details unavailable)`;
    default: return `Saved selection ${key} (details unavailable)`;
  }
}
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
    {proposal.stories.map((r, i) => <p key={`s${i}`}>{storyNarrative(r)} <small>Evidence: {r.source_ids.join(', ')}</small></p>)}
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
  const [checkingAcceptance, setCheckingAcceptance] = useState(false);
  const acceptanceInFlight = useRef(false);
  const acceptanceAttempt = useRef<string | undefined>(undefined);
  const latestProject = useRef(project);
  latestProject.current = project;
  const [error, setError] = useState('');
  const [sourceError, setSourceError] = useState(false);
  const [condition, setCondition] = useState<'Generic AI' | 'Proposed workflow'>('Proposed workflow');
  const [selected, setSelected] = useState<string[]>([]);
  const controller = useRef<AbortController | undefined>(undefined);
  const activeRunId = useRef<string | undefined>(undefined);
  const cancelServerRun = () => {
    const id = activeRunId.current;
    activeRunId.current = undefined;
    if (id) void api('/api/v1/workflow/cancel', { method: 'POST', body: JSON.stringify({ request_id: id }) }).catch(() => {
      notify('The local request was stopped, but BA Mate could not confirm that the model service stopped processing it.', 'warning', 'Cancellation not confirmed');
    });
  };
  const mounted = useRef(true);
  const pending = [...(project.aiRuns ?? [])].reverse().find(r => r.status === 'pending' && r.goalId === project.activeGoalId);
  const sourceProblems = modelSourceProblems(project);
  const proposalStale = !!pending && (pending.goalId !== project.activeGoalId || pending.fingerprint !== evidenceFingerprint(project));
  useEffect(() => {
    const id = acceptanceAttempt.current;
    if (!id) return;
    acceptanceAttempt.current = undefined;
    const run = project.aiRuns?.find(item => item.id === id);
    if (run?.status === 'accepted') notify('Selected items added as working drafts. Review their evidence links before approval.', 'success');
    else { setError('The project changed before the proposal could be added. Review the current evidence and generate a fresh proposal.'); setSourceError(true); }
  }, [project]);
  const [edited, setEdited] = useState<Proposal | null>(null);
  useEffect(() => { setEdited(pending ? structuredClone(pending.proposal) : null); setSelected([]); }, [pending?.id]);
  useEffect(() => {
    mounted.current = true;
    setBusy(false);
    return () => { mounted.current = false; controller.current?.abort(); controller.current = undefined; cancelServerRun(); };
  }, [project.id, project.activeGoalId]);
  const run = async () => {
    if (evaluation?.condition === 'Manual' || controller.current) return;
    const requestController = new AbortController();
    controller.current = requestController;
    const fingerprint = evidenceFingerprint(project);
    const checkedSourceKey = sourceCheckFingerprint(project);
    setError(''); setSourceError(false); setBusy(true);
    try { await verifyGoalSourceOriginals(project); }
    catch (e) {
      if (mounted.current && controller.current === requestController) { setError(e instanceof Error ? e.message : 'The selected sources could not be checked.'); setSourceError(true); setBusy(false); controller.current = undefined; }
      return;
    }
    if (!mounted.current || requestController.signal.aborted || controller.current !== requestController) return;
    if (latestProject.current.id !== project.id || latestProject.current.activeGoalId !== project.activeGoalId || latestProject.current.cloudAllowed !== project.cloudAllowed || sourceCheckFingerprint(latestProject.current) !== checkedSourceKey || evidenceFingerprint(latestProject.current) !== fingerprint) {
      controller.current = undefined; setBusy(false); setSourceError(true);
      setError('Project context changed while sources were being checked. Review the current context and run the task again.');
      return;
    }
    const started = Date.now();
    const runId = crypto.randomUUID();
    activeRunId.current = runId;
    const goalId = project.activeGoalId;
    const recordCancellation = () => {
      if (mounted.current && latestProject.current.id === project.id && latestProject.current.activeGoalId === goalId) update(p => {
        if (p.activeGoalId !== goalId || p.aiRuns?.some(run => run.id === runId)) return;
        p.aiRuns ??= [];
        p.aiRuns.push({ id: runId, at: new Date().toISOString(), goalId, evaluationRunId: evaluation?.id, status: 'cancelled', fingerprint, proposal: emptyProposal, metadata: { request_id: runId, provider: 'unavailable', model: 'unavailable', framework_version: 'unavailable', prompt_version: 'unavailable', condition: evaluation?.condition ?? condition, task, elapsed_ms: Date.now() - started, usage: { input_tokens: null, output_tokens: null, cost: null }, temperature: 0, context_tokens: 0, output_tokens: 0, retries: 0, context_hash: '' }, receipt: { included_reference_ids: [], omitted_reference_ids: [], partial_reference_ids: [], context_hash: '' }, failure: { category: 'cancelled', message: 'The request was cancelled.', at: new Date().toISOString() } });
        addAudit(p, 'Cancelled AI request', runId, 'The model request was cancelled; no project artifact was changed.');
      });
    };
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
      if (requestController.signal.aborted) { recordCancellation(); return; }
      if (!mounted.current || controller.current !== requestController) return;
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
      if (requestController.signal.aborted) {
        recordCancellation();
        return;
      }
      if (controller.current !== requestController || !mounted.current) return;
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
    } finally { if (activeRunId.current === runId) activeRunId.current = undefined; if (controller.current === requestController) { controller.current = undefined; if (mounted.current) setBusy(false); } }
  };
  const apply = async () => {
    if (!pending || !edited || acceptanceInFlight.current) return;
    acceptanceInFlight.current = true; setCheckingAcceptance(true); setError(''); setSourceError(false);
    const selectedAtStart = [...selected], editedAtStart = structuredClone(edited), checkedSources = acceptanceSourceKey(project);
    try {
      // Validate before starting an asynchronous source check.
      applyProposal(structuredClone(project), pending.id, selectedAtStart, editedAtStart);
      if (editedAtStart.diagrams.length) {
        const mermaid = (await import('mermaid')).default;
        for (const d of editedAtStart.diagrams) await mermaid.parse(d.source);
      }
      try { await verifyGoalSourceOriginals(project); }
      catch (error) { if (mounted.current) setSourceError(true); throw error; }
      if (!mounted.current) return;
      const current = latestProject.current;
      if (current.id !== project.id || acceptanceSourceKey(current) !== checkedSources ||
          current.activeGoalId !== pending.goalId || evidenceFingerprint(current) !== pending.fingerprint ||
          !current.aiRuns?.some(run => run.id === pending.id && run.status === 'pending')) {
        setSourceError(true);
        throw new Error('The project or selected sources changed while they were checked. Review the current evidence and generate a fresh proposal.');
      }
      // The state update may run after another edit; never apply against a different context.
      acceptanceAttempt.current = pending.id;
      update(p => {
        if (p.id !== project.id || acceptanceSourceKey(p) !== checkedSources || p.activeGoalId !== pending.goalId ||
            evidenceFingerprint(p) !== pending.fingerprint || !p.aiRuns?.some(run => run.id === pending.id && run.status === 'pending')) return;
        applyProposal(p, pending.id, selectedAtStart, editedAtStart);
      });
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'The proposal could not be added.');
    } finally {
      acceptanceInFlight.current = false;
      if (mounted.current) setCheckingAcceptance(false);
    }
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
    <label>{task === 'impact' ? 'Change to assess (required)' : 'Additional instructions (optional)'}<textarea value={instruction} onChange={e => setInstruction(e.target.value)} placeholder={task === 'impact' ? 'Describe the change to assess…' : 'Explain the specific outcome you need…'} /></label></div>
    <ProjectProcessingPreference project={project} update={update} />
    <details><summary>Comparison mode and included evidence</summary><label>AI comparison condition<select disabled={!!evaluation} value={evaluation?.condition === "Manual" ? condition : evaluation?.condition ?? condition} onChange={e => setCondition(e.target.value as typeof condition)}><option>Proposed workflow</option><option>Generic AI</option></select></label><p>Generic AI uses a simple task instruction with the same available evidence and output format. Manual comparison tasks should be completed without running AI. Only reviewed sources explicitly selected for this goal are included; an empty source selection means no source is sent.</p><ul>{projectEvidence(project).map(e => <li key={e.id}>{e.id} v{e.version ?? 1} · {e.provenance} · {e.content.length.toLocaleString()} characters{e.confidential ? ' · local processing only' : ''}</li>)}</ul></details>
    {blockers(project, project.activeGoalId) > 0 && <p className="context-note">There are unresolved blockers. You can investigate them here; final approval stays blocked.</p>}
    {sourceProblems.length > 0 && <p className="context-note warning" role="status">Review and select the current revisions in Sources before running AI: {sourceProblems.join(', ')}.</p>}
    {!project.activeGoalId && <p className="context-note">Start a project goal before running an AI task.</p>}
    {pending && <p className="context-note">Review or reject the current proposal below before running another task.</p>}
    {task === 'impact' && !instruction.trim() && <p className="context-note">Describe the proposed change above to enable the impact analysis.</p>}
    <button className="primary-button" disabled={evaluation?.condition === "Manual" || busy || !!pending || !project.activeGoalId || sourceProblems.length > 0 || (task === 'impact' && !instruction.trim())} onClick={() => void run()}>{busy ? 'Preparing a proposal…' : 'Run selected task'}</button>
    {busy && <><p role="status">Checking sources or waiting for the model. Local models may take several minutes. Your existing artifacts are unchanged.</p><button onClick={() => { controller.current?.abort(); controller.current = undefined; cancelServerRun(); setBusy(false); setError('The request was cancelled. Your BA work is unchanged.'); }}>Cancel request</button></>}
    {evaluation && <p className="context-note">Evaluation {evaluation.caseId} · {evaluation.condition}{evaluation.condition === "Manual" ? " — AI is disabled for this run." : " — the comparison condition is fixed for this run."}</p>}
    {error && <div role="alert" className="form-error recovery-actions"><p>{error}</p>{sourceError ? <a href={`/projects/${project.id}/sources`}>Review sources</a> : <a href="/settings">Check AI connection settings</a>}<span>Or continue editing sources, questions and artifacts manually; existing work is unchanged.</span></div>}
    {pending && edited && <div className="proposal-review"><h3>Review the proposal</h3>{proposalStale && <p className="context-note warning" role="status">Project evidence changed since this proposal was generated. Reject this proposal to retain it in history, then run the task again with the current evidence.</p>}<p>{edited.summary}</p><p className="muted">{pending.metadata.model} · {pending.metadata.condition} · {(pending.metadata.elapsed_ms / 1000).toFixed(1)} seconds</p>
      {project.clarifications.some(q => q.status === 'Answered' && q.answer?.trim()) && <aside className="context-note"><strong>Check against recorded answers</strong>{project.clarifications.filter(q => q.status === 'Answered' && q.answer?.trim()).map(q => <p key={q.id}><b>{q.id}</b>: {q.answer}</p>)}<p>Check the business rule, actor and exceptions as well as any numbers. A valid format or source identifier does not prove the draft is correct.</p></aside>}
      {pending.receipt.token_budget && <p className="muted" title={pending.receipt.counting_method}>Estimated input {pending.receipt.estimated_tokens?.toLocaleString()} / {pending.receipt.token_budget.toLocaleString()} context tokens · output allowance {pending.receipt.output_reservation?.toLocaleString()} · actual input {pending.metadata.usage.input_tokens?.toLocaleString() ?? 'unavailable'} / output {pending.metadata.usage.output_tokens?.toLocaleString() ?? 'unavailable'}</p>}
      {(pending.receipt.omitted_reference_ids.length > 0 || pending.receipt.partial_reference_ids.length > 0) && <p className="context-note warning">Not fully included: {[...pending.receipt.omitted_reference_ids, ...pending.receipt.partial_reference_ids].join(', ')}. Review whether essential context is missing.</p>}
      <div className="bulk-selection-controls proposal-selection-controls">
        <span>{selected.length} selected · Review each suggestion before adding it.</span>
        <button type="button" disabled={checkingAcceptance} onClick={() => setSelected((['questions', 'requirements', 'stories', 'findings', 'diagrams', 'sections'] as const).flatMap(group => edited[group].map((_, index) => `${group}:${index}`)))}>Select all suggestions</button>
        <button type="button" disabled={checkingAcceptance || !selected.length} onClick={() => setSelected([])}>Clear selection</button>
      </div>
      <fieldset disabled={checkingAcceptance} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }} aria-label="Proposal items">
      {(['questions', 'requirements', 'stories', 'findings', 'diagrams', 'sections'] as const).map(group => edited[group].map((item, index) => {
        const key = `${group}:${index}`;
        const values = item as unknown as Record<string, unknown>;
        const matches = group === 'questions' ? similarQuestions(String(values.question), project.clarifications) : [];
        return <article className="proposal-item" key={key}><label className="workbench-check"><input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} /><strong>{({ questions: 'Clarification', requirements: 'Requirement', stories: 'User story', findings: 'Finding', diagrams: 'Diagram', sections: 'Document section' })[group]} {index + 1}</strong></label>
          {Object.entries(values).filter(([field]) => !['source_ids', 'kind', 'priority', 'severity'].includes(field)).map(([field, value]) => <label key={field}>{field === 'source' ? 'Diagram code (Mermaid)' : field.replaceAll('_', ' ')}<textarea rows={field === 'source' ? 8 : 2} value={Array.isArray(value) ? value.join('\n') : String(value)} onChange={e => edit(group, index, field, e.target.value)} /></label>)}
          {matches.length > 0 && <aside className="context-note warning"><strong>Similar questions already recorded</strong><p>Compare before adding. These are text-based suggestions and may have a different meaning or scope.</p><ul>{matches.map(({ item: match, exact }) => <li key={match.id}><b>{match.id}</b> · {match.status} · {match.goalId ? `Goal: ${project.goals.find(goal => goal.id === match.goalId)?.title ?? match.goalId}` : 'Project-wide'}{exact ? ' · matching wording' : ' · similar wording'}: {match.question}</li>)}</ul></aside>}
          {group === 'diagrams' && <DiagramPreview source={String(values.source)} />}
          <label>Evidence identifiers (one per line)<textarea rows={2} value={(values.source_ids as string[]).join('\n')} onChange={e => edit(group, index, 'source_ids', e.target.value)} /></label><small>Use supplied evidence only and verify that it supports this item.</small><details><summary>Available evidence ({pending.receipt.included_reference_ids.length})</summary><p>{pending.receipt.included_reference_ids.join(', ') || 'No evidence identifiers supplied.'}</p></details>
        </article>;
      }))}
      </fieldset>
      {!!edited.limitations.length && <ul>{edited.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      <div className="workbench-actions"><button className="primary-button" disabled={!selected.length || checkingAcceptance || proposalStale} onClick={() => void apply()}>{checkingAcceptance ? 'Checking sources…' : `Add ${selected.length || 'selected'} items as drafts`}</button><button disabled={checkingAcceptance} onClick={() => { update(p => { const r = p.aiRuns?.find(x => x.id === pending.id); if (r) { r.status = 'rejected'; r.reviewedAt = new Date().toISOString(); } addAudit(p, 'Rejected AI proposal', pending.id, 'Original proposal retained for review.'); }); setError(''); }}>Reject proposal</button></div>
    </div>}
    {!!project.aiRuns?.length && <details><summary>Previous AI tasks ({project.aiRuns.length})</summary>{[...project.aiRuns].reverse().map(r => <details className="saved-run-review" key={r.id}><summary>{new Date(r.at).toLocaleString()} · {tasks[r.metadata.task as TaskKind]?.label ?? r.metadata.task} · {r.metadata.model} · {r.status}</summary>
        <p>{r.metadata.condition} · {r.metadata.prompt_version} · {(r.metadata.elapsed_ms / 1000).toFixed(1)} seconds · {r.selected?.length ?? 0} selected items</p>
        {r.validationError && <p role="note">{r.validationError}</p>}
        <details><summary>Original model proposal</summary><ProposalRecord proposal={r.proposal} /></details>
        {r.reviewedProposal && <details><summary>BA-reviewed proposal</summary><p>Selected items added as drafts:</p>{r.selected?.length ? <ul>{r.selected.map(key => <li key={key}>{describeProposalSelection(r.reviewedProposal!, key)}</li>)}</ul> : <p>No selected items were recorded.</p>}<p>Unselected items in this review were not added.</p><ProposalRecord proposal={r.reviewedProposal} /></details>}
      </details>)}</details>}
  </section>;
}
