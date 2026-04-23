import { describe, expect, it } from 'vitest';
import { useAIStore } from '../src/store/ai';
import type { WorkflowStep } from '../src/store/ai';
import type { AppPage } from '../src/lib/electron-api';

describe('WorkflowStep type extensions', () => {
  it('accepts script_generating and douyin_importing as valid steps', () => {
    const s1: WorkflowStep = 'script_generating';
    const s2: WorkflowStep = 'douyin_importing';
    expect(s1).toBe('script_generating');
    expect(s2).toBe('douyin_importing');
  });
});

describe('AIStore.pendingAutoParams', () => {
  it('starts null and accepts set/clear', () => {
    useAIStore.getState().setPendingAutoParams(null);
    expect(useAIStore.getState().pendingAutoParams).toBeNull();
    useAIStore
      .getState()
      .setPendingAutoParams({ templateId: 'news-broadcast', roleId: 'none', voiceId: 'female-shaonv' });
    expect(useAIStore.getState().pendingAutoParams?.voiceId).toBe('female-shaonv');
    useAIStore.getState().setPendingAutoParams(null);
    expect(useAIStore.getState().pendingAutoParams).toBeNull();
  });
});

describe('AppPage type extension', () => {
  it('accepts auto-run', () => {
    const p: AppPage = 'auto-run';
    expect(p).toBe('auto-run');
  });
});
