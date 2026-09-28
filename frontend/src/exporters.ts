import type { DocumentBlock, Project, ProjectDocument, VersionSnapshot } from './types';
import { downloadBlob, revisionManifest } from './store';

export type ExportSelection = { kind: 'working' } | { kind: 'baseline'; baselineId: string };
export interface ExportPackage {
  project: Project; document: ProjectDocument; selection: ExportSelection; label: string;
  approved: boolean; manifest: { id: string; type: string; revision: number }[]; baseline?: VersionSnapshot;
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const yaml = (value: string | number | boolean) => JSON.stringify(value);
const sectionBlocks = (document: ProjectDocument) => document.sections.flatMap(section => section.blocks);
const linked = (document: ProjectDocument) => new Set(sectionBlocks(document).flatMap(block => block.linkedIds));
const inScope = (goalId?: string) => (item: { goalId?: string }) => !goalId || !item.goalId || item.goalId === goalId;

/** Resolve content before a renderer runs. A baseline only ever uses its immutable snapshot. */
export function resolveExport(project: Project, documentId: string, selection: ExportSelection = { kind: 'working' }): ExportPackage {
  if (selection.kind === 'working') {
    const document = project.documents.find(item => item.id === documentId);
    if (!document) throw new Error('The selected working document no longer exists.');
    return { project, document, selection, label: `Working revision ${document.version}`, approved: false, manifest: revisionManifest(project) };
  }
  const baseline = project.versions.find(version => version.id === selection.baselineId && version.type === 'Baseline' && version.locked);
  if (!baseline) throw new Error('Choose an existing approved baseline.');
  if (!baseline.snapshot || !baseline.manifest?.length) throw new Error('This older baseline has no immutable content manifest and cannot be exported faithfully.');
  const snapshot = clone(baseline.snapshot) as unknown as Project;
  const document = snapshot.documents?.find(item => item.id === documentId);
  const manifestEntry = baseline.manifest.find(item => item.id === documentId);
  if (!document || !manifestEntry || manifestEntry.revision !== document.version) throw new Error('That document was not part of the selected approved baseline. Select a document from the baseline or export its working revision.');
  return { project: snapshot, document, selection, label: `Approved baseline ${baseline.version}`, approved: true, manifest: baseline.manifest, baseline };
}

const blockText = (block: DocumentBlock) => block.content.trim();
const tableRows = (text: string) => text.split('\n').map(row => row.trim()).filter(Boolean)
  .filter(row => !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(row))
  .map(row => row.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()));
const bullets = (values: string[]) => values.length ? values.map(value => `- ${value}`).join('\n') : '- None recorded';

function artifactRecord(pkg: ExportPackage, id: string) {
  const { project } = pkg;
  const requirement = project.requirements.find(item => item.id === id);
  if (requirement) return `### ${requirement.id} — ${requirement.title}\n\n- Type: ${requirement.kind}\n- Revision: ${requirement.version}\n- Status: ${requirement.status}\n- Statement: ${requirement.statement}\n\n#### Acceptance criteria\n${bullets(requirement.fitCriteria)}\n\n#### Business rules\n${bullets(requirement.businessRules)}\n\nEvidence: ${requirement.sourceIds.join(', ') || 'None recorded'}\n\nDependencies: ${requirement.dependencies.join(', ') || 'None recorded'}`;
  const story = project.stories.find(item => item.id === id);
  if (story) return `### ${story.id} — User story\n\nAs a ${story.role}, I want ${story.goal}, so that ${story.value}.\n\n- Revision: ${story.version}\n- Status: ${story.status}\n\n#### Acceptance criteria\n${bullets(story.criteria)}\n\nEvidence: ${story.sourceIds.join(', ') || 'None recorded'}\n\nDependencies: ${story.dependencies.join(', ') || 'None recorded'}`;
  const diagram = project.diagrams.find(item => item.id === id);
  if (diagram) return `### ${diagram.id} — ${diagram.name}\n\n- Revision: ${diagram.version}\n- Status: ${diagram.status} / approval ${diagram.approvalStatus}\n- Linked artifacts: ${diagram.linkedIds.join(', ') || 'None'}\n\n\`\`\`mermaid\n${diagram.source}\n\`\`\``;
  const clarification = project.clarifications.find(item => item.id === id);
  if (clarification) return `### ${clarification.id} — Clarification\n\n- Status: ${clarification.status}\n- Question: ${clarification.question}\n- Answer: ${clarification.answer ?? 'Unanswered'}\n- Source: ${clarification.sourceId}`;
  const check = project.checks.find(item => item.id === id);
  if (check) return `### ${check.id} — ${check.title}\n\n- Governance status: ${check.status}\n- Rationale: ${check.rationale}`;
  const register = project.registers.find(item => item.id === id);
  if (register) return `### ${register.id} — ${register.type}\n\n- Status: ${register.status}\n- Detail: ${register.title}`;
  return `### ${id}\n\nNo current record was found in the selected revision.`;
}
function unresolved(pkg: ExportPackage) {
  const scoped = inScope(pkg.document.goalId);
  return [
    ...pkg.project.clarifications.filter(item => scoped(item) && ['Unanswered', 'Deferred'].includes(item.status)).map(item => `- Clarification ${item.id}: ${item.question} (${item.status})`),
    ...pkg.project.registers.filter(item => scoped(item) && ['open', 'draft', 'in-review'].includes(item.status)).map(item => `- ${item.type} ${item.id}: ${item.title} (${item.status})`),
    ...pkg.project.checks.filter(item => scoped(item) && ['Warning', 'Blocking'].includes(item.status)).map(item => `- Governance check ${item.id}: ${item.title} (${item.status})`),
  ];
}

