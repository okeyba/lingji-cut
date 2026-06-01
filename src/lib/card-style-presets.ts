import type { VisualStylePreset } from '../types/ai';
import { DEFAULT_STYLE_PRESET_ID } from '../types/ai';

// facet 内容在 Task 3 用 defaults.ts 抽出的视觉系统块替换；此处先放非空占位，保证解析层可测试。
const EDITORIAL_EINK: VisualStylePreset = {
  id: DEFAULT_STYLE_PRESET_ID,
  name: '电子杂志墨水',
  description: '深色克制社论风：衬线标题、hairline 分隔、无渐变无阴影、单一系统蓝 accent。',
  tags: ['深色', '社论', '克制'],
  source: 'deck-guizang-editorial / web-proto-editorial',
  palette: { bg: '#0E0E10', ink: '#ECE7DA', muted: '#8A8478', accent: '#0A84FF' },
  fonts: {
    display: "'Noto Serif SC', Georgia, serif",
    body: "'PingFang SC', 'Noto Sans SC', sans-serif",
    mono: "'SF Mono', 'JetBrains Mono', monospace",
  },
  facets: { motion: '电子杂志墨水占位视觉系统块（Task 3 替换）', cover: '', image: '' },
  preview: {},
};

export const VISUAL_STYLE_PRESETS: VisualStylePreset[] = [EDITORIAL_EINK];

export function listStylePresets(): VisualStylePreset[] {
  return VISUAL_STYLE_PRESETS;
}
