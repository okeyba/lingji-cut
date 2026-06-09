import { loadGlobalSettings } from '../global-settings';
import { resolveDefaultTTSConfig } from '../../src/lib/tts-settings';
import { readPromptBindings } from '../prompt-bindings-io';
import { GenerationError } from './generation-error';
import type { AISettings, TTSProvider, TTSVoicePreset, PromptBindingMap } from '../../src/types/ai';

/** 读取全局 AISettings（明文，含 keys）；无则返回 null */
export async function loadHeadlessAISettings(userDataPath: string): Promise<AISettings | null> {
  const file = await loadGlobalSettings(userDataPath);
  return file?.aiSettings ?? null;
}

export interface HeadlessTTSConfig {
  provider: TTSProvider;
  voice: TTSVoicePreset;
}

/** 装配默认 TTS provider+voice，缺失项抛 GenerationError */
export async function loadHeadlessTTSConfig(userDataPath: string): Promise<HeadlessTTSConfig> {
  const settings = await loadHeadlessAISettings(userDataPath);
  if (!settings) {
    throw new GenerationError('no_settings', '未找到应用设置（settings.json）。请先在应用中配置 TTS。');
  }
  const { provider, voice } = resolveDefaultTTSConfig(settings);
  if (!provider) {
    throw new GenerationError('no_tts_provider', '未配置 TTS Provider，请先在应用设置中配置。');
  }
  if (!voice) {
    throw new GenerationError('no_tts_voice', '未配置 TTS 音色，请先在应用设置中配置。');
  }
  if (!provider.apiKey?.trim()) {
    throw new GenerationError('no_api_key', 'TTS Provider 缺少 API Key，请在应用设置中填写。');
  }
  return { provider, voice };
}

/** 读取项目级 prompt 绑定 */
export async function loadHeadlessProjectBindings(projectDir: string): Promise<PromptBindingMap> {
  return readPromptBindings({ projectDir });
}
