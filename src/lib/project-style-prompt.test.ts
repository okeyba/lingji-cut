import { describe, expect, it } from 'vitest';
import {
  appendProjectStylePrompt,
  buildProjectStylePromptBlock,
  getProjectStylePromptFromTemplate,
  projectStylePromptValue,
} from './project-style-prompt';

describe('project style prompt helpers', () => {
  it('formats empty style prompts as no-op blocks', () => {
    expect(projectStylePromptValue('   ')).toBe('无');
    expect(buildProjectStylePromptBlock('   ')).toBe('');
    expect(appendProjectStylePrompt('主体提示词', '   ')).toBe('主体提示词');
  });

  it('appends project style prompt once', () => {
    const style = '冷静科技纪录片风格，低饱和青蓝点缀';
    const prompt = appendProjectStylePrompt('主体提示词', style);

    expect(prompt).toContain('主体提示词');
    expect(prompt).toContain('项目统一风格要求：');
    expect(prompt).toContain(style);
    expect(appendProjectStylePrompt(prompt, style)).toBe(prompt);
  });

  it('reads style prompt from effective template user text', () => {
    expect(
      getProjectStylePromptFromTemplate({
        user: '  极简编辑部风格  ',
      }),
    ).toBe('极简编辑部风格');
  });
});
