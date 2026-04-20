export {
  PROMPT_KINDS,
  PROMPT_KIND_META,
  isPromptKind,
  type PromptKind,
  type PromptKindMeta,
  type PromptScope,
  type PromptTemplate,
  type EffectivePromptTemplate,
  type LockedContract,
} from './types';
export { DEFAULT_PROMPT_YAML } from './defaults';
export {
  renderTemplate,
  renderUserPromptWithLock,
  parsePromptYaml,
  serializePromptYaml,
} from './render';

import { DEFAULT_PROMPT_YAML } from './defaults';
import { parsePromptYaml } from './render';
import type { PromptKind, PromptTemplate } from './types';

const builtinCache = new Map<PromptKind, PromptTemplate>();

export function getBuiltinPromptTemplate(kind: PromptKind): PromptTemplate {
  const cached = builtinCache.get(kind);
  if (cached) return cached;
  const { template } = parsePromptYaml(DEFAULT_PROMPT_YAML[kind], kind);
  builtinCache.set(kind, template);
  return template;
}
