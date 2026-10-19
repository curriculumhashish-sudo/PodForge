import type { DragEvent } from "react";
import { CircleDashed, Plus, Radio } from "lucide-react";
import { nodeVisuals } from "./node-meta";
import { useStudio } from "../studio-context";
import type { NodeKind } from "../types";
import { paletteGroups } from "../workflow";

export function Sidebar() {
  const { addNode, nodes, running, engineOnline, llmConfigured } = useStudio();

  function onDragStart(event: DragEvent<HTMLButtonElement>, kind: NodeKind) {
    if (running) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("application/x-pai-node", kind);
    event.dataTransfer.effectAllowed = "copy";
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div>
          <p className="eyebrow eyebrow-light">BUILD</p>
          <h1>节点库</h1>
        </div>
        <span className="node-count">{String(nodes.length).padStart(2, "0")}</span>
      </div>
      <p className="sidebar-intro">添加能力节点，连接出一条从文字到声音的生产线。</p>

      <div className="palette-groups">
        {paletteGroups.map((group) => (
          <section className="palette-group" key={group.title}>
            <div className="palette-title-row">
              <h2>{group.title}</h2>
              <span>{group.hint}</span>
            </div>
            {group.items.map((item) => {
              const visual = nodeVisuals[item.type];
              const Icon = visual.icon;
              const exists = (item.type === "userInput" || item.type === "end") && nodes.some((node) => node.type === item.type);
              return (
                <button
                  key={item.type}
                  type="button"
                  className={`palette-item tone-${visual.tone}`}
                  draggable={!running}
                  disabled={running}
                  onDragStart={(event) => onDragStart(event, item.type)}
                  onClick={() => addNode(item.type)}
                >
                  <span className="palette-icon">
                    <Icon size={18} strokeWidth={1.9} />
                  </span>
                  <span className="palette-copy">
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  {exists ? <span className="palette-exists">已有</span> : <Plus className="palette-add" size={16} />}
                </button>
              );
            })}
          </section>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-tip">
          <CircleDashed size={16} />
          <p>
            <strong>拖拽或点击添加</strong>
            把节点拖入画布，再连接端口组成可执行链路。
          </p>
        </div>
        <div className="sidebar-status">
          <span className={engineOnline ? "status-dot is-online" : "status-dot"} />
          <div>
            <strong>{engineOnline ? "后台引擎已连接" : "后台引擎未连接"}</strong>
            <small>
              {llmConfigured ? "大模型已配置 · " : "本地整理模式 · "}
              Edge Neural
            </small>
          </div>
          <Radio size={15} className={engineOnline ? "signal is-online" : "signal"} />
        </div>
        <p className="sidebar-version">PAIAGENT / STUDIO 1.0</p>
      </div>
    </aside>
  );
}
