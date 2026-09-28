export type Tone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "purple";
export type WorkflowGate =
  | "Setup"
  | "Discover"
  | "Clarify"
  | "Define"
  | "Validate"
  | "Approve";
export type MemberRole =
  | "Owner / Lead BA"
  | "BA Editor"
  | "Reviewer"
  | "Viewer"
  | "Research Administrator";
export type ItemStatus =
  | "draft"
  | "open"
  | "in-review"
  | "approved"
  | "rejected"
  | "resolved";
export type SyncStatus =
  | "Not included"
  | "Synced"
  | "Out of sync"
  | "Update proposed";
export type ArtifactType =
  | "Source"
  | "Clarification"
  | "Requirement"
  | "User story"
  | "Acceptance criterion"
  | "Register item"
  | "Diagram"
  | "Document"
  | "Document section"
  | "Change request"
  | "Governance check";
export type DocumentTemplate =
  | "Software Requirements Specification"
  | "Business Requirements Document"
  | "Requirements Addendum"
  | "Change Impact Report"
  | "Traceability Report"
  | "Workshop Summary";

export interface ArtifactReference {
  id: string;
  type: ArtifactType;
  label: string;
  version?: number;
  route?: string;
}
export interface ConversationContext extends ArtifactReference {
  origin: "automatic" | "attached" | "mentioned";
  removable: boolean;
}
export interface Comment {
  id: string;
  author: string;
  text: string;
  at: string;
  resolved: boolean;
}
export interface ArtifactProposal {
  id: string;
  kind:
    | "requirement-revision"
    | "story-revision"
    | "criterion-addition"
    | "register-update"
    | "diagram-revision"
    | "document-section"
    | "document-sync";
  target: string;
  before: string;
  after: string;
  status: "pending" | "accepted" | "rejected";
  references: ArtifactReference[];
  impact: string[];
}

export interface Source {
  content?: string;
  originalBase64?: string;
  sha256?: string;
  version?: number;
  passages?: { locator: string; text: string }[];
  extractionLimitations?: string[];
  id: string;
  name: string;
  type: "PDF" | "DOCX" | "TXT" | "Image" | "Policy";
  status: "Analyzed" | "Needs review" | "Excluded";
  classification: "Project only" | "Confidential" | "Public";
  provenance: string;
  concepts: string[];
  approved: boolean;
  immutable: boolean;
}
export interface Clarification {
  id: string;
  priority: "Blocking" | "Important" | "Optional";
  question: string;
  rationale: string;
  sourceId: string;
  owner: string;
  status: "Unanswered" | "Answered" | "Deferred" | "Discarded";
  answer?: string;
  suggestions: string[];
  affects: string[];
  version?: number;
  goalId?: string;
}
export interface Requirement {
  id: string;
  kind: "Functional" | "Non-functional";
  title: string;
  statement: string;
  priority: "Must" | "Should" | "Could";
  status: ItemStatus;
  owner: string;
  sourceIds: string[];
  storyIds: string[];
  checkIds: string[];
  version: number;
  rationale: string;
  businessValue: string;
  businessRules: string[];
  fitCriteria: string[];
  dependencies: string[];
  stakeholders: string[];
  openQuestions: string[];
  comments: Comment[];
  syncStatus: SyncStatus;
  rejectionReason?: string;
  goalId?: string;
}
export interface UserStory {
  id: string;
  role: string;
  goal: string;
  value: string;
  priority: "Must" | "Should" | "Could";
  status: ItemStatus;
  requirementIds: string[];
  criteria: string[];
  version: number;
  epic: string;
  feature: string;
  owner: string;
  dependencies: string[];
  sourceIds: string[];
  comments: Comment[];
  syncStatus: SyncStatus;
  rejectionReason?: string;
  goalId?: string;
}
export interface RegisterItem {
  id: string;
  type: "Stakeholder" | "Assumption" | "Decision" | "Risk" | "Issue";
  title: string;
  owner: string;
  severity?: "Low" | "Medium" | "High";
  status: ItemStatus;
  due?: string;
  version?: number;
  goalId?: string;
}
export interface TraceLink {
  id: string;
  from: string;
  to: string;
  /** The endpoint revisions that were actually reviewed when this link was verified. */
  fromRevision?: number;
  toRevision?: number;
  relation: string;
  status: "Verified" | "Pending" | "Broken";
  goalId?: string;
}
export interface CheckResult {
  id: string;
  category: string;
  title: string;
  status: "Passed" | "Warning" | "Blocking" | "Not applicable";
  source: string;
  rationale: string;
  owner: string;
  resolution?: string;
  immutable?: boolean;
  version?: number;
  goalId?: string;
}
export interface DiagramVersion {
  version: number;
  source: string;
  at: string;
  actor: string;
  note: string;
}
export interface Diagram {
  id: string;
  name: string;
  type:
    | "Flowchart"
    | "Sequence"
    | "State"
    | "Entity relationship"
    | "User journey";
  source: string;
  linkedIds: string[];
  version: number;
  status: "Draft" | "In review" | "Approved" | "Current" | "Possibly stale";
  approvalStatus: "Draft" | "In review" | "Approved";
  comments: Comment[];
  versions: DiagramVersion[];
  goalId?: string;
}
export type DocumentBlockType =
  | "heading"
  | "paragraph"
  | "bullet-list"
  | "numbered-list"
  | "table"
  | "callout"
  | "requirements-table"
  | "stories-table"
  | "traceability-matrix"
  | "diagram"
  | "artifact-reference";
