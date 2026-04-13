import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { loadAISettings, saveAISettings } from '../../store/ai';
import { Field, Input, Slider, Select, SaveButton, SettingsPageHeader } from '../../ui';
import type { SelectOption } from '../../ui';
import { hasUnsavedAIConfigChanges } from './ai-config-utils';
import { useSettingsTabGuard } from './useSettingsTabGuard';
import styles from './SettingsCommon.module.css';

const MINIMAX_MODEL_OPTIONS: SelectOption[] = [
  { value: 'speech-2.8-hd', label: 'speech-2.8-hd' },
  { value: 'speech-2.8-turbo', label: 'speech-2.8-turbo' },
  { value: 'speech-2.6-hd', label: 'speech-2.6-hd' },
  { value: 'speech-2.6-turbo', label: 'speech-2.6-turbo' },
  { value: 'speech-02-hd', label: 'speech-02-hd' },
  { value: 'speech-02-turbo', label: 'speech-02-turbo' },
  { value: 'speech-01-hd', label: 'speech-01-hd' },
  { value: 'speech-01-turbo', label: 'speech-01-turbo' },
];

const EMOTION_OPTIONS: SelectOption[] = [
  { value: '', label: '自动（模型判断）' },
  { value: 'happy', label: '高兴' },
  { value: 'sad', label: '悲伤' },
  { value: 'angry', label: '愤怒' },
  { value: 'fearful', label: '害怕' },
  { value: 'disgusted', label: '厌恶' },
  { value: 'surprised', label: '惊讶' },
  { value: 'calm', label: '中性' },
  { value: 'fluent', label: '生动（2.6 系列）' },
];

interface TTSConfigTabProps {
  onRegisterLeaveGuard?: (guard: (() => Promise<boolean>) | null) => void;
}

function createTTSSnapshot({
  apiKey,
  model,
  voiceId,
  speed,
  vol,
  pitch,
  emotion,
}: {
  apiKey: string;
  model: string;
  voiceId: string;
  speed: number;
  vol: number;
  pitch: number;
  emotion: string;
}): string {
  return JSON.stringify({
    apiKey: apiKey.trim(),
    model,
    voiceId: voiceId.trim(),
    speed,
    vol,
    pitch,
    emotion,
  });
}

