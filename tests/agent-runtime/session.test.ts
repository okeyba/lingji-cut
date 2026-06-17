import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { AgentSession } from '../../electron/agent-runtime/session';
import type { RuntimeAgentDef } from '../../electron/agent-runtime/types';
import type { AgentStreamEvent } from '../../electron/agent-runtime/event-model';
import { piAgentDef } from '../../electron/agent-runtime/agent-defs/pi';

// ─── Fake child process ────────────────────────────────────────────────────

class FakeStream extends EventEmitter {
  push(chunk: string): void {
    this.emit('data', chunk);
  }
  end(): void {
    this.emit('end');
  }
}

class FakeWritable extends EventEmitter {
  write = vi.fn((_chunk: string) => true);
  end = vi.fn();
}

class FakeChild extends EventEmitter {
  stdout = new FakeStream();
  stderr = new FakeStream();
  stdin = new FakeWritable();
  kill = vi.fn();
  killed = false;
  constructor() {
    super();
    this.kill.mockImplementation(() => {
      this.killed = true;
      return true;
    });
  }
}

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeBinaryManager(resolved: string | null = '/fake/bin') {
  return {
    resolveBinary: vi.fn().mockResolvedValue(resolved),
    ensureNodeInPath: vi.fn(),
  };
}

const BUNDLED_EXEC_PATH = '/path/to/electron';

/**
 * 合成的 PATH 探测型 def（无 bundledNodeEntry）：用于覆盖 session 的
 * detection / resolveBinary 分支（pi 现为内置入口，不再走 PATH）。
 */
const syntheticPathDef: RuntimeAgentDef = {
  id: 'synthetic',
  name: 'Synthetic',
  bin: 'synthetic',
  versionArgs: ['--version'],
  streamFormat: 'pi-rpc',
  defaultModel: 'default',
  buildArgs: () => ['--mode', 'rpc'],
} as RuntimeAgentDef;

function makeSession(
  child: FakeChild,
  bm: ReturnType<typeof makeBinaryManager>,
): { session: AgentSession; spawnFn: ReturnType<typeof vi.fn> } {
  const spawnFn = vi.fn(() => child as unknown as any);
  const session = new AgentSession({
    spawnFn: spawnFn as any,
    binaryManager: bm as any,
    // 内置入口默认解析为 staged 绝对路径（仅 def.bundledNodeEntry 时生效）。
    resolveBundledEntry: (rel) => `/staged/${rel}`,
    execPath: BUNDLED_EXEC_PATH,
  });
  return { session, spawnFn };
}

