import type { ArtifactReference, ChangePatch, ChangeRequest, DocumentSyncChange, DocumentSyncProposal, Project } from "./types";
import { revisionOf } from "./store";

const lines = (title: string, values: string[]) => values.filter(Boolean).length ? `\n${title}:\n${values.filter(Boolean).map(value => `- ${value}`).join("\n")}` : "";

/** Complete, human-readable SRS content for a single reviewed artifact. */
export function srsContent(project: Project, artifactId: string): string {
  const requirement = project.requirements.find(item => item.id === artifactId);
  if (requirement) {
    const decisions = project.registers
      .filter(item => item.type === "Decision" && (!requirement.goalId || !item.goalId || item.goalId === requirement.goalId))
      .map(item => item.title);
    return `${requirement.id} — ${requirement.title}\n\nStatement: ${requirement.statement}${lines("Acceptance criteria", requirement.fitCriteria)}${lines("Business rules", requirement.businessRules)}${requirement.rationale ? `\n\nRationale: ${requirement.rationale}` : ""}${lines("Dependencies", requirement.dependencies)}${lines("Evidence", requirement.sourceIds)}${lines("Relevant decisions", decisions)}`;
  }
  const story = project.stories.find(item => item.id === artifactId);
  if (!story) throw new Error(`The selected artifact ${artifactId} no longer exists.`);
  return `${story.id} — User story\n\nAs a ${story.role}, I want to ${story.goal}, so that ${story.value}.${lines("Acceptance criteria", story.criteria)}${lines("Dependencies", story.dependencies)}${lines("Evidence", story.sourceIds)}`;
}

export function syncProvenance(project: Project, artifactId: string): ArtifactReference[] {
  const requirement = project.requirements.find(item => item.id === artifactId);
  if (requirement) return [{ id: requirement.id, type: "Requirement", label: requirement.title, version: requirement.version }];
  const story = project.stories.find(item => item.id === artifactId);
  if (story) return [{ id: story.id, type: "User story", label: story.goal, version: story.version }];
  return [];
}

export function syncProposalIsStale(project: Project, proposal: DocumentSyncProposal): boolean {
  const target = proposal.targetDocumentId ? project.documents.find(document => document.id === proposal.targetDocumentId) : undefined;
  if (proposal.targetDocumentId && (!target || target.version !== proposal.targetDocumentRevision)) return true;
  return proposal.changes.some(change => revisionOf(project, change.artifactId) !== change.sourceRevision);
}

export function patchValue(project: Project, patch: ChangePatch): string | undefined {
  const requirement = project.requirements.find(item => item.id === patch.artifactId);
  if (requirement && patch.field === "statement") return requirement.statement;
  const story = project.stories.find(item => item.id === patch.artifactId);
  if (story && patch.field === "criteria") return story.criteria.join("\n");
  const diagram = project.diagrams.find(item => item.id === patch.artifactId);
  if (diagram && patch.field === "source") return diagram.source;
  const document = project.documents.find(item => item.id === patch.artifactId);
  if (document && patch.field === "content" && patch.targetId) {
    return document.sections.flatMap(section => section.blocks).find(block => block.id === patch.targetId)?.content;
  }
  return undefined;
}

export function patchIsCurrent(project: Project, patch: ChangePatch): boolean {
  return revisionOf(project, patch.artifactId) === patch.sourceRevision && patchValue(project, patch) === patch.before;
}

/** Validates every selected accepted patch before any mutation occurs. */
export function validateAcceptedPatches(project: Project, change: ChangeRequest): string | undefined {
  const patches = (change.patches ?? []).filter(patch => patch.selected && patch.status === "Accepted");
  if (!patches.length) return "Accept at least one concrete content patch before implementation.";
  if (patches.some(patch => !patch.after.trim() || patch.after === patch.before)) return "Each accepted patch must contain a substantive changed value.";
  const stale = patches.find(patch => !patchIsCurrent(project, patch));
  return stale ? `${stale.id} is stale because its source content or revision changed. Re-run impact review.` : undefined;
}

export function applyAcceptedPatches(project: Project, change: ChangeRequest) {
  const patches = (change.patches ?? []).filter(patch => patch.selected && patch.status === "Accepted");
  for (const patch of patches) {
    const requirement = project.requirements.find(item => item.id === patch.artifactId);
    if (requirement && patch.field === "statement") {
      requirement.statement = patch.after;
      requirement.version++;
      requirement.status = "draft";
    }
    const story = project.stories.find(item => item.id === patch.artifactId);
    if (story && patch.field === "criteria") {
      story.criteria = patch.after.split("\n").map(value => value.trim()).filter(Boolean);
      story.version++;
      story.status = "draft";
    }
    const diagram = project.diagrams.find(item => item.id === patch.artifactId);
    if (diagram && patch.field === "source") {
      diagram.source = patch.after;
      diagram.version++;
      diagram.status = "Draft";
      diagram.approvalStatus = "Draft";
      diagram.versions.unshift({ version: diagram.version, source: diagram.source, at: new Date().toISOString(), actor: "Business analyst", note: `Implemented ${change.id}` });
    }
    const document = project.documents.find(item => item.id === patch.artifactId);
    if (document && patch.field === "content" && patch.targetId) {
      const block = document.sections.flatMap(section => section.blocks).find(item => item.id === patch.targetId);
      if (!block) throw new Error(`The selected document block ${patch.targetId} no longer exists.`);
      block.content = patch.after;
      document.version++;
      document.status = "draft";
    }
    patch.status = "Applied";
  }
}

export function selectedChangePatchIds(change: ChangeRequest) {
  return (change.patches ?? []).filter(patch => patch.selected).map(patch => patch.artifactId);
}

export type { DocumentSyncChange };
