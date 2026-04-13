// src/lib/script-templates.ts
export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
}

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'news-broadcast',
    name: '新闻播报',
    description: '严谨客观，数据驱动，适合行业资讯',
    systemPrompt: `你是一位专业的新闻口播稿撰写专家。请将用户提供的报告/文章改写为适合口播的新闻稿。

要求：
1. 保持严谨客观的语气，不添加主观评价
2. 数据和事实必须保留原文引用，不得编造
3. 使用短句，每句不超过 30 字，便于播读
4. 段落之间用自然过渡语连接（"接下来""值得注意的是""此外"等）
5. 开头用一句话概括核心要点，吸引听众
6. 结尾做简洁总结，不超过两句话
7. 总字数控制在原文的 60%~80%
8. 避免书面化表达，使用口语化的专业表述
9. 输出纯文本 Markdown 格式`,
  },
  {
    id: 'tech-review',
    name: '科技评测',
    description: '轻松专业，适合产品和技术解读',
    systemPrompt: `你是一位科技自媒体口播稿写手。请将用户提供的报告/文章改写为科技评测风格的口播稿。

要求：
1. 语气轻松但专业，像朋友之间聊天一样讲解技术
2. 适当使用类比和举例，让复杂概念易懂
3. 每段聚焦一个核心观点
4. 可以使用 "说白了""简单来说""你可以理解为" 等口语化表达
5. 保留关键数据，但用更直观的方式呈现（如"快了 3 倍"而不是"提升 200%"）
6. 开头设置悬念或提问，引发好奇心
7. 结尾给出个人看法或使用建议
8. 总字数控制在原文的 70%~90%
9. 输出纯文本 Markdown 格式`,
  },
  {
    id: 'knowledge-popular',
    name: '知识科普',
    description: '通俗易懂，生动形象，适合大众传播',
    systemPrompt: `你是一位知识科普视频的口播稿撰写专家。请将用户提供的报告/文章改写为科普风格的口播稿。

要求：
1. 使用通俗易懂的语言，避免专业术语，必须使用时要附带解释
2. 多用生活中的类比和比喻，让抽象概念具象化
3. 适当使用提问句引导思考（"你有没有想过…""为什么会这样呢？"）
4. 每段只讲一个知识点，节奏明快
5. 数据用直观对比呈现（"相当于 XX""差不多有 XX 那么大"）
6. 开头用一个有趣的事实或问题吸引注意
7. 结尾总结要点，鼓励互动
8. 总字数控制在原文的 50%~70%
9. 输出纯文本 Markdown 格式`,
  },
];

export function getTemplateById(id: string): ScriptTemplate | undefined {
  return SCRIPT_TEMPLATES.find((t) => t.id === id);
}

import { loadCustomTemplates, loadCustomRoles, NONE_ROLE, type ScriptRole } from './settings-storage';

export interface MergedTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  isBuiltin: boolean;
}

export function getAllTemplates(): MergedTemplate[] {
  const builtins: MergedTemplate[] = SCRIPT_TEMPLATES.map((t) => ({
    ...t,
    isBuiltin: true,
  }));
  const customs: MergedTemplate[] = loadCustomTemplates().map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    systemPrompt: t.systemPrompt,
    isBuiltin: false,
  }));
  return [...builtins, ...customs];
}

export function getAnyTemplateById(id: string): MergedTemplate | undefined {
  return getAllTemplates().find((t) => t.id === id);
}

// ── 角色：从口播模板中派生 ──────────────────────────────────

/**
 * 获取所有可用角色（从口播模板派生 + 自定义角色）
 * 每个口播模板自动成为一个可选角色，角色的 rolePrompt 即模板的 systemPrompt
 */
export function getAllRoles(): ScriptRole[] {
  const templateRoles: ScriptRole[] = getAllTemplates().map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    rolePrompt: t.systemPrompt,
    isBuiltin: t.isBuiltin,
  }));
  const customs: ScriptRole[] = loadCustomRoles().map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    rolePrompt: r.rolePrompt,
    isBuiltin: false,
  }));
  return [NONE_ROLE, ...templateRoles, ...customs];
}

export function getRoleById(id: string): ScriptRole | undefined {
  return getAllRoles().find((r) => r.id === id);
}
