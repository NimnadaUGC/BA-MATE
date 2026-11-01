import { storyNarrative } from "./storyNarrative";
import type { DocumentBlock, Project, ProjectDocument, VersionSnapshot } from './types';
import { downloadBlob, revisionManifest } from './store';
import { governedReferenceClosure, missingDocumentReferences } from './controlledChanges';
import { evidenceReferences } from './evidenceReferences';
import { passageLabel, traceDisplayStatus } from './tracePassage';

export type ExportSelection = { kind: 'working' } | { kind: 'baseline'; baselineId: string };
export interface ExportPackage {
  project: Project; document: ProjectDocument; selection: ExportSelection; label: string;
  approved: boolean; manifest: { id: string; type: string; revision: number }[]; baseline?: VersionSnapshot; exportId?: string;
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const yaml = (value: string | number | boolean) => JSON.stringify(value);
const sectionBlocks = (document: ProjectDocument) => document.sections.flatMap(section => section.blocks);
const linked = (document: ProjectDocument) => new Set(sectionBlocks(document).flatMap(block => block.linkedIds));
const inScope = (goalId?: string) => (item: { goalId?: string }) => !goalId || !item.goalId || item.goalId === goalId;

/** Resolve content before a renderer runs. A baseline only ever uses its immutable snapshot. */
export function resolveExport(project: Project, documentId: string, selection: ExportSelection = { kind: 'working' }): ExportPackage {
  if (selection.kind === 'working') {
    const snapshot = clone(project);
    const document = snapshot.documents.find(item => item.id === documentId);
    if (!document) throw new Error('The selected working document no longer exists.');
    const exportId = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    return { project: snapshot, document, selection, label: `Working revision ${document.version}`, approved: false, manifest: revisionManifest(snapshot), exportId };
  }
  const baseline = project.versions.find(version => version.id === selection.baselineId && version.type === 'Baseline' && version.locked);
  if (!baseline) throw new Error('Choose an existing approved baseline.');
  if (!baseline.snapshot || !baseline.manifest?.length) throw new Error('This older baseline has no immutable content manifest and cannot be exported faithfully.');
  const snapshot = clone(baseline.snapshot) as unknown as Project;
  const document = snapshot.documents?.find(item => item.id === documentId);
  const manifestEntry = baseline.manifest.find(item => item.id === documentId);
  if (!document || !manifestEntry || manifestEntry.revision !== document.version) throw new Error('That document was not part of the selected approved baseline. Select a document from the baseline or export its working revision.');
  const missing = missingDocumentReferences(snapshot, document);
  if (missing.length) throw new Error(`This baseline contains missing document references: ${missing.join(', ')}. Review and create a new baseline.`);
  const governed = [...snapshot.requirements, ...snapshot.stories, ...snapshot.diagrams, ...snapshot.documents];
  for (const id of governedReferenceClosure(snapshot, [document.id])) {
    const item = governed.find(candidate => candidate.id === id)!;
    if (!baseline.manifest.some(reference => reference.id === id && reference.revision === item.version)) throw new Error(`This baseline is incomplete: referenced artifact ${id} is absent or has the wrong revision. Review and create a new baseline.`);
    const approved = 'approvalStatus' in item ? ['Approved', 'Current'].includes(item.status) && item.approvalStatus === 'Approved' : item.status === 'approved';
    if (!approved) throw new Error(`This baseline contains an unapproved referenced artifact: ${id}. Review and create a new baseline.`);
  }
  for (const block of sectionBlocks(document)) if (block.embedding) {
    const diagram = snapshot.diagrams.find(item => item.id === block.embedding!.diagramId);
    if (!diagram || block.embedding.stale || diagram.version !== block.embedding.version) throw new Error(`This baseline has a missing or stale embedded diagram: ${block.embedding.diagramId}. Review and create a new baseline.`);
  }
  return { project: snapshot, document, selection, label: `Approved baseline ${baseline.version}`, approved: true, manifest: baseline.manifest, baseline };
}

const blockText = (block: DocumentBlock) => block.content.trim();
export const diagramCaption = (diagram: Project['diagrams'][number], block: DocumentBlock) => {
  const stale = !!block.embedding && (block.embedding.stale || block.embedding.version !== diagram.version);
  return `${diagram.name} · ${diagram.id} v${diagram.version} · ${diagram.approvalStatus}${stale ? ` · document pin v${block.embedding!.version} needs review; current diagram shown` : ''}`;
};
const tableRows = (text: string) => text.split('\n').map(row => row.trim()).filter(Boolean)
  .filter(row => !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(row))
  .map(row => row.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()));
