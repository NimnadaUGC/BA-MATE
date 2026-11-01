import type { ArtifactReference, Project } from "./types";

export const artifactRoute = (type: ArtifactReference["type"]) =>
  type === "Source"
    ? "sources"
    : type === "Diagram"
      ? "diagrams"
      : type === "Document" || type === "Document section"
        ? "documents"
        : type === "Change request"
          ? "changes"
          : type === "Governance check"
            ? "governance"
            : "artifacts";

export const projectReferences = (project: Project): ArtifactReference[] => [
  ...project.sources.map((item) => ({
    id: item.id,
    type: "Source" as const,
    label: item.name,
    route: "sources",
  })),
  ...project.requirements.map((item) => ({
    id: item.id,
    type: "Requirement" as const,
    label: item.title,
    version: item.version,
    route: "artifacts",
  })),
  ...project.stories.map((item) => ({
    id: item.id,
    type: "User story" as const,
    label: `${item.role}: ${item.goal}`,
    version: item.version,
    route: "artifacts",
  })),
  ...project.diagrams.map((item) => ({
    id: item.id,
    type: "Diagram" as const,
    label: item.name,
    version: item.version,
    route: "diagrams",
  })),
  ...project.documents.map((item) => ({
    id: item.id,
    type: "Document" as const,
    label: item.name,
    version: item.version,
    route: "documents",
  })),
  ...project.changes.map((item) => ({
    id: item.id,
    type: "Change request" as const,
    label: item.title,
    route: "changes",
  })),
  ...project.checks.map((item) => ({
    id: item.id,
    type: "Governance check" as const,
    label: item.title,
    route: "governance",
  })),
];
