import type { ArtifactReference, ModelContextReceipt } from './types';
export interface AssistantMessage { prompt: string; answer: string; references: ArtifactReference[]; receipt: ModelContextReceipt }
export interface AssistantSession { prompt: string; contexts: ArtifactReference[]; messages: AssistantMessage[]; requestError: string; failedPrompt: string }
/** Temporary per-project assistant sessions; never included in exports or browser storage. */
export const assistantSessions = new Map<string, AssistantSession>();
