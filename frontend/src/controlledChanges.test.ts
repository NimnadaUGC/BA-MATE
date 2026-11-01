import { describe, expect, it } from "vitest";
import { applyAcceptedPatches, baselineDependencyIssues, baselineManifestWithChanges, changeAffectedIds, changeRevalidationIsCurrent, changeRevalidationIssues, findSyncBlock, patchIsCurrent, srsContent, syncProposalIsStale, validateAcceptedPatches } from "./controlledChanges";
import { freshState } from "./store";
import { pinSyntheticSources } from "./testSourceFixtures";
import { canCreateBaseline, stageReadiness } from "./workflowReadiness";
import type { ChangeRequest, DocumentSyncProposal } from "./types";

describe("revision-safe document synchronization and controlled changes", () => {
  it("does not treat a manually linked paragraph as a replaceable synchronization block", () => {
    const project = freshState().projects[0];
    const artifact = project.requirements[0]; artifact.status = "approved";
    const document = project.documents[0]; const section = document.sections[0];
    section.blocks = [{ id: 'manual', type: 'paragraph', content: 'Preserve this paragraph', linkedIds: [artifact.id] }];
    expect(findSyncBlock(document, artifact.id)).toBeUndefined();
    const proposal: DocumentSyncProposal = { id: 'old', mode: 'update-srs', status: 'pending', createdAt: 'now', targetDocumentId: document.id, targetDocumentRevision: document.version,
      changes: [{ id: 'change', artifactId: artifact.id, action: 'update', sectionTitle: section.title, targetSectionId: section.id, targetBlockId: 'manual', before: 'Preserve this paragraph', after: 'Replacement', accepted: true, provenance: [], sourceRevision: artifact.version }] };
    expect(syncProposalIsStale(project, proposal)).toBe(true);
    section.blocks.push({ id: 'controlled', type: 'requirements-table', content: 'Prior sync', linkedIds: [artifact.id], syncArtifactId: artifact.id });
    proposal.changes[0].targetBlockId = 'controlled'; proposal.changes[0].before = 'Prior sync';
    expect(syncProposalIsStale(project, proposal)).toBe(false);
    section.blocks[1].linkedIds.push('FR-other');
    expect(syncProposalIsStale(project, proposal)).toBe(true);
    section.blocks[1].linkedIds = [artifact.id];
    document.status = 'approved';
    expect(syncProposalIsStale(project, proposal)).toBe(true);
  });
  it("includes linked cross-goal document dependencies and blocks unreviewed or missing diagrams", () => {
    const project = freshState().projects[0];
    pinSyntheticSources(project);
    const goal = project.goals[0]; project.activeGoalId = goal.id; goal.gate = "Approve";
    const other = project.requirements[0], active = structuredClone(other);
    other.goalId = "previous-goal"; other.status = "in-review";
    active.id = "FR-active"; active.goalId = goal.id; active.status = "in-review";
    project.requirements = [active, other]; project.stories = []; project.changes = [];
    project.checks = []; project.clarifications = [];
    project.traceLinks = [active, other].map(item => ({ id: `TR-${item.id}`, from: "PROJECT-BRIEF", to: item.id, fromRevision: 1, toRevision: item.version, relation: "supports", status: "Verified" as const }));
    const document = project.documents[0], diagram = project.diagrams[0];
    document.goalId = goal.id; document.status = "in-review";
    document.sections = [document.sections[0]]; document.sections[0].linkedIds = [];
    const block = document.sections[0].blocks[0];
    document.sections[0].blocks = [block]; block.linkedIds = []; block.embedding = { diagramId: diagram.id, version: diagram.version, stale: false, insertedAt: "now" };
    diagram.goalId = "previous-goal"; diagram.linkedIds = [other.id]; diagram.status = "Draft"; diagram.approvalStatus = "Draft";
    const ids = baselineManifestWithChanges(project).map(item => item.id);
    expect(ids).toContain(diagram.id); expect(ids).toContain(other.id);
    expect(baselineDependencyIssues(project).join(" ")).toContain(`${diagram.id}: submit`);
    expect(canCreateBaseline(project)).toBe(false);
    diagram.status = "In review"; diagram.approvalStatus = "In review";
    expect(baselineDependencyIssues(project)).toEqual([]);
    expect(canCreateBaseline(project)).toBe(true);
    project.versions = [{ id: "incomplete", label: "old", version: "B1", at: "now", actor: "BA", type: "Baseline", locked: true, changes: "", manifest: baselineManifestWithChanges(project).filter(item => item.id !== diagram.id) }];
    expect(stageReadiness(project).find(item => item.id === "baseline-approved")?.complete).toBe(false);
    block.linkedIds = ["FR-missing"];
    expect(baselineDependencyIssues(project).join(" ")).toContain("linked record FR-missing is missing");
    block.linkedIds = [];
    project.diagrams = [];
    expect(baselineDependencyIssues(project).join(" ")).toContain("embedded diagram");
    expect(canCreateBaseline(project)).toBe(false);
  });
  it("requires the changed artifact and downstream evidence to be reviewed, regardless of the active goal", () => {
    const project = freshState().projects[0];
    const requirement = project.requirements[0];
    project.requirements = [requirement]; project.stories = []; project.diagrams = []; project.documents = [];
    project.checks = []; project.clarifications = [];
    requirement.goalId = "original"; project.activeGoalId = "unrelated";
    const change: ChangeRequest = { id: "CR-review", title: "Change", rationale: "Reason", source: "Test", status: "Implemented", goalId: "unrelated", impacts: [], patches: [{ id: "CP", artifactId: requirement.id, artifactType: "Requirement", field: "statement", before: requirement.statement, after: "Revised statement", sourceRevision: requirement.version, selected: true, status: "Accepted" }] };
    applyAcceptedPatches(project, change);
    project.traceLinks = [{ id: "TR", from: "PROJECT-BRIEF", to: requirement.id, fromRevision: 1, toRevision: requirement.version, relation: "evidence", status: "Pending" }];
    expect(changeRevalidationIssues(project, change).join(" ")).toContain("submit the affected artifact");
    requirement.status = "in-review";
    expect(changeRevalidationIssues(project, change).join(" ")).toContain("pending trace");
    project.traceLinks[0].status = "Verified";
    expect(changeRevalidationIssues(project, change)).toEqual([]);
    change.status = "Revalidated";
    expect(changeRevalidationIsCurrent(project, change)).toBe(false);
    change.revalidationRevisions = Object.fromEntries(changeAffectedIds(project, change).map(id => [id, requirement.version]));
    expect(changeRevalidationIsCurrent(project, change)).toBe(true);
    project.changes = [change];
    expect(baselineManifestWithChanges(project).find(item => item.id === requirement.id)?.revision).toBe(requirement.version);
    expect(baselineManifestWithChanges(project, "a-different-goal").some(item => item.id === requirement.id)).toBe(false);
    requirement.version++;
    expect(changeRevalidationIsCurrent(project, change)).toBe(false);
    project.requirements = [];
    expect(changeRevalidationIssues(project, change).join(" ")).toContain("missing");
  });
  it("creates complete SRS content instead of a title-and-statement placeholder", () => {
    const project = freshState().projects[0];
    const content = srsContent(project, "FR-01");
    expect(content).toContain("Acceptance criteria");
    expect(content).toContain("Business rules");
    expect(content).toContain("Rationale:");
    expect(content).toContain("Dependencies");
    expect(content).toContain("Evidence");
  });

  it("marks a synchronization proposal stale when either source or target revision changes", () => {
    const project = freshState().projects[0];
    project.requirements[0].status = "approved";
    const proposal: DocumentSyncProposal = {
      id: "DSP", targetDocumentId: "DOC-01", targetDocumentRevision: project.documents[0].version,
      mode: "update-srs", status: "pending", createdAt: "now",
      changes: [{ id: "DSC", artifactId: "FR-01", action: "add", sectionTitle: "Requirements", before: "", after: "new", accepted: true, provenance: [], sourceRevision: project.requirements[0].version }],
    };
    expect(syncProposalIsStale(project, proposal)).toBe(false);
    project.requirements[0].version++;
    expect(syncProposalIsStale(project, proposal)).toBe(true);
    project.requirements[0].version--;
    project.requirements[0].status = "draft";
    expect(syncProposalIsStale(project, proposal)).toBe(true);
    project.requirements[0].status = "approved";
    project.documents[0].version++;
    expect(syncProposalIsStale(project, proposal)).toBe(true);
  });

  it("refuses an unchanged or stale patch before any content mutation", () => {
    const project = freshState().projects[0];
    const original = project.requirements[0].statement;
    const change: ChangeRequest = {
      id: "CR", title: "Change", rationale: "Reason", source: "Test", status: "Approved", impacts: [],
      patches: [{ id: "CP", artifactId: "FR-01", artifactType: "Requirement", field: "statement", before: original, after: original, sourceRevision: project.requirements[0].version, selected: true, status: "Accepted" }],
    };
    expect(validateAcceptedPatches(project, change)).toContain("substantive");
    expect(project.requirements[0].statement).toBe(original);
    change.patches![0].after = "The system shall retain a confirmed request with its review decision.";
    project.requirements[0].version++;
    expect(validateAcceptedPatches(project, change)).toContain("stale");
    expect(project.requirements[0].statement).toBe(original);
  });

  it("rejects competing patches for the same field before either can overwrite the other", () => {
    const project = freshState().projects[0];
    const item = project.requirements[0];
    const patch = { id: "CP-1", artifactId: item.id, artifactType: "Requirement" as const, field: "statement" as const, before: item.statement, after: "First proposed change", sourceRevision: item.version, selected: true, status: "Accepted" as const };
    const change: ChangeRequest = { id: "CR", title: "Change", rationale: "Reason", source: "Test", status: "Approved", impacts: [], patches: [patch, { ...patch, id: "CP-2", after: "Competing proposed change" }] };
    expect(validateAcceptedPatches(project, change)).toContain("same content");
    expect(item.statement).toBe(patch.before);
  });

  it("applies selected accepted patches to concrete content and records their applied state", () => {
    const project = freshState().projects[0];
    const requirement = project.requirements[0];
    const change: ChangeRequest = {
      id: "CR", title: "Change", rationale: "Reason", source: "Test", status: "Approved", impacts: [],
      patches: [{ id: "CP", artifactId: requirement.id, artifactType: "Requirement", field: "statement", before: requirement.statement, after: "The system shall record the request and expose a review outcome.", sourceRevision: requirement.version, selected: true, status: "Accepted" }],
    };
    expect(patchIsCurrent(project, change.patches![0])).toBe(true);
    expect(validateAcceptedPatches(project, change)).toBeUndefined();
    applyAcceptedPatches(project, change);
    expect(requirement.statement).toContain("review outcome");
    expect(requirement.status).toBe("draft");
    expect(change.patches![0].status).toBe("Applied");
  });

  it("atomically supports story criteria, diagrams and a targeted document block", () => {
    const project = freshState().projects[0];
    const story = project.stories[0], diagram = project.diagrams[0], document = project.documents[0];
    const block = document.sections[0].blocks[0];
    const change: ChangeRequest = {
      id: "CR-all", title: "Change", rationale: "Reason", source: "Test", status: "Approved", impacts: [],
      patches: [
        { id: "story", artifactId: story.id, artifactType: "User story", field: "criteria", before: story.criteria.join("\n"), after: "Given a valid request, when it is submitted, then a review status is shown.", sourceRevision: story.version, selected: true, status: "Accepted" },
        { id: "diagram", artifactId: diagram.id, artifactType: "Diagram", field: "source", before: diagram.source, after: `${diagram.source}\n  D --> F[Record rationale]`, sourceRevision: diagram.version, selected: true, status: "Accepted" },
        { id: "document", artifactId: document.id, artifactType: "Document", targetId: block.id, field: "content", before: block.content, after: "Revised controlled document content.", sourceRevision: document.version, selected: true, status: "Accepted" },
      ],
    };
    expect(validateAcceptedPatches(project, change)).toBeUndefined();
    applyAcceptedPatches(project, change);
    expect(story.criteria[0]).toContain("review status");
    expect(diagram.source).toContain("Record rationale");
    expect(block.content).toBe("Revised controlled document content.");
    expect(change.patches!.every(patch => patch.status === "Applied")).toBe(true);
  });
});

