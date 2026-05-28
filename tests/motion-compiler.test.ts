import { describe, expect, it } from 'vitest';
import { compileMotionSource } from '../src/lib/motion-compiler';

const VALID_HYPERFRAMES_MOTION = `
<div class="motion-card">
  <style>.motion-card { width: 100%; height: 100%; }</style>
  <div class="title">ok</div>
  <script>
    const root = document.currentScript.closest('.motion-card');
    const local = gsap.timeline({ paused: true });
    local.from(root.querySelector('.title'), { opacity: 0, y: 20, duration: 0.4 }, 0);
    window.__lingjiMotionTimelines = window.__lingjiMotionTimelines || [];
    window.__lingjiMotionTimelines.push(local);
  </script>
</div>`;

describe('motion-compiler', () => {
  it('accepts HyperFrames HTML + CSS + GSAP fragments', () => {
    const result = compileMotionSource(VALID_HYPERFRAMES_MOTION);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.html).toContain('gsap.timeline');
      expect(result.html).toContain('__lingjiMotionTimelines.push(local)');
    }
  });

  it('strips markdown html fences before validating', () => {
    const result = compileMotionSource(`\`\`\`html\n${VALID_HYPERFRAMES_MOTION}\n\`\`\``);

    expect(result.success).toBe(true);
  });

  it('rejects React component snippets', () => {
    const result = compileMotionSource('const MotionComponent = () => React.createElement("div");');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Motion Card 必须包含同步 <script>');
    }
  });

  it('rejects module or async syntax so timelines stay synchronous', () => {
    const moduleResult = compileMotionSource('import gsap from "gsap";');
    const asyncResult = compileMotionSource(`${VALID_HYPERFRAMES_MOTION}\nasync function later() {}`);

    expect(moduleResult.success).toBe(false);
    expect(asyncResult.success).toBe(false);
  });
});
