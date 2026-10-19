import { useEffect, useRef, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  LoaderCircle,
  Play,
  Sparkles,
  Square,
  WandSparkles,
  X,
} from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
import { nodeVisuals } from "./node-meta";
import { useStudio } from "../studio-context";
import type { RunPhase, RunStep } from "../types";
import { formatDuration, nodeTypeLabels, previewText, providerLabel, sampleInputs } from "../workflow";

function phaseLabel(phase: RunPhase): string {
  if (phase === "running") return "执行中";
  if (phase === "success") return "已完成";
  if (phase === "error") return "执行失败";
  return "待运行";
}

function StepIcon({ step }: { step: RunStep }) {
  if (step.status === "running") return <LoaderCircle className="spin" size={13} />;
  if (step.status === "error") return <AlertTriangle size={13} />;
  return <Check size={13} />;
}

export function DebugDrawer() {
  const {
    workflowName,
    nodes,
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
    finishedNodeCount,
    llmConfigured,
    runWorkflow,
    stopRun,
  } = useStudio();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const traceEndRef = useRef<HTMLDivElement>(null);
  const characterCount = debugInput.trim().length;
  const progress = nodes.length > 0 ? Math.min(100, (finishedNodeCount / nodes.length) * 100) : 0;

  useEffect(() => {
    if (!debugOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 240);
    return () => window.clearTimeout(timer);
  }, [debugOpen]);

  useEffect(() => {
    if (!debugOpen) return;
    traceEndRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [debugOpen, steps.length]);

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (!running) void runWorkflow();
    }
  }

  return (
    <section
      className={debugOpen ? "debug-drawer is-open" : "debug-drawer"}
      aria-label="工作流调试抽屉"
      aria-hidden={!debugOpen}
      inert={!debugOpen}
    >
      <div className="debug-head">
        <div className="debug-head-left">
          <span className={running ? "debug-orbit is-running" : "debug-orbit"}>
            <Play size={16} fill="currentColor" />
          </span>
          <div>
            <div className="debug-title-row">
              <h2>调试抽屉</h2>
              <span className={`run-phase is-${runPhase}`}>
                <i />
                {phaseLabel(runPhase)}
              </span>
            </div>
            <p>输入一段文字，沿画布链路生成口播稿与可播放的 AI 播客。</p>
          </div>
        </div>
        <div className="debug-head-right">
          {running ? (
            <div className="debug-progress">
              <span>
                已完成 {finishedNodeCount}/{nodes.length}
              </span>
              <div>
                <i style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className="button button-icon button-quiet debug-close"
            onClick={() => setDebugOpen(false)}
            aria-label="收起调试抽屉"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="debug-grid">
        <form
          className="debug-form"
          onSubmit={(event) => {
            event.preventDefault();
            void runWorkflow();
          }}
        >
          <div className="debug-field-head">
            <label className="field-label" htmlFor="debug-input">
              测试输入
            </label>
            <span className={llmConfigured ? "mode-tag is-live" : "mode-tag"}>
              {llmConfigured ? "LIVE MODEL" : "LOCAL SCRIPT"}
            </span>
          </div>
          <div className="debug-textarea-wrap">
            <textarea
              ref={inputRef}
              id="debug-input"
              rows={6}
              maxLength={4000}
              value={debugInput}
              disabled={running}
              placeholder="输入一个主题，或粘贴一段还没整理的口播草稿…"
              onChange={(event) => setDebugInput(event.target.value)}
              onKeyDown={onInputKeyDown}
            />
            <span className="debug-char-count">{characterCount} 字</span>
          </div>

          <div className="sample-row">
            {sampleInputs.map((sample) => (
              <button
                key={sample.label}
                type="button"
                className={sample.value === debugInput ? "sample-chip is-active" : "sample-chip"}
                disabled={running}
                onClick={() => setDebugInput(sample.value)}
              >
                <Sparkles size={12} />
                {sample.label}
              </button>
            ))}
          </div>

          <div className="debug-form-note">
            <span>
              <WandSparkles size={14} />
              从调试文字开始，依次执行主链路上的每个节点。
            </span>
            <kbd>Ctrl + Enter</kbd>
          </div>

          <div className="debug-actions">
            <button
              type="submit"
              className="button button-primary run-button"
              disabled={running || characterCount === 0}
            >
              {running ? <LoaderCircle className="spin" size={17} /> : <Play size={16} fill="currentColor" />}
              {running ? "正在生成播客" : "运行工作流"}
            </button>
            {running ? (
              <button type="button" className="button button-quiet stop-button" onClick={stopRun}>
                <Square size={13} fill="currentColor" />
                停止
              </button>
            ) : null}
          </div>
        </form>

        <div className="debug-result">
          <div className="debug-result-head">
            <span className="field-label">生成结果</span>
            {finalOutput?.detail ? <span className="result-voice">{finalOutput.detail}</span> : null}
          </div>

          <AudioPlayer
            src={finalOutput?.audioUrl ?? null}
            detail={finalOutput?.detail ?? null}
            title={workflowName || "AI 播客 · 本期节目"}
            busy={running}
          />

          {workflowError ? (
            <p className="debug-banner is-error" role="alert">
              <AlertTriangle size={14} />
              {workflowError}
            </p>
          ) : null}
          {finalOutput?.warning ? (
            <p className="debug-banner is-warning">
              <AlertTriangle size={14} />
              {finalOutput.warning}
            </p>
          ) : null}

          {finalOutput?.text ? (
            <details className="transcript">
              <summary>
                <span>
                  <Sparkles size={13} />
                  查看完整口播稿
                </span>
                <ChevronDown size={14} />
              </summary>
              <p>{finalOutput.text}</p>
            </details>
          ) : null}

          <div className="trace-head">
            <span className="field-label">执行轨迹</span>
            <span>
              {steps.length > 0 ? `${steps.length} 个节点` : "等待运行"}
              {runDurationMs !== null ? ` · ${formatDuration(runDurationMs)}` : ""}
            </span>
          </div>

          <div className="trace-scroll">
            {steps.length === 0 ? (
              <div className="trace-empty">
                <span className="trace-empty-line" />
                <p>{running ? "工作流已经开始执行…" : "运行后，这里会实时展示每个节点的状态和输出。"}</p>
              </div>
            ) : (
              <ol className="trace-list" aria-live="polite">
                {steps.map((step, index) => {
                  const kind = step.nodeType as keyof typeof nodeVisuals;
                  const visual = nodeVisuals[kind] ?? nodeVisuals.llm;
                  const Icon = visual.icon;
                  return (
                    <li className={`trace-item is-${step.status}`} key={`${step.nodeId}-${index}`}>
                      <span className={`trace-node-icon tone-${visual.tone}`}>
                        <Icon size={14} />
                      </span>
                      <div className="trace-body">
                        <div className="trace-title-row">
                          <strong>{step.label || nodeTypeLabels[kind] || step.nodeType}</strong>
                          <span className={`trace-state is-${step.status}`}>
                            <StepIcon step={step} />
                            {step.status === "running"
                              ? "运行中"
                              : step.status === "error"
                                ? "失败"
                                : formatDuration(step.durationMs)}
                          </span>
                        </div>
                        {step.detail ? <small>{step.detail}</small> : null}
                        {step.status === "error" && step.message ? (
                          <p className="trace-error">{step.message}</p>
                        ) : step.status === "success" && step.text ? (
                          <p>{previewText(step.text, 76)}</p>
                        ) : step.status === "running" ? (
                          <p className="trace-pending">正在处理…</p>
                        ) : null}
                        {step.provider ? <span className="trace-provider">{providerLabel(step.provider)}</span> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <div ref={traceEndRef} />
          </div>
        </div>
      </div>
    </section>
  );
}
