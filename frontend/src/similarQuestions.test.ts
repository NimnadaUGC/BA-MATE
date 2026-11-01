import { describe, expect, it } from 'vitest';
import { freshState } from './store';
import { similarQuestions } from './similarQuestions';

describe('similar clarification suggestions', () => {
  it('identifies equivalent formatting and similar wording while retaining status and scope', () => {
    const q = freshState().projects[0].clarifications[0];
    const existing = [
      { ...q, id: 'CQ-exact', status: 'Answered' as const, goalId: 'other', question: 'What is the low-stock threshold?' },
      { ...q, id: 'CQ-similar', question: 'What is the confirmed low stock threshold?' },
      { ...q, id: 'CQ-unrelated', question: 'How are card payments processed?' },
    ];
    const results = similarQuestions('WHAT is the low stock threshold!', existing);
    expect(results.map(x => x.item.id)).toEqual(['CQ-exact', 'CQ-similar']);
    expect(results[0].exact).toBe(true);
    expect(results[0].item.status).toBe('Answered');
    expect(results[0].item.goalId).toBe('other');
    expect(existing[0].question).toBe('What is the low-stock threshold?');
  });
  it('finds the same question after a longer contextual preamble', () => {
    const q = freshState().projects[0].clarifications[0];
    const candidate = 'What time windows, reason codes, and authentication/approval rules apply to returns and voids?';
    const prior = { ...q, question: `Cashier returns and manager voids appear in role permissions, but the BRD has no functional requirements. ${candidate}` };
    expect(similarQuestions(candidate, [prior]).map(match => match.item.id)).toEqual([prior.id]);
    expect(similarQuestions(prior.question, [{ ...prior, question: candidate }])).toHaveLength(1);
  });
  it('does not treat empty or weakly related short text as a match', () => {
    const q = freshState().projects[0].clarifications[0];
    expect(similarQuestions('', [q])).toEqual([]);
    expect(similarQuestions('pay cash', [{ ...q, question: 'pay card' }])).toEqual([]);
  });
});
