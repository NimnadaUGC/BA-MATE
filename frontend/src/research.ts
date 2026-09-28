import type {
  EvaluationRun,
  ResearchTelemetryEvent,
  StageFeedback,
  WorkflowGate,
} from "./types";

export const PROTOTYPE_VERSION = "BA Mate 0.4.0";
export const DATASET_VERSION = "2026.08";
export const PROMPT_VERSION = "evidence-workflow-3";

export const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${hours}h ${minutes}m`
    : `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
};

const average = (values: number[]) =>
  values.length
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
    : 0;

export interface StageResearchSummary {
  stage: WorkflowGate;
  sessions: number;
  interactions: number;
  assistantRequests: number;
  errors: number;
  durationMs: number;
  feedbackCount: number;
  completionRate: number;
  accuracy: number;
  usefulness: number;
  usability: number;
  confidence: number;
}

export const summarizeStageResearch = (
  events: ResearchTelemetryEvent[],
  feedback: StageFeedback[],
  stage: WorkflowGate,
): StageResearchSummary => {
  const stageEvents = events.filter((event) => event.stage === stage);
  const ratings = feedback.filter((entry) => entry.stage === stage);
  return {
    stage,
    sessions: stageEvents.filter((event) => event.type === "stage-session").length,
    interactions: stageEvents.filter((event) => event.type === "interaction").length,
    assistantRequests: stageEvents.filter(
      (event) => event.type === "assistant-request",
    ).length,
    errors: stageEvents.filter((event) => event.type === "error").length,
    durationMs: stageEvents.filter(event => event.type === "stage-session").reduce(
      (sum, event) => sum + (event.durationMs ?? 0),
      0,
    ),
    feedbackCount: ratings.length,
    completionRate: ratings.length
      ? Math.round(
          (ratings.filter((entry) => entry.taskCompleted).length / ratings.length) * 100,
        )
      : 0,
    accuracy: average(ratings.map((entry) => entry.accuracyRating)),
    usefulness: average(ratings.map((entry) => entry.usefulnessRating)),
    usability: average(ratings.map((entry) => entry.usabilityRating)),
    confidence: average(ratings.map((entry) => entry.confidenceRating)),
  };
};

export const activeEvaluationRun = (runs: EvaluationRun[]) =>
  [...runs].reverse().find((run) => run.status === "Running");
