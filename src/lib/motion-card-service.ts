import type { AISettings } from '../types/ai';
import type {
  MotionCardResult,
  MotionCompileResult,
  MotionGenerateParams,
  MotionModifyParams,
} from '../types/motion';
import { generateText } from './llm';
import { autoFixMotionSource } from './motion-auto-fix';
import { compileMotionSource } from './motion-compiler';
import {
  buildMotionGenerateUserPrompt,
  buildMotionModifyUserPrompt,
  buildMotionSystemPrompt,
  extractMotionCode,
} from './motion-prompt';
import { MOTION_SANDBOX_REFERENCE } from './motion-runtime';

export interface MotionCardService {
  generate(params: MotionGenerateParams): Promise<MotionCardResult>;
  modify(params: MotionModifyParams): Promise<MotionCardResult>;
  compile(params: { sourceCode: string }): MotionCompileResult;
  getApiReference(): string;
}

interface MotionCardServiceOptions {
  settings: AISettings;
  generateTextImpl?: typeof generateText;
  compileImpl?: (sourceCode: string) => MotionCompileResult;
  autoFixImpl?: typeof autoFixMotionSource;
}

async function resolveMotionCard(
  settings: AISettings,
  rawText: string,
  options: {
    prompt: string;
    generateTextImpl?: typeof generateText;
    compileImpl?: (sourceCode: string) => MotionCompileResult;
    autoFixImpl?: typeof autoFixMotionSource;
  },
): Promise<MotionCardResult> {
  const sourceCode = extractMotionCode(rawText);
  const compileImpl = options.compileImpl ?? compileMotionSource;
  const compileResult = compileImpl(sourceCode);

  if (compileResult.success) {
    return {
      success: true,
      sourceCode,
      compiledCode: compileResult.compiledCode,
      retryCount: 0,
    };
  }

  const autoFixImpl = options.autoFixImpl ?? autoFixMotionSource;
  return autoFixImpl({
    settings,
    sourceCode,
    error: compileResult.error,
    stage: 'compile',
    generateTextImpl: options.generateTextImpl,
    compileImpl,
  });
}

export function createMotionCardService(options: MotionCardServiceOptions): MotionCardService {
  const {
    settings,
    generateTextImpl = generateText,
    compileImpl = compileMotionSource,
    autoFixImpl = autoFixMotionSource,
  } = options;

  return {
    async generate(params) {
      const rawText = await generateTextImpl(
        settings,
        buildMotionSystemPrompt(),
        buildMotionGenerateUserPrompt(params),
      );

      return resolveMotionCard(settings, rawText, {
        prompt: params.prompt,
        generateTextImpl,
        compileImpl,
        autoFixImpl,
      });
    },

    async modify(params) {
      const rawText = await generateTextImpl(
        settings,
        buildMotionSystemPrompt(),
        buildMotionModifyUserPrompt(params),
      );

      return resolveMotionCard(settings, rawText, {
        prompt: params.instruction,
        generateTextImpl,
        compileImpl,
        autoFixImpl,
      });
    },

    compile({ sourceCode }) {
      return compileImpl(sourceCode);
    },

    getApiReference() {
      return MOTION_SANDBOX_REFERENCE;
    },
  };
}