export function buildMarkdown(pkg: ExportPackage) {
  const linkedIds = linked(pkg.document);
  const metadata = [
    `project_id: ${yaml(pkg.project.id)}`, `document_id: ${yaml(pkg.document.id)}`,
    `document_revision: ${pkg.document.version}`, `document_status: ${yaml(pkg.document.status)}`,
    `selected_revision: ${yaml(pkg.label)}`, `approval_status: ${yaml(pkg.approved ? 'Approved baseline' : 'Working draft — not approved')}`,
    `template: ${yaml(pkg.document.template)}`, `manifest_count: ${pkg.manifest.length}`,
  ].join('\n');
  const sections = pkg.document.sections.map(section => `## ${section.title}\n\n${section.blocks.map(block => {
    const trace = block.linkedIds.length ? `\n\n_Trace references: ${block.linkedIds.join(', ')}_` : '\n\n_Trace references: none recorded_';
    if (block.type === 'diagram' && block.embedding) {
      const diagram = pkg.project.diagrams.find(item => item.id === block.embedding!.diagramId);
      return `${diagram ? `### Diagram — ${diagram.name}\n\n\`\`\`mermaid\n${diagram.source}\n\`\`\`` : `[Missing diagram ${block.embedding.diagramId} at selected revision]`}${trace}`;
    }
    if (block.type.includes('table')) { const rows = tableRows(blockText(block)); return `${rows.length ? rows.map(row => `| ${row.join(' | ')} |`).join('\n') : blockText(block)}${trace}`; }
    return `${blockText(block)}${trace}`;
  }).join('\n\n')}`).join('\n\n');
  const traces = pkg.project.traceLinks.filter(link => linkedIds.has(link.from) || linkedIds.has(link.to));
  const traceText = traces.length ? traces.map(link => `- ${link.id}: ${link.from} (v${link.fromRevision ?? '?'}) → ${link.to} (v${link.toRevision ?? '?'}) — ${link.relation}; ${link.status}`).join('\n') : '- No trace links recorded for this document.';
  const details = [...linkedIds].map(id => artifactRecord(pkg, id)).join('\n\n');
  const uncertainty = unresolved(pkg);
  return `---\n${metadata}\n---\n\n# ${pkg.document.name}\n\n> ${pkg.label}. ${pkg.approved ? 'This file is an immutable approved baseline.' : 'This file is a working draft and requires BA approval.'}\n\n${sections}\n\n# Referenced BA records\n\n${details || 'No linked BA records.'}\n\n# Traceability\n\n${traceText}\n\n# Unresolved decisions and review items\n\n${uncertainty.length ? uncertainty.join('\n') : '- None recorded in this revision.'}\n\n# Selected revision manifest\n\n${pkg.manifest.map(item => `- ${item.type} ${item.id} v${item.revision}`).join('\n')}`;
}

