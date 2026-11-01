import { describe, expect, it } from "vitest";
import { freshState, revisionManifest, revisionOf } from "./store";
import { pinSyntheticSources } from "./testSourceFixtures";
import {
  canAdvanceStage,
  canCreateBaseline,
  canCompleteGoal,
  stageReadiness,
  stageReadinessIssues,
} from "./workflowReadiness";

const freshGoalProject = () => {
  const project = freshState().projects[0];
  pinSyntheticSources(project);
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
  it("blocks a stale selected source at setup, baseline and completion until reselected", () => {
    const { project, goal } = freshGoalProject();
    goal.sourceIds = [project.sources[0].id];
    project.sources[0].sha256 = 'new-revision';
    expect(stageReadiness(project, 'Setup').find(item => item.id === 'source-approved')?.complete).toBe(false);
    expect(stageReadiness(project, 'Approve').find(item => item.id === 'source-revisions')?.complete).toBe(false);
    goal.gate = 'Approve';
    expect(canCreateBaseline(project)).toBe(false);
    expect(canCompleteGoal(project, goal.id)).toBe(false);
    goal.sourceRevisionPins![project.sources[0].id] = 'new-revision';
    expect(stageReadiness(project, 'Setup').find(item => item.id === 'source-approved')?.complete).toBe(true);
    expect(stageReadiness(project, 'Approve').find(item => item.id === 'source-revisions')?.complete).toBe(true);
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

  it("accepts an attached manual evidence link at Define while still requiring verification at Validate", () => {
    const { project, goal } = freshGoalProject();
    goal.gate = "Define";
    project.requirements = [project.requirements[0]]; project.stories = [];
    const requirement = project.requirements[0];
    requirement.goalId = goal.id; requirement.sourceIds = []; requirement.fitCriteria = ["A measurable test"];
    project.traceLinks = [{ id: "TR-manual", from: "PROJECT-BRIEF", to: requirement.id, relation: "supports", status: "Pending" }];
    expect(stageReadiness(project).find(item => item.id === "evidence-linked")?.complete).toBe(true);
    expect(stageReadiness(project, "Validate").find(item => item.id === "evidence-verified")?.complete).toBe(false);
    project.traceLinks[0].status = "Broken";
    expect(stageReadiness(project).find(item => item.id === "evidence-linked")?.complete).toBe(false);
  });

  it("does not let an implemented or unverified legacy change pass the completion gate", () => {
    const { project, goal } = freshGoalProject();
    goal.gate = "Approve";
    project.changes = [{ id: "CR-legacy", title: "Old change", rationale: "", source: "", status: "Revalidated", impacts: [] }];
    expect(stageReadiness(project).find(item => item.id === "changes-revalidated")?.complete).toBe(false);
    expect(canCreateBaseline(project)).toBe(false);
    project.changes[0].status = "Implemented";
    expect(stageReadiness(project).find(item => item.id === "changes-revalidated")?.complete).toBe(false);
    project.changes[0].status = "Impact review";
    project.changes[0].patches = [{ id: "old", artifactId: project.requirements[0].id, artifactType: "Requirement", field: "statement", before: "before", after: "after", sourceRevision: 1, selected: true, status: "Applied" }];
    expect(stageReadiness(project).find(item => item.id === "changes-revalidated")?.complete).toBe(false);
  });

  it("does not allow a goal to complete merely because a later gate was selected", () => {
    const { project, goal } = freshGoalProject();
    goal.gate = "Validate";
    goal.gateIndex = 4;
    expect(canCompleteGoal(project, goal.id)).toBe(false);
  });

  it("requires an approved baseline that contains the goal artifacts", () => {
    const { project, goal } = freshGoalProject();
    project.requirements = [project.requirements[0]];
    project.stories = []; project.diagrams = []; project.documents = []; project.clarifications = []; project.checks = []; project.changes = [];
    const requirement = project.requirements[0]; requirement.status = "approved";
    requirement.sourceIds = [project.sources[0].id];
    project.traceLinks = [{id:"TR-current",from:project.sources[0].id,to:requirement.id,relation:"Supports",status:"Verified",fromRevision:revisionOf(project,project.sources[0].id),toRevision:requirement.version}];
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
    const revision = requirement.version;
    requirement.status = "draft";
    project.traceLinks[0].status = "Pending";
    expect(requirement.version).toBe(revision);
    expect(canCompleteGoal(project, goal.id)).toBe(false);
    expect(stageReadiness(project, "Approve").find(item => item.id === "working-reviews-current")?.complete).toBe(false);
    requirement.status = "approved"; project.traceLinks[0].status = "Verified";
    expect(canCompleteGoal(project, goal.id)).toBe(true);
    project.requirements[0].version += 1;
    expect(canCompleteGoal(project, goal.id)).toBe(false);
  });

  it("completes three governed journeys without skipping a stage", () => {
    for (const project of freshState().projects) {
      pinSyntheticSources(project);
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
