import { describe, expect, it } from 'vitest';
import { DEFAULT_PROMPT_YAML } from '../src/lib/prompts/defaults';
import { getStyleFacetBlock } from '../src/lib/card-style';
import {
  buildSegmentCardPrompt,
  buildCoverPromptRegenerationPrompt,
} from '../src/lib/ai-analysis';
import type { AISegment } from '../src/types/ai';

describe('提示词 styleSystemBlock 占位符', () => {
  it('cards.segment 含占位符', () => {
    expect(DEFAULT_PROMPT_YAML['cards.segment']).toContain('{{styleSystemBlock}}');
  });
  it('cover.regeneration 含占位符', () => {
    expect(DEFAULT_PROMPT_YAML['cover.regeneration']).toContain('{{styleSystemBlock}}');
  });
  it('card.image 含占位符', () => {
    expect(DEFAULT_PROMPT_YAML['card.image']).toContain('{{styleSystemBlock}}');
  });
});

describe('editorial-eink facet 非空（motion/cover）', () => {
  it('motion facet 含「电子杂志」锚点', () => {
    expect(getStyleFacetBlock('editorial-eink', 'motion')).toContain('电子杂志');
  });
  it('cover facet 含「缩略图」锚点', () => {
    expect(getStyleFacetBlock('editorial-eink', 'cover')).toContain('缩略图');
  });
  // 默认预设 editorial-eink 的 image facet 故意留空：card.image 用裸 {{styleSystemBlock}} 占位符，
  // 空 facet 渲染为空字符串，不会产生悬挂的 ===== 风格锚点 ===== 标题（非疏漏）。
  it('image facet 默认为空（非疏漏）', () => {
    expect(getStyleFacetBlock('editorial-eink', 'image')).toBe('');
  });
});

describe('build 函数注入 styleSystemBlock', () => {
  const segment: AISegment = {
    id: 'seg-1',
    title: '示例段落',
    summary: '示例段落摘要',
    startMs: 0,
    endMs: 3_000,
    transcriptExcerpt: '示例逐字稿',
  };

  it('cards.segment 默认（无 stylePresetId）注入 editorial-eink motion 块', () => {
    const prompt = buildSegmentCardPrompt({
      programContext: '节目摘要：测试',
      segment,
    });
    expect(prompt).toContain('电子杂志');
  });

  it('cover.regeneration 默认（无 stylePresetId）注入 editorial-eink cover 块', () => {
    const prompt = buildCoverPromptRegenerationPrompt({});
    expect(prompt).toContain('缩略图');
  });
});
