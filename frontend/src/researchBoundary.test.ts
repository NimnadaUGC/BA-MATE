import { describe, expect, it } from 'vitest';
import { buildResearchUpload, queueUpload, validateResearchUpload, type ResearchEnrollment } from './researchBoundary';
import { freshState } from './store';
import type { EvaluationRun, ResearchTelemetryEvent, WorkspaceState } from './types';

const enrollment: ResearchEnrollment = { status: 'active', studyPseudonym: 'STUDY-9Q2A', consentVersion: 'consent-2026-09-21-v1' };
const configuredRun = (projectId: string): EvaluationRun => ({ id: 'RUN-1', projectId, caseId: 'CASE-1', condition: 'Proposed workflow', datasetVersion: 'task-case-2026-09-21-v1', prototypeVersion: 'ba-mate-0.4.0', promptVersion: 'prompt-schema-2026-09-21-v1', model: 'qualified-model-profile-v1', evaluatorCode: 'not-uploaded', duration: '00:00', status: 'Running' });
const addConfiguredEvent = (state: WorkspaceState, event: Omit<ResearchTelemetryEvent, 'runId'>) => {
  state.evaluationRuns.push(configuredRun(state.projects[0].id));
  state.telemetryEvents.push({ ...event, runId: 'RUN-1' });
};
describe('research upload boundary', () => {
  it('uploads only permitted pseudonymous measurements even when workspace content is injected', () => {
    const state = freshState();
    state.projects[0].name = 'Acme confidential company';
    state.projects[0].sources[0].name = 'secret-contract.docx';
    state.projects[0].sources[0].content = 'PROMPT: use the leaked API_KEY=super-secret';
    addConfiguredEvent(state, { id: 'EVT-1', at: '2026-09-21T10:00:00Z', projectId: state.projects[0].id, stage: 'Define', section: 'workflow', type: 'assistant-request', successful: false, durationMs: 1200 });
    const upload = buildResearchUpload(state, enrollment);
    const text = JSON.stringify(upload);
    expect(text).not.toContain('Acme');
    expect(text).not.toContain('secret-contract');
    expect(text).not.toContain('super-secret');
    expect(text).not.toContain('projectId');
    expect(text).toContain('STUDY-9Q2A');
    expect(upload.events[0].versions).toMatchObject({ protocol: 'ba-mate-protocol-2026-09-21-v1', instrument: 'ba-mate-stage-instrument-2026-09-21-v1', task_case: 'task-case-2026-09-21-v1', prompt_schema: 'prompt-schema-2026-09-21-v1' });
  });
  it('never treats absent consent as permission and protects queue identity', () => {
    expect(() => buildResearchUpload(freshState(), { status: 'not-enrolled' })).toThrow('consent is not active');
    const state = freshState();
    addConfiguredEvent(state, { id: 'EVT-2', at: '2026-09-21T10:00:00Z', projectId: state.projects[0].id, stage: 'Define', section: 'workflow', type: 'interaction', successful: true });
    const batch = buildResearchUpload(state, enrollment);
    expect(queueUpload([batch], batch)).toHaveLength(1);
  });
  it('rejects forbidden fields before network submission', () => {
    const state = freshState();
    addConfiguredEvent(state, { id: 'EVT-3', at: '2026-09-21T10:00:00Z', projectId: 'private-project', stage: 'Define', section: 'workflow', type: 'interaction', successful: true });
    const batch = buildResearchUpload(state, enrollment);
    expect(() => validateResearchUpload({ ...batch, events: [({ ...batch.events[0], prompt: 'private' } as typeof batch.events[number])] })).toThrow('forbidden');
  });
  it('does not upload unassigned workspace activity as a research measurement', () => {
    const state = freshState();
    state.telemetryEvents.push({ id: 'EVT-4', at: '2026-09-21T10:00:00Z', projectId: state.projects[0].id, stage: 'Define', section: 'workflow', type: 'interaction', successful: true });
    expect(() => buildResearchUpload(state, enrollment)).toThrow('No configured evaluation-run');
  });
  it('stops collection after offline grace expires without affecting the local workspace', () => {
    const state = freshState();
    addConfiguredEvent(state, { id: 'EVT-5', at: '2026-09-21T10:00:00Z', projectId: state.projects[0].id, stage: 'Define', section: 'workflow', type: 'interaction', successful: true });
    expect(() => buildResearchUpload(state, { ...enrollment, offlineUntil: '2000-01-01T00:00:00Z' })).toThrow('offline collection grace period ended');
    expect(state.projects[0].name).toBeTruthy();
  });
});
