import type { Project } from './types';

/** Supply synthetic revision pins for tests that are not exercising source review. */
export function pinSyntheticSources(project: Project) {
  for (const goal of project.goals) {
    goal.sourceRevisionPins = {};
    for (const id of goal.sourceIds) {
      const source = project.sources.find(item => item.id === id);
      if (!source) continue;
      source.approved = true;
      source.status = 'Analyzed';
      source.relativePath = `fixtures/${id}.txt`;
      source.sha256 = `synthetic-${id}`;
      goal.sourceRevisionPins[id] = source.sha256;
    }
  }
}
