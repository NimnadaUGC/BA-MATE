import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { exportDocx } from './exporters';
import { downloadBlob, freshState } from './store';

vi.mock('./store', async original => ({ ...await original<typeof import('./store')>(), downloadBlob: vi.fn() }));

describe('Word export paragraph breaks', () => {
  it('preserves separate paragraphs and single line breaks inside a document block', async () => {
    const project = freshState().projects[0], document = project.documents[0];
    project.diagrams = []; document.sections = [document.sections[0]];
    const section = document.sections[0]; section.linkedIds = []; section.blocks = [section.blocks[0]];
    const block = section.blocks[0]; block.type = 'paragraph'; block.linkedIds = []; delete block.embedding;
    block.content = 'First paragraph\nsecond line\n\nSecond paragraph';
    await exportDocx(project, document.id);
    const [blob, filename] = vi.mocked(downloadBlob).mock.calls.at(-1)!;
    const exportId = filename.match(/-working-v\d+-([0-9a-f]{32})\.docx$/)?.[1];
    expect(exportId).toBeDefined();
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain(`Working export ID: ${exportId}`);
    expect(xml).toMatch(/First paragraph[\s\S]*?<w:br\/>[\s\S]*?second line/);
    expect(xml).toMatch(/second line[\s\S]*?<\/w:p><w:p>[\s\S]*?Second paragraph/);
  });
});