const bullets = (values: string[]) => values.length ? values.map(value => `- ${value}`).join('\n') : '- None recorded';

function artifactRecord(pkg: ExportPackage, id: string) {
  const { project } = pkg;
  if (id === 'PROJECT-BRIEF') return `### PROJECT-BRIEF — Project brief\n\n- Project: ${project.name}\n- Description: ${project.description}\n- Revision: ${project.briefVersion ?? 1}`;
  if (id === 'PROJECT-GOVERNANCE') return `### PROJECT-GOVERNANCE — Selected governance packs\n\n${bullets(project.governancePacks)}`;
  const source = project.sources.find(item => item.id === id);
  if (source) return `### ${source.id} — ${source.name}\n\n- Type: ${source.type}\n- Review status: ${source.status}\n- Approved for use: ${source.approved ? 'Yes' : 'No'}\n- Revision: ${source.version ?? 1}\n- Provenance: ${source.provenance}${source.sha256 ? `\n- SHA-256: ${source.sha256}` : ''}`;
  const goal = project.goals.find(item => item.id === id);
  if (goal) return `### ${goal.id} — ${goal.title}\n\n- Type: ${goal.kind}\n- Status: ${goal.status}\n- Description: ${goal.description}`;
  const requirement = project.requirements.find(item => item.id === id);
  if (requirement) return `### ${requirement.id} — ${requirement.title}\n\n- Type: ${requirement.kind}\n- Revision: ${requirement.version}\n- Status: ${requirement.status}\n- Statement: ${requirement.statement}\n\n#### Acceptance criteria\n${bullets(requirement.fitCriteria)}\n\n#### Business rules\n${bullets(requirement.businessRules)}\n\n#### Evidence and related links\n${bullets(evidenceReferences(project, requirement.id, requirement.sourceIds))}\n\nDependencies: ${requirement.dependencies.join(', ') || 'None recorded'}`;
  const story = project.stories.find(item => item.id === id);
  if (story) return `### ${story.id} — User story\n\n${storyNarrative(story)}\n\n- Revision: ${story.version}\n- Status: ${story.status}\n\n#### Acceptance criteria\n${bullets(story.criteria)}\n\n#### Evidence and related links\n${bullets(evidenceReferences(project, story.id, story.sourceIds))}\n\nDependencies: ${story.dependencies.join(', ') || 'None recorded'}`;
  const diagram = project.diagrams.find(item => item.id === id);
  if (diagram) return `### ${diagram.id} — ${diagram.name}\n\n- Revision: ${diagram.version}\n- Status: ${diagram.status} / approval ${diagram.approvalStatus}\n- Linked artifacts: ${diagram.linkedIds.join(', ') || 'None'}\n\n\`\`\`mermaid\n${diagram.source}\n\`\`\``;
  const clarification = project.clarifications.find(item => item.id === id);
  if (clarification) return `### ${clarification.id} — Clarification\n\n- Status: ${clarification.status}\n- Question: ${clarification.question}\n- ${clarification.status === 'Unanswered' && clarification.answer ? 'Previous answer — needs reconfirmation' : 'Answer'}: ${clarification.answer ?? 'Unanswered'}\n- Answer confirmed by: ${clarification.answerAuthority || 'Not recorded'}\n- Recorded context: ${(clarification.sourceIds?.length ? clarification.sourceIds : [clarification.sourceId]).join(', ')}`;
  const check = project.checks.find(item => item.id === id);
  if (check) return `### ${check.id} — ${check.title}\n\n- Governance status: ${check.status}\n- Rationale: ${check.rationale}`;
  const register = project.registers.find(item => item.id === id);
  if (register) return `### ${register.id} — ${register.type}\n\n- Status: ${register.status}\n- Detail: ${register.title}`;
  return `### ${id}\n\nNo current record was found in the selected revision.`;
}
function unresolved(pkg: ExportPackage) {
  const references = new Set(pkg.document.sections.flatMap(section => [...section.linkedIds, ...section.blocks.flatMap(block => block.linkedIds)]));
  const governed = [...pkg.project.requirements, ...pkg.project.stories, ...pkg.project.diagrams, ...pkg.project.documents];
  const includedIds = new Set(pkg.approved ? pkg.manifest.map(item => item.id) : governedReferenceClosure(pkg.project, [pkg.document.id]));
  const goals = new Set(governed.filter(item => includedIds.has(item.id)).flatMap(item => item.goalId ? [item.goalId] : []));
  if (pkg.document.goalId) goals.add(pkg.document.goalId);
  const scoped = (item: { id: string; goalId?: string }) => references.has(item.id) || !item.goalId || goals.has(item.goalId);
  const label = (item: { goalId?: string }) => item.goalId ? `; goal ${item.goalId}` : '; project-wide';
  return [
    ...pkg.project.clarifications.filter(item => (scoped(item) || item.affects.some(id => includedIds.has(id))) && ['Unanswered', 'Deferred'].includes(item.status)).map(item => `- Clarification ${item.id}: ${item.question} (${item.status}${label(item)})`),
    ...pkg.project.registers.filter(item => scoped(item) && ['open', 'draft', 'in-review'].includes(item.status)).map(item => `- ${item.type} ${item.id}: ${item.title} (${item.status}${label(item)})`),
    ...pkg.project.checks.filter(item => scoped(item) && ['Warning', 'Blocking'].includes(item.status)).map(item => `- Governance check ${item.id}: ${item.title} (${item.status}${label(item)})`),
  ];
}

