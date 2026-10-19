import { createContext, useContext } from "react";
import type { EdgeChange, NodeChange, OnConnect, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import type {
  AppEdge,
  AppNode,
  FlowNodeData,
  NodeKind,
  NodeStatus,
  RunPhase,
  RunStep,
  StudioStatus,
  VoiceOption,
  WorkflowOutput,
} from "./types";

export interface StudioContextValue {
  workflowName: string;
  setWorkflowName: (name: string) => void;
  nodes: AppNode[];
  edges: AppEdge[];
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange<AppEdge>;
  onConnect: OnConnect;
  addNode: (kind: NodeKind, position?: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, patch: Partial<FlowNodeData>) => void;
  resetWorkflow: () => void;
  selectNode: (nodeId: string) => void;
  nodeStatuses: Record<string, NodeStatus>;
  debugOpen: boolean;
  setDebugOpen: (open: boolean) => void;
  debugInput: string;
  setDebugInput: (value: string) => void;
  running: boolean;
  runPhase: RunPhase;
  steps: RunStep[];
  workflowError: string;
  finalOutput: WorkflowOutput | null;
  runDurationMs: number | null;
  voices: VoiceOption[];
  status: StudioStatus | null;
  engineOnline: boolean;
  llmConfigured: boolean;
  llmModel: string;
  runningNodeCount: number;
  finishedNodeCount: number;
  saving: boolean;
  dirty: boolean;
  savedAt: string | null;
  saveWorkflow: () => Promise<void>;
  runWorkflow: () => Promise<void>;
  stopRun: () => void;
  toast: { message: string; tone: "info" | "error" } | null;
}

export const StudioContext = createContext<StudioContextValue | null>(null);

export function useStudio(): StudioContextValue {
  const context = useContext(StudioContext);
  if (!context) throw new Error("工作流组件必须渲染在 StudioContext 中");
  return context;
}

export type { NodeChange, EdgeChange };
