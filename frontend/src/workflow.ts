import { MarkerType } from "@xyflow/react";
import type {
  AppEdge,
  AppNode,
  FlowNodeData,
  NodeKind,
  NodeStatus,
  SavedWorkflow,
  VoiceOption,
  WorkflowDocumentPayload,
} from "./types";

export const STORAGE_KEY = "paiagent2.debug-input";

export const defaultSystemPrompt =
  "你是一位专业的中文播客编剧，擅长把任何主题写成自然、真诚、适合倾听的单人口播。请把用户给出的主题或草稿改写成直接可以朗读的播客讲稿。要求：口语化，句子短，有起承转合；开头自然吸引人，结尾有余韵；篇幅控制在 220 到 360 个汉字；不要标题、不要分点、不要舞台提示、不要表情符号、不要 Markdown；只输出口播正文。";

export const defaultDebugInput = "聊聊为什么夜晚，更适合听一档慢下来的播客。";

export const sampleInputs = [
  { label: "夜晚与播客", value: "聊聊为什么夜晚，更适合听一档慢下来的播客。" },
  { label: "给紧张的人", value: "给第一次独自录播客的人，写一段让人不紧张的开场白。" },
  { label: "工具的意义", value: "用口语说说，为什么工作流里的工具节点像一条传送带。" },
];

export const fallbackVoices: VoiceOption[] = [
  { id: "zh-CN-XiaoxiaoNeural", name: "晓晓", gender: "女声", tone: "温暖自然" },
  { id: "zh-CN-XiaoyiNeural", name: "晓伊", gender: "女声", tone: "清晰明快" },
  { id: "zh-CN-XiaochenNeural", name: "晓辰", gender: "女声", tone: "亲切闲聊" },
  { id: "zh-CN-XiaohanNeural", name: "晓涵", gender: "女声", tone: "知性温和" },
  { id: "zh-CN-YunxiNeural", name: "云希", gender: "男声", tone: "年轻活力" },
  { id: "zh-CN-YunjianNeural", name: "云健", gender: "男声", tone: "沉稳磁性" },
  { id: "zh-CN-YunyangNeural", name: "云扬", gender: "男声", tone: "新闻播音" },
  { id: "zh-CN-YunxiaNeural", name: "云夏", gender: "男声", tone: "清朗少年" },
];

export const defaultVoiceId = fallbackVoices[0].id;

export const modelPresets = [
  "gpt-4o-mini",
  "deepseek-chat",
  "qwen-plus",
  "glm-4-flash",
];

export const nodeTypeLabels: Record<NodeKind, string> = {
  userInput: "用户输入",
  llm: "大模型",
  tts: "超拟人音频合成",
  end: "结束",
};

export const nodeTypeDescriptions: Record<NodeKind, string> = {
  userInput: "从调试抽屉接收本次测试文字，作为工作流起点。",
  llm: "调用 OpenAI 兼容大模型，把主题或草稿改写成可朗读的播客口播稿。",
  tts: "使用中文神经语音，把口播稿合成一段自然、有呼吸感的 MP3 音频。",
  end: "汇总主链路的文本和音频，将最终结果交给调试播放器。",
};

export interface PaletteGroup {
  title: string;
  hint: string;
  items: Array<{ type: NodeKind; title: string; description: string }>;
}

export const paletteGroups: PaletteGroup[] = [
  {
    title: "基础节点",
    hint: "01 / FLOW",
    items: [
      { type: "userInput", title: "用户输入", description: "接收本次调试文字" },
      { type: "end", title: "结束", description: "汇总最终播客输出" },
    ],
  },
  {
    title: "大模型节点",
    hint: "02 / MODEL",
    items: [{ type: "llm", title: "大模型", description: "OpenAI 兼容 · 生成口播稿" }],
  },
  {
    title: "工具节点",
    hint: "03 / TOOL",
    items: [{ type: "tts", title: "超拟人音频合成", description: "Edge Neural · 中文语音" }],
  },
];

const nodeKinds: NodeKind[] = ["userInput", "llm", "tts", "end"];

export function isNodeKind(value: string): value is NodeKind {
  return nodeKinds.includes(value as NodeKind);
}

export function stripStatus(data: FlowNodeData): FlowNodeData {
  const clean = { ...data };
  delete clean.status;
  return clean;
}

export function voiceLabel(voiceId: string | undefined, voices: VoiceOption[] = fallbackVoices): string {
  const matched = voices.find((voice) => voice.id === voiceId) ?? fallbackVoices.find((voice) => voice.id === voiceId);
  if (!matched) return "默认音色";
  return `${matched.name} · ${matched.tone}`;
}

export function createEdge(id: string, source: string, target: string): AppEdge {
  return {
    id,
    source,
    target,
    type: "smoothstep",
    style: { stroke: "#c8c1b7", strokeWidth: 1.8 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: "#c8c1b7",
    },
  };
}

export function decorateEdge(edge: AppEdge, statuses: Record<string, NodeStatus>): AppEdge {
  const sourceStatus = statuses[edge.source] ?? "idle";
  const targetStatus = statuses[edge.target] ?? "idle";
  const active = sourceStatus === "success" && targetStatus === "running";
  const complete = sourceStatus === "success" && targetStatus === "success";
  const stroke = active ? "#e35d36" : complete ? "#2b7a6c" : "#c8c1b7";
  return {
    ...edge,
    animated: active,
    style: { stroke, strokeWidth: active ? 2.2 : 1.8 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: stroke,
    },
  };
}

