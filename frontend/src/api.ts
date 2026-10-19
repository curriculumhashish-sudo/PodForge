import type {
  AppEdge,
  AppNode,
  RunEvent,
  SavedWorkflow,
  StudioStatus,
  WorkflowDocumentPayload,
} from "./types";
import { toDocument } from "./workflow";

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; detail?: string };
    return payload.message || payload.detail || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchStudio(): Promise<StudioStatus> {
  let response: Response;
  try {
    response = await fetch("/api/studio", { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("无法连接工作流引擎");
  }
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "工作流引擎状态异常"));
  }
  const payload = (await response.json()) as Partial<StudioStatus>;
  if (!Array.isArray(payload.voices)) throw new Error("音色列表格式异常");
  return {
    voices: payload.voices,
    llmConfigured: Boolean(payload.llmConfigured),
    llmModel: payload.llmModel || "gpt-4o-mini",
    ttsProvider: payload.ttsProvider || "Edge Neural TTS",
    workflow: payload.workflow ?? null,
  };
}

export async function saveWorkflow(document: WorkflowDocumentPayload): Promise<SavedWorkflow> {
  let response: Response;
  try {
    response = await fetch("/api/workflows/current", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(document),
    });
  } catch {
    throw new Error("无法连接工作流引擎，工作流尚未保存");
  }
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "工作流保存失败"));
  }
  return (await response.json()) as SavedWorkflow;
}

interface StreamRunOptions {
  nodes: AppNode[];
  edges: AppEdge[];
  workflowName: string;
  userInput: string;
  signal: AbortSignal;
  onEvent: (event: RunEvent) => void;
}

export async function streamWorkflowRun({
  nodes,
  edges,
  workflowName,
  userInput,
  signal,
  onEvent,
}: StreamRunOptions): Promise<void> {
  const document = toDocument(workflowName, nodes, edges);
  let response: Response;
  try {
    response = await fetch("/api/workflows/run", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify({ ...document, userInput }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("无法连接工作流引擎，请确认后端已启动");
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `工作流引擎返回错误（${response.status}）`));
  }
  if (!response.body) throw new Error("工作流引擎没有返回执行事件");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function consumeLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onEvent(JSON.parse(trimmed) as RunEvent);
    } catch {
      throw new Error("工作流引擎返回了无法解析的事件");
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      consumeLine(buffer.slice(0, newlineIndex));
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf("\n");
    }
  }
  buffer += decoder.decode();
  consumeLine(buffer);
}
