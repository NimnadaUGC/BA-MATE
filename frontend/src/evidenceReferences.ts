import type { Project } from "./types";
import { revisionOf } from "./store";
import { passageLabel, traceDisplayStatus } from "./tracePassage";

/** Keep relationship status and recorded endpoint revisions visible in exported text. */
export function evidenceReferences(project: Project, artifactId: string, recordedSourceIds: string[]): string[] {
  const links = project.traceLinks.filter(link => link.to === artifactId);
  const represented = new Set(links.map(link => link.from));
  const recorded = recordedSourceIds.filter(id => !represented.has(id)).map(id => `${id} (listed source; link review status not recorded)`);
  const linked = links.map(link => {
    const current = link.status === "Verified" && link.fromRevision === revisionOf(project, link.from) && link.toRevision === revisionOf(project, link.to);
    const status = traceDisplayStatus(project, link) === "Broken" && link.status !== "Broken" ? `Broken: linked record missing (recorded ${link.status})` : link.status === "Verified" && !current ? "Verified at older or unspecified revisions; review needed" : link.status === "Verified" && traceDisplayStatus(project, link) === "Pending" ? "Verified with a stale passage; review needed" : link.status;
    const revisionLabel = link.status === "Verified" ? "reviewed revisions" : "recorded endpoint revisions (not verified)";
    return `${link.from} — ${link.relation} (${status}; ${revisionLabel} ${link.fromRevision ?? "?"} → ${link.toRevision ?? "?"}; ${passageLabel(project, link)}; link ${link.id})`;
  });
  return [...recorded, ...linked];
}
