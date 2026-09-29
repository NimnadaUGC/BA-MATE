import type { Project, ProjectGoal, WorkflowGate } from "./types";
import { approvalAllowed, blockers, revisionOf } from "./store";

export interface StageReadinessItem {
  id: string;
  label: string;
  description: string;
  complete: boolean;
  route: string;
}

const inGoal = (goal: ProjectGoal, item: { goalId?: string }) =>
  !item.goalId || item.goalId === goal.id;

const activeGoal = (project: Project) =>
  project.goals.find((goal) => goal.id === project.activeGoalId) ??
  project.goals.find((goal) => goal.status === "Active");

const supportedByVerifiedLink = (project: Project, artifactId: string) => {
  const evidence = new Set([
    "PROJECT-BRIEF",
    ...project.sources.filter((source) => source.approved).map((source) => source.id),
    ...project.clarifications
      .filter((question) => question.status === "Answered" && question.answer?.trim())
      .map((question) => question.id),
  ]);
  const visit = (id: string, seen = new Set<string>()): boolean => {
    if (evidence.has(id)) return true;
    if (seen.has(id)) return false;
    const next = new Set(seen).add(id);
    return project.traceLinks.some(
      (link) =>
        link.to === id &&
        link.status === "Verified" &&
        link.fromRevision === revisionOf(project, link.from) &&
        link.toRevision === revisionOf(project, link.to) &&
        visit(link.from, next),
    );
  };
  return visit(artifactId);
};

