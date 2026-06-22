import { describe, expect, it } from 'vitest';
import { computeImportDialogSeed } from '../src/components/script/ImportScriptDialog';
import type { AutoWorkflowParams } from '../src/store/ai';

const defaults: AutoWorkflowParams = {
  templateId: 'news-broadcast',
  roleId: 'none',
  voiceId: 'female-shaonv',
};

describe('computeImportDialogSeed', () => {
  it('无 initial 入参时回退到空值/默认参数', () => {
    const seed = computeImportDialogSeed({ defaults, defaultModelBinding: null });
    expect(seed.content).toBe('');
    expect(seed.projectName).toBe('');
    expect(seed.parentDir).toBeNull();
    expect(seed.autoMode).toBe(false);
    expect(seed.autoParams.templateId).toBe('news-broadcast');
    expect(seed.modelBinding).toBeNull();
  });

  it('应用预填值并以 templateIdOverride 覆盖模板（其余参数沿用 defaults）', () => {
    const seed = computeImportDialogSeed({
      defaults,
      defaultModelBinding: { providerId: 'p1', model: 'gpt' },
      initialContent: '转录稿正文',
      initialProjectName: '博主-标题',
      initialParentDir: '/tmp/out',
      initialAutoMode: true,
      templateIdOverride: 'rewrite-remix',
    });
    expect(seed.content).toBe('转录稿正文');
    expect(seed.projectName).toBe('博主-标题');
    expect(seed.parentDir).toBe('/tmp/out');
    expect(seed.autoMode).toBe(true);
    expect(seed.autoParams.templateId).toBe('rewrite-remix');
    expect(seed.autoParams.roleId).toBe('none');
    expect(seed.autoParams.voiceId).toBe('female-shaonv');
    expect(seed.modelBinding).toEqual({ providerId: 'p1', model: 'gpt' });
  });
});
