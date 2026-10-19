import type { CSSProperties } from "react";
import {
  ArrowRight,
  AudioLines,
  ChevronRight,
  Cpu,
  Info,
  Keyboard,
  Lock,
  Network,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Volume2,
} from "lucide-react";
import { nodeVisuals } from "./node-meta";
import { useStudio } from "../studio-context";
import type { FlowNodeData, NodeKind } from "../types";
import {
  defaultSystemPrompt,
  fallbackVoices,
  formatPitch,
  formatRate,
  modelPresets,
  nodeTypeDescriptions,
  nodeTypeLabels,
} from "../workflow";

function rangeStyle(value: number, min: number, max: number): CSSProperties {
  const percent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return {
    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percent}%, #e8e0d6 ${percent}%, #e8e0d6 100%)`,
  };
}

function nodeKindOf(nodeType: NodeKind | undefined): NodeKind {
  return nodeType ?? "end";
}

export function NodeInspector() {
  const {
    nodes,
    nodeStatuses,
    updateNodeData,
    removeNode,
    selectNode,
    voices,
    llmConfigured,
    llmModel,
    running,
  } = useStudio();
  const selectedNode = nodes.find((node) => node.selected) ?? null;

  if (!selectedNode) {
    const totalNodes = nodes.length;
    return (
      <aside className="inspector">
        <div className="inspector-head">
          <p className="eyebrow">WORKFLOW MAP</p>
          <h2>工作流概览</h2>
          <p className="inspector-description">
            输入一段文字，让模型整理成口播稿，再交给超拟人音频合成，最后在调试抽屉里播放。
          </p>
        </div>

        <section className="inspector-section">
          <div className="section-title">
            <span>
              <Network size={15} />
              运行链路
            </span>
            <small>{totalNodes} NODES</small>
          </div>
          <div className="overview-flow">
            {nodes.map((node, index) => {
              const kind = nodeKindOf(node.type);
              const visual = nodeVisuals[kind];
              const Icon = visual.icon;
              const status = nodeStatuses[node.id];
              return (
                <div className="overview-flow-row" key={node.id}>
                  <button
                    type="button"
                    className={`overview-node tone-${visual.tone}`}
                    onClick={() => selectNode(node.id)}
                  >
                    <span className="overview-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="overview-icon">
                      <Icon size={15} />
                    </span>
                    <span className="overview-copy">
                      <strong>{node.data.label}</strong>
                      <small>{nodeTypeLabels[kind]}</small>
                    </span>
                    {status && status !== "idle" ? <i className={`overview-dot is-${status}`} /> : <ChevronRight size={14} />}
                  </button>
                </div>
              );
            })}
          </div>
          {nodes.length === 0 ? <p className="empty-hint">从左侧节点库添加第一个节点。</p> : null}
        </section>

        <section className="inspector-section">
          <div className="section-title">
            <span>
              <SlidersHorizontal size={15} />
              引擎能力
            </span>
          </div>
          <div className="capability-card">
            <span className="capability-icon tone-indigo">
              <Cpu size={16} />
            </span>
            <div>
              <strong>大模型节点</strong>
              <small>{llmConfigured ? `OpenAI 兼容 · ${llmModel}` : "本地口播整理模式"}</small>
            </div>
            <span className={llmConfigured ? "capability-badge is-on" : "capability-badge"}>
              {llmConfigured ? "已接入" : "免配置"}
            </span>
          </div>
          <div className="capability-card">
            <span className="capability-icon tone-coral">
              <AudioLines size={16} />
            </span>
            <div>
              <strong>超拟人音频合成</strong>
              <small>Edge Neural · {voices.length} 种中文音色</small>
            </div>
            <span className="capability-badge is-on">在线</span>
          </div>
        </section>

        <section className="inspector-section">
          <div className="section-title">
            <span>
              <Keyboard size={15} />
              操作提示
            </span>
          </div>
          <ul className="tip-list">
            <li>
              <span>01</span>选中节点后在这里调整模型、提示词与音色。
            </li>
            <li>
              <span>02</span>节点右侧圆点拖到下一个节点左侧即可连线。
            </li>
            <li>
              <span>03</span>打开调试抽屉输入文字，一路生成到音频。
            </li>
          </ul>
        </section>
      </aside>
    );
  }

  const kind = nodeKindOf(selectedNode.type);
  const visual = nodeVisuals[kind];
  const Icon = visual.icon;
  const disabled = running;
  const voiceOptions = voices.length > 0 ? voices : fallbackVoices;
  const temperature = typeof selectedNode.data.temperature === "number" ? selectedNode.data.temperature : 0.7;
  const ratePercent = typeof selectedNode.data.ratePercent === "number" ? selectedNode.data.ratePercent : 0;
  const pitchHz = typeof selectedNode.data.pitchHz === "number" ? selectedNode.data.pitchHz : 0;
  const selectedVoice = voiceOptions.find((voice) => voice.id === selectedNode.data.voice) ?? voiceOptions[0];
  const update = (patch: Partial<FlowNodeData>) => updateNodeData(selectedNode.id, patch);

  return (
    <aside className="inspector">
      <div className="inspector-node-head">
        <span className={`inspector-icon tone-${visual.tone}`}>
          <Icon size={20} />
        </span>
        <div>
          <p className="eyebrow">NODE SETTINGS</p>
          <h2>{nodeTypeLabels[kind]}</h2>
        </div>
        <button
          type="button"
          className="inspector-close"
          onClick={() => selectNode("")}
          aria-label="取消选中"
          title="返回工作流概览"
        >
          <ChevronRight size={17} />
        </button>
      </div>
      <p className="node-id">ID · {selectedNode.id}</p>
      <p className="inspector-description">{nodeTypeDescriptions[kind]}</p>

      <div className="inspector-section">
        <div className="section-title">
          <span>基础</span>
        </div>
        <label className="field">
          <span className="field-label">节点名称</span>
          <input
            type="text"
            value={selectedNode.data.label}
            maxLength={40}
            disabled={disabled}
            onChange={(event) => update({ label: event.target.value })}
          />
        </label>
      </div>

      {kind === "userInput" ? (
        <div className="inspector-section">
          <div className="mini-callout">
            <Info size={15} />
            <p>用户输入节点不需要固定文案。每次运行都会读取调试抽屉里的测试文字，并将其作为工作流起点。</p>
          </div>
          <div className="meta-grid">
            <div>
              <small>输入来源</small>
              <strong>调试抽屉</strong>
            </div>
            <div>
              <small>输出字段</small>
              <strong>text</strong>
            </div>
          </div>
        </div>
      ) : null}

      {kind === "llm" ? (
        <>
          <div className="inspector-section">
            <div className="section-title">
              <span>模型配置</span>
              <small>
                {llmConfigured ? "API 已配置" : "本地模式"}
              </small>
            </div>
            {!llmConfigured ? (
              <div className="mini-callout is-warm">
                <Info size={15} />
                <p>
                  尚未配置 LLM_API_KEY，节点会使用本地口播整理器，链路仍可完整生成音频。
                </p>
              </div>
            ) : null}
            <label className="field">
              <span className="field-label">模型名称</span>
              <input
                type="text"
                list="llm-model-presets"
                value={selectedNode.data.model ?? ""}
                disabled={disabled}
                placeholder="gpt-4o-mini"
                onChange={(event) => update({ model: event.target.value })}
              />
              <datalist id="llm-model-presets">
                {modelPresets.map((model) => (
                  <option value={model} key={model} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <div className="field-label-row">
                <span className="field-label">温度</span>
                <span className="value-badge">{temperature.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.1}
                value={temperature}
                disabled={disabled}
                style={rangeStyle(temperature, 0, 1.5)}
                onChange={(event) => update({ temperature: Number(event.target.value) })}
              />
              <div className="range-scale">
                <span>更稳定</span>
                <span>更发散</span>
              </div>
            </label>
          </div>

          <div className="inspector-section">
            <div className="section-title">
              <span>播客编剧提示词</span>
              <button
                type="button"
                className="text-action"
                disabled={disabled}
                onClick={() => update({ systemPrompt: defaultSystemPrompt })}
              >
                <RotateCcw size={12} />
                恢复默认
              </button>
            </div>
            <label className="field">
              <textarea
                rows={9}
                maxLength={4000}
                value={selectedNode.data.systemPrompt ?? ""}
                disabled={disabled}
                onChange={(event) => update({ systemPrompt: event.target.value })}
              />
              <span className="field-counter">{selectedNode.data.systemPrompt?.length ?? 0} / 4000</span>
            </label>
          </div>
        </>
      ) : null}

      {kind === "tts" ? (
        <>
          <div className="inspector-section">
            <div className="section-title">
              <span>音色</span>
              <small>EDGE NEURAL</small>
            </div>
            <label className="field">
              <span className="field-label">中文音色</span>
              <select
                value={selectedVoice?.id ?? ""}
                disabled={disabled}
                onChange={(event) => update({ voice: event.target.value })}
              >
                {voiceOptions.map((voice) => (
                  <option value={voice.id} key={voice.id}>
                    {voice.name} · {voice.gender} · {voice.tone}
                  </option>
                ))}
              </select>
            </label>
            {selectedVoice ? (
              <div className={`voice-card tone-${visual.tone}`}>
                <span className="voice-avatar">{selectedVoice.name.slice(0, 1)}</span>
                <div>
                  <strong>{selectedVoice.name}</strong>
                  <small>
                    {selectedVoice.gender} · {selectedVoice.tone}
                  </small>
                </div>
                <Volume2 size={17} />
              </div>
            ) : null}
          </div>

          <div className="inspector-section">
            <div className="section-title">
              <span>声音细节</span>
            </div>
            <label className="field">
              <div className="field-label-row">
                <span className="field-label">语速</span>
                <span className="value-badge">{formatRate(ratePercent)}</span>
              </div>
              <input
                type="range"
                min={-30}
                max={30}
                step={5}
                value={ratePercent}
                disabled={disabled}
                style={rangeStyle(ratePercent, -30, 30)}
                onChange={(event) => update({ ratePercent: Number(event.target.value) })}
              />
              <div className="range-scale">
                <span>舒缓</span>
                <span>明快</span>
              </div>
            </label>
            <label className="field">
              <div className="field-label-row">
                <span className="field-label">音调</span>
                <span className="value-badge">{formatPitch(pitchHz)}</span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                step={5}
                value={pitchHz}
                disabled={disabled}
                style={rangeStyle(pitchHz, -50, 50)}
                onChange={(event) => update({ pitchHz: Number(event.target.value) })}
              />
              <div className="range-scale">
                <span>低沉</span>
                <span>明亮</span>
              </div>
            </label>
            <div className="mini-callout">
              <AudioLines size={15} />
              <p>音频由在线神经语音合成，首次生成会经过一段简短网络请求。</p>
            </div>
          </div>
        </>
      ) : null}

      {kind === "end" ? (
        <div className="inspector-section">
          <div className="mini-callout">
            <Info size={15} />
            <p>结束节点汇总主链路上的口播稿与最新一段音频，最终结果会直接进入调试抽屉的播放器。</p>
          </div>
          <div className="meta-grid">
            <div>
              <small>最终输出</small>
              <strong>音频 + 文本</strong>
            </div>
            <div>
              <small>播放位置</small>
              <strong>调试抽屉</strong>
            </div>
          </div>
        </div>
      ) : null}

      <div className="inspector-footer">
        {kind === "userInput" || kind === "end" ? (
          <span className="locked-note">
            <Lock size={13} />
            边界节点不可删除
          </span>
        ) : (
          <button
            type="button"
            className="danger-action"
            disabled={disabled}
            onClick={() => {
              if (window.confirm(`从画布中删除「${selectedNode.data.label}」节点？`)) {
                removeNode(selectedNode.id);
              }
            }}
          >
            <Trash2 size={14} />
            删除这个节点
          </button>
        )}
        <span className="inspector-arrow">
          <ArrowRight size={13} />
          连线定义执行顺序
        </span>
      </div>
    </aside>
  );
}