export function stageReadiness(
  project: Project,
  gate?: WorkflowGate,
): StageReadinessItem[] {
  const goal = activeGoal(project);
  if (!goal)
    return [
      {
        id: "goal",
        label: "Create an active goal",
        description: "Every governed workflow belongs to a project goal.",
        complete: false,
        route: "goals",
      },
    ];

  const currentGate = gate ?? goal.gate;
  const approvedSources = project.sources.filter(
    (source) => source.approved && goal.sourceIds.includes(source.id),
  );
  const clarifications = project.clarifications.filter((item) => inGoal(goal, item));
  const requirements = project.requirements.filter((item) => inGoal(goal, item));
  const stories = project.stories.filter((item) => inGoal(goal, item));
  const artifacts = [...requirements, ...stories];
  const stakeholders = project.registers.filter(
    (item) => inGoal(goal, item) && item.type === "Stakeholder",
  );
  const reviewedStatuses = new Set(["in-review", "approved"]);

  switch (currentGate) {
    case "Setup":
      return [
        {
          id: "goal-defined",
          label: "Goal and outcome defined",
          description: "Confirm the purpose and expected outcome for this workflow.",
          complete: Boolean(goal.title.trim() && goal.description.trim()),
          route: "goals",
        },
        {
          id: "source-approved",
          label: "At least one source reviewed",
          description: "Review a source and approve it for this goal before discovery.",
          complete: approvedSources.length > 0,
          route: "sources",
        },
        {
          id: "governance-selected",
          label: "Governance context selected",
          description: "Keep at least one applicable safeguard or policy pack active.",
          complete: project.governancePacks.length > 0,
          route: "governance",
        },
      ];
    case "Discover":
      return [
        {
          id: "source-scope",
          label: "Discovery evidence in scope",
          description: "The active goal must retain at least one reviewed source.",
          complete: approvedSources.length > 0,
          route: "sources",
        },
        {
          id: "stakeholder-recorded",
          label: "Stakeholder recorded",
          description: "Identify at least one stakeholder for the goal.",
          complete: stakeholders.length > 0,
          route: "registers",
        },
        {
          id: "questions-recorded",
          label: "Clarification questions recorded",
          description: "Capture at least one uncertainty, decision or question from discovery.",
          complete: clarifications.length > 0,
          route: "workflow",
        },
      ];
    case "Clarify":
      return [
        {
          id: "clarifications-reviewed",
          label: "Clarification queue reviewed",
          description: "Record, defer or discard the questions raised during discovery.",
          complete:
            clarifications.length > 0 &&
            clarifications.every((item) => item.status !== "Unanswered"),
          route: "workflow",
        },
        {
          id: "blocking-answers",
          label: "Blocking decisions resolved",
          description: "Every blocking question needs a recorded stakeholder answer.",
          complete: blockers(project, goal.id) === 0,
          route: "workflow",
        },
        {
          id: "answer-recorded",
          label: "At least one answer recorded",
          description: "Retain the confirmed answer that will support definition work.",
          complete: clarifications.some(
            (item) => item.status === "Answered" && Boolean(item.answer?.trim()),
          ),
          route: "workflow",
        },
      ];
    case "Define":
      return [
        {
          id: "artifacts-created",
          label: "Requirements or stories drafted",
          description: "Create at least one governed requirement or user story.",
          complete: artifacts.length > 0,
          route: "artifacts",
        },
        {
          id: "criteria-written",
          label: "Testable acceptance criteria added",
          description: "Every defined artifact needs at least one measurable criterion.",
          complete:
            artifacts.length > 0 &&
            requirements.every((item) => item.fitCriteria.some(Boolean)) &&
            stories.every((item) => item.criteria.some(Boolean)),
          route: "artifacts",
        },
        {
          id: "evidence-linked",
          label: "Evidence references attached",
          description: "Every requirement and story must identify its supporting context.",
          complete:
            artifacts.length > 0 &&
            requirements.every((item) => item.sourceIds.length > 0) &&
            stories.every((item) => item.sourceIds.length > 0),
          route: "artifacts",
        },
      ];
    case "Validate":
      return [
        {
          id: "no-blockers",
          label: "No blocking findings",
          description: "Resolve blocking questions and governance findings.",
          complete: blockers(project, goal.id) === 0,
          route: "governance",
        },
        {
          id: "artifacts-reviewed",
          label: "Artifacts submitted for review",
          description: "Requirements and stories must be in review or approved.",
          complete:
            artifacts.length > 0 &&
            artifacts.every((item) => reviewedStatuses.has(item.status)),
          route: "artifacts",
        },
        {
          id: "evidence-verified",
          label: "Evidence paths verified",
          description: "Verify a current evidence path for every requirement and story.",
          complete:
            artifacts.length > 0 &&
            artifacts.every((item) => supportedByVerifiedLink(project, item.id)),
          route: "traceability",
        },
        {
          id: "approval-ready",
          label: "Approval policy satisfied",
          description: "Complete artifact, diagram, document and authority reviews.",
          complete: approvalAllowed(project, goal.id),
          route: "activity",
        },
      ];
    case "Approve": {
      const scopedIds = new Set(
        [
          ...project.requirements,
          ...project.stories,
          ...project.diagrams,
          ...project.documents,
        ]
          .filter((item) => inGoal(goal, item))
          .map((item) => item.id),
      );
      const hasCurrentBaseline = project.versions.some(
        (version) =>
          version.type === "Baseline" &&
          version.locked &&
          scopedIds.size > 0 &&
          [...scopedIds].every((id) =>
            version.manifest?.some(
              (item) => item.id === id && item.revision === revisionOf(project, id),
            ),
          ),
      );
      return [
        {
          id: "baseline-approved",
          label: "Approved baseline created",
          description: "Lock the reviewed, goal-scoped package as an approved baseline.",
          complete: hasCurrentBaseline,
          route: "activity",
        },
        {
          id: "changes-revalidated",
          label: "Implemented changes revalidated",
          description: "Any implemented change must be revalidated before completion.",
          complete: project.changes
            .filter((item) => inGoal(goal, item))
            .every((item) => item.status !== "Implemented"),
          route: "changes",
        },
      ];
    }
  }
}

export const stageReadinessIssues = (project: Project, gate?: WorkflowGate) =>
  stageReadiness(project, gate)
    .filter((item) => !item.complete)
    .map((item) => item.label);

export const canAdvanceStage = (project: Project) => {
  const goal = activeGoal(project);
  return Boolean(
    goal && goal.gate !== "Approve" && stageReadinessIssues(project, goal.gate).length === 0,
  );
};

export const canCompleteGoal = (project: Project, goalId: string) => {
  const goal = project.goals.find((item) => item.id === goalId);
  return Boolean(
    goal &&
      goal.gate === "Approve" &&
      stageReadinessIssues({ ...project, activeGoalId: goalId }, "Approve").length === 0,
  );
};

export const canCreateBaseline = (project: Project) => {
  const goal = activeGoal(project);
  return Boolean(goal && goal.gate === "Approve" && approvalAllowed(project, goal.id));
};
