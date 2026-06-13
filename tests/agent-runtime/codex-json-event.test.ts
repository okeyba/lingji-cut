/**
 * tests/agent-runtime/codex-json-event.test.ts
 *
 * Unit tests for the Codex JSON event parser.
 * Each test feeds representative Codex CLI JSON lines and asserts the
 * resulting AgentStreamEvent sequence.
 */

import { describe, expect, it, vi } from 'vitest';
import { createCodexParser } from '../../electron/agent-runtime/parsers/codex-json-event';
import type { AgentStreamEvent } from '../../electron/agent-runtime/event-model';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Feed a sequence of JSON objects as newline-delimited lines. */
function feedLines(
  parser: ReturnType<typeof createCodexParser>,
  ...objs: object[]
): void {
  for (const obj of objs) {
    parser.feed(JSON.stringify(obj) + '\n');
  }
}

function makeParser(): {
  events: AgentStreamEvent[];
  parser: ReturnType<typeof createCodexParser>;
} {
  const events: AgentStreamEvent[] = [];
  const parser = createCodexParser((ev) => events.push(ev));
  return { events, parser };
}

// ─── turn.started ─────────────────────────────────────────────────────────────

describe('turn.started', () => {
  it('emits status{label:"running"}', () => {
    const { events, parser } = makeParser();
    feedLines(parser, { type: 'turn.started' });
    expect(events).toEqual([{ type: 'status', label: 'running' }]);
  });
});

// ─── item.started (command_execution) ─────────────────────────────────────────

describe('item.started — command_execution', () => {
  it('emits tool_use{name:"Bash"} with the command', () => {
    const { events, parser } = makeParser();
    feedLines(parser, {
      type: 'item.started',
      item: { type: 'command_execution', id: 'exec-1', command: 'ls -la' },
    });
    expect(events).toEqual([
      { type: 'tool_use', id: 'exec-1', name: 'Bash', input: { command: 'ls -la' } },
    ]);
  });

  it('does NOT re-emit tool_use on item.completed when item.started already fired', () => {
    const { events, parser } = makeParser();
    feedLines(
      parser,
      { type: 'item.started', item: { type: 'command_execution', id: 'exec-2', command: 'echo hi' } },
      { type: 'item.completed', item: { type: 'command_execution', id: 'exec-2', aggregated_output: 'hi', exit_code: 0 } },
    );

    const toolUseEvents = events.filter((e) => e.type === 'tool_use');
    // Only ONE tool_use — the one from item.started
    expect(toolUseEvents).toHaveLength(1);
    expect(toolUseEvents[0]).toMatchObject({ id: 'exec-2', name: 'Bash' });
  });
});

// ─── item.completed (command_execution) ───────────────────────────────────────

describe('item.completed — command_execution', () => {
  it('emits tool_result{isError:false} when exit_code is 0', () => {
    const { events, parser } = makeParser();
    feedLines(
      parser,
      { type: 'item.started', item: { type: 'command_execution', id: 'exec-3', command: 'pwd' } },
      { type: 'item.completed', item: { type: 'command_execution', id: 'exec-3', aggregated_output: '/home/user', exit_code: 0 } },
    );

    const resultEvent = events.find((e) => e.type === 'tool_result');
    expect(resultEvent).toEqual({
      type: 'tool_result',
      toolUseId: 'exec-3',
      content: '/home/user',
      isError: false,
    });
  });

  it('emits tool_result{isError:true} when exit_code is non-zero', () => {
    const { events, parser } = makeParser();
    feedLines(
      parser,
      { type: 'item.started', item: { type: 'command_execution', id: 'exec-4', command: 'false' } },
      { type: 'item.completed', item: { type: 'command_execution', id: 'exec-4', aggregated_output: '', exit_code: 1 } },
    );

    const resultEvent = events.find((e) => e.type === 'tool_result');
    expect(resultEvent).toMatchObject({ type: 'tool_result', isError: true });
  });

  it('falls back to output field when aggregated_output is absent', () => {
    const { events, parser } = makeParser();
    feedLines(
      parser,
      { type: 'item.started', item: { type: 'command_execution', id: 'exec-5', command: 'cat file' } },
      { type: 'item.completed', item: { type: 'command_execution', id: 'exec-5', output: 'file content', exit_code: 0 } },
    );

    const resultEvent = events.find((e) => e.type === 'tool_result');
    expect(resultEvent).toMatchObject({ content: 'file content' });
  });

  it('emits tool_use first if item.started was never received (dedup guard, completed-only path)', () => {
    const { events, parser } = makeParser();
    // Only item.completed, no preceding item.started
    feedLines(parser, {
      type: 'item.completed',
      item: { type: 'command_execution', id: 'exec-6', aggregated_output: 'output', exit_code: 0 },
    });

    const toolUseEvent = events.find((e) => e.type === 'tool_use');
    expect(toolUseEvent).toBeDefined();
    expect(toolUseEvent).toMatchObject({ id: 'exec-6', name: 'Bash' });

    const resultEvent = events.find((e) => e.type === 'tool_result');
    expect(resultEvent).toMatchObject({ toolUseId: 'exec-6', content: 'output' });
  });

  it('does NOT emit a second tool_use when receiving completed-only a second time for same id', () => {
    const { events, parser } = makeParser();
    // Send item.completed twice (edge case, e.g. network retry)
    feedLines(
      parser,
      { type: 'item.completed', item: { type: 'command_execution', id: 'exec-7', aggregated_output: 'x', exit_code: 0 } },
      { type: 'item.completed', item: { type: 'command_execution', id: 'exec-7', aggregated_output: 'x', exit_code: 0 } },
    );

    const toolUseEvents = events.filter((e) => e.type === 'tool_use');
    // Only one synthetic tool_use should be emitted
    expect(toolUseEvents).toHaveLength(1);
  });
});

