import { storyNarrative } from "./storyNarrative";
import type { ArtifactReference, ChangePatch, ChangeRequest, DocumentSyncChange, DocumentSyncProposal, Project, ProjectDocument } from "./types";
import { approvalIssuesForArtifact, artifactTypeOf, revisionManifest, revisionOf } from "./store";
import { evidenceReferences } from "./evidenceReferences";

/** Include recorded impacts and downstream artifacts that explicitly reference them. */
export function changeAffectedIds(project: Project, change: ChangeRequest): string[] {
  const ids = new Set([
    ...(change.patches ?? []).filter(patch => patch.status === "Applied").map(patch => patch.artifactId),
    ...change.impacts.filter(impact => impact.selected).map(impact => impact.id),
  ]);
  let size = -1;
  while (size !== ids.size) {
    size = ids.size;
    project.traceLinks.forEach(link => { if (ids.has(link.from)) ids.add(link.to); });
    project.requirements.forEach(item => { if (item.dependencies.some(id => ids.has(id))) ids.add(item.id); });
    project.stories.forEach(item => { if ([...item.requirementIds, ...item.dependencies].some(id => ids.has(id))) ids.add(item.id); });
    project.diagrams.forEach(item => { if (item.linkedIds.some(id => ids.has(id))) ids.add(item.id); });
    project.documents.forEach(item => {
      if (item.sections.some(section => [...section.linkedIds, ...section.blocks.flatMap(block => [...block.linkedIds, ...(block.embedding ? [block.embedding.diagramId] : [])])].some(id => ids.has(id)))) ids.add(item.id);
    });
  }
  return [...ids].sort();
}

export function changeRevalidationIssues(project: Project, change: ChangeRequest): string[] {
  const issues: string[] = [];
  const patches = (change.patches ?? []).filter(patch => patch.status === "Applied");
  if (!patches.length) issues.push("No implemented content patches were found.");
  for (const patch of patches) {
    if (patchValue(project, patch) !== patch.after || revisionOf(project, patch.artifactId) <= patch.sourceRevision) issues.push(`${patch.artifactId}: the implemented content or revision no longer matches the patch.`);
  }
  const artifacts = [...project.requirements, ...project.stories, ...project.diagrams, ...project.documents];
  for (const id of changeAffectedIds(project, change)) {
    const item = artifacts.find(artifact => artifact.id === id);
    if (!item) { issues.push(`${id}: the affected artifact is missing or cannot be reviewed.`); continue; }
    const reviewed = "approvalStatus" in item
      ? ["In review", "Approved", "Current"].includes(item.status) && item.approvalStatus !== "Draft"
      : ["in-review", "approved"].includes(item.status);
    if (!reviewed) issues.push(`${id}: submit the affected artifact for review.`);
    for (const issue of approvalIssuesForArtifact(project, id, item.goalId)) issues.push(`${id}: ${issue}`);
  }
  return [...new Set(issues)];
}

export function changeRevalidationIsCurrent(project: Project, change: ChangeRequest): boolean {
  if (change.status !== "Revalidated" || !change.revalidationRevisions || changeRevalidationIssues(project, change).length) return false;
  const ids = changeAffectedIds(project, change);
  return ids.length > 0 && ids.length === Object.keys(change.revalidationRevisions).length && ids.every(id => change.revalidationRevisions![id] === revisionOf(project, id));
}

export const changesNeedingRevalidation = (project: Project) => project.changes.filter(change =>
  change.status === "Implemented" || ((change.status === "Revalidated" || (change.patches ?? []).some(patch => patch.status === "Applied")) && !changeRevalidationIsCurrent(project, change)),
);

/** Resolve only explicit governed references, without interpreting free text. */
export function governedReferenceClosure(project: Project, startingIds: string[]): string[] {
  const included = new Set<string>();
  const governed = [...project.requirements, ...project.stories, ...project.diagrams, ...project.documents];
  const include = (id: string) => {
    if (!included.has(id) && governed.some(item => item.id === id)) {
      included.add(id);
    }
  };
  startingIds.forEach(include);
  // Follow explicit references to their governed records, including pinned
  // diagrams. Ignore ordinary prose in dependency fields and non-governed
  // source, decision and clarification records.
  for (const id of included) {
    const document = project.documents.find(item => item.id === id);
    document?.sections.forEach(section => {
      section.linkedIds.forEach(include);
      section.blocks.forEach(block => {
        block.linkedIds.forEach(include);
        if (block.embedding) include(block.embedding.diagramId);
      });
    });
    project.diagrams.find(item => item.id === id)?.linkedIds.forEach(include);
    const requirement = project.requirements.find(item => item.id === id);
    if (requirement) [...requirement.storyIds, ...requirement.dependencies].forEach(include);
    const story = project.stories.find(item => item.id === id);
    if (story) [...story.requirementIds, ...story.dependencies].forEach(include);
  }
  return [...included];
}

