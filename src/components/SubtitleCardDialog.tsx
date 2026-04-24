import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  Textarea,
  useToast,
} from '../ui';
import type { AICardType } from '../types/ai';
import type { SubtitleCardDraftInput } from '../lib/ai-analysis';
import { generateAndInsertSingleCardFromSubtitles } from '../lib/single-card-generation';

const CARD_TYPE_OPTIONS: Array<{ value: AICardType; label: string }> = [
  { value: 'summary', label: '摘要（summary）' },
  { value: 'insight', label: '观点 / 洞察（insight）' },
  { value: 'quote', label: '金句（quote）' },
  { value: 'data', label: '数据（data）' },
  { value: 'chapter', label: '章节（chapter）' },
];

interface SubtitleCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: {
    text: string;
    startMs: number;
    endMs: number;
  } | null;
  /** 生成成功后的回调（弹窗已自动关闭） */
  onGenerated?: () => void;
}

interface ValidationState {
  textError?: string;
  timeError?: string;
  durationError?: string;
  hintError?: string;
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return '0';
  return String(Math.max(0, Math.round(ms)));
}

function parseMs(value: string): number {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
}

/**
 * 外层仅做 open/initial 托管；真正的表单 + 副作用由 Body 组件承担，
 * 避免 open=false 时也触发 useToast() 等依赖 Provider 的 hook。
 */
export function SubtitleCardDialog({
  open,
  onOpenChange,
  initial,
  onGenerated,
}: SubtitleCardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && initial ? (
        <SubtitleCardDialogBody
          initial={initial}
          onOpenChange={onOpenChange}
          onGenerated={onGenerated}
        />
      ) : null}
    </Dialog>
  );
}

function SubtitleCardDialogBody({
  initial,
  onOpenChange,
  onGenerated,
}: {
  initial: { text: string; startMs: number; endMs: number };
  onOpenChange: (open: boolean) => void;
  onGenerated?: () => void;
}) {
  const { showToast } = useToast();
  const [text, setText] = useState(initial.text);
  const [startMsInput, setStartMsInput] = useState(formatMs(initial.startMs));
  const [endMsInput, setEndMsInput] = useState(formatMs(initial.endMs));
  const [durationInput, setDurationInput] = useState(
    formatMs(Math.max(1000, initial.endMs - initial.startMs)),
  );
  const [type, setType] = useState<AICardType>('summary');
  const [promptHint, setPromptHint] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setText(initial.text);
    setStartMsInput(formatMs(initial.startMs));
    setEndMsInput(formatMs(initial.endMs));
    setDurationInput(formatMs(Math.max(1000, initial.endMs - initial.startMs)));
  }, [initial.text, initial.startMs, initial.endMs]);

  const startMs = useMemo(() => parseMs(startMsInput), [startMsInput]);
  const endMs = useMemo(() => parseMs(endMsInput), [endMsInput]);
  const durationMs = useMemo(() => parseMs(durationInput), [durationInput]);

  const validation: ValidationState = useMemo(() => {
    const v: ValidationState = {};
    if (!text.trim()) {
      v.textError = '字幕内容不能为空';
    }
    if (!(startMs < endMs)) {
      v.timeError = '起始时间必须早于结束时间';
    }
    const maxDuration = Math.max(0, endMs - startMs) + 5000;
    if (durationMs < 1000) {
      v.durationError = '展示时长至少 1000ms';
    } else if (endMs > startMs && durationMs > maxDuration) {
      v.durationError = `展示时长不能超过 ${maxDuration}ms`;
    }
    if (promptHint.length > 200) {
      v.hintError = 'Prompt Hint 最多 200 字';
    }
    return v;
  }, [text, startMs, endMs, durationMs, promptHint]);

  const canSubmit =
    !submitting &&
    !validation.textError &&
    !validation.timeError &&
    !validation.durationError &&
    !validation.hintError;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const draft: SubtitleCardDraftInput = {
      text: text.trim(),
      startMs,
      endMs,
      displayDurationMs: durationMs,
      type,
      promptHint: promptHint.trim() || undefined,
    };
    onOpenChange(false);
    try {
      await generateAndInsertSingleCardFromSubtitles({ draft });
      showToast('内容卡片已生成并插入时间轴', { type: 'success', duration: 3000 });
      onGenerated?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      showToast(message, { title: '生成内容卡片失败', type: 'error', duration: 5000 });
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    text,
    startMs,
    endMs,
    durationMs,
    type,
    promptHint,
    onOpenChange,
    onGenerated,
    showToast,
  ]);

  return (
    <DialogContent size="lg">
      <DialogHeader>
        <DialogTitle>生成内容卡片</DialogTitle>
        <p className="mt-1 text-sm text-mac-text-muted">
          基于选中字幕二次编辑后生成单张 web-card。
        </p>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-mac-text-muted">字幕文本</label>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={5}
            resize="vertical"
            error={Boolean(validation.textError)}
            placeholder="将交给 LLM 的字幕内容；可删改冗余词或合并表达"
          />
          {validation.textError ? (
            <p className="text-xs text-mac-red">{validation.textError}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-mac-text-muted">
              起始时间（ms）
            </label>
            <input
              type="number"
              min={0}
              value={startMsInput}
              onChange={(event) => setStartMsInput(event.target.value)}
              className="flex h-9 w-full rounded-lg border border-mac-border bg-mac-elevated px-3 text-sm text-foreground outline-none focus:border-mac-blue focus:shadow-[0_0_0_3px_rgba(10,132,255,0.2)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-mac-text-muted">
              结束时间（ms）
            </label>
            <input
              type="number"
              min={0}
              value={endMsInput}
              onChange={(event) => setEndMsInput(event.target.value)}
              className="flex h-9 w-full rounded-lg border border-mac-border bg-mac-elevated px-3 text-sm text-foreground outline-none focus:border-mac-blue focus:shadow-[0_0_0_3px_rgba(10,132,255,0.2)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-mac-text-muted">
              展示时长（ms）
            </label>
            <input
              type="number"
              min={1000}
              value={durationInput}
              onChange={(event) => setDurationInput(event.target.value)}
              className="flex h-9 w-full rounded-lg border border-mac-border bg-mac-elevated px-3 text-sm text-foreground outline-none focus:border-mac-blue focus:shadow-[0_0_0_3px_rgba(10,132,255,0.2)]"
            />
          </div>
        </div>
        {validation.timeError ? (
          <p className="text-xs text-mac-red">{validation.timeError}</p>
        ) : null}
        {validation.durationError ? (
          <p className="text-xs text-mac-red">{validation.durationError}</p>
        ) : null}

        <div className="space-y-1">
          <label className="text-xs font-medium text-mac-text-muted">
            卡片类型倾向
          </label>
          <Select
            value={type}
            options={CARD_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(event) => setType(event.target.value as AICardType)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-mac-text-muted">
            Prompt Hint（可选，用于给 LLM 补充指令）
          </label>
          <input
            type="text"
            value={promptHint}
            onChange={(event) => setPromptHint(event.target.value)}
            maxLength={220}
            placeholder="例如：突出关键数字 / 做成引用样式 / 极简排版"
            className="flex h-9 w-full rounded-lg border border-mac-border bg-mac-elevated px-3 text-sm text-foreground outline-none focus:border-mac-blue focus:shadow-[0_0_0_3px_rgba(10,132,255,0.2)]"
          />
          {validation.hintError ? (
            <p className="text-xs text-mac-red">{validation.hintError}</p>
          ) : null}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
          取消
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
          生成并插入
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
