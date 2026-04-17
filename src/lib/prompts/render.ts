import YAML from 'yaml';
import type { PromptKind, PromptTemplate } from './types';

const TEMPLATE_VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

export function renderTemplate(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(TEMPLATE_VAR_RE, (_, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

export interface PromptYamlParseResult {
  template: PromptTemplate;
  warnings: string[];
}

export function parsePromptYaml(raw: string, kind: PromptKind): PromptYamlParseResult {
  const warnings: string[] = [];
  let data: unknown;
  try {
    data = YAML.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`YAML 解析失败（${kind}）：${message}`);
  }

  if (!data || typeof data !== 'object') {
    throw new Error(`YAML 顶层必须是对象（${kind}）`);
  }

  const obj = data as Record<string, unknown>;
  const user = typeof obj.user === 'string' ? obj.user : '';
  if (!user.trim()) {
    throw new Error(`提示词 user 字段不能为空（${kind}）`);
  }

  const name = typeof obj.name === 'string' ? obj.name : kind;
  const description = typeof obj.description === 'string' ? obj.description : undefined;
  const version = typeof obj.version === 'number' ? obj.version : undefined;
  const system = typeof obj.system === 'string' ? obj.system : undefined;

  return {
    template: { name, description, version, system, user },
    warnings,
  };
}

export function serializePromptYaml(template: PromptTemplate): string {
  return YAML.stringify(template, {
    lineWidth: 0,
    blockQuote: 'literal',
  });
}
