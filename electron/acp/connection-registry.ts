import { EventEmitter } from 'node:events';
import { AcpClient } from './client';
import { SessionManager } from './session';
import type { AcpEvent, ConnectionStatus, PermissionPolicy } from './types';

export interface RegistryConnectArgs {
  conversationId: number;
  projectDir: string;
  spawnCommand: string;
  spawnArgs: string[];
  env?: Record<string, string>;
  sessionId?: string | null;
  permissionPolicy?: PermissionPolicy;
  agentType?: string;
}

export interface RuntimeSnapshot {
  conversationId: number;
  projectDir: string;
  agentType: string;
  status: ConnectionStatus;
  sessionId: string | null;
}

export interface RuntimeStatusPayload {
  conversationId: number;
  status: ConnectionStatus;
}

export interface RuntimeEventPayload {
  conversationId: number;
  event: AcpEvent | Record<string, unknown>;
}

export interface RuntimeCapabilitiesPayload {
  conversationId: number;
  capabilities: unknown;
}

export interface RuntimeFileChangedPayload {
  conversationId: number;
  change: unknown;
}

export interface SessionManagerLike {
  connect(
    projectDir: string,
    spawnCommand: string,
    spawnArgs: string[],
    env?: Record<string, string>,
    sessionId?: string | null,
  ): Promise<void>;
  sendPrompt(contents: unknown[]): Promise<void>;
  cancelTurn(): Promise<void>;
  setMode(modeId: string): Promise<void>;
  setConfigOption(configId: string, valueId: string): Promise<void>;
  setModel?(modelId: string): Promise<void>;
  respondPermission(requestId: string, optionId: string): Promise<void>;
  setPermissionPolicy(policy: PermissionPolicy): void;
  disconnect(): void;
  getStatus(): ConnectionStatus;
  getSessionId(): string | null;
  on(event: 'status', listener: (status: ConnectionStatus) => void): this;
  on(event: 'event', listener: (event: AcpEvent | Record<string, unknown>) => void): this;
  on(event: 'capabilities', listener: (caps: unknown) => void): this;
  on(event: 'file_changed', listener: (change: unknown) => void): this;
  off(event: 'status', listener: (status: ConnectionStatus) => void): this;
  off(event: 'event', listener: (event: AcpEvent | Record<string, unknown>) => void): this;
  off(event: 'capabilities', listener: (caps: unknown) => void): this;
  off(event: 'file_changed', listener: (change: unknown) => void): this;
}

interface RuntimeEntry {
  snapshot: RuntimeSnapshot;
  manager: SessionManagerLike;
  listeners: {
    onStatus: (status: ConnectionStatus) => void;
    onEvent: (event: AcpEvent | Record<string, unknown>) => void;
    onCapabilities: (caps: unknown) => void;
    onFileChanged: (change: unknown) => void;
  };
}

interface ConnectionRegistryOptions {
  createSessionManager?: (policy: PermissionPolicy) => SessionManagerLike;
  defaultPermissionPolicy?: PermissionPolicy;
}

export class ConnectionRegistry extends EventEmitter {
  private readonly runtimes = new Map<number, RuntimeEntry>();
  private readonly createSessionManager: (policy: PermissionPolicy) => SessionManagerLike;
  private defaultPermissionPolicy: PermissionPolicy;

  constructor(options: ConnectionRegistryOptions = {}) {
    super();
    this.defaultPermissionPolicy = options.defaultPermissionPolicy ?? 'tiered';
    this.createSessionManager =
      options.createSessionManager ?? ((policy) => new SessionManager(new AcpClient(), policy));
  }

  size(): number {
    return this.runtimes.size;
  }

  list(): RuntimeSnapshot[] {
    return Array.from(this.runtimes.values(), (entry) => ({ ...entry.snapshot }));
  }

  get(conversationId: number): RuntimeSnapshot | null {
    const entry = this.runtimes.get(conversationId);
    if (!entry) return null;
    return { ...entry.snapshot };
  }

