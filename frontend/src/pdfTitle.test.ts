import { describe, expect, it, vi } from 'vitest';
import { exportPdf } from './exporters';
import { freshState } from './store';

const captured = vi.hoisted(() => ({ lines: [] as (string | string[])[], events: [] as { text: string; page: number }[], images: [] as { page: number; height: number }[], pdf: '' }));
vi.mock('mermaid', () => ({ default: { initialize: () => {}, render: async () => ({ svg: '<svg></svg>' }) } }));
vi.mock('jspdf', async importOriginal => {
  const original = await importOriginal<typeof import('jspdf')>();
  return { ...original, jsPDF: function (...args: ConstructorParameters<typeof original.jsPDF>) {
    const pdf = new original.jsPDF(...args);
    const text = pdf.text.bind(pdf);
    pdf.text = ((value: string, ...rest: [number, number]) => {
      captured.lines.push(value);
      if (typeof value === 'string') captured.events.push({ text: value, page: pdf.getCurrentPageInfo().pageNumber });
      return text(value, ...rest);
    }) as typeof pdf.text;
    pdf.save = (() => { captured.pdf = pdf.output(); return pdf; }) as typeof pdf.save;
    pdf.addImage = ((...args: unknown[]) => { const page = pdf.getCurrentPageInfo().pageNumber; captured.events.push({ text: '[image]', page }); captured.images.push({ page, height: args[5] as number }); return pdf; }) as typeof pdf.addImage;
    return pdf;
  } };
});

