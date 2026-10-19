from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Position(BaseModel):
    x: float
    y: float


class GraphNode(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    type: str = Field(min_length=1, max_length=40)
    data: dict[str, Any] = Field(default_factory=dict)
    position: Position | None = None


class GraphEdge(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    source: str = Field(min_length=1, max_length=80)
    target: str = Field(min_length=1, max_length=80)


class WorkflowDocument(BaseModel):
    name: str = Field(default="AI 播客工作流", max_length=80)
    nodes: list[GraphNode] = Field(default_factory=list, max_length=60)
    edges: list[GraphEdge] = Field(default_factory=list, max_length=120)


class RunRequest(WorkflowDocument):
    model_config = ConfigDict(populate_by_name=True)

    user_input: str = Field(alias="userInput", min_length=1, max_length=4000)