  async connect(args: RegistryConnectArgs): Promise<RuntimeSnapshot> {
    const existing = this.runtimes.get(args.conversationId);
    if (existing) {
      const status = existing.manager.getStatus();
      const currentSessionId = existing.manager.getSessionId();
      if (
        (status === 'connected' || status === 'prompting') &&
        (!args.sessionId || args.sessionId === currentSessionId)
      ) {
        this.emit('status', { conversationId: args.conversationId, status } satisfies RuntimeStatusPayload);
        return { ...existing.snapshot };
      }
      this.disconnect(args.conversationId);
    }

    const policy = args.permissionPolicy ?? this.defaultPermissionPolicy;
    const manager = this.createSessionManager(policy);
    const snapshot: RuntimeSnapshot = {
      conversationId: args.conversationId,
      projectDir: args.projectDir,
      agentType: args.agentType ?? 'claude-acp',
      status: manager.getStatus(),
      sessionId: manager.getSessionId(),
    };

    const listeners = this.bindRuntimeListeners(args.conversationId, snapshot, manager);
    const entry: RuntimeEntry = { snapshot, manager, listeners };
    this.runtimes.set(args.conversationId, entry);

    try {
      await manager.connect(
        args.projectDir,
        args.spawnCommand,
        args.spawnArgs,
        args.env,
        args.sessionId,
      );
      snapshot.status = manager.getStatus();
      snapshot.sessionId = manager.getSessionId();
      return { ...snapshot };
    } catch (error) {
      this.cleanupEntry(args.conversationId, entry, false);
      throw error;
    }
  }

  async sendPrompt(conversationId: number, contents: unknown[]): Promise<void> {
    const entry = this.getEntryOrThrow(conversationId);
    await entry.manager.sendPrompt(contents);
  }

  async cancelTurn(conversationId: number): Promise<void> {
    const entry = this.getEntryOrThrow(conversationId);
    await entry.manager.cancelTurn();
  }

  async setMode(conversationId: number, modeId: string): Promise<void> {
    const entry = this.getEntryOrThrow(conversationId);
    await entry.manager.setMode(modeId);
  }

  async setConfigOption(conversationId: number, configId: string, valueId: string): Promise<void> {
    const entry = this.getEntryOrThrow(conversationId);
    await entry.manager.setConfigOption(configId, valueId);
  }

  async respondPermission(conversationId: number, requestId: string, optionId: string): Promise<void> {
    const entry = this.getEntryOrThrow(conversationId);
    await entry.manager.respondPermission(requestId, optionId);
  }

  disconnect(conversationId: number): void {
    const entry = this.runtimes.get(conversationId);
    if (!entry) return;
    this.cleanupEntry(conversationId, entry, true);
  }

  disconnectAll(): void {
    for (const conversationId of this.runtimes.keys()) {
      this.disconnect(conversationId);
    }
  }

  /**
   * 将权限策略同步到所有活跃运行时，同时更新默认策略供后续新连接使用。
   */
  setPermissionPolicy(policy: PermissionPolicy): void {
    this.defaultPermissionPolicy = policy;
    for (const entry of this.runtimes.values()) {
      entry.manager.setPermissionPolicy(policy);
    }
  }

  private bindRuntimeListeners(
    conversationId: number,
    snapshot: RuntimeSnapshot,
    manager: SessionManagerLike,
  ): RuntimeEntry['listeners'] {
    const onStatus = (status: ConnectionStatus) => {
      snapshot.status = status;
      snapshot.sessionId = manager.getSessionId();
      this.emit('status', { conversationId, status } satisfies RuntimeStatusPayload);
    };
    const onEvent = (event: AcpEvent | Record<string, unknown>) => {
      snapshot.sessionId = manager.getSessionId();
      this.emit('event', { conversationId, event } satisfies RuntimeEventPayload);
    };
    const onCapabilities = (capabilities: unknown) => {
      this.emit(
        'capabilities',
        { conversationId, capabilities } satisfies RuntimeCapabilitiesPayload,
      );
    };
    const onFileChanged = (change: unknown) => {
      this.emit('file_changed', { conversationId, change } satisfies RuntimeFileChangedPayload);
    };

    manager.on('status', onStatus);
    manager.on('event', onEvent);
    manager.on('capabilities', onCapabilities);
    manager.on('file_changed', onFileChanged);

    return { onStatus, onEvent, onCapabilities, onFileChanged };
  }

  private cleanupEntry(conversationId: number, entry: RuntimeEntry, disconnectManager: boolean): void {
    entry.manager.off('status', entry.listeners.onStatus);
    entry.manager.off('event', entry.listeners.onEvent);
    entry.manager.off('capabilities', entry.listeners.onCapabilities);
    entry.manager.off('file_changed', entry.listeners.onFileChanged);
    this.runtimes.delete(conversationId);
    if (disconnectManager) {
      entry.manager.disconnect();
    }
    this.emit(
      'status',
      { conversationId, status: 'disconnected' } satisfies RuntimeStatusPayload,
    );
  }

  private getEntryOrThrow(conversationId: number): RuntimeEntry {
    const entry = this.runtimes.get(conversationId);
    if (!entry) {
      throw new Error(`No active runtime for conversation ${conversationId}`);
    }
    return entry;
  }
}
