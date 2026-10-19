import {
  LoaderCircle,
  PanelBottomClose,
  PanelBottomOpen,
  RotateCcw,
  Save,
} from "lucide-react";
import { useStudio } from "../studio-context";
import { formatSavedTime } from "../workflow";

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="brand-gradient" x1="5" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff8158" />
          <stop offset="1" stopColor="#d94a25" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#brand-gradient)" />
      <path
        d="M9 23.5c2.3-7.2 4.3-7.2 6.4 0s3.7 7.2 5.8 0 3.7-7.2 5.8 0 2.6 4.5 4 1.5"
        fill="none"
        stroke="#fffaf5"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="20" cy="12" r="2.1" fill="#fffaf5" />
    </svg>
  );
}

export function TopBar() {
  const {
    workflowName,
    setWorkflowName,
    debugOpen,
    setDebugOpen,
    resetWorkflow,
    running,
    saving,
    dirty,
    savedAt,
    saveWorkflow,
    engineOnline,
  } = useStudio();

  const saveLabel = saving ? "保存中" : dirty ? "保存" : "已保存";
  const saveDetail = saving ? "正在同步" : dirty ? "有未保存更改" : savedAt ? `已保存 ${formatSavedTime(savedAt)}` : "尚未保存";

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <BrandMark />
        <div className="brand-copy">
          <strong>PaiAgent</strong>
          <span>AGENT STUDIO</span>
        </div>
      </div>

      <div className="topbar-project">
        <div className="project-eyebrow">
          <span>WORKFLOW</span>
          <span className={engineOnline ? "engine-state is-online" : "engine-state"}>
            <i />
            {engineOnline ? "DAG 引擎在线" : "引擎离线"}
          </span>
        </div>
        <div className="project-name-row">
          <input
            className="workflow-name-input"
            value={workflowName}
            maxLength={48}
            aria-label="工作流名称"
            spellCheck={false}
            onChange={(event) => setWorkflowName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
          <span className={dirty ? "save-state is-dirty" : "save-state"} title={saveDetail}>
            <i />
            {saveDetail}
          </span>
        </div>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="button button-quiet save-button"
          disabled={!dirty || saving || running}
          onClick={() => void saveWorkflow()}
          title="保存工作流 (Ctrl/⌘ + S)"
        >
          {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
          {saveLabel}
        </button>
        <button
          type="button"
          className="button button-icon button-quiet"
          disabled={running}
          onClick={resetWorkflow}
          title="重置为示例工作流"
          aria-label="重置工作流"
        >
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          className={debugOpen ? "button button-primary debug-toggle is-open" : "button button-primary debug-toggle"}
          onClick={() => setDebugOpen(!debugOpen)}
          aria-expanded={debugOpen}
        >
          {debugOpen ? <PanelBottomClose size={16} /> : <PanelBottomOpen size={16} />}
          {running ? "正在执行" : debugOpen ? "收起调试" : "打开调试"}
        </button>
      </div>
    </header>
  );
}