// ─── item.completed (agent_message) ───────────────────────────────────────────

describe('item.completed — agent_message', () => {
  it('emits text_delta with the message text', () => {
    const { events, parser } = makeParser();
    feedLines(parser, {
      type: 'item.completed',
      item: { type: 'agent_message', text: 'Hello, world!' },
    });
    expect(events).toEqual([{ type: 'text_delta', delta: 'Hello, world!' }]);
  });

  it('falls back to content field when text is absent', () => {
    const { events, parser } = makeParser();
    feedLines(parser, {
      type: 'item.completed',
      item: { type: 'agent_message', content: 'Fallback content' },
    });
    expect(events).toContainEqual({ type: 'text_delta', delta: 'Fallback content' });
  });

  it('injects \\n separator between two consecutive non-empty agent_message events', () => {
    const { events, parser } = makeParser();
    feedLines(
      parser,
      { type: 'item.completed', item: { type: 'agent_message', text: 'First' } },
      { type: 'item.completed', item: { type: 'agent_message', text: 'Second' } },
    );

    expect(events).toEqual([
      { type: 'text_delta', delta: 'First' },
      { type: 'text_delta', delta: '\n' },
      { type: 'text_delta', delta: 'Second' },
    ]);
  });

  it('does NOT inject \\n separator when previous agent_message was empty', () => {
    const { events, parser } = makeParser();
    feedLines(
      parser,
      { type: 'item.completed', item: { type: 'agent_message', text: '' } },
      { type: 'item.completed', item: { type: 'agent_message', text: 'Content' } },
    );

    // No newline injected between empty and non-empty
    expect(events).toEqual([
      { type: 'text_delta', delta: '' },
      { type: 'text_delta', delta: 'Content' },
    ]);
  });

  it('does NOT inject \\n before the very first agent_message', () => {
    const { events, parser } = makeParser();
    feedLines(parser, {
      type: 'item.completed',
      item: { type: 'agent_message', text: 'Only message' },
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'text_delta', delta: 'Only message' });
  });
});

// ─── turn.completed ───────────────────────────────────────────────────────────

