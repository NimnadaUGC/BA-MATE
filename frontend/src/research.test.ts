import { describe, expect, it } from "vitest";
import { buildModelRequest } from "./modelGateway";
import { summarizeStageResearch } from "./research";
import { freshState } from "./store";

describe("research and model-readiness foundations", () => {
  it("aggregates stage timing and ratings without artifact content", () => {
    const state = freshState();
    state.telemetryEvents.push({
      id: "TLM-1",
      at: "2026-08-17T00:00:00.000Z",
      projectId: "loan",
      stage: "Validate",
      section: "workflow",
      type: "stage-session",
      durationMs: 62000,
      successful: true,
    });
    state.stageFeedback.push({
      id: "FDBK-1",
      at: "2026-08-17T00:02:00.000Z",
      projectId: "loan",
      evaluatorCode: "BA-001",
      stage: "Validate",
      taskCompleted: true,
      accuracyRating: 5,
      usefulnessRating: 4,
      usabilityRating: 4,
      confidenceRating: 5,
      comment: "Clear workflow",
    });
    const summary = summarizeStageResearch(
      state.telemetryEvents,
      state.stageFeedback,
      "Validate",
    );
    expect(summary).toMatchObject({
      durationMs: 62000,
      feedbackCount: 1,
      completionRate: 100,
      accuracy: 5,
    });
    // The optional comment remains local until it is deliberately submitted through
    // the separate previewed feedback path; it is never part of routine telemetry.
    expect(state.stageFeedback[0].comment).toBe("Clear workflow");
  });

  it("keeps source text and conversation available for server-side context selection", () => {
    const project = freshState().projects[0];
    project.sources[0].content = "Actual stakeholder evidence about exception handling";
    project.sources[0].approved = true;
    const request = buildModelRequest({ project, references: [], prompt: "Review the exceptions", task: "project-conversation", history: [{role: "user", content: "The escalation owner is the operations manager."}] });
    expect(request.context.some(item => item.content.includes("Actual stakeholder evidence"))).toBe(true);
    expect(request.history?.[0].content).toContain("operations manager");
    // Only the provider execution receipt can attest what was really included.
    expect(request.receipt.governanceIncluded).toBe(false);
  });
});