export function buildDeveloperMarkdown(pkg: ExportPackage) {
  const scoped = inScope(pkg.document.goalId);
  const requirements = pkg.project.requirements.filter(scoped), stories = pkg.project.stories.filter(scoped);
  const diagrams = pkg.project.diagrams.filter(item => scoped(item) && item.linkedIds.some(id => requirements.some(requirement => requirement.id === id) || stories.some(story => story.id === id)));
  const changes = pkg.project.changes.filter(scoped);
  return `---\nartifact: ${yaml('BA Mate developer handover')}\nsource_document: ${yaml(pkg.document.id)}\nselected_revision: ${yaml(pkg.label)}\napproval_status: ${yaml(pkg.approved ? 'Approved baseline' : 'Working draft — not approved')}\n---\n\n# ${pkg.document.name} — developer handover\n\nThis package contains only BA decisions and constraints recorded in the selected revision. It does not prescribe architecture, technologies, endpoints, data models, or implementation choices that the BA has not specified.\n\n## Requirements\n\n${requirements.map(requirement => `### ${requirement.id} — ${requirement.title}\n\n${requirement.statement}\n\n**Acceptance criteria**\n${bullets(requirement.fitCriteria)}\n\n**Business rules**\n${bullets(requirement.businessRules)}\n\n**Recorded dependencies / constraints**\n${bullets(requirement.dependencies)}\n\nEvidence: ${requirement.sourceIds.join(', ') || 'None recorded'}`).join('\n\n') || 'No in-scope requirements.'}\n\n## User stories\n\n${stories.map(story => `### ${story.id}\n\nAs a ${story.role}, I want ${story.goal}, so that ${story.value}.\n\n${bullets(story.criteria)}`).join('\n\n') || 'No in-scope user stories.'}\n\n## Process diagrams\n\n${diagrams.map(diagram => `### ${diagram.id} — ${diagram.name}\n\n\`\`\`mermaid\n${diagram.source}\n\`\`\``).join('\n\n') || 'No linked process diagrams.'}\n\n## Change notes\n\n${changes.map(change => `- ${change.id}: ${change.title} — ${change.status}. ${change.rationale}`).join('\n') || '- No in-scope change records.'}\n\n## Unresolved decisions\n\n${unresolved(pkg).join('\n') || '- None recorded.'}\n\n## Revision manifest\n\n${pkg.manifest.map(item => `- ${item.type} ${item.id} v${item.revision}`).join('\n')}`;
}

export const exportMarkdown = (project: Project, documentId: string, selection?: ExportSelection) => {
  const pkg = resolveExport(project, documentId, selection);
  downloadBlob(new Blob([buildMarkdown(pkg)], { type: 'text/markdown;charset=utf-8' }), `${project.id}-${documentId}-${pkg.approved ? pkg.baseline!.version : `v${pkg.document.version}`}.md`);
};
export const exportDeveloperMarkdown = (project: Project, documentId: string, selection?: ExportSelection) => {
  const pkg = resolveExport(project, documentId, selection);
  downloadBlob(new Blob([buildDeveloperMarkdown(pkg)], { type: 'text/markdown;charset=utf-8' }), `${project.id}-${documentId}-developer-handover-${pkg.approved ? pkg.baseline!.version : `v${pkg.document.version}`}.md`);
};
export const exportJson = (project: Project) => downloadBlob(new Blob([JSON.stringify({ metadata: { project: { id: project.id, name: project.name, domain: project.domain }, exportedAt: new Date().toISOString(), workingManifest: revisionManifest(project) }, requirements: project.requirements, stories: project.stories, documents: project.documents, diagrams: project.diagrams, traceability: project.traceLinks, checks: project.checks, versions: project.versions }, null, 2)], { type: 'application/json' }), `${project.id}-connected-artifact-record.json`);