export function createNode(kind: NodeKind, position: { x: number; y: number }): AppNode {
  const id = `node-${kind}-${crypto.randomUUID()}`;

  if (kind === "userInput") {
    return {
      id,
      type: kind,
      position,
      deletable: false,
      data: { label: "用户输入" },
    };
  }
  if (kind === "llm") {
    return {
      id,
      type: kind,
      position,
      data: {
        label: "大模型",
        model: "gpt-4o-mini",
        systemPrompt: defaultSystemPrompt,
        temperature: 0.7,
      },
    };
  }
  if (kind === "tts") {
    return {
      id,
      type: kind,
      position,
      data: { label: "超拟人音频合成", voice: defaultVoiceId, ratePercent: 0, pitchHz: 0 },
    };
  }
  return {
    id,
    type: kind,
    position,
    deletable: false,
    data: { label: "结束" },
  };
}

export function createDefaultWorkflow(): { name: string; nodes: AppNode[]; edges: AppEdge[] } {
  return {
    name: "AI 播客生成工作流",
    nodes: [
      {
        id: "node-input",
        type: "userInput",
        position: { x: 40, y: 190 },
        deletable: false,
        data: { label: "用户输入" },
      },
      {
        id: "node-llm",
        type: "llm",
        position: { x: 328, y: 190 },
        data: {
          label: "大模型",
          model: "gpt-4o-mini",
          systemPrompt: defaultSystemPrompt,
          temperature: 0.7,
        },
      },
      {
        id: "node-tts",
        type: "tts",
        position: { x: 616, y: 190 },
        data: { label: "超拟人音频合成", voice: defaultVoiceId, ratePercent: 0, pitchHz: 0 },
      },
      {
        id: "node-end",
        type: "end",
        position: { x: 904, y: 190 },
        deletable: false,
        data: { label: "结束" },
      },
    ],
    edges: [
      createEdge("edge-input-llm", "node-input", "node-llm"),
      createEdge("edge-llm-tts", "node-llm", "node-tts"),
      createEdge("edge-tts-end", "node-tts", "node-end"),
    ],
  };
}

export function toDocument(name: string, nodes: AppNode[], edges: AppEdge[]): WorkflowDocumentPayload {
  return {
    name: name.trim() || "AI 播客生成工作流",
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type as NodeKind,
      data: stripStatus(node.data),
      position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}

export function documentSignature(document: WorkflowDocumentPayload): string {
  return JSON.stringify(document);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hydrateNode(value: unknown, index: number): AppNode | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.type !== "string") return null;
  if (!isNodeKind(value.type) || !isRecord(value.data)) return null;
  const label = value.data.label;
  if (typeof label !== "string" || !label.trim()) return null;
  const position = isRecord(value.position) ? value.position : null;
  const x = typeof position?.x === "number" ? position.x : 40 + index * 288;
  const y = typeof position?.y === "number" ? position.y : 190;
  const data = stripStatus(value.data as FlowNodeData);
  return {
    id: value.id,
    type: value.type,
    position: { x, y },
    deletable: value.type !== "userInput" && value.type !== "end",
    selected: false,
    data,
  };
}

function hydrateEdge(value: unknown, nodeIds: Set<string>): AppEdge | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.source !== "string" || typeof value.target !== "string") {
    return null;
  }
  if (!nodeIds.has(value.source) || !nodeIds.has(value.target)) return null;
  return createEdge(value.id, value.source, value.target);
}

export function hydrateWorkflow(saved: SavedWorkflow): { name: string; nodes: AppNode[]; edges: AppEdge[] } | null {
  if (!Array.isArray(saved.nodes) || saved.nodes.length === 0) return null;
  const nodes = saved.nodes.map((node, index) => hydrateNode(node, index));
  if (nodes.some((node) => node === null)) return null;
  const validNodes = nodes as AppNode[];
  const nodeIds = new Set(validNodes.map((node) => node.id));
  const edges = (Array.isArray(saved.edges) ? saved.edges : [])
    .map((edge) => hydrateEdge(edge, nodeIds))
    .filter((edge): edge is AppEdge => edge !== null);
  return {
    name: saved.name?.trim() || "AI 播客生成工作流",
    nodes: validNodes,
    edges,
  };
}

export function formatDuration(durationMs: number | undefined): string {
  if (durationMs === undefined) return "";
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

export function formatSavedTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatRate(ratePercent: number): string {
  return ratePercent > 0 ? `+${ratePercent}%` : `${ratePercent}%`;
}

export function formatPitch(pitchHz: number): string {
  return pitchHz > 0 ? `+${pitchHz} Hz` : `${pitchHz} Hz`;
}

export function providerLabel(provider: string | null): string {
  if (provider === "local") return "本地整理";
  if (provider === "llm") return "大模型";
  if (provider === "edge-neural") return "神经语音";
  if (provider === "user") return "用户输入";
  if (provider === "end") return "结束输出";
  return "";
}

export function previewText(text: string, limit = 88): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= limit) return singleLine;
  return `${singleLine.slice(0, limit)}…`;
}
