import { describe, expect, it } from 'vitest';
import { getAgentDef, listAgentDefs } from '../../electron/agent-runtime/registry';

describe('agent-runtime registry', () => {
  describe('listAgentDefs', () => {
    it('contains exactly one def (pi)', () => {
      expect(listAgentDefs()).toHaveLength(1);
    });

    it('contains only pi', () => {
      const ids = listAgentDefs().map((d) => d.id);
      expect(ids).toEqual(['pi']);
    });
  });

  describe('getAgentDef', () => {
    it('returns pi def with correct shape', () => {
      const def = getAgentDef('pi');
      expect(def).not.toBeNull();
      expect(def!.id).toBe('pi');
      expect(def!.name).toBe('Pi');
      expect(def!.bin).toBe('pi');
      expect(def!.streamFormat).toBe('pi-rpc');
    });

    it('returns null for removed/unknown ids', () => {
      expect(getAgentDef('claude')).toBeNull();
      expect(getAgentDef('codex')).toBeNull();
      expect(getAgentDef('unknown')).toBeNull();
      expect(getAgentDef('')).toBeNull();
    });
  });

  describe('pi buildArgs', () => {
    it('includes --mode rpc flags', () => {
      const def = getAgentDef('pi')!;
      const args = def.buildArgs({ prompt: 'hello' });
      expect(args).toContain('--mode');
      expect(args).toContain('rpc');
    });

    it('includes --session <sessionId> when resumeSessionId provided', () => {
      const def = getAgentDef('pi')!;
      const args = def.buildArgs({ prompt: 'hello', resumeSessionId: 'pi-session-abc' });
      expect(args).toContain('--session');
      const idx = args.indexOf('--session');
      expect(args[idx + 1]).toBe('pi-session-abc');
    });

    it('reasoning 非 default → 透传 --thinking', () => {
      const def = getAgentDef('pi')!;
      const args = def.buildArgs({ prompt: 'hi', reasoning: 'high' });
      expect(args).toContain('--thinking');
      expect(args[args.indexOf('--thinking') + 1]).toBe('high');
    });

    it("reasoning='default' → 不透传 --thinking", () => {
      const def = getAgentDef('pi')!;
      const args = def.buildArgs({ prompt: 'hi', reasoning: 'default' });
      expect(args).not.toContain('--thinking');
    });
  });

  describe('pi reasoningOptions', () => {
    it('pi 暴露非空 reasoningOptions 且默认 default', () => {
      const def = getAgentDef('pi')!;
      expect(def.reasoningOptions && def.reasoningOptions.length).toBeGreaterThan(0);
      expect(def.defaultReasoning).toBe('default');
    });
  });

  describe('registry id uniqueness', () => {
    it('all def ids are unique (no duplicates)', () => {
      const ids = listAgentDefs().map((d) => d.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });

  describe('models list', () => {
    it('pi def has non-empty models list', () => {
      const def = getAgentDef('pi')!;
      expect(def.models).toBeDefined();
      expect(def.models!.length).toBeGreaterThan(0);
    });

    it('pi models have id and label strings', () => {
      const def = getAgentDef('pi')!;
      for (const m of def.models!) {
        expect(typeof m.id).toBe('string');
        expect(m.id.length).toBeGreaterThan(0);
        expect(typeof m.label).toBe('string');
        expect(m.label.length).toBeGreaterThan(0);
      }
    });
  });
});
