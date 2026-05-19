import os from 'node:os';
import path from 'node:path';
import { AcpClient } from './client';
import { AgentConfig } from './config';
import { BinaryManager } from './binary-manager';
import { SessionManager } from './session';
import type { AcpEvent } from './types';

const CONFIG_PATH = path.join(os.homedir(), '.lingji', 'agent-config.json');
const DEFAULT_MODEL_ID = 'claude-code-default';
const DEFAULT_PROJECT_DIR = os.homedir();

export type HeadlessAcpProviderEvent =
  | { type: 'content_delta'; text: string }
  | { type: 'thinking'; text: string };

export interface HeadlessAcpProviderRequest {
  requestId: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  projectDir?: string | null;
  jsonMode?: boolean;
}

export interface HeadlessAcpProviderResult {
  text: string;
}

export interface HeadlessAcpProviderModel {
  modelId: string;
  name: string;
  description?: string;
}

interface Runtime {
  manager: SessionManager;
  chunks: string[];
  onEvent: (event: AcpEvent | Record<string, unknown>) => void;
  settle: {
    resolve: (result: HeadlessAcpProviderResult) => void;
    reject: (error: Error) => void;
  };
  done: boolean;
}

type EventSink = (requestId: string, event: HeadlessAcpProviderEvent) => void;

export class HeadlessAcpProvider {
  private readonly config: AgentConfig;
  private readonly binaryManager: BinaryManager;
  private readonly runtimes = new Map<string, Runtime>();
  private readonly eventSink: EventSink;

  constructor(options: {
    config?: AgentConfig;
    binaryManager?: BinaryManager;
    eventSink: EventSink;
  }) {
    this.config = options.config ?? new AgentConfig(CONFIG_PATH);
    this.binaryManager = options.binaryManager ?? new BinaryManager();
    this.eventSink = options.eventSink;
  }

  async runPrompt(input: HeadlessAcpProviderRequest): Promise<HeadlessAcpProviderResult> {
    if (!input.requestId.trim()) {
      throw new Error('缺少 ACP Provider 请求 ID');
    }
    if (this.runtimes.has(input.requestId)) {
      throw new Error(`ACP Provider 请求已存在：${input.requestId}`);
    }

    const configData = await this.config.load();
    const agentEntry = configData.agents['claude-acp'];
    if (agentEntry && agentEntry.enabled === false) {
      throw new Error('Claude Code ACP Agent 未启用，请先在 Claude Code 设置中启用');
    }

    const version = agentEntry?.version || '0.25.0';
    const { command, args } = this.binaryManager.getSpawnCommand(version);
    const env = await this.buildEnv(agentEntry);
    const projectDir = input.projectDir?.trim() || DEFAULT_PROJECT_DIR;
    const manager = new SessionManager(new AcpClient(), 'always_ask', {
      agentType: 'claude-code-acp-provider',
      clientCapabilities: {
        terminal: false,
        fs: { readTextFile: false, writeTextFile: false },
      },
      permissionRequestBehavior: 'reject',
    });

    let runtime: Runtime;
    const resultPromise = new Promise<HeadlessAcpProviderResult>((resolve, reject) => {
      runtime = {
        manager,
        chunks: [],
        onEvent: (event) => this.handleEvent(input.requestId, event, runtime),
        settle: { resolve, reject },
        done: false,
      };
      manager.on('event', runtime.onEvent);
      this.runtimes.set(input.requestId, runtime);
    });

    try {
      await manager.connect(projectDir, command, args, env);
      await this.applyModelIfSupported(manager, input.model);
      await manager.sendPrompt([{ type: 'text', text: formatPrompt(input.messages, input.jsonMode) }]);
      return await resultPromise;
    } catch (error) {
      this.finish(
        input.requestId,
        runtime!,
        normalizeProviderError(error),
      );
      return await resultPromise;
    }
  }

  async cancel(requestId: string): Promise<{ ok: true }> {
    const runtime = this.runtimes.get(requestId);
    if (!runtime) return { ok: true };
    try {
      await runtime.manager.cancelTurn();
    } finally {
      this.finish(requestId, runtime, new Error('Claude Code ACP Provider 请求已取消'));
    }
    return { ok: true };
  }

