import type { Edge, Node } from "@xyflow/react";

export type NodeKind = "userInput" | "llm" | "tts" | "end";
export type NodeStatus = "idle" | "running" | "success" | "error";
export type RunPhase = "idle" | "running" | "success" | "error";

export interface FlowNodeData {
  label: string;
  status?: NodeStatus;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  voice?: string;
  ratePercent?: number;
  pitchHz?: number;
  [key: string]: unknown;
}

export interface NodePosition {
  x: number;
  y: number;
}

export type AppNode = Node<FlowNodeData, NodeKind>;
export type AppEdge = Edge;

export interface VoiceOption {
  id: string;
  name: string;
  gender: string;
  tone: string;
}

export interface PublicOutput {
  text: string;
  audioUrl: string | null;
  provider: string | null;
  detail: string | null;
}

export interface WorkflowOutput extends PublicOutput {
  warning: string | null;
}

export interface RunStep {
  nodeId: string;
  nodeType: string;
  label: string;
  status: "running" | "success" | "error";
  durationMs?: number;
  text: string;
  audioUrl: string | null;
  provider: string | null;
  detail: string | null;
  message: string;
}

export type RunEvent =
  | {
      event: "workflow_started";
      runId: string;
      workflowName: string;
      nodeCount: number;
    }
  | {
      event: "node_started";
      runId: string;
      nodeId: string;
      nodeType: string;
      label: string;
    }
  | {
      event: "node_finished";
      runId: string;
      nodeId: string;
      nodeType: string;
      label: string;
      durationMs: number;
      output: PublicOutput;
    }
  | {
      event: "node_failed";
      runId: string;
      nodeId: string;
      nodeType: string;
      label: string;
      message: string;
    }
  | {
      event: "workflow_finished";
      runId: string;
      durationMs: number;
      output: PublicOutput;
      warning: string | null;
    }
  | {
      event: "workflow_failed";
      runId: string;
      message: string;
    };

export interface WorkflowNodePayload {
  id: string;
  type: NodeKind;
  data: FlowNodeData;
  position: NodePosition;
}

export interface WorkflowEdgePayload {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowDocumentPayload {
  name: string;
  nodes: WorkflowNodePayload[];
  edges: WorkflowEdgePayload[];
}

export interface SavedWorkflow extends WorkflowDocumentPayload {
  savedAt: string;
}

export interface StudioStatus {
  voices: VoiceOption[];
  llmConfigured: boolean;
  llmModel: string;
  ttsProvider: string;
  workflow: SavedWorkflow | null;
}

export interface StudioBootstrap {
  engineOnline: boolean;
  status: StudioStatus | null;
}
