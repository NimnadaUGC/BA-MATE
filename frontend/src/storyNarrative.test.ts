import { describe, expect, it } from 'vitest';
import { storyNarrative } from './storyNarrative';
import { buildDeveloperMarkdown, buildMarkdown, resolveExport } from './exporters';
import { srsContent } from './controlledChanges';
import { freshState } from './store';

describe('user story presentation', () => {
  it.each([
    ['scan products', 'I can check out', 'As a Cashier, I want to scan products, so that I can check out.'],
    ['to scan products', 'so I can check out.', 'As a Cashier, I want to scan products, so I can check out.'],
    ['scan products', 'so that I can check out', 'As a Cashier, I want to scan products, so that I can check out.'],
  ])('presents recorded goal and benefit consistently', (goal, value, expected) => {
    expect(storyNarrative({ role: 'Cashier', goal, value })).toBe(expected);
  });
  it('uses the same wording in linked document content and both handover formats without changing the story', () => {
    const project = freshState().projects[0], story = project.stories[0], document = project.documents[0];
    story.role = 'Cashier'; story.goal = 'to scan products'; story.value = 'so I can check out.';
    document.sections[0].blocks[0].linkedIds = [story.id];
    const sentence = storyNarrative(story), pkg = resolveExport(project, document.id);
    expect(srsContent(project, story.id)).toContain(sentence);
    expect(buildMarkdown(pkg)).toContain(sentence);
    expect(buildDeveloperMarkdown(pkg)).toContain(sentence);
    expect(story.goal).toBe('to scan products');
    expect(story.value).toBe('so I can check out.');
  });
});
