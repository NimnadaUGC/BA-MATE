/** Present the recorded fields consistently without modifying the stored story. */
export function storyNarrative(story: { role: string; goal: string; value: string }): string {
  const role = story.role.trim(), goal = story.goal.trim(), value = story.value.trim();
  const goalPrefix = /^to\b/i.test(goal) ? '' : 'to ';
  const valuePrefix = /^so\b/i.test(value) ? '' : 'so that ';
  const punctuation = /[.!?]$/.test(value) ? '' : '.';
  return `As a ${role}, I want ${goalPrefix}${goal}, ${valuePrefix}${value}${punctuation}`;
}
