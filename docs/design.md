# PaiAgent Studio 设计文档

| 项目 | 内容 |
| --- | --- |
| 产品 | PaiAgent Studio · AI 播客工作流 |
| 版本 | 1.0 |
| 状态 | 已实现并通过端到端验证 |
| 更新日期 | 2026-10-19 |

## 1. 背景与目标

用户需要一个可本地运行的 Agent 流图执行面板：在画布上编排「用户输入 → 大模型 → 超拟人音频合成 → 结束」，在调试抽屉输入文字并运行，最终获得可直接播放的 AI 播客音频。

设计目标：

1. **完整闭环**：从节点编排、保存、运行、流式反馈到音频播放/下载，不依赖额外平台。
2. **零配置可体验**：没有大模型密钥时仍能生成口播稿与音频。
3. **真实执行而非演示**：工作流经后端 DAG 校验并按拓扑顺序执行，音频为真实合成的 MP3。
4. **可解释的失败**：非法图结构、模型配置错误、语音服务失败都返回明确的中文提示。
5. **安全的本地工具**：模型地址与密钥只存在后端，前端不能指定任意目标地址。

非目标（当前版本）：

- 多租户、登录与权限体系。
- 多份工作流的版本管理与发布流程。
- 并行分支汇聚的策略配置（引擎支持多上游，但播客主链路按单链使用）。
- 逐 token 的大模型流式输出。

## 2. 总体架构

```text
┌──────────────────────────── Browser (127.0.0.1:5180) ───────────────────────────┐
│  React 19 + TypeScript + React Flow                                             │
│  Studio 状态中心                                                                 │
│  ├─ TopBar / Sidebar / NodeInspector                                            │
│  ├─ FlowCanvas（节点、连线、运行状态）                                            │
│  └─ DebugDrawer（输入、执行轨迹、AudioPlayer）                                   │
└───────────────────────────────┬─────────────────────────────────────────────────┘
                                │ /api（开发环境 Vite 代理）
┌───────────────────────────────▼─────────────────────────────────────────────────┐
│  FastAPI (127.0.0.1:8010)                                                       │
│  ├─ /api/studio · /api/voices · /api/workflows/* · /api/audio/*                  │
│  ├─ DAG 引擎：校验 → 稳定拓扑排序 → 顺序执行 → NDJSON 事件流                       │
│  ├─ 节点实现：userInput / llm / tts / end                                       │
│  ├─ 存储：SQLite 工作流文档 + 本地音频文件                                       │
│  └─ 外部依赖：OpenAI 兼容 LLM API（可选）、Edge Neural TTS（在线）               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

设计原则：

- **后端为执行权威**：前端提交图结构，后端独立校验，不能依赖前端约束保证正确性。
- **执行与表现解耦**：节点处理器只产出标准 `NodeResult`；画布状态与轨迹是事件的应用结果。
- **单向数据流**：前端以 `Studio` 为唯一状态所有者，通过 context 向展示组件下发能力。
- **渐进增强**：外部 LLM 是可选增强，本地整理器保证离线演示路径；TTS 必须联网。

## 3. 核心流程

### 3.1 编辑与保存

```text
用户操作画布 / 检查器
  → Studio 更新 nodes / edges / workflowName
  → documentSignature 变化，标记 dirty
  → 点击保存或 Ctrl/Cmd+S
  → PUT /api/workflows/current
  → SQLite UPSERT 当前工作流
  → 返回 savedAt，前端清除 dirty
```

- 用户输入（边界节点）与结束节点不可删除；同类边界节点只能存在一个。
- 连线在客户端先做基础检查（端点、自连、重复、环路），后端仍会完整校验。
- 运行状态不写入节点文档；提交和保存前会剥离 `status` 等运行时字段。
- 添加节点时，优先在当前可视画布的空白区域寻找位置，避开已有节点与画布控件。

### 3.2 运行主链路

```text
点击「运行工作流」
  → POST /api/workflows/run（图 + userInput）
  → prepare_workflow：结构校验
  → workflow_started
  → 对每个节点：node_started → 执行 → node_finished / node_failed
  → workflow_finished（汇总文本、音频、耗时、警告）
