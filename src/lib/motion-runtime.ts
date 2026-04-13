import React from 'react';
import * as Remotion from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { noise2D, noise3D } from '@remotion/noise';
import * as mediaUtils from '@remotion/media-utils';
import * as pathHelpers from '@remotion/paths';
import * as shapes from '@remotion/shapes';
import * as transitions from '@remotion/transitions';
import type { MotionComponentProps } from '../types/motion';

function readOptionalModuleExport<T extends object, K extends PropertyKey>(
  namespace: T,
  key: K,
): unknown {
  return key in namespace ? (namespace as Record<PropertyKey, unknown>)[key] : undefined;
}

const CORE_SANDBOX = {
  React,
  interpolate: readOptionalModuleExport(Remotion, 'interpolate'),
  interpolateColors: readOptionalModuleExport(Remotion, 'interpolateColors'),
  spring: readOptionalModuleExport(Remotion, 'spring'),
  Easing: readOptionalModuleExport(Remotion, 'Easing'),
  random: readOptionalModuleExport(Remotion, 'random'),
  useCurrentFrame: readOptionalModuleExport(Remotion, 'useCurrentFrame'),
  useVideoConfig: readOptionalModuleExport(Remotion, 'useVideoConfig'),
  delayRender: readOptionalModuleExport(Remotion, 'delayRender'),
  continueRender: readOptionalModuleExport(Remotion, 'continueRender'),
  AbsoluteFill: readOptionalModuleExport(Remotion, 'AbsoluteFill'),
  Sequence: readOptionalModuleExport(Remotion, 'Sequence'),
  Series: readOptionalModuleExport(Remotion, 'Series'),
  Loop: readOptionalModuleExport(Remotion, 'Loop'),
  Img: readOptionalModuleExport(Remotion, 'Img'),
  OffthreadVideo: readOptionalModuleExport(Remotion, 'OffthreadVideo'),
  Audio: readOptionalModuleExport(Remotion, 'Audio'),
  IFrame: readOptionalModuleExport(Remotion, 'IFrame'),
  staticFile: readOptionalModuleExport(Remotion, 'staticFile'),
  noise2D,
  noise3D,
  CameraMotionBlur,
};

export const MOTION_SANDBOX = Object.freeze({
  ...CORE_SANDBOX,
  ...shapes,
  ...pathHelpers,
  ...transitions,
  createSmoothSvgPath: mediaUtils.createSmoothSvgPath,
  getWaveformPortion: mediaUtils.getWaveformPortion,
  visualizeAudio: mediaUtils.visualizeAudio,
});

function createCompatGlobalScope(base: object | undefined) {
  const scope = Object.create(base ?? null) as Record<string, unknown>;
  scope.React = React;
  scope.Remotion = MOTION_SANDBOX;
  return Object.freeze(scope);
}

const MOTION_WINDOW_COMPAT = createCompatGlobalScope(
  typeof window === 'object' ? window : undefined,
);
const MOTION_GLOBAL_COMPAT = createCompatGlobalScope(
  typeof globalThis === 'object' ? globalThis : undefined,
);

const MOTION_RUNTIME_SCOPE = Object.freeze({
  ...MOTION_SANDBOX,
  window: MOTION_WINDOW_COMPAT,
  globalThis: MOTION_GLOBAL_COMPAT,
  self: MOTION_WINDOW_COMPAT,
});

export const SANDBOX_API_KEYS = Object.freeze(Object.keys(MOTION_SANDBOX).sort());

function buildCategoryKeys(prefixes: string[]): string[] {
  return SANDBOX_API_KEYS.filter((key) => prefixes.some((prefix) => key === prefix || key.startsWith(prefix)));
}

const SANDBOX_REFERENCE_SECTIONS: Array<{ title: string; keys: string[] }> = [
  {
    title: 'React',
    keys: ['React'],
  },
  {
    title: 'Remotion 核心',
    keys: [
      'interpolate',
      'interpolateColors',
      'spring',
      'Easing',
      'random',
      'useCurrentFrame',
      'useVideoConfig',
      'delayRender',
      'continueRender',
      'AbsoluteFill',
      'Sequence',
      'Series',
      'Loop',
      'Img',
      'OffthreadVideo',
      'Audio',
      'IFrame',
      'staticFile',
    ],
  },
  {
    title: 'Shapes',
    keys: buildCategoryKeys(['Arrow', 'Circle', 'Ellipse', 'Heart', 'Pie', 'Polygon', 'Rect', 'Star', 'Triangle', 'make']),
  },
  {
    title: 'Paths',
    keys: buildCategoryKeys([
      'cutPath',
      'evolvePath',
      'extendViewBox',
      'getBoundingBox',
      'getInstructionIndexAtLength',
      'getLength',
      'getPointAtLength',
      'getSubpaths',
      'getTangentAtLength',
      'interpolatePath',
      'normalizePath',
      'parsePath',
      'reduceInstructions',
      'resetPath',
      'reversePath',
      'scalePath',
      'serializeInstructions',
      'translatePath',
      'warpPath',
      'PathInternals',
    ]),
  },
  {
    title: 'Noise',
    keys: ['noise2D', 'noise3D'],
  },
  {
    title: 'Transitions',
    keys: buildCategoryKeys(['TransitionSeries', 'linearTiming', 'springTiming', 'useTransitionProgress']),
  },
  {
    title: 'Media Utils',
    keys: ['visualizeAudio', 'getWaveformPortion', 'createSmoothSvgPath'],
  },
  {
    title: 'Effects',
    keys: ['CameraMotionBlur'],
  },
];

export const MOTION_SANDBOX_REFERENCE = SANDBOX_REFERENCE_SECTIONS.filter(
  (section) => section.keys.length > 0,
)
  .map((section) => `${section.title}:\n${section.keys.map((key) => `- ${key}`).join('\n')}`)
  .join('\n\n');

export function formatMotionRuntimeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function createMotionComponent(
  compiledCode: string,
): React.ComponentType<MotionComponentProps> {
  const factory = new Function(
    '__motionSandbox',
    `with (__motionSandbox) {
${compiledCode}
return typeof MotionComponent === 'function' ? MotionComponent : null;
}`,
  );
  const component = factory(MOTION_RUNTIME_SCOPE);

  if (typeof component !== 'function') {
    throw new Error('编译结果中未找到 MotionComponent');
  }

  return component as React.ComponentType<MotionComponentProps>;
}