export function buildMarkdown(pkg: ExportPackage) {
  const linkedIds = linked(pkg.document);
  const metadata = [
    `project_id: ${yaml(pkg.project.id)}`, `document_id: ${yaml(pkg.document.id)}`,
    `document_revision: ${pkg.document.version}`, `document_status: ${yaml(pkg.document.status)}`,
    `selected_revision: ${yaml(pkg.label)}`, `approval_status: ${yaml(pkg.approved ? 'Approved baseline' : 'Working draft — not approved')}`,
    `template: ${yaml(pkg.document.template)}`, `manifest_count: ${pkg.manifest.length}`,
    ...(pkg.exportId ? [`export_id: ${yaml(pkg.exportId)}`] : []),
  ].join('\n');
  const sections = pkg.document.sections.map(section => `## ${section.title}\n\n${section.blocks.map(block => {
    const trace = block.linkedIds.length ? `\n\n_Trace references: ${block.linkedIds.join(', ')}_` : '\n\n_Trace references: none recorded_';
    if (block.type === 'diagram' && block.embedding) {
      const diagram = pkg.project.diagrams.find(item => item.id === block.embedding!.diagramId);
      return `${diagram ? `### Diagram — ${diagramCaption(diagram, block)}\n\n\`\`\`mermaid\n${diagram.source}\n\`\`\`` : `[Missing diagram ${block.embedding.diagramId} at selected revision]`}${trace}`;
    }
    if (block.type.includes('table')) { const rows = tableRows(blockText(block)); return `${rows.length ? rows.map(row => `| ${row.join(' | ')} |`).join('\n') : blockText(block)}${trace}`; }
    return `${blockText(block)}${trace}`;
  }).join('\n\n')}`).join('\n\n');
  const traces = pkg.project.traceLinks.filter(link => linkedIds.has(link.from) || linkedIds.has(link.to));
  const traceText = traces.length ? traces.map(link => `- ${link.id}: ${link.from} (v${link.fromRevision ?? '?'}) → ${link.to} (v${link.toRevision ?? '?'}) — ${link.relation}; ${traceDisplayStatus(pkg.project, link)}${traceDisplayStatus(pkg.project, link) !== link.status ? ` (recorded ${link.status}; ${traceDisplayStatus(pkg.project, link) === 'Broken' ? 'endpoint missing' : 'review needed'})` : ''}; ${passageLabel(pkg.project, link)}`).join('\n') : '- No trace links recorded for this document.';
  const details = [...linkedIds].map(id => artifactRecord(pkg, id)).join('\n\n');
  const uncertainty = unresolved(pkg);
  return `---\n${metadata}\n---\n\n# ${pkg.document.name}\n\n> ${pkg.label}. ${pkg.approved ? 'This file is an immutable approved baseline.' : 'This file is a working draft and requires BA approval.'}\n\n${sections}\n\n# Referenced BA records\n\n${details || 'No linked BA records.'}\n\n# Traceability\n\n${traceText}\n\n# Unresolved decisions and review items\n\n${uncertainty.length ? uncertainty.join('\n') : '- None recorded in this revision.'}\n\n# Selected revision manifest\n\n${pkg.manifest.map(item => `- ${item.type} ${item.id} v${item.revision}`).join('\n')}`;
}

