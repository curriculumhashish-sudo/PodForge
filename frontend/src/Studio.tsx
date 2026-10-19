import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import { DebugDrawer } from "./components/DebugDrawer";
import { FlowCanvas } from "./components/FlowCanvas";
import { NodeInspector } from "./components/NodeInspector";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Toast } from "./components/Toast";
import { fetchStudio, saveWorkflow as persistWorkflow, streamWorkflowRun } from "./api";
import { StudioContext } from "./studio-context";
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
import {
  STORAGE_KEY,
  createDefaultWorkflow,
  createEdge,
  createNode,
  defaultDebugInput,
  documentSignature,
  fallbackVoices,
  hydrateWorkflow,
  toDocument,
} from "./workflow";

function initialDebugInput(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? defaultDebugInput;
  } catch {
    return defaultDebugInput;
  }
}

function createsCycle(source: string, target: string, edges: AppEdge[]): boolean {
  const stack = [target];
  const seen = new Set(stack);
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === source) return true;
    for (const edge of edges) {
      if (edge.source === current && !seen.has(edge.target)) {
        seen.add(edge.target);
        stack.push(edge.target);
      }
    }
  }
  return false;
}

function findFreeSlot(): { x: number; y: number } | null {
  const bounds = document.querySelector(".canvas-wrap")?.getBoundingClientRect();
  if (!bounds) return null;
  const occupied = [
    ...document.querySelectorAll<HTMLElement>(".react-flow__node, .canvas-meta, .canvas-helper"),
  ].map((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left - 8, top: rect.top - 8, right: rect.right + 8, bottom: rect.bottom + 8 };
  });
  const slotWidth = 190;
  const slotHeight = 96;
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      const left = bounds.left + 24 + column * 210;
      const top = bounds.top + 18 + row * 108;
      if (left + slotWidth > bounds.right - 16 || top + slotHeight > bounds.bottom - 16) continue;
      const hit = occupied.some(
        (rect) => left < rect.right && left + slotWidth > rect.left && top < rect.bottom && top + slotHeight > rect.top,
      );
      if (!hit) return { x: left, y: top };
    }
  }
  return null;
}

