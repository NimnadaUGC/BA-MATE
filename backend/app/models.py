from typing import Literal
from pydantic import BaseModel, Field

class AnalyzeRequest(BaseModel):
    project_id: str
    stakeholder_input: str = Field(min_length=5)

class RuleFinding(BaseModel):
    rule: str
    severity: Literal["info", "warning", "blocking"]
    message: str

class AnalysisResponse(BaseModel):
    label: str = "Draft — requires BA approval"
    provider: str
    clarification_questions: list[str]
    findings: list[RuleFinding]
    score: int

class ApprovalRequest(BaseModel):
    artifact_id: str
    decision: Literal["approved", "rejected", "revision_requested"]
    ba_name: str
    comment: str = ""

class OrchestrationMetadata(BaseModel):
    provider: str = "mock"
    model: str = "mock/deterministic-ba-v1"
    configuration: str = "deterministic-research-prototype"
    prompt_version: str = "adaptive-ba-v4"
    confidence: float = 0.82
    limitations: list[str] = ["Synthetic deterministic response", "Requires Business Analyst review"]
    provenance: list[str] = []

class ContextScanRequest(BaseModel):
    project_id: str
    domain: str
    source_names: list[str] = []
    text: str = Field(min_length=5)

class ClarificationRequest(BaseModel):
    project_id: str
    domain: str
    context: str = Field(min_length=5)

class ArtifactGenerationRequest(BaseModel):
    project_id: str
    context: str = Field(min_length=5)
    clarification_answers: dict[str, str] = {}

class SafeguardRequest(BaseModel):
    project_id: str
    domain: str
    artifact_text: str = Field(min_length=5)
    rule_packs: list[str] = []

class ImpactRequest(BaseModel):
    project_id: str
    change: str = Field(min_length=5)
    linked_artifacts: list[dict[str, str]] = []

class DiagramGenerationRequest(BaseModel):
    project_id: str
    diagram_type: Literal["flowchart", "sequence", "state", "entity-relationship", "user-journey"]
    context: str = Field(min_length=5)
    linked_artifact_ids: list[str] = []

class DiagramValidationRequest(BaseModel):
    project_id: str
    source: str = Field(min_length=5)

class DocumentGenerationRequest(BaseModel):
    project_id: str
    template: Literal["srs", "brd", "requirements-addendum", "change-impact", "traceability-report", "workshop-summary"]
    artifact_ids: list[str] = []
    context: str = Field(min_length=5)

class DocumentSyncRequest(BaseModel):
    project_id: str
    target_document_id: str | None = None
    mode: Literal["new-srs", "update-srs", "addendum"]
    artifacts: list[dict]

class ModelContextItem(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    type: str = Field(min_length=1, max_length=80)
    version: int | None = Field(default=None, ge=1)
    provenance: str = Field(min_length=1, max_length=500)
    content: str = Field(min_length=1, max_length=8000)
    priority: int = Field(ge=0, le=1000)
    estimated_tokens: int = Field(ge=1, le=10000)

class ModelCompletionRequest(BaseModel):
    request_id: str = Field(min_length=1, max_length=100)
    project_id: str = Field(min_length=1, max_length=100)
    goal_id: str | None = Field(default=None, max_length=100)
    task: Literal["project-conversation", "assistant-inspection"]
    prompt: str = Field(min_length=1, max_length=12000)
    context: list[ModelContextItem] = Field(default_factory=list, max_length=32)
    governance: list[str] = Field(default_factory=list, max_length=32)
    token_budget: int = Field(default=2400, ge=256, le=32000)

class OrchestrationResponse(BaseModel):
    label: str = "Suggestion — requires BA review"
    metadata: OrchestrationMetadata
    result: dict
