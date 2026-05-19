---
name: lingji-mcp
description: 通过 MCP 协议调用「灵机剪影」桌面端的编辑器与 Pipeline 流水线工具。涵盖项目生命周期、脚本编辑、媒体导入、字幕分析、Async 任务编排（fire-and-poll）。当用户希望让外部 AI（Claude Code / Codex / Gemini）远程驱动灵机剪影完成一键创作流水线时使用。
version: 1.0.0
user-invocable: false
---

# 灵机剪影 MCP 使用指南

「灵机剪影」（lingjijianying）通过本机 MCP HTTP Server 暴露 16 个原子工具，外部 AI 可远程驱动桌面端从素材到 MP4 的完整创作流水线。

## 连接信息

| 项 | 值 |
|---|---|
| Server name | `lingji-editor` |
| Transport | Streamable HTTP (`@modelcontextprotocol/sdk/server/streamableHttp.js`) |
| URL | `http://127.0.0.1:19820/mcp` |
| 启动条件 | 灵机剪影桌面端正在运行（`npm run dev` 或 已安装的 .app） |
| 认证 | 无（仅监听 127.0.0.1） |

**Claude Code / Codex / Gemini CLI 注册示例（参考各端文档）：**

```jsonc
// Claude Code: ~/.claude/mcp.json 或 .claude/mcp.json
{
  "mcpServers": {
    "lingji-editor": {
      "transport": "http",
      "url": "http://127.0.0.1:19820/mcp"
    }
  }
}
```

## 必读：两类工具，两种调用模式

### 模式 A：同步工具（直接拿结果）

立即返回 `{ content: [{ text: '<json>' }] }`。失败时返回 `{ isError: true, content: [...] }`，payload 形如 `{ error: '<message>', code?: '<error_code>' }`。

### 模式 B：Async Pipeline 工具（fire-and-poll）

⚠️ **截至当前版本**，仅 **Pipeline 基础设施**（Plan A）落地。Async 业务工具（`tts` / `analyze_subtitles` / `generate_*` / `export_video` 等）将在 Plan B/C 上线。当前已可用的同步基础工具足以驱动「项目生命周期 + 脚本编辑 + 视频导入」核心流程。

**Async 调用范式（未来 Plan B/C 完成后通用）：**

```text
1. tool_call(...)            → { taskId: 'uuid' }
2. lingji_get_task_status({ taskId })  循环轮询，直到 status ∈ {succeeded, failed, canceled}
3. 读取 result（succeeded）/ error（failed）
```

轮询建议节奏：前 5s 每 500ms，之后每 2s。任务可通过 `lingji_cancel_task` 中止（仅对 cancelable kinds 生效）。

## 工具清单（16 个）

### 一、项目生命周期（同步，4 个）

| 工具 | 入参 | 返回 | 用途 |
|---|---|---|---|
| `lingji_create_project` | `path: string`（绝对路径）, `options?: { name?, meta? }` | `{ projectPath }` | 在指定路径创建空项目骨架（`project.json` / `original.md` / `covers/` / `ai-cards/` / `configs/prompts/`）。目标目录必须不存在或为空。 |
| `lingji_open_project` | `path: string` | `{ ok: true }` | 校验项目目录合法性，可选调用 |
| `lingji_get_project_state` | `projectPath: string` | `{ has_original, has_script, has_audio, has_subtitles, has_analysis, has_covers, has_cards, has_timeline, last_export }` | 推导项目当前阶段（断点续做的最佳依据） |
| `lingji_get_settings` | — | `{ defaultProvider, defaultModel, llmProviders, imageProviders, videoProviders, ttsDefaults, promptBindings, ... }` | 读 App Settings 默认值（已 sanitize，**不含** apiKey/secret/token/sessionId/password 等敏感字段） |

### 二、脚本编辑（同步，5 个）

| 工具 | 入参 | 返回 | 用途 |
|---|---|---|---|
| `lingji_get_editor_state` | — | 编辑器活动状态：当前 projectDir、打开的文件列表、活动文件 | 调任何脚本工具前先调它了解编辑器 |
| `lingji_read_script` | `filePath?: string`（默认当前文件，常用 `original.md` / `script.md`） | 文件内容 | 读取原始素材或成稿 |
| `lingji_write_script` | `templateCode: string`, `rawTextFilePath: string` | LLM 生成的脚本 | **不推荐**：使用内置 AI 模板生成。优先建议自己用 LLM 写完后调 `lingji_update_script` 写入 |
| `lingji_update_script` | `filePath?: string`, `content: string`, `description?: string` | `{ ok: true, ... }` | 写入脚本（这是写稿与改稿的核心工具）。若是活动项目，编辑器会即时高亮变更行 |
| `lingji_review_script` | `filePath?`, `summary?`, `score?: 0-100`, `annotations: Annotation[]` | `{ ok: true }` | 提交审稿批注，编辑器在对应位置显示卡片 |

