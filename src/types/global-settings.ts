import type { AISettings } from './ai';

export interface CustomScriptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  rolePrompt: string;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalSettingsFile {
  aiSettings?: AISettings;
  customTemplates?: CustomScriptTemplate[];
  reviewCriteria?: string;
  customRoles?: CustomRole[];
  selectedRole?: string;
}

export const DEFAULT_REVIEW_CRITERIA = `请重点关注：
1. 数据引用是否标注来源
2. 是否有过于书面化的表达
3. 段落过渡是否自然
4. 口播节奏是否合理`;

export const DEFAULT_SELECTED_ROLE = 'none';

export function normalizeGlobalSettingsFile(
  input: GlobalSettingsFile | null | undefined,
): GlobalSettingsFile {
  return {
    aiSettings: input?.aiSettings,
    customTemplates: Array.isArray(input?.customTemplates) ? input.customTemplates : [],
    reviewCriteria:
      typeof input?.reviewCriteria === 'string'
        ? input.reviewCriteria
        : DEFAULT_REVIEW_CRITERIA,
    customRoles: Array.isArray(input?.customRoles) ? input.customRoles : [],
    selectedRole:
      typeof input?.selectedRole === 'string' && input.selectedRole.trim()
        ? input.selectedRole
        : DEFAULT_SELECTED_ROLE,
  };
}
