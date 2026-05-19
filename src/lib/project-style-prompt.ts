import { getBuiltinPromptTemplate, type PromptTemplate } from './prompts';

export function normalizeProjectStylePrompt(value?: string | null): string {
  return value?.trim() ?? '';
}

export function getProjectStylePromptFromTemplate(template?: Pick<PromptTemplate, 'user'> | null): string {
  return normalizeProjectStylePrompt(
    template?.user ?? getBuiltinPromptTemplate('project.style').user,
  );
}

export function projectStylePromptValue(value?: string | null): string {
  const normalized = normalizeProjectStylePrompt(value);
  return normalized || '无';
}

export function buildProjectStylePromptBlock(value?: string | null): string {
  const normalized = normalizeProjectStylePrompt(value);
  if (!normalized) return '';
  return `项目统一风格要求：\n${normalized}`;
}

export function appendProjectStylePrompt(prompt: string, stylePrompt?: string | null): string {
  const block = buildProjectStylePromptBlock(stylePrompt);
  const base = prompt.trim();
  if (!block) return base;
  const normalized = normalizeProjectStylePrompt(stylePrompt);
  if (normalized && base.includes(normalized)) return base;
  return `${base}\n\n${block}`;
}
