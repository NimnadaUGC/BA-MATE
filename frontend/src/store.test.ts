import { describe, expect, it } from "vitest";
import { seedState } from "./data";
import { pinSyntheticSources } from "./testSourceFixtures";
import {
  approvalAllowed,
  approvalIssuesForArtifact,
  blockers,
  canApprove,
  governanceCanDisable,
  recordGovernanceDisposition,
  enforceWorkingVersions,
  impactedIds,
  migrateWorkspace,
  restoreVersionAsDraft,
  safeEvaluationExport,
  traceCoverage,
  transitionClarification,
} from "./store";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe("BA Mate domain rules", () => {
  it("preserves source revisions for storage metadata changes but invalidates changed or lost evidence", () => {
    const before = clone(seedState.projects[0]);
    const source = before.sources[0];
    source.version = 3;
    source.originalBase64 = "b2xk";
    source.relativePath = "sources/brief.pdf";
    source.analysisSignature = "old fingerprint";
    before.workspaceId = "restored-workspace";
    before.workspaceKind = "managed";
    const restored = clone(before);
    restored.sources[0].analysisSignature = "new fingerprint";
    delete restored.sources[0].originalBase64;
    enforceWorkingVersions(before, restored);
    expect(restored.sources[0].version).toBe(3);

    const changed = clone(restored);
    changed.sources[0].sha256 = "different hash";
    enforceWorkingVersions(restored, changed);
    expect(changed.sources[0].version).toBe(4);

    const lost = clone(before);
    delete lost.sources[0].originalBase64;
    delete lost.workspaceId;
    enforceWorkingVersions(before, lost);
    expect(lost.sources[0].version).toBe(4);
  });
  it("uses the artifact owner's governance scope for cross-goal review", () => {
    const project = clone(seedState.projects[0]);
    const diagram = project.diagrams[0];
    diagram.goalId = "original"; project.activeGoalId = "addendum";
    project.checks = []; project.clarifications = []; project.traceLinks = [];
    expect(approvalIssuesForArtifact(project, diagram.id)).toContain("The artifact is outside the active approval scope.");
    expect(approvalIssuesForArtifact(project, diagram.id, diagram.goalId)).not.toContain("The artifact is outside the active approval scope.");
  });
  it("prevents approval while blocking evidence remains", () => {
    const project = clone(seedState.projects[0]);
    pinSyntheticSources(project);
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

  it("records an authored governance rationale without fabricating evidence or reverting the decision", () => {
    const before = clone(seedState.projects[0]);
    const check = before.checks.find(item => !item.immutable)!;
    check.status = "Warning";
    delete check.resolution;
    const after = clone(before);
    expect(() => recordGovernanceDisposition(after, check.id, "Passed", "  ")).toThrow(/rationale/i);
    recordGovernanceDisposition(after, check.id, "Passed", "Reviewed with the project owner; evidence is in meeting notes.");
    enforceWorkingVersions(before, after);
    const result = after.checks.find(item => item.id === check.id)!;
    expect(result.status).toBe("Passed");
    expect(result.resolution).toBe("Reviewed with the project owner; evidence is in meeting notes.");
    expect(after.audit[0].detail).toBe(result.resolution);
    expect(result.resolution).not.toContain("DEC-02");
    const edited = clone(after);
    edited.checks.find(item => item.id === check.id)!.title += " changed";
    enforceWorkingVersions(after, edited);
    expect(edited.checks.find(item => item.id === check.id)!.status).toBe("Warning");
  });

  it("requires a real reason for not-applicable and protects immutable checks", () => {
    const project = clone(seedState.projects[0]);
    const core = project.checks.find(item => item.immutable)!;
    const check = project.checks.find(item => !item.immutable)!;
    expect(() => recordGovernanceDisposition(project, core.id, "Not applicable", "A reason")).toThrow(/core safeguard/i);
    expect(() => recordGovernanceDisposition(project, check.id, "Not applicable", "")).toThrow(/rationale/i);
    recordGovernanceDisposition(project, check.id, "Not applicable", "This scenario has no external data transfer.");
    expect(check.status).toBe("Not applicable");
    expect(check.resolution).toBe("This scenario has no external data transfer.");
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
    // Legacy seed links have no reviewed revision stamps and are not current evidence.
    expect(traceCoverage(project)).toBe(0);
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

  it("does not assign unowned or other-goal artifacts to the active goal on reload", () => {
    const project = clone(seedState.projects[0]);
    const original = project.goals[0];
    const later = { ...clone(original), id: "GOAL-LATER", deliverables: [], status: "Active" as const };
    project.goals = [original, later]; project.activeGoalId = later.id;
    project.requirements[0].goalId = original.id;
    project.changes[0].goalId = undefined;
    const migrated = migrateWorkspace({ schemaVersion: 8, projects: [project] }).projects[0];
    expect(migrated.requirements[0].goalId).toBe(original.id);
    expect(migrated.changes[0].goalId).toBeUndefined();
    expect(migrated.goals[1].deliverables).not.toContain(project.requirements[0].id);
    expect(migrated.goals[1].deliverables).not.toContain(project.changes[0].id);
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