`Annotation` 形态：

```ts
{
  // 二选一定位方式：推荐 quotedText（精确子串匹配）
  quotedText?: string,        // 原文精确子串，配合 suggestion 实现一键采纳
  line?: number,              // 起始行号（quotedText 未提供时必填）
  endLine?: number,           // 结束行号（默认与 line 相同）
  text: string,               // 问题描述
  suggestion?: string,        // 修改建议（替换 quotedText 或行区间的完整文本）
  severity?: 'info' | 'warning' | 'error'
}
```

### 三、项目上下文（同步，2 个）

| 工具 | 用途 |
|---|---|
| `lingji_list_project_files` | 列出当前脚本项目中的文件，`directory?: string` 可选子目录过滤 |
| `lingji_get_project_context` | 返回模板列表（含 systemPrompt）+ 当前选中模板 + 当前选中角色（含 rolePrompt）。**写稿前必调** |

### 四、媒体导入（含 Async 进度，2 个）

| 工具 | 入参 | 返回 | 用途 |
|---|---|---|---|
| `lingji_import_video_source` | `sourceType: 'douyin'\|'local_video'\|'local_audio'`, `url?` 或 `filePath?`, `projectDir`, `syncToOriginal?: bool=true` | 导入立即返回 import 句柄 | 导入抖音链接 / 本地音视频，自动转换、转录并同步为 `original.md` |
| `lingji_get_video_import_status` | `importId: string` | 进度 / 错误 / 最终结果 | 轮询导入进度。注意：本工具用的是 `importId`，**不是** PipelineTask 的 `taskId` |

### 五、Pipeline 任务管理（同步，3 个）

| 工具 | 入参 | 返回 | 用途 |
|---|---|---|---|
| `lingji_get_task_status` | `taskId: string` | 完整 PipelineTask 对象 | 轮询 Async 工具的执行进度 |
| `lingji_cancel_task` | `taskId: string` | `{ ok: true }` | 取消运行中任务；不可取消的 kind 返回 `not_cancelable` |
| `lingji_list_tasks` | `projectPath?: string` | `PipelineTask[]` | 列出在跑 + 24h 内已终态的任务，可按项目过滤 |

`PipelineTask` 结构：

```ts
{
  taskId: string,
  kind: 'tts' | 'write_script' | 'review_script' | 'analyze_subtitles' |
        'generate_covers' | 'generate_storyboard' | 'generate_cards' |
        'generate_motion' | 'export_video' | 'import_video_source',
  projectPath: string,
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled',
  progress: { phase: string, percent: number, message?: string },
  startedAt: number,
  finishedAt?: number,
  result?: unknown,        // 成功时按 kind 填入对应结果结构
  error?: { code: string, message: string, retryable: boolean },
  logs: string[]           // 最近 200 条
}
```

## 错误码

工具失败返回 `{ isError: true, content: [{ text: '{"error":"...", "code":"..."}' }] }`：

| Code | 含义 | 可重试？ |
|---|---|---|
| `project_not_found` | 项目目录不存在或不是目录 | 否（先检查路径） |
| `invalid_project` | 创建项目时 path 非绝对 / 目标非空 | 否（换 path） |
| `task_conflict` | 同项目已有同 kind 任务在跑 | 是（先 `list_tasks` 查到冲突任务并等其结束 / 取消） |
| `not_cancelable` | 该任务 kind 不支持取消 | 否 |
| `unknown_task` | taskId 不存在 | 否 |
| `internal` | 兜底 | 视情况 |

## 典型调用序列（一键创作骨架）

> ⚠️ 以下序列中标注 `🚧 Plan B/C` 的 Async 工具尚未上线。Plan A 完成后可用的步骤已标注 ✅。

