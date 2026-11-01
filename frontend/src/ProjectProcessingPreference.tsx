import type { Project } from './types';
import { addAudit } from './store';

export function ProjectProcessingPreference({ project, update }: { project: Project; update: (fn: (project: Project) => void) => void }) {
  const confidential = project.sources.some(source => source.classification === 'Confidential');
  return <div className="project-processing-preference">
    <label className="workbench-check"><input type="checkbox" checked={project.cloudAllowed ?? false} disabled={confidential && !project.cloudAllowed} onChange={event => {
      const allowed = event.target.checked;
      update(current => {
        if (allowed && current.sources.some(source => source.classification === 'Confidential')) return;
        current.cloudAllowed = allowed;
        addAudit(current, 'Changed processing preference', current.id, allowed ? 'External model processing enabled for non-confidential project context.' : 'Local model processing only.');
      });
    }} />Allow this project’s non-confidential context to be sent to the configured external model service</label>
    <p className="processing-help">{confidential ? 'External AI is unavailable while this project contains confidential sources. Use a local model.' : 'Applies to Task AI, Ask BA Mate and the project assistant. Local models remain available when this is off. Provider credentials are configured in Settings.'}</p>
  </div>;
}