export function TTSConfigTab({ onRegisterLeaveGuard }: TTSConfigTabProps) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('speech-2.8-hd');
  const [voiceId, setVoiceId] = useState('male-qn-qingse');
  const [speed, setSpeed] = useState(1.0);
  const [vol, setVol] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [emotion, setEmotion] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const saveFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadAISettings().then((s) => {
      const nextApiKey = s?.minimaxApiKey ?? '';
      const nextModel = s?.minimaxModel ?? 'speech-2.8-hd';
      const nextVoiceId = s?.minimaxVoiceId ?? 'male-qn-qingse';
      const nextSpeed = s?.minimaxSpeed ?? 1.0;
      const nextVol = s?.minimaxVol ?? 1.0;
      const nextPitch = s?.minimaxPitch ?? 0;
      const nextEmotion = s?.minimaxEmotion ?? '';

      setApiKey(nextApiKey);
      setModel(nextModel);
      setVoiceId(nextVoiceId);
      setSpeed(nextSpeed);
      setVol(nextVol);
      setPitch(nextPitch);
      setEmotion(nextEmotion);
      setLastSavedSnapshot(
        createTTSSnapshot({
          apiKey: nextApiKey,
          model: nextModel,
          voiceId: nextVoiceId,
          speed: nextSpeed,
          vol: nextVol,
          pitch: nextPitch,
          emotion: nextEmotion,
        }),
      );
      setHasLoaded(true);
    });
  }, []);

  useEffect(
    () => () => {
      if (saveFeedbackTimerRef.current) {
        clearTimeout(saveFeedbackTimerRef.current);
      }
    },
    [],
  );

  const currentSnapshot = useMemo(
    () =>
      createTTSSnapshot({
        apiKey,
        model,
        voiceId,
        speed,
        vol,
        pitch,
        emotion,
      }),
    [apiKey, model, voiceId, speed, vol, pitch, emotion],
  );

  const hasUnsavedChanges =
    hasLoaded && hasUnsavedAIConfigChanges(lastSavedSnapshot, currentSnapshot);

  useEffect(() => {
    if (hasUnsavedChanges && saved) {
      setSaved(false);
    }
  }, [hasUnsavedChanges, saved]);

  const handleSave = useCallback(async () => {
    try {
      const current = await loadAISettings();
      await saveAISettings({
        ...(current ?? {
          llmProviders: [],
          defaultProviderId: null,
          defaultModel: null,
          llmBaseUrl: '',
          llmApiKey: '',
          llmModel: '',
          jimengApiUrl: '',
          jimengSessionId: '',
        }),
        minimaxApiKey: apiKey,
        minimaxModel: model,
        minimaxVoiceId: voiceId,
        minimaxSpeed: speed,
        minimaxVol: vol,
        minimaxPitch: pitch,
        minimaxEmotion: emotion,
      });
      setApiKey(apiKey.trim());
      setVoiceId(voiceId.trim());
      setLastSavedSnapshot(currentSnapshot);
      setSaved(true);
      if (saveFeedbackTimerRef.current) {
        clearTimeout(saveFeedbackTimerRef.current);
      }
      saveFeedbackTimerRef.current = setTimeout(() => setSaved(false), 2000);
      return true;
    } catch (error) {
      window.alert(error instanceof Error ? `保存 TTS 配置失败：${error.message}` : '保存 TTS 配置失败，请稍后重试。');
      return false;
    }
  }, [apiKey, currentSnapshot, emotion, model, pitch, speed, voiceId, vol]);

  useSettingsTabGuard({
    title: 'TTS 配置',
    hasUnsavedChanges,
    onSave: handleSave,
    onRegisterLeaveGuard,
  });

  return (
    <>
      <SettingsPageHeader
        title="TTS 语音合成配置"
        description="MiniMax T2A v2 接口配置，用于 AI 一键剪辑的语音生成"
      />

      <div className={styles.formStack}>
        <Field label="MiniMax API Key">
          <Input
            variant="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="your-api-key"
          />
        </Field>

        <Field label="模型">
          <Select
            value={model}
            options={MINIMAX_MODEL_OPTIONS}
            onChange={(e) => setModel(e.target.value)}
          />
        </Field>

        <Field label="音色 ID" hint="系统音色 ID 或克隆音色 ID，参考 MiniMax 音色列表">
          <Input
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            placeholder="例如：male-qn-qingse"
          />
        </Field>

        <Field label={`语速：${speed.toFixed(1)}x`} hint="范围 0.5–2.0，默认 1.0">
          <Slider min={0.5} max={2.0} step={0.1} value={speed} onChange={setSpeed} size="md" />
        </Field>

        <Field label={`音量：${vol.toFixed(1)}`} hint="范围 0.1–10，默认 1.0">
          <Slider min={0.1} max={10} step={0.1} value={vol} onChange={setVol} size="md" />
        </Field>

        <Field label={`音调：${pitch > 0 ? '+' : ''}${pitch}`} hint="范围 -12–12，0 为原音色">
          <Slider min={-12} max={12} step={1} value={pitch} onChange={setPitch} size="md" />
        </Field>

        <Field
          label="情绪"
          hint="speech-2.8 系列不支持 whisper；fluent 仅 2.6 系列生效"
        >
          <Select
            value={emotion}
            options={EMOTION_OPTIONS}
            onChange={(e) => setEmotion(e.target.value)}
          />
        </Field>
      </div>

      <SaveButton
        onClick={() => {
          void handleSave();
        }}
        saved={saved}
        disabled={!hasLoaded || !hasUnsavedChanges}
        defaultLabel="保存 TTS 配置"
        className={styles.saveButton}
      />
    </>
  );
}
