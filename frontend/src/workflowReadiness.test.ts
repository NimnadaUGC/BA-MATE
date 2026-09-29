import { describe, expect, it } from "vitest";
import { freshState, revisionManifest, revisionOf } from "./store";
import {
  canAdvanceStage,
  canCreateBaseline,
  canCompleteGoal,
  stageReadiness,
  stageReadinessIssues,
} from "./workflowReadiness";

const freshGoalProject = () => {
  const project = freshState().projects[0];
  const goal = project.goals[0];
  project.activeGoalId = goal.id;
  goal.status = "Active";
  return { project, goal };
};

describe("governed workflow readiness", () => {
  it("blocks Setup when the active goal has no reviewed source", () => {
    const { project, goal } = freshGoalProject();
    goal.gate = "Setup";
    goal.gateIndex = 0;
    goal.sourceIds = [];
    expect(canAdvanceStage(project)).toBe(false);
    expect(stageReadinessIssues(project)).toContain("At least one source reviewed");
  });

  it("allows Setup after a reviewed source is scoped to the goal", () => {
    const { project, goal } = freshGoalProject();
    goal.gate = "Setup";
    goal.gateIndex = 0;
    project.sources[0].approved = true;
    goal.sourceIds = [project.sources[0].id];
    expect(stageReadiness(project).every((item) => item.complete)).toBe(true);
    expect(canAdvanceStage(project)).toBe(true);
  });

  it("requires blocking clarification answers before leaving Clarify", () => {
    const { project, goal } = freshGoalProject();
    goal.gate = "Clarify";
    goal.gateIndex = 2;
    project.clarifications.forEach((item) => {
      item.goalId = goal.id;
      item.status = item.priority === "Blocking" ? "Unanswered" : "Deferred";
    });
    expect(canAdvanceStage(project)).toBe(false);
    project.clarifications.forEach((item) => {
      if (item.priority === "Blocking") {
        item.status = "Answered";
        item.answer = "Confirmed by stakeholder";
      }
    });
    project.checks.forEach((item) => {
      if (item.status === "Blocking") item.status = "Passed";
    });
    expect(canAdvanceStage(project)).toBe(true);
  });

  it("does not allow baseline approval to bypass Validate", () => {
    const { project, goal } = freshGoalProject();
    goal.gate = "Validate";
    goal.gateIndex = 4;
    expect(canCreateBaseline(project)).toBe(false);
  });

  it("does not allow a goal to complete merely because a later gate was selected", () => {
    const { project, goal } = freshGoalProject();
    goal.gate = "Validate";
    goal.gateIndex = 4;
    expect(canCompleteGoal(project, goal.id)).toBe(false);
  });

  it("requires an approved baseline that contains the goal artifacts", () => {
    const { project, goal } = freshGoalProject();
    goal.gate = "Approve";
    goal.gateIndex = 5;
    project.versions = [];
    expect(canCompleteGoal(project, goal.id)).toBe(false);
    project.versions.push({
      id: "BASE-1",
      label: "Approved goal baseline",
      version: "B1",
      at: new Date().toISOString(),
      actor: "Lead BA",
      type: "Baseline",
      locked: true,
      changes: "Approved goal scope",
      manifest: [
        ...project.requirements,
        ...project.stories,
        ...project.diagrams,
        ...project.documents,
      ]
        .filter((item) => !item.goalId || item.goalId === goal.id)
        .map((item) => ({ id: item.id, type: "Requirement" as const, revision: item.version })),
    });
    expect(canCompleteGoal(project, goal.id)).toBe(true);
    project.requirements[0].version += 1;
    expect(canCompleteGoal(project, goal.id)).toBe(false);
  });

  it("completes three governed journeys without skipping a stage", () => {
    for (const project of freshState().projects) {
      const goal = project.goals[0];
      project.activeGoalId = goal.id;
      goal.status = "Active";
      goal.sourceIds = project.sources.filter((item) => item.approved).map((item) => item.id);

      goal.gate = "Setup";
      goal.gateIndex = 0;
      expect(canAdvanceStage(project), `${project.id}: Setup`).toBe(true);

      goal.gate = "Discover";
      goal.gateIndex = 1;
      expect(canAdvanceStage(project), `${project.id}: Discover`).toBe(true);

      project.clarifications.forEach((item) => {
        item.goalId = goal.id;
        if (item.priority === "Blocking") {
          item.status = "Answered";
          item.answer = "Confirmed by the synthetic stakeholder";
        } else if (item.status === "Unanswered") {
          item.status = "Deferred";
        }
      });
      project.checks.forEach((item) => {
        item.status = "Passed";
      });
      goal.gate = "Clarify";
      goal.gateIndex = 2;
      expect(canAdvanceStage(project), `${project.id}: Clarify`).toBe(true);

      goal.gate = "Define";
      goal.gateIndex = 3;
      expect(canAdvanceStage(project), `${project.id}: Define`).toBe(true);

      project.requirements.forEach((item) => { item.status = "approved"; });
      project.stories.forEach((item) => { item.status = "approved"; });
      project.documents.forEach((item) => { item.status = "approved"; });
      project.diagrams.forEach((item) => {
        item.status = "Approved";
        item.approvalStatus = "Approved";
      });
      project.traceLinks.forEach((item) => {
        item.status = "Verified";
        item.fromRevision = revisionOf(project, item.from);
        item.toRevision = revisionOf(project, item.to);
      });
      goal.gate = "Validate";
      goal.gateIndex = 4;
      expect(canAdvanceStage(project), `${project.id}: Validate`).toBe(true);

      goal.gate = "Approve";
      goal.gateIndex = 5;
      expect(canCreateBaseline(project), `${project.id}: baseline`).toBe(true);
      project.versions.unshift({
        id: `BASE-${project.id}`,
        label: "Synthetic journey baseline",
        version: "B-test",
        at: new Date().toISOString(),
        actor: "Lead BA",
        type: "Baseline",
        locked: true,
        changes: "Complete governed journey",
        manifest: revisionManifest(project, goal.id),
      });
      expect(canCompleteGoal(project, goal.id), `${project.id}: complete`).toBe(true);
    }
  });
});