const renderedDiagram = async (source: string, id: string) => {
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
  return (await mermaid.render(`export-${id}-${Date.now()}`, source)).svg;
};
const svgToPng = async (svg: string) => {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const value = new Image(); value.onload = () => resolve(value); value.onerror = () => reject(new Error('The diagram could not be rendered for export.')); value.src = url; });
    const width = Math.max(600, image.width || 900), height = Math.max(300, image.height || 500);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('The browser cannot prepare the diagram image.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0, width, height);
    return new Uint8Array(await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer());
  } finally { URL.revokeObjectURL(url); }
};
export const exportDocx = async (project: Project, documentId: string, selection?: ExportSelection) => {
  const pkg = resolveExport(project, documentId, selection);
  const { Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun, Table, TableCell, TableRow, WidthType } = await import('docx');
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [new Paragraph({ text: pkg.document.name, heading: HeadingLevel.TITLE }), new Paragraph({ children: [new TextRun({ text: `${pkg.label} · ${pkg.approved ? 'Approved baseline' : 'Working draft — requires BA approval'}`, italics: true })] })];
  for (const section of pkg.document.sections) { children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 })); for (const block of section.blocks) {
    if (block.type === 'diagram' && block.embedding) { const diagram = pkg.project.diagrams.find(item => item.id === block.embedding!.diagramId); if (diagram) children.push(new Paragraph({ children: [new ImageRun({ type: 'png', data: await svgToPng(await renderedDiagram(diagram.source, diagram.id)), transformation: { width: 600, height: 340 } })] })); else children.push(new Paragraph(`[Diagram ${block.embedding.diagramId} is absent from the selected revision.]`)); }
    else if (block.type.includes('table')) { const rows = tableRows(blockText(block)); if (rows.length) children.push(new Table({ rows: rows.map(row => new TableRow({ children: row.map(cell => new TableCell({ children: [new Paragraph(cell)] })) })), width: { size: 100, type: WidthType.PERCENTAGE } })); else children.push(new Paragraph(blockText(block))); }
    else children.push(new Paragraph({ children: [new TextRun({ text: blockText(block), bold: block.style === 'bold', italics: block.style === 'italic', underline: block.style === 'underline' ? {} : undefined })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: `Trace references: ${block.linkedIds.join(', ') || 'none recorded'}`, color: '6B7280', size: 18 })] }));
  } }
  children.push(new Paragraph({ text: 'Referenced BA records', heading: HeadingLevel.HEADING_1 })); for (const id of linked(pkg.document)) children.push(new Paragraph(artifactRecord(pkg, id)));
  children.push(new Paragraph({ text: 'Unresolved decisions and review items', heading: HeadingLevel.HEADING_1 })); for (const item of unresolved(pkg)) children.push(new Paragraph(item));
  children.push(new Paragraph({ text: 'Selected revision manifest', heading: HeadingLevel.HEADING_1 })); for (const item of pkg.manifest) children.push(new Paragraph(`${item.type} ${item.id} v${item.revision}`));
  downloadBlob(await Packer.toBlob(new Document({ sections: [{ children }] })), `${project.id}-${documentId}-${pkg.approved ? pkg.baseline!.version : `v${pkg.document.version}`}.docx`);
};
export const exportPdf = async (project: Project, documentId: string, selection?: ExportSelection) => {
  const pkg = resolveExport(project, documentId, selection); const { jsPDF } = await import('jspdf'); const pdf = new jsPDF({ unit: 'pt', format: 'a4' }); const width = 500; let y = 55;
  const reserve = (height: number) => { if (y + height > 770) { pdf.addPage(); y = 55; } };
  const write = (text: string, size = 10, color = 25) => { pdf.setFontSize(size); pdf.setTextColor(color); const lines = pdf.splitTextToSize(text, width); reserve(lines.length * (size + 3) + 8); pdf.text(lines, 48, y); y += lines.length * (size + 3) + 8; };
  pdf.setFontSize(20); pdf.text(pkg.document.name, 48, y); y += 28; write(`${pkg.label} · ${pkg.approved ? 'Approved baseline' : 'Working draft — requires BA approval'}`, 9, 90);
  for (const section of pkg.document.sections) { write(section.title, 14); for (const block of section.blocks) { if (block.type === 'diagram' && block.embedding) { const diagram = pkg.project.diagrams.find(item => item.id === block.embedding!.diagramId); if (diagram) { const png = await svgToPng(await renderedDiagram(diagram.source, diagram.id)); reserve(270); pdf.addImage(png, 'PNG', 48, y, width, 250); y += 260; } else write(`[Diagram ${block.embedding.diagramId} absent from selected revision.]`); } else if (block.type.includes('table')) tableRows(blockText(block)).forEach(row => write(row.join(' | '), 8)); else write(blockText(block)); write(`Trace references: ${block.linkedIds.join(', ') || 'none recorded'}`, 8, 90); } }
  write('Referenced BA records', 14); for (const id of linked(pkg.document)) write(artifactRecord(pkg, id), 9);
  write('Unresolved decisions and review items', 14); unresolved(pkg).forEach(item => write(item, 9));
  write('Selected revision manifest', 14); pkg.manifest.forEach(item => write(`${item.type} ${item.id} v${item.revision}`, 8));
  pdf.save(`${project.id}-${documentId}-${pkg.approved ? pkg.baseline!.version : `v${pkg.document.version}`}.pdf`);
};