export interface DiagramEmbedding {
  diagramId: string;
  version: number;
  insertedAt: string;
  stale: boolean;
}
export interface DocumentBlock {
  id: string;
  type: DocumentBlockType;
  content: string;
  linkedIds: string[];
  alignment?: "left" | "center" | "right";
  style?: "normal" | "bold" | "italic" | "underline";
  embedding?: DiagramEmbedding;
}
export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  linkedIds: string[];
  blocks: DocumentBlock[];
  comments: Comment[];
  goalId?: string;
}
export interface DocumentSyncReceipt {
  id: string;
  at: string;
  documentVersion: number;
  artifactVersions: { id: string; version: number }[];
  acceptedBlockIds: string[];
  targetDocumentRevision?: number;
}
export interface ProjectDocument {
  id: string;
  name: string;
  template: DocumentTemplate;
  status: ItemStatus;
  sections: DocumentSection[];
  version: number;
  receipts: DocumentSyncReceipt[];
  comments: Comment[];
  goalId?: string;
}
export interface DocumentSyncChange {
  id: string;
  artifactId: string;
  action: "add" | "update" | "remove";
  sectionTitle: string;
  before: string;
  after: string;
  accepted: boolean;
  provenance: ArtifactReference[];
  /** Source revision captured when this proposal was generated. */
  sourceRevision: number;
  /** Existing block to replace; absent means create a new controlled block. */
  targetBlockId?: string;
  targetSectionId?: string;
}
export interface DocumentSyncProposal {
  id: string;
  targetDocumentId?: string;
  mode: "new-srs" | "update-srs" | "addendum";
  status: "pending" | "accepted" | "rejected" | "stale";
  changes: DocumentSyncChange[];
  createdAt: string;
  targetDocumentRevision?: number;
}

export interface ChangePatch {
  id: string;
  artifactId: string;
  artifactType: "Requirement" | "User story" | "Diagram" | "Document";
  /** The exact field/block being changed, never a display-only example. */
  targetId?: string;
  field: "statement" | "criteria" | "source" | "content";
  before: string;
  after: string;
  sourceRevision: number;
  selected: boolean;
  status: "Proposed" | "Accepted" | "Rejected" | "Applied";
}
export interface ChangeRequest {
  id: string;
  title: string;
  rationale: string;
  source: string;
  status: "Proposed" | "Impact review" | "Approved" | "Implemented" | "Revalidated";
  impacts: { id: string; type: string; reason: string; selected: boolean }[];
  patches?: ChangePatch[];
  /** Optional reviewed AI impact run retained as advisory evidence for this request. */
  impactRunId?: string;
  baselineId?: string;
  approvedAt?: string;
  implementedAt?: string;
  revalidatedAt?: string;
  goalId?: string;
}
export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  object: string;
  detail: string;
}
export interface VersionSnapshot {
  snapshot?: Record<string, unknown>;
  id: string;
  label: string;
  version: string;
  at: string;
  actor: string;
  type: "Autosave" | "Snapshot" | "Baseline";
  locked: boolean;
  changes: string;
  /** Explicit content manifest for a baseline/snapshot; never inferred from later working content. */
  manifest?: ArtifactRevisionReference[];
}