describe('PDF title layout', () => {
  it('fits an overview on the preceding text page when a small reduction is sufficient', async () => {
    const originalDocument = globalThis.document, originalImage = globalThis.Image;
    const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
    try {
      URL.createObjectURL = () => 'blob:fixture'; URL.revokeObjectURL = () => {};
      vi.stubGlobal('Image', class { naturalWidth = 600; naturalHeight = 1139; width = 600; height = 1139; onload?: () => void; set src(_value: string) { queueMicrotask(() => this.onload?.()); } });
      vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }), toBlob: (cb: (blob: Blob) => void) => cb(new Blob(['fixture'])) }) });
      const project = freshState().projects[0], document = project.documents[0], diagram = project.diagrams[0];
      document.sections = [document.sections[0]];
      const section = document.sections[0]; section.title = 'Checkout process';
      const paragraph = { ...section.blocks[0], type: 'paragraph' as const, linkedIds: ['DGM-TEST'], embedding: undefined };
      const image = { ...section.blocks[0], id: 'diagram-test', type: 'diagram' as const, linkedIds: [], embedding: { diagramId: diagram.id, version: diagram.version, insertedAt: '', stale: false } };
      section.blocks = [paragraph, image];
      let found = false;
      for (let count = 1; count < 110 && !found; count++) {
        paragraph.content = Array(count).fill('Short line').join('\n'); captured.events.length = 0; captured.images.length = 0;
        await exportPdf(project, document.id);
        const trace = captured.events.find(e => e.text === 'Trace references: DGM-TEST');
        const overview = captured.images[0];
        if (trace && overview && trace.page === overview.page && overview.height < 619 && overview.height >= 526) found = true;
      }
      expect(found).toBe(true);
      // If the remaining page cannot hold a reasonably sized overview, move
      // the full-size image instead of compressing it to fit.
      let moved = false;
      for (let count = 1; count < 110 && !moved; count++) {
        paragraph.content = Array(count).fill('Short line').join('\n'); captured.events.length = 0; captured.images.length = 0;
        await exportPdf(project, document.id);
        const trace = captured.events.find(e => e.text === 'Trace references: DGM-TEST');
        const overview = captured.images[0];
        if (trace && overview && overview.page > trace.page) {
          moved = true;
          expect(overview.height).toBeCloseTo(620);
          expect(captured.events.some(e => e.text === 'Checkout process (continued)' && e.page === overview.page)).toBe(true);
        }
      }
      expect(moved).toBe(true);
    } finally {
      vi.stubGlobal('document', originalDocument); vi.stubGlobal('Image', originalImage);
      URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    }
  });
  it('retains an overview and adds overlapping detail pages for a tall diagram', async () => {
    const originalDocument = globalThis.document, originalImage = globalThis.Image;
    const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
    try {
      URL.createObjectURL = () => 'blob:fixture'; URL.revokeObjectURL = () => {};
      vi.stubGlobal('Image', class { naturalWidth = 600; naturalHeight = 1139; width = 600; height = 1139; onload?: () => void; set src(_value: string) { queueMicrotask(() => this.onload?.()); } });
      vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }), toBlob: (cb: (blob: Blob) => void) => cb(new Blob(['fixture'])) }) });
      const project = freshState().projects[0], document = project.documents[0], diagram = project.diagrams[0];
      document.sections = [document.sections[0]];
      document.sections[0].blocks = [{ ...document.sections[0].blocks[0], type: 'diagram', linkedIds: [], embedding: { diagramId: diagram.id, version: diagram.version, insertedAt: '', stale: false } }];
      captured.events.length = 0;
      await exportPdf(project, document.id);
      const images = captured.events.filter(e => e.text === '[image]');
      const details = captured.events.filter(e => e.text.startsWith('Diagram detail:'));
      expect(details).toHaveLength(3);
      expect(images).toHaveLength(4);
      expect(details[0].text).toContain('part 1 of 3; pages overlap');
      expect(details[2].text).toContain('part 3 of 3; pages overlap');
      expect(images[0].page).toBeLessThan(images[1].page);
      expect(images[1].page).toBeLessThan(images[2].page);
      expect(images[2].page).toBeLessThan(images[3].page);
      // The clipping path must not be stroked first: stroking consumes the
      // path and would leave the oversized image covering the page footer.
      expect(captured.pdf.match(/ re\nW\nn\n/g)).toHaveLength(3);
    } finally {
      vi.stubGlobal('document', originalDocument); vi.stubGlobal('Image', originalImage);
      URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    }
  });
  it('keeps an overview identifiable after a long caption and explains oversized detail omissions', async () => {
    const originalDocument = globalThis.document, originalImage = globalThis.Image;
    const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
    try {
      URL.createObjectURL = () => 'blob:fixture'; URL.revokeObjectURL = () => {};
      vi.stubGlobal('Image', class { naturalWidth = 600; naturalHeight = 7000; width = 600; height = 7000; onload?: () => void; set src(_value: string) { queueMicrotask(() => this.onload?.()); } });
      vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }), toBlob: (cb: (blob: Blob) => void) => cb(new Blob(['fixture'])) }) });
      const project = freshState().projects[0], document = project.documents[0], diagram = project.diagrams[0];
      diagram.name = 'Long diagram name '.repeat(90);
      document.sections = [document.sections[0]];
      document.sections[0].blocks = [{ ...document.sections[0].blocks[0], type: 'diagram', linkedIds: [], embedding: { diagramId: diagram.id, version: diagram.version, insertedAt: '', stale: false } }];
      captured.events.length = 0;
      await exportPdf(project, document.id);
      const image = captured.events.find(e => e.text === '[image]');
      const continuation = captured.events.find(e => e.text.startsWith('Diagram overview (continued;'));
      expect(continuation?.page).toBe(image?.page);
      expect(captured.events.some(e => e.text.includes('too long for enlarged detail pages'))).toBe(true);
      expect(captured.events.filter(e => e.text.startsWith('Diagram detail:'))).toHaveLength(0);
    } finally {
      vi.stubGlobal('document', originalDocument); vi.stubGlobal('Image', originalImage);
      URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    }
  });
  it('preserves coverage-map arrows as readable text supported by the PDF font', async () => {
    const project = freshState().projects[0], document = project.documents[0];
    project.diagrams = [];
    document.sections = [document.sections[0]];
    document.sections[0].blocks = [document.sections[0].blocks[0]];
    const block = document.sections[0].blocks[0];
    block.type = 'paragraph'; delete block.embedding; block.linkedIds = [];
    block.content = 'REQ-AUTH-01 → FR-123: login';
    captured.lines.length = 0;
    await exportPdf(project, document.id);
    expect(captured.lines).toContain('REQ-AUTH-01 -> FR-123: login');
    expect(captured.pdf).toContain('REQ-AUTH-01 -> FR-123: login');
    expect(block.content).toBe('REQ-AUTH-01 → FR-123: login');
  });
  it('wraps a long document title onto lines within the page width', async () => {
    const project = freshState().projects[0], document = project.documents[0];
    document.name = 'A very long document title that cannot fit within the printable width of the first page and must wrap safely';
    project.diagrams = [];
    document.sections = [];
    captured.lines.length = 0;
    await exportPdf(project, document.id);
    const labelIndex = captured.lines.findIndex(line => typeof line === 'string' && line.startsWith('Working revision'));
    const titleLines = captured.lines.slice(0, labelIndex);
    expect(titleLines.length).toBeGreaterThan(1);
    expect(titleLines.join(' ')).toBe(document.name);
  });
  it('adds document identity and consecutive page numbers to a multi-page export', async () => {
    const project = freshState().projects[0], document = project.documents[0];
    project.diagrams = [];
    document.sections = [document.sections[0]];
    document.sections[0].blocks = [document.sections[0].blocks[0]];
    const block = document.sections[0].blocks[0];
    block.type = 'paragraph'; delete block.embedding; block.linkedIds = [];
    block.content = 'A line of test content. '.repeat(900);
    captured.lines.length = 0;
    await exportPdf(project, document.id);
    const pageLabels = captured.lines.filter((line): line is string => typeof line === 'string' && /^Page \d+ of \d+$/.test(line));
    expect(pageLabels.length).toBeGreaterThan(1);
    pageLabels.forEach((label, index) => expect(label).toBe(`Page ${index + 1} of ${pageLabels.length}`));
    const identities = captured.lines.filter((line): line is string[] => Array.isArray(line) && line.join(' ').includes(document.id));
    expect(identities).toHaveLength(pageLabels.length);
    identities.forEach(lines => expect(lines.join(' ')).toContain('Working draft'));
  });
  it('repeats a section heading when its trace line already moved to the diagram page', async () => {
    const originalDocument = globalThis.document, originalImage = globalThis.Image;
    const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
    try {
      URL.createObjectURL = () => 'blob:fixture'; URL.revokeObjectURL = () => {};
      vi.stubGlobal('Image', class { naturalWidth = 600; naturalHeight = 300; width = 600; height = 300; onload?: () => void; set src(_value: string) { queueMicrotask(() => this.onload?.()); } });
      vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }), toBlob: (cb: (blob: Blob) => void) => cb(new Blob(['fixture'])) }) });
      const project = freshState().projects[0], document = project.documents[0], diagram = project.diagrams[0];
      document.sections = [document.sections[0]];
      const section = document.sections[0]; section.title = 'Checkout process';
      const paragraph = { ...section.blocks[0], type: 'paragraph' as const, linkedIds: ['DGM-TEST'], embedding: undefined };
      const image = { ...section.blocks[0], id: 'diagram-test', type: 'diagram' as const, linkedIds: [], embedding: { diagramId: diagram.id, version: diagram.version, insertedAt: '', stale: false } };
      section.blocks = [paragraph, image];
      let found = false;
      for (let count = 20; count < 120 && !found; count++) {
        paragraph.content = Array(count).fill('Short line').join('\n'); captured.events.length = 0;
        await exportPdf(project, document.id);
        const title = captured.events.find(e => e.text === 'Checkout process');
        const trace = captured.events.find(e => e.text === 'Trace references: DGM-TEST');
        const graphic = captured.events.find(e => e.text === '[image]');
        if (title && trace && graphic && trace.page > title.page && trace.page === graphic.page) {
          found = true;
          expect(captured.events.some(e => e.text === 'Checkout process (continued)' && e.page === graphic.page)).toBe(true);
        }
      }
      expect(found).toBe(true);
    } finally {
      vi.stubGlobal('document', originalDocument); vi.stubGlobal('Image', originalImage);
      URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    }
  });
});
