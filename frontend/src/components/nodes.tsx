import { memo, type ReactNode } from "react";
import { Handle, Position, type NodeProps, type NodeTypes } from "@xyflow/react";
import { AlertTriangle, Check, LoaderCircle } from "lucide-react";
import { nodeVisuals } from "./node-meta";
import type { AppNode, NodeKind, NodeStatus } from "../types";
import { formatRate, nodeTypeDescriptions, voiceLabel } from "../workflow";

function statusLabel(status: NodeStatus | undefined): string {
  if (status === "running") return "执行中";
  if (status === "success") return "已完成";
  if (status === "error") return "执行失败";
  return "";
}

function StatusPill({ status }: { status: NodeStatus | undefined }) {
  if (!status || status === "idle") return null;
  return (
    <span className={`wnode-status is-${status}`}>
      {status === "running" ? <LoaderCircle size={12} className="spin" /> : null}
      {status === "success" ? <Check size={12} /> : null}
      {status === "error" ? <AlertTriangle size={12} /> : null}
      {statusLabel(status)}
    </span>
  );
}

interface NodeShellProps {
  kind: NodeKind;
  status?: NodeStatus;
  selected: boolean;
  label: string;
  hasTarget: boolean;
  hasSource: boolean;
  children: ReactNode;
}

function NodeShell({ kind, status, selected, label, hasTarget, hasSource, children }: NodeShellProps) {
  const visual = nodeVisuals[kind];
  const Icon = visual.icon;
  const classes = [
    "workflow-node",
    `tone-${visual.tone}`,
    selected ? "is-selected" : "",
    status === "running" ? "is-running" : "",
    status === "success" ? "is-success" : "",
    status === "error" ? "is-error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} title={nodeTypeDescriptions[kind]}>
      {hasTarget ? <Handle type="target" position={Position.Left} className="flow-handle" /> : null}
      <div className="wnode-top">
        <span className="wnode-icon">
          <Icon size={18} strokeWidth={2} />
        </span>
        <div className="wnode-heading">
          <span className="wnode-kicker">{visual.kicker} NODE</span>
          <strong>{label}</strong>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="wnode-body">{children}</div>
      {hasSource ? <Handle type="source" position={Position.Right} className="flow-handle" /> : null}
    </div>
  );
}

export const UserInputNode = memo(function UserInputNode({ data, selected }: NodeProps<AppNode>) {
  return (
    <NodeShell
      kind="userInput"
      status={data.status}
      selected={Boolean(selected)}
      label={data.label || "用户输入"}
      hasTarget={false}
      hasSource
    >
      <p className="wnode-note">读取调试输入</p>
      <div className="wnode-foot">
        <span className="wnode-chip">TEXT</span>
        <span className="wnode-foot-hint">本次测试的起点</span>
      </div>
    </NodeShell>
  );
});

export const LlmNode = memo(function LlmNode({ data, selected }: NodeProps<AppNode>) {
  const temperature = typeof data.temperature === "number" ? data.temperature : 0.7;
  return (
    <NodeShell
      kind="llm"
      status={data.status}
      selected={Boolean(selected)}
      label={data.label || "大模型"}
      hasTarget
      hasSource
    >
      <p className="wnode-note">把主题写成可朗读的播客口播稿</p>
      <div className="wnode-foot">
        <span className="wnode-chip is-strong">{data.model || "默认模型"}</span>
        <span className="wnode-foot-hint">温度 {temperature.toFixed(1)}</span>
      </div>
    </NodeShell>
  );
});

function MiniWave() {
  return (
    <span className="mini-wave" aria-hidden="true">
      {[7, 12, 17, 10, 20, 14, 8, 16, 11].map((height, index) => (
        <i key={index} style={{ height }} />
      ))}
    </span>
  );
}

export const TtsNode = memo(function TtsNode({ data, selected }: NodeProps<AppNode>) {
  const ratePercent = typeof data.ratePercent === "number" ? data.ratePercent : 0;
  return (
    <NodeShell
      kind="tts"
      status={data.status}
      selected={Boolean(selected)}
      label={data.label || "超拟人音频合成"}
      hasTarget
      hasSource
    >
      <p className="wnode-note">把口播稿合成有呼吸感的中文音频</p>
      <div className="wnode-foot">
        <span className="wnode-chip is-strong">{voiceLabel(data.voice)}</span>
        <span className="wnode-foot-hint">语速 {formatRate(ratePercent)}</span>
      </div>
      <MiniWave />
    </NodeShell>
  );
});

export const EndNode = memo(function EndNode({ data, selected }: NodeProps<AppNode>) {
  return (
    <NodeShell
      kind="end"
      status={data.status}
      selected={Boolean(selected)}
      label={data.label || "结束"}
      hasTarget
      hasSource={false}
    >
      <p className="wnode-note">汇总口播稿和音频，交给播放器</p>
      <div className="wnode-foot">
        <span className="wnode-chip">TEXT + AUDIO</span>
        <span className="wnode-foot-hint">最终输出</span>
      </div>
    </NodeShell>
  );
});

export const nodeTypes = {
  userInput: UserInputNode,
  llm: LlmNode,
  tts: TtsNode,
  end: EndNode,
} satisfies NodeTypes;