export function buildDeveloperMarkdown(pkg: ExportPackage) {
  const scoped = inScope(pkg.document.goalId);
  const manifestIds = new Set(pkg.manifest.map(item => item.id));
  const include = (item: { id: string; goalId?: string }) => pkg.approved ? manifestIds.has(item.id) : scoped(item);
  const requirements = pkg.project.requirements.filter(include), stories = pkg.project.stories.filter(include);
  const diagrams = pkg.project.diagrams.filter(item => pkg.approved ? manifestIds.has(item.id) : scoped(item) && item.linkedIds.some(id => requirements.some(requirement => requirement.id === id) || stories.some(story => story.id === id)));
  const changes = pkg.project.changes.filter(change => scoped(change) || (pkg.approved && ((change.patches ?? []).some(patch => patch.status === 'Applied' && manifestIds.has(patch.artifactId)) || change.impacts.some(impact => impact.selected && manifestIds.has(impact.id)))));
  return `---\nartifact: ${yaml('BA Mate developer handover')}\nsource_document: ${yaml(pkg.document.id)}\nselected_revision: ${yaml(pkg.label)}\n${pkg.exportId ? `export_id: ${yaml(pkg.exportId)}\n` : ''}approval_status: ${yaml(pkg.approved ? 'Approved baseline' : 'Working draft — not approved')}\n---\n\n# ${pkg.document.name} — developer handover\n\nThis package contains only BA decisions and constraints recorded in the selected revision. It does not prescribe architecture, technologies, endpoints, data models, or implementation choices that the BA has not specified.\n\n## Requirements\n\n${requirements.map(requirement => `### ${requirement.id} — ${requirement.title}\n\n${requirement.statement}\n\n**Acceptance criteria**\n${bullets(requirement.fitCriteria)}\n\n**Business rules**\n${bullets(requirement.businessRules)}\n\n**Recorded dependencies / constraints**\n${bullets(requirement.dependencies)}\n\n**Evidence and related links**\n${bullets(evidenceReferences(pkg.project, requirement.id, requirement.sourceIds))}`).join('\n\n') || 'No in-scope requirements.'}\n\n## User stories\n\n${stories.map(story => `### ${story.id}\n\n${storyNarrative(story)}\n\n${bullets(story.criteria)}\n\n**Evidence and related links**\n${bullets(evidenceReferences(pkg.project, story.id, story.sourceIds))}`).join('\n\n') || 'No in-scope user stories.'}\n\n## Process diagrams\n\n${diagrams.map(diagram => `### ${diagram.id} — ${diagram.name}\n\n\`\`\`mermaid\n${diagram.source}\n\`\`\``).join('\n\n') || 'No linked process diagrams.'}\n\n## Change notes\n\n${changes.map(change => `- ${change.id}: ${change.title} — ${change.status}. ${change.rationale}`).join('\n') || '- No in-scope change records.'}\n\n## Unresolved decisions\n\n${unresolved(pkg).join('\n') || '- None recorded.'}\n\n## Revision manifest\n\n${pkg.manifest.map(item => `- ${item.type} ${item.id} v${item.revision}`).join('\n')}`;
}

const exportRevisionName = (pkg: ExportPackage) => pkg.approved ? pkg.baseline!.version : `working-v${pkg.document.version}-${pkg.exportId}`;

export const exportMarkdown = (project: Project, documentId: string, selection?: ExportSelection) => {
  const pkg = resolveExport(project, documentId, selection);
  downloadBlob(new Blob([buildMarkdown(pkg)], { type: 'text/markdown;charset=utf-8' }), `${project.id}-${documentId}-${exportRevisionName(pkg)}.md`);
};
export const exportDeveloperMarkdown = (project: Project, documentId: string, selection?: ExportSelection) => {
  const pkg = resolveExport(project, documentId, selection);
  downloadBlob(new Blob([buildDeveloperMarkdown(pkg)], { type: 'text/markdown;charset=utf-8' }), `${project.id}-${documentId}-developer-handover-${exportRevisionName(pkg)}.md`);
};
export const exportJson = (project: Project) => downloadBlob(new Blob([JSON.stringify({ metadata: { project: { id: project.id, name: project.name, domain: project.domain }, exportedAt: new Date().toISOString(), workingManifest: revisionManifest(project) }, requirements: project.requirements, stories: project.stories, documents: project.documents, diagrams: project.diagrams, traceability: project.traceLinks, checks: project.checks, versions: project.versions }, null, 2)], { type: 'application/json' }), `${project.id}-connected-artifact-record.json`);

