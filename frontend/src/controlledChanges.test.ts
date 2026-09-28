import { describe, expect, it } from "vitest";
import { applyAcceptedPatches, patchIsCurrent, srsContent, syncProposalIsStale, validateAcceptedPatches } from "./controlledChanges";
import { freshState } from "./store";
import type { ChangeRequest, DocumentSyncProposal } from "./types";

describe("revision-safe document synchronization and controlled changes", () => {
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
    const proposal: DocumentSyncProposal = {
      id: "DSP", targetDocumentId: "DOC-01", targetDocumentRevision: project.documents[0].version,
      mode: "update-srs", status: "pending", createdAt: "now",
      changes: [{ id: "DSC", artifactId: "FR-01", action: "update", sectionTitle: "Requirements", before: "old", after: "new", accepted: true, provenance: [], sourceRevision: project.requirements[0].version }],
    };
    expect(syncProposalIsStale(project, proposal)).toBe(false);
    project.requirements[0].version++;
    expect(syncProposalIsStale(project, proposal)).toBe(true);
    project.requirements[0].version--;
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
