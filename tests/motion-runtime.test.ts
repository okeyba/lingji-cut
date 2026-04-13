import React from 'react';
import { describe, expect, it } from 'vitest';
import {
  createMotionComponent,
  MOTION_SANDBOX_REFERENCE,
  SANDBOX_API_KEYS,
} from '../src/lib/motion-runtime';

describe('motion-runtime', () => {
  it('从编译代码创建可执行组件', () => {
    const component = createMotionComponent(`
      const MotionComponent = ({ frame, width, height }) =>
        React.createElement('div', {
          id: 'motion-card',
          'data-frame': frame,
          style: { width, height },
        }, 'ok');
    `);

    const element = component({
      frame: 12,
      fps: 30,
      durationInFrames: 150,
      width: 1920,
      height: 1080,
    });

    expect(React.isValidElement(element)).toBe(true);
    expect(element.type).toBe('div');
    expect(element.props.id).toBe('motion-card');
    expect(element.props['data-frame']).toBe(12);
  });

  it('兼容源码内部重新声明 React，不会因为重复声明直接失败', () => {
    (globalThis as typeof globalThis & { __motionTestReact?: typeof React }).__motionTestReact =
      React;

    const component = createMotionComponent(`
      const React = globalThis.__motionTestReact;
      const MotionComponent = () =>
        React.createElement('div', { id: 'local-react' }, 'ok');
    `);

    const element = component({
      frame: 0,
      fps: 30,
      durationInFrames: 90,
      width: 1920,
      height: 1080,
    });

    expect(React.isValidElement(element)).toBe(true);
    expect(element.props.id).toBe('local-react');

    delete (globalThis as typeof globalThis & { __motionTestReact?: typeof React })
      .__motionTestReact;
  });

  it('兼容旧版 window.Remotion / window.React 取值方式', () => {
    const component = createMotionComponent(`
      const React = window.React;
      const { interpolate } = window.Remotion;
      const MotionComponent = ({ frame }) =>
        React.createElement('div', { id: 'legacy-motion' }, String(interpolate(frame, [0, 10], [10, 20])));
    `);

    const element = component({
      frame: 5,
      fps: 30,
      durationInFrames: 90,
      width: 1920,
      height: 1080,
    });

    expect(React.isValidElement(element)).toBe(true);
    expect(element.props.id).toBe('legacy-motion');
    expect(element.props.children).toBe('15');
  });

  it('导出统一的 sandbox API 清单和参考文档', () => {
    expect(SANDBOX_API_KEYS).toContain('React');
    expect(SANDBOX_API_KEYS).toContain('interpolate');
    expect(SANDBOX_API_KEYS).toContain('noise2D');
    expect(SANDBOX_API_KEYS).toContain('CameraMotionBlur');
    expect(SANDBOX_API_KEYS).toContain('createSmoothSvgPath');

    expect(MOTION_SANDBOX_REFERENCE).toContain('React:');
    expect(MOTION_SANDBOX_REFERENCE).toContain('Remotion 核心:');
    expect(MOTION_SANDBOX_REFERENCE).toContain('- interpolate');
    expect(MOTION_SANDBOX_REFERENCE).toContain('Shapes:');
  });
});
