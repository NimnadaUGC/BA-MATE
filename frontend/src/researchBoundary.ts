import type { EvaluationRun, ResearchTelemetryEvent, StageFeedback, WorkspaceState } from './types';

export const RESEARCH_CONSENT_VERSION = 'consent-2026-09-21-v1';
export const RESEARCH_UPLOAD_SCHEMA = 'ba-mate-research-batch-v1';
export const RESEARCH_PROTOCOL_VERSION = 'ba-mate-protocol-2026-09-21-v1';
export const RESEARCH_INSTRUMENT_VERSION = 'ba-mate-stage-instrument-2026-09-21-v1';
export const RETENTION_NOTICE = 'Research records are retained only under the approved study retention schedule. Withdrawing consent stops future uploads and discards unsent batches on this device.';

export interface ResearchEnrollment {
  status: 'not-enrolled' | 'active' | 'offline-grace' | 'expired' | 'revoked' | 'withdrawn';
  studyPseudonym?: string;
  consentVersion?: string;
  consentedAt?: string;
  offlineUntil?: string;
  uploadEndpoint?: string;
  lastSyncAt?: string;
}
export interface LocalResearchParticipation {
  enrollment: ResearchEnrollment;
  queue: UploadBatch[];
  sync?: { state: 'idle' | 'syncing' | 'waiting' | 'failed'; attempts: number; nextRetryAt?: string; message?: string };
}
export interface UploadEvent {
  event_id: string;
  occurred_at: string;
  run_code: string;
  condition: EvaluationRun['condition'];
  versions: { app: string; framework: string; protocol: string; instrument: string; task_case: string; prompt_schema: string; model_profile: string };
  measurement: 'telemetry' | 'rating';
  stage?: string;
  category?: string;
  duration_ms?: number;
  outcome?: 'success' | 'failure';
  ratings?: { task_completed: boolean; accuracy?: number; usefulness?: number; usability?: number; confidence?: number };
}
export interface UploadBatch {
  schema: typeof RESEARCH_UPLOAD_SCHEMA;
  batch_id: string;
  consent_version: string;
  study_pseudonym: string;
  created_at: string;
  events: UploadEvent[];
}
const uuid = () => crypto.randomUUID();
const runFor = (runs: EvaluationRun[], id?: string) => runs.find(run => run.id === id);
const runVersions = (run: EvaluationRun) => ({ app: run.prototypeVersion, framework: 'ba-framework-0.4.0', protocol: RESEARCH_PROTOCOL_VERSION, instrument: RESEARCH_INSTRUMENT_VERSION, task_case: run.datasetVersion, prompt_schema: run.promptVersion, model_profile: run.model });
const eventForTelemetry = (event: ResearchTelemetryEvent, run: EvaluationRun): UploadEvent => ({
  event_id: event.id, occurred_at: event.at, run_code: run?.id, condition: run?.condition, versions: runVersions(run),
  measurement: 'telemetry', stage: event.stage, category: event.type, duration_ms: event.durationMs, outcome: event.successful ? 'success' : 'failure',
});
const eventForFeedback = (feedback: StageFeedback, run: EvaluationRun): UploadEvent => ({
  event_id: feedback.id, occurred_at: feedback.at, run_code: run?.id, condition: run?.condition, versions: runVersions(run),
  measurement: 'rating', stage: feedback.stage, category: 'stage-feedback',
  ratings: { task_completed: feedback.taskCompleted, accuracy: feedback.accuracyRating, usefulness: feedback.usefulnessRating, usability: feedback.usabilityRating, confidence: feedback.confidenceRating },
  // Free text is deliberately omitted. It requires a separate preview/review submission path.
});

/** This is the only serializer permitted to leave the desktop for B09–B11. */
export function buildResearchUpload(state: WorkspaceState, enrollment: ResearchEnrollment): UploadBatch {
  if (enrollment.status !== 'active' && enrollment.status !== 'offline-grace') throw new Error('Research consent is not active. Local BA work remains available, but no research data can be uploaded.');
  if (!enrollment.studyPseudonym || !enrollment.consentVersion) throw new Error('A study pseudonym and consent receipt are required before uploading.');
  if (enrollment.offlineUntil && Date.parse(enrollment.offlineUntil) <= Date.now()) throw new Error('The offline collection grace period ended. Sign in again before collecting; local BA work remains available.');
  const events = [
    ...state.telemetryEvents.flatMap(event => { const run = runFor(state.evaluationRuns, event.runId); return run ? [eventForTelemetry(event, run)] : []; }),
    ...state.stageFeedback.flatMap(feedback => { const run = runFor(state.evaluationRuns, feedback.runId); return run ? [eventForFeedback(feedback, run)] : []; }),
  ];
  if (!events.length) throw new Error('No configured evaluation-run measurements are ready for collection. Local BA work remains available.');
  return { schema: RESEARCH_UPLOAD_SCHEMA, batch_id: uuid(), consent_version: enrollment.consentVersion, study_pseudonym: enrollment.studyPseudonym, created_at: new Date().toISOString(), events };
}

/** Reject a payload that has drifted beyond the public measurement contract before network use. */
export function validateResearchUpload(batch: UploadBatch) {
  const forbidden = /project|source|document|prompt|response|filename|filepath|content|hash|credential|secret|api.?key|company|evaluator/i;
  const permittedVersionKeys = new Set(['app', 'framework', 'protocol', 'instrument', 'task_case', 'prompt_schema', 'model_profile']);
  const scan = (value: unknown, key = ''): void => {
    if (forbidden.test(key) && !permittedVersionKeys.has(key)) throw new Error(`The research upload contains a forbidden field: ${key}.`);
    if (Array.isArray(value)) value.forEach(item => scan(item));
    else if (value && typeof value === 'object') Object.entries(value as Record<string, unknown>).forEach(([child, item]) => scan(item, child));
  };
  scan(batch);
  if (batch.schema !== RESEARCH_UPLOAD_SCHEMA || !batch.study_pseudonym || !batch.events.length) throw new Error('The research upload is incomplete or uses an unsupported schema.');
  if (batch.events.some(event => !event.versions || Object.keys(event.versions).length !== permittedVersionKeys.size || [...permittedVersionKeys].some(key => !event.versions[key as keyof typeof event.versions]))) throw new Error('Every measurement must carry its complete frozen version manifest.');
  if (batch.events.some(event => event.measurement === 'rating' && event.ratings && Object.values(event.ratings).some(value => value === null))) throw new Error('Blank ratings must remain missing, never zero.');
  return batch;
}

export function queueUpload(queue: UploadBatch[], batch: UploadBatch, maxBatches = 50) {
  validateResearchUpload(batch);
  if (queue.some(item => item.batch_id === batch.batch_id)) return queue;
  if (queue.length >= maxBatches) throw new Error('The local research queue is full. Connect and sync or withdraw consent; local BA work is unaffected.');
  return [...queue, batch];
}

export function retryDelayMs(attempts: number) {
  return Math.min(30 * 60 * 1000, 1000 * 2 ** Math.min(10, Math.max(0, attempts)));
}