export function missingDocumentReferences(project: Project, document: Project["documents"][number]): string[] {
  const known = new Set(["PROJECT-BRIEF", "PROJECT-GOVERNANCE", ...project.goals.map(item => item.id), ...project.sources.map(item => item.id), ...project.clarifications.map(item => item.id), ...project.registers.map(item => item.id), ...project.checks.map(item => item.id), ...project.changes.map(item => item.id), ...project.requirements.map(item => item.id), ...project.stories.map(item => item.id), ...project.diagrams.map(item => item.id), ...project.documents.map(item => item.id)]);
  return [...new Set(document.sections.flatMap(section => [...section.linkedIds, ...section.blocks.flatMap(block => block.linkedIds)]).filter(id => !known.has(id)))];
}

/** Include revalidated impacts and their explicitly linked governed dependencies. */
export function baselineManifestWithChanges(project: Project, goalId = project.activeGoalId) {
  const ids = revisionManifest(project, goalId).map(item => item.id);
  for (const change of project.changes) {
    if ((!change.goalId || change.goalId === goalId) && changeRevalidationIsCurrent(project, change)) ids.push(...changeAffectedIds(project, change));
  }
  const manifest = governedReferenceClosure(project, ids).map(id => ({ id, type: artifactTypeOf(project, id), revision: revisionOf(project, id) }));
  return manifest;
}

/** Apply the same review policy to dependencies included from other goals. */
export function baselineDependencyIssues(project: Project, goalId = project.activeGoalId): string[] {
  const issues: string[] = [];
  const artifacts = [...project.requirements, ...project.stories, ...project.diagrams, ...project.documents];
  for (const reference of baselineManifestWithChanges(project, goalId)) {
    const item = artifacts.find(artifact => artifact.id === reference.id);
    if (!item) { issues.push(`${reference.id}: referenced artifact is missing.`); continue; }
    const reviewed = "approvalStatus" in item
      ? ["In review", "Approved", "Current"].includes(item.status) && item.approvalStatus !== "Draft"
      : ["in-review", "approved"].includes(item.status);
    if (!reviewed) issues.push(`${item.id}: submit the included artifact for review.`);
    for (const issue of approvalIssuesForArtifact(project, item.id, item.goalId)) issues.push(`${item.id}: ${issue}`);
    if ("sections" in item) {
      missingDocumentReferences(project, item).forEach(id => issues.push(`${item.id}: linked record ${id} is missing.`));
      for (const section of item.sections) for (const block of section.blocks) {
        if (block.embedding && !project.diagrams.some(diagram => diagram.id === block.embedding!.diagramId)) issues.push(`${item.id}: embedded diagram ${block.embedding.diagramId} is missing.`);
      }
    }
  }
  return [...new Set(issues)];
}

const lines = (title: string, values: string[]) => values.filter(Boolean).length ? `\n${title}:\n${values.filter(Boolean).map(value => `- ${value}`).join("\n")}` : "";

/** Complete, human-readable SRS content for a single reviewed artifact. */
export function srsContent(project: Project, artifactId: string): string {
  const requirement = project.requirements.find(item => item.id === artifactId);
  if (requirement) {
    return `${requirement.id} — ${requirement.title}\n\nStatement: ${requirement.statement}${lines("Acceptance criteria", requirement.fitCriteria)}${lines("Business rules", requirement.businessRules)}${requirement.rationale ? `\n\nRationale: ${requirement.rationale}` : ""}${lines("Dependencies", requirement.dependencies)}${lines("Evidence and related links", evidenceReferences(project, requirement.id, requirement.sourceIds))}`;
  }
  const story = project.stories.find(item => item.id === artifactId);
  if (!story) throw new Error(`The selected artifact ${artifactId} no longer exists.`);
  return `${story.id} — User story\n\n${storyNarrative(story)}${lines("Acceptance criteria", story.criteria)}${lines("Dependencies", story.dependencies)}${lines("Evidence and related links", evidenceReferences(project, story.id, story.sourceIds))}`;
}

export function syncProvenance(project: Project, artifactId: string): ArtifactReference[] {
  const requirement = project.requirements.find(item => item.id === artifactId);
  if (requirement) return [{ id: requirement.id, type: "Requirement", label: requirement.title, version: requirement.version }];
  const story = project.stories.find(item => item.id === artifactId);
  if (story) return [{ id: story.id, type: "User story", label: story.goal, version: story.version }];
  return [];
}