describe('AgentSession', () => {
  let events: AgentStreamEvent[];
  let onEvent: (ev: AgentStreamEvent) => void;

  beforeEach(() => {
    events = [];
    onEvent = (ev) => events.push(ev);
  });

  it('pi: spawn + pi-rpc → stdin 收到命令，stdout 事件归一化', async () => {
    const child = new FakeChild();
    const bm = makeBinaryManager('/usr/local/bin/pi');
    const { session, spawnFn } = makeSession(child, bm);

    await session.start({
      def: piAgentDef as RuntimeAgentDef,
      prompt: 'pi prompt',
      cwd: '/tmp/p',
      onEvent,
    });

    const [cmd, args, opts] = spawnFn.mock.calls[0];
    // pi 现为内置入口：用 Electron 自带 Node 跑 staged cli.js
    expect(cmd).toBe(BUNDLED_EXEC_PATH);
    expect(args[0]).toBe('/staged/resources/pi/dist/cli.js');
    expect(args.slice(1)).toEqual(['--mode', 'rpc']);
    expect(opts.env.ELECTRON_RUN_AS_NODE).toBe('1');
    // pi-rpc needs piped stdin
    expect(opts.stdio[0]).toBe('pipe');

    // pi-rpc session writes prompt command to stdin
    expect(child.stdin.write).toHaveBeenCalled();
    const written = (child.stdin.write as any).mock.calls.map((c: any[]) => c[0]).join('');
    expect(written).toContain('pi prompt');

    // push pi events
    child.stdout.push(JSON.stringify({ type: 'agent_start' }) + '\n');
    child.stdout.push(
      JSON.stringify({
        type: 'message_update',
        event: { type: 'text_delta', delta: 'yo' },
      }) + '\n',
    );

    expect(events).toContainEqual({ type: 'status', label: 'working' });
    expect(events).toContainEqual({ type: 'text_delta', delta: 'yo' });
  });

  it('pi: parentSession 透传到 pi-rpc session', async () => {
    const child = new FakeChild();
    const bm = makeBinaryManager('/usr/local/bin/pi');
    const { session } = makeSession(child, bm);

    await session.start({
      def: piAgentDef as RuntimeAgentDef,
      prompt: 'resume me',
      parentSession: 'sess-123',
      onEvent,
    });

    const written = (child.stdin.write as any).mock.calls.map((c: any[]) => c[0]).join('');
    expect(written).toContain('sess-123');
  });

  it('cancel(): kill 子进程 (SIGTERM)', async () => {
    const child = new FakeChild();
    const bm = makeBinaryManager('/usr/local/bin/pi');
    const { session } = makeSession(child, bm);

    await session.start({
      def: piAgentDef as RuntimeAgentDef,
      prompt: 'hi',
      onEvent,
    });

    session.cancel();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('未安装 (resolveBinary 返回 null) → onEvent error，不 spawn', async () => {
    const child = new FakeChild();
    const bm = makeBinaryManager(null);
    const { session, spawnFn } = makeSession(child, bm);

    // 用合成 PATH 探测型 def 覆盖 detection 失败分支
    await session.start({
      def: syntheticPathDef,
      prompt: 'hi',
      onEvent,
    });

    expect(spawnFn).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === 'error')).toBe(true);
  });

  it('ensureNodeInPath 在 spawn 前被调用', async () => {
    const child = new FakeChild();
    const bm = makeBinaryManager('/usr/local/bin/pi');
    const { session } = makeSession(child, bm);

    await session.start({
      def: piAgentDef as RuntimeAgentDef,
      prompt: 'hi',
      onEvent,
    });

    expect(bm.ensureNodeInPath).toHaveBeenCalled();
  });

  it('child error 事件 → onEvent error', async () => {
    const child = new FakeChild();
    const bm = makeBinaryManager('/usr/local/bin/pi');
    const { session } = makeSession(child, bm);

    await session.start({
      def: piAgentDef as RuntimeAgentDef,
      prompt: 'hi',
      onEvent,
    });

    child.emit('error', new Error('boom'));
    const errEv = events.find((e) => e.type === 'error') as { type: 'error'; message: string };
    expect(errEv).toBeDefined();
    expect(errEv.message).toContain('boom');
  });

  it('非零退出 + stderr → error 事件附带 stderr', async () => {
    const child = new FakeChild();
    const bm = makeBinaryManager('/usr/local/bin/pi');
    const { session } = makeSession(child, bm);

    await session.start({
      def: piAgentDef as RuntimeAgentDef,
      prompt: 'hi',
      onEvent,
    });

    child.stderr.push('fatal: something broke');
    child.emit('close', 1);

    const errEv = events.find((e) => e.type === 'error') as
      | { type: 'error'; message: string; raw?: string }
      | undefined;
    expect(errEv).toBeDefined();
    expect((errEv?.raw ?? errEv?.message ?? '')).toContain('something broke');
  });

  it('干净退出（code 0）且 parser 未发终态 → 兜底 emit turn_end', async () => {
    const child = new FakeChild();
    const bm = makeBinaryManager('/usr/local/bin/pi');
    const { session } = makeSession(child, bm);

    await session.start({
      def: piAgentDef as RuntimeAgentDef,
      prompt: 'hi',
      onEvent,
    });

    // 没有任何终态事件，进程干净退出
    child.emit('close', 0);

    const terminal = events.filter((e) => e.type === 'turn_end' || e.type === 'error');
    expect(terminal).toHaveLength(1);
    expect(terminal[0].type).toBe('turn_end');
  });

  it('parser 已发 turn_end 后干净退出 → 不重复 emit turn_end', async () => {
    const child = new FakeChild();
    const bm = makeBinaryManager('/usr/local/bin/pi');
    const { session } = makeSession(child, bm);

    await session.start({
      def: piAgentDef as RuntimeAgentDef,
      prompt: 'hi',
      onEvent,
    });

    // pi agent_end → parser emit turn_end
    child.stdout.push(JSON.stringify({ type: 'agent_end' }) + '\n');
    const turnEndsBefore = events.filter((e) => e.type === 'turn_end').length;
    expect(turnEndsBefore).toBe(1);

    child.emit('close', 0);
    const turnEndsAfter = events.filter((e) => e.type === 'turn_end').length;
    expect(turnEndsAfter).toBe(1); // 无重复
  });

  it('bundledNodeEntry: 用 execPath 跑入口，ELECTRON_RUN_AS_NODE=1，无需 binaryManager 解析', async () => {
    const child = new FakeChild();
    const bm = makeBinaryManager(null); // resolveBinary 返回 null，确认不走 detection
    const spawnFn = vi.fn(() => child as unknown as any);
    const resolvedEntry = '/staged/resources/pi/dist/cli.js';
    const session = new AgentSession({
      spawnFn: spawnFn as any,
      binaryManager: bm as any,
      resolveBundledEntry: vi.fn(() => resolvedEntry),
      execPath: '/path/to/electron',
    });

    const def: RuntimeAgentDef = {
      id: 'pi',
      name: 'Pi',
      bin: 'pi',
      bundledNodeEntry: 'resources/pi/dist/cli.js',
      versionArgs: ['--version'],
      streamFormat: 'pi-rpc',
      defaultModel: 'default',
      buildArgs: () => ['--mode', 'rpc'],
    } as RuntimeAgentDef;

    await session.start({
      def,
      prompt: 'pi prompt',
      cwd: '/tmp/p',
      onEvent,
    });

    expect(spawnFn).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = spawnFn.mock.calls[0];
    expect(cmd).toBe('/path/to/electron');
    expect(args[0]).toBe(resolvedEntry);
    expect(args.slice(1)).toEqual(['--mode', 'rpc']);
    expect(opts.env.ELECTRON_RUN_AS_NODE).toBe('1');
    // 未走 detection
    expect(bm.resolveBinary).not.toHaveBeenCalled();
  });

  it('bundledNodeEntry 缺失（resolveBundledEntry 返回 null）→ error，不 spawn', async () => {
    const child = new FakeChild();
    const bm = makeBinaryManager(null);
    const spawnFn = vi.fn(() => child as unknown as any);
    const session = new AgentSession({
      spawnFn: spawnFn as any,
      binaryManager: bm as any,
      resolveBundledEntry: vi.fn(() => null),
      execPath: '/path/to/electron',
    });

    const def: RuntimeAgentDef = {
      id: 'pi',
      name: 'Pi',
      bin: 'pi',
      bundledNodeEntry: 'resources/pi/dist/cli.js',
      versionArgs: ['--version'],
      streamFormat: 'pi-rpc',
      defaultModel: 'default',
      buildArgs: () => ['--mode', 'rpc'],
    } as RuntimeAgentDef;

    await session.start({ def, prompt: 'hi', onEvent });

    expect(spawnFn).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === 'error')).toBe(true);
  });

  it('env: 注入 def.env 与 input.env，过滤 npm_*', async () => {
    const child = new FakeChild();
    const bm = makeBinaryManager('/usr/local/bin/pi');
    const { session, spawnFn } = makeSession(child, bm);

    process.env.npm_config_foo = 'should-be-filtered';

    await session.start({
      def: { ...(piAgentDef as RuntimeAgentDef), env: { DEF_VAR: 'd' } },
      prompt: 'hi',
      env: { INPUT_VAR: 'i' },
      onEvent,
    });

    const opts = spawnFn.mock.calls[0][2];
    expect(opts.env.DEF_VAR).toBe('d');
    expect(opts.env.INPUT_VAR).toBe('i');
    expect(opts.env.npm_config_foo).toBeUndefined();

    delete process.env.npm_config_foo;
  });
});
