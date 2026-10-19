import { useMemo, type DragEvent } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import { GitBranch, MousePointer2 } from "lucide-react";
import { nodeTypes } from "./nodes";
import { useStudio } from "../studio-context";
import { decorateEdge, isNodeKind } from "../workflow";

export function FlowCanvas() {
  const {
    nodes,
    edges,
    nodeStatuses,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    selectNode,
    running,
    debugOpen,
    finishedNodeCount,
    runningNodeCount,
  } = useStudio();
  const { screenToFlowPosition } = useReactFlow();

  const canvasNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: { ...node.data, status: nodeStatuses[node.id] ?? "idle" },
      })),
    [nodeStatuses, nodes],
  );
  const canvasEdges = useMemo(
    () => edges.map((edge) => decorateEdge(edge, nodeStatuses)),
    [edges, nodeStatuses],
  );

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (running) return;
    const kind = event.dataTransfer.getData("application/x-pai-node");
    if (!isNodeKind(kind)) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNode(kind, { x: position.x - 116, y: position.y - 62 });
  }

  function isValidConnection(connection: Connection | { source: string; target: string }) {
    if (!connection.source || !connection.target || connection.source === connection.target) return false;
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);
    if (!sourceNode || !targetNode) return false;
    return sourceNode.type !== "end" && targetNode.type !== "userInput";
  }

  const progressLabel =
    running && nodes.length > 0 ? `执行中 ${finishedNodeCount}/${nodes.length}` : `${nodes.length} 个节点 · ${edges.length} 条连线`;

  return (
    <div className="canvas-wrap" onDragOver={onDragOver} onDrop={onDrop}>
      <div className="canvas-meta">
        <span className="canvas-badge">
          <GitBranch size={13} />
          FLOW / 01
        </span>
        <span className="canvas-count">{progressLabel}</span>
        {running && runningNodeCount > 0 ? <span className="canvas-live">LIVE</span> : null}
      </div>

      <ReactFlow
        nodes={canvasNodes}
        edges={canvasEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={() => selectNode("")}
        isValidConnection={isValidConnection}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.3}
        maxZoom={1.6}
        nodesDraggable={!running}
        nodesConnectable={!running}
        edgesReconnectable={!running}
        deleteKeyCode={running ? null : ["Backspace", "Delete"]}
        selectNodesOnDrag={false}
        connectionLineStyle={{ stroke: "#e35d36", strokeWidth: 2 }}
        colorMode="light"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#d9d1c6" />
        <Controls position="top-right" showInteractive={false} />
      </ReactFlow>

      <div className={debugOpen ? "canvas-helper is-raised" : "canvas-helper"}>
        <MousePointer2 size={13} />
        拖动节点右侧端口连接到下一位
      </div>
    </div>
  );
}