/** Only replace blocks explicitly created by sync for this single artifact. */
export function findSyncBlock(document: ProjectDocument | undefined, artifactId: string) {
  return document?.sections.flatMap(section => section.blocks.map(block => ({ section, block })))
    .find(({ block }) => block.syncArtifactId === artifactId && block.linkedIds.length === 1 && block.linkedIds[0] === artifactId &&
      block.type === (artifactId.startsWith("US") ? "stories-table" : "requirements-table"));
}

export function syncProposalIsStale(project: Project, proposal: DocumentSyncProposal): boolean {
  const target = proposal.targetDocumentId ? project.documents.find(document => document.id === proposal.targetDocumentId) : undefined;
  if (proposal.targetDocumentId && (!target || target.status !== "draft" || target.version !== proposal.targetDocumentRevision)) return true;
  return proposal.changes.some(change => {
    if (revisionOf(project, change.artifactId) !== change.sourceRevision) return true;
    const artifact = project.requirements.find(item => item.id === change.artifactId) ?? project.stories.find(item => item.id === change.artifactId);
    if (!artifact || artifact.status !== "approved") return true;
    if (change.action === "remove") return true;
    if (change.action === "add") return Boolean(change.targetBlockId);
    const match = findSyncBlock(target, change.artifactId);
    return !match || match.block.id !== change.targetBlockId || match.section.id !== change.targetSectionId || match.block.content !== change.before;
  });
}

export function patchValue(project: Project, patch: ChangePatch): string | undefined {
  const requirement = project.requirements.find(item => item.id === patch.artifactId);
  if (requirement && patch.field === "statement") return requirement.statement;
  if (requirement && patch.field === "criteria") return requirement.fitCriteria.join("\n");
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
  const targets = new Set<string>();
  for (const patch of patches) {
    const target = JSON.stringify([patch.artifactId, patch.field, patch.field === "content" ? patch.targetId ?? null : null]);
    if (targets.has(target)) return `More than one selected patch changes the same content in ${patch.artifactId}. Keep only one patch for that content.`;
    targets.add(target);
  }
  if (patches.some(patch => !patch.after.trim() || patch.after === patch.before)) return "Each accepted patch must contain a substantive changed value.";
  const stale = patches.find(patch => !patchIsCurrent(project, patch));
  return stale ? `${stale.id} is stale because its source content or revision changed. Re-run impact review.` : undefined;
}

export function applyAcceptedPatches(project: Project, change: ChangeRequest) {
  const patches = (change.patches ?? []).filter(patch => patch.selected && patch.status === "Accepted");
  const revised = new Set<string>();
  const advance = (artifact: { id: string; version: number }) => {
    if (!revised.has(artifact.id)) { artifact.version++; revised.add(artifact.id); }
  };
  for (const patch of patches) {
    const requirement = project.requirements.find(item => item.id === patch.artifactId);
    if (requirement && (patch.field === "statement" || patch.field === "criteria")) {
      if (patch.field === "statement") requirement.statement = patch.after;
      else requirement.fitCriteria = patch.after.split("\n").map(value => value.trim()).filter(Boolean);
      advance(requirement);
      requirement.status = "draft";
    }
    const story = project.stories.find(item => item.id === patch.artifactId);
    if (story && patch.field === "criteria") {
      story.criteria = patch.after.split("\n").map(value => value.trim()).filter(Boolean);
      advance(story);
      story.status = "draft";
    }
    const diagram = project.diagrams.find(item => item.id === patch.artifactId);
    if (diagram && patch.field === "source") {
      diagram.source = patch.after;
      advance(diagram);
      diagram.status = "Draft";
      diagram.approvalStatus = "Draft";
      diagram.versions.unshift({ version: diagram.version, source: diagram.source, at: new Date().toISOString(), actor: "Business analyst", note: `Implemented ${change.id}` });
    }
    const document = project.documents.find(item => item.id === patch.artifactId);
    if (document && patch.field === "content" && patch.targetId) {
      const block = document.sections.flatMap(section => section.blocks).find(item => item.id === patch.targetId);
      if (!block) throw new Error(`The selected document block ${patch.targetId} no longer exists.`);
      block.content = patch.after;
      advance(document);
      document.status = "draft";
    }
    patch.status = "Applied";
  }
}

export function selectedChangePatchIds(change: ChangeRequest) {
  return (change.patches ?? []).filter(patch => patch.selected).map(patch => patch.artifactId);
}

export type { DocumentSyncChange };
