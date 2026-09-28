import { describe, expect, it } from "vitest";
import { seedState } from "./data";
import {
  approvalAllowed,
  blockers,
  canApprove,
  governanceCanDisable,
  impactedIds,
  migrateWorkspace,
  restoreVersionAsDraft,
  safeEvaluationExport,
  traceCoverage,
  transitionClarification,
} from "./store";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe("BA Mate domain rules", () => {
  it("prevents approval while blocking evidence remains", () => {
    const project = clone(seedState.projects[0]);
    expect(canApprove(project)).toBe(true);
    expect(blockers(project)).toBeGreaterThan(0);
    expect(approvalAllowed(project)).toBe(false);
    project.checks.forEach((check) => {
      if (check.status === "Blocking") check.status = "Passed";
    });
    project.clarifications.forEach((question) => {
      if (question.priority === "Blocking") { question.status = "Answered"; question.answer = "Confirmed by stakeholder"; }
    });
    expect(approvalAllowed(project)).toBe(false);
    [...project.requirements, ...project.stories, ...project.documents].forEach(item => item.status = "in-review");
    project.traceLinks = [...project.requirements, ...project.stories].map(item => ({ id: `TR-${item.id}`, from: "PROJECT-BRIEF", to: item.id, fromRevision: 1, toRevision: item.version, relation: "Reviewed support", status: "Verified" }));
    expect(approvalAllowed(project)).toBe(true);
  });

  it("supports explicit clarification transitions without deleting history fields", () => {
    const question = seedState.projects[0].clarifications[0];
    const answered = transitionClarification(
      question,
      "Answered",
      "Only policy-defined exceptions",
    );
    expect(answered.status).toBe("Answered");
    expect(answered.answer).toBe("Only policy-defined exceptions");
    expect(answered.sourceId).toBe(question.sourceId);
    expect(answered.affects).toEqual(question.affects);
  });

  it("keeps immutable safeguards enabled", () => {
    const core = seedState.projects[0].checks.find((check) => check.immutable)!;
    const contextual = seedState.projects[0].checks.find(
      (check) => !check.immutable,
    )!;
    expect(governanceCanDisable(core)).toBe(false);
    expect(governanceCanDisable(contextual)).toBe(true);
  });

  it("restores a locked baseline as a new unlocked working snapshot", () => {
    const baseline = seedState.projects[0].versions.find(
      (version) => version.locked,
    )!;
    const restored = restoreVersionAsDraft(baseline, 7);
    expect(restored.locked).toBe(false);
    expect(restored.type).toBe("Snapshot");
    expect(restored.label).toContain(baseline.version);
  });

  it("returns every linked impact and calculates trace coverage", () => {
    const project = seedState.projects[0];
    expect(impactedIds(project, "CR-01")).toEqual([
      "NFR-01",
      "US-01",
      "DGM-01",
      "DOC-01",
    ]);
    expect(traceCoverage(project)).toBe(100);
  });

  it("exports research runs without participant contact information", () => {
    const exported = safeEvaluationExport(seedState);
    expect(exported[0]).toHaveProperty("evaluator_code");
    expect(JSON.stringify(exported)).not.toMatch(/email|name|phone/i);
  });

  it("keeps blockers isolated to the selected goal", () => {
    const project = clone(seedState.projects[0]);
    project.goals = [
      {
        id: "GOAL-A",
        title: "Initial delivery",
        kind: "New discovery",
        status: "Active",
        description: "Initial scope",
        createdAt: "Now",
        gate: "Clarify",
        gateIndex: 2,
        sourceIds: [],
        deliverables: [],
      },
      {
        id: "GOAL-B",
        title: "Later addendum",
        kind: "Requirements addendum",
        status: "Planned",
        description: "Later scope",
        createdAt: "Now",
        gate: "Setup",
        gateIndex: 0,
        sourceIds: [],
        deliverables: [],
      },
    ];
    project.clarifications.forEach((question) => (question.goalId = "GOAL-A"));
    project.checks.forEach((check) => (check.goalId = "GOAL-A"));
    expect(blockers(project, "GOAL-A")).toBeGreaterThan(0);
    expect(blockers(project, "GOAL-B")).toBe(0);
  });

  it("migrates goals with independent workflow and ownership fields", () => {
    const project = clone(seedState.projects[0]);
    project.goals = [
      {
        id: "GOAL-OLD",
        title: "Legacy goal",
        kind: "New discovery",
        status: "Active",
        description: "Existing work",
        createdAt: "Earlier",
      } as (typeof project.goals)[number],
    ];
    const migrated = migrateWorkspace({
      schemaVersion: 2,
      projects: [project],
      evaluationRuns: [],
    }).projects[0];
    expect(migrated.activeGoalId).toBe("GOAL-OLD");
    expect(migrated.goals[0].gate).toBe(migrated.gate);
    expect(migrated.goals[0].deliverables.length).toBeGreaterThan(0);
  });

  it("restores the governed workflow for pre-v5 demonstration workspaces", () => {
    const project = clone(seedState.projects[0]);
    project.goals = [];
    project.activeGoalId = undefined;
    const migrated = migrateWorkspace({
      schemaVersion: 4,
      projects: [project],
      evaluationRuns: [],
    }).projects[0];
    expect(migrated.goals).toHaveLength(1);
    expect(migrated.activeGoalId).toBe("GOAL-01");
    expect(migrated.goals[0].conversationId).toBe("CONV-01");
  });

  it("reports zero traceability for a fresh project", () => {
    const project = clone(seedState.projects[0]);
    project.traceLinks = [];
    expect(traceCoverage(project)).toBe(0);
  });
});
