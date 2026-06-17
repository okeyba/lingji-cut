import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../electron/agent-skills/frontmatter';

describe('parseFrontmatter', () => {
  it('解析 name 与多行 description', () => {
    const raw = [
      '---',
      'name: lingji-video-workflow',
      'description: >-',
      '  line one',
      '  line two',
      '---',
      '',
      '# Body',
    ].join('\n');
    const fm = parseFrontmatter(raw);
    expect(fm).not.toBeNull();
    expect(fm?.name).toBe('lingji-video-workflow');
    expect(fm?.description).toContain('line one');
    expect(fm?.description).toContain('line two');
  });

  it('无 frontmatter 返回 null', () => {
    expect(parseFrontmatter('# just a title\n')).toBeNull();
  });

  it('frontmatter 不可解析返回 null', () => {
    expect(parseFrontmatter('---\n: : bad yaml :\n---\n')).toBeNull();
  });
});