describe('turn.completed', () => {
  it('emits usage with snake_case token fields', () => {
    const { events, parser } = makeParser();
    feedLines(parser, {
      type: 'turn.completed',
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    expect(events).toEqual([{ type: 'usage', inputTokens: 100, outputTokens: 50 }]);
  });

  it('emits usage with camelCase token fields (fallback)', () => {
    const { events, parser } = makeParser();
    feedLines(parser, {
      type: 'turn.completed',
      usage: { inputTokens: 200, outputTokens: 75 },
    });
    expect(events).toEqual([{ type: 'usage', inputTokens: 200, outputTokens: 75 }]);
  });

  it('emits usage{inputTokens:undefined, outputTokens:undefined} when usage field is absent', () => {
    const { events, parser } = makeParser();
    feedLines(parser, { type: 'turn.completed' });
    expect(events).toEqual([{ type: 'usage', inputTokens: undefined, outputTokens: undefined }]);
  });
});

// ─── error events ─────────────────────────────────────────────────────────────

describe('error events', () => {
  it('maps recoverable "Reconnecting" error to status{label:"reconnecting"}', () => {
    const { events, parser } = makeParser();
    feedLines(parser, { type: 'error', message: 'Reconnecting to server...' });
    expect(events).toEqual([
      { type: 'status', label: 'reconnecting', detail: 'Reconnecting to server...' },
    ]);
  });

  it('maps recoverable "reconnecting" (lowercase) error to status', () => {
    const { events, parser } = makeParser();
    feedLines(parser, { type: 'error', message: 'Connection lost, reconnecting...' });
    expect(events).toEqual([
      { type: 'status', label: 'reconnecting', detail: 'Connection lost, reconnecting...' },
    ]);
  });

  it('maps non-recoverable error to error event', () => {
    const { events, parser } = makeParser();
    feedLines(parser, { type: 'error', message: 'Authentication failed' });
    expect(events).toEqual([{ type: 'error', message: 'Authentication failed' }]);
  });

  it('defaults message to "Unknown error" when absent', () => {
    const { events, parser } = makeParser();
    feedLines(parser, { type: 'error' });
    expect(events).toEqual([{ type: 'error', message: 'Unknown error' }]);
  });
});

// ─── Full representative sequence ─────────────────────────────────────────────

describe('full representative event sequence', () => {
  it('turn.started → tool_use(Bash) → tool_result → agent_message → usage', () => {
    const { events, parser } = makeParser();

    feedLines(
      parser,
      // 1. Turn starts
      { type: 'turn.started' },
      // 2. Bash command begins
      { type: 'item.started', item: { type: 'command_execution', id: 'cmd-1', command: 'echo hello' } },
      // 3. Bash command completes successfully
      { type: 'item.completed', item: { type: 'command_execution', id: 'cmd-1', aggregated_output: 'hello', exit_code: 0 } },
      // 4. Model responds with text
      { type: 'item.completed', item: { type: 'agent_message', text: 'The command ran successfully.' } },
      // 5. Turn ends with usage
      { type: 'turn.completed', usage: { input_tokens: 300, output_tokens: 80 } },
    );

    expect(events[0]).toEqual({ type: 'status', label: 'running' });
    expect(events[1]).toEqual({ type: 'tool_use', id: 'cmd-1', name: 'Bash', input: { command: 'echo hello' } });
    expect(events[2]).toEqual({ type: 'tool_result', toolUseId: 'cmd-1', content: 'hello', isError: false });
    expect(events[3]).toEqual({ type: 'text_delta', delta: 'The command ran successfully.' });
    expect(events[4]).toEqual({ type: 'usage', inputTokens: 300, outputTokens: 80 });
    expect(events).toHaveLength(5);
  });

  it('handles multiple Bash tool calls with deduplication', () => {
    const { events, parser } = makeParser();

    feedLines(
      parser,
      { type: 'turn.started' },
      // First command — both started and completed
      { type: 'item.started', item: { type: 'command_execution', id: 'a', command: 'ls' } },
      { type: 'item.completed', item: { type: 'command_execution', id: 'a', aggregated_output: 'file.ts', exit_code: 0 } },
      // Second command — only completed (no started)
      { type: 'item.completed', item: { type: 'command_execution', id: 'b', aggregated_output: 'err', exit_code: 2 } },
      { type: 'turn.completed', usage: { input_tokens: 50, output_tokens: 20 } },
    );

    const toolUses = events.filter((e) => e.type === 'tool_use');
    const toolResults = events.filter((e) => e.type === 'tool_result');

    expect(toolUses).toHaveLength(2);
    expect(toolResults).toHaveLength(2);
    expect(toolResults[1]).toMatchObject({ toolUseId: 'b', isError: true });
  });

  it('unknown event types are silently ignored', () => {
    const { events, parser } = makeParser();
    feedLines(
      parser,
      { type: 'turn.started' },
      { type: 'some.future.event', payload: 'ignored' },
      { type: 'turn.completed' },
    );

    expect(events).toHaveLength(2); // status + usage only
    expect(events[0]).toMatchObject({ type: 'status' });
    expect(events[1]).toMatchObject({ type: 'usage' });
  });
});

// ─── Buffer input ─────────────────────────────────────────────────────────────

describe('Buffer input', () => {
  it('accepts Buffer chunks just like string chunks', () => {
    const { events, parser } = makeParser();
    parser.feed(Buffer.from(JSON.stringify({ type: 'turn.started' }) + '\n'));
    expect(events).toEqual([{ type: 'status', label: 'running' }]);
  });
});

// ─── flush() ─────────────────────────────────────────────────────────────────

describe('flush()', () => {
  it('processes a partial line without trailing newline', () => {
    const { events, parser } = makeParser();
    parser.feed(JSON.stringify({ type: 'turn.started' }));
    expect(events).toHaveLength(0); // not yet emitted
    parser.flush();
    expect(events).toEqual([{ type: 'status', label: 'running' }]);
  });
});

// ─── Non-JSON lines ───────────────────────────────────────────────────────────

describe('non-JSON lines', () => {
  it('emits raw event for non-JSON lines (e.g. banner text)', () => {
    const { events, parser } = makeParser();
    parser.feed('Codex CLI v1.2.0\n');
    expect(events).toEqual([{ type: 'raw', line: 'Codex CLI v1.2.0' }]);
  });
});