export interface ArtifactRevisionReference {
  id: string;
  type: ArtifactType;
  revision: number;
}
export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  references?: ArtifactReference[];
  proposal?: ArtifactProposal;
  contextReceipt?: ModelContextReceipt;
}

export interface ModelContextReceipt {
  partialReferenceIds?: string[];
  requestId: string;
  provider: string;
  strategy: "priority-budget-compaction";
  generatedAt: string;
  tokenBudget: number;
  estimatedTokens: number;
  includedReferenceIds: string[];
  omittedReferenceIds: string[];
  governanceIncluded: boolean;
}
export interface Conversation {
  id: string;
  title: string;
  context: ConversationContext[];
  updated: string;
  messages: ConversationMessage[];
}
export interface ProjectGoal {
  id: string;
  title: string;
  kind:
    | "New discovery"
    | "Improve existing documentation"
    | "Requirements addendum"
    | "New deliverable";
  status: "Active" | "Planned" | "Completed";
  description: string;
  createdAt: string;
  gate: WorkflowGate;
  gateIndex: number;
  conversationId?: string;
  parentGoalId?: string;
  sourceIds: string[];
  deliverables: string[];
}
export interface Member {
  id: string;
  name: string;
  initials: string;
  role: MemberRole;
  approval: boolean;
  status: "Active" | "Invited";
}
export interface EvaluationRun {
  connectionSignature?: string;
  projectId?: string;
  id: string;
  caseId: string;
  condition: "Manual" | "Generic AI" | "Proposed workflow";
  evaluatorCode: string;
  datasetVersion: string;
  prototypeVersion: string;
  model: string;
  promptVersion: string;
  duration: string;
  status: "Ready" | "Running" | "Complete";
  startedAt?: string;
  completedAt?: string;
}

export type ResearchEventType =
  | "page-view"
  | "stage-session"
  | "interaction"
  | "assistant-request"
  | "artifact-change"
  | "error";

export interface ResearchTelemetryEvent {
  id: string;
  at: string;
  projectId: string;
  goalId?: string;
  runId?: string;
  stage: WorkflowGate;
  section: string;
  type: ResearchEventType;
  durationMs?: number;
  successful: boolean;
}

export interface StageFeedback {
  id: string;
  at: string;
  projectId: string;
  goalId?: string;
  runId?: string;
  evaluatorCode: string;
  stage: WorkflowGate;
  taskCompleted: boolean;
  accuracyRating: 1 | 2 | 3 | 4 | 5;
  usefulnessRating: 1 | 2 | 3 | 4 | 5;
  usabilityRating: 1 | 2 | 3 | 4 | 5;
  confidenceRating: 1 | 2 | 3 | 4 | 5;
  comment: string;
}

export interface Project {
  cloudAllowed?: boolean;
  aiRuns?: import("./workflow").SavedRun[];
  id: string;
  name: string;
  domain: string;
  description: string;
  /** Revision of the project brief content, independent of workflow status. */
  briefVersion?: number;
  color: string;
  gate: WorkflowGate;
  gateIndex: number;
  health: number;
  folderName: string;
  template: string;
  governancePacks: string[];
  sources: Source[];
  clarifications: Clarification[];
  requirements: Requirement[];
  stories: UserStory[];
  registers: RegisterItem[];
  traceLinks: TraceLink[];
  checks: CheckResult[];
  diagrams: Diagram[];
  documents: ProjectDocument[];
  documentSyncProposals: DocumentSyncProposal[];
  changes: ChangeRequest[];
  audit: AuditEvent[];
  versions: VersionSnapshot[];
  conversations: Conversation[];
  goals: ProjectGoal[];
  activeGoalId?: string;
  members: Member[];
}

export interface WorkspaceState {
  schemaVersion: number;
  projects: Project[];
  evaluationRuns: EvaluationRun[];
  telemetryEvents: ResearchTelemetryEvent[];
  stageFeedback: StageFeedback[];
  /** Pseudonymous consent and permitted measurement queue only; never account identity or access tokens. */
  researchParticipation?: import("./researchBoundary").LocalResearchParticipation;
}
