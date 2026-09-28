from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

class Evidence(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    type: str = Field(max_length=80)
    content: str = Field(min_length=1, max_length=200000)
    version: int | None = None
    provenance: str = ''
    priority: int = 1
    confidential: bool = False

class HistoryMessage(BaseModel):
    role: Literal['user', 'assistant']
    content: str = Field(max_length=12000)

class RunRequest(BaseModel):
    request_id: str = Field(min_length=1, max_length=100)
    project_id: str = Field(min_length=1, max_length=100)
    goal_id: str | None = None
    task: Literal['clarify', 'requirements', 'validate', 'diagram', 'document', 'impact', 'conversation']
    prompt: str = Field(min_length=1, max_length=12000)
    context: list[Evidence] = Field(default_factory=list, max_length=100)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=30)
    condition: Literal['Generic AI', 'Proposed workflow'] = 'Proposed workflow'
    cloud_allowed: bool = False
    expected_configuration: str | None = Field(default=None, max_length=64)

class Question(BaseModel):
    question: str
    rationale: str
    source_ids: list[str]
    priority: Literal['Blocking', 'Important', 'Optional']

class RequirementDraft(BaseModel):
    title: str
    statement: str
    kind: Literal['Functional', 'Non-functional']
    rationale: str
    acceptance_criteria: list[str]
    source_ids: list[str]
    assumptions: list[str]

class StoryDraft(BaseModel):
    role: str
    goal: str
    value: str
    acceptance_criteria: list[str]
    source_ids: list[str]

class Finding(BaseModel):
    title: str
    category: str
    severity: Literal['Warning', 'Blocking']
    explanation: str
    source_ids: list[str]

class DiagramDraft(BaseModel):
    name: str
    source: str = Field(description='The complete Mermaid diagram program, beginning with flowchart TD or another valid Mermaid diagram declaration. This is diagram code, never a source filename or evidence ID.')
    source_ids: list[str]

class SectionDraft(BaseModel):
    title: str
    content: str
    source_ids: list[str]

class WorkflowOutput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    summary: str
    questions: list[Question]
    requirements: list[RequirementDraft]
    stories: list[StoryDraft]
    findings: list[Finding]
    diagrams: list[DiagramDraft]
    sections: list[SectionDraft]
    limitations: list[str]
