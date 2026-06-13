/**
 * codex-json-event.ts
 *
 * Parser for Codex CLI JSON event stream.
 *
 * Codex emits one JSON object per line.  Each object carries a `type` field
 * that this parser maps to the protocol-neutral AgentStreamEvent shape used by
 * the rest of the runtime.
 *
 * Mapping rules (based on observed Codex CLI output / open-design spec):
 *
 *   turn.started                          → status { label:'running' }
 *   item.started  (command_execution)     → tool_use { id, name:'Bash', input:{command} }
 *                                            and record id in codexToolUses set
 *   item.completed (command_execution)    → (re-emit tool_use if not already seen)
 *                                            tool_result { toolUseId, content, isError }
 *   item.completed (agent_message)        → text_delta { delta: text }
 *                                            (prepend '\n' when previous non-empty
 *                                             agent_message was emitted, to avoid
 *                                             token-boundary concatenation)
 *   turn.completed                        → usage { inputTokens, outputTokens }
 *   error (Reconnecting …)               → status { label:'reconnecting', detail }
 *   error (other)                        → error { message }
 */

import type { AgentStreamEvent } from '../event-model';
import { createJsonLineStream } from './line-stream';

// ─── Internal Codex event shapes ─────────────────────────────────────────────

interface CodexTurnStarted {
  type: 'turn.started';
}

interface CodexItemStartedCommandExecution {
  type: 'item.started';
  item: {
    type: 'command_execution';
    id: string;
    command?: string;
  };
}

interface CodexItemCompletedCommandExecution {
  type: 'item.completed';
  item: {
    type: 'command_execution';
    id: string;
    /** Aggregated stdout/stderr output */
    aggregated_output?: string;
    /** Alternative output field name used by some Codex versions */
    output?: string;
    exit_code?: number;
  };
}

interface CodexItemCompletedAgentMessage {
  type: 'item.completed';
  item: {
    type: 'agent_message';
    text?: string;
    /** Some versions use content instead of text */
    content?: string;
  };
}

type CodexItemCompleted =
  | CodexItemCompletedCommandExecution
  | CodexItemCompletedAgentMessage;

interface CodexTurnCompleted {
  type: 'turn.completed';
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    /** Alternative camelCase field names */
    inputTokens?: number;
    outputTokens?: number;
  };
}

interface CodexError {
  type: 'error';
  message?: string;
}

type CodexEvent =
  | CodexTurnStarted
  | CodexItemStartedCommandExecution
  | CodexItemCompleted
  | CodexTurnCompleted
  | CodexError
  | { type: string; [key: string]: unknown };

// ─── Reconnect-able error keywords ───────────────────────────────────────────

const RECOVERABLE_KEYWORDS = ['Reconnecting', 'reconnecting', 'retry', 'Retry'];

function isRecoverableError(message: string): boolean {
  return RECOVERABLE_KEYWORDS.some((kw) => message.includes(kw));
}

// ─── Public factory ───────────────────────────────────────────────────────────

export interface CodexParser {
  feed(chunk: string | Buffer): void;
  flush(): void;
}

export function createCodexParser(
  onEvent: (ev: AgentStreamEvent) => void,
): CodexParser {
  /**
   * Tracks command_execution IDs for which we have already emitted tool_use.
   * Prevents duplicate tool_use events when both item.started and
   * item.completed fire for the same ID.
   */
  const codexToolUses = new Set<string>();

  /**
   * Whether the previous agent_message text_delta was non-empty.
   * Used to inject a '\n' separator between consecutive agent_message blocks.
   */
  let prevAgentMessageNonEmpty = false;

  function handleJson(obj: unknown): void {
    const ev = obj as CodexEvent;

    switch (ev.type) {
      case 'turn.started': {
        onEvent({ type: 'status', label: 'running' });
        break;
      }

      case 'item.started': {
        const started = ev as CodexItemStartedCommandExecution;
        const item = started.item;
        if (item?.type === 'command_execution') {
          const id = item.id ?? '';
          const command = item.command ?? '';
          codexToolUses.add(id);
          onEvent({
            type: 'tool_use',
            id,
            name: 'Bash',
            input: { command },
          });
        }
        break;
      }

      case 'item.completed': {
        const completed = ev as CodexItemCompleted;
        const item = completed.item;

        if (item?.type === 'command_execution') {
          const cmdItem = item as CodexItemCompletedCommandExecution['item'];
          const id = cmdItem.id ?? '';
          const output = cmdItem.aggregated_output ?? cmdItem.output ?? '';
          const exitCode = cmdItem.exit_code ?? 0;

          // Emit tool_use if item.started was never received for this id
          if (!codexToolUses.has(id)) {
            codexToolUses.add(id);
            onEvent({
              type: 'tool_use',
              id,
              name: 'Bash',
              input: { command: '' },
            });
          }

          onEvent({
            type: 'tool_result',
            toolUseId: id,
            content: output,
            isError: exitCode !== 0,
          });
        } else if (item?.type === 'agent_message') {
          const msgItem = item as CodexItemCompletedAgentMessage['item'];
          const text = msgItem.text ?? msgItem.content ?? '';

          // Inject newline separator between consecutive agent_message blocks
          if (prevAgentMessageNonEmpty && text.length > 0) {
            onEvent({ type: 'text_delta', delta: '\n' });
          }

          onEvent({ type: 'text_delta', delta: text });
          prevAgentMessageNonEmpty = text.length > 0;
        }
        break;
      }

      case 'turn.completed': {
        const turnCompleted = ev as CodexTurnCompleted;
        const usage = turnCompleted.usage;
        // Support both snake_case and camelCase field names
        const inputTokens =
          usage?.input_tokens ?? usage?.inputTokens ?? undefined;
        const outputTokens =
          usage?.output_tokens ?? usage?.outputTokens ?? undefined;
        onEvent({ type: 'usage', inputTokens, outputTokens });
        break;
      }

      case 'error': {
        const errorEv = ev as CodexError;
        const message = errorEv.message ?? 'Unknown error';
        if (isRecoverableError(message)) {
          onEvent({ type: 'status', label: 'reconnecting', detail: message });
        } else {
          onEvent({ type: 'error', message });
        }
        break;
      }

      default:
        // Unknown event types are silently ignored (forward-compatibility)
        break;
    }
  }

  const lineStream = createJsonLineStream({
    onJson: handleJson,
    onRaw: (line) => {
      // Non-JSON lines are emitted as raw events for debugging
      onEvent({ type: 'raw', line });
    },
  });

  return {
    feed(chunk: string | Buffer): void {
      lineStream.feed(chunk);
    },
    flush(): void {
      lineStream.flush();
    },
  };
}