export function Studio() {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [initialWorkflow] = useState(createDefaultWorkflow);
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(initialWorkflow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppEdge>(initialWorkflow.edges);
  const [workflowName, setWorkflowName] = useState(initialWorkflow.name);
  const [debugInput, setDebugInput] = useState(initialDebugInput);
  const [debugOpen, setDebugOpen] = useState(true);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({});
  const [running, setRunning] = useState(false);
  const [runPhase, setRunPhase] = useState<RunPhase>("idle");
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [workflowError, setWorkflowError] = useState("");
  const [finalOutput, setFinalOutput] = useState<WorkflowOutput | null>(null);
  const [runDurationMs, setRunDurationMs] = useState<number | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>(fallbackVoices);
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [engineOnline, setEngineOnline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);
  const runningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((message: string, tone: "info" | "error" = "info") => {
    setToast({ message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const updateNodeData = useCallback(
    (nodeId: string, patch: Partial<FlowNodeData>) => {
      setNodes((current) =>
        current.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node)),
      );
    },
    [setNodes],
  );

  const selectNode = useCallback(
    (nodeId: string) => {
      setNodes((current) => current.map((node) => ({ ...node, selected: node.id === nodeId })));
    },
    [setNodes],
  );

  const addNode = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }) => {
      if (runningRef.current) return;
      if (kind === "userInput" || kind === "end") {
        const existing = nodes.find((node) => node.type === kind);
        if (existing) {
          selectNode(existing.id);
          showToast(`画布中已经有一个「${kind === "userInput" ? "用户输入" : "结束"}」节点`);
          return;
        }
      }
      let placement = position;
      if (!placement) {
        const slot = findFreeSlot();
        if (slot) {
          const flowPoint = screenToFlowPosition(slot);
          placement = { x: flowPoint.x, y: flowPoint.y };
        } else {
          const canvasBounds = document.querySelector(".canvas-wrap")?.getBoundingClientRect();
          const fallbackPosition = screenToFlowPosition({
            x: canvasBounds ? canvasBounds.left + canvasBounds.width / 2 : window.innerWidth / 2,
            y: canvasBounds ? canvasBounds.top + canvasBounds.height / 2 : window.innerHeight / 2,
          });
          const jitter = (nodes.length % 4) * 18;
          placement = { x: fallbackPosition.x - 114 + jitter, y: fallbackPosition.y - 60 + jitter };
        }
      }
      const node = createNode(kind, placement);
      setNodes((current) =>
        current.map((item) => ({ ...item, selected: false })).concat({ ...node, selected: true }),
      );
    },
    [nodes, screenToFlowPosition, selectNode, setNodes, showToast],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      if (runningRef.current) return;
      const node = nodes.find((item) => item.id === nodeId);
      if (!node) return;
      if (node.type === "userInput" || node.type === "end") {
        showToast("用户输入和结束节点是工作流边界，不能删除");
        return;
      }
      setNodes((current) => current.filter((item) => item.id !== nodeId));
      setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setNodeStatuses((current) => {
        const next = { ...current };
        delete next[nodeId];
        return next;
      });
      showToast("节点已从画布移除");
    },
    [nodes, setEdges, setNodes, showToast],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (runningRef.current) return;
      const { source, target } = connection;
      if (!source || !target || source === target) return;
      const sourceNode = nodes.find((node) => node.id === source);
      const targetNode = nodes.find((node) => node.id === target);
      if (!sourceNode || !targetNode) return;
      if (sourceNode.type === "end" || targetNode.type === "userInput") return;
      if (edges.some((edge) => edge.source === source && edge.target === target)) return;
      if (createsCycle(source, target, edges)) {
        showToast("这条连线会形成循环，DAG 工作流不允许循环依赖", "error");
        return;
      }
      setEdges((current) => addEdge(createEdge(`edge-${crypto.randomUUID()}`, source, target), current));
    },
    [edges, nodes, setEdges, showToast],
  );

  const resetWorkflow = useCallback(() => {
    if (runningRef.current) return;
    const confirmed = window.confirm("重置画布会恢复成内置的 AI 播客链路，当前未保存的修改会丢失。继续吗？");
    if (!confirmed) return;
    const fresh = createDefaultWorkflow();
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setWorkflowName(fresh.name);
    setNodeStatuses({});
    setSteps([]);
    setFinalOutput(null);
    setWorkflowError("");
    setRunPhase("idle");
    setRunDurationMs(null);
    window.setTimeout(() => fitView({ duration: 360, padding: 0.22 }), 40);
  }, [fitView, setEdges, setNodes]);

  useEffect(() => {
    document.title = `${workflowName || "AI 播客"} · PaiAgent Studio`;
  }, [workflowName]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, debugInput);
    } catch {
      // 本地存储不可用时不影响编辑
    }
  }, [debugInput]);

  useEffect(() => {
    let active = true;
    void fetchStudio()
      .then((studio) => {
        if (!active) return;
        setStatus(studio);
        setVoices(studio.voices);
        setEngineOnline(true);
        if (studio.workflow) {
          const hydrated = hydrateWorkflow(studio.workflow);
          if (hydrated) {
            setNodes(hydrated.nodes);
            setEdges(hydrated.edges);
            setWorkflowName(hydrated.name);
            setSavedSignature(documentSignature(toDocument(hydrated.name, hydrated.nodes, hydrated.edges)));
            setSavedAt(studio.workflow.savedAt ?? null);
          }
        }
        window.setTimeout(() => fitView({ duration: 0, padding: 0.2 }), 80);
      })
      .catch(() => {
        if (!active) return;
        setEngineOnline(false);
        setStatus(null);
      });
    return () => {
      active = false;
    };
  }, [fitView, setEdges, setNodes]);

  const currentDocument = useMemo(
    () => toDocument(workflowName, nodes, edges),
    [edges, nodes, workflowName],
  );
  const currentSignature = useMemo(() => documentSignature(currentDocument), [currentDocument]);
  const dirty = savedSignature === null || currentSignature !== savedSignature;

  const handleSave = useCallback(async () => {
    if (saving || runningRef.current) return;
    setSaving(true);
    const snapshot = currentDocument;
    const signature = documentSignature(snapshot);
    try {
      const saved = await persistWorkflow(snapshot);
      setSavedAt(saved.savedAt);
      setSavedSignature(signature);
      setEngineOnline(true);
      showToast("工作流已保存到本地后台");
    } catch (error) {
      const message = error instanceof Error ? error.message : "工作流保存失败";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }, [currentDocument, saving, showToast]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  const runWorkflow = useCallback(async () => {
    if (runningRef.current) return;
    const userInput = debugInput.trim();
    if (!userInput) {
      setWorkflowError("请先输入一段主题或口播草稿，再运行测试");
      return;
    }
    runningRef.current = true;
    setRunning(true);
    setRunPhase("running");
    setWorkflowError("");
    setFinalOutput(null);
    setRunDurationMs(null);
    setSteps([]);
    setNodeStatuses(Object.fromEntries(nodes.map((node) => [node.id, "idle" as NodeStatus])));
    const controller = new AbortController();
    abortRef.current = controller;
    let terminal = false;

    try {
      await streamWorkflowRun({
        nodes,
        edges,
        workflowName,
        userInput,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.event === "workflow_started") {
            setEngineOnline(true);
            return;
          }
          if (event.event === "node_started") {
            setNodeStatuses((current) => ({ ...current, [event.nodeId]: "running" }));
            setSteps((current) =>
              current.concat({
                nodeId: event.nodeId,
                nodeType: event.nodeType,
                label: event.label,
                status: "running",
                text: "",
                audioUrl: null,
                provider: null,
                detail: null,
                message: "",
              }),
            );
            return;
          }
          if (event.event === "node_finished") {
            setNodeStatuses((current) => ({ ...current, [event.nodeId]: "success" }));
            setSteps((current) =>
              current.map((step) =>
                step.nodeId === event.nodeId
                  ? {
                      ...step,
                      status: "success",
                      durationMs: event.durationMs,
                      text: event.output.text,
                      audioUrl: event.output.audioUrl,
                      provider: event.output.provider,
                      detail: event.output.detail,
                    }
                  : step,
              ),
            );
            return;
          }
          if (event.event === "node_failed") {
            terminal = true;
            setNodeStatuses((current) => ({ ...current, [event.nodeId]: "error" }));
            setSteps((current) =>
              current.map((step) =>
                step.nodeId === event.nodeId
                  ? { ...step, status: "error", message: event.message }
                  : step,
              ),
            );
            setWorkflowError(event.message);
            setRunPhase("error");
            return;
          }
          if (event.event === "workflow_failed") {
            terminal = true;
            setWorkflowError(event.message);
            setRunPhase("error");
            return;
          }
          terminal = true;
          setRunDurationMs(event.durationMs);
          setFinalOutput({
            text: event.output.text,
            audioUrl: event.output.audioUrl,
            provider: event.output.provider,
            detail: event.output.detail,
            warning: event.warning,
          });
          setRunPhase("success");
        },
      });
      if (!terminal) {
        setWorkflowError("执行流意外中断，请重新运行");
        setRunPhase("error");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setWorkflowError("已停止本次运行");
        setRunPhase("idle");
      } else {
        const message = error instanceof Error ? error.message : "工作流运行失败";
        setWorkflowError(message);
        setRunPhase("error");
      }
    } finally {
      runningRef.current = false;
      abortRef.current = null;
      setRunning(false);
    }
  }, [debugInput, edges, nodes, workflowName]);

  const stopRun = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runningNodeCount = steps.filter((step) => step.status === "running").length;
  const finishedNodeCount = steps.filter((step) => step.status !== "running").length;
  const llmConfigured = status?.llmConfigured ?? false;

  return (
    <StudioContext.Provider
      value={{
        workflowName,
        setWorkflowName,
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        addNode,
        removeNode,
        updateNodeData,
        resetWorkflow,
        selectNode,
        nodeStatuses,
        debugOpen,
        setDebugOpen,
        debugInput,
        setDebugInput,
        running,
        runPhase,
        steps,
        workflowError,
        finalOutput,
        runDurationMs,
        voices,
        status,
        engineOnline,
        llmConfigured,
        llmModel: status?.llmModel ?? "gpt-4o-mini",
        runningNodeCount,
        finishedNodeCount,
        saving,
        dirty,
        savedAt,
        saveWorkflow: handleSave,
        runWorkflow,
        stopRun,
        toast,
      }}
    >
      <div className="studio-shell">
        <TopBar />
        <Sidebar />
        <main className={debugOpen ? "stage has-debug" : "stage"}>
          <FlowCanvas />
          <DebugDrawer />
        </main>
        <NodeInspector />
        {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
      </div>
    </StudioContext.Provider>
  );
}
