import type { Project, TraceLink } from './types';
import { revisionOf, sourcePassageCurrent, sourcePassagePins } from './store';

export function traceEndpointExists(project: Project, id: string): boolean {
  return id === 'PROJECT-BRIEF' || id === 'PROJECT-GOVERNANCE' || [
    ...project.sources, ...project.clarifications, ...project.requirements, ...project.stories,
    ...project.registers, ...project.checks, ...project.diagrams, ...project.documents,
    ...project.changes, ...project.goals,
  ].some(item => item.id === id);
}

export function traceDisplayStatus(project: Project, link: TraceLink): TraceLink['status'] {
  if (!traceEndpointExists(project, link.from) || !traceEndpointExists(project, link.to)) return 'Broken';
  if (link.status === 'Verified' && (link.fromRevision !== revisionOf(project, link.from) || link.toRevision !== revisionOf(project, link.to) || !passageIsCurrent(project, link))) return 'Pending';
  return link.status;
}

export function passageIsCurrent(project: Project, link: TraceLink): boolean {
  return sourcePassageCurrent(project, link);
}

export function passageLabel(project: Project, link: TraceLink): string {
  const pins = sourcePassagePins(link);
  return pins.length ? pins.map(pin => `${pin.sourceId} ${pin.locator} (source v${pin.sourceRevision}${sourcePassageCurrent(project, { ...link, sourcePassage: pin, sourcePassages: undefined }) ? '' : '; review needed'})`).join('; ') : 'No source passage selected';
}

/** Compare exactly what was checked before permitting a queued verification. */
export function traceReviewFingerprint(project: Project, link: TraceLink): string {
  const sources = project.sources.filter(source => source.id === link.from || source.id === link.to).map(source => ({
    id: source.id, revision: revisionOf(project, source.id), sha256: source.sha256,
    path: source.relativePath, approved: source.approved, status: source.status,
  }));
  return JSON.stringify({ link, fromExists: traceEndpointExists(project, link.from), toExists: traceEndpointExists(project, link.to), fromRevision: revisionOf(project, link.from), toRevision: revisionOf(project, link.to),
    workspaceId: project.workspaceId, workspaceKind: project.workspaceKind, workspacePath: project.workspacePath, folderName: project.folderName, sources });
}
