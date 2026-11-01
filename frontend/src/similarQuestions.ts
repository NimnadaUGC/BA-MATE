import type { Clarification } from './types';

/** Lexical hints for human review, not semantic duplicate detection. */
export function similarQuestions(question: string, existing: Clarification[]) {
  const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const input = normalize(question);
  if (!input) return [];
  const words = new Set(input.split(' '));
  return existing.flatMap(item => {
    const text = normalize(item.question);
    if (!text) return [];
    const exact = input === text;
    const other = new Set(text.split(' '));
    const contained = words.size >= 4 && other.size >= 4 && (` ${text} `.includes(` ${input} `) || ` ${input} `.includes(` ${text} `));
    const common = [...words].filter(word => other.has(word)).length;
    const similarity = 2 * common / (words.size + other.size);
    return exact || contained || (words.size >= 4 && other.size >= 4 && similarity >= 0.8)
      ? [{ item, exact, similarity }] : [];
  }).sort((a, b) => b.similarity - a.similarity).slice(0, 3);
}
