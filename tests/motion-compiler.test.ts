import { describe, expect, it } from 'vitest';
import { compileMotionSource } from '../src/lib/motion-compiler';

describe('compileMotionSource', () => {
  it('编译合法 TSX 并输出可执行代码', () => {
    const result = compileMotionSource(`
      const MotionComponent = ({
        frame,
        width,
        height,
      }: {
        frame: number;
        fps: number;
        durationInFrames: number;
        width: number;
        height: number;
      }) => <div data-frame={frame} style={{ width, height }}>motion</div>;
    `);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.compiledCode).toContain('React.createElement');
    expect(result.compiledCode).not.toContain('<div');
  });

  it('拒绝 import/export 语法', () => {
    const result = compileMotionSource(`
      import { interpolate } from 'remotion';
      const MotionComponent = () => <div>{interpolate(0, [0, 1], [0, 1])}</div>;
    `);

    expect(result).toEqual({
      success: false,
      error: 'Motion Card 不支持 import/export，请直接使用沙箱注入的 API',
    });
  });
});