const withTimeout = async <T,>(work: Promise<T>, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 8000); })]);
  } finally { if (timer) clearTimeout(timer); }
};
export const renderedDiagram = async (source: string, id: string) => {
  const mermaid = (await import('mermaid')).default;
  // SVG foreignObject labels taint the canvas in browsers and cannot be
  // exported. Plain SVG labels keep the image rasterizable.
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', htmlLabels: false });
  return (await withTimeout(mermaid.render(`export-${id}-${Date.now()}`, source), `Diagram ${id} took too long to render. Try exporting Markdown or review the diagram.`)).svg;
};
export const svgToPng = async (svg: string) => {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = await withTimeout(new Promise<HTMLImageElement>((resolve, reject) => { const value = new Image(); value.onload = () => resolve(value); value.onerror = () => reject(new Error('The diagram could not be rendered for export.')); value.src = url; }), 'The diagram image took too long to prepare. Try exporting Markdown or review the diagram.');
    const sourceWidth = image.naturalWidth || image.width || 900, sourceHeight = image.naturalHeight || image.height || 500;
    const scale = Math.max(1, 600 / sourceWidth);
    const width = Math.round(sourceWidth * scale), height = Math.round(sourceHeight * scale);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('The browser cannot prepare the diagram image.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0, width, height);
    const blob = await withTimeout(new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('The diagram image could not be encoded.')), 'image/png');
    }), 'The diagram image took too long to encode.');
    return { blob, data: new Uint8Array(await blob.arrayBuffer()), width, height };
  } finally { URL.revokeObjectURL(url); }
};
export const exportDocx = async (project: Project, documentId: string, selection?: ExportSelection) => {
  const pkg = resolveExport(project, documentId, selection);
  const { Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun, Table, TableCell, TableRow, WidthType } = await import('docx');
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [new Paragraph({ text: pkg.document.name, heading: HeadingLevel.TITLE }), new Paragraph({ children: [new TextRun({ text: `${pkg.label} · ${pkg.approved ? 'Approved baseline' : 'Working draft — requires BA approval'}`, italics: true })] })];
  if (pkg.exportId) children.push(new Paragraph({ text: `Working export ID: ${pkg.exportId}` }));
  for (const section of pkg.document.sections) { children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1, keepNext: true })); for (const block of section.blocks) {
    if (block.type === 'diagram' && block.embedding) { const diagram = pkg.project.diagrams.find(item => item.id === block.embedding!.diagramId); if (diagram) { const png = await svgToPng(await renderedDiagram(diagram.source, diagram.id)); const scale = Math.min(500 / png.width, 650 / png.height); children.push(new Paragraph({ text: diagramCaption(diagram, block), keepNext: true })); children.push(new Paragraph({ children: [new ImageRun({ type: 'png', data: png.data, altText: { name: diagram.name, description: diagramCaption(diagram, block) + '. See the referenced diagram record for its source.' }, transformation: { width: Math.round(png.width * scale), height: Math.round(png.height * scale) } })] })); } else children.push(new Paragraph(`[Diagram ${block.embedding.diagramId} is absent from the selected revision.]`)); }
    else if (block.type.includes('table')) { const rows = tableRows(blockText(block)); if (rows.length) children.push(new Table({ rows: rows.map(row => new TableRow({ children: row.map(cell => new TableCell({ children: [new Paragraph(cell)] })) })), width: { size: 100, type: WidthType.PERCENTAGE } })); else children.push(new Paragraph(blockText(block))); }
    else for (const paragraph of blockText(block).replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
      children.push(new Paragraph({ spacing: { after: 120 }, children: paragraph.split(/\r?\n/).map((line, index) => new TextRun({ text: line, ...(index ? { break: 1 } : {}), bold: block.style === 'bold', italics: block.style === 'italic', underline: block.style === 'underline' ? {} : undefined })) }));
    }
    children.push(new Paragraph({ children: [new TextRun({ text: `Trace references: ${block.linkedIds.join(', ') || 'none recorded'}`, color: '6B7280', size: 18 })] }));
  } }
  children.push(new Paragraph({ text: 'Referenced BA records', heading: HeadingLevel.HEADING_1 }));
  for (const id of linked(pkg.document)) for (const line of artifactRecord(pkg, id).split('\n')) {
    if (!line.trim() || line.startsWith('```')) continue;
    const heading = line.startsWith('#### ') ? HeadingLevel.HEADING_3 : line.startsWith('### ') ? HeadingLevel.HEADING_2 : undefined;
    children.push(new Paragraph({ text: line.replace(/^#{3,4} /, '').replace(/^- /, ''), ...(heading ? { heading } : {}), ...(line.startsWith('- ') ? { bullet: { level: 0 } } : {}) }));
  }
  children.push(new Paragraph({ text: 'Unresolved decisions and review items', heading: HeadingLevel.HEADING_1 })); for (const item of unresolved(pkg)) children.push(new Paragraph(item));
  children.push(new Paragraph({ text: 'Selected revision manifest', heading: HeadingLevel.HEADING_1 })); for (const item of pkg.manifest) children.push(new Paragraph(`${item.type} ${item.id} v${item.revision}`));
  downloadBlob(await Packer.toBlob(new Document({ sections: [{ children }] })), `${project.id}-${documentId}-${exportRevisionName(pkg)}.docx`);
};
export const exportPdf = async (project: Project, documentId: string, selection?: ExportSelection) => {
  const pkg = resolveExport(project, documentId, selection); const { jsPDF } = await import('jspdf'); const pdf = new jsPDF({ unit: 'pt', format: 'a4' }); const width = 500; let y = 55;
  const reserve = (height: number) => { if (y + height > 770) { pdf.addPage(); y = 55; } };
  // jsPDF's built-in font does not contain the right arrow used in coverage maps.
  // Preserve its meaning in this export rather than emitting a misleading glyph.
  const write = (text: string, size = 10, color = 25, gap = 8) => { pdf.setFontSize(size); pdf.setTextColor(color); const lines: string[] = pdf.splitTextToSize(text.replace(/→/g, '->'), width); for (const line of lines) { reserve(size + 3); pdf.text(line, 48, y); y += size + 3; } y += gap; };
  write(pkg.document.name, 20, 25, 8);
  write(`${pkg.label} · ${pkg.approved ? 'Approved baseline' : 'Working draft — requires BA approval'}`, 9, 90);
  if (pkg.exportId) write(`Working export ID: ${pkg.exportId}`, 8, 90);
  for (const section of pkg.document.sections) {
    const first = section.blocks[0];
    const firstDiagram = first?.type === 'diagram' && first.embedding ? pkg.project.diagrams.find(item => item.id === first.embedding!.diagramId) : undefined;
    const firstPng = firstDiagram ? await svgToPng(await renderedDiagram(firstDiagram.source, firstDiagram.id)) : undefined;
    if (firstPng && firstDiagram) {
      const scale = Math.min(width / firstPng.width, 620 / firstPng.height);
      pdf.setFontSize(14); const headingHeight = pdf.splitTextToSize(section.title, width).length * 17 + 8;
      pdf.setFontSize(9); const captionHeight = pdf.splitTextToSize(diagramCaption(firstDiagram, first), width).length * 12 + 8;
      const required = headingHeight + captionHeight + firstPng.height * scale + 10;
      reserve(required <= 715 ? required : 60);
    } else reserve(60);
    write(section.title, 14);
    let headingPage = pdf.getNumberOfPages();
    for (const block of section.blocks) {
      if (block.type === 'diagram' && block.embedding) {
        const diagram = pkg.project.diagrams.find(item => item.id === block.embedding!.diagramId);
        if (diagram) {
          const png = block === first && firstPng ? firstPng : await svgToPng(await renderedDiagram(diagram.source, diagram.id));
          let scale = Math.min(width / png.width, 620 / png.height);
          pdf.setFontSize(9); const captionHeight = pdf.splitTextToSize(diagramCaption(diagram, block), width).length * 12 + 8;
          pdf.setFontSize(14);
          const continuationHeight = block !== first && pdf.getNumberOfPages() !== headingPage
            ? pdf.splitTextToSize(`${section.title} (continued)`, width).length * 17 + 8 : 0;
          const available = 770 - y - captionHeight - continuationHeight - 10;
          const fullHeight = png.height * scale;
          // Avoid an almost empty page when a modest reduction keeps the whole
          // overview together with its caption. Detail pages remain available.
          if (block !== first && available < fullHeight && available >= Math.max(450, fullHeight * 0.85)) scale = (available - 1) / png.height;
          const imageWidth = png.width * scale, imageHeight = png.height * scale;
          const needsNewPage = y + continuationHeight + captionHeight + imageHeight + 10 > 770;
          if (needsNewPage && block !== first) {
            pdf.addPage(); y = 55;
          } else reserve(Math.min(715, captionHeight + imageHeight + 10));
          if (block !== first && pdf.getNumberOfPages() !== headingPage) {
            write(`${section.title} (continued)`, 14);
            headingPage = pdf.getNumberOfPages();
          }
          write(diagramCaption(diagram, block), 9, 90);
          const captionPage = pdf.getNumberOfPages();
          reserve(imageHeight + 10);
          if (pdf.getNumberOfPages() !== captionPage) {
            write('Diagram overview (continued; full caption on the preceding page)', 9, 90);
          }
          pdf.addImage(png.data, 'PNG', 48, y, imageWidth, imageHeight); y += imageHeight + 10;
          // Keep the overview intact and add overlapping, larger details when a
          // tall diagram would otherwise use less than 70% of the page width.
          // Reuse and clip the same image so no part of the flow is omitted.
          const detailHeight = 500, overlap = 160, detailScale = width / png.width;
          const detailFullHeight = png.height * detailScale;
          const detailCount = Math.ceil((detailFullHeight - overlap) / (detailHeight - overlap));
          if (imageWidth < width * 0.7 && detailCount > 1 && detailCount <= 8) {
            for (let part = 0; part < detailCount; part++) {
              pdf.addPage(); y = 55;
              write(`Diagram detail: ${diagram.id} (part ${part + 1} of ${detailCount}; pages overlap)`, 11);
              const stale = block.embedding.stale || block.embedding.version !== diagram.version;
              write(`${diagram.id} v${diagram.version} · ${diagram.approvalStatus}${stale ? ` · document pin v${block.embedding.version} needs review` : ''}`, 9, 90);
              const offset = part * (detailHeight - overlap);
              const visibleHeight = Math.min(detailHeight, detailFullHeight - offset);
              reserve(visibleHeight + 10);
              pdf.saveGraphicsState();
              pdf.rect(48, y, width, visibleHeight, null).clip().discardPath();
              pdf.addImage(png.data, 'PNG', 48, y - offset, width, detailFullHeight);
              pdf.restoreGraphicsState();
              y += visibleHeight + 10;
            }
          } else if (imageWidth < width * 0.7 && detailCount > 8) {
            write('This diagram is too long for enlarged detail pages in this export. Review the original diagram or export it separately for closer inspection.', 9, 90);
          }
        } else write(`[Diagram ${block.embedding.diagramId} absent from selected revision.]`);
      } else if (block.type.includes('table')) tableRows(blockText(block)).forEach(row => write(row.join(' | '), 8));
      else write(blockText(block));
      write(`Trace references: ${block.linkedIds.join(', ') || 'none recorded'}`, 8, 90);
    }
  }
  reserve(60); write('Referenced BA records', 14);
  for (const id of linked(pkg.document)) {
    reserve(55);
    for (const line of artifactRecord(pkg, id).split('\n')) {
      if (!line.trim() || line.startsWith('```')) continue;
      const heading = /^#{3,4} /.test(line);
      if (heading) reserve(35);
      write(line.replace(/^#{3,4} /, ''), heading ? 10 : 9, 25, heading ? 4 : 2);
    }
    y += 6;
  }
  reserve(60); write('Unresolved decisions and review items', 14); unresolved(pkg).forEach(item => write(item, 9));
  write('Selected revision manifest', 14); pkg.manifest.forEach(item => write(`${item.type} ${item.id} v${item.revision}`, 8));
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page); pdf.setFontSize(8); pdf.setTextColor(90);
    const identity = `${pkg.document.id} · ${pkg.approved ? pkg.label : `Working draft v${pkg.document.version}`}`;
    const footerLines: string[] = pdf.splitTextToSize(identity, 390);
    pdf.text(footerLines.slice(0, 2), 48, 798);
    pdf.text(`Page ${page} of ${pageCount}`, 548, 798, { align: 'right' });
  }
  pdf.save(`${project.id}-${documentId}-${exportRevisionName(pkg)}.pdf`);
};