```text
1.  ✅ lingji_create_project({ path: '/Users/me/Videos/podcast-001' })
2.  ✅ lingji_get_settings()                            # 拿默认 Provider / 模板
3.  ✅ lingji_get_project_context()                     # 拿模板列表与角色
4.  ✅ lingji_import_video_source({ sourceType: 'douyin', url, projectDir })
        → lingji_get_video_import_status({ importId }) 轮询直到完成
5.  ✅ lingji_read_script({ filePath: 'original.md' }) # 读原始素材
        → 自己用 LLM 按模板/角色写出口播稿
        → lingji_update_script({ filePath: 'script.md', content })
6.  ✅ lingji_review_script({ annotations: [...] })    # 可选：提交审稿批注
7.  🚧 lingji_generate_tts(...)                        # Plan C
8.  🚧 lingji_analyze_subtitles(...)                   # Plan C
9.  🚧 并行: generate_covers / generate_cards / generate_storyboard  # Plan C
10. 🚧 lingji_assemble_timeline(...)                   # Plan C，同步算法
11. 🚧 lingji_export_video(...) → 轮询 task_status     # Plan C
```

每步前调 `lingji_get_project_state` 可作为容错断点：

```text
state = lingji_get_project_state({ projectPath })
if (!state.has_script)   { 跳到 step 5 }
if (!state.has_audio)    { 跳到 step 7 }
if (!state.has_analysis) { 跳到 step 8 }
...
```

## 重要约束

1. **绝对路径优先**：`createProject` 必须绝对路径；多数工具的 `projectPath` / `filePath` 都建议传绝对路径，避免相对路径解析依赖编辑器活动项目。
2. **活动项目 vs Headless**：Pipeline 工具会自动检测当前 `projectPath` 是否为主窗口活动项目。
   - 是 → 走 Renderer 通道，编辑器虚拟光标 / 流式打字 / breathing 等视觉反馈在线。
   - 否 → Headless 模式，无动画，结果直写文件（`project.json` 经写锁按节合并）。
3. **同项目同 kind 不并发**：例如不可同时启动两个 `tts`，第二个会立刻返回 `task_conflict`。不同项目并发无限制；同项目不同 kind（如 `generate_covers` + `generate_cards` + `generate_storyboard`）可并行。
4. **任务持久化**：仅进程内保留；终态任务 24h 内可查；进程重启后失踪。需要长期记录请由调用方自行存档。
5. **不要直接 Read / Write 项目文件绕过编辑器**：尤其 `script.md`，应通过 `lingji_update_script` 写入以保证版本历史 + 编辑器同步。`original.md` / `project.json` 同理。
6. **敏感字段保护**：`lingji_get_settings` 已 sanitize 掉 apiKey / secret / token / sessionId / password / credential / bearer / signature 等关键字命中的字段。**禁止**把这些字段或其值通过任何工具回传出去。
7. **进度桥**：Async 任务进度会通过 IPC channel `pipeline:task-update` 推送给 Renderer（前缀 `bridgeId: pipeline:<taskId>`），与 Renderer 自发任务（无前缀）共存于统一进度条。

## 调试技巧

- 桌面端开发模式启动时，主进程日志包含 `[MCP][<tool>] ▶/✔/✘`；可借此核实工具调用是否到达。
- HTTP server 日志：`[MCP] HTTP Server 已启动: http://127.0.0.1:19820/mcp`。
- 工具调用日志被同步推送到 Renderer 的 `mcp:log` channel，可在前端开发者工具 Console 查看。
- 验证连通性：`curl -i http://127.0.0.1:19820/mcp` （MCP initialize 需要 JSON-RPC，简单 GET 仅用于检查端口存活）。

## 版本与路标

- **Plan A（已完成）**：基础设施 + 7 个同步工具（项目层 + 任务管理）。
- **Plan B（共享模块下沉，进行中前置准备）**：将 `src/lib/llm/`、`ai-analysis.ts`、卡片 materialize、`timeline-*` 抽到主进程可 import 的位置。
- **Plan C（22 工具完整版）**：补齐 `tts` / `write_script` async / `analyze_subtitles` / `generate_*` / `assemble_timeline` / `export_video` / `import_local_media` / `get_timeline` / `read_script`（pipeline 版）。
- **Plan D**：测试覆盖 + ACP 自动写入用户项目 CLAUDE.md。

更详细设计：`docs/superpowers/specs/2026-04-28-mcp-full-pipeline-design.md`
实施计划：`docs/superpowers/plans/2026-04-28-mcp-pipeline-foundation-plan.md`