it('applies requirement statement and criteria together as one content revision', () => {
  const project = freshState().projects[0], requirement = project.requirements[0];
  const original = structuredClone(requirement), version = requirement.version;
  const change: ChangeRequest = { id:'CR-cap',title:'Reduce limit',rationale:'Confirmed change',source:'Synthetic owner',status:'Approved',impacts:[],patches:[
    {id:'statement',artifactId:requirement.id,artifactType:'Requirement',field:'statement',before:requirement.statement,after:'Maximum change is 300.',sourceRevision:version,selected:true,status:'Accepted'},
    {id:'criteria',artifactId:requirement.id,artifactType:'Requirement',field:'criteria',before:requirement.fitCriteria.join('\n'),after:'Allow exactly 300.\nReject 301.',sourceRevision:version,selected:true,status:'Accepted'},
  ] };
  expect(validateAcceptedPatches(project,change)).toBeUndefined();
  applyAcceptedPatches(project,change);
  expect(requirement.statement).toBe('Maximum change is 300.');
  expect(requirement.fitCriteria).toEqual(['Allow exactly 300.','Reject 301.']);
  expect(requirement.version).toBe(version+1);
  expect(requirement.status).toBe('draft');
  expect(original.statement).not.toBe(requirement.statement);
  expect(change.patches!.every(patch=>patch.status==='Applied')).toBe(true);
});

it('rejects requirement criteria that changed after impact review, even without a revision bump', () => {
  const project=freshState().projects[0], requirement=project.requirements[0];
  const change: ChangeRequest={id:'CR-stale',title:'Change',rationale:'Test',source:'Test',status:'Approved',impacts:[],patches:[{id:'criteria',artifactId:requirement.id,artifactType:'Requirement',field:'criteria',before:requirement.fitCriteria.join('\n'),after:'Allow 300.',sourceRevision:requirement.version,selected:true,status:'Accepted'}]};
  requirement.fitCriteria.push('Another review changed the criteria.');
  expect(validateAcceptedPatches(project,change)).toContain('stale');
});