  listModels(): HeadlessAcpProviderModel[] {
    return [{ modelId: DEFAULT_MODEL_ID, name: DEFAULT_MODEL_ID }];
  }

  private async buildEnv(agentEntry: Awaited<ReturnType<AgentConfig['load']>>['agents'][string] | undefined) {
    const env: Record<string, string> = {};
    if (agentEntry?.authMode === 'custom_api') {
      const apiKey = await this.config.getApiKey('claude-acp');
      if (apiKey) env.ANTHROPIC_API_KEY = apiKey;
      if (agentEntry.apiBaseUrl) env.ANTHROPIC_BASE_URL = agentEntry.apiBaseUrl;
      if (agentEntry.model) env.ANTHROPIC_MODEL = agentEntry.model;
    }
    if (agentEntry?.envText) {
      for (const line of agentEntry.envText.split('\n')) {
        const eqIdx = line.indexOf('=');
        if (eqIdx > 0) {
          env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
        }
      }
    }
    return env;
  }

  private async applyModelIfSupported(manager: SessionManager, model: string): Promise<void> {
    const trimmed = model.trim();
    if (!trimmed || trimmed === DEFAULT_MODEL_ID || typeof manager.setModel !== 'function') {
      return;
    }
    try {
      await manager.setModel(trimmed);
    } catch {
      // 当前 claude-agent-acp 版本未必支持 session/set_model；保持 Claude Code 默认模型继续执行。
    }
  }

  private handleEvent(
    requestId: string,
    rawEvent: AcpEvent | Record<string, unknown>,
    runtime: Runtime,
  ): void {
    const event = rawEvent as Record<string, unknown>;
    const type = String(event.type ?? '');
    if (type === 'content_delta') {
      const text = String(event.text ?? '');
      if (text) {
        runtime.chunks.push(text);
        this.eventSink(requestId, { type: 'content_delta', text });
      }
      return;
    }
    if (type === 'thinking') {
      const text = String(event.text ?? '');
      if (text) {
        this.eventSink(requestId, { type: 'thinking', text });
      }
      return;
    }
    if (type === 'error') {
      this.finish(requestId, runtime, new Error(String(event.message ?? 'Claude Code ACP Provider 调用失败')));
      return;
    }
    if (type === 'turn_complete') {
      const stopReason = String(event.stopReason ?? 'end_turn');
      if (stopReason === 'error') {
        this.finish(requestId, runtime, new Error('Claude Code ACP Provider 调用失败'));
        return;
      }
      this.finish(requestId, runtime);
    }
  }

  private finish(requestId: string, runtime: Runtime, error?: Error): void {
    if (runtime.done) return;
    runtime.done = true;
    runtime.manager.off('event', runtime.onEvent);
    runtime.manager.disconnect();
    this.runtimes.delete(requestId);
    if (error) {
      runtime.settle.reject(error);
      return;
    }
    runtime.settle.resolve({ text: runtime.chunks.join('') });
  }
}

function formatPrompt(
  messages: Array<{ role: string; content: string }>,
  jsonMode?: boolean,
): string {
  const body = messages
    .map((message) => {
      const role = message.role === 'system'
        ? 'System'
        : message.role === 'assistant'
          ? 'Assistant'
          : 'User';
      return `<${role}>\n${message.content}\n</${role}>`;
    })
    .join('\n\n');

  if (!jsonMode) return body;
  return `${body}\n\n请严格只输出一个完整 JSON 对象，不要使用 Markdown 代码块，不要追加解释文字。`;
}

function normalizeProviderError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOENT|not found|failed to spawn/i.test(message)) {
    return new Error('未找到 Claude Code ACP 运行时，请先在 Claude Code 设置中安装并启用');
  }
  if (/Agent process exited|Client disconnected/i.test(message)) {
    return new Error(`Claude Code ACP 进程已退出：${message}`);
  }
  return error instanceof Error ? error : new Error(message);
}