```

- 响应协议为 `application/x-ndjson`，每行一个 JSON 事件。
- 前端使用 `ReadableStream` 增量解析，按换行切分缓冲，保证长事件不会被拆坏。
- 中途失败立即停止后续节点；已完成节点的结果保留在轨迹中。
- 用户点击停止会中止 `fetch`；服务端收到取消后停止等待。已开始的外部 TTS 请求可能仍完成，但结果不再返回给前端。

## 4. 工作流模型与引擎

### 4.1 数据结构

```text
WorkflowDocument
├─ name: string
├─ nodes: GraphNode[]
│  ├─ id: string
│  ├─ type: userInput | llm | tts | end
│  ├─ data: 节点配置（label / model / prompt / voice ...）
│  └─ position: { x, y }（仅用于画布还原）
└─ edges: GraphEdge[]
   ├─ id: string
   ├─ source: string
   └─ target: string
```

规模限制：节点最多 60 个、连线最多 120 条、节点/连线 ID 最长 80 字符、工作流名称最长 80 字符、调试输入最长 4000 字符。

### 4.2 校验顺序

`prepare_workflow()` 按以下顺序失败并返回可读错误：

1. 画布非空；调试输入非空。
2. 节点 ID 不重复；节点类型受支持。
3. 有且仅有一个 `userInput` 和一个 `end`。
4. 连线引用的节点存在；禁止自连；重复连线忽略。
5. 用户输入不能有入边；结束节点不能有出边。
6. 所有节点从输入可达，且都能到达结束节点（排除孤立节点与旁路节点）。
7. 拓扑排序能覆盖全部节点（排除环路）。

代码位置：[`backend/app/engine/graph.py`](../backend/app/engine/graph.py)

### 4.3 稳定拓扑排序

- 先统计入度，使用最小堆选择下一个可执行节点。
- 排序键为 `(优先级, 节点在原数组中的顺序, 节点 ID)`；`userInput` 优先，其余节点保持用户定义顺序。
- 相同的图结构会得到确定的执行顺序，便于调试与复现。
- 支持一个节点有多个上游：执行前按入边顺序收集上游结果。
- 结束节点取最近一个非空文本和最近一个音频作为最终输出。

### 4.4 执行语义

每个节点统一签名为：

```python
async def execute(node, upstream: list[NodeResult], user_text: str) -> NodeResult
```

- 结构化错误使用 `WorkflowError`，转换为 `node_failed` 事件。
- 未预期异常记录后端日志，对外只返回通用错误，避免泄漏堆栈。
- `CancelledError` 不吞掉，交给 ASGI 层处理。
- `workflow_failed` 用于图结构校验失败；`node_failed` 用于单个节点失败。

代码位置：[`backend/app/engine/executor.py`](../backend/app/engine/executor.py)

## 5. 节点设计

| 类型 | 输入 | 主要配置 | 输出 | Provider |
| --- | --- | --- | --- | --- |
| `userInput` | 调试抽屉文字 | 无 | `text` | `user` |
| `llm` | 上游文本或用户输入 | `model`、`temperature`、`systemPrompt` | 口播稿 `text` | `local` / `llm` |
| `tts` | 上游口播稿 | `voice`、`ratePercent`、`pitchHz` | MP3 `audioUrl` + `text` | `edge-neural` |
| `end` | 所有上游结果 | 无 | 汇总文本、音频和音色说明 | `end` |

### 5.1 用户输入

- 不保存固定文案，每次运行读取 `RunRequest.userInput`。
- 空字符串在引擎入口即被拒绝。

### 5.2 大模型节点

- 配置来源：环境变量提供默认 Base URL、密钥、模型；节点可覆盖模型名称。
- 请求 OpenAI 兼容的 `POST /chat/completions`，`max_tokens=1200`，超时 90 秒，连接超时 10 秒。
- 系统提示词限制为中文播客编剧，目标 220–360 个汉字，无 Markdown/表情/分点。
- 输出会清理 Markdown 标记、列表符号和 emoji，并截断到 2400 字以内。
- 未配置密钥时使用本地整理器：短输入扩写为完整口播，长输入保留原文并补开场/结尾。
- 错误映射：401/403 → 密钥无效；超时 → 稍后重试；连接失败 → 检查地址；其他 HTTP 错误 → 状态码提示。

代码位置：[`backend/app/nodes/llm.py`](../backend/app/nodes/llm.py)

### 5.3 超拟人音频合成节点

- 使用 `edge-tts` 调用 Edge Neural 中文语音，输出 MP3。
- 提供 8 种中文音色；语速限制 -30%～+30%，音调限制 -50～+50 Hz。
- 文本上限 3000 字，超限直接报错，避免长时间合成和资源占用。
- 每次生成使用随机 UUID 文件名，写入 `backend/data/audio`；失败会删除残留文件。
- 最多尝试 2 次，两次之间等待 0.6 秒；两次均失败返回可读错误。
- 成功后返回 `/api/audio/{uuid}.mp3` 与音色描述（如「晓晓 · 温暖自然」）。

代码位置：[`backend/app/nodes/hyper_tts.py`](../backend/app/nodes/hyper_tts.py)

### 5.4 结束节点

- 要求至少一个上游。
- 文本和音频均取最近的非空上游结果。
- 音色说明优先继承带音频的上游，供播放器展示。
- 如果没有音频，引擎在 `workflow_finished` 中附带警告，前端以黄色横幅提示。

## 6. API 设计

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康状态、模型配置状态、TTS provider |
| `GET` | `/api/studio` | 音色、模型配置、当前保存的工作流 |
| `GET` | `/api/voices` | 中文音色清单 |
| `GET` | `/api/workflows/current` | 读取当前工作流；未保存返回 404 |
| `PUT` | `/api/workflows/current` | 保存工作流，返回 `savedAt` |
| `POST` | `/api/workflows/run` | 运行工作流，返回 NDJSON |
| `GET` | `/api/audio/{32位hex}.mp3` | 获取音频，支持 Range 请求 |
| `GET` | `/docs` | Swagger API 文档 |

### 6.1 运行事件协议

```jsonc
{"event":"workflow_started","runId":"...","workflowName":"AI 播客生成工作流","nodeCount":4}
{"event":"node_started","runId":"...","nodeId":"node-llm","nodeType":"llm","label":"大模型"}
{"event":"node_finished","runId":"...","nodeId":"node-llm","nodeType":"llm","label":"大模型",
 "durationMs":12,"output":{"text":"...","audioUrl":null,"provider":"local","detail":"..."}}
{"event":"workflow_finished","runId":"...","durationMs":16063,
 "output":{"text":"...","audioUrl":"/api/audio/xxx.mp3","provider":"end","detail":"晓晓 · 温暖自然"},
 "warning":null}
```

失败事件：

```jsonc
{"event":"node_failed","runId":"...","nodeId":"...","nodeType":"tts","label":"超拟人音频合成","message":"..."}
{"event":"workflow_failed","runId":"...","message":"节点「大模型」未接入「用户输入 → 结束」主链路，请检查连线"}
```

### 6.2 错误约定

- 请求体校验失败统一返回 422 与中文 `message`，不暴露 Pydantic 内部结构。
- 音频路径使用严格正则，且校验解析后的父目录，防止路径穿越。
- 运行响应的 `Cache-Control: no-cache, no-transform` 与 `X-Accel-Buffering: no` 用于避免代理缓冲流式事件。

## 7. 前端设计

### 7.1 组件结构

```text
App
└─ ReactFlowProvider
   └─ Studio（状态与业务动作）
      ├─ TopBar（名称、保存状态、保存/重置、调试开关）
      ├─ Sidebar（节点库、引擎状态）
      ├─ stage
      │  ├─ FlowCanvas（React Flow、节点、迷你提示、画布计数）
      │  └─ DebugDrawer（输入、示例、运行/停止、结果、轨迹）
      ├─ NodeInspector（概览或选中节点配置）
      └─ Toast
```

- `Studio.tsx`：节点/连线状态、运行状态机、持久化、快捷键、增删节点和连线。
- `studio-context.tsx`：集中暴露状态与命令，避免多层 props 传递。
- `workflow.ts`：默认图、节点工厂、文档序列化、签名、恢复校验和展示格式化。
- `api.ts`：请求封装与 NDJSON 解析。
- `components/nodes.tsx`：四类自定义画布卡片及运行状态。
- `components/AudioPlayer.tsx`：音频元数据、播放/暂停、进度、下载与错误提示。

### 7.2 状态模型

```text
nodes, edges, workflowName          编辑态文档
nodeStatuses                        画布运行态（idle/running/success/error）
runPhase                            idle/running/success/error
steps                              执行轨迹
finalOutput                         最终文本/音频/音色/警告
savedSignature, savedAt, saving    保存态
engineOnline, status                引擎与配置状态
```

- `nodeStatuses` 与节点数据分离，避免运行态污染保存文档。
- 画布节点由 `nodes + nodeStatuses` 派生；连线颜色由两端状态派生。
- 运行中禁用节点拖拽、连线、删除与再次运行，但保留停止能力。
- 运行结果会自动滚动到底部轨迹；用户可手动向上查看历史步骤。

### 7.3 布局与交互

- 桌面三栏：264px 节点库 / 自适应画布 / 322px 检查器；顶栏 68px。
- 调试抽屉为画布底部浮层，打开时画布可视区域自动缩短，`fitView` 在可见区域内布局，避免节点被抽屉遮挡。
- 抽屉关闭后画布扩展；再次打开时节点仍在可视区域（初始布局已避开抽屉）。
- 新增节点优先放入当前可视区域第一个不冲突的槽位，避免与已有节点重叠。
- 采样输入一键填入；`Ctrl/Cmd + Enter` 运行；`Ctrl/Cmd + S` 保存。
- 调试输入保存到 `localStorage`，刷新后保留。
- 支持 1380 / 1180 / 940 宽度与 780 高度断点；窄屏隐藏检查器与节点库。
- 遵循 `prefers-reduced-motion`，在系统减少动画时关闭过渡。

## 8. 数据与存储

### 8.1 SQLite

```sql
CREATE TABLE workflows (
    id TEXT PRIMARY KEY,          -- 固定为 studio-current
    name TEXT NOT NULL,
    document TEXT NOT NULL,       -- JSON 文档
    updated_at TEXT NOT NULL      -- UTC ISO-8601
);
```

- 单工作流模式，使用 UPSERT 覆盖当前文档。
- 每次保存返回 UTC 时间，前端按本地时间展示。
- 数据库位置：`backend/data/studio.db`，首次启动自动创建。

### 8.2 文件与浏览器存储

| 数据 | 位置 | 生命周期 |
| --- | --- | --- |
| 工作流 | `backend/data/studio.db` | 持久 |
| 音频 | `backend/data/audio/*.mp3` | 启动时清理超过 24 小时的文件 |
| 调试草稿 | `localStorage["paiagent2.debug-input"]` | 浏览器本地持久 |
| 大模型密钥 | `backend/.env` | 持久，已加入 `.gitignore` |

## 9. 配置与安全

- `backend/.env` 每次运行前重新加载，修改密钥无需重启。
- 前端提交的节点数据仅包含模型名、提示词、音色等配置；**Base URL 和 API Key 不接受前端传入**，从根源避免利用工作流做任意地址请求。
- CORS 默认允许 5180、5173 的 localhost/127.0.0.1 来源，可通过启动前设置的环境变量 `FRONTEND_ORIGINS` 扩展。
- 音频文件名必须匹配 `[0-9a-f]{32}\.mp3`，并检查解析后的父目录。
- 用户文本、提示词、模型输出均受长度限制；前端 React 默认转义文本，不使用 `dangerouslySetInnerHTML`。
- 本地模式不调用大模型，但语音合成仍会把口播稿发送到 Edge TTS 在线服务；配置大模型后，文本还会发送到对应的模型服务商，需由使用者自行评估。

## 10. 非功能设计

- **性能**：主要耗时来自在线 TTS，实测约 6–16 秒生成 60 秒左右音频；LLM 本地模式近乎即时。NDJSON 让用户立即看到阶段进度。
- **可靠性**：TTS 失败重试 2 次；LLM 有超时和 HTTP 错误映射；中断运行会通知前端；保存失败保留 dirty 状态。
- **可观测性**：后端记录未预期节点异常；前端轨迹展示每个节点耗时、provider、文本预览和错误。
- **可访问性**：关键图标按钮有 `aria-label`/`title`；播放器有进度滑杆；运行状态有文本，不只依赖颜色；支持减少动画。

## 11. 测试与验收

### 自动化

```text
后端：python -m unittest discover -s tests
      12 项通过（图校验、排序、重复边、空输入、不支持类型、文本清理、本地稿本、数值裁剪）
前端：npm run typecheck
      npm run build
```

### 端到端验收（无头 Chrome，1512×982）

| 场景 | 结果 |
| --- | --- |
| 默认工作流加载 | 4 节点、3 连线，抽屉打开且节点不被遮挡 |
| 选中 LLM 节点 | 检查器显示模型、温度、系统提示词 |
| 完整运行 | 4 个节点成功，生成约 64 秒、384 KB MP3 |
| 音频访问与播放 | HTTP 200/206，元数据加载，播放进度前进 |
| 保存与刷新 | 后端返回 `savedAt`，刷新后节点/名称/保存态恢复 |
| 新增孤立节点后运行 | 返回「未接入主链路」错误，轨迹不继续执行 |
| 删除节点 | 画布数量恢复，检查器回到概览 |
| 抽屉关闭/重开 | 画布高度扩展/收缩，节点始终可见 |
| 控制台 | 无 error，无失败请求 |

生产构建由 FastAPI 托管时，`http://127.0.0.1:8010` 同样可以加载完整画布并连接 API。

## 12. 部署与运行

开发模式：

```text
backend:  uvicorn app.main:app --host 127.0.0.1 --port 8010
frontend: npm run dev（127.0.0.1:5180，/api 代理到 8010）
```

生产模式：

```text
cd frontend && npm run build
启动后端后，FastAPI 自动挂载 frontend/dist
访问 http://127.0.0.1:8010
```

端口选择 5180 / 8010，避免与本机已有的 5173 / 8000 服务冲突。

## 13. 已知限制与后续方向

1. 仅支持一份当前工作流；后续可增加多工作流列表、版本与发布状态。
2. 大模型输出为整段返回，不是 token 级流式；后续可增加 SSE 的 token 事件。
3. 客户端中止后，服务端已发出的 TTS 请求无法真正撤销；可引入带取消的后台任务。
4. 音频清理仅在启动时执行；长时间运行时建议增加定时任务。
5. 无用户体系与权限控制，适合本地工具或内网演示。
6. Edge TTS 依赖外网，若需要离线合成可替换为本地 TTS 提供方。
7. 当前主链路按单链设计；分叉/汇聚虽能执行，但缺少显式的数据合并策略配置。

## 14. 关键文件索引

| 关注点 | 文件 |
| --- | --- |
| DAG 校验与排序 | [`backend/app/engine/graph.py`](../backend/app/engine/graph.py) |
| 执行器与事件流 | [`backend/app/engine/executor.py`](../backend/app/engine/executor.py) |
| LLM 节点 | [`backend/app/nodes/llm.py`](../backend/app/nodes/llm.py) |
| TTS 节点 | [`backend/app/nodes/hyper_tts.py`](../backend/app/nodes/hyper_tts.py) |
| API 与静态服务 | [`backend/app/main.py`](../backend/app/main.py) |
| 数据模型 | [`backend/app/schemas.py`](../backend/app/schemas.py) |
| 持久化 | [`backend/app/store.py`](../backend/app/store.py) |
| 前端状态 | [`frontend/src/Studio.tsx`](../frontend/src/Studio.tsx) |
| 画布 | [`frontend/src/components/FlowCanvas.tsx`](../frontend/src/components/FlowCanvas.tsx) |
| 调试抽屉 | [`frontend/src/components/DebugDrawer.tsx`](../frontend/src/components/DebugDrawer.tsx) |
| 播放器 | [`frontend/src/components/AudioPlayer.tsx`](../frontend/src/components/AudioPlayer.tsx) |
| 视觉系统 | [`frontend/src/styles.css`](../frontend/src/styles.css) |
| 使用说明 | [`README.md`](../README.md) |
